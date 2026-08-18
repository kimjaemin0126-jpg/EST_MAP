import { useEffect, useMemo, useState } from 'react'
import { DATA_PATHS } from '../config/dataPaths'
import { fetchOpenSafeScenario } from '../services/openSafeApi'
import { fetchJsonCached, mergeMarketContext } from '../services/staticDataService'
import { ALL_INDUSTRIES, getDistrictName, getDongStats } from '../utils/dataProcessor'
import { AiMetricComparison, MarketRadarComparison } from './ComparisonCharts'
import '../styles/comparison-analysis.css'

const QUARTERS = Object.freeze(['20251', '20252', '20253', '20254'])
const LATEST_QUARTER = '20254'

function annualStats(item, industry) {
  const rows = QUARTERS.map((quarter) => getDongStats(item, quarter, industry))
  if (!rows.some(Boolean)) return null
  const stores = rows.reduce((sum, row) => sum + (Number.isFinite(row?.['점포_수']) ? row['점포_수'] : 0), 0) / QUARTERS.length
  const opened = rows.reduce((sum, row) => sum + (Number.isFinite(row?.['개업_점포_수']) ? row['개업_점포_수'] : 0), 0)
  const closed = rows.reduce((sum, row) => sum + (Number.isFinite(row?.['폐업_점포_수']) ? row['폐업_점포_수'] : 0), 0)
  return {
    '점포_수': stores,
    '개업_점포_수': opened,
    '폐업_점포_수': closed,
    '개업_률': stores > 0 ? opened / stores * 100 : null,
    '폐업_률': stores > 0 ? closed / stores * 100 : null,
  }
}

function finiteAggregate(values, average = false) {
  const valid = values.filter(Number.isFinite)
  if (!valid.length) return null
  const sum = valid.reduce((total, value) => total + value, 0)
  return average ? sum / valid.length : sum
}

function marketStats(context, dongCode, industryCode, stats) {
  const floatingPopulation = finiteAggregate(QUARTERS.map((q) => context.floatingPopulation?.[q]?.[dongCode]?.total))
  const residentPopulation = finiteAggregate(QUARTERS.map((q) => context.residentPopulation?.[q]?.[dongCode]?.total), true)
  const estimatedSales = finiteAggregate(QUARTERS.map((q) => context.sales?.[q]?.[dongCode]?.[industryCode]?.amount))
  const stores = stats?.['점포_수']
  const netStoreChangeRate = stores > 0 ? ((stats?.['개업_점포_수'] || 0) - (stats?.['폐업_점포_수'] || 0)) / stores * 100 : null
  const marketStability = Number.isFinite(stats?.['폐업_률']) ? Math.max(0, 100 - stats['폐업_률']) : null
  return { floatingPopulation, residentPopulation, estimatedSales, netStoreChangeRate, marketStability }
}

function percentile(value, values) {
  if (!Number.isFinite(value)) return 0
  const valid = values.filter(Number.isFinite)
  if (!valid.length) return 0
  const below = valid.filter((item) => item < value).length
  const equal = valid.filter((item) => item === value).length
  return Math.round((below + equal / 2) / valid.length * 100)
}

function number(value, digits = 0) {
  return Number.isFinite(value) ? value.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '-'
}
function percent(value, digits = 1) { return Number.isFinite(value) ? `${number(value, digits)}%` : '-' }
function won(value) {
  if (!Number.isFinite(value)) return '-'
  if (Math.abs(value) >= 1_000_000_000_000) return `${number(value / 1_000_000_000_000, 1)}조원`
  if (Math.abs(value) >= 100_000_000) return `${number(value / 100_000_000, 1)}억원`
  return `${number(value / 10_000)}만원`
}

