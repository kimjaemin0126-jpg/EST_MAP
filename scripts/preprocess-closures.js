const fs = require('fs')
const path = require('path')
const iconv = require('iconv-lite')
const Papa = require('papaparse')
const proj4 = require('proj4')

const DATA_DIR = path.join(__dirname, '../public/data')
const RAW_DATA_DIR = path.join(__dirname, '../../DP/data')
const LEGACY_RAW_DATA_DIR = path.join(__dirname, '../src/data')

function resolveRawSource(fileName) {
  const canonicalPath = path.join(RAW_DATA_DIR, fileName)
  if (fs.existsSync(canonicalPath)) return canonicalPath
  return path.join(LEGACY_RAW_DATA_DIR, fileName)
}

const DEFAULT_SOURCES = [
  { category: '일반음식점', inputPath: resolveRawSource('서울시 일반음식점 인허가 정보.csv') },
  { category: '휴게음식점', inputPath: resolveRawSource('서울시 휴게음식점 인허가 정보.csv') },
  { category: '미용업', inputPath: resolveRawSource('서울시 미용업 인허가 정보.csv') },
]
const DONG_GEOJSON_PATH = path.join(__dirname, '../src/data/seoul_dong.geojson')
const PROCESSED_DONG_PATH = path.join(__dirname, '../src/data/processed_by_dong.json')
const SCHEMA_VERSION = 5
const SOURCE_CRS = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs'
const TARGET_CRS = '+proj=longlat +datum=WGS84 +no_defs'

const DISTRICT_NAMES = {
  11110: '종로구', 11140: '중구', 11170: '용산구', 11200: '성동구',
  11215: '광진구', 11230: '동대문구', 11260: '중랑구', 11290: '성북구',
  11305: '강북구', 11320: '도봉구', 11350: '노원구', 11380: '은평구',
  11410: '서대문구', 11440: '마포구', 11470: '양천구', 11500: '강서구',
  11530: '구로구', 11545: '금천구', 11560: '영등포구', 11590: '동작구',
  11620: '관악구', 11650: '서초구', 11680: '강남구', 11710: '송파구',
  11740: '강동구',
}

function clean(value) {
  return String(value || '').trim()
}

