import { lazy, Suspense, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

const CompassScene = lazy(() => import('./CompassScene.jsx'))
const chapters = [
  { name: 'Ориентиры', title: 'Логос', subtitle: 'Путеводитель', text: 'Найди нужный кабинет, открой карту колледжа и проложи маршрут — уверенно, с первого шага.', links: [['Открыть карту', '/map'], ['Найти кабинет', '/rooms']] },
  { name: 'Между этажами', title: 'На этаж выше', text: 'От входа до нужной аудитории — понятный маршрут с выбором лестницы или лифта и голосовыми подсказками на поворотах.', links: [['Построить маршрут', '/route'], ['Лифт на карте', '/map?floor=1&room=lift-1']] },
  { name: 'Библиотека', title: 'В читальный зал', text: 'Библиотека на втором этаже, кабинет №214. Открывай любимые места преподавателей и находи свой путь по колледжу.', links: [['В библиотеку', '/route?to=library-214'], ['Преподаватели', '/teachers']] },
]
export default function EditionHome() {
  const track = useRef(null)
  const progress = useRef(0)
  const nav = useRef(null)
  useLayoutEffect(() => {
    const el = track.current
    const panels = el.querySelectorAll('.edition-copy')
    function update() {
      const distance = el.offsetHeight - el.firstElementChild.offsetHeight
      const value = Math.max(0, Math.min(2, -2 * el.getBoundingClientRect().top / Math.max(1, distance)))
      progress.current = value
      const active = Math.round(value)
      panels.forEach((panel, i) => {
        const delta = Math.min(1, Math.abs(i - value))
        panel.style.opacity = Math.max(0, 1 - delta * 2.25)
        panel.inert = i !== active
        nav.current.children[i].setAttribute('aria-current', i === active ? 'step' : 'false')
      })
      el.dataset.chapter = active
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  function jump(i) {
    const el = track.current
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top + i * (el.offsetHeight - el.firstElementChild.offsetHeight) / 2,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return <section className="edition-track" ref={track} id="top">
    <div className="edition-stage">
      <div className="edition-instrument" aria-hidden="true"><Suspense fallback={null}><CompassScene progress={progress} /></Suspense></div>
      {chapters.map(({title, subtitle, text, links}, i) => <div className={'edition-copy ' + (i ? 'edition-side' : 'edition-intro')} key={title}>
        {i ? <h2>{title}</h2> : <h1>{title}<span>{subtitle}</span></h1>}
        <p>{text}</p>
        <div className="edition-actions">{links.map(([label, url], j) => <Link to={url} key={url}>{label}{!j && <ArrowUpRight size={16} />}</Link>)}</div>
      </div>)}
      <nav className="edition-index" aria-label="Сцены путеводителя" ref={nav}>{chapters.map(({name},i) => <button type="button" key={name} onClick={() => jump(i)}>{name}</button>)}</nav>
    </div>
  </section>
}
