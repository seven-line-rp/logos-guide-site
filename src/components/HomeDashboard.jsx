import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, BellRing, History, LocateFixed, Star } from 'lucide-react'
import { rooms } from '../data.js'
import { nearbyKinds, roomTitle } from '../places.js'
import { bellState, bellsFor, dateKey } from '../bells.js'
import { holidayName } from '../holidays.js'
import { useFavorites, useRecentRoutes } from './FavoriteButton.jsx'
import { RawText } from './ai-message.js'

// Текущее время, обновляется раз в полминуты: по нему считаются звонки.
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

// Что сейчас по звонкам.
function BellNow({ now }) {
  const state = bellState(now)
  if (!state) return <div className="bell-now"><BellRing size={15} /><span>{holidayName(dateKey(now)) ? `Сегодня ${holidayName(dateKey(now))}, занятий нет` : 'Сегодня выходной'}</span></div>
  const next = state.next ? `${state.next.label} в ${state.next.start}` : ''
  const text = state.kind === 'lesson' ? `Идёт ${state.bell.label === 'РОВ' ? 'РОВ' : state.bell.label}, звонок через ${state.left} мин`
    : state.kind === 'lunch' ? `Обед ${state.course} курса, ещё ${state.left} мин`
    : state.kind === 'break' ? `Перемена. ${next}, через ${state.left} мин`
    : state.kind === 'before' ? `Занятия начнутся в ${state.next.start}`
    : 'Пары на сегодня закончились'
  return <div className={`bell-now bell-now-${state.kind}`}><BellRing size={15} /><span>{text}</span></div>
}

// Звонки на сегодня списком: прошедшие бледные, текущая пара выделена.
function BellList({ now }) {
  const { bells } = bellsFor(dateKey(now))
  if (!bells.length) return null
  const minute = now.getHours() * 60 + now.getMinutes()
  const toMinute = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  return <ol className="day-bells">{bells.map((bell) => {
    const state = toMinute(bell.end) <= minute ? 'is-past' : toMinute(bell.start) <= minute ? 'is-now' : ''
    return <li key={bell.start} className={state}><span>{bell.label}</span><time>{bell.start}–{bell.end}</time></li>
  })}</ol>
}

// «Мой день» на главной: звонки на сегодня, избранные места, недавние
// маршруты и «где ближайший…». Всё личное — из браузера.
export default function HomeDashboard() {
  const now = useNow()
  const favorites = useFavorites()
  const recent = useRecentRoutes()

  return <section className="home-day container" aria-labelledby="home-day-title">
    <div className="section-top"><div><h2 id="home-day-title">Мой день</h2></div></div>
    <div className="home-day-grid">
      <article className="day-card day-card-lesson fx-spot">
        <BellNow now={now} />
        <BellList now={now} />
        <Link className="day-link" to="/notifications">Напоминать за 5 минут до пары <ArrowRight size={15} /></Link>
      </article>

      <article className="day-card fx-spot">
        <h3><Star size={17} /> Мои места</h3>
        {favorites.length || recent.length ? <>
          {favorites.length > 0 && <div className="day-chips">{favorites.slice(0, 6).map((id) => { const room = rooms.find((item) => item.id === id); return <Link key={id} className="day-chip" to={`/map?floor=${room.floor}&room=${encodeURIComponent(id)}`}><Star size={13} fill="currentColor" /><RawText text={roomTitle(id)} /></Link> })}</div>}
          {recent.length > 0 && <ul className="day-recent">{recent.slice(0, 3).map((item) => <li key={`${item.from}-${item.to}`}><Link to={`/route?from=${encodeURIComponent(item.from)}&to=${encodeURIComponent(item.to)}`}><History size={14} /><span><RawText text={roomTitle(item.from)} /> → <RawText text={roomTitle(item.to)} /></span><ArrowUpRight size={14} /></Link></li>)}</ul>}
        </> : <><p className="day-hint">Нажмите ★ у кабинета на карте или в маршруте, и он появится здесь. Недавние маршруты сохраняются сами.</p><Link className="day-link" to="/map">Выбрать на карте <ArrowRight size={15} /></Link></>}
      </article>

      <article className="day-card fx-spot">
        <h3><LocateFixed size={17} /> Где ближайший</h3>
        <p className="day-hint">Считаем от главного входа или от вашей точки на маршруте.</p>
        <div className="day-chips">{nearbyKinds.map((kind) => <Link key={kind.id} className="day-chip" to={`/route?from=entrance-1&nearest=${kind.id}`}>{kind.label}</Link>)}</div>
      </article>
    </div>
  </section>
}
