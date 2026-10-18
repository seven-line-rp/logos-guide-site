import { useEffect, useMemo, useRef } from 'react'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { composePlanArt } from '../map-art.js'
import { buildRouteOptions } from '../map-routing.js'
import { planSizes } from '../map-geometry.js'
import { useLanguage } from '../i18n.js'
import { FLIGHT_SECONDS, FLOOR_GAP, HERO_ROUTE, WALL_HEIGHT, buildFlight, floorDoors, floorWalls, transferColumns } from '../hero-scene-model.js'

// Декорация первого экрана: корпус в 3D. Пол каждого этажа — настоящий план,
// стены и двери подняты из той же геометрии, второй этаж висит над первым,
// лестницы и лифт светятся колоннами. Маршрут строит сам сайт: от главного
// входа по западной лестнице на второй этаж к кабинету физики, а камера
// пролетает по нему (сценарий пролёта — buildFlight в hero-scene-model.js).
const { width, height } = planSizes[1]

const scene = (() => {
  const option = buildRouteOptions(HERO_ROUTE.from, HERO_ROUTE.to).find((item) => item.kind === HERO_ROUTE.via)
  const pathOf = (points) => (points?.length ? `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}` : '')
  const lower = option?.byFloor[1]?.points || []
  const upper = option?.byFloor[2]?.points || []
  return {
    floors: [1, 2].map((floor) => ({ floor, walls: floorWalls(floor), doors: floorDoors(floor) })),
    columns: transferColumns(),
    lower: pathOf(lower),
    upper: pathOf(upper),
    flight: lower.length && upper.length ? buildFlight(lower, upper, FLOOR_GAP) : null,
    climb: lower.at(-1),
    target: upper.at(-1),
  }
})()

// Детерминированные «пылинки»: одинаковые при каждом рендере, без Math.random.
const particles = Array.from({ length: 22 }, (_, index) => ({
  left: (index * 37 + 11) % 100,
  top: (index * 53 + 7) % 100,
  delay: (index * 0.7) % 9,
  size: 2 + (index % 3),
}))

function FloorPlate({ floor }) {
  const language = useLanguage()
  const html = useMemo(() => composePlanArt(floor === 1 ? floorOnePlan : floorTwoPlan, floor, language), [floor, language])
  return <div className="hs-plate" dangerouslySetInnerHTML={{ __html: html }} />
}

function Floor({ floor, walls, doors, path, lineRef, routeRef }) {
  return <div className={`hs-floor hs-floor-${floor}`}>
    <FloorPlate floor={floor} />
    <div className="hs-sweep" />
    {path && <svg className="hs-route" ref={routeRef} viewBox={`0 0 ${width} ${height}`}>
      <path className="hs-route-glow" d={path} />
      <path className="hs-route-base" d={path} />
      <path className="hs-route-line" ref={lineRef} d={path} pathLength="1" />
    </svg>}
    {walls.map((wall, index) => <i key={`w${index}`} className="hs-wall" style={{ left: wall.x, top: wall.y, width: wall.length, '--a': `${wall.angle}deg`, '--i': index }} />)}
    {doors.map((door) => <i key={door.id} className="hs-door" style={{ left: door.x, top: door.y, width: door.width, '--a': `${door.angle}deg` }} />)}
  </div>
}

// Центр кадра: на компьютере правее (слева текст), на телефоне — выше.
function frameCenter(box) {
  const narrow = box.width < 860
  return [box.width * (narrow ? 0.56 : 0.66), box.height * (narrow ? 0.3 : 0.55)]
}

function cameraTransform(camera, center) {
  return `translate3d(${center[0]}px, ${center[1]}px, 0) rotateX(${camera.tilt}deg) rotateZ(${camera.yaw}deg) scale3d(${camera.zoom}, ${camera.zoom}, ${camera.zoom}) translate3d(${-camera.x}px, ${-camera.y}px, ${-camera.z}px)`
}

