const DEFAULT_API_BASE_URL = '/open-safe-api'

function apiBaseUrl() {
  return (import.meta.env.VITE_OPEN_SAFE_API_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

function errorMessage(payload, status) {
  const detail = payload?.detail
  if (typeof detail === 'string') return detail
  if (typeof detail?.message === 'string') return detail.message
  if (typeof payload?.error === 'string') return payload.error
  return `OpenSafe AI 요청에 실패했습니다. (HTTP ${status})`
}

export async function requestScenario(payload, options = {}) {
  const response = await fetch(`${apiBaseUrl()}/api/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // A non-JSON response is converted to the same user-facing API error below.
  }

  if (!response.ok) {
    const error = new Error(errorMessage(data, response.status))
    error.status = response.status
    error.payload = data
    throw error
  }

  return data
}
