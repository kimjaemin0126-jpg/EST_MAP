function finiteNumber(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function expandProcessedData(data) {
  const processed = {}

  Object.entries(data.d || {}).forEach(([dongCode, dong]) => {
    const quarters = Object.fromEntries(Object.entries(dong.q || {}).map(([quarter, values]) => {
      const stores = finiteNumber(values?.[0])
      const closed = finiteNumber(values?.[1])
      const opened = finiteNumber(values?.[2])
      return [quarter, {
        '점포_수': stores,
        '폐업_점포_수': closed,
        '개업_점포_수': opened,
        '폐업_률': stores > 0 && closed != null ? (closed / stores) * 100 : null,
        '개업_률': stores > 0 && opened != null ? (opened / stores) * 100 : null,
      }]
    }))
    const industries = Object.fromEntries(Object.entries(dong.i || {}).map(([quarter, rows]) => [
      quarter,
      Object.fromEntries(rows.map(([nameIndex, code, stores, closed, opened]) => [
        data.k[nameIndex],
        {
          code,
          '점포_수': finiteNumber(stores),
          '폐업_점포_수': finiteNumber(closed),
          '개업_점포_수': finiteNumber(opened),
        },
      ])),
    ]))

    processed[dongCode] = { name: dong.n, quarters, industries }
  })

  return processed
}

function expandMarketContext(data) {
  const sales = Object.fromEntries(Object.entries(data.s || {}).map(([quarter, dongs]) => [
    quarter,
    Object.fromEntries(Object.entries(dongs).map(([dongCode, industries]) => [
      dongCode,
      Object.fromEntries(Object.entries(industries).map(([industryCode, values]) => [
        industryCode,
        { amount: finiteNumber(values?.[0]), count: finiteNumber(values?.[1]) },
      ])),
    ])),
  ]))
  const floatingPopulation = Object.fromEntries(Object.entries(data.f || {}).map(([quarter, dongs]) => [
    quarter,
    Object.fromEntries(Object.entries(dongs).map(([dongCode, total]) => [dongCode, { total: finiteNumber(total) }])),
  ]))
  const residentPopulation = Object.fromEntries(Object.entries(data.r || {}).map(([quarter, dongs]) => [
    quarter,
    Object.fromEntries(Object.entries(dongs).map(([dongCode, total]) => [dongCode, { total: finiteNumber(total) }])),
  ]))

  return { sales, floatingPopulation, residentPopulation }
}

export function expandStaticData(data) {
  if (data?.v === 1 && data?.k && data?.d) return expandProcessedData(data)
  if (data?.v === 1 && data?.s && data?.f && data?.r) return expandMarketContext(data)
  return data
}

export function mergeProcessedData(current = {}, incoming = {}) {
  const merged = { ...current }
  Object.entries(incoming).forEach(([dongCode, dong]) => {
    const previous = merged[dongCode]
    merged[dongCode] = previous
      ? {
          ...previous,
          name: dong.name || previous.name,
          quarters: { ...previous.quarters, ...dong.quarters },
          industries: { ...previous.industries, ...dong.industries },
        }
      : dong
  })
  return merged
}

export function mergeMarketContext(current = {}, incoming = {}) {
  return {
    sales: { ...current.sales, ...incoming.sales },
    floatingPopulation: { ...current.floatingPopulation, ...incoming.floatingPopulation },
    residentPopulation: { ...current.residentPopulation, ...incoming.residentPopulation },
  }
}

const requestCache = new Map()

export async function fetchJson(url, label) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`)
    }
    return expandStaticData(await response.json())
  } catch (error) {
    console.error(`[staticData] ${label} loading failed`, { url, error })
    throw error
  }
}

export function fetchJsonCached(url, label) {
  if (requestCache.has(url)) return requestCache.get(url)
  const request = fetchJson(url, label).catch((error) => {
    requestCache.delete(url)
    throw error
  })
  requestCache.set(url, request)
  return request
}
