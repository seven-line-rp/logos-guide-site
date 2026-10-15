import { rooms } from '../data'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { calculateIndoorRoute, isPointInCollegePlan, planRoomBounds } from '../map-routing'

function FloorRoom({ room, selected, onSelect, onFloorRequest, gameTargetId, gameFeedback, filterCategory }) {
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
      {isTarget && <circle className="plan-target-halo" cx={x + w / 2} cy={y + h / 2} r={Math.max(21, Math.min(w, h) * .22)} />}
    </g>
  )
}

export default function FloorMap({ floor = 1, selectedId = '', onSelect, onFloorRequest, onMapPositionSelect, manualLocationMode = false, gpsPosition = null, manualPosition = null, gameTargetId = '', gameFeedback = '', filterCategory = 'Все места', compact = false, showLabels = true, showDoorMarks = true, routeStartId = '', routeTargetId = '', transition = 'lift' }) {
  const floorRooms = rooms.filter((room) => room.floor === floor)
  const plan = floor === 1 ? floorOnePlan : floorTwoPlan
  const viewBox = floor === 1 ? '0 0 758 552' : '0 0 767 561'
  const route = routeStartId && routeTargetId ? calculateIndoorRoute(routeStartId, routeTargetId, floor, transition) : null

  const selectPosition = (event) => {
    if (!manualLocationMode || !onMapPositionSelect) return
    const svg = event.currentTarget
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const coordinates = point.matrixTransform(svg.getScreenCTM().inverse())
    const [, , width, height] = viewBox.split(' ').map(Number)
    if (coordinates.x < 0 || coordinates.y < 0 || coordinates.x > width || coordinates.y > height) return
    if (!isPointInCollegePlan([coordinates.x, coordinates.y], floor)) return
    event.preventDefault()
    event.stopPropagation()
    onMapPositionSelect({ floor, x: coordinates.x, y: coordinates.y })
  }

  return (
    <div className={`floor-map-viewport ${compact ? 'floor-map-compact' : ''} ${showLabels ? '' : 'floor-map-labels-hidden'} ${showDoorMarks ? '' : 'floor-map-doors-hidden'} ${manualLocationMode ? 'floor-map-picking' : ''}`}>
      <div className={`floor-map-stage floor-map-stage-floor-${floor}`}>
        <div className="floor-map-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: plan }} />
        <svg className="floor-plan-svg" viewBox={viewBox} role="group" aria-label={`Интерактивная карта, ${floor} этаж`} onClickCapture={selectPosition}>
          <title>{`${floor} этаж колледжа`}</title>
          <desc>Выберите помещение на плане. В режиме ручной отметки коснитесь любой точки внутри здания.</desc>
          <defs><filter id={`plan-highlight-${floor}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1748c7" floodOpacity=".2" /></filter></defs>
          {floorRooms.map((room) => <FloorRoom key={room.id} room={room} selected={selectedId === room.id} onSelect={onSelect} onFloorRequest={onFloorRequest} gameTargetId={gameTargetId} gameFeedback={gameFeedback} filterCategory={filterCategory} />)}
          {route?.points.length > 1 && <g className="plan-route"><polyline points={route.points.map(([x, y]) => `${x},${y}`).join(' ')} /><circle cx={route.points[0][0]} cy={route.points[0][1]} r="6" /><circle className="plan-route-destination" cx={route.points.at(-1)[0]} cy={route.points.at(-1)[1]} r="7" /></g>}
          {manualPosition?.floor === floor && !(gpsPosition?.floor === floor && Math.hypot(gpsPosition.x - manualPosition.x, gpsPosition.y - manualPosition.y) < 2) && <g className="plan-location-marker plan-manual-location" aria-label="Вы здесь, ручная отметка"><circle className="location-pulse" cx={manualPosition.x} cy={manualPosition.y} r="15" /><circle cx={manualPosition.x} cy={manualPosition.y} r="8" /><circle className="location-dot" cx={manualPosition.x} cy={manualPosition.y} r="2.5" /></g>}
          {gpsPosition?.floor === floor && <g className="plan-location-marker plan-gps-location" aria-label="Ваше местоположение GPS"><circle className="location-pulse" cx={gpsPosition.x} cy={gpsPosition.y} r="17" /><circle cx={gpsPosition.x} cy={gpsPosition.y} r="9" /><circle className="location-dot" cx={gpsPosition.x} cy={gpsPosition.y} r="3" /></g>}
        </svg>
      </div>
    </div>
  )
}
