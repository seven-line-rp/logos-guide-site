import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
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
    const atlas = plan.current
    const chapterNav = sticky.querySelector("nav")
    const reduced = matchMedia(staticLayout)
    let frame = 0
    function draw() {
      frame = 0
      const staticView = reduced.matches
      const p = clamp(-el.getBoundingClientRect().top / Math.max(1, el.offsetHeight - sticky.clientHeight))
      const shift = ramp(.055, .50, p)
      const disperse = ramp(.10, .5, p) * (1 - ramp(.61, .79, p))
      const introFade = ramp(.035, .24, p)
      const routeOpacity = ramp(.23, .48, p) * (1 - ramp(.61, .76, p))
      el.style.setProperty('--travel', p.toFixed(4))
      el.style.setProperty('--shift', shift.toFixed(4))
      el.style.setProperty('--open', disperse.toFixed(4))
      el.style.setProperty('--dive', ramp(.65, .93, p).toFixed(4))
      el.style.setProperty('--intro-alpha', (1 - introFade).toFixed(4))
      el.style.setProperty('--route-alpha', routeOpacity.toFixed(4))
      const aperture = ramp(.75, .93, p)
      el.style.setProperty('--aperture', aperture.toFixed(4))
      atlas.inert = !staticView && p < .93
      chapterNav.inert = !staticView && p >= .74
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
    if (reduced && index !== 0) {
      const target = index === 2 ? plan.current : route.current
      window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - (index === 2 ? 0 : 74), behavior: reduced ? 'instant' : 'smooth' })
      target.focus({ preventScroll: true })
      return
    }
    const distance = el.offsetHeight - el.firstElementChild.clientHeight
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top + distance * [0, .56, .95][index], behavior: reduced ? 'instant' : 'smooth' })
  }

  return <div className="instrument-home" id="top">
    <section ref={stage} className="instrument-stage" aria-labelledby="instrument-title">
      <div className="instrument-sticky">
        <div className="instrument-terrain" aria-hidden="true" />
        <div className="instrument-intro" ref={intro}>
          <h1 id="instrument-title">Логос <span>Путеводитель</span></h1>
          <p>Найдите нужный кабинет и дорогу до следующей пары.</p>
          <div className="instrument-actions">
            <Link className="instrument-primary" to="/map">Открыть карту<ArrowUpRight size={16} /></Link>
            <button type="button" onClick={() => goToChapter(2)}>Найти кабинет<ArrowDown size={15} /></button>
          </div>
        </div>
        <CompassFilm />
        <div className="instrument-route" ref={route} tabIndex={-1}>
          <img className="instrument-static-exploded" src="/instrument/exploded.webp" loading="lazy" alt="" />
          <h2><span>Кабинет</span>222</h2>
          <div className="instrument-itinerary">
            <div><i aria-hidden="true"/><span>Главный вход</span><small>1 этаж</small></div>
            <div><i aria-hidden="true"/><span>Кабинет информатики</span><small>2 этаж</small></div>
          </div>
          <Link className="instrument-primary" to={exampleRoute}>Открыть маршрут<ArrowUpRight size={17} /></Link>
        </div>
        <nav className="instrument-index" aria-label="Разделы главной страницы">
          <div className="instrument-chapters">
            {['Обзор', 'Маршрут', 'План этажей'].map((name, i) => <button key={name} type="button" onClick={() => goToChapter(i)} aria-current={chapter === i ? 'step' : undefined}><i aria-hidden="true" />{name}</button>)}
          </div>
        </nav>
        <section className="instrument-plan" ref={plan} tabIndex={-1} aria-labelledby="instrument-plan-title">
          <header className="instrument-atlas-tools">
            <h2 id="instrument-plan-title">План этажей</h2>
            <div className="edition-search instrument-atlas-search">
              <label htmlFor="home-room-search">Поиск по колледжу</label>
              {search}
            </div>
            <div className="instrument-floors" role="group" aria-label="Выбор этажа">
              {[1, 2].map(n => <button type="button" key={n} aria-pressed={floor === n} onClick={() => setFloor(n)}>{n} этаж</button>)}
            </div>
            <Link className="instrument-map-launch" to={`/map?floor=${floor}`}>Открыть карту<ArrowUpRight size={16} /></Link>
          </header>
          <div className="instrument-atlas-sheet">
            <FloorMap floor={floor} routeStart="entrance-1" routeTargetId="informatics-222"
              onSelect={room => navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)}
              onFloorRequest={setFloor} />
          </div>
          <footer className="instrument-atlas-key">
            <Link to={exampleRoute}><span className="instrument-line-sample" aria-hidden="true" />Главный вход <ArrowRight size={14} /> кабинет 222</Link>
            <Link to="/rooms">Все кабинеты<ArrowUpRight size={15} /></Link>
          </footer>
        </section>
      </div>
    </section>
  </div>
}
