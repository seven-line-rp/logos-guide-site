import QRCode from 'qrcode'

// «Поделиться маршрутом»: ссылка, QR-код и системное меню «Поделиться».

export function routeLink(origin, { from, to, mode = '' }) {
  const params = new URLSearchParams({ from, to })
  if (mode && mode !== 'auto') params.set('mode', mode)
  return `${origin}/route?${params.toString()}`
}

export async function qrSvg(text, { dark = '#13213a', light = '#ffffff' } = {}) {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark, light } })
}

// Системное «Поделиться» на телефоне; без него — копирование в буфер.
export async function shareOrCopy({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared' } catch (error) { if (error?.name === 'AbortError') return 'cancelled' }
  }
  try { await navigator.clipboard.writeText(url); return 'copied' } catch { return 'failed' }
}
