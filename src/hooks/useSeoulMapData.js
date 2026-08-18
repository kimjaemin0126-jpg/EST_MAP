import { useEffect, useState } from 'react'

const PUBLIC_DATA_ROOT = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data`
const SEOUL_DONG_URL = `${PUBLIC_DATA_ROOT}/seoul_dong.min.geojson`

async function readJson(response, errorMessage) {
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || !contentType.includes('json')) throw new Error(errorMessage)
  return response.json()
}

// Keeps file-location and HTTP concerns out of the Leaflet layer components.
export default function useSeoulMapData(year) {
  const [geoData, setGeoData] = useState(null)
  const [districtBoundaries, setDistrictBoundaries] = useState(null)
  const [closureData, setClosureData] = useState(null)
  const [geoError, setGeoError] = useState('')
  const [closureError, setClosureError] = useState('')

  useEffect(() => {
    fetch(SEOUL_DONG_URL)
      .then((response) => readJson(response, '지도 경계 데이터를 불러오지 못했습니다.'))
      .then(setGeoData)
      .catch((error) => setGeoError(error.message))

    fetch(`${PUBLIC_DATA_ROOT}/seoul_district_boundaries.geojson`)
      .then((response) => readJson(response, '자치구 경계 데이터를 불러오지 못했습니다.'))
      .then(setDistrictBoundaries)
      .catch(() => setDistrictBoundaries(null))
  }, [])

  useEffect(() => {
    if (!year) return undefined
    const controller = new AbortController()

    setClosureData(null)
    setClosureError('')
    fetch(`${PUBLIC_DATA_ROOT}/closed_restaurants_${year}.json`, { signal: controller.signal })
      .then((response) => readJson(response, '폐업 위치 데이터를 불러오지 못했습니다.'))
      .then(setClosureData)
      .catch((error) => {
        if (error.name !== 'AbortError') setClosureError(error.message)
      })

    return () => controller.abort()
  }, [year])

  return { geoData, districtBoundaries, closureData, geoError, closureError }
}
