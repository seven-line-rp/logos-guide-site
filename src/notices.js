import { useEffect, useState } from 'react'
import { rooms } from './data.js'

// Объявления на карте: «ремонт, проход закрыт», «мероприятие в 15:00».
// Их ведут в файле public/notices.json на хостинге — без сборки сайта
// (формат и примеры — deploy/notices.md). Закрытые лестницы и лифт
// маршрут обходит сам, о закрытом кабинете предупреждает.

export const NOTICE_TYPES = {
  closed: { label: 'Закрыто', tone: 'closed' },
  event: { label: 'Событие', tone: 'event' },
  info: { label: 'Важно', tone: 'info' },
}

const isDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value))

export function validNotice(notice) {
  return Boolean(notice && typeof notice.title === 'string' && notice.title.trim()
    && NOTICE_TYPES[notice.type] && rooms.some((room) => room.id === notice.roomId)
    && (notice.from === undefined || isDate(notice.from)) && (notice.to === undefined || isDate(notice.to)))
}

// Действующие сейчас: без дат — всегда, иначе в промежутке [from, to].
export function activeNotices(list, now = new Date()) {
  if (!Array.isArray(list)) return []
  return list.filter(validNotice).filter((notice) => (!notice.from || Date.parse(notice.from) <= now.getTime()) && (!notice.to || Date.parse(notice.to) >= now.getTime()))
}

export function closedRoomIds(notices) {
  return new Set(notices.filter((notice) => notice.type === 'closed').map((notice) => notice.roomId))
}

// Варианты маршрута без закрытых лестниц и лифта. Если закрыто всё, отдаём
// исходный список — пусть человек решит сам, а предупреждение будет видно.
export function avoidClosed(options, closed) {
  if (!closed.size) return options
  const open = options.filter((option) => !option.transfer || !option.transfer.startId || (!closed.has(option.transfer.startId) && !closed.has(option.transfer.endId)))
  return open.length ? open : options
}

export function noticePoint(notice) {
  const room = rooms.find((item) => item.id === notice.roomId)
  return room ? { floor: room.floor, room } : null
}

// Сначала api/notices.php (там объявления, сохранённые со страницы /admin),
// без PHP или без сети — файл notices.json из корня сайта.
const readList = (fetchImpl, url) => fetchImpl(url, { cache: 'no-cache' }).then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status))))).then((value) => (Array.isArray(value) ? value : Promise.reject(new Error('not a list'))))
export function fetchNotices(fetchImpl = typeof fetch === 'undefined' ? null : fetch) {
  if (!fetchImpl) return Promise.resolve([])
  return readList(fetchImpl, '/api/notices.php').catch(() => readList(fetchImpl, '/notices.json')).catch(() => [])
}

let cache = null
export function loadNotices(fetchImpl = typeof fetch === 'undefined' ? null : fetch) {
  if (!cache) cache = fetchNotices(fetchImpl)
  return cache
}

export function useNotices() {
  const [list, setList] = useState([])
  useEffect(() => {
    let alive = true
    loadNotices().then((value) => { if (alive) setList(activeNotices(value)) })
    return () => { alive = false }
  }, [])
  return list
}
