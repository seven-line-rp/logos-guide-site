import { useEffect, useMemo, useRef, useState } from 'react'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { composePlanArt } from '../map-art.js'
import { buildRouteOptions } from '../map-routing.js'
import { planSizes } from '../map-geometry.js'
import { useLanguage } from '../i18n.js'
import { isLitePerf } from '../perf.js'
import { FLIGHT_SECONDS, FLOOR_GAP, HERO_ROUTES, WALL_HEIGHT, buildFlight, doorsOnRoute, floorDoors, floorWalls, openWalls, stairSteps, transferColumns } from '../hero-scene-model.js'

// Декорация первого экрана: корпус в 3D. Пол каждого этажа — настоящий план,
// стены и двери подняты из той же геометрии, второй этаж висит над первым,
// лестницы и лифт светятся колоннами. Маршрут строит сам сайт: от главного
// входа по западной лестнице на второй этаж к кабинету физики, а камера
// пролетает по нему (сценарий пролёта — buildFlight в hero-scene-model.js).
const { width, height } = planSizes[1]

const floors = [1, 2].map((floor) => ({ floor, walls: floorWalls(floor), doors: floorDoors(floor) }))
const columns = transferColumns()
const pathOf = (points) => (points?.length ? `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}` : '')

// Каждый маршрут собираем заранее: путь по этажам, сценарий пролёта и то,
// чем он поднимается (ступени лестницы или кабина лифта).
const routes = HERO_ROUTES.map((route) => {
  const option = buildRouteOptions(route.from, route.to).find((item) => item.kind === route.via)
  const lower = option?.byFloor[1]?.points || []
  const upper = option?.byFloor[2]?.points || []
  if (!lower.length || !upper.length) return null
  const lift = route.via === 'lift'
  const column = columns.find((item) => item.id === `${route.via}-1`)
  const transfer = lift ? { kind: 'lift', center: [column.x, column.y] } : { kind: 'stairs' }
  return {
    ...route,
    lower: pathOf(lower),
    upper: pathOf(upper),
    // Стены с проёмами и без створок дверей там, где идёт этот маршрут.
    floors: floors.map((item, index) => {
      const points = index === 0 ? lower : upper
      const open = doorsOnRoute(item.doors, points)
      return { floor: item.floor, walls: openWalls(item.walls, points), doors: item.doors.filter((door) => !open.has(door.id)) }
    }),
    flight: buildFlight(lower, upper, FLOOR_GAP, transfer),
    climb: lower.at(-1),
    target: upper.at(-1),
    transfer,
    steps: lift ? [] : stairSteps(lower.at(-1), upper[0]),
  }
}).filter(Boolean)

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
    {walls.map((wall, index) => <i key={`${wall.x}:${wall.y}:${wall.angle}:${wall.length}`} className="hs-wall" style={{ left: wall.x, top: wall.y, width: wall.length, '--a': `${wall.angle}deg`, '--i': index }} />)}
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
  const [index, setIndex] = useState(0)
  const scene = routes[index % routes.length]
  const rootRef = useRef(null)
  const cameraRef = useRef(null)
  const walkerRef = useRef(null)
  const transferRef = useRef(null)
  const cabinRef = useRef(null)
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
    if (!root || !camera) return undefined
    const upperFloor = root.querySelector('.hs-floor-2')
    window.dispatchEvent(new CustomEvent('hero-route', { detail: { from: scene.from, to: scene.to, via: scene.via } }))
    let upperAlpha = ''
    let center = frameCenter(root.getBoundingClientRect())
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { center = frameCenter(root.getBoundingClientRect()) })
    observer?.observe(root)
    // Камера мягко догоняет сценарий (экспоненциальное сглаживание): на
    // стыках фаз пролёта — спуск, подъём, разворот — нет рывков скорости.
    let smooth = null
    let lastTime = 0
    const follow = (target, now) => {
      if (!smooth || !lastTime) { smooth = { ...target }; lastTime = now; return smooth }
      const k = 1 - Math.exp(-Math.min(0.1, (now - lastTime) / 1000) / 0.32)
      lastTime = now
      const yaw = target.yaw + 360 * Math.round((smooth.yaw - target.yaw) / 360)
      for (const key of ['x', 'y', 'z', 'zoom', 'tilt']) smooth[key] += (target[key] - smooth[key]) * k
      smooth.yaw += (yaw - smooth.yaw) * k
      return smooth
    }
    const apply = (frame, now = 0) => {
      camera.style.transform = cameraTransform(now ? follow(frame.camera, now) : frame.camera, center)
      if (lowerRef.current) lowerRef.current.style.strokeDashoffset = String(1 - frame.lower)
      if (upperRef.current) upperRef.current.style.strokeDashoffset = String(1 - frame.upper)
      if (lowerRouteRef.current) lowerRouteRef.current.style.opacity = String(frame.routeOpacity)
      if (upperRouteRef.current) upperRouteRef.current.style.opacity = String(frame.routeOpacity * frame.upperFloor)
      const { climb } = frame
      if (transferRef.current) {
        transferRef.current.style.setProperty('--prog', climb.progress.toFixed(3))
        transferRef.current.style.setProperty('--vis', climb.vis.toFixed(3))
      }
      if (cabinRef.current) {
        cabinRef.current.style.setProperty('--vis', climb.vis.toFixed(3))
        cabinRef.current.style.setProperty('--door', climb.door.toFixed(3))
        cabinRef.current.style.transform = `translate3d(${climb.x}px, ${climb.y}px, ${climb.z}px)`
      }
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isLitePerf()) {
      const still = scene.flight(0.999)
      apply({ ...still, routeOpacity: 1, walker: { ...still.walker, visible: false } })
      return () => observer?.disconnect()
    }
    let frameId = 0
    let startedAt = performance.now()
    let pausedAt = 0
    let inView = true
    const tick = (now) => {
      const progress = (now - startedAt) / 1000 / FLIGHT_SECONDS
      // Цикл кончился общим планом: меняем маршрут, пока камера на нём.
      if (progress >= 1) { setIndex((current) => (current + 1) % routes.length); return }
      apply(scene.flight(progress), now)
      frameId = requestAnimationFrame(tick)
    }
    // Сцена работает только пока её видно: ушла за край экрана, вкладка в
    // фоне или идёт смена темы — кадры не считаем и CSS-анимации стоят
    // (.is-paused). Время пролёта при этом не теряется.
    const sync = () => {
      const run = inView && !document.hidden && !document.documentElement.hasAttribute('data-theme-busy')
      if (run && pausedAt) {
        startedAt += performance.now() - pausedAt
        pausedAt = 0
        root.classList.remove('is-paused')
        frameId = requestAnimationFrame(tick)
      } else if (!run && !pausedAt) {
        pausedAt = performance.now()
        cancelAnimationFrame(frameId)
        root.classList.add('is-paused')
      }
    }
    const viewObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync() })
    viewObserver?.observe(root)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('logos-theme-busy', sync)
    frameId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frameId)
      observer?.disconnect()
      viewObserver?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('logos-theme-busy', sync)
      root.classList.remove('is-paused')
    }
  }, [scene])

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

  const [floorOne, floorTwo] = scene.floors

  return <div className="hero-scene" ref={rootRef} aria-hidden="true" style={{ '--wall-h': `${WALL_HEIGHT}px`, '--gap': `${FLOOR_GAP}px` }}>
    <div className="hs-parallax">
      <div className="hs-camera" ref={cameraRef} style={{ width, height }}>
        <Floor {...floorOne} path={scene.lower} lineRef={lowerRef} routeRef={lowerRouteRef} />
        <Floor {...floorTwo} path={scene.upper} lineRef={upperRef} routeRef={upperRouteRef} />
        {columns.map((column) => <div key={column.id} className={`hs-column ${column.lift ? 'hs-column-lift' : ''}`} style={{ left: column.x, top: column.y }}><i /><i /></div>)}
        {scene.transfer.kind === 'stairs'
          ? <div className="hs-stairs" ref={transferRef}>{scene.steps.map((step, number) => <i key={number} style={{ '--p': step.k, transform: `translate3d(${step.x}px, ${step.y}px, ${(step.k * FLOOR_GAP).toFixed(1)}px) rotateZ(${step.angle}deg)` }} />)}</div>
          : <div className="hs-cabin" ref={cabinRef}><i className="hs-cabin-floor" /><i className="hs-cabin-roof" /><i className="hs-cabin-side" style={{ '--x': '-10px', '--y': '10px', '--a': '0deg' }} /><i className="hs-cabin-side" style={{ '--x': '10px', '--y': '10px', '--a': '-90deg' }} /><i className="hs-cabin-side" style={{ '--x': '10px', '--y': '-10px', '--a': '180deg' }} /><i className="hs-cabin-side hs-cabin-door hs-cabin-door-l" style={{ '--x': '-10px', '--y': '-10px', '--a': '0deg' }} /><i className="hs-cabin-side hs-cabin-door hs-cabin-door-r" style={{ '--x': '0px', '--y': '-10px', '--a': '0deg' }} /></div>}
        <div className="hs-beacon" ref={beaconRef} style={{ left: scene.target[0], top: scene.target[1] }}><i /><i /><b /></div>
        <div className="hs-walker" ref={walkerRef}><i /></div>
      </div>
    </div>
  </div>
}
