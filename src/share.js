import QRCode from 'qrcode'

// «Поделиться маршрутом»: ссылка, QR-код и системное меню «Поделиться».

export function routeLink(origin, { from, to, mode = '', via = '' }) {
  const params = new URLSearchParams({ from, to })
  if (via) params.set('via', via)
  if (mode && mode !== 'auto') params.set('mode', mode)
  return `${origin}/route?${params.toString()}`
}

// «Встретимся здесь»: у получателя откроется маршрут до места встречи от
// того места, где он сейчас (или от входа), и плашка «Вас ждут».
export function meetLink(origin, { to, at = '' }) {
  const params = new URLSearchParams({ to, meet: '1' })
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) params.set('at', at)
  return `${origin}/route?${params.toString()}`
}

export async function qrSvg(text, { dark = '#13213a', light = '#ffffff' } = {}) {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark, light } })
}

// QR-код «со вкусом»: скруглённые точки и глаза, по центру логотип сайта на
// белой скруглённой плашке. Уровень коррекции H (до 30 % потерь) переживает
// закрытый логотипом центр, поэтому код читается как обычный.
export async function brandedQrSvg(text, { dark = '#13213a', light = '#ffffff', accent = '#245ce5' } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' })
  const n = qr.modules.size
  const get = (x, y) => qr.modules.get(x, y)
  const margin = 2
  const total = n + margin * 2
  const logo = Math.round(n * 0.2) % 2 === n % 2 ? Math.round(n * 0.2) : Math.round(n * 0.2) + 1
  const from = (n - logo) / 2
  const inEye = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)
  const inLogo = (x, y) => x >= from - 1 && x < from + logo + 1 && y >= from - 1 && y < from + logo + 1
  let dots = ''
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) {
    if (get(x, y) && !inEye(x, y) && !inLogo(x, y)) dots += `<rect x="${x + margin + 0.06}" y="${y + margin + 0.06}" width="0.88" height="0.88" rx="0.32"/>`
  }
  const eye = (x, y) => `<rect x="${x + margin + 0.5}" y="${y + margin + 0.5}" width="6" height="6" rx="1.9" fill="none" stroke="${dark}" stroke-width="1"/><rect x="${x + margin + 2}" y="${y + margin + 2}" width="3" height="3" rx="1" fill="${accent}"/>`
  const c = total / 2
  const box = logo + 0.6
  const mark = `<g transform="translate(${c - logo / 2 + 0.3} ${c - logo / 2 + 0.3}) scale(${(logo - 0.6) / 24})"><rect width="24" height="24" rx="6" fill="${accent}"/><g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4) scale(.667)"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/></g></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision"><rect width="${total}" height="${total}" fill="${light}"/><g fill="${dark}">${dots}</g>${eye(0, 0)}${eye(n - 7, 0)}${eye(0, n - 7)}<rect x="${c - box / 2 - 0.35}" y="${c - box / 2 - 0.35}" width="${box + 0.7}" height="${box + 0.7}" rx="${(box + 0.7) * 0.28}" fill="${light}"/>${mark}</svg>`
}

// Системное «Поделиться» на телефоне; без него — копирование в буфер.
export async function shareOrCopy({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared' } catch (error) { if (error?.name === 'AbortError') return 'cancelled' }
  }
  try { await navigator.clipboard.writeText(url); return 'copied' } catch { return 'failed' }
}
