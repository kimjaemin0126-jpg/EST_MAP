import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DATA_PATHS } from '../config/dataPaths'
import { requestScenario } from '../services/comparisonService'
import {
  fetchJsonCached,
  mergeMarketContext,
  mergeProcessedData,
} from '../services/staticDataService'
import { getDistrictName, getDongStats } from '../utils/dataProcessor'
import { AiMetricComparison, MarketRadarComparison } from './ComparisonCharts'
import '../styles/comparison.css'

const COMPARISON_YEAR = '2025'
const COMPARISON_QUARTERS = Object.freeze(['20251', '20252', '20253', '20254'])
const LATEST_COMPARISON_QUARTER = COMPARISON_QUARTERS[COMPARISON_QUARTERS.length - 1]
const DEFAULT_TARGETS = Object.freeze({
  left: '11410585',
  right: '11440660',
})
const DEFAULT_INDUSTRY = '커피-음료'

function quarterLabel(code) {
  return `${code.slice(0, 4)}년 ${code.slice(4)}분기`
}

function annualStats(item, industry) {
  const rows = COMPARISON_QUARTERS
    .map((quarter) => getDongStats(item, quarter, industry))
  if (!rows.some(Boolean)) return null

  const averageStores = rows.reduce((total, row) => (
    total + (Number.isFinite(row?.['점포_수']) ? row['점포_수'] : 0)
  ), 0) / COMPARISON_QUARTERS.length
  const openedRows = rows.filter((row) => Number.isFinite(row?.['개업_점포_수']))
  const closedRows = rows.filter((row) => Number.isFinite(row?.['폐업_점포_수']))
  const opened = openedRows.length
    ? openedRows.reduce((total, row) => total + row['개업_점포_수'], 0)
    : null
  const closed = closedRows.length
    ? closedRows.reduce((total, row) => total + row['폐업_점포_수'], 0)
    : null

  return {
    '점포_수': averageStores,
    '개업_점포_수': opened,
    '폐업_점포_수': closed,
    '개업_률': averageStores > 0 && opened != null ? (opened / averageStores) * 100 : null,
    '폐업_률': averageStores > 0 && closed != null ? (closed / averageStores) * 100 : null,
  }
}

function finiteAggregate(values, mode = 'sum') {
  const valid = values.filter(Number.isFinite)
  if (!valid.length) return null
  const total = valid.reduce((sum, value) => sum + value, 0)
  return mode === 'average' ? total / valid.length : total
}

function annualMarketStats(context, dongCode, industryCode, mapStats) {
  const floatingPopulation = finiteAggregate(COMPARISON_QUARTERS.map((quarter) => (
    context.floatingPopulation?.[quarter]?.[dongCode]?.total
  )))
  const residentPopulation = finiteAggregate(COMPARISON_QUARTERS.map((quarter) => (
    context.residentPopulation?.[quarter]?.[dongCode]?.total
  )), 'average')
  const estimatedSales = finiteAggregate(COMPARISON_QUARTERS.map((quarter) => (
    context.sales?.[quarter]?.[dongCode]?.[industryCode]?.amount
  )))
  const stores = mapStats?.['점포_수']
  const opened = mapStats?.['개업_점포_수']
  const closed = mapStats?.['폐업_점포_수']
  const netStoreChangeRate = stores > 0 && Number.isFinite(opened) && Number.isFinite(closed)
    ? ((opened - closed) / stores) * 100
    : null
  const closureRate = mapStats?.['폐업_률']
  const marketStability = Number.isFinite(closureRate)
    ? Math.min(100, Math.max(0, 100 - closureRate))
    : null

  return {
    floatingPopulation,
    residentPopulation,
    estimatedSales,
    netStoreChangeRate,
    marketStability,
  }
}

function percentileScore(value, values) {
  if (!Number.isFinite(value)) return 0
  const valid = values.filter(Number.isFinite)
  if (!valid.length) return 0
  const below = valid.filter((item) => item < value).length
  const equal = valid.filter((item) => item === value).length
  return Math.round(((below + equal / 2) / valid.length) * 100)
}

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatPercent(value, digits = 2) {
  return Number.isFinite(value) ? `${formatNumber(value, digits)}%` : '-'
}

