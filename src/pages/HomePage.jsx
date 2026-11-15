import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { rooms, quickPlaces } from '../data.js'
import GuideBoard from '../components/GuideBoard.jsx'
import { useFavorites, useRecentRoutes } from '../components/FavoriteButton.jsx'
import { LessonCard, MyPlaces, NearbyStrip } from '../components/HomeDashboard.jsx'
import { PickmeChip, PickmeGarden, PickmeNote } from '../components/Pickme.jsx'
import VoiceSearchButton from '../components/VoiceSearchButton.jsx'
import { focusInputOnPress, useAnchorRect } from '../search-field.js'
import { cancelMiss, reportMiss, searchRooms, searchTeachers, shortName, useTeachers } from '../search.js'
import { useMinuteNow } from '../use-now.js'
import { useTheme } from '../theme.js'

// План этажа тяжёлый (геометрия обоих этажей): грузим его отдельным файлом,
// после первого экрана. Заголовок и поиск рисуются без него.
const FloorMap = lazy(() => import('../components/FloorMap.jsx'))

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

// Быстрые запросы под поиском: самые частые места. Открывают место на карте.
const QUICK_IDS = ['canteen', 'library-214', 'academic-office', 'auditorium-104', 'medical-post']
const QUICK_LABELS = { 'academic-office': 'Учебная часть', 'medical-post': 'Медпункт' }

// Превью карты на главной: тот же план, что на /map, но без жестов —
// вертикальный свайп по нему прокручивает страницу, а не двигает план.
// Выбор помещения открывает его на полной карте.
function MapPreview() {
  const [floor, setFloor] = useState(1)
  const navigate = useNavigate()
  const open = (room) => room && navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)
  return <section className="home-map" aria-labelledby="home-map-title">
    <div className="home-map-head">
      <h2 id="home-map-title">Карта корпуса</h2>
      <div className="home-map-floors" role="group" aria-label="Этаж">{[1, 2].map((value) => <button key={value} type="button" aria-pressed={floor === value} onClick={() => setFloor(value)}>{value} этаж</button>)}</div>
    </div>
    <div className="home-map-frame">
      <Suspense fallback={<div className="home-map-skeleton" role="status"><span className="visually-hidden">Загружаем план этажа</span></div>}>
        <FloorMap floor={floor} compact onSelect={open} onFloorRequest={(next) => setFloor(next)} />
      </Suspense>
    </div>
    <Link className="home-map-open" to={`/map?floor=${floor}`}>Открыть карту <ArrowUpRight size={16} aria-hidden="true" /></Link>
  </section>
}

// Пока поле поиска на главной видно, кнопка поиска в шапке скрыта: на экране
// одно поле поиска, а не два. Ушло из вида — кнопка в шапке появляется.
function useHeroSearchVisibility(ref) {
  useEffect(() => {
    const node = ref.current
    const root = document.documentElement
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) root.dataset.heroSearch = 'visible'
      else delete root.dataset.heroSearch
    }, { rootMargin: '-56px 0px 0px 0px' })
    observer.observe(node)
    return () => { observer.disconnect(); delete root.dataset.heroSearch }
  }, [ref])
}

export default function HomePage() {
  const theme = useTheme()
  const pickme = theme === 'pickme'
  const now = useMinuteNow()
  const searchRef = useRef(null)
  useHeroSearchVisibility(searchRef)
  // Кто зашёл впервые, видит под картой, что умеет путеводитель.
  const favorites = useFavorites()
  const recent = useRecentRoutes()
  const newcomer = !favorites.length && !recent.length
  return <>
    <section className={`hm-hero${pickme ? ' home-hero-pickme' : ''}`} id="top">
      {pickme && <PickmeGarden />}
      <div className="container hm-hero-inner">
        <PickmeChip />
        <h1>Найдите кабинет и постройте маршрут</h1>
        <PickmeNote />
        <div className="home-search-group" ref={searchRef}>
          <label className="visually-hidden" htmlFor="home-room-search">Поиск по колледжу: номер кабинета, место или преподаватель</label>
          <HomeSearch />
        </div>
        <ul className="home-quick" id="quick-places" aria-label="Часто ищут">{QUICK_IDS.map((id) => { const room = rooms.find((item) => item.id === id); return room && <li key={id}><Link className="home-quick-chip" to={`/map?floor=${room.floor}&room=${encodeURIComponent(id)}`}>{QUICK_LABELS[id] || quickPlaces.find((place) => place.roomId === id)?.label || room.name}</Link></li> })}</ul>
      </div>
    </section>

    <div className="home-main container">
      <MapPreview />
      <aside className="hm-day" aria-labelledby="home-day-title">
        <h2 id="home-day-title">Мой день</h2>
        <LessonCard now={now} />
        <MyPlaces />
      </aside>
    </div>

    <NearbyStrip />

    {newcomer && <GuideBoard />}
  </>
}
