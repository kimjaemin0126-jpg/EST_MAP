export const ALL_INDUSTRIES = '전체 업종'
export const MIN_STORE_COUNT = 5
export const MIN_DONG_STORE_COUNT = 5
export const TREND_STABLE_THRESHOLD = 0.1

export const ANALYSIS_MODES = {
  CLOSURE_RATE: 'closureRate',
  CLOSURE_CHANGE: 'closureChange',
  NET_OPEN_CLOSE: 'netOpenClose',
  MARKET_TYPE: 'marketType',
}

export const ANALYSIS_MODE_OPTIONS = [
  { value: ANALYSIS_MODES.CLOSURE_RATE, label: '개폐업 현황' },
  { value: ANALYSIS_MODES.CLOSURE_CHANGE, label: '폐업 변화' },
  { value: ANALYSIS_MODES.NET_OPEN_CLOSE, label: '개폐업 순증감' },
  { value: ANALYSIS_MODES.MARKET_TYPE, label: '시장 유형' },
]

export const CLOSURE_LEVELS = [
  { key: 'low', label: '낮음', color: '#86c995' },
  { key: 'normal', label: '보통', color: '#f2cf63' },
  { key: 'caution', label: '주의', color: '#ee944f' },
  { key: 'high', label: '높음', color: '#db5353' },
]

export const MODE_STYLES = {
  [ANALYSIS_MODES.CLOSURE_RATE]: {
    title: '상대적 폐업 수준',
    rankingTitle: '폐업률 높은 지역 TOP 10',
    levels: CLOSURE_LEVELS,
    unit: '%',
  },
  [ANALYSIS_MODES.CLOSURE_CHANGE]: {
    title: '폐업률 변화',
    rankingTitle: '전분기 대비 폐업률 증가폭 TOP 10',
    levels: [
      { key: 'large-down', label: '크게 감소', color: '#5aa57b' },
      { key: 'down', label: '감소', color: '#b5d7a8' },
      { key: 'up', label: '증가', color: '#efad5b' },
      { key: 'large-up', label: '크게 증가', color: '#d9534f' },
    ],
    unit: '%p',
  },
  [ANALYSIS_MODES.NET_OPEN_CLOSE]: {
    title: '개폐업 순증감',
    rankingTitle: '점포 순감소 지역 TOP 10',
    levels: [
      { key: 'large-down', label: '감소', color: '#d9534f' },
      { key: 'down', label: '소폭 감소', color: '#efad5b' },
      { key: 'up', label: '소폭 증가', color: '#b5d7a8' },
      { key: 'large-up', label: '증가', color: '#5aa57b' },
    ],
    unit: '개',
  },
  [ANALYSIS_MODES.MARKET_TYPE]: {
    title: '시장 유형',
    rankingTitle: '시장 유형별 지역 수',
    levels: [
      { key: 'stable', label: '안정 유지형', color: '#69ad85' },
      { key: 'active-entry', label: '진입활발·저폐업형', color: '#4f8fc4' },
      { key: 'high-turnover', label: '고경쟁·고회전형', color: '#df765d' },
      { key: 'low-entry-high-closure', label: '저진입·고폐업형', color: '#9b79a6' },
    ],
    unit: '',
  },
}

export const MARKET_TYPE_DESCRIPTIONS = {
  stable: '개업률과 폐업률이 모두 서울 기준보다 낮은 유형입니다.',
  'active-entry': '개업률은 서울 기준보다 높고 폐업률은 낮은 유형입니다.',
  'high-turnover': '개업률과 폐업률이 모두 서울 기준보다 높은 유형입니다.',
  'low-entry-high-closure': '개업률은 서울 기준보다 낮고 폐업률은 높은 유형입니다.',
}

const SEOUL_DISTRICTS = {
  11110: '종로구', 11140: '중구', 11170: '용산구', 11200: '성동구',
  11215: '광진구', 11230: '동대문구', 11260: '중랑구', 11290: '성북구',
  11305: '강북구', 11320: '도봉구', 11350: '노원구', 11380: '은평구',
  11410: '서대문구', 11440: '마포구', 11470: '양천구', 11500: '강서구',
  11530: '구로구', 11545: '금천구', 11560: '영등포구', 11590: '동작구',
  11620: '관악구', 11650: '서초구', 11680: '강남구', 11710: '송파구',
  11740: '강동구',
}

