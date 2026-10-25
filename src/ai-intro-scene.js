import { INTRO_BUTTON_AT, barHeight, buildBrain, buildStars, cameraAt, createBrainProjection, nodeReveal, projectBrain } from './ai-intro.js'

// Сцена заставки ЛОГОС AI на обычном canvas 2D: светящийся «мозг» из нейронов,
// кольца-интерфейс в духе Джарвиса, звёздная пыль, летящая на зрителя, и
// полоса сканирования. Всё рисуется с режимом смешивания «lighter», поэтому
// свет складывается как в кино. Чтобы не тормозить: свечение — готовые
// картинки (без shadowBlur), связи собраны в три пути по глубине, разрешение
// ограничено, на телефоне 30 кадров в секунду, в фоне и в «Лёгком» режиме кадры
// не считаются (рисуется один итоговый кадр).

const TIERS = {
  full: { count: 280, links: 3, pixelRatio: 1.75, fps: 60, pulses: 70, spawnEvery: 0.07, stars: 170 },
  light: { count: 150, links: 3, pixelRatio: 1, fps: 30, pulses: 28, spawnEvery: 0.14, stars: 70 },
  still: { count: 150, links: 3, pixelRatio: 1, fps: 0, pulses: 0, spawnEvery: 0, stars: 0 },
}
const FINAL_T = INTRO_BUTTON_AT + 0.5
const CYAN = [86, 214, 255]
const BLUE = [64, 120, 255]
const WHITE = [226, 244, 255]

