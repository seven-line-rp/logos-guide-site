import { lazy, Suspense, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronDown } from 'lucide-react'

const CompassScene = lazy(() => import('./CompassScene.jsx'))

export default function EditionHome() {
  const track = useRef(null)
  const progress = useRef(0)
  const first = useRef(null)
  const second = useRef(null)
  useEffect(() => {
    const update = () => {
      const el = track.current
      const p = Math.max(0, Math.min(1, -el.getBoundingClientRect().top / Math.max(1, el.offsetHeight - el.firstElementChild.offsetHeight)))
      progress.current = p
      el.style.setProperty('--progress', p.toFixed(4))
      first.current.inert = p >= 0.5
      second.current.inert = p < 0.5
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  return <section className="edition-track" ref={track} id="top">
    <div className="edition-stage">
      <div className="edition-instrument" aria-hidden="true"><Suspense fallback={null}><CompassScene progress={progress} /></Suspense></div>
      <div className="edition-copy edition-intro" ref={first}>
        <h1>Логос<span>Путеводитель</span></h1>
        <div className="edition-actions"><Link to="/map">Открыть карту <ArrowUpRight size={16} /></Link><Link to="/route">Построить маршрут</Link></div>
      </div>
      <div className="edition-copy edition-next" ref={second}>
        <h2>Кто ведёт<br />пару?</h2><p>Найдите преподавателя по фамилии или предмету. В карточке — кабинет, любимые места и цитаты.</p>
        <div className="edition-actions"><Link to="/teachers">Преподаватели <ArrowUpRight size={16} /></Link></div>
      </div>
      <ChevronDown className="edition-chevron" aria-hidden="true" />
    </div>
  </section>
}