function getQuarterCode(date, year) {
  const match = clean(date).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match || match[1] !== year) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${year}${Math.ceil(month / 3)}`
}

function isSeoulCoordinate(lng, lat) {
  return lng >= 126.7 && lng <= 127.3 && lat >= 37.4 && lat <= 37.75
}

function getDistrict(address) {
  return clean(address).match(/서울(?:특별시)?\s+([가-힣]+구)(?:\s|$)/)?.[1] || '지역 미상'
}

function getBounds(coordinates, bounds = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (typeof coordinates[0] === 'number') {
    bounds[0] = Math.min(bounds[0], coordinates[0])
    bounds[1] = Math.min(bounds[1], coordinates[1])
    bounds[2] = Math.max(bounds[2], coordinates[0])
    bounds[3] = Math.max(bounds[3], coordinates[1])
    return bounds
  }
  coordinates.forEach((item) => getBounds(item, bounds))
  return bounds
}

function pointInRing(lng, lat, ring) {
  let inside = false
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentLng, currentLat] = ring[current]
    const [previousLng, previousLat] = ring[previous]
    const intersects = (currentLat > lat) !== (previousLat > lat)
      && lng < ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(lng, lat, polygon) {
  if (!polygon.length || !pointInRing(lng, lat, polygon[0])) return false
  return !polygon.slice(1).some((hole) => pointInRing(lng, lat, hole))
}

function geometryContainsPoint(geometry, lng, lat) {
  if (geometry.type === 'Polygon') return pointInPolygon(lng, lat, geometry.coordinates)
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => pointInPolygon(lng, lat, polygon))
  }
  return false
}

function loadDongBoundaries() {
  const geoData = JSON.parse(fs.readFileSync(DONG_GEOJSON_PATH, 'utf8'))
  const processed = JSON.parse(fs.readFileSync(PROCESSED_DONG_PATH, 'utf8'))
  const byDistrict = new Map()

  geoData.features.forEach((feature) => {
    const code = String(feature.properties?.ADSTRD_CD || '')
    const districtCode = code.slice(0, 5)
    const districtName = DISTRICT_NAMES[districtCode]
    if (!districtName || !processed[code]) return
    if (!byDistrict.has(districtName)) byDistrict.set(districtName, [])
    byDistrict.get(districtName).push({
      code,
      name: processed[code].name,
      districtName,
      geometry: feature.geometry,
      bounds: getBounds(feature.geometry.coordinates),
    })
  })
  return byDistrict
}

function findDong(dongsByDistrict, district, lng, lat) {
  function findIn(dongs) {
    return dongs.find((dong) => {
      const [west, south, east, north] = dong.bounds
      return lng >= west && lng <= east && lat >= south && lat <= north
        && geometryContainsPoint(dong.geometry, lng, lat)
    })
  }

  // Prefer the address district, then trust the coordinate if an old address names the wrong district.
  const primary = findIn(dongsByDistrict.get(district) || [])
  if (primary) return primary
  for (const dongs of dongsByDistrict.values()) {
    const matched = findIn(dongs)
    if (matched) return matched
  }
  return null
}

function getSourceMeta(sources) {
  return sources.map(({ category, inputPath }) => {
    const stat = fs.statSync(inputPath)
    return {
      category,
      file: path.basename(inputPath),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    }
  })
}

function isOutputCurrent(sources, outputPath, year) {
  if (!fs.existsSync(outputPath)) return false
  try {
    const meta = JSON.parse(fs.readFileSync(outputPath, 'utf8')).meta
    return meta?.schemaVersion === SCHEMA_VERSION
      && meta?.year === Number(year)
      && JSON.stringify(meta?.sources) === JSON.stringify(getSourceMeta(sources))
  } catch {
    return false
  }
}

async function processClosures(sources, year) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const dongsByDistrict = loadDongBoundaries()

  const quarters = Object.fromEntries(
    [1, 2, 3, 4].map((quarter) => [`${year}${quarter}`, { points: [] }]),
  )
  const seen = new Set()
  const stats = {
    totalRows: 0,
    closedInYear: 0,
    validCoordinates: 0,
    skippedCoordinates: 0,
    unmatchedDong: 0,
    byCategory: {},
  }

  // Process large source files sequentially so memory use stays stable as categories are added.
  for (const { category, inputPath } of sources) {
    const categoryStats = { totalRows: 0, validCoordinates: 0 }
    stats.byCategory[category] = categoryStats
    const parser = Papa.parse(Papa.NODE_STREAM_INPUT, { header: true, skipEmptyLines: true })
    const source = fs.createReadStream(inputPath)
    const decoder = iconv.decodeStream('euc-kr')

    parser.on('data', (row) => {
      stats.totalRows += 1
      categoryStats.totalRows += 1
      if (stats.totalRows % 100000 === 0) console.log(`Processed ${stats.totalRows.toLocaleString()} rows`)

      const closedDate = clean(row['폐업일자']).slice(0, 10)
      const quarterCode = getQuarterCode(closedDate, year)
      const isClosed = clean(row['영업상태명']).includes('폐업')
        || clean(row['상세영업상태명']).includes('폐업')
      if (!quarterCode || !isClosed) return
      stats.closedInYear += 1

      const id = clean(row['관리번호'])
      const uniqueId = `${category}:${id}`
      if (!id || seen.has(uniqueId)) return
      seen.add(uniqueId)

      const x = Number(clean(row['좌표정보(X)']))
      const y = Number(clean(row['좌표정보(Y)']))
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        stats.skippedCoordinates += 1
        return
      }

      const [lng, lat] = proj4(SOURCE_CRS, TARGET_CRS, [x, y])
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || !isSeoulCoordinate(lng, lat)) {
        stats.skippedCoordinates += 1
        return
      }

      const areaText = clean(row['소재지면적'])
      const area = areaText ? Number(areaText) : null
      const address = clean(row['도로명주소']) || clean(row['지번주소']) || '주소 정보 없음'
      const addressDistrict = getDistrict(address)
      const dong = findDong(dongsByDistrict, addressDistrict, lng, lat)
      const district = dong?.districtName || addressDistrict
      if (!dong) stats.unmatchedDong += 1
      quarters[quarterCode].points.push({
        id: uniqueId,
        category,
        name: clean(row['사업장명']) || '상호 정보 없음',
        type: clean(row['업태구분명']) || clean(row['위생업태명']) || '기타',
        closedDate,
        licensedDate: clean(row['인허가일자']).slice(0, 10),
        address,
        district,
        dongCode: dong?.code || null,
        dongName: dong?.name || '행정동 미상',
        area: Number.isFinite(area) ? Math.round(area * 10) / 10 : null,
        lat: Math.round(lat * 1000000) / 1000000,
        lng: Math.round(lng * 1000000) / 1000000,
      })
      stats.validCoordinates += 1
      categoryStats.validCoordinates += 1
    })

    await new Promise((resolve, reject) => {
      parser.on('finish', resolve)
      parser.on('error', reject)
      source.on('error', reject)
      decoder.on('error', reject)
      source.pipe(decoder).pipe(parser)
    })
  }

  Object.values(quarters).forEach((quarter) => {
    quarter.points.sort((a, b) => b.closedDate.localeCompare(a.closedDate) || a.name.localeCompare(b.name, 'ko'))
    quarter.total = quarter.points.length
  })

  const output = {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      sources: getSourceMeta(sources),
      year: Number(year),
      coordinateSystem: 'EPSG:5181 to WGS84',
      generatedAt: new Date().toISOString(),
      ...stats,
    },
    quarters,
  }
  const outputPath = path.join(DATA_DIR, `closed_restaurants_${year}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(output), 'utf8')
  console.log(`Wrote ${stats.validCoordinates.toLocaleString()} closure points: ${outputPath}`)
}

const customInputPath = process.argv[2] ? path.resolve(process.argv[2]) : null
const year = process.argv[3] || '2025'
const outputPath = path.join(DATA_DIR, `closed_restaurants_${year}.json`)
const sources = customInputPath
  ? [{ category: process.argv[4] || '일반음식점', inputPath: customInputPath }]
  : DEFAULT_SOURCES.filter(({ inputPath }) => fs.existsSync(inputPath))

if (!sources.length) {
  if (fs.existsSync(outputPath)) {
    console.warn(`원본 CSV가 없어 기존 폐업 위치 데이터를 사용합니다: ${outputPath}`)
  } else {
    console.error('전처리할 인허가 CSV 파일을 찾을 수 없습니다.')
    console.error('src/data 폴더의 일반음식점, 휴게음식점 또는 미용업 인허가 파일을 확인해주세요.')
    process.exitCode = 1
  }
} else if (isOutputCurrent(sources, outputPath, year)) {
  console.log('CSV 변경 없음: 폐업 위치 전처리를 건너뜁니다.')
} else {
  processClosures(sources, year).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
