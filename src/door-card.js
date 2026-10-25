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
export function doorCardSvg(room, qr) {
  const { width, height } = CARD
  const title = fitTitle(roomName(room))
  const titleTop = title.lines.length >= 3 ? 385 : 430
  const lineHeight = title.size * 1.08
  const lines = title.lines.map((line, index) => `<text x="96" y="${(titleTop + title.size * 0.86 + index * lineHeight).toFixed(1)}" font-size="${title.size}" font-weight="800" letter-spacing="-2" fill="#13213a">${escapeXml(line)}</text>`).join('')
  const chipY = titleTop + title.lines.length * lineHeight + 30
  const floor = `${room.floor} ЭТАЖ`
  const chipW = 70 + floor.length * 26
  const qrBox = { x: 1176, y: 118, size: 648 }
  const inner = qr.replace(/<svg[^>]*>/, `<svg x="${qrBox.x + 36}" y="${qrBox.y + 36}" width="${qrBox.size - 72}" height="${qrBox.size - 72}" viewBox="${(qr.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 1 1'}">`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
<defs><linearGradient id="dc-a" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0a22d8"/><stop offset=".55" stop-color="#2f4bff"/><stop offset="1" stop-color="#58b4ff"/></linearGradient><linearGradient id="dc-b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#061a9e"/><stop offset="1" stop-color="#1f3df0"/></linearGradient></defs>
<rect width="${width}" height="${height}" fill="#ffffff"/>
<path d="M0 800 C250 840 470 935 620 1040 L0 1040 Z" fill="url(#dc-a)"/>
<path d="M0 800 C250 840 470 935 620 1040" fill="none" stroke="#ffffff" stroke-width="12" transform="translate(0 40)"/>
<path d="M0 905 C170 930 330 985 430 1040 L0 1040 Z" fill="url(#dc-b)"/>
${logoAt(96, 70, 1000)}
${lines}
<rect x="96" y="${chipY.toFixed(1)}" width="${chipW}" height="74" rx="37" fill="#245ce5"/>
<text x="${96 + chipW / 2}" y="${(chipY + 51).toFixed(1)}" font-size="40" font-weight="800" letter-spacing="2" text-anchor="middle" fill="#ffffff">${escapeXml(floor)}</text>
<rect x="${qrBox.x}" y="${qrBox.y}" width="${qrBox.size}" height="${qrBox.size}" rx="56" fill="#ffffff" stroke="#dbe4f5" stroke-width="3"/>
${inner}
<text x="${qrBox.x + qrBox.size / 2}" y="${qrBox.y + qrBox.size + 70}" font-size="42" font-weight="800" text-anchor="middle" fill="#245ce5">Вы здесь · сканируйте</text>
<text x="${qrBox.x + qrBox.size / 2}" y="${qrBox.y + qrBox.size + 116}" font-size="30" text-anchor="middle" fill="#5d6c86">Маршрут построится от этой двери</text>
<text x="${width - 56}" y="${height - 44}" font-size="23" text-anchor="end" fill="#13213a">${escapeXml(CREDITS)}</text>
</svg>`
}