function formatCount(value) {
  return Number.isFinite(value) ? `${formatNumber(value)}개` : '-'
}

function formatWonCompact(value) {
  if (!Number.isFinite(value)) return '-'
  if (Math.abs(value) >= 1_000_000_000_000) return `${formatNumber(value / 1_000_000_000_000, 1)}조원`
  if (Math.abs(value) >= 100_000_000) return `${formatNumber(value / 100_000_000, 1)}억원`
  return `${formatNumber(value / 10_000)}만원`
}

function regionOptionLabel(option) {
  return option ? `${option.name} · ${option.district}` : ''
}

function TargetSelector({ side, value, options, details, onChange, disabled, locked = false }) {
  const label = side === 'left' ? '지역 A' : '지역 B'
  const inputId = `region-search-${side}`
  const listId = `region-options-${side}`
  const inputRef = useRef(null)
  const selectedOption = options.find((item) => item.code === value)
  const selectedLabel = regionOptionLabel(selectedOption)
  const [query, setQuery] = useState(selectedLabel)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState(null)
  const normalizedQuery = query === selectedLabel
    ? ''
    : query.trim().toLocaleLowerCase('ko-KR')
  const filteredOptions = normalizedQuery
    ? options.filter((item) => (
      regionOptionLabel(item).toLocaleLowerCase('ko-KR').includes(normalizedQuery)
    ))
    : options

  useEffect(() => {
    setQuery(selectedLabel)
  }, [selectedLabel])

  useEffect(() => {
    if (!isOpen) return undefined

    function updateDropdownPosition() {
      const rect = inputRef.current?.getBoundingClientRect()
      if (!rect) return
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, Math.min(230, window.innerHeight - rect.bottom - 12)),
      })
    }

    updateDropdownPosition()
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [isOpen])

  function handleSearchChange(event) {
    setQuery(event.target.value)
    setIsOpen(true)
    setActiveIndex(-1)
  }

  function selectRegion(option) {
    if (!option) return
    setQuery(regionOptionLabel(option))
    setIsOpen(false)
    setActiveIndex(-1)
    if (option.code !== value) onChange(option.code)
  }

  function handleSearchBlur() {
    setIsOpen(false)
    setActiveIndex(-1)
    setQuery(selectedLabel)
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
      setQuery(selectedLabel)
      return
    }
    if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault()
      selectRegion(filteredOptions[activeIndex])
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setIsOpen(true)
    setActiveIndex((current) => {
      if (!filteredOptions.length) return -1
      if (event.key === 'ArrowDown') return Math.min(current + 1, filteredOptions.length - 1)
      return current <= 0 ? filteredOptions.length - 1 : current - 1
    })
  }

  return (
    <article className={`target-selector ${side}${locked ? ' locked' : ''}`}>
      <div className="target-heading">
        <span>{label}</span>
        <strong>{details.dong?.name || '지역 선택'}</strong>
        {locked && <small className="target-lock-badge">선택 지역 고정</small>}
      </div>
      <div className="region-search-field">
        <label htmlFor={inputId}>{locked ? '지도에서 선택한 행정동' : '행정동 검색·선택'}</label>
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          role="combobox"
          value={query}
          onChange={handleSearchChange}
          onBlur={handleSearchBlur}
          onFocus={(event) => {
            event.target.select()
            setIsOpen(true)
            setActiveIndex(options.findIndex((item) => item.code === value))
          }}
          onKeyDown={handleSearchKeyDown}
          placeholder="행정동 또는 자치구 검색"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen}
          aria-activedescendant={
            isOpen && activeIndex >= 0
              ? `${listId}-${filteredOptions[activeIndex]?.code}`
              : undefined
          }
          disabled={disabled}
        />
        {isOpen && dropdownPosition && createPortal((
          <ul
            id={listId}
            className="region-search-results"
            role="listbox"
            style={dropdownPosition}
          >
            {filteredOptions.length ? filteredOptions.map((item, index) => (
              <li
                key={item.code}
                id={`${listId}-${item.code}`}
                className={index === activeIndex ? 'active' : ''}
                role="option"
                aria-selected={item.code === value}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectRegion(item)}
                >
                  {regionOptionLabel(item)}
                </button>
              </li>
            )) : (
              <li className="region-search-empty">검색 결과가 없습니다.</li>
            )}
          </ul>
        ), document.body)}
      </div>
      <dl className="target-preview">
        <div><dt>연평균 점포</dt><dd>{formatCount(details.mapStats?.['점포_수'])}</dd></div>
        <div><dt>연간 개업률</dt><dd>{formatPercent(details.mapStats?.['개업_률'])}</dd></div>
        <div><dt>연간 폐업률</dt><dd>{formatPercent(details.mapStats?.['폐업_률'])}</dd></div>
      </dl>
    </article>
  )
}