function finiteNumber(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function quarterLabelToCode(label) {
  if (!label) return null
  if (/^\d{5}$/.test(label)) return label
  const match = label.match(/^(\d{4})\s*Q([1-4])$/)
  return match ? `${match[1]}${match[2]}` : null
}

export function getPreviousQuarter(quarterCode) {
  if (!quarterCode || !/^\d{5}$/.test(quarterCode)) return null
  const year = Number(quarterCode.slice(0, 4))
  const quarter = Number(quarterCode.slice(4))
  return quarter > 1 ? `${year}${quarter - 1}` : `${year - 1}4`
}

export function computeQuantileBuckets(values, buckets = 4) {
  if (!values.length) return []
  const sorted = values.slice().sort((a, b) => a - b)
  const thresholds = []
  for (let i = 1; i < buckets; i += 1) {
    thresholds.push(sorted[Math.min(Math.floor((i * sorted.length) / buckets), sorted.length - 1)])
  }
  return thresholds
}

export function computeAnalysisThresholds(values, mode) {
  if (mode === ANALYSIS_MODES.CLOSURE_RATE) return computeQuantileBuckets(values, 4)
  const negative = values.filter((value) => value < 0).sort((a, b) => a - b)
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b)
  const negativeMedian = negative.length ? negative[Math.floor(negative.length / 2)] : 0
  const positiveMedian = positive.length ? positive[Math.floor(positive.length / 2)] : 0
  return [negativeMedian, 0, positiveMedian]
}

export function getAnalysisLevel(value, thresholds, mode) {
  if (!Number.isFinite(value)) return null
  const levels = MODE_STYLES[mode]?.levels || CLOSURE_LEVELS
  if (value <= thresholds[0]) return levels[0]
  if (value <= thresholds[1]) return levels[1]
  if (value <= thresholds[2]) return levels[2]
  return levels[3]
}

export function getDongStats(item, quarterCode, industry = ALL_INDUSTRIES) {
  if (!item || !quarterCode) return null
  const stats = !industry || industry === ALL_INDUSTRIES
    ? item.quarters?.[quarterCode]
    : item.industries?.[quarterCode]?.[industry]
  if (!stats) return null
  const stores = finiteNumber(stats['점포_수'])
  const closed = finiteNumber(stats['폐업_점포_수'])
  const opened = finiteNumber(stats['개업_점포_수'])
  return {
    '점포_수': stores,
    '폐업_점포_수': closed,
    '개업_점포_수': opened,
    '폐업_률': stores > 0 && closed != null ? (closed / stores) * 100 : null,
    '개업_률': stores > 0 && opened != null ? (opened / stores) * 100 : null,
  }
}

export function getSeoulStoreAverages(processed, quarterCode, industry) {
  let stores = 0
  let opened = 0
  let closed = 0
  Object.values(processed || {}).forEach((item) => {
    const stats = getDongStats(item, quarterCode, industry)
    if (!stats || !Number.isFinite(stats['점포_수']) || !Number.isFinite(stats['개업_점포_수']) || !Number.isFinite(stats['폐업_점포_수'])) return
    stores += stats['점포_수']
    opened += stats['개업_점포_수']
    closed += stats['폐업_점포_수']
  })
  if (!stores) return null
  return {
    openRate: (opened / stores) * 100,
    closureRate: (closed / stores) * 100,
  }
}

export function classifyMarketType(stats, averages, minStores = MIN_STORE_COUNT) {
  if (
    !stats
    || !averages
    || !Number.isFinite(stats['점포_수'])
    || !Number.isFinite(stats['개업_률'])
    || !Number.isFinite(stats['폐업_률'])
    || !Number.isFinite(averages.openRate)
    || !Number.isFinite(averages.closureRate)
    || stats['점포_수'] < minStores
  ) return null
  const openRate = stats['개업_률']
  const closureRate = stats['폐업_률']
  const highOpen = openRate >= averages.openRate
  const highClosure = closureRate >= averages.closureRate
  const types = {
    'true-true': { key: 'high-turnover', label: '고경쟁·고회전형' },
    'true-false': { key: 'active-entry', label: '진입활발·저폐업형' },
    'false-true': { key: 'low-entry-high-closure', label: '저진입·고폐업형' },
    'false-false': { key: 'stable', label: '안정 유지형' },
  }
  const type = types[`${highOpen}-${highClosure}`]
  return {
    ...type,
    openRate,
    closureRate,
    openDifference: openRate - averages.openRate,
    closureDifference: closureRate - averages.closureRate,
  }
}

export function getMarketTypeData(processed, quarterCode, industry) {
  const averages = getSeoulStoreAverages(processed, quarterCode, industry)
  if (!averages) return { averages: null, points: [], distribution: {} }
  const points = Object.entries(processed || {}).flatMap(([code, item]) => {
    const stats = getDongStats(item, quarterCode, industry)
    const type = classifyMarketType(stats, averages)
    if (!type) return []
    return [{ code, name: item.name, ...type }]
  })
  const distribution = Object.fromEntries(
    MODE_STYLES[ANALYSIS_MODES.MARKET_TYPE].levels.map((level) => [level.key, 0]),
  )
  points.forEach((point) => { distribution[point.key] += 1 })
  return { averages, points, distribution }
}

