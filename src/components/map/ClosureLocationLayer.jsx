import { useEffect, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useMap } from 'react-leaflet'
import {
  getClosureCategory,
  getClosureCategoryColor,
} from '../../utils/closureCategoryColors'

const DISTRICT_BREAKOUT_ZOOM = 13

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatClusterCount(count) {
  if (count < 1000) return count.toLocaleString('ko-KR')
  const compact = count >= 10000 ? Math.round(count / 1000) : Math.round(count / 100) / 10
  return `${compact}천`
}

function clusterSize(count) {
  if (count < 10) return 36
  if (count < 100) return 42
  if (count < 1000) return 48
  return 54
}

function popupContent(point) {
  const area = point.area == null ? '' : `<span>영업장 ${Number(point.area).toLocaleString('ko-KR')}㎡</span>`
  return `
    <div class="closure-popup">
      <strong>${escapeHtml(point.name)}</strong>
      <span class="closure-popup-type">${escapeHtml(getClosureCategory(point))} · ${escapeHtml(point.type)}</span>
      <dl>
        <div><dt>폐업일</dt><dd>${escapeHtml(point.closedDate)}</dd></div>
        <div><dt>주소</dt><dd>${escapeHtml(point.address)}</dd></div>
      </dl>
      ${area}
    </div>
  `
}

function getDistrict(point) {
  return point.district
    || point.address?.match(/서울(?:특별시)?\s+([가-힣]+구)(?:\s|$)/)?.[1]
    || '지역 미상'
}

function groupByDistrict(points) {
  const groups = new Map()
  points.forEach((point) => {
    const district = getDistrict(point)
    if (!groups.has(district)) groups.set(district, [])
    groups.get(district).push(point)
  })
  return groups
}

