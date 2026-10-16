import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { rooms } from '../data.js'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { roomOutline, planSizes } from '../map-geometry.js'
import { calculateIndoorRoute } from '../map-routing.js'

const MIN_ZOOM = 1
const MAX_ZOOM = 3.5

function FloorRoom({ room, selected, onSelect, onFloorRequest, gameTargetId, gameFeedback, filterCategory, venue }) {
  const isTarget = gameTargetId === room.id
  const className = [
    'plan-room',
    selected ? 'plan-room-selected' : '',
    isTarget ? 'plan-room-target' : '',
    gameFeedback === room.id ? 'plan-room-correct' : '',
    filterCategory !== 'Все места' && room.category !== filterCategory ? 'plan-room-muted' : '',
  ].filter(Boolean).join(' ')
  const stair = room.id.match(/^(stairs-(?:north|middle|west))-[12]$/)
  const touchStart = useRef(null)
  const lastTap = useRef({ time: 0, x: 0, y: 0 })
  const switchedAt = useRef(0)
  const skipClick = useRef(false)
  const activate = () => {
    if (skipClick.current) { skipClick.current = false; return }
    onSelect?.(room)
  }
  const switchFloor = () => {
    const nextFloor = room.floor === 1 ? 2 : 1
    onFloorRequest(nextFloor, rooms.find((item) => item.id === `${stair[1]}-${nextFloor}`))
  }
  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate()
    }
  }
  const onDoubleClick = (event) => {
    if (!stair || !onFloorRequest) return
    event.preventDefault()
    event.stopPropagation()
    if (Date.now() - switchedAt.current > 600) switchFloor()
  }
  const onPointerDown = (event) => {
    if (event.pointerType === 'touch') touchStart.current = [event.clientX, event.clientY]
  }
  const onPointerUp = (event) => {
    if (!stair || !onFloorRequest || event.pointerType !== 'touch' || !touchStart.current) return
    const [x, y] = touchStart.current
    touchStart.current = null
    if (Math.hypot(event.clientX - x, event.clientY - y) > 16) { lastTap.current.time = 0; return }
    const now = Date.now()
    const prior = lastTap.current
    if (now - prior.time < 450 && Math.hypot(event.clientX - prior.x, event.clientY - prior.y) < 36) {
      lastTap.current.time = 0
      switchedAt.current = now
      skipClick.current = true // Touch browsers may still dispatch click after pointerup.
      event.preventDefault()
      event.stopPropagation()
      switchFloor()
    } else lastTap.current = { time: now, x: event.clientX, y: event.clientY }
  }

  return <g className={className} role={onSelect ? 'button' : 'presentation'} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `${room.name}${room.number ? `, кабинет ${room.number}` : ''}, ${room.floor} этаж${stair ? '. Дважды нажмите, чтобы перейти на другой этаж' : ''}` : undefined} aria-pressed={onSelect ? selected : undefined} onClick={onSelect ? activate : undefined} onDoubleClick={onFloorRequest ? onDoubleClick : undefined} onKeyDown={onSelect ? onKeyDown : undefined} onPointerDown={stair && onFloorRequest ? onPointerDown : undefined} onPointerUp={stair && onFloorRequest ? onPointerUp : undefined}>
    <title>{`${room.name}${room.number ? ` · ${room.number}` : ''} · ${room.floor} этаж`}</title>
    <polygon className="plan-room-shape" points={roomOutline(room.id).map((point) => point.join(',')).join(' ')} />
    {venue && (() => {
      const outline = roomOutline(room.id)
      const cx = outline.reduce((sum, point) => sum + point[0], 0) / outline.length
      const top = Math.min(...outline.map((point) => point[1]))
      const cy = top + 15
      return <g className="plan-venue-badge" aria-hidden="true"><circle className="plan-venue-dot" cx={cx} cy={cy} r="11" /><text className="plan-venue-star" x={cx} y={cy + 4.5} textAnchor="middle">★</text></g>
    })()}
    {isTarget && <circle className="plan-target-halo" cx={roomOutline(room.id).reduce((sum, point) => sum + point[0], 0) / roomOutline(room.id).length} cy={roomOutline(room.id).reduce((sum, point) => sum + point[1], 0) / roomOutline(room.id).length} r="18" />}
  </g>
}

