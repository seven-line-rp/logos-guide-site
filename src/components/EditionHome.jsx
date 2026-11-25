import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { translate, useLanguage } from '../i18n.js'
import FloorMap from './FloorMap.jsx'
import './compass-film.css'

const CompassFilm = lazy(() => import('./CompassFilm.jsx'))
const clamp = (v) => Math.max(0, Math.min(1,v))
const ease = (a,b,p) => { const t=clamp((p-a)/(b-a)); return t*t*(3-2*t) }

export default function EditionHome({ search }) {
  const language=useLanguage()
  const navigate=useNavigate()
  const stage=useRef(null)
  const intro=useRef(null)
  const map=useRef(null)
  const [floor,setFloor]=useState(1)
  useEffect(()=>{
    const el=stage.current
    let frame=0
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
    const draw=()=>{
      frame=0
      const sticky=el.firstElementChild
      const p=clamp(-el.getBoundingClientRect().top/Math.max(1,el.offsetHeight-sticky.clientHeight))
      el.style.setProperty('--film-p',p)
      const fade=ease(.02,.14,p), reveal=ease(.83,.98,p)
      el.style.setProperty('--intro-fade',reduced.matches?0:fade)
      el.style.setProperty('--map-reveal',reduced.matches?1:reveal)
      intro.current.inert=!reduced.matches&&fade>.95
      map.current.inert=!reduced.matches&&reveal<.95
    }
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw)}
    window.addEventListener('scroll',schedule,{passive:true})
    window.addEventListener('resize',schedule)
    reduced.addEventListener('change',schedule)
    draw()
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule)}
  },[])
  return <div className="edition-home compass-home" id="top">
    <section className="compass-stage" ref={stage} aria-labelledby="edition-title">
      <div className="compass-sticky">
        <div className="compass-intro" ref={intro}>
          <h1 id="edition-title">{translate('Логос Путеводитель',language)}</h1>
          <p>{translate('Ваш ориентир в колледже.',language)}</p>
          <Link className="compass-cta" to="/map">{translate('Открыть карту',language)}<ArrowUpRight size={17}/></Link>
        </div>
        <Suspense fallback={<div className="compass-film"><img src="/art/edition-compass.webp" alt=""/></div>}><CompassFilm stageRef={stage}/></Suspense>
        <div className="compass-scroll" aria-hidden="true"><ArrowDown size={16}/><span>{translate('Прокрутите, чтобы продолжить',language)}</span></div>
        <section className="compass-map" ref={map} aria-labelledby="edition-plan-title">
          <div className="compass-map-copy">
            <h2 id="edition-plan-title">{translate('Найти кабинет',language)}</h2>
            <p>{translate('Выберите помещение на карте или воспользуйтесь поиском.',language)}</p>
            <div className="edition-search"><label htmlFor="home-room-search">{translate('Поиск по колледжу',language)}</label>{search}</div>
            <div className="edition-plan-switch" role="group" aria-label={translate('Выбор этажа',language)}>
              {[1,2].map(n=><button key={n} type="button" aria-pressed={floor===n} onClick={()=>setFloor(n)}>{n} {translate('этаж',language)}</button>)}
            </div>
            <Link className="compass-cta" to={`/map?floor=${floor}`}>{translate('Открыть карту',language)}<ArrowUpRight size={17}/></Link>
          </div>
          <div className="compass-map-board"><FloorMap floor={floor} compact onSelect={room=>navigate(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`)} onFloorRequest={setFloor}/></div>
        </section>
      </div>
    </section>
  </div>
}
