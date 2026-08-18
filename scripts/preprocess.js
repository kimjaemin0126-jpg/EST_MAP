const shapefile = require('shapefile')
const fs = require('fs')
const path = require('path')
const iconv = require('iconv-lite')
const Papa = require('papaparse')
const proj4 = require('proj4')

const DATA_DIR = path.join(__dirname, '../src/data')
const GENERATED_DATA_DIR = path.join(DATA_DIR, 'generated')
const PUBLIC_DATA_DIR = path.join(__dirname, '../public/data')
fs.mkdirSync(GENERATED_DATA_DIR, { recursive: true })
fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true })

function findDataFile(extension, marker = '') {
  const file = fs.readdirSync(DATA_DIR).find((name) => (
    name.toLowerCase().endsWith(extension) && (!marker || name.includes(marker))
  ))
  if (!file) throw new Error(`${marker || extension} 데이터 파일을 찾을 수 없습니다.`)
  return path.join(DATA_DIR, file)
}

function normalizeKey(value) {
  return String(value ?? '').trim()
}

function readCsv(marker) {
  const csvPath = findDataFile('.csv', marker)
  const text = iconv.decode(fs.readFileSync(csvPath), 'euc-kr')
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (parsed.errors.length) throw new Error(`${marker}: ${parsed.errors[0].message}`)
  return parsed
}

function nullableNumber(value) {
  if (value == null || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clearProductionQuarterFiles() {
  const productionPattern = /^(processed_by_dong|market_context)(?:\.\d{5})?\.min\.json$/
  fs.readdirSync(PUBLIC_DATA_DIR)
    .filter((name) => productionPattern.test(name))
    .forEach((name) => fs.unlinkSync(path.join(PUBLIC_DATA_DIR, name)))
}

async function shpToGeojson(byDong) {
  const shpPath = findDataFile('.shp')
  const dbfPath = findDataFile('.dbf')
  const outPath = path.join(GENERATED_DATA_DIR, 'seoul_dong.geojson')
  const productionPath = path.join(PUBLIC_DATA_DIR, 'seoul_dong.min.geojson')
  const source = await shapefile.open(shpPath, dbfPath, { encoding: 'euc-kr' })
  const features = []
  const fromDef = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs'
  const toDef = '+proj=longlat +datum=WGS84 +no_defs'

  function transformCoords(coords) {
    if (typeof coords[0] === 'number') return proj4(fromDef, toDef, coords)
    return coords.map(transformCoords)
  }

  let result = await source.read()
  while (!result.done) {
    const properties = result.value.properties || {}
    const dongCode = String(properties.ADSTRD_CD || '')
    features.push({
      type: 'Feature',
      geometry: { ...result.value.geometry, coordinates: transformCoords(result.value.geometry.coordinates) },
      properties: {
        ...properties,
        ADSTRD_NM: byDong[dongCode]?.name || properties.ADSTRD_NM,
      },
    })
    result = await source.read()
  }

  const geojson = { type: 'FeatureCollection', features }
  const roundCoordinates = (coordinates) => (
    typeof coordinates[0] === 'number'
      ? coordinates.map((coordinate) => Number(coordinate.toFixed(6)))
      : coordinates.map(roundCoordinates)
  )
  const productionGeojson = {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      properties: {
        ADSTRD_CD: feature.properties.ADSTRD_CD,
        ADSTRD_NM: feature.properties.ADSTRD_NM,
      },
      geometry: {
        type: feature.geometry.type,
        coordinates: roundCoordinates(feature.geometry.coordinates),
      },
    })),
  }

  fs.writeFileSync(outPath, JSON.stringify(geojson), 'utf8')
  fs.writeFileSync(productionPath, JSON.stringify(productionGeojson), 'utf8')
  console.log('Wrote full and production GeoJSON:', outPath, productionPath)
}

