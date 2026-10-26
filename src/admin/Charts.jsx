import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNumber } from './stats-model.js'

// Столбчатая диаграмма и линия с заливкой — на чистом SVG, без библиотек.
// Ширина берётся из контейнера, поэтому подписи не растягиваются. Подсказка
// по наведению и стрелкам ← →, для скринридеров — таблица с теми же числами.

const HEIGHT = 280
const PAD = { top: 16, right: 12, bottom: 30, left: 38 }

function niceMax(max) {
  if (max <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(max / 4))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate * 4 >= max) || 10 * power
  return step * 4
}

// Плавная кривая через точки без «перелётов» ниже нуля (монотонная интерполяция).
function smoothPath(points) {
  if (points.length < 2) return ''
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / (point.x - points[index].x))
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0]
    if (index === points.length - 1) return slopes[index - 1]
    // Среднее гармоническое наклонов (Фритч — Карлсон): кривая не выходит за соседние точки.
    return slopes[index - 1] * slopes[index] <= 0 ? 0 : (2 * slopes[index - 1] * slopes[index]) / (slopes[index - 1] + slopes[index])
  })
  let path = `M${points[0].x},${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    const reach = (to.x - from.x) / 3
    path += ` C${from.x + reach},${from.y + tangents[index] * reach} ${to.x - reach},${to.y - tangents[index + 1] * reach} ${to.x},${to.y}`
  }
  return path
}

const barPath = (x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height)
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
}

export default function Chart({ series, kind, unit, label }) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const node = wrapRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const geometry = useMemo(() => {
    const innerW = Math.max(width - PAD.left - PAD.right, 0)
    const innerH = HEIGHT - PAD.top - PAD.bottom
    const top = niceMax(Math.max(0, ...series.map((item) => item.value)))
    const band = series.length ? innerW / series.length : 0
    const points = series.map((item, index) => ({ x: PAD.left + band * (index + 0.5), y: PAD.top + innerH - (item.value / top) * innerH }))
    const ticks = [0, 1, 2, 3, 4].map((tick) => ({ value: (top / 4) * tick, y: PAD.top + innerH - (tick / 4) * innerH }))
    const stride = Math.max(1, Math.ceil(series.length / Math.max(1, Math.floor(innerW / 54))))
    return { innerW, innerH, band, points, ticks, stride }
  }, [series, width])

  const { innerH, band, points, ticks, stride } = geometry
  const baseline = PAD.top + innerH
  const move = (event) => {
    if (!band) return
    const box = event.currentTarget.getBoundingClientRect()
    const index = Math.floor((event.clientX - box.left - PAD.left) / band)
    setActive(index >= 0 && index < series.length ? index : null)
  }
  const keys = (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); setActive((current) => Math.min(series.length - 1, (current ?? -1) + 1)) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); setActive((current) => Math.max(0, (current ?? series.length) - 1)) }
    else if (event.key === 'Escape') setActive(null)
  }

  const current = active !== null ? series[active] : null
  const tip = current && points[active]
  const tipLeft = tip ? Math.min(Math.max(tip.x, 70), Math.max(width - 70, 70)) : 0

  return <div className="adm-chart" ref={wrapRef} role="group" aria-label={label} tabIndex={0} onKeyDown={keys} onBlur={() => setActive(null)}>
    {width > 0 && <svg width={width} height={HEIGHT} onPointerMove={move} onPointerLeave={() => setActive(null)} aria-hidden="true" key={`${kind}-${series.length}-${series[0]?.key}`}>
      <defs>
        <linearGradient id="adm-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--adm-accent)" stopOpacity=".28" /><stop offset="100%" stopColor="var(--adm-accent)" stopOpacity="0" /></linearGradient>
      </defs>
      {ticks.map((tick) => <g key={tick.value}>
        <line className="adm-grid" x1={PAD.left} x2={width - PAD.right} y1={tick.y} y2={tick.y} />
        <text className="adm-axis" x={PAD.left - 8} y={tick.y + 4} textAnchor="end">{formatNumber(Math.round(tick.value * 10) / 10)}</text>
      </g>)}
      {series.map((item, index) => index % stride === 0 && <text key={item.key} className="adm-axis" x={points[index].x} y={HEIGHT - 9} textAnchor="middle">{item.label}</text>)}
      {kind === 'bar' && series.map((item, index) => {
        const barW = Math.max(3, Math.min(band * 0.64, 40))
        const height = baseline - points[index].y
        return <g key={item.key}>
          {active === index && <rect className="adm-hover" x={PAD.left + band * index} y={PAD.top} width={band} height={geometry.innerH} rx="6" />}
          {item.value > 0 ? <path className={`adm-bar ${active === index ? 'adm-bar-active' : ''}`} d={barPath(points[index].x - barW / 2, points[index].y, barW, height, 6)} style={{ animationDelay: `${Math.min(index * 14, 400)}ms` }} /> : <rect className="adm-bar-empty" x={points[index].x - barW / 2} y={baseline - 2} width={barW} height="2" rx="1" />}
        </g>
      })}
      {kind === 'line' && points.length > 1 && <>
        <path className="adm-area" d={`${smoothPath(points)} L${points[points.length - 1].x},${baseline} L${points[0].x},${baseline} Z`} fill="url(#adm-area)" />
        <path className="adm-line" d={smoothPath(points)} />
        {active !== null && <line className="adm-cross" x1={points[active].x} x2={points[active].x} y1={PAD.top} y2={baseline} />}
        {series.length <= 31 && points.map((point, index) => <circle key={series[index].key} className={`adm-dot ${active === index ? 'adm-dot-active' : ''}`} cx={point.x} cy={point.y} r={active === index ? 5 : 3} />)}
        {series.length > 31 && active !== null && <circle className="adm-dot adm-dot-active" cx={points[active].x} cy={points[active].y} r="5" />}
      </>}
      {kind === 'line' && points.length === 1 && <circle className="adm-dot adm-dot-active" cx={points[0].x} cy={points[0].y} r="5" />}
    </svg>}
    {current && tip && <div className="adm-tip" style={{ left: tipLeft, top: Math.max(tip.y - 12, 4) }} role="status"><strong>{formatNumber(current.value)}</strong><span>{unit} · {current.title}</span></div>}
    <table className="visually-hidden"><caption>{label}</caption><tbody>{series.map((item) => <tr key={item.key}><th scope="row">{item.title}</th><td>{item.value}</td></tr>)}</tbody></table>
  </div>
}
