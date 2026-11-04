import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Building2, GraduationCap, Search, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { rooms, categoryLabels, photoSrcSet, photosFor } from '../data'
import { FloorTag, PageHeading, Reveal } from '../components/Primitives'
import VoiceSearchButton from '../components/VoiceSearchButton.jsx'
import { cancelMiss, reportMiss, searchRooms, searchTeachers, shortName, useTeachers } from '../search.js'
import { focusInputOnPress } from '../search-field.js'

function formatRoomCount(count) {
  const lastTwo = count % 100
  const last = count % 10
  const noun = lastTwo >= 11 && lastTwo <= 14 ? 'мест' : last === 1 ? 'место' : last >= 2 && last <= 4 ? 'места' : 'мест'
  return noun
}

const coverTones = { 'Учебные кабинеты': 'blue', 'Мастерские и лаборатории': 'green', 'Общие пространства': 'warm', 'Администрация': 'lilac' }

function RoomCard({ room }) {
  const photos = photosFor(room)
  return <Link className={`directory-card directory-card-media${photos.length > 1 ? ' directory-card-duo' : ''}`} to={`/map?floor=${room.floor}&room=${room.id}`}>
    <span className={`directory-card-cover directory-cover-${coverTones[room.category] || 'blue'}`}>
      {photos.length ? photos.map((src) => <img key={src} className="directory-card-photo" src={src} srcSet={photoSrcSet(src)} sizes="(max-width: 680px) 104px, (max-width: 1120px) 50vw, 380px" alt="" loading="lazy" decoding="async" />) : room.number ? <span className="directory-card-mark">{room.number.split(/[ ,(]/)[0]}</span> : <span className="directory-card-icon"><Building2 size={20} strokeWidth={1.6} /></span>}
      <FloorTag floor={room.floor} />
    </span>
    <span className="directory-card-copy"><small>{room.category}</small><strong>{room.name}</strong><span>{room.number ? `№ ${room.number}` : 'Общее пространство'}</span></span>
    <ArrowUpRight className="directory-card-arrow" size={16} />
  </Link>
}

export default function RoomsPage() {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [floor, setFloor] = useState('all')
  const [category, setCategory] = useState('Все места')
  const teachers = useTeachers()
  const visibleRooms = useMemo(() => {
    const found = query.trim() ? searchRooms(query).map((entry) => entry.room) : rooms
    return found.filter((room) => (floor === 'all' || room.floor === Number(floor)) && (category === 'Все места' || room.category === category))
  }, [query, floor, category])
  const teacherHits = useMemo(() => searchTeachers(teachers, query, 6), [teachers, query])
  const missed = Boolean(query.trim()) && floor === 'all' && category === 'Все места' && !visibleRooms.length && !teacherHits.length
  useEffect(() => { if (missed) reportMiss(query); else cancelMiss() }, [missed, query])
  const resetFilters = () => { setQuery(''); setFloor('all'); setCategory('Все места') }

  return <>
    <PageHeading title="Кабинеты" description="Ищите по номеру или названию. Нажмите на помещение, чтобы увидеть его на карте и построить маршрут." />

    <section className="directory-section container"><label className="search-field-name" htmlFor="rooms-search">Найти кабинет</label><Reveal className="directory-search-bar" onPointerDown={focusInputOnPress}><Search size={19} aria-hidden="true" /><input id="rooms-search" type="search" enterKeyHint="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например, 217 или физика" />{query && <button type="button" className="search-clear" onClick={(event) => { setQuery(''); event.currentTarget.parentElement.querySelector('input')?.focus() }} aria-label="Очистить поиск"><X size={17} aria-hidden="true" /><span className="field-tip" aria-hidden="true">Очистить</span></button>}<VoiceSearchButton onText={setQuery} /></Reveal>
      <Reveal className="directory-filters"><div className="directory-floor-filters" role="group" aria-label="Фильтр по этажу"><span>Этаж</span>{[['all', 'Все'], ['1', '1 этаж'], ['2', '2 этаж']].map(([id, label]) => <button key={id} onClick={() => setFloor(id)} className={floor === id ? 'directory-chip directory-chip-active' : 'directory-chip'} aria-pressed={floor === id}>{label}</button>)}</div><div className="directory-category-filters" role="group" aria-label="Категория места">{categoryLabels.map((item) => <button key={item} onClick={() => setCategory(item)} className={category === item ? 'directory-chip directory-chip-active' : 'directory-chip'} aria-pressed={category === item}>{item}</button>)}</div></Reveal>
      {teacherHits.length > 0 && <div className="directory-teachers" aria-label="Преподаватели">{teacherHits.map(({ teacher, room, bySubject }) => <Link key={teacher.name} className="directory-teacher" to={room ? `/map?floor=${room.floor}&room=${room.id}` : '/map?floor=1&room=academic-office'}><GraduationCap size={17} aria-hidden="true" /><span><strong>{shortName(teacher.name)}</strong><small>{room ? `${room.name}${room.number ? ` №${room.number}` : ''}${bySubject ? ', по предмету' : ''}` : 'Кабинет уточните в учебной части'}</small></span></Link>)}</div>}
      <div className="directory-results-head"><span><strong>{visibleRooms.length}</strong> {formatRoomCount(visibleRooms.length)}{query && <> по запросу «{query}»</>}</span><Link to="/map">Смотреть на карте <ArrowUpRight size={14} /></Link></div>
      {visibleRooms.length ? <div className="directory-grid" aria-live="polite">{visibleRooms.map((room, index) => <Reveal key={room.id} delay={index % 8 * 30}><RoomCard room={room} /></Reveal>)}</div> : <div className="directory-empty"><span className="directory-empty-icon"><Search size={20} /></span><h2>Ничего не найдено</h2><p>Попробуйте другой номер или снимите часть фильтров.</p><button className="button button-primary" onClick={resetFilters}>Сбросить фильтры <ArrowRight size={15} /></button></div>}
    </section>

    <section className="directory-help container"><div className="directory-help-line" /><p><strong>Не знаете номер?</strong> Введите часть названия или назначение кабинета, например «лаборатория» или «туалет».</p><Link to="/route">Нужен маршрут? <ArrowRight size={14} /></Link></section>
  </>
}
