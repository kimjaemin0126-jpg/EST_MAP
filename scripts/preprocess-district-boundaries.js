const fs = require('fs')
const path = require('path')

const INPUT_PATH = path.join(__dirname, '../src/data/seoul_dong.geojson')
const OUTPUT_PATH = path.join(__dirname, '../public/data/seoul_district_boundaries.geojson')

const DISTRICT_NAMES = {
  11110: '종로구', 11140: '중구', 11170: '용산구', 11200: '성동구',
  11215: '광진구', 11230: '동대문구', 11260: '중랑구', 11290: '성북구',
  11305: '강북구', 11320: '도봉구', 11350: '노원구', 11380: '은평구',
  11410: '서대문구', 11440: '마포구', 11470: '양천구', 11500: '강서구',
  11530: '구로구', 11545: '금천구', 11560: '영등포구', 11590: '동작구',
  11620: '관악구', 11650: '서초구', 11680: '강남구', 11710: '송파구',
  11740: '강동구',
}

function pointKey(point) {
  return `${point[0].toFixed(7)},${point[1].toFixed(7)}`
}

function addRingSegments(segments, ring) {
  for (let index = 0; index < ring.length - 1; index += 1) {
    const start = ring[index]
    const end = ring[index + 1]
    const startKey = pointKey(start)
    const endKey = pointKey(end)
    const key = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`
    const existing = segments.get(key)
    if (existing) existing.count += 1
    else segments.set(key, { start, end, startKey, endKey, count: 1 })
  }
}

function addGeometrySegments(segments, geometry) {
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => addRingSegments(segments, ring))
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => addRingSegments(segments, ring))
    })
  }
}

function connectSegments(segments) {
  const unused = new Set(segments.map((segment) => segment.key))
  const byPoint = new Map()
  segments.forEach((segment) => {
    ;[segment.startKey, segment.endKey].forEach((key) => {
      if (!byPoint.has(key)) byPoint.set(key, [])
      byPoint.get(key).push(segment)
    })
  })

  const lines = []
  while (unused.size) {
    const firstKey = unused.values().next().value
    const first = segments.find((segment) => segment.key === firstKey)
    unused.delete(firstKey)
    const line = [first.start, first.end]
    let endKey = first.endKey

    while (true) {
      const next = (byPoint.get(endKey) || []).find((segment) => unused.has(segment.key))
      if (!next) break
      unused.delete(next.key)
      if (next.startKey === endKey) {
        line.push(next.end)
        endKey = next.endKey
      } else {
        line.push(next.start)
        endKey = next.startKey
      }
    }
    lines.push(line)
  }
  return lines
}

function main() {
  const geoData = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'))
  const byDistrict = new Map()

  geoData.features.forEach((feature) => {
    const districtCode = String(feature.properties?.ADSTRD_CD || '').slice(0, 5)
    if (!DISTRICT_NAMES[districtCode]) return
    if (!byDistrict.has(districtCode)) byDistrict.set(districtCode, new Map())
    addGeometrySegments(byDistrict.get(districtCode), feature.geometry)
  })

  const features = Array.from(byDistrict, ([districtCode, segmentMap]) => {
    // A segment seen once belongs to the district exterior; shared dong edges are seen twice.
    const outerSegments = Array.from(segmentMap, ([key, segment]) => ({ ...segment, key }))
      .filter((segment) => segment.count === 1)
    return {
      type: 'Feature',
      properties: {
        districtCode,
        districtName: DISTRICT_NAMES[districtCode],
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: connectSegments(outerSegments),
      },
    }
  })

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ type: 'FeatureCollection', features }), 'utf8')
  console.log(`Wrote ${features.length} district boundaries: ${OUTPUT_PATH}`)
}

main()
