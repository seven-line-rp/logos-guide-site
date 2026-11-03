import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { photoSrcSet, photosFor, rooms, quickPlaces } from '../data.js'
import { HERO_ROUTES } from '../hero-scene-model.js'
import AiPromoBanner from '../components/AiPromoBanner.jsx'
import HomeDashboard from '../components/HomeDashboard.jsx'
import { UnityBanner, UnityChip } from '../components/Unity.jsx'
import { Reveal } from '../components/Primitives.jsx'
import VoiceSearchButton from '../components/VoiceSearchButton.jsx'
import { cancelMiss, reportMiss, searchRooms, searchTeachers, shortName, useTeachers } from '../search.js'
import { useScene3d } from '../use-scene3d.js'

// 3D-корпус тяжёлый: грузим его отдельным файлом и только там, где он потянет
// (компьютер с мышью, не «Лёгкий» режим). На телефонах остаётся градиентный фон.
const HeroScene = lazy(() => import('../components/HeroScene.jsx'))

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
  return <Link className="hero-scene-caption" to={`/route?from=${route.from}&to=${route.to}&mode=${route.via}`}><small>Пример маршрута {VIA_LABELS[route.via]}</small><strong>{from.name} → {roomTitle(route.to)} <ArrowUpRight size={14} aria-hidden="true" /></strong></Link>
}

export default function HomePage() {
  const scene3d = useScene3d()
  return <>
    <section className="home-hero hero-mesh home-hero-usual home-hero-scene" id="top">
      {scene3d && <Suspense fallback={null}><HeroScene /></Suspense>}
      <div className="container home-hero-inner">
        <div className="home-hero-copy">
          <UnityChip />
          <h1>Где найти кабинет</h1>
          <p>Введите номер, название или фамилию преподавателя. Кабинет откроется на карте, оттуда можно построить маршрут.</p>
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
    </section>

    <UnityBanner />

    <HomeDashboard />

    <section className="quick-places container section-pad" id="quick-places"><div className="section-top"><div><h2>Часто ищут</h2></div><Link className="text-link" to="/rooms">Все помещения <span><ArrowRight size={15} /></span></Link></div><div className="quick-place-grid">{quickPlaces.map((place, index) => { const room = rooms.find((item) => item.id === place.roomId); return <Reveal key={place.roomId} delay={index * 60} variant="up"><Link className={`quick-place-card quick-place-${place.tone}${photosFor(room).length ? ' quick-place-media' : ''}`} to={`/map?floor=${room.floor}&room=${room.id}`}>{photosFor(room).length > 0 && <img className="quick-place-photo" src={photosFor(room)[0]} srcSet={photoSrcSet(photosFor(room)[0])} sizes="(max-width: 680px) 100vw, 320px" alt="" loading="lazy" decoding="async" />}<span className="quick-place-num">{room.floor} этаж</span><span className="quick-place-copy"><strong>{place.label}</strong><small>{place.meta}</small></span><span className="quick-place-arrow"><ArrowUpRight size={16} /></span></Link></Reveal> })}</div></section>

    <AiPromoBanner />
  </>
}