export default function HeroScene() {
  const rootRef = useRef(null)
  const cameraRef = useRef(null)
  const walkerRef = useRef(null)
  const beamRef = useRef(null)
  const beaconRef = useRef(null)
  const lowerRef = useRef(null)
  const upperRef = useRef(null)
  const lowerRouteRef = useRef(null)
  const upperRouteRef = useRef(null)

  // Пролёт: каждый кадр берём положение из сценария и двигаем камеру, точку
  // и прорисовку маршрута. Меняются только transform и opacity — без
  // перерасчёта вёрстки. Если движение в системе уменьшено, показываем общий
  // план с готовым маршрутом и ничего не анимируем.
  useEffect(() => {
    const root = rootRef.current
    const camera = cameraRef.current
    if (!root || !camera || !scene.flight) return undefined
    const upperFloor = root.querySelector('.hs-floor-2')
    let upperAlpha = ''
    let center = frameCenter(root.getBoundingClientRect())
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { center = frameCenter(root.getBoundingClientRect()) })
    observer?.observe(root)
    const apply = (frame) => {
      camera.style.transform = cameraTransform(frame.camera, center)
      if (lowerRef.current) lowerRef.current.style.strokeDashoffset = String(1 - frame.lower)
      if (upperRef.current) upperRef.current.style.strokeDashoffset = String(1 - frame.upper)
      if (lowerRouteRef.current) lowerRouteRef.current.style.opacity = String(frame.routeOpacity)
      if (upperRouteRef.current) upperRouteRef.current.style.opacity = String(frame.routeOpacity * frame.upperFloor)
      if (beamRef.current) beamRef.current.style.opacity = String(frame.beam * 0.9)
      // Прозрачность — только у лучей маяка: на самом контейнере с preserve-3d
      // она бы «сплющила» вертикальные плоскости.
      for (const ray of beaconRef.current?.children || []) ray.style.opacity = String(frame.beacon)
      // Прозрачность этажа задаём переменной для его деталей, а не самому
      // этажу: opacity на 3D-контейнере сплющила бы стены. Обновляем только
      // при заметном изменении, чтобы не пересчитывать стили каждый кадр.
      const alpha = frame.upperFloor.toFixed(2)
      if (upperFloor && alpha !== upperAlpha) { upperAlpha = alpha; upperFloor.style.setProperty('--floor-alpha', alpha) }
      const walker = walkerRef.current
      if (walker && frame.walker) {
        walker.style.transform = `translate3d(${frame.walker.x}px, ${frame.walker.y}px, ${frame.walker.z + 3}px)`
        walker.style.opacity = frame.walker.visible ? '1' : '0'
      }
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const still = scene.flight(0.999)
      apply({ ...still, routeOpacity: 1, walker: { ...still.walker, visible: false } })
      return () => observer?.disconnect()
    }
    let frameId = 0
    const startedAt = performance.now()
    const tick = (now) => {
      apply(scene.flight((now - startedAt) / 1000 / FLIGHT_SECONDS))
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frameId); observer?.disconnect() }
  }, [])

  // Лёгкий параллакс за курсором: сцена чуть поворачивается к мыши.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let frame = 0
    const onMove = (event) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--px', (event.clientX / window.innerWidth - 0.5).toFixed(3))
        root.style.setProperty('--py', (event.clientY / window.innerHeight - 0.5).toFixed(3))
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', onMove) }
  }, [])

  if (!scene.flight) return null
  const [floorOne, floorTwo] = scene.floors

  return <div className="hero-scene" ref={rootRef} aria-hidden="true" style={{ '--wall-h': `${WALL_HEIGHT}px`, '--gap': `${FLOOR_GAP}px` }}>
    <div className="hs-parallax">
      <div className="hs-camera" ref={cameraRef} style={{ width, height }}>
        <Floor {...floorOne} path={scene.lower} lineRef={lowerRef} routeRef={lowerRouteRef} />
        <Floor {...floorTwo} path={scene.upper} lineRef={upperRef} routeRef={upperRouteRef} />
        {scene.columns.map((column) => <div key={column.id} className={`hs-column ${column.lift ? 'hs-column-lift' : ''}`} style={{ left: column.x, top: column.y }}><i /><i /></div>)}
        <div className="hs-climb" style={{ left: scene.climb[0], top: scene.climb[1] }}><i className="hs-climb-beam" ref={beamRef} /></div>
        <div className="hs-beacon" ref={beaconRef} style={{ left: scene.target[0], top: scene.target[1] }}><i /><i /><b /></div>
        <div className="hs-walker" ref={walkerRef}><i /></div>
      </div>
    </div>
    <div className="hs-dof" />
    <div className="hs-particles">{particles.map((particle, index) => <i key={index} style={{ left: `${particle.left}%`, top: `${particle.top}%`, width: particle.size, height: particle.size, animationDelay: `${particle.delay}s` }} />)}</div>
  </div>
}
