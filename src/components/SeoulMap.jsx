import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import useSeoulMapData from '../hooks/useSeoulMapData'
import {
  ANALYSIS_MODES,
  MIN_STORE_COUNT,
  MODE_STYLES,
  computeAnalysisThresholds,
  formatAnalysisValue,
  getAnalysisDataset,
  getAnalysisLevel,
  getAnalysisValue,
  getDistrictName,
  getDongRanking,
  getDongStats,
  getMarketTypeData,
  getPreviousQuarter,
  quarterLabelToCode,
} from '../utils/dataProcessor'
import RankingPanel from './RankingPanel'
import ClosureLocationLayer from './map/ClosureLocationLayer'
import DistrictBoundaryLayer from './map/DistrictBoundaryLayer'
import DongBoundaryLayer from './map/DongBoundaryLayer'
import MapLayerControls from './map/MapLayerControls'
import MapLegend from './map/MapLegend'

const DEFAULT_POLYGON_STYLE = Object.freeze({
  color: 'rgba(255, 255, 255, 0.9)',
  weight: 1.2,
  opacity: 1,
  fillOpacity: 0.69,
})
const HOVER_POLYGON_STYLE = Object.freeze({
  color: '#3f6258',
  weight: 2,
  opacity: 1,
  fillOpacity: 0.75,
})
const SELECTED_POLYGON_STYLE = Object.freeze({
  color: '#244c40',
  weight: 3,
  opacity: 1,
  fillOpacity: 0.82,
})
const EMPTY_STYLE = {
  ...DEFAULT_POLYGON_STYLE,
  color: 'rgba(255, 255, 255, 0.84)',
  fillColor: '#e7ebe9',
  fillOpacity: 0.55,
}
const INITIAL_LAYERS = { analysis: true, closures: true }

function FitSeoulBounds({ geoData }) {
  const map = useMap()

  useEffect(() => {
    if (!geoData) return
    const bounds = L.geoJSON(geoData).getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [22, 22] })
  }, [geoData, map])

  return null
}

function MapZoomReporter({ onZoomChange }) {
  const map = useMap()

  useEffect(() => {
    const reportZoom = () => onZoomChange(map.getZoom())
    reportZoom()
    map.on('zoomend', reportZoom)
    return () => map.off('zoomend', reportZoom)
  }, [map, onZoomChange])

  return null
}

function MapLayoutInvalidator({ detailLayoutOpen }) {
  const map = useMap()

  useEffect(() => {
    const layout = map.getContainer().closest('.app-main')
    let completed = false
    const refreshMap = () => {
      if (completed) return
      completed = true
      map.invalidateSize({ animate: false, pan: false })
    }
    const handleTransitionEnd = (event) => {
      if (event.target === layout && event.propertyName === 'grid-template-columns') refreshMap()
    }
    layout?.addEventListener('transitionend', handleTransitionEnd)
    const fallback = window.setTimeout(refreshMap, 320)
    return () => {
      layout?.removeEventListener('transitionend', handleTransitionEnd)
      window.clearTimeout(fallback)
    }
  }, [detailLayoutOpen, map])

  return null
}