function createCompactProcessedData(byDong, targetQuarter) {
  const industryNames = Array.from(new Set(
    Object.values(byDong).flatMap((dong) => (
      Object.keys(dong.industries[targetQuarter] || {})
    )),
  )).sort((left, right) => left.localeCompare(right, 'ko'))
  const industryIndexes = new Map(industryNames.map((name, index) => [name, index]))
  const dongs = {}

  Object.entries(byDong).forEach(([dongCode, dong]) => {
    const quarterStats = dong.quarters[targetQuarter]
    if (!quarterStats) return
    dongs[dongCode] = {
      n: dong.name,
      q: {
        [targetQuarter]: [
          quarterStats['점포_수'],
          quarterStats['폐업_점포_수'],
          quarterStats['개업_점포_수'],
        ],
      },
      i: {
        [targetQuarter]: Object.entries(dong.industries[targetQuarter] || {}).map(([name, stats]) => [
          industryIndexes.get(name),
          stats.code,
          stats['점포_수'],
          stats['폐업_점포_수'],
          stats['개업_점포_수'],
        ]),
      },
    }
  })

  return { v: 1, q: targetQuarter, k: industryNames, d: dongs }
}

function parseCsvToJson() {
  const outRows = path.join(DATA_DIR, 'rows_parsed.json')
  const outByDong = path.join(GENERATED_DATA_DIR, 'processed_by_dong.json')
  const parsed = readCsv('점포-행정동')

  const rows = parsed.data
  fs.writeFileSync(outRows, JSON.stringify(rows, null, 2), 'utf8')
  const byDong = {}

  rows.forEach((row) => {
    const quarter = normalizeKey(row['기준_년분기_코드'])
    const dongCode = normalizeKey(row['행정동_코드'])
    const dongName = row['행정동_코드_명']
    const stores = Number(row['점포_수']) || 0
    const closed = Number(row['폐업_점포_수']) || 0
    const opened = Number(row['개업_점포_수']) || 0
    const industry = row['서비스_업종_코드_명']
    const industryCode = normalizeKey(row['서비스_업종_코드'])
    if (!dongCode || !quarter || !industry) return

    if (!byDong[dongCode]) byDong[dongCode] = { name: dongName, quarters: {}, industries: {} }
    if (!byDong[dongCode].quarters[quarter]) {
      byDong[dongCode].quarters[quarter] = { '점포_수': 0, '폐업_점포_수': 0, '개업_점포_수': 0 }
    }
    const quarterStats = byDong[dongCode].quarters[quarter]
    quarterStats['점포_수'] += stores
    quarterStats['폐업_점포_수'] += closed
    quarterStats['개업_점포_수'] += opened

    if (!byDong[dongCode].industries[quarter]) byDong[dongCode].industries[quarter] = {}
    if (!byDong[dongCode].industries[quarter][industry]) {
      byDong[dongCode].industries[quarter][industry] = {
        code: industryCode,
        '점포_수': 0,
        '폐업_점포_수': 0,
        '개업_점포_수': 0,
      }
    }
    const industryStats = byDong[dongCode].industries[quarter][industry]
    industryStats.code = industryCode
    industryStats['점포_수'] += stores
    industryStats['폐업_점포_수'] += closed
    industryStats['개업_점포_수'] += opened
  })

  Object.values(byDong).forEach((item) => {
    Object.values(item.quarters).forEach((stats) => {
      stats['폐업_률'] = stats['점포_수'] ? (stats['폐업_점포_수'] / stats['점포_수']) * 100 : 0
      stats['개업_률'] = stats['점포_수'] ? (stats['개업_점포_수'] / stats['점포_수']) * 100 : 0
    })
  })

  fs.writeFileSync(outByDong, JSON.stringify(byDong), 'utf8')
  const quarters = Array.from(new Set(rows.map((row) => normalizeKey(row['기준_년분기_코드'])))).filter(Boolean).sort()
  quarters.forEach((quarter) => {
    const productionPath = path.join(PUBLIC_DATA_DIR, `processed_by_dong.${quarter}.min.json`)
    fs.writeFileSync(productionPath, JSON.stringify(createCompactProcessedData(byDong, quarter)), 'utf8')
    console.log('Wrote production store JSON:', productionPath)
  })
  console.log('Wrote full store JSON:', outByDong)
  return byDong
}

