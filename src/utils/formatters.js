function compactValue(value, divisor, maximumFractionDigits = 1) {
  return (value / divisor).toLocaleString('ko-KR', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  })
}

export function formatNumber(value, unit = '') {
  return Number.isFinite(value) ? `${value.toLocaleString('ko-KR')}${unit}` : null
}

export function formatCurrency(value) {
  if (!Number.isFinite(value)) return null
  const absolute = Math.abs(value)
  if (absolute >= 100_000_000) return `${compactValue(value, 100_000_000)}억원`
  if (absolute >= 10_000) return `${compactValue(value, 10_000, absolute < 100_000 ? 1 : 0)}만원`
  return `${value.toLocaleString('ko-KR')}원`
}

export function formatPopulation(value) {
  if (!Number.isFinite(value)) return null
  if (Math.abs(value) >= 10_000) return `${compactValue(value, 10_000)}만 명`
  return `${value.toLocaleString('ko-KR')}명`
}

export function formatPercent(value, digits = 1, includePlus = false) {
  if (!Number.isFinite(value)) return null
  const sign = includePlus && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}
