import { useCallback, useEffect, useState } from 'react'
import {
  buildOpenSafePayload,
  DEFAULT_OPENSAFE_INPUTS,
  fetchOpenSafeCoach,
  fetchOpenSafeScenario,
} from '../services/openSafeApi'

function formatNumber(value, suffix = '') {
  return Number.isFinite(value) ? `${Math.round(value).toLocaleString('ko-KR')}${suffix}` : '-'
}

function formatSigned(value, suffix = '') {
  if (!Number.isFinite(value)) return '-'
  return `${value > 0 ? '+' : ''}${Math.round(value).toLocaleString('ko-KR')}${suffix}`
}

function InputField({ label, name, value, min, max, step = 1, suffix, onChange }) {
  return (
    <label className="opensafe-input-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          name={name}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
        />
        <em>{suffix}</em>
      </div>
    </label>
  )
}

function ScenarioLoading() {
  return (
    <div className="opensafe-loading" role="status">
      <span className="loading-spinner" />
      선택한 행정동·업종 기준으로 운영 시나리오와 코칭 근거를 계산하고 있습니다.
    </div>
  )
}

function ScenarioResult({ scenario }) {
  const market = scenario.market
  const calculation = scenario.scenario
  const resilience = scenario.resilience
  const stress = calculation.market_stress

  return (
    <>
      <section className="opensafe-result-summary" aria-label="12개월 운영 시나리오 요약">
        <div className="opensafe-score-card">
          <span>12개월 운영 여력</span>
          <strong>{formatNumber(resilience.score, '점')}</strong>
          <b>{resilience.label}</b>
          <small>{market.dong} · {market.industry}</small>
        </div>
        <div className="opensafe-result-metrics">
          <div><span>월 예상 매출</span><strong>{formatNumber(calculation.monthly_revenue_manwon, '만 원')}</strong></div>
          <div><span>월 영업손익</span><strong className={calculation.monthly_profit_manwon < 0 ? 'negative' : 'positive'}>{formatSigned(calculation.monthly_profit_manwon, '만 원')}</strong></div>
          <div><span>12개월 영업손익</span><strong className={calculation.annual_operating_profit_manwon < 0 ? 'negative' : 'positive'}>{formatSigned(calculation.annual_operating_profit_manwon, '만 원')}</strong></div>
          <div><span>투자금 회수 예상</span><strong>{calculation.investment_payback_months == null ? '회수 어려움' : `${calculation.investment_payback_months}개월`}</strong></div>
        </div>
      </section>

      <section className="opensafe-detail-grid" aria-label="운영 시나리오 상세">
        <article>
          <h4>손익분기 기준</h4>
          <dl>
            <div><dt>월 손익분기 매출</dt><dd>{formatNumber(calculation.break_even_revenue_manwon, '만 원')}</dd></div>
            <div><dt>일 평균 결제 건수</dt><dd>{Number.isFinite(calculation.transactions_per_day) ? `${calculation.transactions_per_day.toLocaleString('ko-KR')}건` : '-'}</dd></div>
            <div><dt>손익분기 일 결제 건수</dt><dd>{Number.isFinite(calculation.break_even_transactions_per_day) ? `${calculation.break_even_transactions_per_day.toLocaleString('ko-KR')}건` : '-'}</dd></div>
            <div><dt>매출 보완 필요</dt><dd>{Number.isFinite(calculation.required_revenue_change_percent) ? `${calculation.required_revenue_change_percent > 0 ? '+' : ''}${calculation.required_revenue_change_percent}%` : '-'}</dd></div>
          </dl>
        </article>
        <article className="opensafe-stress-card">
          <h4>시장 위치 보수 시나리오</h4>
          <p>{stress.quadrant} · 기본 가정에서 {stress.additional_stress_percent}%p를 추가 반영했습니다.</p>
          <dl>
            <div><dt>보수 월매출</dt><dd>{formatNumber(stress.monthly_revenue_manwon, '만 원')}</dd></div>
            <div><dt>보수 월손익</dt><dd className={stress.monthly_profit_manwon < 0 ? 'negative' : 'positive'}>{formatSigned(stress.monthly_profit_manwon, '만 원')}</dd></div>
            <div><dt>적자 시 버틸 기간</dt><dd>{stress.runway_months == null ? '흑자 가정' : `${stress.runway_months}개월`}</dd></div>
          </dl>
          <small>{stress.field_check}</small>
        </article>
      </section>
      <p className="opensafe-disclaimer">{scenario.disclaimer}</p>
    </>
  )
}

