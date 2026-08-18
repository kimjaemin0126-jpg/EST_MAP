import { useEffect, useMemo, useState } from 'react'
import {
  ALL_INDUSTRIES,
  getDistrictName,
  getDongStats,
  getMarketTypeData,
  quarterLabelToCode,
} from '../utils/dataProcessor'

const DEFAULT_INPUTS = Object.freeze({
  rent_manwon: 250,
  other_fixed_manwon: 350,
  variable_cost_rate: 35,
  basket_won: 9000,
  operating_days: 26,
  sales_adjustment: 0,
  startup_budget_manwon: 8000,
  initial_investment_manwon: 15000,
})

const INPUT_FIELDS = [
  { name: 'rent_manwon', label: '월 임대료', unit: '만 원', min: 0, max: 20000 },
  { name: 'other_fixed_manwon', label: '기타 월 고정비', unit: '만 원', min: 0, max: 20000 },
  { name: 'variable_cost_rate', label: '변동비율', unit: '%', min: 1, max: 95 },
  { name: 'basket_won', label: '예상 객단가', unit: '원', min: 1000, max: 1000000 },
  { name: 'operating_days', label: '월 영업일', unit: '일', min: 1, max: 31 },
  { name: 'sales_adjustment', label: '평균 대비 매출 조정', unit: '%', min: -50, max: 50 },
  { name: 'startup_budget_manwon', label: '초기 운영자금', unit: '만 원', min: 0, max: 500000 },
  { name: 'initial_investment_manwon', label: '회수 대상 초기 투자비', unit: '만 원', min: 0, max: 1000000 },
]

const numberFormat = new Intl.NumberFormat('ko-KR')

function manwon(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `${numberFormat.format(amount)}만 원` : '-'
}

function months(value, emptyLabel) {
  return value == null ? emptyLabel : `${Number(value).toFixed(1)}개월`
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(`분석 API가 JSON이 아닌 응답을 반환했습니다. (${response.status})`)
  }
  const data = await response.json().catch(() => {
    throw new Error('분석 API의 JSON 응답을 해석하지 못했습니다.')
  })
  if (!response.ok) throw new Error(data?.error || '분석 서버의 응답을 확인하지 못했습니다.')
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('분석 API의 응답 구조가 올바르지 않습니다.')
  }
  return data
}

