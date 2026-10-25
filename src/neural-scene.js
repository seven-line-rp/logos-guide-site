import { LAYOUTS, buildNetwork, createProjection, layerReveal, nextQuality, projectNetwork } from './neural-net.js'

// Заставка ЛОГОС AI: 3D-нейросеть на обычном canvas 2D (без WebGL и библиотек).
// Слои нейронов собираются слева направо и медленно вращаются, по связям бегут
// импульсы и «зажигают» следующие нейроны. Чтобы не тормозить:
//   - свечение рисуется готовыми картинками (drawImage), без shadowBlur;
//   - все линии одной глубины — одним путём (3 вызова stroke на кадр);
//   - разрешение canvas ограничено (до 1,5× на компьютере, 1× на телефоне),
//     на телефоне 30 кадров в секунду;
//   - вне экрана, в фоновой вкладке, во время смены темы и пока чат не пустой
//     кадры не считаются;
//   - если кадры не укладываются в бюджет, качество само падает:
//     full → light → still (одна неподвижная картинка).

const TIERS = {
  full: { layout: LAYOUTS.full, fanOut: 3, pixelRatio: 1.5, fps: 60, pulses: 26, spawnEvery: 0.38 },
  light: { layout: LAYOUTS.light, fanOut: 2, pixelRatio: 1, fps: 30, pulses: 10, spawnEvery: 0.7 },
  still: { layout: LAYOUTS.light, fanOut: 2, pixelRatio: 1, fps: 0, pulses: 0, spawnEvery: 0 },
}
const INTRO_SECONDS = 2.2
const WARMUP_FRAMES = 50

function parseColor(value) {
  const text = String(value || '').trim()
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const full = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
  }
  const rgb = text.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null
}

export function readPalette(root = document.documentElement) {
  const dark = root.dataset.theme === 'dark'
  const ink = parseColor(getComputedStyle(root).getPropertyValue('--ink')) || (dark ? [229, 237, 251] : [19, 33, 58])
  return { ink, accent: dark ? [123, 164, 255] : [36, 92, 229], dark }
}

function makeSprite(size, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d'), size)
  return canvas
}

