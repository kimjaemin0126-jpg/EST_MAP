import { useEffect, useState } from 'react'
import ClosureTrendChart from './ClosureTrendChart'
import MarketQuadrant from './MarketQuadrant'
import OpenSafeAnalysis from './OpenSafeAnalysis'
import ComparisonAnalysis from './ComparisonAnalysis'
import { getIndustryCode } from '../services/dataService'
import {
  MARKET_TYPE_DESCRIPTIONS,
  MIN_STORE_COUNT,
  MODE_STYLES,
  ANALYSIS_MODES,
  generateTrendSummary,
  getDistrictName,
  getDongDisplayIndex,
  getDongStats,
  getMarketTypeData,
  getQuarterlyTrend,
  quarterLabelToCode,
} from '../utils/dataProcessor'
import { formatNumber } from '../utils/formatters'

const QUADRANT_ORDER = ['low-entry-high-closure', 'high-turnover', 'stable', 'active-entry']

function SummaryComparison({ stats, averages }) {
  if (!stats || !averages) return <p className="dashboard-empty">서울 평균 비교 데이터가 없습니다.</p>
  const rows = [
    { key: 'closure', label: '폐업률', value: stats['폐업_률'], average: averages.closureRate },
    { key: 'open', label: '개업률', value: stats['개업_률'], average: averages.openRate },
  ]
  return (
    <div className="dashboard-average-list">
      {rows.map((row) => {
        const maximum = Math.max(row.value || 0, row.average || 0, 0.1) * 1.25
        const position = Math.min(100, ((row.value || 0) / maximum) * 100)
        const averagePosition = Math.min(100, ((row.average || 0) / maximum) * 100)
        return (
          <div className={`dashboard-average-row ${row.key}`} key={row.key}>
            <div><strong>{row.label}</strong><b>{Number.isFinite(row.value) ? `${row.value.toFixed(2)}%` : '-'}</b></div>
            <span>서울 평균 {Number.isFinite(row.average) ? `${row.average.toFixed(2)}%` : '-'}</span>
            <div className="dashboard-average-track"><i style={{ width: `${position}%` }} /><em style={{ left: `${averagePosition}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}

function MarketTypeGrid({ marketType, distribution }) {
  const levels = MODE_STYLES[ANALYSIS_MODES.MARKET_TYPE].levels
  return (
    <div className="dashboard-quadrant-grid">
      {QUADRANT_ORDER.map((key) => {
        const type = levels.find((level) => level.key === key)
        return (
          <div className={marketType?.key === key ? 'active' : ''} key={key}>
            <span>{type?.label}</span>
            <strong>{distribution?.[key] || 0}<small>개 지역</small></strong>
            {marketType?.key === key && <em>선택 지역</em>}
          </div>
        )
      })}
    </div>
  )
}

export default function DetailDashboard({ dongCode, quarter, industry, processed, onReturnToMap }) {
  const [activeTab, setActiveTab] = useState('market')
  const quarterCode = quarterLabelToCode(quarter)
  const info = processed?.[dongCode]
  const stats = getDongStats(info, quarterCode, industry)
  const marketData = getMarketTypeData(processed, quarterCode, industry)
  const marketType = marketData.points.find((point) => point.code === dongCode) || null
  const trend = getQuarterlyTrend(info, industry)
  const trendSummary = generateTrendSummary(trend)
  const opened = stats?.['개업_점포_수']
  const closed = stats?.['폐업_점포_수']
  const netOpenClose = Number.isFinite(opened) && Number.isFinite(closed) ? opened - closed : null
  const sampleInsufficient = Number.isFinite(stats?.['점포_수']) && stats['점포_수'] < MIN_STORE_COUNT
  const quarterLabel = `${quarterCode.slice(0, 4)}년 ${quarterCode.slice(4)}분기`
  const marketDescription = marketType ? MARKET_TYPE_DESCRIPTIONS[marketType.key] : null
  const industryOptions = Object.entries(info?.industries?.[quarterCode] || {})
    .map(([name, row]) => ({ name, code: row?.code ? String(row.code) : '' }))
    .filter((option) => option.code)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const defaultAnalysisIndustryCode = getIndustryCode(processed, quarterCode, dongCode, industry) || ''
  const [analysisIndustryCode, setAnalysisIndustryCode] = useState(defaultAnalysisIndustryCode)
  const [startupFit, setStartupFit] = useState(null)

  useEffect(() => {
    setAnalysisIndustryCode(defaultAnalysisIndustryCode)
  }, [dongCode, quarterCode, defaultAnalysisIndustryCode])

  const analysisIndustry = industryOptions.find((option) => option.code === analysisIndustryCode) || null
  const openSafeSelection = info?.name && analysisIndustry ? {
    dongCode,
    industryCode: analysisIndustry.code,
    dongName: info.name,
    industryName: analysisIndustry.name,
    quarterLabel,
  } : null

  useEffect(() => {
    let active = true
    setStartupFit(null)

    if (!openSafeSelection) return () => { active = false }

    fetch('/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dong_code: String(openSafeSelection.dongCode),
        industry_code: String(openSafeSelection.industryCode),
        dong_name: openSafeSelection.dongName,
        industry_name: openSafeSelection.industryName,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('startup-fit unavailable')
        return response.json()
      })
      .then((data) => {
        if (!active) return
        const score = Number(data?.startup_fit_score ?? data?.fs)
        const label = data?.startup_fit_label ?? data?.fl ?? ''
        if (Number.isFinite(score)) setStartupFit({ score, label })
      })
      .catch(() => {
        if (active) setStartupFit(null)
      })

    return () => { active = false }
  }, [dongCode, analysisIndustryCode])

  return (
    <main className={`detail-workspace ${activeTab === 'comparison' ? 'comparison-workspace' : ''}`}>
      <div className="detail-workspace-layout">
        <aside className={`dashboard-summary ${activeTab === 'comparison' ? 'comparison-summary-hidden' : ''}`}>
          <button type="button" className="dashboard-breadcrumb" onClick={onReturnToMap}>← 상권 지도 <span>/ {info?.name} 상세 분석</span></button>
          <div className="dashboard-region-heading">
            <span>지역 분석 / {getDongDisplayIndex(processed, dongCode)}</span>
            <h2>{info?.name || '행정동 정보 없음'}</h2>
            <p>{getDistrictName(dongCode)} · {quarterLabel} · {industry}</p>
          </div>

          <section className="dashboard-summary-section market-summary-section">
            <h3>시장 유형</h3>
            <strong>{sampleInsufficient ? '표본 부족' : marketType?.label || '분류 데이터 없음'}</strong>
            <p>{sampleInsufficient ? `점포 수 ${MIN_STORE_COUNT}개 미만으로 시장 유형을 분류하지 않습니다.` : marketDescription}</p>
          </section>

          <section className="dashboard-summary-section">
            <h3>서울 평균 비교</h3>
            <SummaryComparison stats={stats} averages={marketData.averages} />
          </section>

          <section className="dashboard-summary-section dashboard-core-section">
            <h3>핵심 개폐업 지표</h3>
            {stats ? (
              <>
                <div className="dashboard-core-metrics">
                  <div><span>폐업 점포</span><strong>{formatNumber(closed, '개')}</strong></div>
                  <div><span>개업 점포</span><strong>{formatNumber(opened, '개')}</strong></div>
                  <div><span>순증감</span><strong className={netOpenClose < 0 ? 'negative' : netOpenClose > 0 ? 'positive' : ''}>{`${netOpenClose > 0 ? '+' : ''}${formatNumber(netOpenClose, '개')}`}</strong></div>
                </div>
                <p>전체 점포 {formatNumber(stats['점포_수'], '개')} · 개업 건수 - 폐업 건수</p>
              </>
            ) : <p className="dashboard-empty">선택 조건의 지표 데이터가 없습니다.</p>}
          </section>
        </aside>

        <section className="dashboard-detail-container">
          <div className="dashboard-detail-heading">
            <span>상세 분석</span>
            <h2>{activeTab === 'market' ? '시장 진단' : activeTab === 'map-analysis' ? '지도 분석' : '지역 비교'}</h2>
            <p>{activeTab === 'market'
              ? '상권 위치, 시장 유형과 최근 개폐업 흐름을 함께 읽습니다.'
              : activeTab === 'map-analysis'
                ? '선택한 행정동과 업종의 12개월 운영 시나리오 및 근거 기반 창업 코치를 확인합니다.'
                : '현재 지역과 다른 행정동을 같은 업종 기준으로 나란히 비교합니다.'}</p>
          </div>
          <div className="dashboard-tabs" role="tablist" aria-label="상세 분석 탭">
            <button type="button" role="tab" aria-selected={activeTab === 'market'} className={activeTab === 'market' ? 'active' : ''} onClick={() => setActiveTab('market')}>시장 진단</button>
            <button type="button" role="tab" aria-selected={activeTab === 'map-analysis'} className={activeTab === 'map-analysis' ? 'active' : ''} onClick={() => setActiveTab('map-analysis')}>지도 분석</button>
            <button type="button" role="tab" aria-selected={activeTab === 'comparison'} className={activeTab === 'comparison' ? 'active' : ''} onClick={() => setActiveTab('comparison')}>지역 비교</button>
          </div>

          <div className="dashboard-tab-panel" role="tabpanel">
          {activeTab === 'market' ? <div className="dashboard-analysis-grid">
            <section className="dashboard-analysis-cell dashboard-market-cell">
              <div className="dashboard-cell-heading"><h3>시장 내 위치</h3><span>개업률 × 폐업률</span></div>
              {sampleInsufficient ? <p className="dashboard-empty">표본 부족으로 시장 위치를 표시할 수 없습니다.</p> : marketType ? <MarketQuadrant marketType={marketType} averages={marketData.averages} points={marketData.points} selectedDongCode={dongCode} selectedDongName={info?.name} /> : <p className="dashboard-empty">시장 위치 데이터가 없습니다.</p>}
            </section>

            <section className="dashboard-analysis-cell dashboard-type-cell">
              <div className="dashboard-cell-heading"><h3>안정성 × 시장 진입 4분면</h3><span>서울 평균 기준</span></div>
              <MarketTypeGrid marketType={marketType} distribution={marketData.distribution} />
              <p className="dashboard-type-note">{marketDescription || '시장 유형을 판단할 데이터가 없습니다.'}</p>
            </section>

            <section className="dashboard-analysis-cell dashboard-trend-cell">
              <div className="dashboard-cell-heading"><h3>분기별 변화</h3><span>2025년 1~4분기</span></div>
              <div className="dashboard-trend-charts">
                <div className="dashboard-mini-trend"><strong>폐업률</strong><ClosureTrendChart data={trend} /></div>
                <div className="dashboard-mini-trend"><strong>개업률</strong><ClosureTrendChart data={trend} valueKey="openRate" metricLabel="개업률" /></div>
              </div>
              {trendSummary && <p className={`dashboard-trend-insight ${trendSummary.direction}`}>{trendSummary.text}</p>}
            </section>

            <section className="dashboard-analysis-cell dashboard-basis-cell">
              <div className="dashboard-cell-heading"><h3>시장 진단 근거</h3><span>실제 개폐업 지표</span></div>
              {marketType && marketData.averages ? (
                <div className="dashboard-diagnosis-list">
                  <div><span>현재 시장 유형</span><strong>{marketType.label}</strong></div>
                  <div><span>창업 적합도</span><strong>{startupFit ? `${startupFit.score.toFixed(0)}점${startupFit.label ? ` · ${startupFit.label}` : ''}` : '분석 데이터 없음'}</strong></div>
                  <div><span>서울 평균 대비 개업률</span><strong className={marketType.openDifference >= 0 ? 'positive' : 'negative'}>{marketType.openDifference > 0 ? '+' : ''}{marketType.openDifference.toFixed(2)}%p</strong></div>
                  <div><span>서울 평균 대비 폐업률</span><strong className={marketType.closureDifference > 0 ? 'negative' : 'positive'}>{marketType.closureDifference > 0 ? '+' : ''}{marketType.closureDifference.toFixed(2)}%p</strong></div>
                </div>
              ) : <p className="dashboard-empty">시장 진단 근거 데이터가 없습니다.</p>}
              <p className="dashboard-diagnosis-note">시장 유형은 실제 개업률·폐업률과 서울 평균을 기준으로 판단하며, 창업 적합도는 해당 행정동·업종의 AI 분석 데이터가 있을 때 함께 표시합니다.</p>
            </section>
          </div> : activeTab === 'map-analysis' ? <OpenSafeAnalysis
            selection={openSafeSelection}
            industryOptions={industryOptions}
            selectedIndustryCode={analysisIndustryCode}
            onIndustryChange={setAnalysisIndustryCode}
          /> : <ComparisonAnalysis
            baseDongCode={dongCode}
            processed={processed}
            initialIndustry={industry}
          />}
          </div>
        </section>
      </div>
    </main>
  )
}
