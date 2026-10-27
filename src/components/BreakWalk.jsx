import { useMemo, useState } from 'react'
import { ArrowRight, Check, Footprints, TimerReset } from 'lucide-react'
import { Link } from 'react-router-dom'
import { rooms } from '../data.js'
import { buildRouteOptions } from '../map-routing.js'
import { Reveal } from './Primitives.jsx'

// «Успеете за перемену?»: время пути от выбранного места до кабинетов, которые
// ищут чаще всего. Считаем по тем же коридорам и лестницам, что и маршрут
// на карте (быстрый вариант), шкала — перемена в 10 минут.
const BREAK_SECONDS = 600
const starts = ['entrance-1', 'canteen', 'auditorium-104', 'class-139', 'workshop-115']
const targets = ['physics-211', 'library-214', 'informatics-222', 'radio-lab-228', 'uav-lab-209', 'chemistry-biology-202']
const VIA = { same: 'по этажу', lift: 'на лифте', 'stairs-west': 'по западной лестнице', 'stairs-middle': 'по центральной лестнице', 'stairs-north': 'по северной лестнице' }

const roomOf = (id) => rooms.find((room) => room.id === id)
const startLabel = (room) => (room.id === 'entrance-1' ? 'Главный вход' : room.number ? `Кабинет ${room.number}` : room.name)
const targetLabel = (room) => (room.number ? `${room.name} ${room.number}` : room.name)
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

export default function BreakWalk() {
  const [from, setFrom] = useState(starts[0])
  const walks = useMemo(() => targets.map((id) => {
    const best = buildRouteOptions(from, id)[0]
    return best ? { room: roomOf(id), best } : null
  }).filter(Boolean).sort((a, b) => a.best.seconds - b.best.seconds), [from])
  const fits = walks.filter((walk) => walk.best.seconds <= BREAK_SECONDS).length

  return <section className="break-walk container section-pad" aria-labelledby="break-walk-title">
    <Reveal className="break-walk-head" variant="up">
      <div>
        <h2 id="break-walk-title">Успеете за перемену?</h2>
        <p>Сколько идти до популярных кабинетов. Перемена 10 минут, время считается так же, как в маршруте.</p>
      </div>
      <div className="break-walk-from" role="group" aria-label="Откуда идём">
        <span>Откуда идёте</span>
        <div>{starts.map((id) => <button key={id} type="button" className={id === from ? 'is-on' : ''} aria-pressed={id === from} onClick={() => setFrom(id)}>{startLabel(roomOf(id))}</button>)}</div>
      </div>
    </Reveal>
    <Reveal className="break-walk-card" variant="up" delay={80}>
      <ul className="break-walk-list" key={from}>
        {walks.map(({ room, best }, index) => {
          const ok = best.seconds <= BREAK_SECONDS
          return <li key={room.id} style={{ '--i': index, '--fill': Math.min(1, best.seconds / BREAK_SECONDS) }} className={ok ? 'is-ok' : 'is-late'}>
            <Link to={`/route?from=${from}&to=${room.id}&mode=${best.kind}`}>
              <span className="bw-name"><strong>{targetLabel(room)}</strong><small>{room.floor} этаж · {VIA[best.kind]}</small></span>
              <span className="bw-bar" aria-hidden="true"><i /></span>
              <span className="bw-time"><strong>{clock(best.seconds)}</strong><small><Footprints size={12} aria-hidden="true" />{Math.round(best.meters)} м · {best.footsteps} шагов</small></span>
              <span className="bw-badge">{ok ? <><Check size={13} aria-hidden="true" />{Math.max(1, Math.round(best.seconds / BREAK_SECONDS * 100))}% перемены</> : 'не успеете'}</span>
            </Link>
          </li>
        })}
      </ul>
      <div className="break-walk-foot">
        <span><TimerReset size={15} aria-hidden="true" />Вся шкала — 10-минутная перемена, метка справа — её конец. Успеваете до {fits} из {walks.length}.</span>
        <Link className="text-link" to="/route">Построить свой маршрут <ArrowRight size={15} /></Link>
      </div>
    </Reveal>
  </section>
}
