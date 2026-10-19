import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Footprints, Navigation } from 'lucide-react'
import { rooms } from '../data.js'
import { buildRouteOptions, pickRoute } from '../map-routing.js'
import { roomTitle } from '../places.js'
import RouteScene from './RouteScene.jsx'
import { RawText } from './ai-message.js'

// Карточка маршрута прямо в ответе ЛОГОС AI: откуда → куда, метры и
// минуты, а у последнего ответа — живая 3D-карта со стенами.
export default function RoutePreview({ from, to, mode = 'auto', live = false }) {
  const target = rooms.find((room) => room.id === to)
  const start = rooms.find((room) => room.id === from)
  const route = useMemo(() => (target && start ? pickRoute(buildRouteOptions(start.id, target.id), mode === 'auto' ? 'lift' : mode) : null), [start, target, mode])
  const [floor, setFloor] = useState(() => target?.floor || 1)
  if (!route || !route.byFloor) return null
  const cross = start.floor !== target.floor
  const minutes = Math.max(1, Math.round((route.seconds || 0) / 60))
  const points = route.byFloor[floor]?.points || []
  const transfer = cross && route.transfer ? {
    floor: start.floor,
    label: `${route.transfer.kind === 'lift' ? 'Лифт' : 'Лестница'} ${target.floor > start.floor ? '↑' : '↓'} ${target.floor} этаж`,
    arrival: target.floor,
    arrivalLabel: `${start.floor > target.floor ? '↓' : '↑'} с ${start.floor} этажа`,
  } : null
  const href = `/route?from=${encodeURIComponent(start.id)}&to=${encodeURIComponent(target.id)}${mode !== 'auto' ? `&mode=${mode}` : ''}`

  return <div className="ai-route">
    <div className="ai-route-head">
      <span className="ai-route-icon" aria-hidden="true"><Footprints size={16} /></span>
      <span className="ai-route-text">
        <strong><RawText text={roomTitle(start.id)} /> → <RawText text={roomTitle(target.id)} /></strong>
        <small>≈ {Math.round(route.meters || 0)} м, {minutes} мин{cross ? `, ${route.transfer?.method || 'между этажами'}` : ''}</small>
      </span>
    </div>
    {live && <div className="ai-route-map">
      <RouteScene floor={floor} points={points} mode="3d" targetId={target.id} transfer={transfer} />
      {cross && <div className="ai-route-floors" role="group" aria-label="Этаж">{[start.floor, target.floor].map((value) => <button type="button" key={value} aria-pressed={floor === value} onClick={() => setFloor(value)}>{value} этаж</button>)}</div>}
    </div>}
    <Link className="ai-route-go" to={href}><Navigation size={15} /> Открыть маршрут <ArrowRight size={15} /></Link>
  </div>
}
