import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, BookOpen, Check, Compass, HeartPulse, Info, Landmark, MessageCircle, RotateCcw, Shirt, Users, UtensilsCrossed } from 'lucide-react'
import { PageHeading, Reveal } from '../components/Primitives.jsx'
import { storageGet, storageSet } from '../storage.js'

// «Первая неделя»: короткий чек-лист для новичка. Каждый пункт ведёт к месту
// на карте или в нужный раздел, отметки хранятся только в браузере
// (ключ logos-start-checklist).

export const START_KEY = 'logos-start-checklist'

export const startSteps = [
  { id: 'changing-room', icon: Shirt, title: 'Где раздевалка', text: 'Первое место, куда заходят утром. Первый этаж, рядом с холлом.', to: '/route?to=changing-room', action: 'Маршрут' },
  { id: 'academic-office', icon: Landmark, title: 'Учебная часть', text: 'Расписание, справки, вопросы по учёбе — всё сюда.', to: '/route?to=academic-office', action: 'Маршрут' },
  { id: 'notifications', icon: BellRing, title: 'Включить напоминания о парах', text: 'За 5 минут до звонка телефон напомнит, что пора идти.', to: '/notifications', action: 'Включить' },
  { id: 'canteen', icon: UtensilsCrossed, title: 'Столовая', text: 'Левое крыло первого этажа. Обед для 1 и 2 курса в разное время.', to: '/route?to=canteen', action: 'Маршрут' },
  { id: 'library-214', icon: BookOpen, title: 'Библиотека', text: 'Читальный зал на втором этаже, кабинет 214.', to: '/route?to=library-214', action: 'Маршрут' },
  { id: 'medical-post', icon: HeartPulse, title: 'Медпункт', text: 'Запомните заранее: западное крыло первого этажа.', to: '/route?to=medical-post', action: 'Маршрут' },
  { id: 'psychologist-224', icon: Users, title: 'Кабинет психолога', text: 'Если тяжело или нужен совет — сюда можно прийти. Кабинет 224.', to: '/map?floor=2&room=psychologist-224', action: 'На карте' },
  { id: 'tour', icon: Compass, title: '3D-экскурсия «Первый день»', text: 'Пролёт по корпусу за 6 минут: главное, что пригодится первокурснику.', to: '/tour?id=first-day', action: 'Смотреть' },
  { id: 'ai', icon: MessageCircle, title: 'Задать вопрос помощнику', text: 'ИИ-помощник знает план корпуса и сайт колледжа — спросите что угодно.', to: '/ai', action: 'Спросить' },
]

export function readChecklist(raw = storageGet(START_KEY)) {
  try {
    const value = JSON.parse(raw || '[]')
    return Array.isArray(value) ? value.filter((id) => startSteps.some((step) => step.id === id)) : []
  } catch {
    return []
  }
}

export default function StartPage() {
  const [done, setDone] = useState(readChecklist)
  const update = (next) => { setDone(next); storageSet(START_KEY, JSON.stringify(next)) }
  const toggle = (id) => update(done.includes(id) ? done.filter((item) => item !== id) : [...done, id])
  const progress = Math.round(done.length / startSteps.length * 100)
  const finished = done.length === startSteps.length

  return <>
    <PageHeading className="page-heading-compact" title="Первая неделя" description="Девять мест и дел, с которыми первые дни в колледже пройдут спокойнее. Отмечайте, что уже сделали." />
    <section className="start-section container">
      <div className={`start-progress ${finished ? 'is-done' : ''}`} role="status">
        <div className="start-progress-copy">
          <strong>{finished ? 'Всё готово!' : `${done.length} из ${startSteps.length}`}</strong>
          <span>{finished ? 'Вы знаете колледж лучше многих. Удачной учёбы!' : 'Отметки сохраняются в этом браузере.'}</span>
        </div>
        <div className="start-progress-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        {done.length > 0 && <button type="button" className="start-reset" onClick={() => update([])}><RotateCcw size={14} /> Сбросить</button>}
      </div>
      {finished && <div className="start-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--i': index }} />)}</div>}
      <ol className="start-list">
        {startSteps.map((step, index) => {
          const Icon = step.icon
          const checked = done.includes(step.id)
          return <Reveal as="li" key={step.id} delay={index * 45} className={`start-item ${checked ? 'is-checked' : ''}`}>
            <button type="button" className="start-check" onClick={() => toggle(step.id)} aria-pressed={checked} aria-label={checked ? `Снять отметку: ${step.title}` : `Отметить: ${step.title}`}><Check size={16} /></button>
            <span className="start-icon" aria-hidden="true"><Icon size={19} /></span>
            <div className="start-copy"><strong>{step.title}</strong><span>{step.text}</span></div>
            <Link className="start-go" to={step.to} onClick={() => { if (!checked) toggle(step.id) }}>{step.action} <ArrowRight size={14} /></Link>
          </Reveal>
        })}
      </ol>
      <p className="start-hint"><Info size={15} aria-hidden="true" /> Пункт отмечается сам, когда вы переходите по его кнопке.</p>
    </section>
  </>
}