function CoachResult({ coach }) {
  return (
    <section className="opensafe-coach-result" aria-label="근거 기반 창업 코치 결과">
      <div className="opensafe-coach-lead">
        <span>근거 기반 창업 코치</span>
        <h3>{coach.summary}</h3>
        <p>{coach.decision}</p>
        {coach.notice && <small>{coach.notice}</small>}
      </div>

      <div className="opensafe-evidence-list">
        <h4>판단 근거</h4>
        {coach.evidence?.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.interpretation}</p>
          </div>
        ))}
      </div>

      <div className="opensafe-coach-columns">
        <section>
          <h4>우선 실행 항목</h4>
          <ol>
            {coach.priorities?.map((item) => (
              <li key={item.title}><strong>{item.title}</strong><span>{item.why}</span><p>{item.action}</p></li>
            ))}
          </ol>
        </section>
        <section>
          <h4>계약 전 현장 확인</h4>
          <ul>
            {coach.field_checks?.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
      <p className="opensafe-caution">{coach.caution}</p>
    </section>
  )
}

export default function OpenSafeAnalysis({ selection }) {
  const [inputs, setInputs] = useState(DEFAULT_OPENSAFE_INPUTS)
  const [scenario, setScenario] = useState(null)
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadAnalysis = useCallback(async (nextInputs = inputs, signal) => {
    if (!selection) {
      setScenario(null)
      setCoach(null)
      setError('지도에서 행정동을 선택하고, 상단에서 전체 업종이 아닌 업종을 선택해주세요.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const payload = buildOpenSafePayload(selection, nextInputs)
      const [nextScenario, nextCoach] = await Promise.all([
        fetchOpenSafeScenario(payload, signal),
        fetchOpenSafeCoach(payload, signal),
      ])
      if (signal?.aborted) return
      setScenario(nextScenario)
      setCoach(nextCoach)
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setScenario(null)
        setCoach(null)
        setError(requestError.message || 'AI 분석 결과를 불러오지 못했습니다.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [inputs, selection])

  // 행정동·업종 코드가 바뀔 때만 기본 가정으로 자동 분석한다.
  const selectionKey = selection ? `${selection.dongCode}:${selection.industryCode}` : 'empty'
  useEffect(() => {
    const controller = new AbortController()
    loadAnalysis(inputs, controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setInputs((current) => ({ ...current, [name]: value === '' ? '' : Number(value) }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    loadAnalysis(inputs)
  }

  return (
    <div className="opensafe-analysis">
      <div className="opensafe-heading">
        <div><span>AI 창업 분석</span><h2>12개월 운영 시나리오</h2><p>{selection ? `${selection.dongName} · ${selection.industryName} · ${selection.quarterLabel}` : '분석할 행정동과 업종을 먼저 선택해주세요.'}</p></div>
      </div>

      <form className="opensafe-inputs" onSubmit={handleSubmit}>
        <div className="opensafe-inputs-heading"><strong>운영 가정</strong><span>금액은 만 원 단위이며, 다시 계산하면 두 AI 결과에 함께 반영됩니다.</span></div>
        <div className="opensafe-input-grid">
          <InputField label="월 임대료" name="rent_manwon" value={inputs.rent_manwon} min="0" max="20000" suffix="만 원" onChange={handleInputChange} />
          <InputField label="기타 고정비" name="other_fixed_manwon" value={inputs.other_fixed_manwon} min="0" max="20000" suffix="만 원" onChange={handleInputChange} />
          <InputField label="변동비율" name="variable_cost_rate" value={inputs.variable_cost_rate} min="1" max="95" suffix="%" onChange={handleInputChange} />
          <InputField label="객단가" name="basket_won" value={inputs.basket_won} min="1000" max="1000000" step="100" suffix="원" onChange={handleInputChange} />
          <InputField label="월 영업일" name="operating_days" value={inputs.operating_days} min="1" max="31" suffix="일" onChange={handleInputChange} />
          <InputField label="매출 조정" name="sales_adjustment" value={inputs.sales_adjustment} min="-50" max="50" suffix="%" onChange={handleInputChange} />
          <InputField label="운영 예비자금" name="startup_budget_manwon" value={inputs.startup_budget_manwon} min="0" max="500000" suffix="만 원" onChange={handleInputChange} />
          <InputField label="초기 투자금" name="initial_investment_manwon" value={inputs.initial_investment_manwon} min="0" max="1000000" suffix="만 원" onChange={handleInputChange} />
        </div>
        <button type="submit" className="opensafe-recalculate" disabled={!selection || loading}>{loading ? '분석 중...' : '가정값으로 다시 계산'}</button>
      </form>

      {loading && <ScenarioLoading />}
      {!loading && error && <div className="opensafe-error" role="alert">{error}</div>}
      {!loading && scenario && <ScenarioResult scenario={scenario} />}
      {!loading && coach && <CoachResult coach={coach} />}
    </div>
  )
}
