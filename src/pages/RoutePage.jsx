import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowRight, ArrowUp, ArrowUpRight, Check, Footprints, MapPin, MoveDown, MoveUp, Signpost, Sparkles, X } from 'lucide-react'
import { floors, rooms } from '../data'
import { FloorTag, PageHeading, Reveal, SectionLabel } from '../components/Primitives'
import FloorMap from '../components/FloorMap'
import { calculateIndoorRoute } from '../map-routing'

function roomName(room) { return `${room.name}${room.number ? ` №${room.number}` : ''}` }

function RouteStepIcon({ index, total, crossFloor, ascending }) {
  if (index === 0) return <MapPin size={14} />
  if (index === total - 1) return <Check size={14} />
  if (index === 2 && crossFloor) return ascending ? <MoveUp size={14} /> : <MoveDown size={14} />
  return <Footprints size={14} />
}

export default function RoutePage() {
  const [params] = useSearchParams()
  const [startId, setStartId] = useState(params.get('from') || 'entrance-1')
  const [targetId, setTargetId] = useState(params.get('to') || 'auditorium-104')
  const [transition, setTransition] = useState('lift')
  const start = rooms.find((room) => room.id === startId) || rooms.find((room) => room.id === 'entrance-1')
  const target = rooms.find((room) => room.id === targetId) || rooms[0]
  const crossFloor = start.floor !== target.floor
  const indoorRoute = useMemo(() => calculateIndoorRoute(start.id, target.id, target.floor, transition), [start.id, target.id, target.floor, transition])
  const routeSteps = useMemo(() => {
    const steps = [{ icon: 'start', title: start.id === 'entrance-1' ? 'Начните от главного входа' : `Выйдите из помещения «${start.name}»`, detail: `Точка старта · ${start.floor} этаж` }]
    if (crossFloor) {
      const transfer = transition === 'lift' ? 'лифт' : 'лестницу'
      steps.push({ icon: 'walk', title: `Следуйте по коридору к ${transfer}`, detail: transition === 'lift' ? 'Лифт обозначен на схеме отдельным узлом' : 'На плане есть несколько лестниц — выбирайте ближайшую по указателям' })
      steps.push({ icon: 'change', title: `${target.floor > start.floor ? 'Поднимитесь' : 'Спуститесь'} на ${target.floor} этаж`, detail: `Сейчас вы на ${start.floor} этаже` })
    } else {
      steps.push({ icon: 'walk', title: 'Выйдите в общий коридор', detail: 'Белые полосы на карте обозначают коридоры' })
    }
    indoorRoute.waypoints.forEach((waypoint) => steps.push({ icon: 'walk', title: waypoint, detail: `Ориентир · ${target.floor} этаж` }))
    steps.push({ icon: 'target', title: `Найдите «${target.name}»${target.number ? ` · №${target.number}` : ''}`, detail: `${target.category} · помещение отмечено на карте ${target.floor} этажа` })
    return steps
  }, [start, target, crossFloor, transition, indoorRoute.waypoints])

  const planRoute = (event) => {
    event.preventDefault()
    document.getElementById('route-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  const resetRoute = () => { setStartId('entrance-1'); setTargetId('auditorium-104'); setTransition('lift') }

  return <>
    <PageHeading eyebrow="НАВИГАЦИЯ / ПОСТРОИТЬ ПУТЬ" title={<>Из точки А<br /><em>в нужный кабинет.</em></>} description="Выберите, откуда идёте и куда нужно попасть. Подскажем этажи, ориентиры и удобный переход между ними." aside={<div className="route-heading-mark"><Signpost size={24} /><span>ПУТЬ<br />ПО КОЛЛЕДЖУ</span><i>↗</i></div>} />

    <section className="route-builder container"><Reveal className="route-form-panel"><div className="route-form-header"><span className="eyebrow"><i className="eyebrow-dot" />СОБЕРИТЕ МАРШРУТ</span><span className="route-form-step">ШАГ 01 / 02</span></div><form onSubmit={planRoute}><label className="route-select-field"><span>ОТКУДА</span><span className="route-select-wrap"><MapPin size={16} /><select value={startId} onChange={(event) => setStartId(event.target.value)}>{floors.map((floor) => <optgroup key={floor.id} label={floor.label}>{rooms.filter((room) => room.floor === floor.id).map((room) => <option key={room.id} value={room.id}>{roomName(room)}</option>)}</optgroup>)}</select></span></label><Link className="route-manual-link" to={`/map?floor=${start.floor}&manual=1`}><MapPin size={15} /> Отметить старт на плане</Link><div className="route-connector"><span /><i /><span /></div><label className="route-select-field"><span>КУДА</span><span className="route-select-wrap"><MapPin size={16} /><select value={targetId} onChange={(event) => setTargetId(event.target.value)}>{floors.map((floor) => <optgroup key={floor.id} label={floor.label}>{rooms.filter((room) => room.floor === floor.id).map((room) => <option key={room.id} value={room.id}>{roomName(room)}</option>)}</optgroup>)}</select></span></label>
      {crossFloor && <div className="route-mode-select"><span>КАК ПЕРЕЙТИ НА ДРУГОЙ ЭТАЖ?</span><div role="group" aria-label="Способ перехода"><button type="button" className={transition === 'lift' ? 'route-mode-active' : ''} onClick={() => setTransition('lift')}><MoveUp size={15} /> Лифт</button><button type="button" className={transition === 'stairs' ? 'route-mode-active' : ''} onClick={() => setTransition('stairs')}><ArrowUp size={15} /> Лестница</button></div></div>}
      <button className="button button-primary route-submit" type="submit">Построить маршрут <ArrowRight size={16} /></button></form></Reveal>

      <Reveal id="route-result" className="route-result-panel" delay={100} aria-live="polite"><div className="route-result-top"><span className="eyebrow"><i className="eyebrow-dot" />ВАШ МАРШРУТ</span><button className="route-reset" type="button" onClick={resetRoute}><X size={14} /> Сбросить</button></div><div className="route-endpoints"><div><span>СТАРТ</span><strong>{start.name}</strong><FloorTag floor={start.floor} /></div><div className="route-end-arrow"><ArrowRight size={19} /></div><div><span>ФИНИШ</span><strong>{target.name}{target.number && ` №${target.number}`}</strong><FloorTag floor={target.floor} /></div></div><div className="route-distance"><span><Footprints size={16} /> ПЕШКОМ</span><span>{crossFloor ? `ПЕРЕХОД: ${transition === 'lift' ? 'ЛИФТ' : 'ЛЕСТНИЦА'}` : 'БЕЗ СМЕНЫ ЭТАЖА'}</span><span>{routeSteps.length} ШАГА</span></div><div className="route-preview-panel"><FloorMap floor={target.floor} selectedId={target.id} routeStartId={start.id} routeTargetId={target.id} transition={transition} /></div><div className="route-steps">{routeSteps.map((step, index) => <div className="route-step" key={`${step.title}-${index}`}><span className="route-step-index"><RouteStepIcon index={index} total={routeSteps.length} crossFloor={crossFloor} ascending={target.floor > start.floor} /></span><div><strong>{step.title}</strong><small>{step.detail}</small></div><span className="route-step-count">0{index + 1}</span></div>)}</div><div className="route-result-actions"><Link className="button button-primary" to={`/map?floor=${target.floor}&from=${start.id}&to=${target.id}`}>Показать на карте <ArrowUpRight size={15} /></Link><Link className="route-other-link" to="/rooms">Справочник кабинетов <ArrowRight size={14} /></Link></div></Reveal></section>

    <section className="route-hint-band"><div className="container route-hint-inner"><span className="route-hint-icon"><Sparkles size={19} /></span><div><SectionLabel index="01">ПОДСКАЗКА ПО СХЕМЕ</SectionLabel><p>Синие отметки на плане — дверные проёмы. Коридоры выделены светлым цветом. Для точного маршрута ориентируйтесь на указатели в здании.</p></div><Link to="/map">Открыть план этажей <ArrowRight size={14} /></Link></div></section>
  </>
}
