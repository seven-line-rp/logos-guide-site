import { useEffect, useRef } from 'react'
import { isLitePerf } from '../perf.js'

// Небо главного экрана в теме «Единство»: мерцающие звёзды и праздничный салют
// цветов флага с золотом. Залпы идут сами раз в несколько секунд, а нажатие на
// свободное место неба запускает залп прямо там. Холст не ловит нажатия и лежит
// под текстом. При «Уменьшить движение» и в режиме «Лёгкий» — только звёзды,
// без движения; вне экрана и в фоновой вкладке анимация стоит.

const COLORS = ['#ffffff', '#4f8bff', '#ff4b3e', '#ffd27a']
const STARS = 70

function random(min, max) { return min + Math.random() * (max - min) }

export default function UnitySky() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const hero = canvas?.parentElement
    if (!canvas || !hero) return undefined
    const context = canvas.getContext('2d')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let ratio = 1
    let frame = 0
    let visible = true
    let last = 0
    let nextShow = 900
    const stars = Array.from({ length: STARS }, () => ({ x: Math.random(), y: Math.random() * 0.62, r: random(0.5, 1.5), phase: random(0, Math.PI * 2), speed: random(0.6, 1.8) }))
    const rockets = []
    const sparks = []

    const still = () => motion.matches || isLitePerf()
    const burst = (x, y, size = 1) => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const second = COLORS[Math.floor(Math.random() * COLORS.length)]
      const count = Math.round(54 * size)
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + random(-0.05, 0.05)
        const speed = random(1.6, 3.4) * size
        sparks.push({ x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, fade: random(0.011, 0.017), color: index % 3 ? color : second })
      }
    }
    const launch = (x, top) => rockets.push({ x, y: height + 6, target: top, vy: -random(6.5, 8.5) })

    const draw = (now) => {
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      for (const star of stars) {
        const alpha = still() ? 0.6 : 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(now / 1000 * star.speed + star.phase))
        context.fillStyle = `rgba(255, 255, 255, ${alpha})`
        context.beginPath()
        context.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2)
        context.fill()
      }
      context.lineCap = 'round'
      for (const rocket of rockets) {
        context.strokeStyle = 'rgba(255, 226, 160, .85)'
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(rocket.x, rocket.y)
        context.lineTo(rocket.x, rocket.y + 14)
        context.stroke()
      }
      for (const spark of sparks) {
        context.strokeStyle = spark.color
        context.globalAlpha = Math.max(0, spark.life)
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(spark.px, spark.py)
        context.lineTo(spark.x, spark.y)
        context.stroke()
      }
      context.globalAlpha = 1
    }

    const step = (delta) => {
      const k = delta / 16.7
      for (let index = rockets.length - 1; index >= 0; index -= 1) {
        const rocket = rockets[index]
        rocket.y += rocket.vy * k
        rocket.vy *= 0.992
        if (rocket.y <= rocket.target) { burst(rocket.x, rocket.y, random(0.85, 1.2)); rockets.splice(index, 1) }
      }
      for (let index = sparks.length - 1; index >= 0; index -= 1) {
        const spark = sparks[index]
        spark.px = spark.x
        spark.py = spark.y
        spark.vx *= 0.975
        spark.vy = spark.vy * 0.975 + 0.035 * k
        spark.x += spark.vx * k
        spark.y += spark.vy * k
        spark.life -= spark.fade * k
        if (spark.life <= 0) sparks.splice(index, 1)
      }
      nextShow -= delta
      if (nextShow <= 0) {
        launch(random(width * 0.45, width * 0.95), random(height * 0.12, height * 0.4))
        if (Math.random() < 0.35) launch(random(width * 0.5, width * 0.95), random(height * 0.12, height * 0.35))
        nextShow = random(1700, 3200)
      }
    }

    const tick = (now) => {
      const delta = Math.min(48, last ? now - last : 16.7)
      last = now
      step(delta)
      draw(now)
      frame = visible && !document.hidden && !still() ? requestAnimationFrame(tick) : 0
    }
    const run = () => {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      if (still()) draw(0)
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
      run()
    }
    // Залп по нажатию на небо (не на поиск, кнопки и ссылки).
    const onPointer = (event) => {
      if (still() || event.target.closest('a, button, input, form, label')) return
      const rect = canvas.getBoundingClientRect()
      burst(event.clientX - rect.left, event.clientY - rect.top, 1.15)
      if (!frame) run()
    }

    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(canvas)
    const viewObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; run() })
    viewObserver.observe(canvas)
    hero.addEventListener('pointerdown', onPointer)
    document.addEventListener('visibilitychange', run)
    motion.addEventListener('change', run)
    resize()
    return () => {
      cancelAnimationFrame(frame)
      sizeObserver.disconnect()
      viewObserver.disconnect()
      hero.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('visibilitychange', run)
      motion.removeEventListener('change', run)
    }
  }, [])

  return <canvas ref={canvasRef} className="unity-sky" aria-hidden="true" />
}
