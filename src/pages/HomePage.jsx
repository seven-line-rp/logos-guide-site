import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { photoSrcSet, photosFor, rooms, quickPlaces } from '../data.js'
import { HERO_ROUTES } from '../hero-scene-model.js'
import GuideBoard from '../components/GuideBoard.jsx'
import { useFavorites, useRecentRoutes } from '../components/FavoriteButton.jsx'
import { useSchedule } from '../components/NextLesson.jsx'
import HomeDashboard from '../components/HomeDashboard.jsx'
import { UnityBanner, UnityChip, UnityExtras } from '../components/Unity.jsx'
import UnityKremlin from '../components/UnityKremlin.jsx'
import { fireConfetti, isUnityEasterEgg } from '../unity-fx.js'
import { Reveal } from '../components/Primitives.jsx'
import VoiceSearchButton from '../components/VoiceSearchButton.jsx'
import { focusInputOnPress, useAnchorRect } from '../search-field.js'
import { cancelMiss, reportMiss, searchRooms, searchTeachers, shortName, useTeachers } from '../search.js'
import { useScene3d } from '../use-scene3d.js'
import { useTheme } from '../theme.js'

// 3D-корпус тяжёлый: грузим его отдельным файлом и только там, где он потянет
// (компьютер с мышью, не «Лёгкий» режим). На телефонах остаётся градиентный фон.
const HeroScene = lazy(() => import('../components/HeroScene.jsx'))
// В теме «Единство» вместо корпуса на главном экране развевается флаг России.
const UnityFlag = lazy(() => import('../components/UnityFlag.jsx'))
const UnitySky = lazy(() => import('../components/UnitySky.jsx'))

function HomeSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const formRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const teachers = useTeachers()
  const matches = useMemo(() => (query.trim() ? searchRooms(query, 4).map((entry) => entry.room) : []), [query])
  const teacherHits = useMemo(() => searchTeachers(teachers, query, 2), [teachers, query])
  const missed = Boolean(query.trim()) && !matches.length && !teacherHits.length
  useEffect(() => { if (missed) reportMiss(query); else cancelMiss() }, [missed, query])
  const goTo = (room) => navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)
  const unity = useTheme() === 'unity'
  // Один список вариантов для мыши и клавиатуры: сначала преподаватели, потом места.
  const options = [
    ...teacherHits.map(({ teacher, room, bySubject }) => ({ key: `t-${teacher.name}`, title: shortName(teacher.name), meta: room ? `${room.name}${room.number ? ` №${room.number}` : ''}${bySubject ? ', по предмету' : ''}` : 'Кабинет уточните в учебной части', go: () => goTo(room || rooms.find((item) => item.id === 'academic-office')) })),
    ...matches.map((room) => ({ key: room.id, title: `${room.name}${room.number ? ` №${room.number}` : ''}`, meta: `${room.floor} этаж, ${room.category}`, go: () => goTo(room) })),
  ]
  const showList = open && Boolean(query.trim())
  const anchor = useAnchorRect(formRef, showList)
  useEffect(() => { setActive(0) }, [query])

  const submit = (event) => {
    event.preventDefault()
    // Пасхалка темы «Единство»: «1612», «Минин», «Пожарский» и т. п. запускают салют.
    if (unity && isUnityEasterEgg(query)) { fireConfetti(); return }
    if (showList && options[active]) options[active].go()
    else if (matches[0]) goTo(matches[0])
    else if (teacherHits[0]?.room) goTo(teacherHits[0].room)
    else navigate(`/rooms?q=${encodeURIComponent(query.trim())}`)
  }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' && options.length) { event.preventDefault(); setOpen(true); setActive((index) => Math.min(options.length - 1, index + 1)) }
    else if (event.key === 'ArrowUp' && options.length) { event.preventDefault(); setActive((index) => Math.max(0, index - 1)) }
    else if (event.key === 'Escape' && showList) { event.preventDefault(); setOpen(false) }
  }
  const listId = 'home-search-list'

  return <form ref={formRef} id="home-search-form" className="home-search" onSubmit={submit} onPointerDown={focusInputOnPress} role="search">
    <Search size={19} aria-hidden="true" />
    <input ref={inputRef} id="home-room-search" type="search" enterKeyHint="search" value={query} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 130)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} onKeyDown={onKeyDown} placeholder="Например, 217 или столовая" role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined} autoComplete="off" />
    <VoiceSearchButton onText={(text) => { setQuery(text); setOpen(true); inputRef.current?.focus() }} />
    <button type="submit" aria-label="Искать"><ArrowRight size={18} aria-hidden="true" /><span className="field-tip" aria-hidden="true">Искать</span></button>
    {showList && anchor && createPortal(<div className="home-search-suggestions search-popover" id={listId} role="listbox" aria-label="Подсказки" style={{ top: anchor.top + 8, left: anchor.left, width: anchor.width }}>
      {options.length ? options.map((option, index) => <button type="button" role="option" id={`${listId}-${index}`} aria-selected={index === active} key={option.key} className={index === active ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onMouseMove={() => { if (index !== active) setActive(index) }} onClick={option.go}><span>{option.title}</span><small>{option.meta}</small></button>)
        : <button type="submit" form="home-search-form" className="home-search-no-results" onMouseDown={(event) => event.preventDefault()}><span>Искать «{query}» в справочнике</span><small>Посмотреть все результаты</small></button>}
    </div>, document.body)}
  </form>
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
  const unity = useTheme() === 'unity'
  // Кто зашёл впервые, сначала видит, что умеет путеводитель: «Мой день» у него пока пустой.
  // Кто уже добавил пары или места, сначала видит свой день, указатель — ниже.
  const lessons = useSchedule()
  const favorites = useFavorites()
  const recent = useRecentRoutes()
  const newcomer = !lessons.length && !favorites.length && !recent.length
  return <>
    <section className={`home-hero hero-mesh home-hero-usual home-hero-scene${unity ? ' home-hero-unity' : ''}`} id="top">
      {unity ? <><Suspense fallback={null}><UnitySky /><UnityFlag /></Suspense><UnityKremlin /></> : scene3d && <Suspense fallback={null}><HeroScene /></Suspense>}
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
        {!unity && <HeroCaption />}
      </div>
    </section>

    <UnityBanner />
    <UnityExtras />

    {newcomer && <GuideBoard />}

    <HomeDashboard />

    <section className="quick-places container section-pad" id="quick-places"><div className="section-top"><div><h2>Часто ищут</h2></div><Link className="text-link" to="/rooms">Все помещения <span><ArrowRight size={15} /></span></Link></div><div className="quick-place-grid">{quickPlaces.map((place, index) => { const room = rooms.find((item) => item.id === place.roomId); return <Reveal key={place.roomId} delay={index * 60} variant="up"><Link className={`quick-place-card quick-place-${place.tone}${photosFor(room).length ? ' quick-place-media' : ''}`} to={`/map?floor=${room.floor}&room=${room.id}`}>{photosFor(room).length > 0 && <img className="quick-place-photo" src={photosFor(room)[0]} srcSet={photoSrcSet(photosFor(room)[0])} sizes="(max-width: 680px) 100vw, 320px" alt="" loading="lazy" decoding="async" />}<span className="quick-place-num">{room.floor} этаж</span><span className="quick-place-copy"><strong>{place.label}</strong><small>{place.meta}</small></span><span className="quick-place-arrow"><ArrowUpRight size={16} /></span></Link></Reveal> })}</div></section>

    {!newcomer && <GuideBoard />}
  </>
}
