import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BellRing, CalendarPlus, Compass, History, LocateFixed, Star } from 'lucide-react'
import { rooms } from '../data.js'
import { nearbyKinds, roomTitle } from '../places.js'
import { tours } from '../tours.js'
import { bellState, dateKey, nextLesson } from '../schedule.js'
import { holidayName } from '../holidays.js'
import { useFavorites, useRecentRoutes } from './FavoriteButton.jsx'
import { NextLessonCard, useNow, useSchedule } from './NextLesson.jsx'
import { RawText } from './ai-message.js'

// Что сейчас по звонкам — видно и без своего расписания.
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

// «Мой день» на главной: следующая пара с маршрутом, избранные места и
// недавние маршруты, «где ближайший…» и экскурсии. Всё личное — из браузера.
export default function HomeDashboard() {
  const lessons = useSchedule()
  const now = useNow()
  const favorites = useFavorites()
  const recent = useRecentRoutes()

  return <section className="home-day container" aria-labelledby="home-day-title">
    <div className="section-top"><div><h2 id="home-day-title">Мой день</h2></div></div>
    <div className="home-day-grid">
      <article className="day-card day-card-lesson">
        <BellNow now={now} />
        {nextLesson(lessons, now) ? <NextLessonCard lessons={lessons} now={now} compact /> : <div className="day-empty">
          <span className="day-icon"><CalendarPlus size={20} /></span>
          <strong>{lessons.length ? 'Новых пар пока нет' : 'Добавьте своё расписание'}</strong>
          <p>{lessons.length ? 'Расписание каждый день новое. Добавьте пары на завтра.' : 'Покажем следующую пару, сколько до неё осталось и как дойти.'}</p>
        </div>}
        <Link className="day-link" to="/schedule">{lessons.length ? 'Всё расписание' : 'Заполнить расписание'} <ArrowRight size={15} /></Link>
      </article>

      <article className="day-card">
        <h3><Star size={17} /> Мои места</h3>
        {favorites.length || recent.length ? <>
          {favorites.length > 0 && <div className="day-chips">{favorites.slice(0, 6).map((id) => { const room = rooms.find((item) => item.id === id); return <Link key={id} className="day-chip" to={`/map?floor=${room.floor}&room=${encodeURIComponent(id)}`}><Star size={13} fill="currentColor" /><RawText text={roomTitle(id)} /></Link> })}</div>}
          {recent.length > 0 && <ul className="day-recent">{recent.slice(0, 3).map((item) => <li key={`${item.from}-${item.to}`}><Link to={`/route?from=${encodeURIComponent(item.from)}&to=${encodeURIComponent(item.to)}`}><History size={14} /><span><RawText text={roomTitle(item.from)} /> → <RawText text={roomTitle(item.to)} /></span><ArrowUpRight size={14} /></Link></li>)}</ul>}
        </> : <p className="day-hint">Нажмите ★ у кабинета на карте или в маршруте, и он появится здесь. Недавние маршруты сохраняются сами.</p>}
      </article>

      <article className="day-card">
        <h3><LocateFixed size={17} /> Где ближайший</h3>
        <p className="day-hint">Считаем от главного входа или от вашей точки на маршруте.</p>
        <div className="day-chips">{nearbyKinds.map((kind) => <Link key={kind.id} className="day-chip" to={`/route?from=entrance-1&nearest=${kind.id}`}>{kind.label}</Link>)}</div>
      </article>

      <article className="day-card day-card-tour">
        <h3><Compass size={17} /> Экскурсия в 3D</h3>
        <div className="day-tours">{tours.map((tour) => <Link key={tour.id} to={`/tour?id=${tour.id}`} className="day-tour"><strong>{tour.title}</strong><small>{tour.subtitle}, {tour.stops.length} остановок, ~{tour.minutes} мин</small><ArrowRight size={16} /></Link>)}</div>
      </article>
    </div>
  </section>
}
