// Счётчик посещений для панели /admin (public/api/stats.php). Cookie и
// постоянных идентификаторов нет: страница шлёт только путь раздела, а
// сервер считает уникальных за сутки по отпечатку, который стирается в
// полночь. QR-таблички (/here?room=<id>) считаются отдельно. Сбой счётчика
// сайт не замечает.

const ENDPOINT = '/api/stats.php'
const SEEN_PREFIX = 'logos-qr-seen:'

function send(body) {
  try {
    const payload = JSON.stringify(body)
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
  } catch { /* счётчик не должен ломать страницу */ }
}

// '/map/' → '/map', без параметров и якорей; панель управления не считаем.
export function statsPath(pathname) {
  const clean = String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/'
  return /^\/[a-z0-9-]{0,30}(?:\/[a-z0-9-]{1,30})?$/.test(clean) && !clean.startsWith('/admin') ? clean : ''
}

let lastPath = ''
export function trackView(pathname) {
  const path = statsPath(pathname)
  if (!path || path === lastPath) return
  lastPath = path
  send({ t: 'view', p: path })
}

// Один человек, один QR, одна вкладка — одно сканирование: обновление страницы не считается.
export function trackQr(roomId) {
  if (!/^[a-z0-9-]{1,60}$/.test(roomId || '')) return
  try {
    if (sessionStorage.getItem(SEEN_PREFIX + roomId)) return
    sessionStorage.setItem(SEEN_PREFIX + roomId, '1')
  } catch { /* приватный режим: считаем каждый заход */ }
  send({ t: 'qr', room: roomId })
}