export function calculateClosureRateChange(item, quarterCode, industry = ALL_INDUSTRIES) {
  const current = getDongStats(item, quarterCode, industry)
  const previous = getDongStats(item, getPreviousQuarter(quarterCode), industry)
  if (!Number.isFinite(current?.['폐업_률']) || !Number.isFinite(previous?.['폐업_률'])) return null
  return current['폐업_률'] - previous['폐업_률']
}

export function calculateNetOpenClose(item, quarterCode, industry = ALL_INDUSTRIES) {
  const stats = getDongStats(item, quarterCode, industry)
  if (!Number.isFinite(stats?.['개업_점포_수']) || !Number.isFinite(stats?.['폐업_점포_수'])) return null
  return stats['개업_점포_수'] - stats['폐업_점포_수']
}

export function getAnalysisValue(item, quarterCode, industry, mode) {
  if (mode === ANALYSIS_MODES.CLOSURE_CHANGE) {
    return calculateClosureRateChange(item, quarterCode, industry)
  }
  if (mode === ANALYSIS_MODES.NET_OPEN_CLOSE) {
    return calculateNetOpenClose(item, quarterCode, industry)
  }
  if (mode === ANALYSIS_MODES.MARKET_TYPE) return null
  return getDongStats(item, quarterCode, industry)?.['폐업_률'] ?? null
}

export function getAnalysisDataset(processed, quarterCode, industry, mode) {
  return Object.entries(processed || {}).map(([code, item]) => ({
    code,
    name: item.name,
    stores: getDongStats(item, quarterCode, industry)?.['점포_수'] ?? 0,
    value: getAnalysisValue(item, quarterCode, industry, mode),
  }))
}

export function getDongRanking(
  processed,
  quarterCode,
  industry,
  mode,
  limit = 10,
  minStores = MIN_DONG_STORE_COUNT,
) {
  const rows = getAnalysisDataset(processed, quarterCode, industry, mode)
    .filter((row) => Number.isFinite(row.value) && row.stores >= minStores)

  if (mode === ANALYSIS_MODES.CLOSURE_CHANGE) {
    return rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, limit)
  }
  if (mode === ANALYSIS_MODES.NET_OPEN_CLOSE) {
    return rows.filter((row) => row.value < 0).sort((a, b) => a.value - b.value).slice(0, limit)
  }
  return rows.sort((a, b) => b.value - a.value).slice(0, limit)
}

export function formatAnalysisValue(value, mode, includePlus = true) {
  if (!Number.isFinite(value)) return '-'
  const sign = includePlus && value > 0 ? '+' : ''
  if (mode === ANALYSIS_MODES.CLOSURE_CHANGE) return `${sign}${value.toFixed(2)}%p`
  if (mode === ANALYSIS_MODES.NET_OPEN_CLOSE) return `${sign}${Math.round(value).toLocaleString('ko-KR')}개`
  return `${value.toFixed(2)}%`
}

export function formatLegendBoundary(value, mode) {
  if (!Number.isFinite(value)) return '-'
  if (mode === ANALYSIS_MODES.NET_OPEN_CLOSE) return `${Math.round(value)}개`
  return `${value.toFixed(1)}${mode === ANALYSIS_MODES.CLOSURE_CHANGE ? '%p' : '%'}`
}

export function getQuarterlyTrend(item, industry = ALL_INDUSTRIES, year = 2025) {
  return [1, 2, 3, 4].map((quarter) => {
    const quarterCode = `${year}${quarter}`
    const stats = getDongStats(item, quarterCode, industry)
    return {
      quarterCode,
      label: `${year}년 ${quarter}분기`,
      shortLabel: `${quarter}분기`,
      rate: stats?.['폐업_률'] ?? null,
      openRate: stats?.['개업_률'] ?? null,
    }
  })
}

export function generateTrendSummary(trend, threshold = TREND_STABLE_THRESHOLD) {
  const available = trend.filter((point) => Number.isFinite(point.rate))
  if (available.length < 2) return null
  const lastThree = available.slice(-3)
  const consecutiveThree = lastThree.length === 3
    && getPreviousQuarter(lastThree[1].quarterCode) === lastThree[0].quarterCode
    && getPreviousQuarter(lastThree[2].quarterCode) === lastThree[1].quarterCode
  if (consecutiveThree && lastThree[1].rate > lastThree[0].rate && lastThree[2].rate > lastThree[1].rate) {
    return { direction: 'up', text: '최근 3분기 연속 폐업률이 상승하고 있습니다.' }
  }
  if (getPreviousQuarter(available.at(-1).quarterCode) !== available.at(-2).quarterCode) return null
  const change = available.at(-1).rate - available.at(-2).rate
  if (Math.abs(change) < threshold) {
    return { direction: 'steady', text: '최근 폐업률이 비슷한 수준을 유지하고 있습니다.' }
  }
  return change > 0
    ? { direction: 'up', text: `전분기 대비 폐업률이 ${change.toFixed(2)}%p 상승했습니다.` }
    : { direction: 'down', text: `전분기 대비 폐업률이 ${Math.abs(change).toFixed(2)}%p 감소했습니다.` }
}