function LocationMarker({ point, kind, radius }) {
  const [x, y] = point
  return <g className={`plan-position plan-position-${kind}`} aria-hidden="true">
    {kind === 'gps' && radius && <circle className="plan-position-accuracy" cx={x} cy={y} r={Math.min(radius, 130)} />}
    <circle className="plan-position-halo" cx={x} cy={y} r="13" />
    <circle className="plan-position-core" cx={x} cy={y} r="6.5" />
    <circle className="plan-position-center" cx={x} cy={y} r="2" />
    <text x={x + 12} y={y - 13}>{kind === 'manual' ? 'Ваша отметка' : kind === 'anchor' ? 'Точка привязки' : 'GPS · примерно'}</text>
  </g>
}

function RouteLayer({ points, markerId, progress = null, is3d = false }) {
  const toLine = (list) => list.map(([x, y]) => `${x},${y}`).join(' ')
  const end = points.at(-1)
  // progress — индекс вершины, до которой пользователь уже дошёл. Пройденная
  // часть рисуется бледной, оставшаяся — яркой, и по ней едет точка-поводырь.
  const passedIndex = progress === null ? 0 : Math.max(0, Math.min(points.length - 1, progress))
  const passed = points.slice(0, passedIndex + 1)
  const ahead = points.slice(passedIndex)
  const dot = ahead[0]

  // Вычисляем угол поворота курсора для 3D-режима навигатора
  let heading = 0
  if (ahead.length > 1) {
    const next = ahead[1]
    heading = Math.atan2(next[1] - dot[1], next[0] - dot[0]) * (180 / Math.PI)
  } else if (points.length > 1) {
    const prev = points[points.length - 2]
    heading = Math.atan2(end[1] - prev[1], end[0] - prev[0]) * (180 / Math.PI)
  }

  return <g className="plan-route">
    <defs>
      <marker id={markerId} viewBox="-6 -6 12 12" refX="0" refY="0" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M-3.5 -4 L4 0 L-3.5 4 Z" />
      </marker>
    </defs>
    <polyline className="plan-route-halo" points={toLine(points)} />
    <polyline className="plan-route-line" points={toLine(ahead)} markerMid={`url(#${markerId})`} />
    <polyline className="plan-route-flow" points={toLine(ahead)} />
    {passedIndex > 0 && <polyline className="plan-route-passed" points={toLine(passed)} />}
    <circle cx={points[0][0]} cy={points[0][1]} r="7" />
    {/* Точка шага: позиция задаётся сдвигом группы, чтобы переход между
        шагами анимировался, а не прыгал. В 3D-режиме — объёмный курсор навигатора. */}
    {progress !== null && (
      is3d ? (
        <g className="plan-route-guide plan-route-guide-3d" transform={`translate(${dot[0]} ${dot[1]})`} style={{ transform: `translate(${dot[0]}px, ${dot[1]}px)` }}>
          <circle className="plan-nav-radar" cx="0" cy="0" r="22" />
          <circle className="plan-nav-halo" cx="0" cy="0" r="13" />
          <g transform={`rotate(${heading})`}>
            {/* Стрелка навигатора по образцу Яндекс.Навигатора */}
            <path d="M13 0 L-8 -8 L-3 0 L-8 8 Z" fill="#1557e9" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx="0" cy="0" r="2.2" fill="#ffffff" />
          </g>
        </g>
      ) : (
        <g className="plan-route-guide" transform={`translate(${dot[0]} ${dot[1]})`} style={{ transform: `translate(${dot[0]}px, ${dot[1]}px)` }}>
          <circle className="plan-route-guide-pulse" cx="0" cy="0" r="11" />
          <circle className="plan-route-guide-core" cx="0" cy="0" r="8" />
          <circle className="plan-route-guide-center" cx="0" cy="0" r="3" />
        </g>
      )
    )}
    <circle className="plan-route-pulse" cx={end[0]} cy={end[1]} r="9" />
    <circle className="plan-route-destination" cx={end[0]} cy={end[1]} r="8" />
  </g>
}