export default function ComparisonAnalysis({ baseDongCode, processed, initialIndustry }) {
  const [targetDongCode, setTargetDongCode] = useState('')
  const [industry, setIndustry] = useState(initialIndustry === ALL_INDUSTRIES ? '' : initialIndustry)
  const [context, setContext] = useState({ sales: {}, floatingPopulation: {}, residentPopulation: {} })
  const [contextLoading, setContextLoading] = useState(true)
  const [contextError, setContextError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [compared, setCompared] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiNotice, setApiNotice] = useState('')

  const regionOptions = useMemo(() => Object.entries(processed)
    .filter(([code, item]) => code !== baseDongCode && Object.keys(item?.industries?.[LATEST_QUARTER] || {}).length)
    .map(([code, item]) => ({ code, name: item.name, district: getDistrictName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko')), [processed, baseDongCode])

  useEffect(() => {
    if (!targetDongCode || !regionOptions.some((item) => item.code === targetDongCode)) setTargetDongCode(regionOptions[0]?.code || '')
  }, [regionOptions, targetDongCode])

  const baseDong = processed?.[baseDongCode]
  const targetDong = processed?.[targetDongCode]

  const commonIndustries = useMemo(() => {
    const left = baseDong?.industries?.[LATEST_QUARTER] || {}
    const right = targetDong?.industries?.[LATEST_QUARTER] || {}
    return Object.entries(left)
      .filter(([name, stats]) => stats?.code && right?.[name]?.code === stats.code)
      .map(([name, stats]) => ({ name, code: String(stats.code) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [baseDong, targetDong])

  const comparableIndustries = useMemo(() => {
    if (contextLoading) return []
    return commonIndustries.filter((item) => {
      const leftHasSales = QUARTERS.some((quarter) => Number.isFinite(context.sales?.[quarter]?.[baseDongCode]?.[item.code]?.amount))
      const rightHasSales = QUARTERS.some((quarter) => Number.isFinite(context.sales?.[quarter]?.[targetDongCode]?.[item.code]?.amount))
      return leftHasSales && rightHasSales
    })
  }, [commonIndustries, context, contextLoading, baseDongCode, targetDongCode])

  useEffect(() => {
    if (industry && comparableIndustries.some((item) => item.name === industry)) return
    const preferred = comparableIndustries.find((item) => item.name === initialIndustry)
    setIndustry(preferred?.name || comparableIndustries[0]?.name || '')
    setAnalysis(null)
    setCompared(false)
  }, [comparableIndustries, industry, initialIndustry])

  useEffect(() => {
    let active = true
    setContextLoading(true)
    Promise.all(QUARTERS.map((quarter) => fetchJsonCached(DATA_PATHS.marketContext(quarter), `${quarter} 비교 데이터`)))
      .then((items) => {
        if (!active) return
        setContext(items.reduce((merged, item) => mergeMarketContext(merged, item), { sales: {}, floatingPopulation: {}, residentPopulation: {} }))
        setContextError('')
      })
      .catch(() => { if (active) setContextError('연간 매출·인구 비교 데이터를 불러오지 못했습니다.') })
      .finally(() => { if (active) setContextLoading(false) })
    return () => { active = false }
  }, [])

  const industryCode = baseDong?.industries?.[LATEST_QUARTER]?.[industry]?.code || ''
  const targetIndustryCode = targetDong?.industries?.[LATEST_QUARTER]?.[industry]?.code || ''
  const leftStats = annualStats(baseDong, industry)
  const rightStats = annualStats(targetDong, industry)

  const radarMetrics = useMemo(() => {
    if (!industry || contextLoading) return []
    const all = new Map()
    Object.entries(processed).forEach(([dongCode, dong]) => {
      const row = dong?.industries?.[LATEST_QUARTER]?.[industry]
      if (!row?.code) return
      all.set(dongCode, marketStats(context, dongCode, row.code, annualStats(dong, industry)))
    })
    const left = all.get(baseDongCode) || {}
    const right = all.get(targetDongCode) || {}
    const defs = [
      ['floatingPopulation', '유동인구', (v) => Number.isFinite(v) ? `${number(v)}명` : '-'],
      ['residentPopulation', '상주인구', (v) => Number.isFinite(v) ? `${number(v)}명` : '-'],
      ['estimatedSales', '추정 매출', won],
      ['netStoreChangeRate', '순점포 증감률', (v) => percent(v, 1)],
      ['marketStability', '상권 안정성', (v) => percent(v, 1)],
    ]
    return defs.map(([key, label, format]) => {
      const benchmark = Array.from(all.values(), (item) => item[key])
      return { key, label, leftScore: percentile(left[key], benchmark), rightScore: percentile(right[key], benchmark), leftDisplay: format(left[key]), rightDisplay: format(right[key]) }
    })
  }, [industry, contextLoading, processed, context, baseDongCode, targetDongCode])

  function resetComparison() {
    setAnalysis(null)
    setCompared(false)
    setApiNotice('')
  }

  async function runComparison() {
    if (!targetDongCode || !industryCode || !targetIndustryCode) return
    setCompared(true)
    setLoading(true)
    setApiNotice('')
    try {
      const [left, right] = await Promise.all([
        fetchOpenSafeScenario({ dong_code: String(baseDongCode), industry_code: String(industryCode), dong_name: baseDong?.name || '', industry_name: industry }),
        fetchOpenSafeScenario({ dong_code: String(targetDongCode), industry_code: String(targetIndustryCode), dong_name: targetDong?.name || '', industry_name: industry }),
      ])
      setAnalysis({ left, right })
    } catch (error) {
      setAnalysis(null)
      setApiNotice('기본 상권 비교는 정상적으로 완료되었습니다. AI 상세 비교 데이터는 이 조합에서 제공되지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="compare-analysis">
      <div className="compare-heading"><div><span>지역 비교 분석</span><h2>두 지역 상권 비교</h2><p>{baseDong?.name || '-'}을 기준으로 다른 행정동의 2025년 통계를 같은 업종에서 비교합니다.</p></div></div>

      <section className="compare-controls">
        <div className="compare-control-heading"><strong>비교 조건</strong><span>현재 지역은 고정하고 비교할 지역과 공통 업종을 선택하세요.</span></div>
        <div className="compare-control-grid">
          <label><span>지역 A · 현재 선택</span><input value={`${baseDong?.name || '-'} · ${getDistrictName(baseDongCode)}`} disabled /></label>
          <label><span>지역 B · 비교 대상</span><select value={targetDongCode} onChange={(event) => { setTargetDongCode(event.target.value); resetComparison() }}>{regionOptions.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.district}</option>)}</select></label>
          <label className="wide"><span>비교 가능 업종</span><select value={industry} onChange={(event) => { setIndustry(event.target.value); resetComparison() }} disabled={contextLoading || comparableIndustries.length === 0}><option value="">{contextLoading ? '비교 데이터를 확인하는 중입니다' : comparableIndustries.length ? '업종을 선택해주세요' : '두 지역에 공통 비교 데이터가 없습니다'}</option>{comparableIndustries.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}</select><small className="compare-field-note">두 지역 모두 점포와 추정매출 데이터가 있는 업종만 표시합니다.</small></label>
        </div>
        <div className="compare-preview-grid">
          <div><span>{baseDong?.name || '지역 A'}</span><strong>{Number.isFinite(leftStats?.['점포_수']) ? `${number(leftStats['점포_수'])}개` : '-'}</strong><small>연평균 점포 수</small><em>폐업률 {percent(leftStats?.['폐업_률'])}</em></div>
          <div><span>{targetDong?.name || '지역 B'}</span><strong>{Number.isFinite(rightStats?.['점포_수']) ? `${number(rightStats['점포_수'])}개` : '-'}</strong><small>연평균 점포 수</small><em>폐업률 {percent(rightStats?.['폐업_률'])}</em></div>
        </div>
        <button type="button" className="compare-run-button" onClick={runComparison} disabled={loading || contextLoading || !industry || !targetDongCode}>{loading ? '비교 분석 중...' : '두 지역 비교하기'}</button>
      </section>

      {contextError && <div className="compare-error">{contextError}</div>}
      {apiNotice && <div className="compare-notice">{apiNotice}</div>}

      {!compared ? <div className="compare-empty"><strong>두 지역을 같은 기준으로 비교합니다.</strong><span>비교 지역과 공통 업종을 선택한 뒤 비교 버튼을 눌러주세요.</span></div> : (
        <div className="compare-results">
          {analysis && <AiMetricComparison leftName={baseDong?.name || '지역 A'} rightName={targetDong?.name || '지역 B'} leftAi={analysis.left} rightAi={analysis.right} />}
          {radarMetrics.length > 0 && <MarketRadarComparison leftName={baseDong?.name || '지역 A'} rightName={targetDong?.name || '지역 B'} metrics={radarMetrics} />}
        </div>
      )}
    </div>
  )
}
