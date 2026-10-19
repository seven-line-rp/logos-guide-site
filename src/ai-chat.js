import { functionalStorageAllowed } from './consent.js'

// Клиентская часть ИИ-агента: запрос к public/api/ai-chat.php, хранение
// чатов в браузере, фильтр мата и разбор ответа. Ответ модели — Markdown,
// но в страницу он попадает только как текст и ссылки (без innerHTML),
// поэтому разметка из ответа не исполняется.

export const AI_ENDPOINT = '/api/ai-chat.php'
export const MAX_HISTORY = 16
export const MAX_INPUT = 2000
export const MAX_IMAGES = 3
export const CHATS_KEY = 'logos-ai-chats'
export const MAX_CHATS = 30

const IMAGE_NOTE = '[к сообщению было приложено изображение]'

// Картинки уходят в модель только из последнего вопроса: старые снимки
// заменяются пометкой, чтобы не платить за них в каждом запросе.
export function historyForRequest(messages) {
  const turns = messages
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && !message.error && !message.curator)
    .slice(-MAX_HISTORY)
  return turns.map(({ role, content, images }, index) => {
    const text = String(content || '').slice(0, MAX_INPUT)
    const item = { role, content: text }
    if (images?.length) {
      if (index === turns.length - 1) item.images = images.slice(0, MAX_IMAGES)
      else item.content = `${text}\n${IMAGE_NOTE}`.trim()
    }
    return item
  })
}

export async function askAgent(messages, { signal, deep = false, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historyForRequest(messages), deep }),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.')
  }
  const data = await response.json().catch(() => null)
  if (response.ok && typeof data?.reply === 'string') {
    return { reply: data.reply, reasoning: typeof data.reasoning === 'string' ? data.reasoning : '', vision: data.vision !== false, left: Number.isFinite(data.left) ? data.left : null }
  }
  if (data?.error) throw Object.assign(new Error(data.error), { left: Number.isFinite(data.left) ? data.left : null })
  if (response.status === 404) throw new Error('ИИ-агент ещё не загружен на этот сервер.')
  if (response.status === 413) throw new Error('Картинки слишком большие. Попробуйте одну или поменьше.')
  throw new Error('ИИ не ответил. Попробуйте ещё раз.')
}

// ---------- Мат ----------
// Нецензурное сообщение не уходит в модель: вместо ответа страница
// «отправляет его куратору» (это шутка, никуда ничего не отправляется).
// Корни проверяются с начала слова (с приставками), поэтому «оскорблять»,
// «употреблять», «небо», «себя» и «мудрый» не срабатывают.

const lookalikes = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', 3: 'з', 0: 'о', 6: 'б', '@': 'а' }
const prefix = '(?:о|за|на|по|от|вы|при|у|до|раз|рас|об|под|пере|недо|про|с|из|въ|съ|долбо|долба)?ъ?'
const roots = [
  'ху[йеияю]', 'пи[зс]д', 'пезд', 'еб(?:а|у|л|н|ыв|ись|ет|ош|ок|ук)', 'еб$', 'бля', 'муд[аои]к', 'мудил', 'пид[оа]?р', 'залуп', 'г[ао]ндон',
  'шлюх', 'дроч', 'манд(?:а|ой|у|ы|ец|юк)$', 'хер(?:ня|ни|ню|ов[а-я]*|а|ну|ом)?$', 'сук(?:а|и|у|ой|ам|ами)?$', 'сучк', 'сучар',
]
const profanityPattern = new RegExp(`^${prefix}(?:${roots.join('|')})`)

function normalizeWord(word) {
  return [...word.toLocaleLowerCase('ru')].map((char) => lookalikes[char] || char).join('').replace(/ё/g, 'е').replace(/(.)\1{2,}/g, '$1')
}

export function containsProfanity(text) {
  const words = String(text || '').toLocaleLowerCase('ru').split(/[^a-zа-яё0-9@*]+/i).filter(Boolean)
  return words.some((word) => {
    const normalized = normalizeWord(word.replace(/\*/g, ''))
    return profanityPattern.test(normalized)
  })
}

// В истории чата мат показываем замаскированным: «б***».
export function maskProfanity(text) {
  return String(text || '').replace(/[a-zа-яё0-9@*]+/gi, (word) => containsProfanity(word) ? `${word[0]}${'*'.repeat(Math.max(2, word.length - 1))}` : word)
}

// ---------- Чаты в localStorage ----------

