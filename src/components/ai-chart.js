import { createElement as h } from 'react'
import { chartBounds, formatTick, niceTicks } from '../ai-format.js'

// Графики из блоков ```chart в ответах ИИ: чистый SVG без библиотек, цвета
// берутся из CSS (ai-math.css), поэтому подходят и светлой, и тёмной теме.

const W = 560
const H = 320
const M = { left: 52, right: 16, top: 34, bottom: 46 }

function Frame({ spec, children, legend }) {
  return h('figure', { className: 'ai-chart' },
    spec.title && h('figcaption', null, spec.title),
    h('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.title || 'График', preserveAspectRatio: 'xMidYMid meet' }, children),
    legend)
}

function Legend({ names }) {
  if (names.filter(Boolean).length < 2) return null
  return h('ul', { className: 'ai-chart-legend' }, names.map((name, i) => name && h('li', { key: i }, h('i', { className: `ai-c${i % 6}` }), name)))
}

function Axes({ spec, y0, y1, sx, sy, xTicks, xLabelOf }) {
  const yTicks = niceTicks(y0, y1, 5)
  const plot = { x: M.left, y: M.top, w: W - M.left - M.right, h: H - M.top - M.bottom }
  return h('g', { className: 'ai-chart-axes' },
    yTicks.map((tick) => h('g', { key: `y${tick}` }, h('line', { className: tick === 0 ? 'zero' : 'grid', x1: plot.x, x2: plot.x + plot.w, y1: sy(tick), y2: sy(tick) }), h('text', { x: plot.x - 8, y: sy(tick) + 4, textAnchor: 'end' }, formatTick(tick)))),
    xTicks.map((tick, i) => h('g', { key: `x${i}` }, h('line', { className: tick === 0 && !xLabelOf ? 'zero' : 'grid', x1: sx(tick), x2: sx(tick), y1: plot.y, y2: plot.y + plot.h }), h('text', { x: sx(tick), y: plot.y + plot.h + 16, textAnchor: 'middle' }, xLabelOf ? xLabelOf(tick, i) : formatTick(tick)))),
    spec.xLabel && h('text', { className: 'label', x: plot.x + plot.w / 2, y: H - 8, textAnchor: 'middle' }, spec.xLabel),
    spec.yLabel && h('text', { className: 'label', x: plot.x, y: 18, textAnchor: 'start' }, spec.yLabel),
    h('rect', { className: 'frame', x: plot.x, y: plot.y, width: plot.w, height: plot.h }))
}

function XYChart({ spec }) {
  const { x0, x1, y0, y1 } = chartBounds(spec)
  const sx = (x) => M.left + ((x - x0) / (x1 - x0)) * (W - M.left - M.right)
  const sy = (y) => M.top + (1 - (y - y0) / (y1 - y0)) * (H - M.top - M.bottom)
  const clipId = `clip-${Math.abs([...JSON.stringify(spec)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}`
  const paths = spec.series.map((entry) => {
    let d = ''
    let pen = false
    for (const [x, y] of entry.points) {
      if (y === null || y < y0 - (y1 - y0) || y > y1 + (y1 - y0)) { pen = false; continue }
      d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`
      pen = true
    }
    return d
  })
  return h(Frame, { spec, legend: h(Legend, { names: spec.series.map((entry) => entry.name) }) },
    h('defs', null, h('clipPath', { id: clipId }, h('rect', { x: M.left, y: M.top, width: W - M.left - M.right, height: H - M.top - M.bottom }))),
    h(Axes, { spec, y0, y1, sx, sy, xTicks: niceTicks(x0, x1, 6) }),
    h('g', { clipPath: `url(#${clipId})` },
      spec.series.map((entry, i) => spec.kind === 'scatter'
        ? entry.points.map(([x, y], j) => h('circle', { key: `${i}-${j}`, className: `ai-c${i % 6} fill`, cx: sx(x), cy: sy(y), r: 4 }))
        : [h('path', { key: `p${i}`, className: `ai-c${i % 6} line`, d: paths[i] }),
          spec.kind === 'line' && entry.points.length <= 40 && entry.points.map(([x, y], j) => h('circle', { key: `${i}-${j}`, className: `ai-c${i % 6} fill`, cx: sx(x), cy: sy(y), r: 3 }))])),
    (spec.marks || []).map((mark, i) => h('g', { key: `m${i}`, className: 'mark' }, h('circle', { cx: sx(mark.x), cy: sy(mark.y), r: 4.5 }), mark.label && h('text', { x: sx(mark.x) + 8, y: sy(mark.y) - 8 }, mark.label))))
}

function BarChart({ spec }) {
  const { y0, y1 } = chartBounds(spec)
  const plot = { x: M.left, w: W - M.left - M.right }
  const sy = (y) => M.top + (1 - (y - y0) / (y1 - y0)) * (H - M.top - M.bottom)
  const slot = plot.w / spec.labels.length
  const group = Math.min(slot * 0.78, 64 * spec.series.length)
  const bar = group / spec.series.length
  const sx = (index) => plot.x + slot * (index + 0.5)
  return h(Frame, { spec, legend: h(Legend, { names: spec.series.map((entry) => entry.name) }) },
    h(Axes, { spec, y0, y1, sx: (v) => plot.x + v * plot.w, sy, xTicks: spec.labels.map((_, i) => (i + 0.5) / spec.labels.length), xLabelOf: (_, i) => spec.labels[i] }),
    spec.series.map((entry, s) => entry.values.map((value, i) => value === null ? null : h('g', { key: `${s}-${i}` },
      h('rect', { className: `ai-c${s % 6} fill`, x: sx(i) - group / 2 + s * bar + 1, y: Math.min(sy(value), sy(0)), width: Math.max(2, bar - 2), height: Math.abs(sy(value) - sy(0)), rx: 3 }),
      spec.labels.length * spec.series.length <= 16 && h('text', { className: 'value', x: sx(i) - group / 2 + s * bar + bar / 2, y: value >= 0 ? sy(value) - 5 : sy(value) + 13, textAnchor: 'middle' }, formatTick(value))))))
}

function PieChart({ spec }) {
  const total = spec.items.reduce((sum, item) => sum + item.value, 0)
  const cx = 150
  const cy = 170
  const r = 110
  let angle = -Math.PI / 2
  const slices = spec.items.map((item, i) => {
    const share = item.value / total
    const next = angle + share * Math.PI * 2
    const [x1, y1, x2, y2] = [cx + r * Math.cos(angle), cy + r * Math.sin(angle), cx + r * Math.cos(next), cy + r * Math.sin(next)]
    const d = share > 0.9999 ? `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0` : `M${cx} ${cy}L${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z`
    angle = next
    return h('path', { key: i, className: `ai-c${i % 6} fill slice`, d })
  })
  return h(Frame, { spec },
    slices,
    h('g', { className: 'ai-chart-axes' }, spec.items.map((item, i) => h('g', { key: i },
      h('rect', { className: `ai-c${i % 6} fill`, x: 300, y: 44 + i * 22, width: 12, height: 12, rx: 3 }),
      h('text', { x: 320, y: 55 + i * 22 }, `${item.label} — ${Math.round((item.value / total) * 1000) / 10}%`)))))
}

export function AiChart({ spec }) {
  if (spec.kind === 'bar') return h(BarChart, { spec })
  if (spec.kind === 'pie') return h(PieChart, { spec })
  return h(XYChart, { spec })
}
