import { useEffect, useMemo } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import { getDistrictName } from '../../utils/dataProcessor'

function DongBoundaryPane() {
  const map = useMap()

  useEffect(() => {
    const pane = map.getPane('dong-boundary-pane') || map.createPane('dong-boundary-pane')
    pane.style.zIndex = '450'
    pane.style.pointerEvents = 'none'
  }, [map])

  return null
}

export default function DongBoundaryLayer({ boundaries, selectedDistrict, analysisVisible }) {
  const visibleBoundaries = useMemo(() => {
    if (!boundaries || !selectedDistrict) return null
    return {
      type: 'FeatureCollection',
      features: boundaries.features.filter((feature) => (
        getDistrictName(feature.properties?.ADSTRD_CD) === selectedDistrict
      )),
    }
  }, [boundaries, selectedDistrict])

  if (!visibleBoundaries?.features.length) return null

  const style = analysisVisible
    ? { color: '#4b5d54', weight: 1, opacity: 0.5 }
    : { color: '#3d5047', weight: 1.4, opacity: 0.82 }

  return (
    <>
      <DongBoundaryPane />
      <GeoJSON
        key={`${selectedDistrict}-${analysisVisible ? 'with-analysis' : 'only'}`}
        data={visibleBoundaries}
        pane="dong-boundary-pane"
        interactive={false}
        style={{
          ...style,
          fill: false,
          fillOpacity: 0,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </>
  )
}
