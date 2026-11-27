import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { rooms } from '../data.js'
import { roomOutline } from '../map-geometry.js'
import FloorMap from './FloorMap.jsx'
import CompassFilm from './CompassFilm.jsx'
import './compass-film.css'

const chapters = ['Обзор', 'Маршрут', 'Лестница', 'Кабинет', 'Карта']
const stops = [0, .27, .49, .69, .96]
const guideScenes = [
  { model: 'stair', label: 'Переход между этажами', title: 'На второй этаж', text: 'Маршрут начинается у главного входа. На плане первого этажа линия ведёт к лестнице, а на втором продолжается до кабинета.' },
  { model: 'plaque', label: 'Кабинет информатики', title: 'Ищите номер 222', text: 'Сверьте номер на двери с планом. Синяя отметка на стене кабинета показывает, с какой стороны вход.' },
]

const staticLayout = '(prefers-reduced-motion: reduce), (max-height: 590px) and (max-width: 760px)'
const exampleRoute = '/route?from=entrance-1&to=informatics-222'
const floorDrawing = rooms.filter(room => room.floor === 2)
  .map(room => 'M' + roomOutline(room.id).map(point => point.join(',')).join('L') + 'Z').join(' ')
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
  const scenePanels = useRef([])
  const [floor, setFloor] = useState(2)
  const [chapter, setChapter] = useState(0)

  useEffect(() => {
    const el = stage.current
    const sticky = el.firstElementChild
    const introduction = intro.current
    const routePanel = route.current
    const atlas = plan.current
    const chapterNav = sticky.querySelector(".instrument-index")
    const places = sticky.querySelector('.instrument-places')
    const reduced = matchMedia(staticLayout)
    let frame = 0
    function draw() {
      frame = 0
      const staticView = reduced.matches
      const p = clamp(-el.getBoundingClientRect().top / Math.max(1, el.offsetHeight - sticky.clientHeight))
      const shift = ramp(.035, .24, p)
      const disperse = ramp(.065, .25, p) * (1 - ramp(.35, .45, p))
      const introFade = ramp(.035, .16, p)
      const routeOpacity = ramp(.13, .23, p) * (1 - ramp(.33, .42, p))
      const stair = ramp(.35, .44, p) * (1 - ramp(.55, .62, p))
      const plaque = ramp(.55, .64, p) * (1 - ramp(.745, .835, p))
      const interlude = ramp(.32, .41, p) * (1 - ramp(.75, .845, p))
      el.style.setProperty('--compass-alpha', (1 - interlude).toFixed(4))
      const alphas = [stair, plaque]
      alphas.forEach((alpha, i) => {
        const panel = scenePanels.current[i]
        panel.style.setProperty('--scene-alpha', alpha.toFixed(4))
        panel.inert = !staticView && alpha < .5
      })
      el.style.setProperty('--travel', p.toFixed(4))
      el.style.setProperty('--shift', shift.toFixed(4))
      el.style.setProperty('--open', disperse.toFixed(4))
      el.style.setProperty('--dive', ramp(.802, .95, p).toFixed(4))
      el.style.setProperty('--intro-alpha', (1 - introFade).toFixed(4))
      el.style.setProperty('--route-alpha', routeOpacity.toFixed(4))
      const aperture = ramp(.85, .95, p)
      el.style.setProperty('--aperture', aperture.toFixed(4))
      atlas.inert = !staticView && p < .95
      chapterNav.inert = !staticView && p >= .85
      introduction.inert = !staticView && introFade > .9
      places.inert = introduction.inert
      routePanel.inert = !staticView && routeOpacity < .1
      setChapter(staticView || p < .17 ? 0 : p < .39 ? 1 : p < .59 ? 2 : p < .84 ? 3 : 4)
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

  function goToChapter(index, keyboard = false) {
    const el = stage.current
    const reduced = matchMedia(staticLayout).matches
    const target = [intro.current, route.current, ...scenePanels.current, plan.current][index]
    if (reduced && index !== 0) {
      window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - (index === 4 ? 0 : 74), behavior: reduced ? 'instant' : 'smooth' })
      target.focus({ preventScroll: true })
      return
    }
    const distance = el.offsetHeight - el.firstElementChild.clientHeight
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top + distance * stops[index], behavior: reduced || keyboard ? 'instant' : 'smooth' })
    if (keyboard) {
      target.inert = false
      target.focus({ preventScroll: true })
    }
  }

  function openRoomSearch() {
    const el = stage.current
    const top = matchMedia(staticLayout).matches
      ? plan.current.getBoundingClientRect().top
      : el.getBoundingClientRect().top + .95 * (el.offsetHeight - el.firstElementChild.clientHeight)
    window.scrollTo({ top: window.scrollY + top, behavior: 'instant' })
    plan.current.inert = false
    plan.current.querySelector('#home-room-search')?.focus({ preventScroll: true })
  }

  return <div className="instrument-home" id="top">
    <section ref={stage} className="instrument-stage" aria-labelledby="instrument-title">
      <div className="instrument-sticky">
        <div className="instrument-terrain" aria-hidden="true">
          <svg className="instrument-drawing" viewBox="0 0 767 561" preserveAspectRatio="xMidYMid slice"><path d={floorDrawing} /></svg>
        </div>
        <div className="instrument-intro" ref={intro} tabIndex={-1}>
          <h1 id="instrument-title"><span>Логос</span>Путеводитель</h1>
          <p>Найдите кабинет, преподавателя или дорогу от входа до пары.</p>
          <div className="instrument-actions">
            <Link className="instrument-primary" to="/map">Открыть карту</Link>
            <button type="button" onClick={openRoomSearch}><Search size={16} aria-hidden="true" />Найти кабинет</button>
          </div>
        </div>
        <nav className="instrument-places" aria-label="Частые направления">
          <Link to="/map?floor=1&room=canteen">Столовая</Link>
          <Link to="/map?floor=2&room=library-214">Библиотека</Link>
          <Link to="/map?floor=1&room=auditorium-104">Актовый зал</Link>
        </nav>
        <CompassFilm />
        <div className="instrument-route" ref={route} tabIndex={-1}>
          <img className="instrument-static-exploded" src="/instrument/exploded.webp" loading="lazy" alt="" />
          <h2><span>Кабинет информатики </span>222</h2>
          <div className="instrument-itinerary">
            <div><i aria-hidden="true"/><span>Главный вход</span><small>1 этаж</small></div>
            <div><i aria-hidden="true"/><span>Кабинет 222</span><small>2 этаж</small></div>
          </div>
          <Link className="instrument-primary" to={exampleRoute}>Открыть маршрут</Link>
        </div>
        {guideScenes.map(({ model, label, title, text }, i) => <section key={model} className="instrument-guide-scene"
          ref={node => { scenePanels.current[i] = node }} tabIndex={-1} aria-labelledby={model + '-title'}>
          <div className="instrument-guide-copy">
            <p className="instrument-guide-label">{label}</p>
            <h2 id={model + '-title'}>{title}</h2>
            <p>{text}</p>
          </div>
          <img src={'/instrument/' + model + '.webp'} alt="" width="900" height="760" />
        </section>)}
        <nav className="instrument-index" aria-label="Разделы главной страницы">
          <div className="instrument-chapters">
            {chapters.map((name, i) => <button key={name} type="button" onClick={event => goToChapter(i, event.detail === 0)} aria-current={chapter === i ? 'step' : undefined}><i aria-hidden="true" />{name}</button>)}
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
          </header>
          <div className="instrument-atlas-sheet">
            <FloorMap floor={floor} routeStart="entrance-1" routeTargetId="informatics-222"
              onSelect={room => navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)}
              onFloorRequest={setFloor} />
          </div>
          <footer className="instrument-atlas-key">
            <Link to={exampleRoute}><span className="instrument-line-sample" aria-hidden="true" />Главный вход <ArrowRight size={14} /> кабинет 222</Link>
            <Link to="/rooms">Все кабинеты</Link>
            <Link className="instrument-map-launch" to={`/map?floor=${floor}`}>Открыть карту</Link>
          </footer>
        </section>
      </div>
    </section>
  </div>
}