export default function SeoulMap({
  quarter,
  industry,
  analysisMode,
  processed,
  selectedDongCode,
  selectedDistrict,
  onSelectDong,
  onSelectClosureDong,
  onSelectDistrict,
  detailLayoutOpen,
}) {
  const [hoveredDongCode, setHoveredDongCode] = useState(null)
  const [visibleLayers, setVisibleLayers] = useState(INITIAL_LAYERS)
  const [hoveredDistrict, setHoveredDistrict] = useState(null)
  const [zoom, setZoom] = useState(11)
  const geoJsonRef = useRef(null)
  const mapRef = useRef(null)
  const styleRef = useRef(() => EMPTY_STYLE)
  const tooltipRef = useRef(() => '')
  const hoveredLayerRef = useRef(null)
  const quarterCode = quarterLabelToCode(quarter)
  const year = quarterCode?.slice(0, 4)
  const { geoData, districtBoundaries, closureData, geoError, closureError } = useSeoulMapData(year)

  const closurePoints = useMemo(
    () => closureData?.quarters?.[quarterCode]?.points || [],
    [closureData, quarterCode],
  )
  const visibleClosurePoints = useMemo(() => {
    if (!selectedDistrict) return closurePoints
    return closurePoints.filter((point) => point.district === selectedDistrict)
  }, [closurePoints, selectedDistrict])
  const dataset = useMemo(
    () => getAnalysisDataset(processed, quarterCode, industry, analysisMode),
    [processed, quarterCode, industry, analysisMode],
  )
  const values = useMemo(
    () => dataset.map((row) => row.value).filter(Number.isFinite),
    [dataset],
  )
  const thresholds = useMemo(
    () => computeAnalysisThresholds(values, analysisMode),
    [values, analysisMode],
  )
  const ranking = useMemo(
    () => getDongRanking(processed, quarterCode, industry, analysisMode),
    [processed, quarterCode, industry, analysisMode],
  )
  const marketTypeData = useMemo(
    () => getMarketTypeData(processed, quarterCode, industry),
    [processed, quarterCode, industry],
  )
  const marketTypeByCode = useMemo(
    () => new Map(marketTypeData.points.map((point) => [point.code, point])),
    [marketTypeData],
  )
  const previousQuarter = getPreviousQuarter(quarterCode)
  const previousDataAvailable = useMemo(
    () => Object.values(processed || {}).some((item) => getDongStats(item, previousQuarter, industry)),
    [processed, previousQuarter, industry],
  )
  const changeUnavailable = analysisMode === ANALYSIS_MODES.CLOSURE_CHANGE && !previousDataAvailable

  function getFeatureInfo(feature) {
    const code = String(feature.properties?.ADSTRD_CD || '')
    const item = processed?.[code]
    return {
      code,
      item,
      name: item?.name || '행정동 정보 없음',
      stats: getDongStats(item, quarterCode, industry),
      value: getAnalysisValue(item, quarterCode, industry, analysisMode),
      marketType: marketTypeByCode.get(code) || null,
    }
  }

  function styleFeature(feature, hoveredCode = hoveredDongCode) {
    const { code, value, marketType } = getFeatureInfo(feature)
    const hideDongBoundary = visibleLayers.closures
      && (!selectedDistrict || getDistrictName(code) !== selectedDistrict)
    const hiddenBoundaryStyle = hideDongBoundary
      ? { color: 'transparent', weight: 0, opacity: 0 }
      : null
    const level = analysisMode === ANALYSIS_MODES.MARKET_TYPE
      ? MODE_STYLES[ANALYSIS_MODES.MARKET_TYPE].levels.find((item) => item.key === marketType?.key)
      : getAnalysisLevel(value, thresholds, analysisMode)
    if (!level) return { ...EMPTY_STYLE, ...hiddenBoundaryStyle }
    const selected = String(code) === String(selectedDongCode)
    const hovered = String(code) === String(hoveredCode)
    return {
      ...(selected
        ? SELECTED_POLYGON_STYLE
        : hovered
          ? HOVER_POLYGON_STYLE
          : DEFAULT_POLYGON_STYLE),
      fillColor: level.color,
      ...hiddenBoundaryStyle,
    }
  }

  function buildTooltip(feature) {
    const { name, stats, value, marketType } = getFeatureInfo(feature)
    if (analysisMode === ANALYSIS_MODES.MARKET_TYPE) {
      if (!marketType) {
        const reason = stats && stats['점포_수'] < MIN_STORE_COUNT
          ? `표본 부족 · 점포 ${stats['점포_수']}개`
          : '데이터 없음'
        return `<strong>${name}</strong><span>${reason}</span>`
      }
      return `<strong>${name}</strong><span class="tooltip-value">${marketType.label}</span><span>개업률 ${marketType.openRate.toFixed(2)}% · 폐업률 ${marketType.closureRate.toFixed(2)}%</span>`
    }
    if (!Number.isFinite(value)) {
      const message = analysisMode === ANALYSIS_MODES.CLOSURE_CHANGE ? '비교 데이터 없음' : '데이터 없음'
      return `<strong>${name}</strong><span>${message}</span>`
    }
    if (analysisMode === ANALYSIS_MODES.CLOSURE_RATE) {
      return `<strong>${name}</strong><span><b class="tooltip-value">${formatAnalysisValue(value, analysisMode)}</b> 폐업률</span><span>폐업 점포 ${Number(stats['폐업_점포_수']).toLocaleString('ko-KR')}개</span>`
    }
    if (analysisMode === ANALYSIS_MODES.CLOSURE_CHANGE) {
      return `<strong>${name}</strong><span><b class="tooltip-value">${formatAnalysisValue(value, analysisMode)}</b> 폐업률 변화</span><span>전분기 폐업률과의 차이</span>`
    }
    return `<strong>${name}</strong><span><b class="tooltip-value">${formatAnalysisValue(value, analysisMode)}</b> 개폐업 순증감</span><span>개업 ${stats['개업_점포_수'].toLocaleString('ko-KR')}개 · 폐업 ${stats['폐업_점포_수'].toLocaleString('ko-KR')}개</span>`
  }

  styleRef.current = styleFeature
  tooltipRef.current = buildTooltip

  useEffect(() => {
    const layerGroup = geoJsonRef.current
    if (!layerGroup) return
    let selectedLayer = null
    layerGroup.eachLayer((layer) => {
      layer.setStyle(styleRef.current(layer.feature))
      layer.setTooltipContent(tooltipRef.current(layer.feature))
      if (String(layer.feature?.properties?.ADSTRD_CD) === String(selectedDongCode)) selectedLayer = layer
    })
    selectedLayer?.bringToFront()
  }, [analysisMode, industry, quarterCode, selectedDistrict, selectedDongCode, thresholds, visibleLayers.closures])

  function onEachFeature(feature, layer) {
    const code = String(feature.properties?.ADSTRD_CD || '')
    layer.bindTooltip(tooltipRef.current(feature), {
      className: 'dong-tooltip',
      sticky: true,
      direction: 'top',
    })
    layer.on({
      mouseover: () => {
        const previousHoveredLayer = hoveredLayerRef.current
        if (previousHoveredLayer && previousHoveredLayer !== layer) {
          previousHoveredLayer.closeTooltip()
          previousHoveredLayer.setStyle(styleRef.current(previousHoveredLayer.feature, null))
        }
        hoveredLayerRef.current = layer
        setHoveredDongCode(code)
        layer.setStyle(styleRef.current(feature, code))
      },
      mouseout: () => {
        layer.closeTooltip()
        if (hoveredLayerRef.current === layer) {
          hoveredLayerRef.current = null
          setHoveredDongCode(null)
        }
        layer.setStyle(styleRef.current(feature, null))
      },
      click: () => {
        layer.closeTooltip()
        handleRegionSelect(code)
      },
    })
  }

  function handleRegionSelect(code, focusOnRegion = false) {
    onSelectDong(code)
    if (!focusOnRegion) return
    const feature = geoData?.features.find(
      (item) => String(item.properties?.ADSTRD_CD) === String(code),
    )
    if (!feature || !mapRef.current) return
    const bounds = L.geoJSON(feature).getBounds()
    if (bounds.isValid()) {
      mapRef.current.flyToBounds(bounds, { padding: [90, 90], maxZoom: 14, duration: 0.65 })
    }
  }

  const handleZoomChange = useCallback((nextZoom) => {
    setZoom(nextZoom)
    if (nextZoom < 13) onSelectDistrict(null)
  }, [onSelectDistrict])

  function toggleLayer(layerName) {
    setVisibleLayers((current) => ({ ...current, [layerName]: !current[layerName] }))
    if (layerName === 'closures') setHoveredDistrict(null)
  }

  if (geoError) return <section className="map-wrap map-message">{geoError}</section>

  const activeDistrict = hoveredDistrict || selectedDistrict
  const showBoundaries = visibleLayers.analysis || visibleLayers.closures

  return (
    <section className="map-wrap" aria-label="서울 행정동 상권 분석 및 폐업 위치 지도">
      <MapContainer ref={mapRef} center={[37.5665, 126.978]} zoom={11} className="seoul-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {visibleLayers.analysis && geoData && processed && (
          <GeoJSON
            ref={geoJsonRef}
            data={geoData}
            style={(feature) => styleRef.current(feature)}
            onEachFeature={onEachFeature}
          />
        )}
        {visibleLayers.closures && selectedDistrict && geoData && (
          <DongBoundaryLayer
            boundaries={geoData}
            selectedDistrict={selectedDistrict}
            analysisVisible={visibleLayers.analysis}
          />
        )}
        {showBoundaries && (
          <DistrictBoundaryLayer
            boundaries={districtBoundaries}
            activeDistrict={activeDistrict}
          />
        )}
        {visibleLayers.closures && visibleClosurePoints.length > 0 && (
          <ClosureLocationLayer
            points={visibleClosurePoints}
            selectedDistrict={selectedDistrict}
            onHoverDistrict={setHoveredDistrict}
            onSelectDong={onSelectClosureDong}
            onSelectDistrict={onSelectDistrict}
          />
        )}
        <FitSeoulBounds geoData={geoData} />
        <MapZoomReporter onZoomChange={handleZoomChange} />
        <MapLayoutInvalidator detailLayoutOpen={detailLayoutOpen} />
      </MapContainer>

      {!geoData && <div className="map-loading">지도를 불러오는 중입니다</div>}
      <MapLayerControls visibleLayers={visibleLayers} onToggle={toggleLayer} />

      {visibleLayers.closures && (
        <div className={`closure-status${closureError ? ' is-error' : ''}`} aria-live="polite">
          <strong>{selectedDistrict ? `${selectedDistrict} 인허가 업소 폐업 위치` : '인허가 업소 폐업 위치'}</strong>
          {closureError ? (
            <span>{closureError}</span>
          ) : !closureData ? (
            <span>위치 데이터 준비 중</span>
          ) : (
            <span>
              {visibleClosurePoints.length.toLocaleString('ko-KR')}곳 · {!selectedDistrict
                ? '자치구별 묶음'
                : zoom < 15 ? '행정동별 묶음' : zoom < 16 ? '행정동 내 클러스터' : '개별 위치'}
            </span>
          )}
        </div>
      )}

      {visibleLayers.analysis && (
        <>
          <RankingPanel
            mode={analysisMode}
            ranking={ranking}
            distribution={marketTypeData.distribution}
            selectedDongCode={selectedDongCode}
            onSelectDong={(code) => handleRegionSelect(code, true)}
            unavailable={changeUnavailable}
          />
          <MapLegend mode={analysisMode} thresholds={thresholds} />
        </>
      )}
    </section>
  )
}
