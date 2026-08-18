const DEFAULT_API_BASE = import.meta.env.VITE_OPENSAFE_API_BASE || ''

export const DEFAULT_OPENSAFE_INPUTS = Object.freeze({
  rent_manwon: 250,
  other_fixed_manwon: 350,
  variable_cost_rate: 35,
  basket_won: 9000,
  operating_days: 26,
  sales_adjustment: 0,
  startup_budget_manwon: 8000,
  initial_investment_manwon: 15000,
})

function toFiniteNumber(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function endpoint(path) {
  return `${DEFAULT_API_BASE.replace(/\/$/, '')}${path}`
}

async function postJson(path, payload, signal) {
  const response = await fetch(endpoint(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || `AI 분석 요청에 실패했습니다. (${response.status})`)
  }
  return body
}

export function buildOpenSafePayload(selection, inputs = DEFAULT_OPENSAFE_INPUTS) {
  if (!selection?.dongCode || !selection?.industryCode) {
    throw new Error('행정동과 업종을 모두 선택해야 AI 분석을 실행할 수 있습니다.')
  }

  return {
    dong_code: String(selection.dongCode).trim(),
    industry_code: String(selection.industryCode).trim(),

    // 코드 체계가 분석 데이터와 다를 때 백엔드가 이름으로 재매칭할 수 있도록 함께 전송한다.
    dong_name: String(selection.dongName || '').trim(),
    industry_name: String(selection.industryName || '').trim(),

    rent_manwon: toFiniteNumber(inputs.rent_manwon, DEFAULT_OPENSAFE_INPUTS.rent_manwon),
    other_fixed_manwon: toFiniteNumber(inputs.other_fixed_manwon, DEFAULT_OPENSAFE_INPUTS.other_fixed_manwon),
    variable_cost_rate: toFiniteNumber(inputs.variable_cost_rate, DEFAULT_OPENSAFE_INPUTS.variable_cost_rate),
    basket_won: toFiniteNumber(inputs.basket_won, DEFAULT_OPENSAFE_INPUTS.basket_won),
    operating_days: toFiniteNumber(inputs.operating_days, DEFAULT_OPENSAFE_INPUTS.operating_days),
    sales_adjustment: toFiniteNumber(inputs.sales_adjustment, DEFAULT_OPENSAFE_INPUTS.sales_adjustment),
    startup_budget_manwon: toFiniteNumber(inputs.startup_budget_manwon, DEFAULT_OPENSAFE_INPUTS.startup_budget_manwon),
    initial_investment_manwon: toFiniteNumber(inputs.initial_investment_manwon, DEFAULT_OPENSAFE_INPUTS.initial_investment_manwon),
  }
}

export function fetchOpenSafeScenario(payload, signal) {
  return postJson('/api/scenario', payload, signal)
}

export function fetchOpenSafeCoach(payload, signal) {
  return postJson('/api/coach', payload, signal)
}