function ScenarioResult({ data }) {
  const { resilience, scenario } = data
  const stress = scenario.market_stress
  const metrics = [
    ['기본 예상 월매출', manwon(scenario.monthly_revenue_manwon)],
    ['기본 시나리오 월 손익', manwon(scenario.monthly_profit_manwon)],
    ['손익분기 월매출', manwon(scenario.break_even_revenue_manwon)],
    ['12개월 환산 영업손익', manwon(scenario.annual_operating_profit_manwon)],
    ['현재 / 손익분기 일 거래', `${scenario.transactions_per_day.toFixed(1)} / ${scenario.break_even_transactions_per_day.toFixed(1)}건`],
    ['손익분기까지 매출 변화', `${scenario.required_revenue_change_percent >= 0 ? '+' : ''}${scenario.required_revenue_change_percent.toFixed(1)}%`],
    ['초기 투자비 회수기간', months(scenario.investment_payback_months, '흑자 전환 필요')],
    ['적자 시 운영자금 여력', months(scenario.runway_months, '월 흑자 가정')],
  ]

  return (
    <div className="scenario-result-content">
      <div className="scenario-score-row">
        <div><span>12개월 운영 여력</span><strong>{resilience.score}<small>/ 100</small></strong></div>
        <em className={resilience.score >= 60 ? 'positive' : resilience.score >= 40 ? 'caution' : 'negative'}>{resilience.label}</em>
      </div>
      <div className="scenario-metric-grid">
        {metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="scenario-stress-box">
        <h4>4분면 기반 보수 시나리오 · {stress.quadrant}</h4>
        <p>{stress.interpretation}</p>
        <p>기본 가정에서 {stress.additional_stress_percent}%p를 추가 조정하면 월 손익은 <strong>{manwon(stress.monthly_profit_manwon)}</strong>입니다.</p>
        <p><b>현장 확인</b> {stress.field_check}</p>
      </div>
      <p className="scenario-disclaimer">{data.disclaimer}</p>
    </div>
  )
}

function CoachResult({ data }) {
  const source = data.source === 'gemini' ? `Gemini 코치 · ${data.model || 'Gemini'}` : '규칙 기반 코치'
  return (
    <div className="coach-result-content">
      <span className="coach-source">{source}</span>
      <h4>{data.summary}</h4>
      <p>{data.decision}</p>
      {data.notice && <p className="coach-notice">{data.notice}</p>}
      <div className="coach-result-grid">
        <div>
          <h5>판단 근거</h5>
          <ul>{data.evidence.map((item) => <li key={`${item.label}-${item.value}`}><strong>{item.label} · {item.value}</strong><span>{item.interpretation}</span></li>)}</ul>
          <h5>현장 확인</h5>
          <ul className="coach-check-list">{data.field_checks.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h5>우선 실행</h5>
          {data.priorities.map((item) => <article key={item.title}><strong>{item.title}</strong><p>{item.why}</p><p><b>실행</b> {item.action}</p></article>)}
        </div>
      </div>
      <p className="scenario-disclaimer">{data.caution}</p>
    </div>
  )
}

export default function ScenarioCoachSection({
  dongCode,
  quarter,
  industry,
  industries,
  onIndustryChange,
  onReturnToDetail,
  processed,
}) {
  const [inputs, setInputs] = useState({ ...DEFAULT_INPUTS })
  const [scenario, setScenario] = useState(null)
  const [coach, setCoach] = useState(null)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const [lastFailedAction, setLastFailedAction] = useState(null)
  const quarterCode = quarterLabelToCode(quarter)
  const info = processed?.[dongCode]
  const stats = getDongStats(info, quarterCode, industry)
  const marketData = getMarketTypeData(processed, quarterCode, industry)
  const marketType = marketData.points.find((point) => point.code === dongCode) || null
  const quarterLabel = `${quarterCode.slice(0, 4)}년 ${quarterCode.slice(4)}분기`
  const industryCode = useMemo(
    () => processed?.[dongCode]?.industries?.[quarterCode]?.[industry]?.code || null,
    [dongCode, industry, processed, quarterCode],
  )

  useEffect(() => {
    setScenario(null)
    setCoach(null)
    setError('')
    setLastFailedAction(null)
  }, [dongCode, industry, quarterCode])

  const availabilityMessage = industry === ALL_INDUSTRIES
    ? '운영 시나리오는 업종별 시장 데이터를 사용합니다. 상단 필터에서 구체 업종을 선택해 주세요.'
    : !industryCode
      ? '선택한 분기의 행정동·업종 코드가 없어 운영 시나리오를 계산할 수 없습니다.'
      : ''

  function requestBody() {
    return { dong_code: String(dongCode), industry_code: industryCode, ...inputs }
  }

  function handleInput(event) {
    const { name, value } = event.target
    setInputs((current) => ({ ...current, [name]: Number(value) }))
    setScenario(null)
    setCoach(null)
    setError('')
  }

  async function requestScenario() {
    setPending('scenario')
    setError('')
    setLastFailedAction(null)
    setCoach(null)
    try {
      setScenario(await postJson('/api/scenario', requestBody()))
    } catch (requestError) {
      setScenario(null)
      setError(requestError.message)
      setLastFailedAction('scenario')
    } finally {
      setPending(null)
    }
  }

  function handleScenario(event) {
    event.preventDefault()
    requestScenario()
  }

  async function handleCoach() {
    setPending('coach')
    setError('')
    setLastFailedAction(null)
    try {
      setCoach(await postJson('/api/coach', requestBody()))
    } catch (requestError) {
      setCoach(null)
      setError(requestError.message)
      setLastFailedAction('coach')
    } finally {
      setPending(null)
    }
  }

  return (
    <main className="analysis-workspace">
      <div className="analysis-workspace-content">
        <button type="button" className="dashboard-breadcrumb" onClick={onReturnToDetail}>← {info?.name || '선택 지역'} 상세 분석</button>

        <div className="analysis-page-heading">
          <span>의사결정 지원</span>
          <h2>지도 분석</h2>
          <p>선택한 지역의 시장 상황과 운영 시나리오를 분석합니다.</p>
        </div>

        <section className="analysis-region-summary" aria-labelledby="analysis-region-title">
          <div>
            <span>선택 지역</span>
            <h3 id="analysis-region-title">{info?.name || '행정동 정보 없음'}</h3>
            <p>{getDistrictName(dongCode)} · {quarterLabel} · {industry}</p>
          </div>
          <div className="analysis-region-context">
            <label>
              <span>분석 업종</span>
              <select value={industry} onChange={(event) => onIndustryChange(event.target.value)}>
                {industries.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <div><span>시장 유형</span><strong>{marketType?.label || '분류 데이터 없음'}</strong></div>
            <div><span>점포 수</span><strong>{Number.isFinite(stats?.['점포_수']) ? `${numberFormat.format(stats['점포_수'])}개` : '-'}</strong></div>
          </div>
        </section>

        <section className="scenario-coach-section" aria-labelledby="scenario-coach-title">
          <div className="scenario-section-heading">
            <span>운영 계획</span>
            <h2 id="scenario-coach-title">12개월 운영 시나리오</h2>
            <p>공개 상권 평균과 비용 가정을 결합해 손익분기 구조를 점검합니다.</p>
          </div>

          {availabilityMessage ? <div className="scenario-availability">{availabilityMessage}</div> : (
            <>
              <div className="scenario-layout">
                <form className="scenario-input-card" onSubmit={handleScenario}>
                  <div className="dashboard-cell-heading"><h3>운영 가정</h3><span>{industry}</span></div>
                  <div className="scenario-form-grid">
                    {INPUT_FIELDS.map((field) => (
                      <label key={field.name}>
                        <span>{field.label}<small>{field.unit}</small></span>
                        <input name={field.name} type="number" min={field.min} max={field.max} value={inputs[field.name]} onChange={handleInput} required />
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="scenario-primary-button" disabled={Boolean(pending)}>{pending === 'scenario' ? '분석 중…' : '시나리오 분석 실행'}</button>
                </form>

                <div className="scenario-output-card" aria-live="polite" aria-busy={pending === 'scenario'}>
                  <div className="dashboard-cell-heading"><h3>시나리오 결과</h3><span>행정동·업종 평균 기준</span></div>
                  {scenario ? <ScenarioResult data={scenario} /> : <p className="scenario-placeholder">운영 가정을 입력한 뒤 분석을 실행하세요.</p>}
                </div>
              </div>

              <div className="coach-card-integrated" aria-live="polite" aria-busy={pending === 'coach'}>
                <div className="coach-card-heading">
                  <div><span>근거 기반 해석</span><h3>AI / 규칙 기반 창업 코치</h3><p>시장·예측·시나리오 수치 안에서 현장 검증과 다음 행동을 제안합니다.</p></div>
                  <button type="button" onClick={handleCoach} disabled={Boolean(pending)}>{pending === 'coach' ? '분석 중…' : 'AI 분석 실행'}</button>
                </div>
                {coach ? <CoachResult data={coach} /> : <p className="scenario-placeholder">현재 운영 가정으로 AI / 규칙 기반 창업 코치를 바로 실행할 수 있습니다.</p>}
              </div>
              {error && (
                <div className="scenario-error" role="alert">
                  <div><strong>{lastFailedAction === 'coach' ? 'AI 분석에 실패했습니다.' : '시나리오 분석에 실패했습니다.'}</strong><span>{error}</span></div>
                  <button type="button" onClick={lastFailedAction === 'coach' ? handleCoach : requestScenario} disabled={Boolean(pending)}>다시 시도</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
