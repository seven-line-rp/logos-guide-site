import { useEffect, useRef, useState } from 'react'
import { CONFETTI_EVENT } from '../unity-fx.js'
import { isLitePerf } from '../perf.js'

// Конфетти цветов флага на весь экран: летит пару секунд и исчезает. Запускается
// событием (fireConfetti из src/unity-fx.js). Не ловит нажатия; при «Уменьшить
// движение» и в режиме «Лёгкий» не показывается.

const COLORS = ['#ffffff', '#0039a6', '#d52b1e', '#e0b54a']

export default function UnityConfetti() {
  const [shots, setShots] = useState(0)
  const canvasRef = useRef(null)

  useEffect(() => {
    const onFire = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isLitePerf()) return
      setShots((value) => value + 1)
    }
    window.addEventListener(CONFETTI_EVENT, onFire)
    return () => window.removeEventListener(CONFETTI_EVENT, onFire)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!shots || !canvas) return undefined
    const context = canvas.getContext('2d')
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const pieces = Array.from({ length: 170 }, (_, index) => {
      const side = index % 2 ? -1 : 1
      return {
        x: side > 0 ? -10 : width + 10,
        y: height * (0.35 + Math.random() * 0.4),
        vx: side * (4 + Math.random() * 7),
        vy: -(7 + Math.random() * 9),
        w: 7 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        turn: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        color: COLORS[index % COLORS.length],
      }
    })
    let frame = 0
    const tick = () => {
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      let alive = 0
      for (const piece of pieces) {
        piece.vx *= 0.985
        piece.vy = piece.vy * 0.985 + 0.32
        piece.x += piece.vx
        piece.y += piece.vy
        piece.turn += piece.spin
        if (piece.y < height + 20) alive += 1
        context.save()
        context.translate(piece.x, piece.y)
        context.rotate(piece.turn)
        context.scale(1, Math.cos(piece.turn * 2))
        context.fillStyle = piece.color
        context.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h)
        if (piece.color === '#ffffff') { context.strokeStyle = 'rgba(10, 31, 82, .35)'; context.lineWidth = 1; context.strokeRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h) }
        context.restore()
      }
      frame = alive ? requestAnimationFrame(tick) : 0
      if (!alive) context.clearRect(0, 0, width, height)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [shots])

  return <canvas ref={canvasRef} className="unity-confetti" aria-hidden="true" />
}