export function createChat(now = Date.now()) {
  return { id: `c${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: 'Новый чат', created: now, updated: now, messages: [] }
}

export function chatTitle(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'Чат с картинкой'
  return clean.length > 42 ? `${clean.slice(0, 40).trimEnd()}…` : clean
}

function validMessage(message) {
  return message && ['user', 'assistant', 'curator'].includes(message.role) && typeof message.content === 'string'
}

export function parseChats(raw) {
  try {
    const value = JSON.parse(raw || '')
    if (!value || value.v !== 1 || !Array.isArray(value.chats)) return { chats: [], activeId: '' }
    const chats = value.chats
      .filter((chat) => chat && typeof chat.id === 'string' && Array.isArray(chat.messages))
      .map((chat) => ({ ...chat, title: String(chat.title || 'Чат'), messages: chat.messages.filter(validMessage) }))
    return { chats, activeId: typeof value.activeId === 'string' ? value.activeId : '' }
  } catch {
    return { chats: [], activeId: '' }
  }
}

function storage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function loadChats(store = storage()) {
  try { return parseChats(store?.getItem(CHATS_KEY)) } catch { return { chats: [], activeId: '' } }
}

// Сохраняем только непустые чаты. Если место кончилось (у localStorage около
// 5 МБ), сначала убираем картинки из старых чатов, потом сами старые чаты.
export function saveChats(chats, activeId, store = storage()) {
  if (!store || !functionalStorageAllowed(store)) return 'disabled'
  let list = chats.filter((chat) => chat.messages.length).sort((a, b) => b.updated - a.updated).slice(0, MAX_CHATS)
    .map((chat) => ({ ...chat, messages: chat.messages.filter((m) => !m.pending).map(({ pending: _p, ...m }) => m) }))
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      store.setItem(CHATS_KEY, JSON.stringify({ v: 1, activeId, chats: list }))
      return attempt ? 'trimmed' : 'saved'
    } catch {
      const withImages = [...list].reverse().find((chat) => chat.messages.some((m) => m.images?.length))
      if (withImages) {
        list = list.map((chat) => chat === withImages ? { ...chat, messages: chat.messages.map(({ images, ...m }) => images?.length ? { ...m, content: `${m.content}\n${IMAGE_NOTE}`.trim() } : m) } : chat)
      } else if (list.length > 1) {
        list = list.slice(0, -1)
      } else {
        return 'full'
      }
    }
  }
  return 'full'
}

// ---------- Картинки ----------

// Сжимаем в браузере: до 1024 px по длинной стороне, JPEG. Так снимок
// расписания весит 100–200 КБ и помещается и в запрос, и в историю.
export async function compressImage(file, { maxSide = 1024, quality = 0.78 } = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('Это не картинка.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Картинка больше 15 МБ.')
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Не удалось открыть картинку.'))
      element.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- Разметка ответа ----------

// Безопасные ссылки: свои разделы (/map…) и внешние https-адреса.
export function safeHref(href) {
  const value = String(href || '').trim()
  if (/^\/(?!\/)/.test(value)) return { href: value, internal: true }
  if (/^https:\/\//i.test(value)) return { href: value, internal: false }
  return null
}

const inlinePattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https:\/\/[^\s)<]+[^\s)<.,!?;:])|`([^`]+)`/g

// Строка → список кусков: text, strong, code, link.
export function parseInline(text) {
  const parts = []
  let last = 0
  for (const match of text.matchAll(inlinePattern)) {
    if (match.index > last) parts.push({ type: 'text', text: text.slice(last, match.index) })
    if (match[1]) parts.push({ type: 'strong', text: match[1] })
    else if (match[5]) parts.push({ type: 'code', text: match[5] })
    else {
      const label = match[2] ?? match[4]
      const link = safeHref(match[3] ?? match[4])
      parts.push(link ? { type: 'link', text: label, ...link } : { type: 'text', text: label })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts
}

// Текст → блоки: абзацы, заголовки, маркированные и нумерованные списки.
export function parseBlocks(text) {
  const blocks = []
  let paragraph = []
  const flush = () => { if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') }); paragraph = [] }
  for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const numbered = line.match(/^\d+[.)]\s+(.*)$/)
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (!line) { flush(); continue }
    if (bullet || numbered) {
      flush()
      const type = bullet ? 'ul' : 'ol'
      const previous = blocks[blocks.length - 1]
      if (previous?.type === type) previous.items.push((bullet || numbered)[1])
      else blocks.push({ type, items: [(bullet || numbered)[1]] })
      continue
    }
    if (heading) { flush(); blocks.push({ type: 'h', text: heading[1] }); continue }
    paragraph.push(line)
  }
  flush()
  return blocks
}

// Кнопки-действия под ответом: маршрут и место на карте из ссылок в тексте.
export function answerActions(text) {
  const actions = []
  const seen = new Set()
  for (const part of parseBlocks(text).flatMap((block) => block.items || [block.text]).flatMap(parseInline)) {
    if (part.type !== 'link' || !part.internal || seen.has(part.href)) continue
    const kind = part.href.startsWith('/route') ? 'route' : part.href.startsWith('/map') ? 'map' : ''
    if (!kind) continue
    seen.add(part.href)
    actions.push({ kind, href: part.href, label: part.text })
  }
  return actions.slice(0, 6)
}

// Ссылка маршрута из ответа ИИ → откуда, куда и вариант перехода.
export function routeFromLink(href) {
  const match = String(href || '').match(/^\/route\?(.*)$/)
  if (!match) return null
  const params = new URLSearchParams(match[1])
  const to = params.get('to')
  if (!to) return null
  return { from: params.get('from') || 'entrance-1', to, mode: params.get('mode') || 'auto' }
}

// Текст без Markdown: для копирования и озвучки.
export function plainText(text) {
  return parseBlocks(text).map((block) => {
    const line = (value) => parseInline(value).map((part) => part.text).join('')
    if (block.items) return block.items.map((item) => `— ${line(item)}`).join('\n')
    return line(block.text)
  }).join('\n')
}

export function chatToMarkdown(chat) {
  const lines = [`# ${chat.title}`, '', `ЛОГОС AI · ${new Date(chat.created).toLocaleString('ru-RU')}`, '']
  for (const message of chat.messages) {
    const who = message.role === 'user' ? 'Вы' : message.role === 'curator' ? 'Куратор' : 'ЛОГОС AI'
    lines.push(`**${who}:** ${message.content}${message.images?.length ? `\n_(картинок: ${message.images.length})_` : ''}`, '')
  }
  return lines.join('\n')
}
