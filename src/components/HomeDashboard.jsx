import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BellRing, History, Star } from 'lucide-react'
import { rooms } from '../data.js'
import { nearbyKinds, roomTitle } from '../places.js'
import { bellsFor, dateKey, dayStatus, parseDateKey, toMinutes } from '../bells.js'
import { useFavorites, useRecentRoutes } from './FavoriteButton.jsx'
import { RawText } from './ai-message.js'

const WEEKDAYS = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу']
const dayWord = (upcoming) => upcoming.inDays === 1 ? 'Завтра' : `${WEEKDAYS[parseDateKey(upcoming.key).getDay()][0].toUpperCase()}${WEEKDAYS[parseDateKey(upcoming.key).getDay()].slice(1)}`

// Карточка «Мой день»: что идёт сейчас или будет следующим, по звонкам.
// Аудитории и дисциплины здесь нет: расписания групп на сайте пока нет
// (см. docs/ux-ui-spec.md, допущение Д-1). Выдумывать их нельзя.
// Объявление для скринридера — только при смене статуса (aria-live на
// статусе, а не на минутном таймере), чтобы он не говорил каждую минуту.
export function LessonCard({ now, compact = false }) {
  const status = dayStatus(now)
  const hasBell = status.kind === 'now' || status.kind === 'soon' || status.kind === 'next'
  return <article className={`myday-card myday-${status.kind}${compact ? ' myday-compact' : ''}`} aria-labelledby="myday-status">
    <p className="myday-chip" id="myday-status" aria-live="polite"><span className="myday-dot" aria-hidden="true" />{status.label}</p>
    {hasBell ? <>
      <h3 className="myday-title">{status.bell.label}</h3>
      <p className="myday-meta"><time>{status.bell.start}–{status.bell.end}</time>{status.kind !== 'now' && status.pause ? <span> · {status.pause}</span> : null}</p>
      <p className="myday-countdown"><strong>{status.countdown}</strong>{status.kind === 'now' && status.after ? <span>Дальше: {status.after.label} в {status.after.start}</span> : null}</p>
    </> : status.upcoming ? <>
      <h3 className="myday-title">{dayWord(status.upcoming)} в {status.upcoming.bell.start}</h3>
      <p className="myday-meta">{status.upcoming.bell.label}</p>
    </> : null}
    <div className="myday-actions">
      <Link className="button button-white myday-action" to="/schedule">Все звонки <ArrowRight size={15} aria-hidden="true" /></Link>
      {!compact && <Link className="myday-link" to="/notifications"><BellRing size={15} aria-hidden="true" /> Напоминать за 5 минут</Link>}
    </div>
  </article>
}

// Звонки на день списком: прошедшие бледнее, текущая пара выделена.
export function DayBells({ now, date = now }) {
  const key = dateKey(date)
  const { bells, lunch } = bellsFor(key)
  if (!bells.length) return null
  const today = key === dateKey(now)
  const minute = now.getHours() * 60 + now.getMinutes()
  const state = (start, end) => !today ? '' : toMinutes(end) <= minute ? 'is-past' : toMinutes(start) <= minute ? 'is-now' : ''
  const items = [...bells.map((bell) => ({ ...bell, kind: 'pair' })), ...lunch.map((item) => ({ label: `Обед ${item.course} курса`, start: item.start, end: item.end, kind: 'lunch' }))]
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  return <ol className="day-bells">{items.map((item) => {
    const cls = state(item.start, item.end)
    return <li key={`${item.kind}-${item.start}`} className={`${cls} day-bell-${item.kind}`} aria-current={cls === 'is-now' ? 'time' : undefined}><span>{item.label}</span><time>{item.start}–{item.end}</time></li>
  })}</ol>
}

// Избранные места и недавние маршруты — из браузера, без регистрации.
export function MyPlaces() {
  const favorites = useFavorites()
  const recent = useRecentRoutes()
  return <article className="myday-places">
    <h3><Star size={16} aria-hidden="true" /> Мои места</h3>
    {favorites.length || recent.length ? <>
      {favorites.length > 0 && <div className="day-chips">{favorites.slice(0, 6).map((id) => { const room = rooms.find((item) => item.id === id); return room && <Link key={id} className="day-chip" to={`/map?floor=${room.floor}&room=${encodeURIComponent(id)}`}><Star size={13} fill="currentColor" aria-hidden="true" /><RawText text={roomTitle(id)} /></Link> })}</div>}
      {recent.length > 0 && <ul className="day-recent">{recent.slice(0, 3).map((item) => <li key={`${item.from}-${item.to}`}><Link to={`/route?from=${encodeURIComponent(item.from)}&to=${encodeURIComponent(item.to)}`}><History size={14} aria-hidden="true" /><span><RawText text={roomTitle(item.from)} /> → <RawText text={roomTitle(item.to)} /></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>)}</ul>}
    </> : <p className="day-hint">Нажмите ★ у кабинета на карте, и он появится здесь. Недавние маршруты сохраняются сами.</p>}
  </article>
}

// «Где ближайший…»: маршрут от главного входа до ближайшего места нужного вида.
export function NearbyStrip() {
  return <section className="nearby-strip container" aria-labelledby="nearby-title">
    <h2 id="nearby-title">Где ближайший</h2>
    <div className="day-chips">{nearbyKinds.map((kind) => <Link key={kind.id} className="day-chip" to={`/route?from=entrance-1&nearest=${kind.id}`}>{kind.label}</Link>)}</div>
  </section>
}
