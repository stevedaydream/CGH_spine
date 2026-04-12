// ─────────────────────────────────────────────────────
// api/gas.js — 與 GAS REST API 通訊
//
// 本地開發：Vite proxy 將 /gas-proxy 轉發至 GAS，
//           繞過瀏覽器 CORS 限制。
// 生產環境：直接 fetch GAS URL（ContentService 有 CORS header）。
// ─────────────────────────────────────────────────────

const API_KEY = import.meta.env.VITE_API_KEY

function buildUrl(action, params = {}) {
  // dev mode → 走 Vite proxy；production → 直接打 GAS
  const base = import.meta.env.DEV
    ? '/gas-proxy'
    : import.meta.env.VITE_GAS_URL

  if (!base) throw new Error('VITE_GAS_URL is not set')

  const url = new URL(base, window.location.origin)
  url.searchParams.set('action', action)
  url.searchParams.set('key',    API_KEY || '')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return url.toString()
}

async function call(action, params = {}) {
  const res  = await fetch(buildUrl(action, params))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json
}

export const getDashboardData    = ()       => call('getDashboardData')
export const getAnalyticsData    = ()       => call('getAnalyticsData')
export const approveRecord       = (ri)     => call('approveRecord',       { rowIndex: ri })
export const rejectRecord        = (ri)     => call('rejectRecord',        { rowIndex: ri })
export const exportCsv           = ()       => call('exportCsv')
export const getFormOptions      = ()       => call('getFormOptions')
export const addOperationRecord  = (data)   => call('addOperationRecord',  data)
export const addFollowUpRecord   = (data)   => call('addFollowUpRecord',   data)
