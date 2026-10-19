import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Compass, Crosshair, Minus, Plus } from 'lucide-react'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { rooms } from '../data.js'
import { composePlanArt } from '../map-art.js'
import { planSizes, roomOutline } from '../map-geometry.js'
import { floorDoors, floorWalls } from '../hero-scene-model.js'
import { useLanguage } from '../i18n.js'
import { FOLLOW_ZOOM, TILT_3D, cameraTransform, clampCamera, fitCamera, headingYaw, panCamera, pathData, pathHeading, projectPoint, zoomCamera } from '../route-scene-model.js'

// Интерактивная карта маршрута. Пол — настоящий план, стены и двери подняты
// в CSS 3D из той же геометрии, что и кликабельные помещения
// (hero-scene-model.js). Камеру можно двигать: тянуть план, крутить
// (правая кнопка, Shift или два пальца), приближать колесом и щипком.
// Пока человек идёт по шагам, камера сама летит за точкой маршрута; после
// ручного управления появляется кнопка «к маршруту».

const WALL_HEIGHT = 20
const CLICK_SLOP = 6

const sceneCache = new Map()
function floorScene(floor) {
  if (!sceneCache.has(floor)) {
    sceneCache.set(floor, {
      walls: floorWalls(floor),
      doors: floorDoors(floor, 10),
      rooms: rooms.filter((room) => room.floor === floor).map((room) => ({ room, points: roomOutline(room.id).map((point) => point.join(',')).join(' ') })),
    })
  }
  return sceneCache.get(floor)
}

const PERSPECTIVE = 1500
const ORIGIN_Y = 0.4 // perspective-origin в route-scene.css

