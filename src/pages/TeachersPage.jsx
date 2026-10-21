import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, MapPin, Navigation, Search, X } from 'lucide-react'
import { PageHeading, Reveal } from '../components/Primitives.jsx'
import VoiceSearchButton from '../components/VoiceSearchButton.jsx'
import { RawText } from '../components/ai-message.js'
import { loadTeachers, normalize, roomForTeacher } from '../search.js'

// «Преподаватели»: весь педагогический состав (public/teachers.json) с
// кабинетами. Кабинет берётся из roomId, а если его нет — угадывается по
// предмету (тогда так и подписано). Имена не переводятся (RawText).

const groups = [
  { id: 'all', label: 'Все' },
  { id: 'teachers', label: 'Преподаватели' },
  { id: 'staff', label: 'Администрация и сотрудники' },
]

const isTeacher = (teacher) => /преподават|мастер/i.test(teacher.position || '') || (teacher.subjects || []).length > 0

function initials(name) {
  const [last = '', first = ''] = name.trim().split(/\s+/)
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase()
}

function TeacherCard({ teacher }) {
  const { room, bySubject } = roomForTeacher(teacher)
  return <article className="teacher-card">
    <div className="teacher-card-top">
      <span className="teacher-avatar" aria-hidden="true">{initials(teacher.name)}</span>
      <div className="teacher-card-name"><h2><RawText text={teacher.name} /></h2>{teacher.position && <span>{teacher.position}</span>}</div>
    </div>
    {teacher.subjects?.length > 0 && <ul className="teacher-subjects" aria-label="Предметы">{teacher.subjects.map((subject) => <li key={subject}>{subject}</li>)}</ul>}
    <div className="teacher-card-room">
      <MapPin size={15} aria-hidden="true" />
      {room ? <span>{room.name}{room.number && ` №${room.number}`}, {room.floor} этаж{bySubject && <small> — по предмету, уточняйте</small>}</span> : <span>Кабинет уточните в учебной части</span>}
    </div>
    <div className="teacher-card-actions">
      <Link className="teacher-action" to={room ? `/map?floor=${room.floor}&room=${room.id}` : '/map?floor=1&room=academic-office'}><MapPin size={15} /> На карте</Link>
      <Link className="teacher-action teacher-action-primary" to={`/route?to=${room ? room.id : 'academic-office'}`}><Navigation size={15} /> {room ? 'Маршрут' : 'В учебную часть'}</Link>
    </div>
  </article>
}

export default function TeachersPage() {
  // null — список ещё грузится (показываем заглушки), [] — не загрузился.
  const [teachers, setTeachers] = useState(null)
  useEffect(() => {
    let alive = true
    loadTeachers().then((value) => { if (alive) setTeachers(value) })
    return () => { alive = false }
  }, [])
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const visible = useMemo(() => {
    const text = normalize(query)
    return (teachers || [])
      .filter((teacher) => group === 'all' || (group === 'teachers') === isTeacher(teacher))
      .filter((teacher) => !text || normalize(`${teacher.name} ${teacher.position || ''} ${(teacher.subjects || []).join(' ')}`).includes(text))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [teachers, query, group])

  return <>
    <PageHeading className="page-heading-compact" eyebrow="Кто где" title={<>Преподаватели <em>и сотрудники</em></>} description="Найдите человека по фамилии или предмету — покажем кабинет и проложим маршрут." />
    <section className="teachers-section container">
      <Reveal className="directory-search-bar"><Search size={19} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Фамилия, предмет или должность…" aria-label="Поиск преподавателя" /><VoiceSearchButton onText={setQuery} />{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><X size={17} /></button>}</Reveal>
      <div className="directory-category-filters teachers-filters" role="group" aria-label="Кого показать">{groups.map((item) => <button key={item.id} type="button" onClick={() => setGroup(item.id)} className={group === item.id ? 'directory-chip directory-chip-active' : 'directory-chip'} aria-pressed={group === item.id}>{item.label}</button>)}</div>
      <div className="directory-results-head"><span><strong>{visible.length}</strong> человек{query && <> по запросу «{query}»</>}</span></div>
      {teachers === null ? <div className="teachers-grid" aria-busy="true">{[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="teacher-card teacher-card-skeleton"><span className="shimmer" /><span className="shimmer" /><span className="shimmer" /></div>)}</div>
        : visible.length ? <div className="teachers-grid" aria-live="polite">{visible.map((teacher, index) => <Reveal key={teacher.name} delay={index % 6 * 40}><TeacherCard teacher={teacher} /></Reveal>)}</div>
          : <div className="directory-empty"><span className="directory-empty-icon"><GraduationCap size={20} /></span><h2>Никого не нашли.</h2><p>Проверьте фамилию или спросите в учебной части.</p><button className="button button-primary" type="button" onClick={() => { setQuery(''); setGroup('all') }}>Показать всех</button></div>}
      <p className="teachers-note">Список — со страницы «Педагогический состав» на сайте колледжа. Кабинет, подписанный «по предмету», — где обычно проходит этот предмет; точное место уточняйте в учебной части.</p>
    </section>
  </>
}
