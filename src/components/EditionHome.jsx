import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Map as MapIcon } from 'lucide-react'
import FloorMap from './FloorMap.jsx'
import { useLanguage } from '../i18n.js'
import './compass-home.css'

const smooth = (a, b, p) => {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export default function EditionHome({ search }) {
  const track = useRef(null)
  const stage = useRef(null)
  const canvas = useRef(null)
  const copy = useRef(null)
  const plan = useRef(null)
  const [floor, setFloor] = useState(1)
  const en = useLanguage() === 'en'
  const navigate = useNavigate()

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let model,
      frame = 0,
      disposed = false
    const host = stage.current
    const intro = copy.current
    const board = plan.current
    const screen = canvas.current
    function paint() {
      frame = 0
      const trackRect = track.current.getBoundingClientRect()
      const w = host.clientWidth,
        h = host.clientHeight
      const p = Math.max(0, Math.min(1, -trackRect.top / Math.max(1, trackRect.height - h)))
      const staticScene = reduced.matches || host.dataset.webgl === 'fallback'
      const reveal = staticScene ? 1 : smooth(0.922, 0.969, p)
      const title = staticScene ? 1 : 1 - smooth(0.008, 0.14, p)
      intro.inert = title < 0.03
      board.inert = reveal < 0.98
      host.style.setProperty('--copy-alpha', title)
      host.style.setProperty('--copy-y', (title - 1) * 72 + 'px')
      host.style.setProperty('--plan-alpha', reveal)
      host.style.setProperty('--model-alpha', 1 - reveal)
      // Keep the first route segment under the needle as the plan pulls back.
      const zoom = staticScene ? 1 : 1 + 3 * (1 - smooth(0.925, 1, p))
      let x = 0,
        y = 0
      const line = board.querySelector('.plan-route-line')
      if (line && zoom > 1 && reveal > 0) {
        const matrix = line.getScreenCTM()
        if (matrix) {
          const start = line.getPointAtLength(0).matrixTransform(matrix)
          const rect = board.getBoundingClientRect()
          const scale = rect.width / board.offsetWidth
          x = (w / 2 - (start.x - rect.left) / scale) * zoom
          y = (h / 2 - (start.y - rect.top) / scale) * zoom
        }
      }
      const blend = 1 - smooth(0.942, 1, p)
      board.style.transform = staticScene
        ? ''
        : 'translate(' + x * blend + 'px,' + y * blend + 'px) scale(' + zoom + ')'
      if (model && !reduced.matches && reveal < 1) model.draw(p, w, h)
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    function load() {
      schedule()
      if (reduced.matches || model) return
      import('./compass-scene.js')
        .then(({ createCompass }) => {
          if (disposed || model || reduced.matches) return
          try {
            model = createCompass(screen)
            host.dataset.webgl = 'ready'
            schedule()
          } catch {
            host.dataset.webgl = 'fallback'
            schedule()
          }
        })
        .catch(() => {
          if (!disposed) {
            host.dataset.webgl = 'fallback'
            schedule()
          }
        })
    }
    function lost(event) {
      event.preventDefault()
      host.dataset.webgl = 'fallback'
      schedule()
      model?.dispose()
      model = null
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(host)
    observer.observe(board)
    window.addEventListener('scroll', schedule, { passive: true })
    reduced.addEventListener('change', load)
    screen.addEventListener('webglcontextlost', lost)
    screen.addEventListener('webglcontextrestored', load)
    load()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      reduced.removeEventListener('change', load)
      screen.removeEventListener('webglcontextlost', lost)
      screen.removeEventListener('webglcontextrestored', load)
      model?.dispose()
    }
  }, [])

  return (
    <div className="instrument-track" ref={track}>
      <section className="instrument-stage" ref={stage} aria-labelledby="instrument-title">
        <div className="instrument-object" aria-hidden="true">
          <img src="/art/edition-compass.webp" alt="" fetchPriority="high" />
          <canvas ref={canvas} />
        </div>
        <div className="instrument-intro" ref={copy}>
          <h1 id="instrument-title">
            <img src="/art/logos-wordmark.svg" alt={en ? 'Logos Guide' : 'Логос Путеводитель'} />
          </h1>
          <p>
            {en
              ? 'Find a room, a teacher or your way around the college.'
              : 'Найдите кабинет, преподавателя и свой путь по колледжу.'}
          </p>
          <Link className="instrument-action" to="/map">
            <MapIcon size={17} />
            {en ? 'Open map' : 'Открыть карту'}
          </Link>
        </div>
        <div className="instrument-map" ref={plan}>
          <div className="instrument-map-inner">
            <div className="instrument-map-tools">
              <div>
                <h2>
                  <label htmlFor="home-room-search">{en ? 'Find a room' : 'Найти кабинет'}</label>
                </h2>
                {search}
              </div>
              <div className="instrument-floors" role="group" aria-label={en ? 'Floor' : 'Этаж'}>
                {[1, 2].map((n) => (
                  <button key={n} type="button" aria-pressed={n === floor} onClick={() => setFloor(n)}>
                    {en ? 'Floor ' + n : n + ' этаж'}
                  </button>
                ))}
              </div>
            </div>
            <FloorMap
              floor={floor}
              compact
              routeStart="entrance-1"
              routeTargetId="canteen"
              onSelect={(room) =>
                navigate('/map?floor=' + room.floor + '&room=' + encodeURIComponent(room.id))
              }
              onFloorRequest={setFloor}
            />
            <div className="instrument-map-caption">
              <span>{floor === 1 && (en ? 'Main entrance → Canteen' : 'Главный вход → Столовая')}</span>
              <Link to={'/map?floor=' + floor}>
                {en ? 'Full map' : 'Карта целиком'} <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
