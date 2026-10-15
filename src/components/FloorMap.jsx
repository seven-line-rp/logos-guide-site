import { rooms } from '../data'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { calculateIndoorRoute, planRoomBounds } from '../map-routing'

function FloorRoom({ room, selected, onSelect, onFloorRequest, gameTargetId, gameFeedback, filterCategory, manualLocation }) {
  const [x, y, w, h] = planRoomBounds[room.id] || [room.map.x * .632, room.map.y * .613, room.map.w * .632, room.map.h * .613]
  const isTarget = gameTargetId === room.id
  const className = [
    'plan-room',
    `plan-room-${room.category === 'Мастерские и лаборатории' ? 'lab' : room.category === 'Администрация' ? 'admin' : room.category === 'Учебные кабинеты' ? 'class' : 'common'}`,
    selected ? 'plan-room-selected' : '',
    isTarget ? 'plan-room-target' : '',
    gameFeedback === room.id ? 'plan-room-correct' : '',
    filterCategory !== 'Все места' && room.category !== filterCategory ? 'plan-room-muted' : '',
  ].filter(Boolean).join(' ')

  const activate = () => onSelect?.(room)
  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate()
    }
  }
  const onDoubleClick = (event) => {
    const stair = room.id.match(/^(stairs-(?:north|middle|west))-([12])$/)
    if (!stair) return
    event.stopPropagation()
    const nextFloor = room.floor === 1 ? 2 : 1
    const nextStair = rooms.find((item) => item.id === `${stair[1]}-${nextFloor}`)
    onFloorRequest?.(nextFloor, nextStair)
  }

  return (
    <g className={className} role="button" tabIndex={0} aria-label={`${room.name}${room.number ? `, кабинет ${room.number}` : ''}, ${room.floor} этаж`} aria-pressed={selected} onClick={activate} onDoubleClick={onDoubleClick} onKeyDown={onKeyDown}>
      <title>{`${room.name}${room.number ? ` · ${room.number}` : ''} · ${room.floor} этаж`}</title>
      <rect className="plan-room-shape" x={x} y={y} width={w} height={h} rx="1" />
      {manualLocation && <g className="plan-manual-location"><circle cx={x + w / 2} cy={y + h / 2} r="8" /><circle cx={x + w / 2} cy={y + h / 2} r="2.5" /></g>}
      {isTarget && <circle className="plan-target-halo" cx={x + w / 2} cy={y + h / 2} r={Math.max(21, Math.min(w, h) * .22)} />}
    </g>
  )
}

export default function FloorMap({ floor = 1, selectedId = '', onSelect, onFloorRequest, gameTargetId = '', gameFeedback = '', filterCategory = 'Все места', compact = false, showLabels = true, showDoorMarks = true, routeStartId = '', routeTargetId = '', manualLocationId = '', transition = 'lift' }) {
  const floorRooms = rooms.filter((room) => room.floor === floor)
  const plan = floor === 1 ? floorOnePlan : floorTwoPlan
  const route = routeStartId && routeTargetId ? calculateIndoorRoute(routeStartId, routeTargetId, floor, transition) : null

  const showLowerFloor = () => {
    const auditorium = rooms.find((room) => room.id === 'auditorium-104')
    onFloorRequest?.(1, auditorium)
  }
  const onGhostKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      showLowerFloor()
    }
  }

  return (
    <div className={`floor-map-viewport ${compact ? 'floor-map-compact' : ''} ${showLabels ? '' : 'floor-map-labels-hidden'} ${showDoorMarks ? '' : 'floor-map-doors-hidden'}`}>
      <div className={`floor-map-stage floor-map-stage-floor-${floor}`}>
        <div className="floor-map-art" dangerouslySetInnerHTML={{ __html: plan }} />
        <svg className="floor-plan-svg" viewBox={floor === 1 ? '0 0 758 552' : '0 0 767 561'} role="group" aria-label={`Интерактивная карта, ${floor} этаж`}>
        <title>{`${floor} этаж колледжа`}</title>
        <desc>Выберите помещение на плане, чтобы открыть описание и построить маршрут.</desc>
        <defs>
          <filter id={`plan-highlight-${floor}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1748c7" floodOpacity=".2" /></filter>
        </defs>
        {floorRooms.map((room) => <FloorRoom key={room.id} room={room} selected={selectedId === room.id} onSelect={onSelect} onFloorRequest={onFloorRequest} gameTargetId={gameTargetId} gameFeedback={gameFeedback} filterCategory={filterCategory} manualLocation={manualLocationId === room.id} />)}
        {route?.points.length > 1 && <g className="plan-route"><polyline points={route.points.map(([x, y]) => `${x},${y}`).join(' ')} /><circle cx={route.points[0][0]} cy={route.points[0][1]} r="6" /><circle className="plan-route-destination" cx={route.points.at(-1)[0]} cy={route.points.at(-1)[1]} r="7" /></g>}
        {floor === 2 && <g className="plan-downstairs-link" role="button" tabIndex={0} aria-label="Актовый зал, первый этаж. Переключить на первый этаж" onClick={showLowerFloor} onKeyDown={onGhostKeyDown}>
          <rect x="610" y="94" width="156" height="150" rx="2" />
        </g>}
        </svg>
      </div>
    </div>
  )
}
