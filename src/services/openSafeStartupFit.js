let startupFitPromise = null

function labelForScore(score) {
  if (score >= 70) return '높음'
  if (score >= 50) return '보통'
  return '낮음'
}

async function loadStartupFitData() {
  if (!startupFitPromise) {
    startupFitPromise = fetch('/data/opensafe-startup-fit.json')
      .then((response) => {
        if (!response.ok) throw new Error(`OpenSafe 창업 적합도 데이터를 불러오지 못했습니다. (${response.status})`)
        return response.json()
      })
  }
  return startupFitPromise
}

function normalizeRecord(value) {
  if (!Array.isArray(value) || !Number.isFinite(Number(value[0]))) return null
  const fc = value[2] || {}
  const marketCompetitionBalance = (
    Number.isFinite(Number(fc.market_momentum)) &&
    Number.isFinite(Number(fc.competition_balance))
  )
    ? (Number(fc.market_momentum) + Number(fc.competition_balance)) / 2
    : null

  return {
    score: Math.round(Number(value[0])),
    label: String(value[1] || labelForScore(Number(value[0]))),
    components: {
      stability: Number.isFinite(Number(fc.stability)) ? Number(fc.stability) : null,
      revenueCapacity: Number.isFinite(Number(fc.revenue_capacity)) ? Number(fc.revenue_capacity) : null,
      marketCompetitionBalance,
      demandCapacity: Number.isFinite(Number(fc.demand_capacity)) ? Number(fc.demand_capacity) : null,
    },
  }
}

export async function getOpenSafeStartupFit(dongCode, industryCode = '') {
  if (!dongCode) return null

  const data = await loadStartupFitData()
  const dong = data?.records?.[String(dongCode)]
  if (!dong) return null

  if (industryCode) {
    const exact = normalizeRecord(dong[String(industryCode)])
    return exact ? { ...exact, aggregated: false } : null
  }

  const records = Object.values(dong).map(normalizeRecord).filter(Boolean)
  if (!records.length) return null

  const average = (values) => {
    const valid = values.filter(Number.isFinite)
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
  }

  const score = Math.round(average(records.map((record) => record.score)))
  return {
    score,
    label: labelForScore(score),
    aggregated: true,
    count: records.length,
    components: {
      stability: average(records.map((record) => record.components.stability)),
      revenueCapacity: average(records.map((record) => record.components.revenueCapacity)),
      marketCompetitionBalance: average(records.map((record) => record.components.marketCompetitionBalance)),
      demandCapacity: average(records.map((record) => record.components.demandCapacity)),
    },
  }
}
