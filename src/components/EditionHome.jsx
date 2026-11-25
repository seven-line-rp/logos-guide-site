import { lazy, Suspense, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Compass, Map as MapIcon, Mouse } from 'lucide-react'

const CompassScene = lazy(() => import('./CompassScene.jsx'))
const chapters = [
  { name: 'Ориентиры', title: 'Логос', subtitle: 'Путеводитель', text: 'Введите номер, название или фамилию преподавателя. Кабинет откроется на карте, оттуда можно построить маршрут.', links: [['Начать путешествие', '/rooms'], ['Открыть карту', '/map']] },
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
        const proximity = Math.max(0, 1 - delta)
        panel.style.opacity = (proximity * proximity * (3 - 2 * proximity)).toFixed(3)
        panel.style.filter = 'blur(' + ((1-proximity)*5) + 'px)'
        panel.style.translate = '0 ' + ((i-value)*12) + 'px'
        panel.inert = i !== active
        nav.current.children[i].setAttribute('aria-current', i === active ? 'step' : 'false')
      })
      el.dataset.chapter = active
      el.style.setProperty('--progress', String(value / 2))
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
      <svg className="edition-lines" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <use className="edition-lines-outer" href="/art/edition-background.svg#outer" />
        <use className="edition-lines-inner" href="/art/edition-background.svg#inner" />
      </svg>
      <div className="edition-instrument" aria-hidden="true">
        <Suspense fallback={null}><CompassScene progress={progress} /></Suspense>
        <img className="edition-compass" src="/art/edition-compass.webp" alt="" fetchPriority="high" />
      </div>
      {chapters.map(({title, subtitle, text, links}, i) => <div className={'edition-copy ' + (i ? 'edition-side' : 'edition-intro')} key={title}>
        {i ? <h2>{title}</h2> : <h1><img src="/art/logos-wordmark.svg" alt={title + " " + subtitle} width="722" height="146" /></h1>}
        <p>{text}</p>
        <div className="edition-actions">{links.map(([label, url], j) => <Link to={url} key={url}>{label}{i === 0 ? (j === 0 ? <Compass size={18} /> : <MapIcon size={18} />) : !j && <ArrowUpRight size={16} />}</Link>)}</div>
      </div>)}
      <button className="edition-next" type="button" onClick={() => jump(1)}><Mouse size={18} aria-hidden="true" />Прокрутите вниз</button>
      <nav className="edition-index" aria-label="Сцены путеводителя" ref={nav}>{chapters.map(({name},i) => <button type="button" key={name} onClick={() => jump(i)}>{name}</button>)}</nav>
    </div>
  </section>
}