export default function FloorMap({ floor = 1, selectedId = '', onSelect, onFloorRequest, onPointSelect, picking = false, gameTargetId = '', gameFeedback = '', filterCategory = 'Все места', compact = false, zoomed = false, showLabels = true, showDoorMarks = true, routeStart = '', routeTargetId = '', manualPoint = null, gpsMarker = null, transition = 'lift', venueRoomIds = [], routeProgress = null, navMode3d = false, onToggle3d = null, activeStepPoint = null, swoopActive = false }) {
  const floorRooms = rooms.filter((room) => room.floor === floor)
  const plan = floor === 1 ? floorOnePlan : floorTwoPlan
  const route = routeStart && routeTargetId ? calculateIndoorRoute(routeStart, routeTargetId, floor, transition) : null
  const { width, height } = planSizes[floor]
  const viewportRef = useRef(null)
  const stageRef = useRef(null)
  const zoomRef = useRef(1)
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const pinchEndedAt = useRef(0)
  const markerId = `route-arrow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // Сдвиг 3D-камеры задаётся в пикселях страницы, а фокусная точка — в
  // единицах плана (viewBox). Замеряем реальный масштаб отрисовки, иначе на
  // широких панелях камера уезжает вниз: чем ниже точка на плане, тем сильнее
  // ошибался перевод координат. useLayoutEffect — чтобы ошибочный кадр не
  // успел показаться до замера.
  const [renderScale, setRenderScale] = useState(1)
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const measure = () => {
      const next = stage.offsetWidth / width
      if (next > 0) setRenderScale((current) => (Math.abs(current - next) > 0.004 ? next : current))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [floor, width])

  const focalPoint = useMemo(() => {
    if (activeStepPoint) return activeStepPoint
    if (routeProgress !== null && route?.points?.[routeProgress]) {
      return route.points[routeProgress]
    }
    if (route?.points?.length) return route.points[0]
    return null
  }, [activeStepPoint, routeProgress, route?.points])

  const stageTransformStyle = useMemo(() => {
    if (!navMode3d) return undefined
    const cx = width / 2
    const cy = height / 2
    const targetPoint = focalPoint || [cx, cy]
    // План отрисован в renderScale раз крупнее своих единиц, поэтому сдвиг
    // к центру тоже умножаем на этот масштаб.
    const tx = renderScale * (cx - targetPoint[0])
    const ty = renderScale * (cy - targetPoint[1] + 35)
    if (swoopActive) {
      return {
        transformOrigin: '50% 65%',
        transform: `rotateX(15deg) scale(1.1) translate3d(${tx * 0.4}px, ${ty * 0.4}px, 0)`,
        transition: 'transform 1.05s cubic-bezier(0.18, 0.89, 0.32, 1.15)',
      }
    }
    return {
      transformOrigin: '50% 65%',
      transform: `rotateX(46deg) scale(1.45) translate3d(${tx}px, ${ty}px, 0)`,
      transition: 'transform 0.75s cubic-bezier(0.22, 1, 0.36, 1)',
    }
  }, [navMode3d, width, height, focalPoint, swoopActive, renderScale])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || compact) return
    const room = rooms.find((item) => item.floor === floor && item.id === selectedId)
    const outline = room ? roomOutline(room.id) : null
    const focusPoint = outline ? [outline.reduce((sum, point) => sum + point[0], 0) / outline.length, outline.reduce((sum, point) => sum + point[1], 0) / outline.length] :
      manualPoint?.floor === floor ? [manualPoint.x, manualPoint.y] : null
    if (!focusPoint) return
    const stage = viewport.querySelector('.floor-map-stage')
    if (!stage) return
    const scale = stage.getBoundingClientRect().width / width
    // Don't move a staircase between the first and second tap on a phone.
    const timer = window.setTimeout(() => {
      viewport.scrollLeft = Math.max(0, focusPoint[0] * scale - viewport.clientWidth / 2)
      viewport.scrollTop = Math.max(0, focusPoint[1] * scale - viewport.clientHeight / 2)
    }, room?.id.startsWith('stairs-') ? 540 : 340)
    return () => window.clearTimeout(timer)
  }, [compact, floor, manualPoint?.floor, manualPoint?.x, manualPoint?.y, selectedId, width, zoomed])

  // Each floor reuses the same stage element, so reset its zoom when the floor changes.
  useEffect(() => {
    if (stageRef.current) stageRef.current.style.width = ''
    zoomRef.current = 1
  }, [floor])

  // Zoom around a point (in viewport pixels) so that the content under the fingers stays put.
  const applyZoom = (nextZoom, anchorX, anchorY) => {
    const viewport = viewportRef.current
    const stage = stageRef.current
    if (!viewport || !stage) return
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    const oldWidth = stage.offsetWidth
    const oldHeight = stage.offsetHeight
    const fx = (viewport.scrollLeft + anchorX) / oldWidth
    const fy = (viewport.scrollTop + anchorY) / oldHeight
    stage.style.width = `${clamped * 100}%`
    viewport.scrollLeft = Math.max(0, fx * stage.offsetWidth - anchorX)
    viewport.scrollTop = Math.max(0, fy * stage.offsetHeight - anchorY)
    zoomRef.current = clamped
  }
  const zoomByButton = (factor) => {
    const viewport = viewportRef.current
    if (!viewport) return
    applyZoom(zoomRef.current * factor, viewport.clientWidth / 2, viewport.clientHeight / 2)
  }
  const resetZoom = () => {
    const viewport = viewportRef.current
    if (stageRef.current) stageRef.current.style.width = ''
    zoomRef.current = 1
    if (viewport) { viewport.scrollLeft = 0; viewport.scrollTop = 0 }
  }

  const onPointerDown = (event) => {
    if (compact || event.pointerType !== 'touch') return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoomRef.current }
    }
  }
  const onPointerMove = (event) => {
    if (!pinch.current || !pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size < 2) return
    const [a, b] = [...pointers.current.values()]
    const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1
    const rect = viewportRef.current.getBoundingClientRect()
    applyZoom(pinch.current.zoom * distance / pinch.current.distance, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top)
  }
  const onPointerEnd = (event) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.delete(event.pointerId)
    if (pinch.current) {
      pinchEndedAt.current = Date.now()
      if (pointers.current.size < 2) pinch.current = null
    }
  }
  // After a two-finger gesture, the browser may still send a click to a room under a finger.
  const onClickCapture = (event) => {
    if (Date.now() - pinchEndedAt.current < 350) { event.stopPropagation(); event.preventDefault() }
  }

  const showLowerFloor = () => onFloorRequest?.(1, rooms.find((room) => room.id === 'auditorium-104'))
  const onGhostKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showLowerFloor() }
  }
  const onMapClickCapture = (event) => {
    if (!picking || !onPointSelect) return
    const svg = event.currentTarget
    const matrix = svg.getScreenCTM()
    const coordinates = matrix && typeof DOMPoint !== 'undefined' ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null
    const rect = svg.getBoundingClientRect()
    const point = coordinates ? [coordinates.x, coordinates.y] : [((event.clientX - rect.left) / rect.width) * width, ((event.clientY - rect.top) / rect.height) * height]
    event.preventDefault()
    event.stopPropagation() // Do not select a room while placing a precise pin.
    onPointSelect({ floor, x: Math.round(point[0] * 10) / 10, y: Math.round(point[1] * 10) / 10 })
  }

  const viewport = <div ref={viewportRef} className={`floor-map-viewport ${compact ? 'floor-map-compact' : ''} ${zoomed ? 'floor-map-zoomed' : ''} ${picking ? 'floor-map-picking' : ''} ${showLabels ? '' : 'floor-map-labels-hidden'} ${showDoorMarks ? '' : 'floor-map-doors-hidden'} ${navMode3d ? 'floor-map-3d' : ''}`}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onClickCapture={onClickCapture}>
    <div ref={stageRef} className={`floor-map-stage floor-map-stage-floor-${floor} ${navMode3d ? 'floor-map-stage-3d' : ''}`} style={stageTransformStyle}>
      <div className="floor-map-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: plan }} />
      <svg className="floor-plan-svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Интерактивная карта, ${floor} этаж`} onClickCapture={onMapClickCapture}>
        <title>{`${floor} этаж колледжа`}</title>
        <desc>{picking ? 'Коснитесь точки на плане, чтобы установить отметку.' : 'Выберите помещение, чтобы открыть описание. Двойной щелчок по лестнице переключает этаж.'}</desc>
        {floorRooms.map((room) => <FloorRoom key={room.id} room={room} selected={selectedId === room.id} onSelect={onSelect} onFloorRequest={onFloorRequest} gameTargetId={gameTargetId} gameFeedback={gameFeedback} filterCategory={filterCategory} venue={venueRoomIds.includes(room.id)} />)}
        {route?.points.length > 1 && <RouteLayer points={route.points} markerId={markerId} progress={routeProgress} is3d={navMode3d} />}
        {floor === 2 && onFloorRequest && <g className="plan-downstairs-link" role="button" tabIndex={0} aria-label="Актовый зал на первом этаже. Открыть первый этаж" onClick={showLowerFloor} onKeyDown={onGhostKeyDown}><rect x="610" y="94" width="156" height="150" rx="2" /></g>}
        {manualPoint?.floor === floor && <LocationMarker point={[manualPoint.x, manualPoint.y]} kind="manual" />}
        {gpsMarker?.floor === floor && <LocationMarker point={gpsMarker.point} radius={gpsMarker.radius} kind={gpsMarker.mode} />}
      </svg>
    </div>
    {onToggle3d && (
      <button
        type="button"
        className={`floor-map-3d-toggle-btn ${navMode3d ? 'is-3d' : 'is-2d'}`}
        onClick={onToggle3d}
        aria-label={navMode3d ? 'Переключить в 2D (вид сверху)' : 'Переключить в 3D (вид навигатора)'}
        title={navMode3d ? '2D вид сверху' : '3D навигатор (вид камеры)'}
      >
        <span className="map-3d-badge">{navMode3d ? '3D' : '2D'}</span>
        <span className="map-3d-label">{navMode3d ? 'Камера' : 'Сверху'}</span>
      </button>
    )}
  </div>

  if (compact) return viewport
  return <div className="floor-map-wrap">
    {viewport}
    <div className="floor-map-zoom-controls" role="group" aria-label="Масштаб карты">
      <button type="button" onClick={() => zoomByButton(1.4)} aria-label="Приблизить"><ZoomPlus /></button>
      <button type="button" onClick={() => zoomByButton(1 / 1.4)} aria-label="Отдалить"><ZoomMinus /></button>
      <button type="button" onClick={resetZoom} aria-label="Показать весь план" style={{ fontSize: 12, fontWeight: 650 }}>1:1</button>
    </div>
    <span className="floor-map-hint" aria-hidden="true">Двумя пальцами — масштаб</span>
  </div>
}

function ZoomPlus() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

function ZoomMinus() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
}
