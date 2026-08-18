import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, Marker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { DATA_PATHS } from '../config/dataPaths'
import { fetchJsonCached } from '../services/staticDataService'
import {
  ANALYSIS_MODES,
  CLOSURE_LEVELS,
  computeAnalysisThresholds,
  getAnalysisLevel,
} from '../utils/dataProcessor'
import '../styles/landing.css'

const DEFAULT_DONG_CODE = '11200690'
const QUARTER_OPTIONS = ['20251', '20252', '20253', '20254']

function quarterLabel(quarter) {
  return `${quarter.slice(0, 4)}년 ${quarter.slice(-1)}분기`
}

function sampleRegions(regions, count) {
  const shuffled = [...regions]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, count)
}

function BrandLockup() {
  return (
    <a className="landing-brand" href="/" aria-label="POST MORTEM 시작 화면">
      <span className="brand-logo-window" aria-hidden="true">
        <img src="/assets/post-mortem-logo.png" alt="" />
      </span>
      <span>서울 상권 변화 지도</span>
    </a>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  )
}

function FitLandingBounds({ geoData }) {
  const map = useMap()

  useEffect(() => {
    if (!geoData) return
    const bounds = L.geoJSON(geoData).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [5, 5] })
      map.setZoom(map.getZoom() + 0.5)
    }
  }, [geoData, map])

  return null
}

function FlipRegionName({ name = '동네' }) {
  return (
    <span className="flip-region-window" aria-live="polite" aria-label={name}>
      <span className="flip-region-hinge" aria-hidden="true"><i /><i /></span>
      <span className="flip-region-fold" aria-hidden="true" />
      <span className="flip-region-sheet" key={name} aria-hidden="true">{name}</span>
    </span>
  )
}

function closureColor(rate, thresholds) {
  return getAnalysisLevel(rate, thresholds, ANALYSIS_MODES.CLOSURE_RATE)?.color || '#e7ebe9'
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : '자료 확인 중'
}