function createCompactMarketContext(context, quarter) {
  return {
    v: 1,
    q: quarter,
    s: {
      [quarter]: Object.fromEntries(Object.entries(context.sales[quarter] || {}).map(([dongCode, industries]) => [
        dongCode,
        Object.fromEntries(Object.entries(industries).map(([industryCode, stats]) => [
          industryCode,
          [stats.amount, stats.count],
        ])),
      ])),
    },
    f: {
      [quarter]: Object.fromEntries(Object.entries(context.floatingPopulation[quarter] || {}).map(
        ([dongCode, stats]) => [dongCode, stats.total],
      )),
    },
    r: {
      [quarter]: Object.fromEntries(Object.entries(context.residentPopulation[quarter] || {}).map(
        ([dongCode, stats]) => [dongCode, stats.total],
      )),
    },
  }
}

function parseMarketContext(targetQuarters) {
  const salesParsed = readCsv('추정매출-행정동')
  const floatingParsed = readCsv('길단위인구-행정동')
  const residentParsed = readCsv('상주인구-행정동')
  const context = {
    metadata: {
      salesFields: salesParsed.meta.fields,
      floatingPopulationFields: floatingParsed.meta.fields,
      residentPopulationFields: residentParsed.meta.fields,
    },
    sales: {},
    floatingPopulation: {},
    residentPopulation: {},
  }

  salesParsed.data.forEach((row) => {
    const quarter = normalizeKey(row['기준_년분기_코드'])
    const dongCode = normalizeKey(row['행정동_코드'])
    const industryCode = normalizeKey(row['서비스_업종_코드'])
    if (!quarter || !dongCode || !industryCode) return
    if (!context.sales[quarter]) context.sales[quarter] = {}
    if (!context.sales[quarter][dongCode]) context.sales[quarter][dongCode] = {}
    const current = context.sales[quarter][dongCode][industryCode]
    const amount = nullableNumber(row['당월_매출_금액'])
    const count = nullableNumber(row['당월_매출_건수'])
    context.sales[quarter][dongCode][industryCode] = {
      industryName: row['서비스_업종_코드_명'],
      amount: current && current.amount != null && amount != null ? current.amount + amount : amount,
      count: current && current.count != null && count != null ? current.count + count : count,
    }
  })

  floatingParsed.data.forEach((row) => {
    const quarter = normalizeKey(row['기준_년분기_코드'])
    const dongCode = normalizeKey(row['행정동_코드'])
    if (!quarter || !dongCode) return
    if (!context.floatingPopulation[quarter]) context.floatingPopulation[quarter] = {}
    context.floatingPopulation[quarter][dongCode] = {
      total: nullableNumber(row['총_유동인구_수']),
      details: Object.fromEntries(
        Object.entries(row).slice(4).map(([key, value]) => [key, nullableNumber(value)]),
      ),
    }
  })

  residentParsed.data.forEach((row) => {
    const quarter = normalizeKey(row['기준_년분기_코드'])
    const dongCode = normalizeKey(row['행정동_코드'])
    if (!quarter || !dongCode) return
    if (!context.residentPopulation[quarter]) context.residentPopulation[quarter] = {}
    context.residentPopulation[quarter][dongCode] = {
      total: nullableNumber(row['총_상주인구_수']),
      households: nullableNumber(row['총_가구_수']),
      details: Object.fromEntries(
        Object.entries(row).slice(4).map(([key, value]) => [key, nullableNumber(value)]),
      ),
    }
  })

  const outPath = path.join(GENERATED_DATA_DIR, 'market_context.json')
  fs.writeFileSync(outPath, JSON.stringify(context), 'utf8')
  targetQuarters.forEach((quarter) => {
    const productionPath = path.join(PUBLIC_DATA_DIR, `market_context.${quarter}.min.json`)
    fs.writeFileSync(productionPath, JSON.stringify(createCompactMarketContext(context, quarter)), 'utf8')
    console.log('Wrote production market context:', productionPath)
  })
  console.log('Wrote full market context:', outPath)
  return context
}

async function main() {
  clearProductionQuarterFiles()
  const byDong = parseCsvToJson()
  const quarters = Array.from(new Set(
    Object.values(byDong).flatMap((dong) => Object.keys(dong.quarters)),
  )).sort()
  parseMarketContext(quarters)
  await shpToGeojson(byDong)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