function groupByDong(points) {
  const groups = new Map()
  points.forEach((point) => {
    const key = point.dongCode || `unknown-${point.district}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(point)
  })
  return groups
}

function getGroupLayouts(map, groups, minDistance = 56, maxOffset = 90) {
  const nodes = Array.from(groups, ([key, groupPoints]) => {
    const center = groupPoints.reduce(
      (sum, point) => [sum[0] + point.lat, sum[1] + point.lng],
      [0, 0],
    ).map((value) => value / groupPoints.length)
    return { key, center, origin: map.latLngToLayerPoint(center) }
  })

  nodes.forEach((node) => {
    node.neighborCount = nodes.filter((other) => (
      other !== node && node.origin.distanceTo(other.origin) < minDistance * 1.6
    )).length
  })
  nodes.sort((a, b) => b.neighborCount - a.neighborCount || a.key.localeCompare(b.key, 'ko'))

  const placed = []
  const layouts = new Map()
  nodes.forEach((node) => {
    const candidates = [node.origin]
    for (let radius = 10; radius <= maxOffset; radius += 10) {
      for (let angle = 0; angle < 360; angle += 22.5) {
        const radians = (angle * Math.PI) / 180
        candidates.push(L.point(
          node.origin.x + Math.cos(radians) * radius,
          node.origin.y + Math.sin(radians) * radius,
        ))
      }
    }
    const position = candidates.find((candidate) => (
      placed.every((other) => candidate.distanceTo(other) >= minDistance)
    )) || node.origin
    placed.push(position)
    layouts.set(node.key, {
      center: node.center,
      markerPosition: map.layerPointToLatLng(position),
    })
  })
  return layouts
}

function createPointMarker(point, onSelectDong) {
  const pointIcon = L.divIcon({
    className: 'closure-point-marker',
    html: `<span style="--closure-fill:${getClosureCategoryColor(point)}" aria-hidden="true"></span>`,
    iconSize: L.point(18, 18),
    iconAnchor: L.point(9, 9),
    popupAnchor: L.point(0, -8),
  })
  const marker = L.marker([point.lat, point.lng], {
    icon: pointIcon,
    title: `${point.name} · ${getClosureCategory(point)}`,
    keyboard: true,
  })
  marker.bindPopup(popupContent(point), { className: 'closure-leaflet-popup', maxWidth: 310 })
  marker.bindTooltip(`${point.name} · ${getClosureCategory(point)}`, { direction: 'top', offset: [0, -8] })
  marker.on('click', () => {
    if (point.dongCode) onSelectDong(point.dongCode)
  })
  return marker
}

// Self-contained closure overlay: grouped summaries at distance, colored source points up close.
export default function ClosureLocationLayer({
  points,
  selectedDistrict,
  onHoverDistrict,
  onSelectDong,
  onSelectDistrict,
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  const districtMode = !selectedDistrict || zoom < DISTRICT_BREAKOUT_ZOOM
  const dongMode = Boolean(selectedDistrict) && zoom < 15

  useEffect(() => {
    const reportZoom = () => setZoom(map.getZoom())
    map.on('zoomend', reportZoom)
    return () => map.off('zoomend', reportZoom)
  }, [map])

  useEffect(() => {
    if (!points.length) return undefined

    const districtGroups = groupByDistrict(points)

    // Zoom hierarchy: district totals -> administrative-dong totals -> marker clusters/exact points.
    if (districtMode) {
      const districtLayer = L.layerGroup()
      const districtLayouts = getGroupLayouts(map, districtGroups)
      districtGroups.forEach((districtPoints, district) => {
        const { center, markerPosition } = districtLayouts.get(district)
        const count = districtPoints.length
        const icon = L.divIcon({
          className: 'district-closure-marker',
          html: `<span aria-label="${escapeHtml(district)} 폐업 업소 ${count.toLocaleString('ko-KR')}곳"><strong>${escapeHtml(district)}</strong><small>${formatClusterCount(count)}곳</small></span>`,
          iconSize: L.point(54, 54),
          iconAnchor: L.point(27, 27),
        })
        const marker = L.marker(markerPosition, {
          icon,
          title: `${district} 인허가 업소 폐업 ${count.toLocaleString('ko-KR')}곳`,
          keyboard: true,
        })
        marker.bindTooltip(`${district} · 폐업 ${count.toLocaleString('ko-KR')}곳`, { direction: 'top' })
        marker.on({
          mouseover: () => onHoverDistrict(district),
          mouseout: () => onHoverDistrict(null),
          click: () => {
            onHoverDistrict(null)
            onSelectDistrict(district)
            map.flyTo(center, Math.max(map.getZoom(), DISTRICT_BREAKOUT_ZOOM), { duration: 0.45 })
          },
        })
        districtLayer.addLayer(marker)
      })
      map.addLayer(districtLayer)
      return () => {
        districtLayer.clearLayers()
        map.removeLayer(districtLayer)
      }
    }

    const dongGroups = groupByDong(points)
    if (dongMode) {
      const dongLayer = L.layerGroup()
      const dongLayouts = getGroupLayouts(map, dongGroups, 64, 100)
      dongGroups.forEach((dongPoints, dongCode) => {
        const { center, markerPosition } = dongLayouts.get(dongCode)
        const dongName = dongPoints[0].dongName || '행정동 미상'
        const count = dongPoints.length
        const icon = L.divIcon({
          className: 'dong-closure-marker',
          html: `<span aria-label="${escapeHtml(dongName)} 폐업 업소 ${count.toLocaleString('ko-KR')}곳"><strong>${escapeHtml(dongName)}</strong><small>${formatClusterCount(count)}곳</small></span>`,
          iconSize: L.point(62, 62),
          iconAnchor: L.point(31, 31),
        })
        const marker = L.marker(markerPosition, {
          icon,
          title: `${dongName} 인허가 업소 폐업 ${count.toLocaleString('ko-KR')}곳`,
          keyboard: true,
        })
        marker.bindTooltip(`${dongName} · 폐업 ${count.toLocaleString('ko-KR')}곳`, { direction: 'top' })
        marker.on('click', () => {
          if (dongPoints[0].dongCode) onSelectDong(dongPoints[0].dongCode)
          map.flyTo(center, 15, { duration: 0.45 })
        })
        dongLayer.addLayer(marker)
      })
      map.addLayer(dongLayer)
      return () => {
        dongLayer.clearLayers()
        map.removeLayer(dongLayer)
      }
    }

    const clusterGroups = []
    dongGroups.forEach((dongPoints) => {
      const dongName = dongPoints[0].dongName || '행정동 미상'
      const clusterGroup = L.markerClusterGroup({
        // Each administrative dong owns a group, so a visual cluster never mixes two dongs.
        maxClusterRadius: 52,
        disableClusteringAtZoom: 16,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        spiderfyDistanceMultiplier: 1.35,
        removeOutsideVisibleBounds: true,
        iconCreateFunction(cluster) {
          const count = cluster.getChildCount()
          const size = clusterSize(count)
          return L.divIcon({
            className: 'closure-cluster-marker',
            html: `<span aria-label="${escapeHtml(dongName)} 폐업 업소 ${count.toLocaleString('ko-KR')}">${formatClusterCount(count)}</span>`,
            iconSize: L.point(size, size),
          })
        },
      })
      clusterGroup.on('clusterclick', () => {
        if (dongPoints[0].dongCode) onSelectDong(dongPoints[0].dongCode)
      })
      dongPoints.forEach((point) => clusterGroup.addLayer(createPointMarker(point, onSelectDong)))
      clusterGroups.push(clusterGroup)
      map.addLayer(clusterGroup)
    })

    return () => {
      clusterGroups.forEach((clusterGroup) => {
        clusterGroup.clearLayers()
        map.removeLayer(clusterGroup)
      })
    }
  }, [districtMode, dongMode, map, onHoverDistrict, onSelectDistrict, onSelectDong, points, selectedDistrict, zoom])

  return null
}