export default function ComparisonPage() {
  const initialRequest = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      regionA: params.get('regionA') || '',
      lockA: params.get('lockA') === '1',
      industry: params.get('industry') || DEFAULT_INDUSTRY,
    }
  }, [])
  const [processed, setProcessed] = useState({})
  const [marketContext, setMarketContext] = useState({
    sales: {},
    floatingPopulation: {},
    residentPopulation: {},
  })
  const [targets, setTargets] = useState({
    ...DEFAULT_TARGETS,
    left: initialRequest.regionA || DEFAULT_TARGETS.left,
  })
  const [selectedIndustry, setSelectedIndustry] = useState(initialRequest.industry)
  const [staticLoading, setStaticLoading] = useState(true)
  const [staticError, setStaticError] = useState('')
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [analysis, setAnalysis] = useState(null)

  useEffect(() => {
    document.body.classList.add('comparison-mode')
    return () => document.body.classList.remove('comparison-mode')
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      Promise.all(COMPARISON_QUARTERS.map((quarter) => (
        fetchJsonCached(
          DATA_PATHS.stores(quarter),
          `${quarter} 점포 데이터`,
        )
      ))),
      Promise.all(COMPARISON_QUARTERS.map((quarter) => (
        fetchJsonCached(
          DATA_PATHS.marketContext(quarter),
          `${quarter} 상권 맥락 데이터`,
        )
      ))),
    ])
      .then(([quarterlyData, quarterlyContext]) => {
        if (active) {
          setProcessed(quarterlyData.reduce(
            (merged, data) => mergeProcessedData(merged, data),
            {},
          ))
          setMarketContext(quarterlyContext.reduce(
            (merged, data) => mergeMarketContext(merged, data),
            { sales: {}, floatingPopulation: {}, residentPopulation: {} },
          ))
        }
      })
      .catch(() => {
        if (active) setStaticError('상권 통계 데이터를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setStaticLoading(false)
      })
    return () => { active = false }
  }, [])

  const regionOptions = useMemo(() => (
    Object.entries(processed)
      .filter(([, item]) => (
        Object.keys(item.industries?.[LATEST_COMPARISON_QUARTER] || {}).length > 0
      ))
      .map(([code, item]) => ({ code, name: item.name, district: getDistrictName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  ), [processed])
  const leftRegionLocked = initialRequest.lockA
    && regionOptions.some((item) => item.code === initialRequest.regionA)

  useEffect(() => {
    if (!regionOptions.length) return
    setTargets((current) => {
      const left = regionOptions.some((item) => item.code === current.left)
        ? current.left
        : regionOptions[0].code
      const right = regionOptions.some((item) => item.code === current.right)
        ? current.right
        : regionOptions.find((item) => item.code !== left)?.code || left
      return left === current.left && right === current.right ? current : { left, right }
    })
  }, [regionOptions])

  function industriesFor(dongCode) {
    const dong = processed[dongCode]
    return Object.entries(dong?.industries?.[LATEST_COMPARISON_QUARTER] || {})
      .map(([name, stats]) => ({
        name,
        code: stats.code,
        stores: annualStats(dong, name)?.['점포_수'] || 0,
      }))
      .filter((item) => item.code)
  }

  const commonIndustries = useMemo(() => {
    const rightByCode = new Map(industriesFor(targets.right).map((item) => [item.code, item]))
    return industriesFor(targets.left)
      .filter((item) => rightByCode.get(item.code)?.name === item.name)
      .map((item) => ({
        ...item,
        combinedStores: item.stores + rightByCode.get(item.code).stores,
      }))
      .sort((a, b) => (
        b.combinedStores - a.combinedStores
        || a.name.localeCompare(b.name, 'ko')
      ))
  }, [processed, targets.left, targets.right])

  useEffect(() => {
    if (!commonIndustries.length) return
    if (commonIndustries.some((item) => item.name === selectedIndustry)) return
    setSelectedIndustry(
      commonIndustries.find((item) => item.name === DEFAULT_INDUSTRY)?.name
      || commonIndustries[0].name,
    )
    setAnalysis(null)
  }, [commonIndustries, selectedIndustry])

  function buildDetails(side) {
    const dongCode = targets[side]
    const dong = processed[dongCode]
    const industry = dong?.industries?.[LATEST_COMPARISON_QUARTER]?.[selectedIndustry]
    return {
      dongCode,
      dong,
      industryCode: industry?.code || '',
      mapStats: annualStats(dong, selectedIndustry),
    }
  }

  const leftDetails = buildDetails('left')
  const rightDetails = buildDetails('right')
  const sameRegion = targets.left && targets.left === targets.right

  const radarMetrics = useMemo(() => {
    const marketByDong = new Map()
    Object.entries(processed).forEach(([dongCode, dong]) => {
      const industry = dong.industries?.[LATEST_COMPARISON_QUARTER]?.[selectedIndustry]
      if (!industry?.code) return
      const mapStats = annualStats(dong, selectedIndustry)
      marketByDong.set(
        dongCode,
        annualMarketStats(marketContext, dongCode, industry.code, mapStats),
      )
    })

    const definitions = [
      {
        key: 'floatingPopulation',
        label: '유동인구',
        format: (value) => Number.isFinite(value) ? `${formatNumber(value)}명` : '-',
      },
      {
        key: 'residentPopulation',
        label: '상주인구',
        format: (value) => Number.isFinite(value) ? `${formatNumber(value)}명` : '-',
      },
      { key: 'estimatedSales', label: '추정 매출', format: formatWonCompact },
      {
        key: 'netStoreChangeRate',
        label: '순점포 증감률',
        format: (value) => formatPercent(value, 1),
      },
      {
        key: 'marketStability',
        label: '상권 안정성',
        format: (value) => formatPercent(value, 1),
      },
    ]
    const left = marketByDong.get(targets.left) || {}
    const right = marketByDong.get(targets.right) || {}

    return definitions.map((definition) => {
      const benchmark = Array.from(marketByDong.values(), (item) => item[definition.key])
      return {
        ...definition,
        leftScore: percentileScore(left[definition.key], benchmark),
        rightScore: percentileScore(right[definition.key], benchmark),
        leftDisplay: definition.format(left[definition.key]),
        rightDisplay: definition.format(right[definition.key]),
      }
    })
  }, [marketContext, processed, selectedIndustry, targets.left, targets.right])

  function resetResult() {
    setAnalysis(null)
    setApiError('')
  }

  function handleRegionChange(side, dongCode) {
    if (side === 'left' && leftRegionLocked) return
    setTargets((current) => ({ ...current, [side]: dongCode }))
    resetResult()
  }

  function handleIndustryChange(industry) {
    setSelectedIndustry(industry)
    resetResult()
  }

  async function runComparison() {
    if (sameRegion || !leftDetails.industryCode || !rightDetails.industryCode) return
    setApiLoading(true)
    setApiError('')
    try {
      const [leftResponse, rightResponse] = await Promise.all([
        requestScenario({
          dong_code: leftDetails.dongCode,
          industry_code: leftDetails.industryCode,
        }),
        requestScenario({
          dong_code: rightDetails.dongCode,
          industry_code: rightDetails.industryCode,
        }),
      ])
      setAnalysis({ left: leftResponse, right: rightResponse })
    } catch (error) {
      setAnalysis(null)
      setApiError(error.message || '비교 분석 요청에 실패했습니다.')
    } finally {
      setApiLoading(false)
    }
  }

  const leftAi = analysis?.left
  const rightAi = analysis?.right

  return (
    <div className="comparison-page">
      <header className="comparison-header">
        <div>
          <h1>두 지역 상권 통계 비교</h1>
        </div>
        <a href="/map">지도 화면으로 이동</a>
      </header>

      <main className="comparison-content compact">
        <section className="comparison-controls compact" aria-labelledby="comparison-condition-title">
          <div className="comparison-section-heading compact-heading">
            <div>
              <h2 id="comparison-condition-title">비교 지역 선택</h2>
              <p>
                {COMPARISON_YEAR}년 연간 기준 · 개·폐업률은 연간 누계 ÷ 연평균 점포로 계산합니다.
              </p>
            </div>
            <label className="shared-industry-field">
              <span>공통 업종</span>
              <select value={selectedIndustry} onChange={(event) => handleIndustryChange(event.target.value)}>
                {commonIndustries.map((item) => (
                  <option key={item.code} value={item.name}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="comparison-horizontal-scroll">
            <div className="comparison-target-grid fixed-columns">
              <TargetSelector
                side="left"
                value={targets.left}
                options={regionOptions}
                details={leftDetails}
                onChange={(value) => handleRegionChange('left', value)}
                disabled={staticLoading || leftRegionLocked}
                locked={leftRegionLocked}
              />
              <TargetSelector
                side="right"
                value={targets.right}
                options={regionOptions}
                details={rightDetails}
                onChange={(value) => handleRegionChange('right', value)}
                disabled={staticLoading}
              />
            </div>
          </div>

          {sameRegion && <div className="comparison-alert error">서로 다른 두 지역을 선택하세요.</div>}
          <div className="comparison-actions compact-actions">
            <p>{leftDetails.dong?.name || '-'} <strong>VS</strong> {rightDetails.dong?.name || '-'}</p>
            <button
              type="button"
              onClick={runComparison}
              disabled={staticLoading || apiLoading || sameRegion || !commonIndustries.length}
            >
              {apiLoading ? '통계 비교 중...' : '통계 비교하기'}
            </button>
          </div>
        </section>

        {staticError && <div className="comparison-alert error">{staticError}</div>}
        {apiError && <div className="comparison-alert error">{apiError} 비교 분석 서버가 실행 중인지 확인하세요.</div>}

        {!analysis ? (
          <section className="comparison-empty compact-empty" aria-live="polite">
            <strong>두 지역의 통계를 한 화면에서 비교합니다.</strong>
            <span>지역과 공통 업종을 선택한 뒤 통계 비교하기를 누르세요.</span>
          </section>
        ) : (
          <section className="comparison-section glance-section" aria-labelledby="glance-title">
            <div className="comparison-section-heading">
              <div>
                <h2 id="glance-title">통계 한눈 비교</h2>
                <p>
                  {COMPARISON_YEAR}년 연간 통계 · {quarterLabel(leftAi.meta.latest_quarter)} 분석
                  {' '}· 예측 {quarterLabel(leftAi.meta.forecast_quarter)}
                </p>
              </div>
              <span className="model-label">{leftAi.meta.model_name || 'AI model'}</span>
            </div>

            <div className="visual-comparison-grid">
              <MarketRadarComparison
                leftName={leftDetails.dong?.name || '지역 A'}
                rightName={rightDetails.dong?.name || '지역 B'}
                metrics={radarMetrics}
              />
              <AiMetricComparison
                leftName={leftDetails.dong?.name || '지역 A'}
                rightName={rightDetails.dong?.name || '지역 B'}
                leftAi={leftAi}
                rightAi={rightAi}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
