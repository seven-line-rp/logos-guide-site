import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CalendarDays, Copy, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { rooms } from '../data.js'
import RoomSearchSelect, { roomLabel } from '../components/RoomSearchSelect.jsx'
import { addDays, bellsFor, dateKey, dayLabel, saveSchedule, toMinutes } from '../schedule.js'
import { functionalStorageAllowed } from '../consent.js'
import { NextLessonCard, useNow, useSchedule } from '../components/NextLesson.jsx'

// «Моё расписание»: пары каждый день новые, поэтому их вводят на конкретную
// дату. Звонки подставляются сами (понедельник с РОВ — отдельно).

function BellsCard({ dayKey }) {
  const { bells, lunch } = bellsFor(dayKey)
  if (!bells.length) return null
  return <div className="bells-card">
    <h2><BellRing size={17} /> Звонки: {dayLabel(dayKey).weekday}</h2>
    <ol>{bells.map((bell) => <li key={bell.label}><span>{bell.label}</span><strong>{bell.start}–{bell.end}</strong></li>)}</ol>
    <div className="bells-lunch">{lunch.map((item) => <span key={item.course}><UtensilsCrossed size={13} /> Обед {item.course} курса, {item.start}–{item.end}</span>)}</div>
  </div>
}

export default function SchedulePage() {
  const lessons = useSchedule()
  const now = useNow()
  const today = dateKey(now)
  const [day, setDay] = useState(today)
  const { bells } = bellsFor(day)
  const [pair, setPair] = useState(null)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:30')
  const [subject, setSubject] = useState('')
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index)), [today])
  const dayLessons = useMemo(() => lessons.filter((lesson) => lesson.date === day), [lessons, day])
  // Ближайший прошлый день с парами — чтобы скопировать похожее расписание.
  const copySource = useMemo(() => [...new Set(lessons.map((lesson) => lesson.date))].filter((date) => date < day).sort().at(-1), [lessons, day])
  const saving = functionalStorageAllowed()

  // Следующая свободная пара этого дня подставляется сама.
  useEffect(() => {
    const taken = new Set(dayLessons.map((lesson) => lesson.start))
    const free = bells.find((bell) => !taken.has(bell.start)) || bells[0]
    if (free) { setPair(free.pair); setStart(free.start); setEnd(free.end) }
  }, [day, dayLessons, bells])

  const choosePair = (bell) => { setPair(bell.pair); setStart(bell.start); setEnd(bell.end) }
  const add = (event) => {
    event.preventDefault()
    if (!subject.trim()) return setError('Напишите название пары.')
    if (!roomId) return setError('Выберите кабинет.')
    if (toMinutes(end) <= toMinutes(start)) return setError('Конец пары должен быть позже начала.')
    saveSchedule([...lessons, { id: `l${Date.now().toString(36)}`, date: day, start, end, subject: subject.trim().slice(0, 60), roomId }])
    setSubject('')
    setRoomId('')
    setError('')
  }
  const remove = (lesson) => saveSchedule(lessons.filter((item) => item !== lesson))
  const clearDay = () => saveSchedule(lessons.filter((lesson) => lesson.date !== day))
  const copyFrom = () => {
    const source = lessons.filter((lesson) => lesson.date === copySource)
    saveSchedule([...lessons.filter((lesson) => lesson.date !== day), ...source.map((lesson, index) => ({ ...lesson, id: `l${Date.now().toString(36)}${index}`, date: day }))])
  }

  return <section className="schedule-page container">
    <header className="schedule-head">
      <h1>Расписание</h1>
      <p>Расписание в колледже каждый день новое, поэтому пары добавляются на конкретный день. На главной появится следующая пара с маршрутом, а навигатор подскажет, успеваете ли вы. Всё хранится только в этом браузере.</p>
      {!saving && <p className="schedule-warn">Вы отказались от функциональных cookie, поэтому расписание не сохранится после перезагрузки.</p>}
    </header>

    <div className="schedule-layout">
      <div className="schedule-main">
        <div className="schedule-days" role="tablist" aria-label="День">
          {days.map((key) => {
            const label = dayLabel(key, today)
            const count = lessons.filter((lesson) => lesson.date === key).length
            const sunday = !bellsFor(key).bells.length
            return <button type="button" role="tab" key={key} aria-selected={day === key} className={sunday ? 'is-off' : ''} onClick={() => setDay(key)}>
              <span>{label.name}</span><small>{label.date}</small>{count > 0 && <i>{count}</i>}
            </button>
          })}
        </div>
        <div className="schedule-day-head">
          <h2 className="schedule-day-title"><CalendarDays size={18} /> {dayLabel(day, today).name}, {dayLabel(day, today).date}</h2>
          <div className="schedule-day-actions">
            {copySource && !dayLessons.length && bells.length > 0 && <button type="button" onClick={copyFrom}><Copy size={14} /> Как {dayLabel(copySource, today).name.toLowerCase() === 'сегодня' ? 'сегодня' : `${dayLabel(copySource, today).date}`}</button>}
            {dayLessons.length > 0 && <button type="button" onClick={clearDay}><Trash2 size={14} /> Очистить день</button>}
          </div>
        </div>
        {!bells.length ? <p className="schedule-empty">Воскресенье. Выходной, можно выдохнуть.</p> : dayLessons.length ? <ol className="schedule-list">
          {dayLessons.map((lesson) => {
            const room = rooms.find((item) => item.id === lesson.roomId)
            const bell = bells.find((item) => item.start === lesson.start)
            return <li key={lesson.id || `${lesson.start}-${lesson.subject}`}>
              <span className="schedule-time"><strong>{lesson.start}</strong><small>{lesson.end}</small></span>
              <span className="schedule-info"><strong>{lesson.subject}</strong><small>{bell ? `${bell.label}, ` : ''}{roomLabel(room)}, {room.floor} этаж</small></span>
              <Link className="schedule-route" to={`/route?from=entrance-1&to=${encodeURIComponent(room.id)}`} aria-label={`Маршрут: ${lesson.subject}`}><ArrowRight size={16} /></Link>
              <button type="button" className="schedule-remove" onClick={() => remove(lesson)} aria-label={`Удалить пару ${lesson.subject}`}><Trash2 size={15} /></button>
            </li>
          })}
        </ol> : <p className="schedule-empty">На этот день пар пока нет. Добавьте их справа{copySource ? ' или скопируйте с прошлого дня' : ''}.</p>}
      </div>

      <aside className="schedule-side">
        <NextLessonCard lessons={lessons} now={now} />
        {bells.length > 0 && <form className="schedule-form" onSubmit={add}>
          <h2><Plus size={18} /> Добавить пару на {dayLabel(day, today).name.toLowerCase()}</h2>
          <div className="schedule-bells" role="group" aria-label="Пара по звонкам" style={{ gridTemplateColumns: `repeat(${bells.length}, 1fr)` }}>
            {bells.map((bell) => <button type="button" key={bell.start} aria-pressed={pair === bell.pair && start === bell.start} onClick={() => choosePair(bell)}><strong>{bell.pair === 0 ? 'РОВ' : bell.pair}</strong><small>{bell.start}</small></button>)}
          </div>
          <div className="schedule-times">
            <label><span>Начало</span><input type="time" value={start} onChange={(event) => { setStart(event.target.value); setPair(null) }} required /></label>
            <label><span>Конец</span><input type="time" value={end} onChange={(event) => { setEnd(event.target.value); setPair(null) }} required /></label>
          </div>
          <label className="schedule-field"><span>Предмет</span><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={pair === 0 ? 'Разговоры о важном' : 'Например, Физика'} maxLength={60} /></label>
          <RoomSearchSelect label="Кабинет" value={roomId} onChange={setRoomId} />
          {error && <p className="schedule-error" role="alert">{error}</p>}
          <button type="submit" className="schedule-add"><Plus size={16} /> Добавить</button>
        </form>}
        <BellsCard dayKey={day} />
      </aside>
    </div>
  </section>
}
