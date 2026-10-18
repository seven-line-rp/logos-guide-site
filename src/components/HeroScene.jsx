import { useMemo, useSyncExternalStore } from 'react'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { composePlanArt } from '../map-art.js'
import { calculateIndoorRoute } from '../map-routing.js'
import { planSizes } from '../map-geometry.js'
import { useLanguage } from '../i18n.js'

// Декорация первого экрана: настоящий план корпуса в 3D-наклоне и маршрут,
// который строит сам сайт (от главного входа до кабинета 138). Над первым
// этажом парит размытый второй, края сцены растворяются в фоне, резким
// остаётся только участок вокруг маршрута — как глубина резкости в кадре.
const ROUTE_FROM = 'entrance-1'
const ROUTE_TO = 'class-138'
const { width, height } = planSizes[1]

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
const subscribeMotion = (callback) => {
  const media = window.matchMedia(reducedMotionQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const readMotion = () => window.matchMedia(reducedMotionQuery).matches

function PlanLayer({ svg, floor, className }) {
  const language = useLanguage()
  const html = useMemo(() => composePlanArt(svg, floor, language), [svg, floor, language])
  return <div className={`hero-scene-plan ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

export default function HeroScene() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, readMotion, () => true)
  const points = useMemo(() => calculateIndoorRoute(ROUTE_FROM, ROUTE_TO, 1).points, [])
  if (!points.length) return null
  const path = `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}`
  const start = points[0]
  const end = points.at(-1)

  return <div className="hero-scene" aria-hidden="true">
    <div className="hero-scene-stage">
      <div className="hero-scene-floor hero-scene-floor-upper">
        <PlanLayer svg={floorTwoPlan} floor={2} className="hero-scene-plan-upper" />
      </div>
      <div className="hero-scene-floor hero-scene-floor-main">
        <PlanLayer svg={floorOnePlan} floor={1} className="hero-scene-plan-blur" />
        <div className="hero-scene-focus">
          <PlanLayer svg={floorOnePlan} floor={1} className="hero-scene-plan-sharp" />
          <svg className="hero-scene-route" viewBox={`0 0 ${width} ${height}`}>
            <path className="hero-route-glow" d={path} />
            <path className="hero-route-base" d={path} />
            <path className="hero-route-line" d={path} pathLength="1" />
            <circle className="hero-route-start" cx={start[0]} cy={start[1]} r="6" />
            <g transform={`translate(${end[0]} ${end[1]})`}>
              <circle className="hero-route-pulse" r="9" />
              <circle className="hero-route-end" r="6.5" />
            </g>
            {!reducedMotion && <circle className="hero-route-walker" r="4.5">
              <animateMotion dur="7s" repeatCount="indefinite" path={path} keyPoints="0;1;1" keyTimes="0;0.75;1" calcMode="linear" />
            </circle>}
          </svg>
        </div>
      </div>
    </div>
  </div>
}
