// Хранилище диалогов LOGOS AI.
// Чаты живут только в браузере посетителя (localStorage) и никуда не
// отправляются: на сервер уходит лишь короткий хвост переписки для ответа.
// Модуль не зависит от React, поэтому его покрывают обычные node-тесты.

export const CHATS_STORAGE_KEY = 'logos-ai-chats'
export const ACTIVE_CHAT_STORAGE_KEY = 'logos-ai-active-chat'
export const MAX_CHATS = 25
export const MAX_MESSAGES_PER_CHAT = 240
export const MAX_MESSAGE_LENGTH = 2000
// Сколько последних сообщений уходит модели вместе с вопросом.
export const HISTORY_SENT_TO_MODEL = 14
export const EMPTY_CHAT_TITLE = 'Новый чат'

const MEMORY_KEY = '__logos-ai-memory__'

export function createMemoryStore() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: (key) => { data.delete(key) },
  }
}

let memoryStore = null
function fallbackStore() {
  if (!memoryStore) memoryStore = createMemoryStore()
  return memoryStore
}

// В приватном режиме Safari localStorage бросает исключения — тогда диалоги
// живут в памяти вкладки, и сайт продолжает работать.
export function getChatStore() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem(MEMORY_KEY)
      return localStorage
    }
  } catch {
    return fallbackStore()
  }
  return fallbackStore()
}

export function createChatId(now = Date.now()) {
  return `chat-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createChat(now = new Date().toISOString()) {
  return { id: createChatId(), title: EMPTY_CHAT_TITLE, createdAt: now, updatedAt: now, messages: [] }
}

export function normalizeMessage(message) {
  if (!message || typeof message !== 'object') return null
  const role = message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : ''
  const content = typeof message.content === 'string' ? message.content.trim() : ''
  if (!role || !content) return null
  return {
    id: typeof message.id === 'string' && message.id ? message.id : createChatId(),
    role,
    content: content.slice(0, MAX_MESSAGE_LENGTH * 2),
    at: typeof message.at === 'string' ? message.at : new Date().toISOString(),
  }
}

export function titleFromMessages(messages) {
  const first = (messages || []).find((message) => message.role === 'user')
  const text = (first?.content || '').replace(/\s+/g, ' ').trim()
  if (!text) return EMPTY_CHAT_TITLE
  return text.length > 42 ? `${text.slice(0, 42).trimEnd()}…` : text
}

function normalizeChat(item) {
  if (!item || typeof item !== 'object') return null
  const messages = (Array.isArray(item.messages) ? item.messages : [])
    .map(normalizeMessage)
    .filter(Boolean)
    .slice(-MAX_MESSAGES_PER_CHAT)
  // Пустой диалог нечего ни показывать, ни хранить.
  if (!messages.length) return null
  const title = typeof item.title === 'string' && item.title.trim()
    ? item.title.replace(/\s+/g, ' ').trim().slice(0, 60)
    : titleFromMessages(messages)
  const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString()
  return {
    id: typeof item.id === 'string' && item.id ? item.id : createChatId(),
    title,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : updatedAt,
    updatedAt,
    messages,
  }
}

export function sortChats(chats) {
  return [...chats].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
}

// Приводим прочитанное из браузера к рабочему виду: битые записи отбрасываем,
// лишние диалоги не держим.
export function normalizeChats(raw) {
  if (!Array.isArray(raw)) return []
  const chats = raw.map(normalizeChat).filter(Boolean)
  return sortChats(chats).slice(0, MAX_CHATS)
}

export function upsertChat(chats, chat) {
  const rest = (chats || []).filter((item) => item.id !== chat.id)
  return sortChats([...rest, chat]).slice(0, MAX_CHATS)
}

export function removeChat(chats, id) {
  return (chats || []).filter((item) => item.id !== id)
}

export function renameChat(chats, id, title) {
  const clean = (title || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return (chats || []).map((item) => (item.id === id ? { ...item, title: clean || titleFromMessages(item.messages) } : item))
}

export function historyForModel(messages) {
  return (messages || [])
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-HISTORY_SENT_TO_MODEL)
    .map(({ role, content }) => ({ role, content }))
}

export function readChats(store = getChatStore()) {
  try {
    const raw = store.getItem(CHATS_STORAGE_KEY)
    if (!raw) return []
    return normalizeChats(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeChats(chats, store = getChatStore()) {
  try {
    store.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats))
  } catch {
    // переполненный или недоступный localStorage — просто не сохраняем
  }
}

export function readActiveChatId(store = getChatStore()) {
  try {
    return store.getItem(ACTIVE_CHAT_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function writeActiveChatId(id, store = getChatStore()) {
  try {
    if (id) store.setItem(ACTIVE_CHAT_STORAGE_KEY, id)
    else store.removeItem(ACTIVE_CHAT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function clearChats(store = getChatStore()) {
  try {
    store.removeItem(CHATS_STORAGE_KEY)
    store.removeItem(ACTIVE_CHAT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function messageCountLabel(count) {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} сообщений`
  if (last === 1) return `${count} сообщение`
  if (last >= 2 && last <= 4) return `${count} сообщения`
  return `${count} сообщений`
}

export function formatChatTime(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.round(minutes / 60)
  if (hours < 24 && date.getDate() === new Date().getDate()) return `${hours} ч назад`
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  if (diff < 6 * 86_400_000) return `${day}.${month}`
  return `${day}.${month}.${String(date.getFullYear()).slice(2)}`
}

// Подпись под чатом в списке: последний ответ или вопрос.
export function chatPreview(chat) {
  const last = chat.messages.at(-1)
  if (!last) return 'Пустой диалог'
  const text = last.content.replace(/\s+/g, ' ').trim()
  const prefix = last.role === 'user' ? 'Вы: ' : ''
  return `${prefix}${text.length > 60 ? `${text.slice(0, 60).trimEnd()}…` : text}`
}