export function getSeoulAverage(processed, quarterCode, industry) {
  let stores = 0
  let closed = 0
  Object.values(processed || {}).forEach((item) => {
    const stats = getDongStats(item, quarterCode, industry)
    if (!stats || !Number.isFinite(stats['점포_수']) || !Number.isFinite(stats['폐업_점포_수'])) return
    stores += stats['점포_수']
    closed += stats['폐업_점포_수']
  })
  return stores ? (closed / stores) * 100 : null
}

export function getDistrictNames(processed) {
  return Array.from(new Set(
    Object.keys(processed || {}).map((dongCode) => getDistrictName(dongCode)),
  )).filter((name) => name !== '서울특별시')
}

export function getDistrictStats(processed, districtName, quarterCode, industry = ALL_INDUSTRIES) {
  let stores = 0
  let closed = 0
  let opened = 0
  let hasOpened = false

  Object.entries(processed || {}).forEach(([dongCode, item]) => {
    if (getDistrictName(dongCode) !== districtName) return
    const stats = getDongStats(item, quarterCode, industry)
    if (!stats) return
    stores += Number(stats['점포_수']) || 0
    closed += Number(stats['폐업_점포_수']) || 0
    if (Number.isFinite(stats['개업_점포_수'])) {
      opened += Number(stats['개업_점포_수'])
      hasOpened = true
    }
  })

  if (!stores && !closed) return null
  return {
    '점포_수': stores,
    '폐업_점포_수': closed,
    '개업_점포_수': hasOpened ? opened : null,
    '폐업_률': stores ? (closed / stores) * 100 : 0,
  }
}

export function getDistrictIndustryStats(processed, districtName, quarterCode) {
  const result = {}
  Object.entries(processed || {}).forEach(([dongCode, item]) => {
    if (getDistrictName(dongCode) !== districtName) return
    Object.entries(item.industries?.[quarterCode] || {}).forEach(([name, stats]) => {
      if (!result[name]) result[name] = { '점포_수': 0, '폐업_점포_수': 0 }
      result[name]['점포_수'] += Number(stats['점포_수']) || 0
      result[name]['폐업_점포_수'] += Number(stats['폐업_점포_수']) || 0
    })
  })
  return result
}

export function getIndustryNames(processed) {
  const names = new Set()
  Object.values(processed || {}).forEach((item) => {
    Object.values(item.industries || {}).forEach((industries) => {
      Object.keys(industries).forEach((name) => names.add(name))
    })
  })
  return [ALL_INDUSTRIES, ...Array.from(names).sort((a, b) => a.localeCompare(b, 'ko'))]
}

export function topIndustries(industryStats, minStores = MIN_STORE_COUNT, topN = 5) {
  if (!industryStats) return []
  return Object.entries(industryStats)
    .filter(([, stats]) => stats)
    .map(([name, stats]) => {
      const stores = finiteNumber(stats['점포_수'])
      const closed = finiteNumber(stats['폐업_점포_수'])
      return { name, stores, closed, rate: stores > 0 && closed != null ? (closed / stores) * 100 : null }
    })
    .filter((item) => item.stores >= minStores && item.closed > 0 && Number.isFinite(item.rate))
    .sort((a, b) => b.rate - a.rate || b.closed - a.closed)
    .slice(0, topN)
}

export function topIndustriesWithFallback(industryStats, minStores = MIN_STORE_COUNT, topN = 5) {
  const preferred = topIndustries(industryStats, minStores, topN)
  if (preferred.length >= topN || minStores <= 1) return { items: preferred, minStores }
  const fallback = topIndustries(industryStats, 1, topN)
  return fallback.length > preferred.length
    ? { items: fallback, minStores: 1 }
    : { items: preferred, minStores }
}

export function getDistrictName(dongCode) {
  return SEOUL_DISTRICTS[String(dongCode).slice(0, 5)] || '서울특별시'
}

export function getDongDisplayIndex(processed, dongCode) {
  const codes = Object.keys(processed || {}).sort()
  const index = codes.indexOf(String(dongCode))
  return index >= 0 ? String(index + 1).padStart(3, '0') : '---'
}
