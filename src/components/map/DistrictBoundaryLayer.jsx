import { useEffect, useMemo } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'

function DistrictBoundaryPane() {
  const map = useMap()

  useEffect(() => {
    // A dedicated pane keeps district outlines above fills and below marker clusters.
    const pane = map.getPane('district-boundary-pane') || map.createPane('district-boundary-pane')
    pane.style.zIndex = '460'
    pane.style.pointerEvents = 'none'
  }, [map])

  return null
}
export default function DistrictBoundaryLayer({ boundaries, activeDistrict }) {
  const activeBoundary = useMemo(() => {
    if (!activeDistrict || !boundaries) return null
    return {
      type: 'FeatureCollection',
      features: boundaries.features.filter(
        (feature) => feature.properties?.districtName === activeDistrict,
      ),
    }
  }, [activeDistrict, boundaries])

  if (!boundaries) return null

  const commonStyle = { lineCap: 'round', lineJoin: 'round' }
  return (
    <>
      <DistrictBoundaryPane />
      <GeoJSON
        data={boundaries}
        pane="district-boundary-pane"
        interactive={false}
        style={{ ...commonStyle, color: '#34423c', weight: 2.5, opacity: 0.72 }}
      />
      {activeBoundary && (
        <>
          <GeoJSON
            key={`${activeDistrict}-halo`}
            data={activeBoundary}
            pane="district-boundary-pane"
            interactive={false}
            style={{ ...commonStyle, color: '#ffffff', weight: 10, opacity: 0.92 }}
          />
          <GeoJSON
            key={activeDistrict}
            data={activeBoundary}
            pane="district-boundary-pane"
            interactive={false}
            style={{ ...commonStyle, color: '#5b1717', weight: 6, opacity: 1 }}
          />
        </>
      )}
    </>
  )
}

