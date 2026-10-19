import { searchableRoom } from '../i18n.js'
import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, MapPin, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { rooms, quickPlaces } from '../data.js'
import HeroScene from '../components/HeroScene.jsx'
import AiPromoBanner from '../components/AiPromoBanner.jsx'
import HomeDashboard from '../components/HomeDashboard.jsx'
import { Reveal, SectionLabel } from '../components/Primitives.jsx'

function HomeSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('ru')
    if (!term) return []
    return rooms.filter((room) => searchableRoom(room).includes(term)).slice(0, 4)
  }, [query])
  const goTo = (room) => navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)
  const submit = (event) => {
    event.preventDefault()
    if (matches[0]) goTo(matches[0])
    else navigate(`/rooms?q=${encodeURIComponent(query.trim())}`)
  }

  return <form className="home-search" onSubmit={submit} role="search"><Search size={19} /><input id="home-room-search" value={query} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 130)} onChange={(event) => setQuery(event.target.value)} placeholder="Например, 217 или библиотека" aria-label="Найти кабинет или пространство" autoComplete="off" /><button type="submit" aria-label="Искать"><ArrowRight size={18} /></button>{open && query.trim() && <div className="home-search-suggestions">{matches.length ? matches.map((room) => <button type="button" key={room.id} onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(room)}><span>{room.name}{room.number && ` №${room.number}`}</span><small>{room.floor} этаж · {room.category}</small></button>) : <button type="submit" className="home-search-no-results"><span>Искать «{query}» в справочнике</span><small>Посмотреть все результаты</small></button>}</div>}</form>
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
          <p>Найдите кабинет по номеру или названию — покажем его на карте и подскажем маршрут.</p>
          <div className="home-search-group">
            <label className="home-search-label" htmlFor="home-room-search">Поиск по колледжу</label>
            <HomeSearch />
          </div>
          <div className="home-hero-actions">
            <Link className="button button-white home-map-cta" to="/map">Смотреть карту <ArrowRight size={16} /></Link>
            <Link className="home-plain-link" to="/route" aria-label="Построить маршрут"><span className="home-route-long">Построить маршрут</span><span className="home-route-short">Маршрут</span><ArrowUpRight size={16} /></Link>
          </div>
        </div>
        <Link className="hero-scene-caption" to="/route?from=entrance-1&to=physics-211&mode=stairs-west"><span className="hero-scene-caption-dot" aria-hidden="true" /><span><strong>Главный вход → кабинет физики 211</strong><small>Пример маршрута · по западной лестнице на 2 этаж</small></span><ArrowUpRight size={15} /></Link>
      </div>
      <div className="home-hero-edge container"><span>План корпуса · 1 и 2 этажи</span><a href="#quick-places" onClick={(event) => { event.preventDefault(); document.getElementById('quick-places')?.scrollIntoView({ behavior: 'smooth' }) }}>Часто ищут <ArrowDownRight size={14} /></a></div>
    </section>

    <HomeDashboard />

    <section className="quick-places container section-pad" id="quick-places"><div className="section-top"><div><SectionLabel>Часто ищут</SectionLabel><h2>Начните <em>здесь.</em></h2></div><Link className="text-link" to="/rooms">Все помещения <span><ArrowRight size={15} /></span></Link></div><div className="quick-place-grid">{quickPlaces.map((place, index) => { const room = rooms.find((item) => item.id === place.roomId); return <Reveal key={place.roomId} delay={index * 60} variant="up"><Link className={`quick-place-card quick-place-${place.tone}`} to={`/map?floor=${room.floor}&room=${room.id}`}><span className="quick-place-num">0{index + 1} / {room.floor} этаж</span><span className="quick-place-copy"><strong>{place.label}</strong><small>{place.meta}</small></span><span className="quick-place-arrow"><ArrowUpRight size={16} /></span></Link></Reveal> })}</div></section>

    <AiPromoBanner />

    <section className="floor-preview-band"><div className="container floor-preview-inner"><Reveal className="floor-preview-copy" variant="left"><SectionLabel>Планы этажей</SectionLabel><h2>Первый<br />или <em>второй?</em></h2><p>Переключайтесь между этажами, выбирайте помещения и находите ближайшую лестницу.</p><Link className="button button-white" to="/map">Открыть карту <ArrowRight size={15} /></Link></Reveal><Reveal className="floor-switch-cards" delay={90} variant="right">{[1, 2].map((floor) => <Link key={floor} to={`/map?floor=${floor}`} className={`floor-switch-card floor-switch-${floor}`}><span className="floor-switch-number">0{floor}</span><span className="floor-switch-copy"><small>{floor === 1 ? 'ПЕРВЫЙ ЭТАЖ' : 'ВТОРОЙ ЭТАЖ'}</small><strong>{floor === 1 ? 'Столовая, актовый зал, учебная часть' : 'Библиотека, лаборатории, кабинеты'}</strong></span><ArrowUpRight size={17} /></Link>)}</Reveal></div></section>

    <section className="play-teaser container section-pad"><Reveal className="play-teaser-copy" variant="up"><SectionLabel>На перемене</SectionLabel><h2>Проверьте себя<br /><em>по плану.</em></h2><p>В коротком квизе можно потренироваться узнавать кабинеты и этажи.</p><Link className="button button-primary" to="/games">Открыть игры <ArrowRight size={15} /></Link></Reveal><Link className="quiz-preview" to="/games" aria-label="Открыть квиз «Узнай этаж»"><span className="quiz-preview-top"><span>Узнай этаж</span><span>Вопрос 1 из 5</span></span><strong>На каком этаже библиотека?</strong><span className="quiz-preview-options"><span>1 этаж</span><span className="quiz-preview-right"><Check size={14} /> 2 этаж</span></span><span className="quiz-preview-foot">Без оценок · около минуты</span></Link></section>
  </>
}
