// Ключ панели и запросы к PHP. Ключ живёт только в этой вкладке
// (sessionStorage) и пропадает, когда её закрывают.

const KEY_STORAGE = 'logos-admin-key'

export const readKey = () => { try { return sessionStorage.getItem(KEY_STORAGE) || '' } catch { return '' } }
export const saveKey = (value) => { try { if (value) sessionStorage.setItem(KEY_STORAGE, value); else sessionStorage.removeItem(KEY_STORAGE) } catch { /* приватный режим */ } }

async function parse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Сервер ответил ${response.status}`)
  return data
}

export async function postNotices(key, body) {
  return parse(await fetch('/api/notices.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key }, body: JSON.stringify(body) }))
}

export async function fetchStats(key) {
  const data = await parse(await fetch('/api/stats.php', { headers: { 'X-Admin-Key': key }, cache: 'no-store' }))
  if (!data || typeof data.days !== 'object' || Array.isArray(data.days) || typeof data.today !== 'string') throw new Error('Сервер прислал статистику в неожиданном виде.')
  return data
}

export async function postPush(key, body) {
  return parse(await fetch('/api/notify.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key }, body: JSON.stringify(body) }))
}

// Обращения с сайта: «Сообщить о неточности» на карте и страница /feedback.
export async function fetchReports(key) {
  const data = await parse(await fetch('/api/report.php?list=1', { headers: { 'X-Admin-Key': key }, cache: 'no-store' }))
  if (!data || !Array.isArray(data.items)) throw new Error('Сервер прислал обращения в неожиданном виде.')
  return data
}

export async function postReport(key, body) {
  return parse(await fetch('/api/report.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key }, body: JSON.stringify(body) }))
}

// Настройки сайта: включённые темы и Bluetooth-маячки (api/settings.php).
export async function postSettings(key, body) {
  return parse(await fetch('/api/settings.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key }, body: JSON.stringify(body) }))
}