const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`

function glowSprite(color, strong) {
  return makeSprite(64, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, rgba(color, strong ? 0.95 : 0.55))
    gradient.addColorStop(0.25, rgba(color, strong ? 0.5 : 0.22))
    gradient.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  })
}

function nodeSprite(color) {
  return makeSprite(32, (ctx, size) => {
    ctx.fillStyle = rgba(color, 1)
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function createNeuralScene(canvas, { quality: startQuality = 'full', onQuality } = {}) {
  const ctx = canvas.getContext('2d')
  let quality = startQuality
  let tier = TIERS[quality]
  let network = buildNetwork(tier.layout, { fanOut: tier.fanOut })
  let projection = createProjection(network.nodes.length)
  let activation = new Float32Array(network.nodes.length)
  let pulses = []
  let palette = readPalette()
  let sprites = null
  let width = 0, height = 0, pixelRatio = 1
  let frameId = 0
  let running = false
  let introStart = 0
  let last = 0
  let rawPrev = 0
  let clock = 0
  let spawnTimer = 0
  let averageMs = 0
  let frames = 0
  let pointer = { x: 0, y: 0 }
  let look = { x: 0, y: 0 }
  const flags = { inView: true, active: true, hidden: false, busy: false }

  const buildSprites = () => {
    palette = readPalette()
    sprites = { node: nodeSprite(palette.ink), glow: glowSprite(palette.accent, false), spark: glowSprite(palette.accent, true) }
  }

  const resize = () => {
    const box = canvas.getBoundingClientRect()
    const ratio = Math.min(window.devicePixelRatio || 1, tier.pixelRatio)
    const w = Math.max(1, Math.round(box.width * ratio))
    const h = Math.max(1, Math.round(box.height * ratio))
    width = box.width
    height = box.height
    pixelRatio = ratio
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    if (!running) draw(1, 0)
  }

  const rebuild = (next) => {
    quality = next
    tier = TIERS[next]
    network = buildNetwork(tier.layout, { fanOut: tier.fanOut })
    projection = createProjection(network.nodes.length)
    activation = new Float32Array(network.nodes.length)
    pulses = []
    averageMs = 0
    frames = 0
    settle()
    resize()
    onQuality?.(next)
  }

  // Неподвижная картинка сразу собрана целиком и с несколькими «горящими» нейронами.
  function settle() {
    if (tier.fps === 0) network.layers.flat().forEach((node, index) => { if (index % 4 === 0) activation[node] = 0.9 })
  }

  const fire = (node) => {
    activation[node] = 1
    for (const edge of network.outgoing[node]) {
      if (pulses.length < tier.pulses) pulses.push({ edge, t: 0, speed: 0.55 + (edge % 5) * 0.08 })
    }
  }

  // intro: 0…1 — сборка сети; eased — плавный разгон.
  function draw(intro, dt) {
    if (!sprites || width < 4) return
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const eased = 1 - (1 - intro) ** 3
    const narrow = width < 700
    const cx = width / 2
    const cy = height * (narrow ? 0.36 : 0.44)
    // Сеть шириной ±1,15 должна помещаться в кадр целиком, даже когда повёрнута.
    const size = Math.min(width * 0.44 / 1.15, height * (narrow ? 0.3 : 0.4)) * (0.82 + 0.18 * eased)
    look.x += (pointer.x - look.x) * Math.min(1, dt * 3)
    look.y += (pointer.y - look.y) * Math.min(1, dt * 3)
    const yaw = (intro < 1 ? (1 - eased) * -1.6 : 0) + clock * 0.16 + 0.5 + look.x * 0.5
    const pitch = -0.32 + look.y * 0.25
    projectNetwork(network, { yaw, pitch }, projection)
    const { sx, sy, scale, depth } = projection
    const layers = tier.layout.length

    // Связи: три группы по глубине — три stroke вместо сотни.
    const buckets = [[], [], []]
    network.edges.forEach(([from, to], index) => {
      const reveal = Math.min(layerReveal(intro, network.nodes[from].layer, layers), layerReveal(intro, network.nodes[to].layer, layers))
      if (reveal <= 0.02) return
      const mean = (depth[from] + depth[to]) / 2
      buckets[mean < 0.38 ? 0 : mean < 0.62 ? 1 : 2].push(index, reveal)
    })
    const strokes = [[0.07, 0.7], [0.14, 1], [0.26, 1.4]]
    buckets.forEach((list, group) => {
      if (!list.length) return
      ctx.beginPath()
      let reveal = 1
      for (let i = 0; i < list.length; i += 2) {
        const [from, to] = network.edges[list[i]]
        reveal = Math.min(reveal, list[i + 1])
        ctx.moveTo(cx + sx[from] * size, cy + sy[from] * size)
        ctx.lineTo(cx + sx[to] * size, cy + sy[to] * size)
      }
      ctx.strokeStyle = rgba(palette.ink, strokes[group][0] * (palette.dark ? 1.15 : 1) * Math.max(0.35, reveal))
      ctx.lineWidth = strokes[group][1]
      ctx.stroke()
    })

    // Нейроны и их свечение.
    for (let i = 0; i < network.nodes.length; i += 1) {
      const reveal = layerReveal(intro, network.nodes[i].layer, layers)
      if (reveal <= 0.02) continue
      const x = cx + sx[i] * size
      const y = cy + sy[i] * size
      const radius = (2.2 + 3.2 * scale[i]) * (0.4 + 0.6 * reveal)
      const glow = activation[i]
      if (glow > 0.03) {
        const halo = radius * (5 + 5 * glow)
        ctx.globalAlpha = Math.min(1, glow) * reveal
        ctx.drawImage(sprites.glow, x - halo, y - halo, halo * 2, halo * 2)
      }
      ctx.globalAlpha = (0.35 + 0.55 * depth[i]) * reveal
      ctx.drawImage(sprites.node, x - radius, y - radius, radius * 2, radius * 2)
    }

    // Импульсы бегут по связям.
    for (const pulse of pulses) {
      const [from, to] = network.edges[pulse.edge]
      const x = cx + (sx[from] + (sx[to] - sx[from]) * pulse.t) * size
      const y = cy + (sy[from] + (sy[to] - sy[from]) * pulse.t) * size
      const near = depth[from] + (depth[to] - depth[from]) * pulse.t
      const radius = 6 + 8 * near
      ctx.globalAlpha = Math.min(1, Math.sin(pulse.t * Math.PI) * 1.6) * (0.5 + 0.5 * near)
      ctx.drawImage(sprites.spark, x - radius, y - radius, radius * 2, radius * 2)
    }
    ctx.globalAlpha = 1
  }

  function step(dt) {
    clock += dt
    for (let i = 0; i < activation.length; i += 1) activation[i] = Math.max(0, activation[i] - dt * 1.6)
    spawnTimer -= dt
    if (spawnTimer <= 0 && tier.spawnEvery) {
      spawnTimer = tier.spawnEvery * (0.6 + Math.random() * 0.8)
      const inputs = network.layers[0]
      fire(inputs[Math.floor(Math.random() * inputs.length)])
    }
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      const pulse = pulses[i]
      pulse.t += dt * pulse.speed
      if (pulse.t >= 1) {
        const [, to] = network.edges[pulse.edge]
        pulses.splice(i, 1)
        // На выходе гаснем, внутри — зажигаем нейрон, и сигнал идёт дальше.
        if (network.outgoing[to].length) { if (Math.random() < 0.8) fire(to); else activation[to] = 1 } else activation[to] = 1
      }
    }
  }

  const tick = (now) => {
    frameId = 0
    if (!running) return
    frameId = requestAnimationFrame(tick)
    watch(now)
    const minGap = 1000 / tier.fps
    if (last && now - last < minGap - 2) return
    const elapsed = last ? now - last : 16
    const dt = Math.min(0.05, elapsed / 1000)
    last = now
    if (!introStart) introStart = now
    step(dt)
    draw(Math.min(1, (now - introStart) / 1000 / INTRO_SECONDS), dt)
  }

  // Следим за настоящим интервалом между кадрами браузера (а не за тем, как
  // часто мы рисуем сами): если страница не успевает, качество падает.
  const watch = (now) => {
    const raw = rawPrev ? now - rawPrev : 0
    rawPrev = now
    if (raw <= 0 || raw > 250) return
    frames += 1
    if (frames <= 8) return
    averageMs = averageMs ? averageMs * 0.92 + raw * 0.08 : raw
    if (frames > WARMUP_FRAMES) {
      const next = nextQuality(quality, averageMs)
      if (next !== quality) { rebuild(next); sync() }
    }
  }

  const sync = () => {
    const should = flags.inView && flags.active && !flags.hidden && !flags.busy && tier.fps > 0
    if (should && !running) {
      running = true
      last = 0
      rawPrev = 0
      frameId = requestAnimationFrame(tick)
    } else if (!should && running) {
      running = false
      cancelAnimationFrame(frameId)
      frameId = 0
    }
    if (!running) draw(1, 0)
  }

  buildSprites()
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  resizeObserver?.observe(canvas)
  const viewObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { flags.inView = entry.isIntersecting; sync() })
  viewObserver?.observe(canvas)
  const onVisibility = () => { flags.hidden = document.hidden; sync() }
  const onBusy = () => { flags.busy = document.documentElement.hasAttribute('data-theme-busy'); sync() }
  const themeObserver = new MutationObserver(() => { buildSprites(); if (!running) draw(1, 0) })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('logos-theme-busy', onBusy)
  const onPointer = (event) => {
    const box = canvas.getBoundingClientRect()
    pointer = { x: ((event.clientX - box.left) / box.width - 0.5) * 2, y: ((event.clientY - box.top) / box.height - 0.5) * 2 }
  }
  if (window.matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onPointer, { passive: true })

  settle()
  resize()

  return {
    get quality() { return quality },
    // Пока чат не пустой, сеть не нужна: кадры не считаются.
    setActive(value) {
      if (value && !flags.active) introStart = 0
      flags.active = value
      sync()
    },
    setQuality(next) { if (next !== quality) rebuild(next); sync() },
    start: sync,
    destroy() {
      running = false
      cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      viewObserver?.disconnect()
      themeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('logos-theme-busy', onBusy)
      window.removeEventListener('pointermove', onPointer)
    },
  }
}
