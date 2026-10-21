import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, GraduationCap, ListChecks, MapPin, QrCode, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { photoSrcSet, photosFor, rooms, quickPlaces } from '../data.js'
import { HERO_ROUTES } from '../hero-scene-model.js'
import HeroScene from '../components/HeroScene.jsx'
import AiPromoBanner from '../components/AiPromoBanner.jsx'
import HomeDashboard from '../components/HomeDashboard.jsx'
import { Reveal, SectionLabel } from '../components/Primitives.jsx'
import VoiceSearchButton from '../components/VoiceSearchButton.jsx'
import { cancelMiss, reportMiss, searchRooms, searchTeachers, shortName, useTeachers } from '../search.js'

// Разделы, до которых с главной иначе не добраться за один клик.
const homeTasks = [
  { to: '/start', icon: ListChecks, tone: 'blue', title: 'Первая неделя', text: 'Чек-лист новичка: раздевалка, учебная часть, медпункт и ещё шесть мест.', action: 'Начать' },
  { to: '/teachers', icon: GraduationCap, tone: 'green', title: 'Преподаватели', text: 'Найдите человека по фамилии или предмету и узнайте, где его кабинет.', action: 'Найти' },
  { to: '/here', icon: QrCode, tone: 'amber', title: 'Таблички «Вы здесь»', text: 'QR-коды для дверей: отсканировал — и маршрут строится от этого места.', action: 'Открыть' },
]

function HomeSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const teachers = useTeachers()
  const matches = useMemo(() => (query.trim() ? searchRooms(query, 4).map((entry) => entry.room) : []), [query])
  const teacherHits = useMemo(() => searchTeachers(teachers, query, 2), [teachers, query])
  const missed = Boolean(query.trim()) && !matches.length && !teacherHits.length
  useEffect(() => { if (missed) reportMiss(query); else cancelMiss() }, [missed, query])
  const goTo = (room) => navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)
  const submit = (event) => {
    event.preventDefault()
    if (matches[0]) goTo(matches[0])
    else if (teacherHits[0]?.room) goTo(teacherHits[0].room)
    else navigate(`/rooms?q=${encodeURIComponent(query.trim())}`)
  }

  return <form className="home-search" onSubmit={submit} role="search"><Search size={19} /><input id="home-room-search" value={query} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 130)} onChange={(event) => setQuery(event.target.value)} placeholder="Например, 217, библиотека или фамилия" aria-label="Найти кабинет, место или преподавателя" autoComplete="off" /><VoiceSearchButton onText={(text) => { setQuery(text); setOpen(true) }} /><button type="submit" aria-label="Искать"><ArrowRight size={18} /></button>{open && query.trim() && <div className="home-search-suggestions">{teacherHits.map(({ teacher, room, bySubject }) => <button type="button" key={teacher.name} onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(room || rooms.find((item) => item.id === 'academic-office'))}><span>{shortName(teacher.name)}</span><small>{room ? `${room.name}${room.number ? ` №${room.number}` : ''}${bySubject ? ', по предмету' : ''}` : 'Кабинет уточните в учебной части'}</small></button>)}{matches.length || teacherHits.length ? matches.map((room) => <button type="button" key={room.id} onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(room)}><span>{room.name}{room.number && ` №${room.number}`}</span><small>{room.floor} этаж, {room.category}</small></button>) : <button type="submit" className="home-search-no-results"><span>Искать «{query}» в справочнике</span><small>Посмотреть все результаты</small></button>}</div>}</form>
}

const VIA_LABELS = { lift: 'на лифте', 'stairs-west': 'по западной лестнице', 'stairs-middle': 'по центральной лестнице', 'stairs-north': 'по северной лестнице' }
const roomTitle = (id) => { const room = rooms.find((item) => item.id === id); return room.number ? `${room.name.toLowerCase()} ${room.number}` : room.name }

// Подпись под сценой: сцена сообщает, какой маршрут сейчас летит.
function HeroCaption() {
  const [route, setRoute] = useState(HERO_ROUTES[0])
  useEffect(() => {
    const onRoute = (event) => setRoute(event.detail)
    window.addEventListener('hero-route', onRoute)
    return () => window.removeEventListener('hero-route', onRoute)
  }, [])
  const from = rooms.find((item) => item.id === route.from)
  return <Link className="hero-scene-caption" to={`/route?from=${route.from}&to=${route.to}&mode=${route.via}`}><span className="hero-scene-caption-dot" aria-hidden="true" /><span><strong>{from.name} → {roomTitle(route.to)}</strong><small>Пример маршрута {VIA_LABELS[route.via]} на 2 этаж</small></span><ArrowUpRight size={15} /></Link>
}

