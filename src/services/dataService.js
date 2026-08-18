import { ALL_INDUSTRIES, getDongStats, getPreviousQuarter } from '../utils/dataProcessor'

export function normalizeKey(value) {
  return String(value ?? '').trim()
}

export function calculateChangeRate(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function warnJoin(message, details) {
  if (import.meta.env.DEV) console.warn(`[dataService] ${message}`, details)
}

export function getIndustryCode(processed, quarterCode, dongCode, industryName) {
  if (!industryName || industryName === ALL_INDUSTRIES) return null
  const stats = processed?.[normalizeKey(dongCode)]?.industries?.[normalizeKey(quarterCode)]?.[industryName]
  if (stats && !stats.code) warnJoin('점포 업종 코드가 없습니다.', { quarterCode, dongCode, industryName })
  return stats?.code || null
}

function getSalesRecord(context, quarterCode, dongCode, industryCode) {
  const byIndustry = context?.sales?.[normalizeKey(quarterCode)]?.[normalizeKey(dongCode)]
  if (!byIndustry) return null
  if (industryCode) return byIndustry[normalizeKey(industryCode)] || null

  const records = Object.values(byIndustry)
  if (!records.length) return null
  const amounts = records.map((record) => record.amount).filter(Number.isFinite)
  const counts = records.map((record) => record.count).filter(Number.isFinite)
  return {
    amount: amounts.length ? amounts.reduce((sum, value) => sum + value, 0) : null,
    count: counts.length ? counts.reduce((sum, value) => sum + value, 0) : null,
  }
}

export function getSalesStats(context, processed, quarterCode, dongCode, industryName) {
  if (!context) return null
  const industryCode = getIndustryCode(processed, quarterCode, dongCode, industryName)
  if (industryName !== ALL_INDUSTRIES && !industryCode) return null
  const current = getSalesRecord(context, quarterCode, dongCode, industryCode)
  if (!current) return null
  const previous = getSalesRecord(
    context,
    getPreviousQuarter(quarterCode),
    dongCode,
    industryCode,
  )
  return {
    amount: current.amount,
    count: current.count,
    changeRate: calculateChangeRate(current.amount, previous?.amount),
    previousAmount: previous?.amount ?? null,
    coverage: industryName === ALL_INDUSTRIES ? 'provided-industries' : 'selected-industry',
  }
}

export function getPopulationStats(context, quarterCode, dongCode) {
  if (!context) return null
  const quarter = normalizeKey(quarterCode)
  const dong = normalizeKey(dongCode)
  const current = context.floatingPopulation?.[quarter]?.[dong]
  if (!current) {
    warnJoin('유동인구 JOIN 결과가 없습니다.', { quarterCode, dongCode })
    return null
  }
  const previous = context.floatingPopulation?.[getPreviousQuarter(quarter)]?.[dong]
  return {
    total: current.total,
    changeRate: calculateChangeRate(current.total, previous?.total),
    details: current.details,
  }
}

export function getResidentPopulation(context, quarterCode, dongCode) {
  if (!context) return null
  const current = context.residentPopulation?.[normalizeKey(quarterCode)]?.[normalizeKey(dongCode)]
  if (!current) {
    warnJoin('상주인구 JOIN 결과가 없습니다.', { quarterCode, dongCode })
    return null
  }
  return current
}

export function getMarketContext(context, processed, quarterCode, dongCode, industryName) {
  // Sales follows the selected service industry. Population datasets have no industry dimension.
  return {
    store: getDongStats(processed?.[normalizeKey(dongCode)], quarterCode, industryName),
    sales: getSalesStats(context, processed, quarterCode, dongCode, industryName),
    floatingPopulation: getPopulationStats(context, quarterCode, dongCode),
    residentPopulation: getResidentPopulation(context, quarterCode, dongCode),
  }
}

export function buildFactSummary(stats, averages, sales, floatingPopulation, trendSummary = null) {
  const facts = []
  if (stats && averages) {
    const closureDifference = stats['폐업_률'] - averages.closureRate
    const openDifference = stats['개업_률'] - averages.openRate
    facts.push(`폐업률이 서울 기준보다 ${Math.abs(closureDifference).toFixed(2)}%p ${closureDifference >= 0 ? '높습니다' : '낮습니다'}.`)
    facts.push(`개업률이 서울 기준보다 ${Math.abs(openDifference).toFixed(2)}%p ${openDifference >= 0 ? '높습니다' : '낮습니다'}.`)
  }
  if (trendSummary) facts.push(trendSummary.text)
  if (Number.isFinite(sales?.changeRate)) {
    facts.push(`분기 추정매출이 전분기 대비 ${Math.abs(sales.changeRate).toFixed(1)}% ${sales.changeRate >= 0 ? '증가했습니다' : '감소했습니다'}.`)
  }
  if (Number.isFinite(floatingPopulation?.changeRate)) {
    facts.push(`총 유동인구가 전분기 대비 ${Math.abs(floatingPopulation.changeRate).toFixed(1)}% ${floatingPopulation.changeRate >= 0 ? '증가했습니다' : '감소했습니다'}.`)
  }
  return facts
}
