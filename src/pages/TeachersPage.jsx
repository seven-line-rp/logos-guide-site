import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GraduationCap, Heart, MapPin, Navigation, Quote, Search, X } from 'lucide-react'
import { PageHeading, Reveal } from '../components/Primitives.jsx'
import VoiceSearchButton from '../components/VoiceSearchButton.jsx'
import { RawText } from '../components/raw-text.js'
import { rooms } from '../data.js'
import { loadTeachers, normalize, roomForTeacher } from '../search.js'
import { focusInputOnPress } from '../search-field.js'
import { normalizeQuote, portraitUrl, withProfiles } from '../teacher-profiles.js'

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

// Портрет из public/teachers/«Имя Фамилия.png»; нет файла — инициалы.
function TeacherAvatar({ name }) {
  const [failed, setFailed] = useState(false)
  return <span className="teacher-avatar" aria-hidden="true">
    {initials(name)}
    {!failed && <img src={portraitUrl(name)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
  </span>
}

function TeacherProfile({ profile }) {
  const { place, quotes = [] } = profile
  return <div className="teacher-profile">
    {quotes.map(normalizeQuote).map((quote) => <blockquote key={quote.text} className="teacher-quote">
      <Quote size={15} aria-hidden="true" />
      <p><RawText text={quote.text} />{quote.note && <small> — <RawText text={quote.note} /></small>}</p>
    </blockquote>)}
    {place && <div className="teacher-place">
      <span className="teacher-place-label"><Heart size={14} aria-hidden="true" /> Любимое место</span>
      <strong>{place.roomId ? <Link to={`/map?floor=${rooms.find((item) => item.id === place.roomId)?.floor || 1}&room=${place.roomId}`}><RawText text={place.title} /></Link> : <RawText text={place.title} />}</strong>
      {place.why && <p><RawText text={place.why} /></p>}
    </div>}
  </div>
}

function TeacherCard({ teacher, onOpen }) {
  const { room, bySubject } = roomForTeacher(teacher)
  return <article className={teacher.profile ? 'teacher-card teacher-card-profiled' : 'teacher-card'}>
    <div className="teacher-card-top">
      <TeacherAvatar name={teacher.name} />
      <div className="teacher-card-name"><h2>{onOpen ? <button className="teacher-open" type="button" onClick={() => onOpen(teacher)} aria-haspopup="dialog"><RawText text={teacher.name} /></button> : <RawText text={teacher.name} />}</h2>{teacher.position && <span>{teacher.position}</span>}</div>
    </div>
    {teacher.subjects?.length > 0 && <ul className="teacher-subjects" aria-label="Предметы">{teacher.subjects.map((subject) => <li key={subject}>{subject}</li>)}</ul>}
    {!onOpen && teacher.profile && <TeacherProfile profile={teacher.profile} />}
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
    loadTeachers().then((value) => { if (alive) setTeachers(withProfiles(value)) })
    return () => { alive = false }
  }, [])
  const dialog = useRef(null)
  const [params, setParams] = useSearchParams()
  const selected = teachers?.find((teacher) => teacher.name === params.get('person'))
  const setSelected = (teacher) => {
    const next = new URLSearchParams(params)
    if (teacher) next.set('person', teacher.name)
    else next.delete('person')
    setParams(next, { replace: true, preventScrollReset: true })
  }
  useEffect(() => { if (selected) dialog.current?.showModal(); else dialog.current?.close() }, [selected])
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
    <PageHeading className="page-heading-compact" title="Преподаватели" description="Найдите человека по фамилии или предмету — покажем кабинет и проложим маршрут." />
    <section className="teachers-section container">
      <label className="search-field-name" htmlFor="teachers-search">Найти преподавателя или сотрудника</label><Reveal className="directory-search-bar" onPointerDown={focusInputOnPress}><Search size={19} aria-hidden="true" /><input id="teachers-search" type="search" enterKeyHint="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Фамилия или предмет, например химия" />{query && <button type="button" className="search-clear" onClick={(event) => { setQuery(''); event.currentTarget.parentElement.querySelector('input')?.focus() }} aria-label="Очистить поиск"><X size={17} aria-hidden="true" /><span className="field-tip" aria-hidden="true">Очистить</span></button>}<VoiceSearchButton onText={setQuery} /></Reveal>
      <div className="directory-category-filters teachers-filters" role="group" aria-label="Кого показать">{groups.map((item) => <button key={item.id} type="button" onClick={() => setGroup(item.id)} className={group === item.id ? 'directory-chip directory-chip-active' : 'directory-chip'} aria-pressed={group === item.id}>{item.label}</button>)}</div>
      <div className="directory-results-head"><span><strong>{visible.length}</strong> человек{query && <> по запросу «{query}»</>}</span></div>
      {teachers === null ? <div className="teachers-grid" aria-busy="true">{[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="teacher-card teacher-card-skeleton"><span className="shimmer" /><span className="shimmer" /><span className="shimmer" /></div>)}</div>
        : visible.length ? <div className="teachers-grid" aria-live="polite">{visible.map((teacher, index) => <Reveal key={teacher.name} delay={index % 6 * 40}><TeacherCard teacher={teacher} onOpen={setSelected} /></Reveal>)}</div>
          : <div className="directory-empty"><span className="directory-empty-icon"><GraduationCap size={20} /></span><h2>Никого не нашли.</h2><p>Проверьте фамилию или спросите в учебной части.</p><button className="button button-primary" type="button" onClick={() => { setQuery(''); setGroup('all') }}>Показать всех</button></div>}
      <dialog className="teacher-dialog" ref={dialog} aria-label={selected?.name} onClose={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) dialog.current.close() }}>
        {selected && <div><button type="button" className="teacher-dismiss" onClick={() => dialog.current.close()} aria-label="Закрыть карточку"><X /></button><TeacherCard teacher={selected} /></div>}
      </dialog>
      <p className="teachers-note">Список — со страницы «Педагогический состав» на сайте колледжа. Кабинет, подписанный «по предмету», — где обычно проходит этот предмет; точное место уточняйте в учебной части.</p>
    </section>
  </>
}
