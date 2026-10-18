import { useEffect, useMemo, useRef } from 'react'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { composePlanArt } from '../map-art.js'
import { buildRouteOptions } from '../map-routing.js'
import { planSizes } from '../map-geometry.js'
import { useLanguage } from '../i18n.js'
import { FLOOR_GAP, HERO_ROUTE, WALL_HEIGHT, floorDoors, floorWalls, transferColumns } from '../hero-scene-model.js'

// Декорация первого экрана: корпус в 3D. Пол каждого этажа — настоящий план,
// стены и двери подняты из той же геометрии, второй этаж висит над первым,
// лестницы и лифт светятся колоннами. Маршрут строит сам сайт: от главного
// входа по западной лестнице на второй этаж к кабинету физики.
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

function Floor({ floor, walls, doors, path, pathClass }) {
  return <div className={`hs-floor hs-floor-${floor}`}>
    <div className="hs-slab" />
    <FloorPlate floor={floor} />
    <div className="hs-sweep" />
    {path && <svg className="hs-route" viewBox={`0 0 ${width} ${height}`}>
      <path className="hs-route-glow" d={path} />
      <path className="hs-route-base" d={path} />
      <path className={`hs-route-line ${pathClass}`} d={path} pathLength="1" />
    </svg>}
    {path && <i className={`hs-walker hs-walker-${floor}`} style={{ offsetPath: `path('${path}')` }} />}
    {walls.map((wall, index) => <i key={`w${index}`} className="hs-wall" style={{ left: wall.x, top: wall.y, width: wall.length, '--a': `${wall.angle}deg`, '--i': index }} />)}
    {doors.map((door) => <i key={door.id} className="hs-door" style={{ left: door.x, top: door.y, width: door.width, '--a': `${door.angle}deg` }} />)}
  </div>
}

export default function HeroScene() {
  const rootRef = useRef(null)

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

  if (!scene.lower || !scene.upper) return null
  const [floorOne, floorTwo] = scene.floors

  return <div className="hero-scene" ref={rootRef} aria-hidden="true" style={{ '--wall-h': `${WALL_HEIGHT}px`, '--gap': `${FLOOR_GAP}px` }}>
    <div className="hs-parallax">
      <div className="hs-camera" style={{ width, height }}>
        <Floor {...floorOne} path={scene.lower} pathClass="hs-route-lower" />
        <Floor {...floorTwo} path={scene.upper} pathClass="hs-route-upper" />
        {scene.columns.map((column) => <div key={column.id} className={`hs-column ${column.lift ? 'hs-column-lift' : ''}`} style={{ left: column.x, top: column.y }}><i /><i /></div>)}
        <div className="hs-climb" style={{ left: scene.climb[0], top: scene.climb[1] }}><i className="hs-climb-beam" /><i className="hs-climb-dot" /></div>
        <div className="hs-beacon" style={{ left: scene.target[0], top: scene.target[1] }}><i /><i /><b /></div>
      </div>
    </div>
    <div className="hs-dof" />
    <div className="hs-particles">{particles.map((particle, index) => <i key={index} style={{ left: `${particle.left}%`, top: `${particle.top}%`, width: particle.size, height: particle.size, animationDelay: `${particle.delay}s` }} />)}</div>
  </div>
}