export default function RouteScene({ floor, points = [], progress = null, following = false, mode = '3d', selectedId = '', targetId = '', transfer = null, notices = [], onRoomClick, onFollowChange }) {
  const language = useLanguage()
  const size = planSizes[floor]
  const scene = floorScene(floor)
  const plan = useMemo(() => composePlanArt(floor === 1 ? floorOnePlan : floorTwoPlan, floor, language), [floor, language])
  const rootRef = useRef(null)
  const [viewport, setViewport] = useState({ width: 800, height: 500 })
  const [camera, setCamera] = useState(null)
  const [animated, setAnimated] = useState(true)
  const gesture = useRef(null)
  const pointers = useRef(new Map())
  const suppressClick = useRef(false)
  const tilt = mode === '3d' ? TILT_3D : 0

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const measure = () => setViewport({ width: root.clientWidth || 800, height: root.clientHeight || 500 })
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const index = progress === null ? null : Math.max(0, Math.min(points.length - 1, progress))
  const active = index === null ? null : points[index]
  const heading = index === null ? null : pathHeading(points, index)

  // Куда смотреть: за шагом маршрута или на весь маршрут этажа сразу.
  const autoCamera = useCallback((reference = 0) => {
    if (following && active) {
      const yaw = mode === '3d' ? headingYaw(heading, reference) : 0
      return clampCamera({ x: active[0], y: active[1], zoom: FOLLOW_ZOOM[mode] * Math.min(1, viewport.width / 700 + 0.3), tilt, yaw }, size)
    }
    const yaw = mode === '3d' ? nearestYaw(-18, reference) : 0
    return fitCamera(points.length ? points : null, viewport, { tilt, yaw, size, padding: points.length ? (viewport.width < 560 ? 36 : 60) : 20, minSpan: points.length ? (viewport.width < 560 ? 230 : 380) : 0 })
  }, [following, active, heading, mode, tilt, points, viewport, size])

  const pointsKey = points.map((point) => point.join(',')).join(';')
  useEffect(() => {
    setAnimated(true)
    setCamera((current) => autoCamera(current?.yaw ?? 0))
    // Камеру перенаводим при смене шага, режима, маршрута или размера.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [following, active?.[0], active?.[1], mode, pointsKey, viewport.width, viewport.height])

  const cam = camera || autoCamera()
  const takeControl = () => { setAnimated(false); if (following) onFollowChange?.(false) }

  // ---------- Жесты ----------
  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return
    pointers.current.set(event.pointerId, [event.clientX, event.clientY])
    const rotate = event.button === 2 || event.shiftKey || event.ctrlKey || event.altKey
    gesture.current = { kind: pointers.current.size > 1 ? 'pinch' : rotate ? 'rotate' : 'pan', start: [event.clientX, event.clientY], last: [event.clientX, event.clientY], moved: 0, pinch: pinchState() }
  }
  const pinchState = () => {
    const list = [...pointers.current.values()]
    if (list.length < 2) return null
    const [a, b] = list
    return { distance: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, angle: Math.atan2(b[1] - a[1], b[0] - a[0]), center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }
  }
  const onPointerMove = (event) => {
    const g = gesture.current
    if (!g || !pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, [event.clientX, event.clientY])
    const dx = event.clientX - g.last[0]
    const dy = event.clientY - g.last[1]
    g.last = [event.clientX, event.clientY]
    g.moved += Math.abs(dx) + Math.abs(dy)
    if (g.moved < CLICK_SLOP && g.kind !== 'pinch') return
    if (!g.captured) {
      g.captured = true
      suppressClick.current = true
      takeControl()
      try { rootRef.current?.setPointerCapture(event.pointerId) } catch { /* указатель уже отпущен */ }
    }
    if (pointers.current.size > 1) {
      const next = pinchState()
      if (!g.pinch || !next) { g.pinch = next; return }
      const rect = rootRef.current.getBoundingClientRect()
      const offset = [next.center[0] - rect.left - rect.width / 2, next.center[1] - rect.top - rect.height / 2]
      setCamera((current) => {
        let value = zoomCamera(current || cam, next.distance / g.pinch.distance, offset, size)
        value = panCamera(value, next.center[0] - g.pinch.center[0], next.center[1] - g.pinch.center[1], size)
        if (mode === '3d') value = { ...value, yaw: value.yaw + (next.angle - g.pinch.angle) * 180 / Math.PI }
        return value
      })
      g.pinch = next
      return
    }
    if (g.kind === 'rotate') {
      setCamera((current) => clampCamera({ ...(current || cam), yaw: (current || cam).yaw + dx * 0.4, tilt: mode === '3d' ? (current || cam).tilt - dy * 0.25 : 0 }, size))
    } else {
      setCamera((current) => panCamera(current || cam, dx, dy, size))
    }
  }
  const onPointerUp = (event) => {
    pointers.current.delete(event.pointerId)
    if (!pointers.current.size) {
      gesture.current = null
      // Клик после перетаскивания не должен выбирать помещение.
      window.setTimeout(() => { suppressClick.current = false }, 0)
    } else if (gesture.current) {
      gesture.current.pinch = pinchState()
      const [rest] = [...pointers.current.values()]
      gesture.current.last = rest
    }
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const rect = root.getBoundingClientRect()
      const offset = [event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2]
      setAnimated(false)
      onFollowChange?.(false)
      setCamera((current) => zoomCamera(current || autoCamera(), Math.exp(-event.deltaY * 0.0016), offset, size))
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [autoCamera, onFollowChange, size])

  const zoomBy = (factor) => { setAnimated(true); onFollowChange?.(false); setCamera((current) => zoomCamera(current || cam, factor, [0, 0], size)) }
  const resetNorth = () => { setAnimated(true); onFollowChange?.(false); setCamera((current) => ({ ...(current || cam), yaw: nearestYaw(0, (current || cam).yaw) })) }
  const recenter = () => {
    setAnimated(true)
    if (active && !following) onFollowChange?.(true)
    else setCamera((current) => autoCamera(current?.yaw ?? 0))
  }

  const clickRoom = (room) => {
    if (suppressClick.current) return
    onRoomClick?.(room)
  }

  const passed = index === null ? [] : points.slice(0, index + 1)
  const ahead = index === null ? points : points.slice(index)
  const start = points[0]
  const end = points.at(-1)
  const target = rooms.find((room) => room.id === targetId && room.floor === floor)
  const transferHere = transfer && end && transfer.floor === floor
  const routeKey = `${floor}|${pointsKey}`
  const center = [viewport.width / 2, viewport.height / 2]
  // Подписи рисуются плоским слоем поверх сцены (см. projectPoint).
  const marks = []
  if (end && transferHere) marks.push({ key: `t-${routeKey}`, point: end, label: transfer.label, kind: 'transfer' })
  else if (end && target) marks.push({ key: `e-${routeKey}`, point: end, label: target.number || '★', kind: 'target' })
  if (start && points.length > 1 && transfer?.arrival === floor) marks.push({ key: `a-${routeKey}`, point: start, label: transfer.arrivalLabel, kind: 'arrival' })
  // Объявления (public/notices.json): значок над помещением.
  for (const notice of notices) {
    const room = scene.rooms.find((item) => item.room.id === notice.roomId)
    if (!room) continue
    const outline = roomOutline(notice.roomId)
    const point = [outline.reduce((sum, p) => sum + p[0], 0) / outline.length, outline.reduce((sum, p) => sum + p[1], 0) / outline.length]
    marks.push({ key: `n-${notice.roomId}-${notice.title}`, point, label: `${notice.type === 'closed' ? '⛔' : notice.type === 'event' ? '★' : 'ℹ'} ${notice.title}`, kind: `notice rs-mark-notice-${notice.type}` })
  }

  return <div ref={rootRef} className={`rs rs-${mode} ${animated ? 'rs-animated' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onContextMenu={(event) => event.preventDefault()}
    style={{ '--wall-h': `${WALL_HEIGHT}px` }}>
    <div className="rs-camera" style={{ width: size.width, height: size.height, transform: cameraTransform(cam, center) }}>
      <div className="rs-ground" />
      <div className="rs-plate" aria-hidden="true" dangerouslySetInnerHTML={{ __html: plan }} />
      <svg className="rs-rooms" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label={`План, ${floor} этаж`}>
        {scene.rooms.map(({ room, points: outline }) => <polygon key={room.id} points={outline}
          className={`rs-room ${room.id === selectedId ? 'is-selected' : ''} ${room.id === targetId ? 'is-target' : ''}`}
          role="button" tabIndex={0} aria-label={`${room.name}${room.number ? `, кабинет ${room.number}` : ''}`}
          onClick={() => clickRoom(room)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRoomClick?.(room) } }}><title>{`${room.name}${room.number ? ` · ${room.number}` : ''}`}</title></polygon>)}
      </svg>
      {points.length > 1 && <svg key={routeKey} className="rs-route" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
        <path className="rs-route-shadow" d={pathData(points)} />
        <path className="rs-route-base" d={pathData(points)} />
        {passed.length > 1 && <path className="rs-route-passed" d={pathData(passed)} />}
        <path className="rs-route-line" d={pathData(ahead)} pathLength="1" />
        <path className="rs-route-flow" d={pathData(ahead)} />
        <circle className="rs-route-start" cx={start[0]} cy={start[1]} r="6" />
        <circle className="rs-route-end" cx={end[0]} cy={end[1]} r="7" />
      </svg>}
      <div className="rs-walls" key={`walls-${floor}`}>
        {scene.walls.map((wall, i) => <i key={i} className="rs-wall" style={{ left: wall.x, top: wall.y, width: wall.length, '--a': `${wall.angle}deg`, '--i': i % 40 }} />)}
        {scene.doors.map((door) => <i key={door.id} className={`rs-door ${door.id === targetId ? 'is-target' : ''}`} style={{ left: door.x, top: door.y, width: door.width, '--a': `${door.angle}deg` }} />)}
      </div>
      {active && <div className="rs-walker" style={{ transform: `translate3d(${active[0]}px, ${active[1]}px, 1.5px)` }}>
        <span className="rs-walker-ring" />
        <span className="rs-walker-dot" style={{ transform: `rotate(${(heading ?? 0) + 90}deg)` }}><svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -9 L7 7 L0 3.5 L-7 7 Z" /></svg></span>
      </div>}
    </div>

    <div className="rs-marks" aria-hidden="true">
      {marks.map((mark) => {
        const [x, y] = projectPoint(cam, center, [mark.point[0], mark.point[1], 0], { perspective: PERSPECTIVE, origin: [viewport.width / 2, viewport.height * ORIGIN_Y] })
        return <div key={mark.key} className={`rs-mark rs-mark-${mark.kind}`} style={{ transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` }}><span className="rs-mark-head">{mark.label}</span><span className="rs-mark-stem" /></div>
      })}
    </div>

    <div className="rs-controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => zoomBy(1.35)} aria-label="Приблизить"><Plus size={17} /></button>
      <button type="button" onClick={() => zoomBy(1 / 1.35)} aria-label="Отдалить"><Minus size={17} /></button>
      <button type="button" onClick={resetNorth} aria-label="Повернуть на север" title="Север вверху"><Compass size={17} style={{ transform: `rotate(${cam.yaw - 45}deg)` }} /></button>
      <button type="button" className={following ? 'is-on' : ''} onClick={recenter} aria-label={active ? 'Следовать за маршрутом' : 'Показать весь маршрут'} title={active ? 'Следовать за маршрутом' : 'Весь маршрут'}><Crosshair size={17} /></button>
    </div>
    <span className="rs-hint" aria-hidden="true">{mode === '3d' ? 'Тяните — двигать · Shift или правая кнопка — вращать · колесо — масштаб' : 'Тяните — двигать · колесо или щипок — масштаб'}</span>
  </div>
}

function nearestYaw(angle, reference) {
  return angle + 360 * Math.round((reference - angle) / 360)
}
