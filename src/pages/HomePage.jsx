import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Building2, ChevronRight, Compass, MapPin, Search, Sparkles, Zap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { rooms, quickPlaces } from '../data'
import FloorMap from '../components/FloorMap'
import { Reveal, SectionLabel } from '../components/Primitives'

function MiniPlan() {
  const [floor, setFloor] = useState(1)
  const navigate = useNavigate()
  const openRoom = (room) => navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)

  return <div className="mini-plan-wrap" role="group" aria-label="План этажей колледжа">
    <div className="mini-plan-top"><span><i />ПЛАН КОЛЛЕДЖА</span><div className="mini-plan-tabs" role="group" aria-label="Этаж на главной карте">{[1, 2].map((number) => <button key={number} type="button" aria-label={`${number} этаж`} aria-pressed={floor === number} className={floor === number ? 'mini-plan-tab-active' : ''} onClick={() => setFloor(number)}>0{number}</button>)}</div></div>
    <FloorMap floor={floor} compact showLabels={false} onSelect={openRoom} />
    <div className="mini-plan-bottom"><span>Выберите комнату на плане</span><Link to={`/map?floor=${floor}`} aria-label="Открыть полную карту">Полная карта <ArrowUpRight size={16} /></Link></div>
  </div>
}

function HomeSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('ru')
    if (!term) return []
    return rooms.filter((room) => `${room.name} ${room.number} ${room.aliases}`.toLocaleLowerCase('ru').includes(term)).slice(0, 4)
  }, [query])
  const goTo = (room) => navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)
  const submit = (event) => {
    event.preventDefault()
    if (matches[0]) goTo(matches[0])
    else navigate(`/rooms?q=${encodeURIComponent(query.trim())}`)
  }

  return <form className="home-search" onSubmit={submit} role="search"><Search size={19} /><input value={query} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 130)} onChange={(event) => setQuery(event.target.value)} placeholder="Например, 217 или библиотека" aria-label="Найти кабинет или пространство" autoComplete="off" /><button type="submit" aria-label="Искать"><ArrowRight size={18} /></button>{open && query.trim() && <div className="home-search-suggestions">{matches.length ? matches.map((room) => <button type="button" key={room.id} onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(room)}><span>{room.name}{room.number && ` №${room.number}`}</span><small>{room.floor} этаж · {room.category}</small></button>) : <button type="submit" className="home-search-no-results"><span>Искать «{query}» в справочнике</span><small>Посмотреть все результаты</small></button>}</div>}</form>
}

export default function HomePage() {
  return <>
    <section className="home-hero" id="top"><div className="home-hero-glow" /><div className="container home-hero-inner"><div className="home-hero-copy"><span className="home-eyebrow"><i /> НАВИГАТОР ПО КОЛЛЕДЖУ <b>·</b> 2 ЭТАЖА</span><h1>Найди нужное место.<br /><em>Успей на пару.</em></h1><p>Карта этажей, поиск кабинетов и короткие маршруты — всё, чтобы освоиться в колледже без лишних кругов.</p><HomeSearch /><div className="home-hero-actions"><Link className="button button-primary" to="/map">Открыть карту <ArrowRight size={16} /></Link><Link className="home-plain-link" to="/route">Построить маршрут <ArrowUpRight size={15} /></Link></div><div className="home-proof"><span><i /> АКТУАЛЬНАЯ СХЕМА</span><span>БЕЗ ЛИШНИХ КЛИКОВ</span></div></div><Reveal className="home-hero-visual" delay={100}><MiniPlan /><div className="hero-float-card"><span className="hero-float-icon"><MapPin size={16} /></span><span><small>БЫСТРЫЙ ПОИСК</small><strong>{rooms.length} помещений на карте</strong></span><ChevronRight size={15} /></div><span className="hero-visual-index">НАВИГАТОР / 01</span></Reveal></div><div className="home-hero-edge container"><span>СНАЧАЛА — КУДА?</span><a href="#quick-places" onClick={(event) => { event.preventDefault(); document.getElementById('quick-places')?.scrollIntoView({ behavior: 'smooth' }) }}>ПОПУЛЯРНЫЕ МЕСТА <ArrowDownRight size={14} /></a><span>ПЛАНЫ ЭТАЖЕЙ / 2026</span></div></section>

    <section className="quick-places container section-pad" id="quick-places"><div className="section-top"><div><SectionLabel index="01">ЧАСТО ИЩУТ</SectionLabel><h2>Начни с <em>главного.</em></h2></div><Link className="text-link" to="/rooms">Все кабинеты <span><ArrowRight size={15} /></span></Link></div><div className="quick-place-grid">{quickPlaces.map((place, index) => { const room = rooms.find((item) => item.id === place.roomId); return <Reveal key={place.roomId} delay={index * 60}><Link className={`quick-place-card quick-place-${place.tone}`} to={`/map?floor=${room.floor}&room=${room.id}`}><span className="quick-place-num">0{index + 1}</span><span className="quick-place-graphic"><Building2 size={22} strokeWidth={1.6} /><i /></span><span className="quick-place-copy"><strong>{place.label}</strong><small>{place.meta}</small></span><span className="quick-place-arrow"><ArrowUpRight size={16} /></span></Link></Reveal> })}</div></section>

    <section className="floor-preview-band"><div className="container floor-preview-inner"><Reveal className="floor-preview-copy"><SectionLabel index="02">ПОНЯТНАЯ НАВИГАЦИЯ</SectionLabel><h2>Два этажа.<br /><em>Одна простая карта.</em></h2><p>Переключайтесь между этажами, выбирайте помещение и сразу смотрите, где оно находится.</p><Link className="button button-white" to="/map">Исследовать этажи <ArrowRight size={15} /></Link></Reveal><Reveal className="floor-switch-cards" delay={100}>{[1, 2].map((floor) => <Link key={floor} to={`/map?floor=${floor}`} className={`floor-switch-card floor-switch-${floor}`}><span className="floor-switch-number">0{floor}</span><span className="floor-switch-lines"><i /><i /><i /><i /></span><span className="floor-switch-copy"><small>{floor === 1 ? 'ПЕРВЫЙ ЭТАЖ' : 'ВТОРОЙ ЭТАЖ'}</small><strong>{floor === 1 ? 'Столовая и актовый зал' : 'Библиотека и лаборатории'}</strong></span><ArrowUpRight size={17} /></Link>)}</Reveal><div className="floor-preview-orbit" aria-hidden="true" /></div></section>

    <section className="play-teaser container section-pad"><Reveal className="play-teaser-icon"><Sparkles size={24} /></Reveal><Reveal className="play-teaser-copy" delay={70}><SectionLabel index="03">ПЕРЕМЕНА С ПОЛЬЗОЙ</SectionLabel><h2>Проверь себя:<br /><em>знаешь колледж?</em></h2><p>Пять коротких вопросов помогут запомнить, где находятся кабинеты. Без оценок — только азарт и ориентиры.</p><Link className="button button-primary" to="/games">Сыграть в квиз <Zap size={15} /></Link></Reveal><Reveal className="play-teaser-score" delay={120}><span className="score-ring"><strong>5</strong><small>ВОПРОСОВ</small></span><span className="score-caption">ПАРА МИНУТ<br />И ТЫ ЗНАЕШЬ ПЛАН</span></Reveal><div className="play-teaser-bg" aria-hidden="true">?</div></section>

    <section className="home-last-band"><div className="container home-last-inner"><span className="last-mark"><Compass size={21} /></span><p>Новая аудитория — уже не повод теряться.</p><Link to="/route">Собрать маршрут <ArrowRight size={15} /></Link></div></section>
  </>
}
