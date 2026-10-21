import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, Navigation } from 'lucide-react'
import { rooms } from '../data.js'
import { roomLabel } from './RoomSearchSelect.jsx'
import { dateKey, dayLabel, formatCountdown, nextLesson, readSchedule, subscribeSchedule } from '../schedule.js'

// Следующая пара и хуки расписания. Отдельно от SchedulePage, чтобы главная
// не тянула страницу расписания в основной бандл (раньше Vite предупреждал:
// страница грузилась лениво и одновременно напрямую).

let snapshot = null
function getSchedule() {
  const value = readSchedule()
  const key = JSON.stringify(value)
  if (!snapshot || snapshot.key !== key) snapshot = { key, value }
  return snapshot.value
}
export function useSchedule() {
  return useSyncExternalStore(subscribeSchedule, getSchedule, () => [])
}

// Минута по часам: счётчик «через N мин» обновляется сам.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

export function NextLessonCard({ lessons, now, compact = false }) {
  const next = nextLesson(lessons, now)
  if (!next) return null
  const room = rooms.find((item) => item.id === next.lesson.roomId)
  const label = dayLabel(next.lesson.date, dateKey(now))
  const when = next.offset === 0 ? formatCountdown(next.minutes) : `${label.name.toLowerCase()}, ${label.date}`
  return <div className={`lesson-next ${next.ongoing ? 'is-ongoing' : next.offset === 0 && next.minutes <= 15 ? 'is-soon' : ''} ${compact ? 'lesson-next-compact' : ''}`}>
    <span className="lesson-next-badge">{next.ongoing ? 'Идёт сейчас' : 'Следующая пара'}</span>
    <strong className="lesson-next-subject">{next.lesson.subject}</strong>
    <span className="lesson-next-meta"><Clock size={14} /> {next.lesson.start}–{next.lesson.end}, {when}</span>
    <span className="lesson-next-meta"><MapPin size={14} /> {roomLabel(room)}, {room.floor} этаж</span>
    <Link className="lesson-next-go" to={`/route?from=entrance-1&to=${encodeURIComponent(room.id)}`}><Navigation size={15} /> Маршрут</Link>
  </div>
}

