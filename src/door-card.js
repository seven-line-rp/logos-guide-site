import logoSvg from './assets/logo-wordmark.js'
import { roomName } from './signs.js'

// Карточка помещения для печати на дверь: логотип «ЛОГОС Путеводитель»,
// название кабинета, QR-код «Вы здесь» и подпись команды. Одна SVG-картинка
// 1920×1040 (FHD по ширине); PNG для Word и принтера рисуется из неё в 2K.

export const CARD = { width: 1920, height: 1040 }
export const CREDITS = 'Разработано командой: Ксения Давыдова, Данила Лисовой, Тимофей Бодян, Артём Брекин'
const FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

const escapeXml = (text) => String(text).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))

// Название крупными буквами в 1–4 строки: берём самый крупный размер, при
// котором текст помещается в рамку (ширину букв оцениваем с запасом).
export function fitTitle(text, { width = 1000, height = 400, max = 132, min = 56, ratio = 0.72 } = {}) {
  const words = String(text).toUpperCase().split(/\s+/).filter(Boolean)
  for (let size = max; size >= min; size -= 4) {
    const limit = Math.floor(width / (size * ratio))
    const lines = []
    let line = ''
    let tooLong = false
    for (const word of words) {
      if (word.length > limit) tooLong = true
      if (line && `${line} ${word}`.length > limit) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word
    }
    if (line) lines.push(line)
    if (!tooLong && lines.length <= 4 && lines.length * size * 1.08 <= height) return { size, lines }
  }
  // Очень длинное слово или название: самый мелкий размер, строки как есть.
  return { size: min, lines: words.length ? [words.join(' ')] : [''] }
}

function logoAt(x, y, width) {
  const height = (width * 317) / 1203
  return logoSvg.replace(/<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${width}" height="${height.toFixed(1)}" viewBox="0 0 1203 317" fill="none">`)
}

// qr — SVG-строка QR-кода (brandedQrSvg); вкладывается как вложенная картинка.
// Макет: слева логотип, название и этаж на белом, справа синяя панель со скошенным
// краем и QR на белой карточке. Все блоки стоят на фиксированных местах и не
// накладываются друг на друга, а текст на цветном фоне только белый.
export function doorCardSvg(room, qr) {
  const { width, height } = CARD
  const title = fitTitle(roomName(room), { width: 930, height: 340, max: 128 })
  const lineHeight = title.size * 1.08
  const titleTop = 400
  const lines = title.lines.map((line, index) => `<text x="96" y="${(titleTop + title.size * 0.86 + index * lineHeight).toFixed(1)}" font-size="${title.size}" font-weight="800" letter-spacing="-2" fill="#0f1b36">${escapeXml(line)}</text>`).join('')
  const card = { x: 1210, y: 140, size: 620 }
  const viewBox = (qr.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 1 1'
  const inner = qr.replace(/<svg[^>]*>/, `<svg x="${card.x + 34}" y="${card.y + 34}" width="${card.size - 68}" height="${card.size - 68}" viewBox="${viewBox}">`)
  const cx = card.x + card.size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
<defs>
<linearGradient id="dc-panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2447f5"/><stop offset=".6" stop-color="#1230d8"/><stop offset="1" stop-color="#0a1cab"/></linearGradient>
<linearGradient id="dc-bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a1cab"/><stop offset="1" stop-color="#4f8bff"/></linearGradient>
<linearGradient id="dc-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${width}" height="${height}" fill="#ffffff"/>
<polygon points="1110,0 ${width},0 ${width},${height} 990,${height}" fill="url(#dc-panel)"/>
<polygon points="1110,0 ${width},0 ${width},520 1030,520" fill="url(#dc-glow)"/>
<path d="M1010 1040 L1360 470 L1710 1040" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="64" stroke-linejoin="round"/>
<path d="M1330 1040 L1620 620 L1910 1040" fill="none" stroke="#ffffff" stroke-opacity=".06" stroke-width="40" stroke-linejoin="round"/>
${logoAt(96, 70, 920)}
<rect x="96" y="${titleTop - 38}" width="84" height="10" rx="5" fill="#245ce5"/>
${lines}
<line x1="96" y1="752" x2="930" y2="752" stroke="#e3e9f5" stroke-width="3"/>
<rect x="96" y="780" width="132" height="132" rx="34" fill="#245ce5"/>
<text x="162" y="${780 + 100}" font-size="92" font-weight="800" text-anchor="middle" fill="#ffffff">${escapeXml(room.floor)}</text>
<text x="262" y="840" font-size="56" font-weight="800" letter-spacing="3" fill="#0f1b36">ЭТАЖ</text>
<text x="262" y="892" font-size="32" fill="#5d6c86">Технический колледж «Логос»</text>
<rect x="0" y="${height - 12}" width="1000" height="12" fill="url(#dc-bar)"/>
<text x="96" y="${height - 76}" font-size="22" font-weight="700" letter-spacing="1" fill="#0f1b36">РАЗРАБОТАНО КОМАНДОЙ</text>
<text x="96" y="${height - 40}" font-size="26" fill="#5d6c86">${escapeXml(CREDITS.replace('Разработано командой: ', ''))}</text>
<rect x="${card.x + 6}" y="${card.y + 14}" width="${card.size}" height="${card.size}" rx="64" fill="#050f6b" fill-opacity=".28"/>
<rect x="${card.x}" y="${card.y}" width="${card.size}" height="${card.size}" rx="64" fill="#ffffff"/>
${inner}
<text x="${cx}" y="${card.y + card.size + 92}" font-size="50" font-weight="800" text-anchor="middle" fill="#ffffff">Вы здесь · сканируйте</text>
<text x="${cx}" y="${card.y + card.size + 144}" font-size="31" text-anchor="middle" fill="#ffffff" fill-opacity=".82">Маршрут построится от этой двери</text>
</svg>`
}
