import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock, MapPin, Navigation, Plus, Trash2 } from 'lucide-react'
import { rooms } from '../data.js'
import RoomSearchSelect, { roomLabel } from '../components/RoomSearchSelect.jsx'
import { BELLS, DAYS, DAYS_SHORT, formatCountdown, nextLesson, readSchedule, saveSchedule, subscribeSchedule, toMinutes } from '../schedule.js'
import { functionalStorageAllowed } from '../consent.js'

// «Моё расписание»: пары вводит сам студент, хранятся только в браузере.
// По нему главная показывает следующую пару, а маршрут — успеваете ли вы.

let snapshot = null
function getSchedule() {
  const value = readSchedule()
  const key = JSON.stringify(value)
  if (!snapshot || snapshot.key !== key) snapshot = { key, value }
  return snapshot.value
}
export function useSchedule() {
  return useSyncExternalStore(subscribeSchedule, getSchedule, () => [])
}

// Минута по часам: счётчик «через N мин» обновляется сам.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

const todayIndex = () => Math.min(6, ((new Date().getDay() + 6) % 7) + 1)

export function NextLessonCard({ lessons, now, compact = false }) {
  const next = nextLesson(lessons, now)
  if (!next) return null
  const room = rooms.find((item) => item.id === next.lesson.roomId)
  const when = next.offset === 0 ? formatCountdown(next.minutes) : `${DAYS[next.lesson.day - 1].toLowerCase()}, ${next.lesson.start}`
  return <div className={`lesson-next ${next.ongoing ? 'is-ongoing' : next.minutes <= 15 ? 'is-soon' : ''} ${compact ? 'lesson-next-compact' : ''}`}>
    <span className="lesson-next-badge">{next.ongoing ? 'Идёт сейчас' : 'Следующая пара'}</span>
    <strong className="lesson-next-subject">{next.lesson.subject}</strong>
    <span className="lesson-next-meta"><Clock size={14} /> {next.lesson.start}–{next.lesson.end} · {when}</span>
    <span className="lesson-next-meta"><MapPin size={14} /> {roomLabel(room)} · {room.floor} этаж</span>
    <Link className="lesson-next-go" to={`/route?from=entrance-1&to=${encodeURIComponent(room.id)}`}><Navigation size={15} /> Маршрут</Link>
  </div>
}

export default function SchedulePage() {
  const lessons = useSchedule()
  const now = useNow()
  const [day, setDay] = useState(todayIndex)
  const [bell, setBell] = useState(0)
  const [start, setStart] = useState(BELLS[0].start)
  const [end, setEnd] = useState(BELLS[0].end)
  const [subject, setSubject] = useState('')
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')
  const dayLessons = useMemo(() => lessons.filter((lesson) => lesson.day === day), [lessons, day])
  const saving = functionalStorageAllowed()

  const chooseBell = (index) => { setBell(index); setStart(BELLS[index].start); setEnd(BELLS[index].end) }
  const add = (event) => {
    event.preventDefault()
    if (!subject.trim()) return setError('Напишите название пары.')
    if (!roomId) return setError('Выберите кабинет.')
    if (toMinutes(end) <= toMinutes(start)) return setError('Конец пары должен быть позже начала.')
    saveSchedule([...lessons, { id: `l${Date.now().toString(36)}`, day, start, end, subject: subject.trim().slice(0, 60), roomId }])
    setSubject('')
    setError('')
    chooseBell(Math.min(BELLS.length - 1, bell + 1))
  }
  const remove = (lesson) => saveSchedule(lessons.filter((item) => item !== lesson))

  return <section className="schedule-page container">
    <header className="schedule-head">
      <span className="eyebrow"><i className="eyebrow-dot" />Моё расписание</span>
      <h1>Пары и <em>маршруты к ним.</em></h1>
      <p>Добавьте свои пары — на главной появится следующая пара с маршрутом, а навигатор подскажет, успеваете ли вы. Расписание хранится только в этом браузере.</p>
      {!saving && <p className="schedule-warn">Вы отказались от функциональных cookie, поэтому расписание не сохранится после перезагрузки.</p>}
    </header>

    <div className="schedule-layout">
      <div className="schedule-main">
        <div className="schedule-days" role="tablist" aria-label="День недели">
          {DAYS_SHORT.map((label, index) => {
            const count = lessons.filter((lesson) => lesson.day === index + 1).length
            return <button type="button" role="tab" key={label} aria-selected={day === index + 1} onClick={() => setDay(index + 1)}><span>{label}</span>{count > 0 && <i>{count}</i>}</button>
          })}
        </div>
        <h2 className="schedule-day-title"><CalendarDays size={18} /> {DAYS[day - 1]}</h2>
        {dayLessons.length ? <ol className="schedule-list">
          {dayLessons.map((lesson) => {
            const room = rooms.find((item) => item.id === lesson.roomId)
            return <li key={lesson.id || `${lesson.start}-${lesson.subject}`}>
              <span className="schedule-time"><strong>{lesson.start}</strong><small>{lesson.end}</small></span>
              <span className="schedule-info"><strong>{lesson.subject}</strong><small>{roomLabel(room)} · {room.floor} этаж</small></span>
              <Link className="schedule-route" to={`/route?from=entrance-1&to=${encodeURIComponent(room.id)}`} aria-label={`Маршрут: ${lesson.subject}`}><ArrowRight size={16} /></Link>
              <button type="button" className="schedule-remove" onClick={() => remove(lesson)} aria-label={`Удалить пару ${lesson.subject}`}><Trash2 size={15} /></button>
            </li>
          })}
        </ol> : <p className="schedule-empty">В этот день пар нет. Добавьте первую справа.</p>}
      </div>

      <aside className="schedule-side">
        <NextLessonCard lessons={lessons} now={now} />
        <form className="schedule-form" onSubmit={add}>
          <h2><Plus size={18} /> Добавить пару · {DAYS_SHORT[day - 1]}</h2>
          <div className="schedule-bells" role="group" aria-label="Номер пары">
            {BELLS.map((item, index) => <button type="button" key={item.start} aria-pressed={bell === index && start === item.start} onClick={() => chooseBell(index)}><strong>{index + 1}</strong><small>{item.start}</small></button>)}
          </div>
          <div className="schedule-times">
            <label><span>Начало</span><input type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></label>
            <label><span>Конец</span><input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></label>
          </div>
          <label className="schedule-field"><span>Предмет</span><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Например, Физика" maxLength={60} /></label>
          <RoomSearchSelect label="Кабинет" value={roomId} onChange={setRoomId} />
          {error && <p className="schedule-error" role="alert">{error}</p>}
          <button type="submit" className="schedule-add"><Plus size={16} /> Добавить</button>
          <p className="schedule-note">Время звонков подставлено типовое — если в колледже оно другое, поправьте начало и конец вручную.</p>
        </form>
      </aside>
    </div>
  </section>
}