const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`

function sprite(size, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d'), size)
  return canvas
}

function glow(color, core) {
  return sprite(64, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, rgba(color, core))
    g.addColorStop(0.2, rgba(color, core * 0.45))
    g.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  })
}

export function createIntroScene(canvas, { quality: startQuality = 'full' } = {}) {
  const ctx = canvas.getContext('2d')
  const tier = TIERS[startQuality]
  const brain = buildBrain(tier.count, { links: tier.links })
  const stars = buildStars(tier.stars)
  const projection = createBrainProjection(brain.nodes.length)
  const activation = new Float32Array(brain.nodes.length)
  const reveal = new Float32Array(brain.nodes.length)
  const pulses = []
  let width = 0, height = 0, ratio = 1
  let frameId = 0, running = false, startedAt = 0, last = 0, spawnTimer = 0
  let clock = 0
  const sprites = { node: sprite(32, (c, s) => { c.fillStyle = rgba(WHITE, 1); c.beginPath(); c.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); c.fill() }), halo: glow(CYAN, 0.9), flare: glow(WHITE, 1), blue: glow(BLUE, 0.7) }

  const resize = () => {
    const box = canvas.getBoundingClientRect()
    ratio = Math.min(window.devicePixelRatio || 1, tier.pixelRatio)
    const w = Math.max(1, Math.round(box.width * ratio))
    const h = Math.max(1, Math.round(box.height * ratio))
    width = box.width
    height = box.height
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    if (!running) draw(FINAL_T)
  }

  const fire = (node) => {
    activation[node] = 1
    for (const edge of brain.outgoing[node]) {
      if (pulses.length >= tier.pulses) return
      const from = brain.edges[edge][0] === node
      pulses.push({ edge, t: from ? 0 : 1, dir: from ? 1 : -1, speed: 0.9 + (edge % 7) * 0.12 })
    }
  }

  function step(dt, t) {
    for (let i = 0; i < activation.length; i += 1) activation[i] = Math.max(0, activation[i] - dt * 1.5)
    // Чем дальше сцена, тем чаще вспыхивают нейроны: «мозг» просыпается.
    spawnTimer -= dt * (0.6 + Math.min(1.6, t / 4))
    if (spawnTimer <= 0 && tier.spawnEvery) {
      spawnTimer = tier.spawnEvery * (0.5 + Math.random())
      const node = Math.floor(Math.random() * brain.nodes.length)
      if (nodeReveal(t, brain.nodes[node].order) >= 1) fire(node)
    }
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      const pulse = pulses[i]
      pulse.t += dt * pulse.speed * pulse.dir
      if (pulse.t >= 1 || pulse.t <= 0) {
        const [a, b] = brain.edges[pulse.edge]
        const target = pulse.dir > 0 ? b : a
        pulses.splice(i, 1)
        if (Math.random() < 0.55) fire(target); else activation[target] = 1
      }
    }
  }

  // Кольца-интерфейс: пунктирные дуги, засечки и бегущий сегмент.
  function drawRings(cx, cy, base, t) {
    ctx.lineCap = 'round'
    const rings = [
      { r: 1.05, w: 1, a: 0.28, dash: [2, 9], spin: 0.1 },
      { r: 1.18, w: 1.6, a: 0.4, dash: [90, 40, 8, 40], spin: -0.14 },
      { r: 1.32, w: 1, a: 0.22, dash: [1, 6], spin: 0.06 },
      { r: 1.48, w: 2, a: 0.34, dash: [150, 220], spin: 0.2 },
    ]
    const appear = Math.min(1, Math.max(0, (t - 0.3) / 1.2))
    for (const ring of rings) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(t * ring.spin + ring.r * 3)
      ctx.setLineDash(ring.dash)
      ctx.lineWidth = ring.w
      ctx.strokeStyle = rgba(CYAN, ring.a * appear)
      ctx.beginPath()
      ctx.arc(0, 0, base * ring.r * (0.9 + 0.1 * appear), 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    ctx.setLineDash([])
    // Засечки по внешнему кругу.
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-t * 0.05)
    ctx.strokeStyle = rgba(CYAN, 0.3 * appear)
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < 72; i += 1) {
      const a = (i / 72) * Math.PI * 2
      const inner = base * (i % 6 === 0 ? 1.56 : 1.6)
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner)
      ctx.lineTo(Math.cos(a) * base * 1.65, Math.sin(a) * base * 1.65)
    }
    ctx.stroke()
    ctx.restore()
  }

  // Звёзды летят из центра к краям экрана.
  function drawStars(cx, cy, t) {
    if (!stars.length) return
    const reach = Math.hypot(width, height) * 0.62
    ctx.lineWidth = 1.2
    ctx.strokeStyle = rgba(WHITE, 0.55)
    ctx.beginPath()
    for (const star of stars) {
      const p = (star.phase + t * star.speed) % 1
      const head = p * p
      const tail = Math.max(0, (p - 0.06) ** 2)
      const cos = Math.cos(star.angle), sin = Math.sin(star.angle)
      ctx.moveTo(cx + cos * reach * tail * star.spread, cy + sin * reach * tail * star.spread)
      ctx.lineTo(cx + cos * reach * head * star.spread, cy + sin * reach * head * star.spread)
    }
    ctx.stroke()
  }

  function draw(t) {
    if (width < 4) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'lighter'

    const narrow = width < 700
    const camera = cameraAt(t)
    const base = Math.min(width, height) * (narrow ? 0.34 : 0.3) * camera.zoom
    const cx = width / 2
    const cy = height * (narrow ? 0.4 : 0.42)

    // Вспышка в центре при старте и постоянное мягкое сияние.
    const burst = Math.max(0, 1 - Math.abs(t - 0.5) / 0.7)
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2)
    const aura = base * (3.2 + burst * 2)
    ctx.globalAlpha = Math.min(1, (0.35 + burst * 0.6) * pulse * Math.min(1, t * 2 + 0.3))
    ctx.drawImage(sprites.blue, cx - aura, cy - aura, aura * 2, aura * 2)
    ctx.globalAlpha = 1

    drawStars(cx, cy, t)
    drawRings(cx, cy, base, t)

    projectBrain(brain, { yaw: camera.yaw, pitch: camera.pitch }, projection)
    const { sx, sy, scale, depth } = projection
    for (let i = 0; i < reveal.length; i += 1) reveal[i] = nodeReveal(t, brain.nodes[i].order)

    // Связи: три группы по глубине — три stroke вместо сотен.
    const groups = [[], [], []]
    brain.edges.forEach(([a, b], index) => {
      const r = Math.min(reveal[a], reveal[b])
      if (r < 0.05) return
      const mean = (depth[a] + depth[b]) / 2
      groups[mean < 0.4 ? 0 : mean < 0.62 ? 1 : 2].push(index)
    })
    const strokes = [[0.09, 0.7], [0.17, 1], [0.32, 1.3]]
    groups.forEach((list, group) => {
      if (!list.length) return
      ctx.beginPath()
      for (const index of list) {
        const [a, b] = brain.edges[index]
        ctx.moveTo(cx + sx[a] * base, cy + sy[a] * base)
        ctx.lineTo(cx + sx[b] * base, cy + sy[b] * base)
      }
      ctx.strokeStyle = rgba(CYAN, strokes[group][0])
      ctx.lineWidth = strokes[group][1]
      ctx.stroke()
    })

    // Нейроны и свечение вспыхнувших.
    for (let i = 0; i < brain.nodes.length; i += 1) {
      if (reveal[i] < 0.02) continue
      const x = cx + sx[i] * base
      const y = cy + sy[i] * base
      const radius = (1.1 + 2.4 * scale[i]) * (0.3 + 0.7 * reveal[i])
      // Только что включившийся нейрон коротко вспыхивает.
      const flash = Math.max(activation[i], reveal[i] < 1 ? 1 - reveal[i] : 0)
      if (flash > 0.04) {
        const halo = radius * (4 + 7 * flash)
        ctx.globalAlpha = Math.min(1, flash) * 0.9
        ctx.drawImage(sprites.halo, x - halo, y - halo, halo * 2, halo * 2)
      }
      ctx.globalAlpha = (0.3 + 0.7 * depth[i]) * reveal[i]
      ctx.drawImage(sprites.node, x - radius, y - radius, radius * 2, radius * 2)
    }

    // Импульсы бегут по связям.
    for (const p of pulses) {
      const [a, b] = brain.edges[p.edge]
      const x = cx + (sx[a] + (sx[b] - sx[a]) * p.t) * base
      const y = cy + (sy[a] + (sy[b] - sy[a]) * p.t) * base
      const near = depth[a] + (depth[b] - depth[a]) * p.t
      const radius = 5 + 9 * near
      ctx.globalAlpha = Math.min(1, Math.sin(p.t * Math.PI) * 1.8) * (0.55 + 0.45 * near)
      ctx.drawImage(sprites.flare, x - radius, y - radius, radius * 2, radius * 2)
    }
    ctx.globalAlpha = 1

    // Полоса сканирования проходит по кадру сверху вниз каждые 4 секунды.
    if (tier.fps) {
      const sweep = ((t - 0.8) % 4) / 4
      if (t > 0.8) {
        const y = height * sweep
        const gradient = ctx.createLinearGradient(0, y - 60, 0, y + 2)
        gradient.addColorStop(0, rgba(CYAN, 0))
        gradient.addColorStop(1, rgba(CYAN, 0.09))
        ctx.fillStyle = gradient
        ctx.fillRect(0, y - 60, width, 62)
        ctx.fillStyle = rgba(CYAN, 0.22)
        ctx.fillRect(0, y, width, 1)
      }
    }

    // Чёрные «киношные» полосы.
    ctx.globalCompositeOperation = 'source-over'
    const bars = height * barHeight(t)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, bars)
    ctx.fillRect(0, height - bars, width, bars)
  }

  const tick = (now) => {
    frameId = 0
    if (!running) return
    frameId = requestAnimationFrame(tick)
    if (!startedAt) startedAt = now
    if (last && now - last < 1000 / tier.fps - 2) return
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016)
    last = now
    clock = (now - startedAt) / 1000
    step(dt, clock)
    draw(clock)
  }

  const onVisibility = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(frameId); frameId = 0 }
    else if (!running && tier.fps) { running = true; last = 0; startedAt = performance.now() - clock * 1000; frameId = requestAnimationFrame(tick) }
  }

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  resizeObserver?.observe(canvas)
  document.addEventListener('visibilitychange', onVisibility)
  resize()

  return {
    // Время сцены в секундах — по нему оболочка показывает надписи и кнопку.
    get time() { return running ? clock : FINAL_T },
    start() {
      if (!tier.fps) { draw(FINAL_T); return }
      running = true
      frameId = requestAnimationFrame(tick)
    },
    destroy() {
      running = false
      cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
