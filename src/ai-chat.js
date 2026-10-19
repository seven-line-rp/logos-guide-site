// Клиентская часть ИИ-агента: запрос к public/api/ai-chat.php и разбор
// ответа. Ответ модели — Markdown, но в страницу он попадает только как
// текст и ссылки (без innerHTML), поэтому разметка из ответа не исполняется.

export const AI_ENDPOINT = '/api/ai-chat.php'
export const MAX_HISTORY = 16
export const MAX_INPUT = 2000

export function historyForRequest(messages) {
  return messages
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && !message.error)
    .slice(-MAX_HISTORY)
    .map(({ role, content }) => ({ role, content: content.slice(0, MAX_INPUT) }))
}

export async function askAgent(messages, { signal, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historyForRequest(messages) }),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.')
  }
  const data = await response.json().catch(() => null)
  if (response.ok && typeof data?.reply === 'string') return data.reply
  if (data?.error) throw new Error(data.error)
  if (response.status === 404) throw new Error('ИИ-агент ещё не загружен на этот сервер.')
  throw new Error('ИИ не ответил. Попробуйте ещё раз.')
}

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