function SelectionImpact({ geoData, selectedCode, selectedDong, selectedStats, quarter, onDismiss }) {
  const [visible, setVisible] = useState(true)
  const anchorIcon = useMemo(() => L.divIcon({
    className: 'landing-impact-anchor',
    html: '',
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  }), [])
  const center = useMemo(() => {
    const feature = geoData?.features?.find((item) => (
      String(item.properties?.ADSTRD_CD || '') === selectedCode
    ))
    if (!feature) return null
    const bounds = L.geoJSON(feature).getBounds()
    return bounds.isValid() ? bounds.getCenter() : null
  }, [geoData, selectedCode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible || !center || !selectedDong) return null

  return (
    <Marker position={center} icon={anchorIcon} interactive={false} keyboard={false}>
      <Tooltip
        permanent
        interactive={false}
        direction="auto"
        offset={[11, 0]}
        className="landing-selection-impact"
        opacity={1}
      >
        <span className="landing-selection-impact-content">
          <span className="landing-impact-copy">
            <strong>{selectedDong.name}</strong>
            <small>{quarterLabel(quarter)} 폐업률</small>
          </span>
          <b>{formatRate(selectedStats?.['폐업_률'])}</b>
          <a href={`/?screen=map&region=${selectedCode}`}>
            상세 보기 <ArrowIcon />
          </a>
        </span>
      </Tooltip>
    </Marker>
  )
}

function LandingMapPreview({ geoData, processed, selectedCode, quarter, impactVersion, onImpactDismiss, onQuarterChange, onSelect }) {
  const selectedDong = processed[selectedCode]
  const selectedStats = selectedDong?.quarters?.[quarter]
  const closureThresholds = useMemo(() => computeAnalysisThresholds(
    Object.values(processed)
      .map((item) => item.quarters?.[quarter]?.['폐업_률'])
      .filter(Number.isFinite),
    ANALYSIS_MODES.CLOSURE_RATE,
  ), [processed, quarter])

  const mapStyle = (feature) => {
    const code = String(feature.properties?.ADSTRD_CD || '')
    const rate = processed[code]?.quarters?.[quarter]?.['폐업_률']
    const selected = code === selectedCode
    return {
      color: selected ? '#244c40' : 'rgba(255,255,255,.9)',
      weight: selected ? 3 : 1.2,
      fillColor: closureColor(rate, closureThresholds),
      fillOpacity: selected ? 0.82 : 0.69,
    }
  }

  const bindFeature = (feature, layer) => {
    const code = String(feature.properties?.ADSTRD_CD || '')
    const name = processed[code]?.name || feature.properties?.ADSTRD_NM || '행정동'
    if (code !== selectedCode) {
      layer.bindTooltip(name, { sticky: true, direction: 'top', className: 'landing-map-tooltip' })
    }
    layer.on({
      click: () => onSelect(code),
      mouseover: () => layer.setStyle({ weight: code === selectedCode ? 3 : 2, fillOpacity: code === selectedCode ? 0.82 : 0.75 }),
      mouseout: () => layer.setStyle(mapStyle(feature)),
    })
  }

  return (
    <section className="landing-map-card" aria-label="서울 상권 변화 미리보기">
      <div className="landing-map-heading">
        <div className="landing-map-heading-main">
          <div className="landing-map-title-row">
            <strong>서울 상권 변화 지도</strong>
            <label>
              <span className="sr-only">지도 기준 분기</span>
              <select value={quarter} onChange={(event) => onQuarterChange(event.target.value)}>
                {QUARTER_OPTIONS.map((option) => (
                  <option value={option} key={option}>{quarterLabel(option)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="landing-legend" aria-label="상대적 폐업 수준 범례">
            <span>상대적 폐업 수준</span>
            <small>낮음</small>
            {CLOSURE_LEVELS.map((level) => (
              <i key={level.key} style={{ backgroundColor: level.color }} />
            ))}
            <small>높음</small>
          </div>
        </div>
      </div>
      <div className="landing-map-canvas">
        {geoData ? (
          <MapContainer
            center={[37.55, 126.99]}
            zoom={10}
            minZoom={9}
            maxZoom={13}
            zoomSnap={0.25}
            scrollWheelZoom={false}
            attributionControl={false}
            className="landing-leaflet-map"
          >
            <FitLandingBounds geoData={geoData} />
            <GeoJSON
              key={`${quarter}-${Object.keys(processed).length}-${selectedCode}`}
              data={geoData}
              style={mapStyle}
              onEachFeature={bindFeature}
            />
            {impactVersion > 0 && (
              <SelectionImpact
                key={`${selectedCode}-${impactVersion}`}
                geoData={geoData}
                selectedCode={selectedCode}
                selectedDong={selectedDong}
                selectedStats={selectedStats}
                quarter={quarter}
                onDismiss={onImpactDismiss}
              />
            )}
          </MapContainer>
        ) : (
          <div className="landing-map-loading"><span />지도를 준비하고 있습니다</div>
        )}
        <p className="landing-map-hint">지도의 동네를 선택해 보세요.</p>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const [processed, setProcessed] = useState({})
  const [geoData, setGeoData] = useState(null)
  const [selectedQuarter, setSelectedQuarter] = useState('20251')
  const [selectedCode, setSelectedCode] = useState(DEFAULT_DONG_CODE)
  const [selectionImpactVersion, setSelectionImpactVersion] = useState(0)
  const [exampleRegions, setExampleRegions] = useState([])
  const [headlineRegionName, setHeadlineRegionName] = useState('동네')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchError, setSearchError] = useState('')
  const searchWrapRef = useRef(null)

  useEffect(() => {
    document.body.classList.add('landing-page-body')
    return () => document.body.classList.remove('landing-page-body')
  }, [])

  useEffect(() => {
    fetch(DATA_PATHS.geojson).then((response) => {
      if (!response.ok) throw new Error('지도 경계 데이터를 불러오지 못했습니다.')
      return response.json()
    }).then((boundaryData) => {
      setGeoData(boundaryData)
    }).catch((error) => {
      console.error('[landing] preview loading failed', error)
    })
  }, [])

  useEffect(() => {
    fetchJsonCached(DATA_PATHS.stores(selectedQuarter), '시작 화면 행정동 데이터')
      .then(setProcessed)
      .catch((error) => console.error('[landing] preview loading failed', error))
  }, [selectedQuarter])

  useEffect(() => {
    const revealTargets = document.querySelectorAll('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      revealTargets.forEach((target) => target.classList.add('is-visible'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.16 })
    revealTargets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const closeSearch = (event) => {
      if (!searchWrapRef.current?.contains(event.target)) setSearchOpen(false)
    }
    document.addEventListener('pointerdown', closeSearch)
    return () => document.removeEventListener('pointerdown', closeSearch)
  }, [])

  const regions = useMemo(() => (
    Object.entries(processed)
      .map(([code, item]) => ({ code, name: item.name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'))
  ), [processed])

  const filteredRegions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko-KR')
    if (!normalized) return regions.slice(0, 6)
    return regions
      .filter((region) => region.name.toLocaleLowerCase('ko-KR').includes(normalized))
      .slice(0, 7)
  }, [query, regions])

  useEffect(() => {
    if (!regions.length) return
    setExampleRegions((current) => current.length ? current : sampleRegions(regions, 3))
  }, [regions])

  const chooseRegion = (code) => {
    const region = processed[code]
    if (!region) return
    setSelectedCode(code)
    setSelectionImpactVersion((current) => current + 1)
    setHeadlineRegionName(region.name)
    setQuery(region.name)
    setSearchOpen(false)
    setSearchError('')
  }

  const findRegionByName = (name) => regions.find((region) => region.name === name)

  const handleSubmit = (event) => {
    event.preventDefault()
    const exact = findRegionByName(query.trim())
    const targetCode = exact?.code || (processed[selectedCode]?.name === query.trim() ? selectedCode : '')
    if (!targetCode) {
      setSearchError('목록에서 행정동을 선택해 주세요.')
      setSearchOpen(true)
      return
    }
    window.location.assign(`/?screen=map&region=${targetCode}`)
  }

  const handleMapSelect = (code) => {
    setSelectedCode(code)
    setSelectionImpactVersion((current) => current + 1)
    const name = processed[code]?.name || ''
    setHeadlineRegionName(name || '동네')
    setQuery(name)
    setSearchError('')
  }

  return (
    <div className="landing-root">
      <header className="landing-header">
        <BrandLockup />
        <nav className="landing-nav" aria-label="주요 메뉴">
          <a href="/?screen=map">상권 지도 시작</a>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-eyebrow entrance entrance-1">서울 25개 자치구, 423개 행정동</p>
            <h1 className="entrance entrance-2" aria-label="개업 전, 동네의 변화를 먼저 읽어보세요.">
              <span className="landing-heading-line">개업 전,</span>
              <span className="landing-heading-flip-line">
                <FlipRegionName name={headlineRegionName} />
                <span>의 변화를</span>
              </span>
              <span>먼저 읽어보세요.</span>
            </h1>
            <p className="landing-description entrance entrance-3">
              개·폐업, 매출, 생활인구 변화를 업종과 분기별로 한눈에 확인합니다.
            </p>

            <div className="landing-search-block entrance entrance-4" ref={searchWrapRef}>
              <form className="landing-search" onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="landing-region-search">행정동 검색</label>
                <input
                  id="landing-region-search"
                  value={query}
                  placeholder="동 이름이나 주소를 입력하세요"
                  autoComplete="off"
                  onFocus={() => setSearchOpen(true)}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSearchOpen(true)
                    setSearchError('')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearchOpen(false)
                  }}
                  aria-expanded={searchOpen}
                  aria-controls="landing-region-options"
                />
                <button type="submit">
                  이 지역 분석 보기 <ArrowIcon />
                </button>
              </form>
              {searchOpen && (
                <div className="landing-search-options" id="landing-region-options" role="listbox">
                  {filteredRegions.length ? filteredRegions.map((region) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={region.code === selectedCode}
                      key={region.code}
                      onClick={() => chooseRegion(region.code)}
                    >
                      <span>{region.name}</span>
                    </button>
                  )) : <p>일치하는 행정동이 없습니다.</p>}
                </div>
              )}
              {searchError && <p className="landing-search-error" role="alert">{searchError}</p>}
            </div>

            <div className="landing-examples entrance entrance-5" aria-label="추천 지역">
              {exampleRegions.map((region) => (
                <button type="button" key={region.code} onClick={() => chooseRegion(region.code)}>
                  {region.name}
                </button>
              ))}
            </div>

            <a className="landing-map-link entrance entrance-5" href="/?screen=map">
              지도에서 직접 선택하기 <ArrowIcon />
            </a>

          </div>

          <div className="landing-map-entrance">
            <LandingMapPreview
              geoData={geoData}
              processed={processed}
              selectedCode={selectedCode}
              quarter={selectedQuarter}
              impactVersion={selectionImpactVersion}
              onImpactDismiss={() => setHeadlineRegionName('동네')}
              onQuarterChange={setSelectedQuarter}
              onSelect={handleMapSelect}
            />
          </div>
        </section>

        <section className="landing-steps" data-reveal>
          <div className="steps-heading">
            <span>HOW TO USE</span>
            <h2>세 단계로 확인합니다.</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <strong>지역 선택</strong>
              <p>지도에서 동네를 선택하거나 검색으로 찾습니다.</p>
            </li>
            <li>
              <span>02</span>
              <strong>지표 확인</strong>
              <p>개·폐업, 매출, 생활인구 변화를 분기별로 확인합니다.</p>
            </li>
            <li>
              <span>03</span>
              <strong>지역 비교</strong>
              <p>여러 지역을 비교해 변화의 차이를 살펴봅니다.</p>
            </li>
          </ol>
        </section>
      </main>
    </div>
  )
}

export { BrandLockup }
