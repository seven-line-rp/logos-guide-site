import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, LocateFixed, Map, Route } from 'lucide-react'
import FloorMap from './FloorMap.jsx'
import CompassFilm from './CompassFilm.jsx'
import './compass-film.css'

const staticLayout = '(prefers-reduced-motion: reduce), (max-height: 590px) and (max-width: 760px)'
const exampleRoute = '/route?from=entrance-1&to=informatics-222'
const clamp = value => Math.max(0, Math.min(1, value))
function ramp(start, end, progress) {
  const t = clamp((progress - start) / (end - start))
  return t * t * (3 - 2 * t)
}

export default function EditionHome({ search }) {
  const navigate = useNavigate()
  const stage = useRef(null)
  const intro = useRef(null)
  const route = useRef(null)
  const plan = useRef(null)
  const [floor, setFloor] = useState(1)
  const [chapter, setChapter] = useState(0)

  useEffect(() => {
    const el = stage.current
    const sticky = el.firstElementChild
    const introduction = intro.current
    const routePanel = route.current
    const reduced = matchMedia(staticLayout)
    let frame = 0
    function draw() {
      frame = 0
      const staticView = reduced.matches
      const p = clamp(-el.getBoundingClientRect().top / Math.max(1, el.offsetHeight - sticky.clientHeight))
      const shift = ramp(.055, .50, p)
      const disperse = ramp(.10, .5, p) * (1 - ramp(.73, 1, p))
      const introFade = ramp(.035, .24, p)
      const routeOpacity = ramp(.23, .48, p) * (1 - ramp(.79, .97, p))
      el.style.setProperty('--travel', p.toFixed(4))
      el.style.setProperty('--shift', shift.toFixed(4))
      el.style.setProperty('--open', disperse.toFixed(4))
      el.style.setProperty('--dive', ramp(.84, 1, p).toFixed(4))
      el.style.setProperty('--intro-alpha', (1 - introFade).toFixed(4))
      el.style.setProperty('--route-alpha', routeOpacity.toFixed(4))
      introduction.inert = !staticView && introFade > .9
      routePanel.inert = !staticView && routeOpacity < .1
      setChapter(staticView || p < .31 ? 0 : 1)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    reduced.addEventListener('change', schedule)
    draw()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      reduced.removeEventListener('change', schedule)
    }
  }, [])

  function goToChapter(index) {
    const el = stage.current
    const reduced = matchMedia(staticLayout).matches
    if (index === 2 || (index === 1 && reduced)) {
      const target = index === 2 ? plan.current : route.current
      window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - (index === 2 ? 0 : 74), behavior: reduced ? 'instant' : 'smooth' })
      target.focus({ preventScroll: true })
      return
    }
    const distance = el.offsetHeight - el.firstElementChild.clientHeight
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top + distance * (index === 1 ? .56 : 0), behavior: reduced ? 'instant' : 'smooth' })
  }

  return <div className="instrument-home" id="top">
    <section ref={stage} className="instrument-stage" aria-labelledby="instrument-title">
      <div className="instrument-sticky">
        <div className="instrument-terrain" aria-hidden="true" />
        <div className="instrument-intro" ref={intro}>
          <div className="instrument-caption"><span className="survey-cross" aria-hidden="true" />Навигация по колледжу</div>
          <h1 id="instrument-title">Логос <span>Путеводитель</span></h1>
          <p>Найдите нужный кабинет и дорогу до следующей пары.</p>
          <div className="instrument-actions">
            <Link className="instrument-primary" to="/map"><Map size={17} />Открыть карту<ArrowUpRight size={16} /></Link>
            <button type="button" onClick={() => goToChapter(2)}>Найти кабинет<ArrowDown size={15} /></button>
          </div>
        </div>
        <CompassFilm />
        <div className="instrument-route" ref={route} tabIndex={-1}>
          <img className="instrument-static-exploded" src="/instrument/exploded.webp" loading="lazy" alt="" />
          <div className="instrument-caption"><Route size={16} />Пример маршрута</div>
          <h2>От входа <br/>до кабинета.</h2>
          <div className="instrument-itinerary">
            <div><i aria-hidden="true"/><span>Главный вход</span><small>1 этаж</small></div>
            <div><i aria-hidden="true"/><span>Информатика · 222</span><small>2 этаж</small></div>
          </div>
          <Link className="instrument-primary" to={exampleRoute}>Открыть маршрут<ArrowUpRight size={17} /></Link>
        </div>
        <nav className="instrument-index" aria-label="Разделы главной страницы">
          <div className="instrument-chapters">
            {['Обзор', 'Маршрут', 'План этажей'].map((name, i) => <button key={name} type="button" onClick={() => goToChapter(i)} aria-current={chapter === i ? 'step' : undefined}><i aria-hidden="true" />{name}</button>)}
          </div>
          <button className="instrument-next" type="button" onClick={() => goToChapter(chapter + 1)}><span>{chapter === 0 ? 'К маршруту' : 'К плану'}</span><ArrowDown size={16} /></button>
        </nav>
      </div>
    </section>
    <section className="instrument-plan" ref={plan} tabIndex={-1} aria-labelledby="instrument-plan-title">
      <div className="instrument-plan-inner">
        <div className="instrument-plan-copy">
          <div className="instrument-caption"><LocateFixed size={16} />План этажей</div>
          <h2 id="instrument-plan-title">Найти <br/>кабинет.</h2>
          <p>Выберите помещение на плане или введите номер кабинета, название или фамилию преподавателя.</p>
          <div className="edition-search"><label htmlFor="home-room-search">Поиск по колледжу</label>{search}</div>
          <Link className="instrument-text-link" to="/rooms">Все кабинеты<ArrowUpRight size={16} /></Link>
        </div>
        <div className="instrument-plan-board">
          <div className="instrument-board-head"><strong>Карта колледжа</strong><div className="instrument-floors" role="group" aria-label="Выбор этажа">
            {[1, 2].map(n => <button type="button" key={n} aria-pressed={floor === n} onClick={() => setFloor(n)}>{n} этаж</button>)}
          </div></div>
          <FloorMap floor={floor} compact onSelect={room => navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)} onFloorRequest={setFloor}/>
          <Link className="instrument-board-link" to={`/map?floor=${floor}`}>Открыть карту<ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>
  </div>
}
