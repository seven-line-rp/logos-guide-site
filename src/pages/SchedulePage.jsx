import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, Building2 } from 'lucide-react'
import { PageHeading } from '../components/Primitives.jsx'
import { DayBells, LessonCard } from '../components/HomeDashboard.jsx'
import { addDays, bellsFor, dateKey, nextSchoolDay, parseDateKey } from '../bells.js'
import { useMinuteNow } from '../use-now.js'

const dateLabel = (key) => parseDateKey(key).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

// «Звонки»: что идёт сейчас и расписание звонков на сегодня и ближайший
// учебный день. Личного расписания групп на сайте пока нет — об этом
// сказано прямо, и есть путь в учебную часть, где его знают.
export default function SchedulePage() {
  const now = useMinuteNow()
  const today = dateKey(now)
  const hasToday = bellsFor(today).bells.length > 0
  const tomorrow = addDays(today, 1)
  const upcoming = bellsFor(tomorrow).bells.length ? { key: tomorrow } : nextSchoolDay(today)
  return <>
    <PageHeading title="Звонки" description="Пары у всех начинаются по одним звонкам. В понедельник первым идёт «Разговоры о важном»." />
    <div className="schedule-page container">
      <LessonCard now={now} compact />
      <section className="schedule-day" aria-labelledby="schedule-today">
        <h2 id="schedule-today">Сегодня, {dateLabel(today)}</h2>
        {hasToday ? <DayBells now={now} /> : <p className="day-hint">Сегодня занятий нет.</p>}
      </section>
      {upcoming && <section className="schedule-day" aria-labelledby="schedule-next">
        <h2 id="schedule-next">{upcoming.key === tomorrow ? 'Завтра' : 'Следующий учебный день'}, {dateLabel(upcoming.key)}</h2>
        <DayBells now={now} date={parseDateKey(upcoming.key)} />
      </section>}
      <section className="schedule-note" aria-labelledby="schedule-groups">
        <h2 id="schedule-groups">Где пара у моей группы?</h2>
        <p>Расписания групп и аудиторий на сайте пока нет. Его можно узнать в учебной части или на стенде у входа.</p>
        <div className="schedule-note-actions">
          <Link className="button button-primary" to="/route?from=entrance-1&to=academic-office"><Building2 size={16} aria-hidden="true" /> Маршрут в учебную часть</Link>
          <Link className="button button-white" to="/notifications"><BellRing size={16} aria-hidden="true" /> Напоминать о парах <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  </>
}
