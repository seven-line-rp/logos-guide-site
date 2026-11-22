import { lazy, Suspense, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

const CompassScene = lazy(() => import('./CompassScene.jsx'))
const chapters = [
  ['Логос', 'Введите номер аудитории или выберите помещение на карте, чтобы узнать этаж и увидеть ближайший коридор.', [['Открыть карту','/map'],['Найти кабинет','/rooms']]],
  ['С этажа на этаж', 'Укажите, откуда идёте и куда нужно попасть. Для перехода между этажами можно выбрать лифт или лестницу.', [['Построить маршрут','/route']]],
  ['Перед парой', 'Найдите преподавателя по фамилии или предмету. В справочнике помещений можно уточнить кабинет, а на карте — осмотреть коридор в панораме.', [['Преподаватели','/teachers'],['Посмотреть этаж','/map']]]
]

export default function EditionHome() {
  const track = useRef(null)
  const progress = useRef(0)
  useEffect(() => {
    const el = track.current
    const panels = el.querySelectorAll('.edition-copy')
    const update = () => {
      const travel = el.offsetHeight - el.firstElementChild.offsetHeight
      const p = Math.max(0, Math.min(1, -el.getBoundingClientRect().top / Math.max(1, travel)))
      progress.current = p
      panels.forEach((panel, i) => {
        const distance = Math.abs(2 * p - i)
        panel.inert = travel > 1 && distance > 0.5
        panel.style.setProperty('--visibility', Math.max(0, Math.min(1, (0.55 - distance) * 5)))
      })
      el.style.setProperty('--progress', p)
    }
    const observer = new ResizeObserver(update)
    observer.observe(el)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => { observer.disconnect(); window.removeEventListener('scroll', update) }
  }, [])
  return <section className="edition-track" ref={track} id="top"><div className="edition-stage">
    <div className="edition-instrument" aria-hidden="true"><Suspense fallback={null}><CompassScene progress={progress} /></Suspense></div>
    {chapters.map(([title, description, links], i) => <div key={title} className={'edition-copy chapter-' + i}>
      {i === 0 ? <h1>{title}<span>Путеводитель</span></h1> : <h2>{title}</h2>}
      <p>{description}</p><div className="edition-actions">{links.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}</div>
    </div>)}
    <ChevronDown className="edition-chevron" aria-hidden="true" />
  </div></section>
}