export default function HomePage() {
  return <>
    <section className="home-hero hero-mesh home-hero-usual home-hero-scene" id="top">
      <HeroScene />
      <div className="container home-hero-inner">
        <div className="home-hero-copy">
          <span className="home-eyebrow">
            <MapPin size={15} aria-hidden="true" />
            Навигатор по колледжу
          </span>
          <h1><span>Куда идти</span><em>на следующую пару?</em></h1>
          <p>Найдите кабинет по номеру или названию. Покажем его на карте и подскажем маршрут.</p>
          <div className="home-search-group">
            <label className="home-search-label" htmlFor="home-room-search">Поиск по колледжу</label>
            <HomeSearch />
          </div>
          <div className="home-hero-actions">
            <Link className="button button-white home-map-cta" to="/map">Смотреть карту <ArrowRight size={16} /></Link>
            <Link className="home-plain-link" to="/route" aria-label="Построить маршрут"><span className="home-route-long">Построить маршрут</span><span className="home-route-short">Маршрут</span><ArrowUpRight size={16} /></Link>
          </div>
        </div>
        <HeroCaption />
      </div>
      <div className="home-hero-edge container"><span>План корпуса, 1 и 2 этажи</span><a href="#quick-places" onClick={(event) => { event.preventDefault(); document.getElementById('quick-places')?.scrollIntoView({ behavior: 'smooth' }) }}>Часто ищут <ArrowDownRight size={14} /></a></div>
    </section>

    <HomeDashboard />

    <section className="quick-places container section-pad" id="quick-places"><div className="section-top"><div><SectionLabel>Часто ищут</SectionLabel><h2>Начните <em>здесь.</em></h2></div><Link className="text-link" to="/rooms">Все помещения <span><ArrowRight size={15} /></span></Link></div><div className="quick-place-grid">{quickPlaces.map((place, index) => { const room = rooms.find((item) => item.id === place.roomId); return <Reveal key={place.roomId} delay={index * 60} variant="up"><Link className={`quick-place-card quick-place-${place.tone}${photosFor(room).length ? ' quick-place-media' : ''}`} to={`/map?floor=${room.floor}&room=${room.id}`}>{photosFor(room).length > 0 && <img className="quick-place-photo" src={photosFor(room)[0]} srcSet={photoSrcSet(photosFor(room)[0])} sizes="(max-width: 680px) 100vw, 320px" alt="" loading="lazy" decoding="async" />}<span className="quick-place-num">{room.floor} этаж</span><span className="quick-place-copy"><strong>{place.label}</strong><small>{place.meta}</small></span><span className="quick-place-arrow"><ArrowUpRight size={16} /></span></Link></Reveal> })}</div></section>

    <section className="home-tasks container" aria-labelledby="home-tasks-title">
      <div className="section-top"><div><SectionLabel>Ещё пригодится</SectionLabel><h2 id="home-tasks-title">Что ещё <em>умеет сайт.</em></h2></div></div>
      <div className="home-task-grid">{homeTasks.map((task, index) => { const Icon = task.icon; return <Reveal key={task.to} delay={index * 60} variant="up"><Link className={`home-task home-task-${task.tone}`} to={task.to}><span className="home-task-icon" aria-hidden="true"><Icon size={20} /></span><strong>{task.title}</strong><span>{task.text}</span><span className="home-task-go">{task.action} <ArrowRight size={14} /></span></Link></Reveal> })}</div>
    </section>

    <AiPromoBanner />

    <section className="floor-preview-band"><div className="container floor-preview-inner"><Reveal className="floor-preview-copy" variant="left"><SectionLabel>Планы этажей</SectionLabel><h2>Первый<br />или <em>второй?</em></h2><p>Переключайтесь между этажами, выбирайте помещения и находите ближайшую лестницу.</p><Link className="button button-white" to="/map">Открыть карту <ArrowRight size={15} /></Link></Reveal><Reveal className="floor-switch-cards" delay={90} variant="right">{[1, 2].map((floor) => <Link key={floor} to={`/map?floor=${floor}`} className={`floor-switch-card floor-switch-${floor}`}><span className="floor-switch-number">{floor}</span><span className="floor-switch-copy"><small>{floor === 1 ? 'Первый этаж' : 'Второй этаж'}</small><strong>{floor === 1 ? 'Столовая, актовый зал, учебная часть' : 'Библиотека, лаборатории, кабинеты'}</strong></span><ArrowUpRight size={17} /></Link>)}</Reveal></div></section>

    <section className="play-teaser container section-pad"><Reveal className="play-teaser-copy" variant="up"><SectionLabel>На перемене</SectionLabel><h2>Проверьте себя<br /><em>по плану.</em></h2><p>В коротком квизе можно потренироваться узнавать кабинеты и этажи.</p><Link className="button button-primary" to="/games">Открыть игры <ArrowRight size={15} /></Link></Reveal><Link className="quiz-preview" to="/games" aria-label="Открыть квиз «Узнай этаж»"><span className="quiz-preview-top"><span>Узнай этаж</span><span>Вопрос 1 из 5</span></span><strong>На каком этаже библиотека?</strong><span className="quiz-preview-options"><span>1 этаж</span><span className="quiz-preview-right"><Check size={14} /> 2 этаж</span></span><span className="quiz-preview-foot">Без оценок, около минуты</span></Link></section>
  </>
}
