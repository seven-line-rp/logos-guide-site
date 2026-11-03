import { useEffect, useRef } from 'react'
import { isLitePerf } from '../perf.js'

// Флаг России на главном экране темы «Единство» вместо 3D-корпуса.
// Рисуется на canvas: полотно режется на вертикальные полоски шириной в пиксель,
// каждая сдвигается по синусоиде (у древка полотно закреплено, к краю волна
// сильнее) и чуть светлеет или темнеет по наклону складки. Получается ткань на
// ветру без картинок и тяжёлых библиотек. Анимация замирает, когда флаг не
// виден или вкладка в фоне; при «Уменьшить движение» и в режиме «Лёгкий»
// рисуется один неподвижный кадр.

const WHITE = '#ffffff'
const BLUE = '#0039a6'
const RED = '#d52b1e'

function stripes(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(3, Math.round(height))
  const context = canvas.getContext('2d')
  const band = canvas.height / 3
  context.fillStyle = WHITE
  context.fillRect(0, 0, canvas.width, Math.ceil(band))
  context.fillStyle = BLUE
  context.fillRect(0, Math.floor(band), canvas.width, Math.ceil(band) + 1)
  context.fillStyle = RED
  context.fillRect(0, Math.floor(band * 2), canvas.width, canvas.height - Math.floor(band * 2))
  return canvas
}

function layout(width, height) {
  const poleWidth = Math.max(4, Math.round(width * 0.016))
  const poleX = Math.round(width * 0.04)
  let clothWidth = width - poleX - poleWidth - width * 0.06
  let clothHeight = clothWidth * 2 / 3
  const maxHeight = height * 0.6
  if (clothHeight > maxHeight) { clothHeight = maxHeight; clothWidth = clothHeight * 1.5 }
  const top = Math.round(Math.max(height * 0.08, poleWidth * 3.2))
  return { poleWidth, poleX, clothX: poleX + poleWidth, clothWidth, clothHeight, top, finial: poleWidth * 1.15 }
}

function drawPole(context, box, height) {
  const { poleX, poleWidth, top, finial } = box
  const metal = context.createLinearGradient(poleX, 0, poleX + poleWidth, 0)
  metal.addColorStop(0, '#9aa3b5')
  metal.addColorStop(0.45, '#f4f6fb')
  metal.addColorStop(1, '#6f7891')
  context.fillStyle = metal
  context.fillRect(poleX, top - finial, poleWidth, height - top + finial)
  const gold = context.createRadialGradient(poleX + poleWidth * 0.35, top - finial * 1.9, finial * 0.2, poleX + poleWidth / 2, top - finial * 1.6, finial * 1.2)
  gold.addColorStop(0, '#fff3c4')
  gold.addColorStop(0.55, '#e0b54a')
  gold.addColorStop(1, '#9c7420')
  context.fillStyle = gold
  context.beginPath()
  context.arc(poleX + poleWidth / 2, top - finial * 1.6, finial, 0, Math.PI * 2)
  context.fill()
}

function drawCloth(context, source, box, time, ratio) {
  const { clothX, clothWidth, clothHeight, top } = box
  const columns = Math.round(clothWidth * ratio)
  const amplitude = clothHeight * 0.075
  for (let column = 0; column < columns; column += 1) {
    const x = column / ratio
    const share = x / clothWidth
    const pinned = Math.pow(share, 0.85)
    const phase = share * Math.PI * 3.1 - time * 2.4
    const ripple = share * Math.PI * 5.3 - time * 3.7
    const offset = amplitude * pinned * (Math.sin(phase) + 0.3 * Math.sin(ripple))
    // Складка «уходит» от зрителя: полотно в этом месте чуть ниже ростом.
    const squeeze = 1 - 0.045 * pinned * (1 + Math.cos(phase))
    const height = clothHeight * squeeze
    const y = top + offset + (clothHeight - height) / 2
    const dx = clothX + x
    context.drawImage(source, Math.min(column, source.width - 1), 0, 1, source.height, dx, y, 1 / ratio + 0.6 / ratio, height)
    const shade = pinned * (Math.cos(phase) * 0.9 + 0.3 * Math.cos(ripple))
    context.fillStyle = shade > 0 ? `rgba(255, 255, 255, ${Math.min(0.22, shade * 0.2)})` : `rgba(4, 12, 40, ${Math.min(0.32, -shade * 0.28)})`
    context.fillRect(dx, y, 1 / ratio + 0.6 / ratio, height)
  }
}

export default function UnityFlag() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let ratio = 1
    let box = null
    let source = null
    let frame = 0
    let visible = true
    const start = performance.now()

    const still = () => motion.matches || isLitePerf()
    const paint = (time) => {
      if (!box) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      drawPole(context, box, height)
      drawCloth(context, source, box, time, ratio)
    }
    const tick = (now) => {
      paint((now - start) / 1000)
      frame = visible && !document.hidden && !still() ? requestAnimationFrame(tick) : 0
    }
    const run = () => {
      cancelAnimationFrame(frame)
      frame = 0
      if (still()) paint(1.3)
      else if (visible && !document.hidden) frame = requestAnimationFrame(tick)
    }
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      if (!width || !height) return
      ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      box = layout(width, height)
      source = stripes(box.clothWidth * ratio, box.clothHeight * ratio)
      run()
    }

    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(canvas)
    const viewObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; run() })
    viewObserver.observe(canvas)
    document.addEventListener('visibilitychange', run)
    motion.addEventListener('change', run)
    resize()
    return () => {
      cancelAnimationFrame(frame)
      sizeObserver.disconnect()
      viewObserver.disconnect()
      document.removeEventListener('visibilitychange', run)
      motion.removeEventListener('change', run)
    }
  }, [])

  return <div className="unity-hero-flag" aria-hidden="true"><canvas ref={canvasRef} /></div>
}
