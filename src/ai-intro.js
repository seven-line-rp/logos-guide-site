// Кинематографичная заставка при первом заходе в ЛОГОС AI: нейросеть-«мозг»
// из точек на сфере, по связям бегут импульсы, камера медленно наезжает,
// сверху и снизу выезжают чёрные полосы как в кино, на экране быстро
// сменяются короткие надписи, в конце появляется кнопка «Приступить».
// Здесь только данные и математика (без DOM), чтобы это проверялось тестами;
// рисует сцену ai-intro-scene.js, оболочка — components/AiIntro.jsx.

export const INTRO_KEY = 'logos-ai-intro-seen'

// Надписи заставки: кадр показывается [from, to) секунд.
export const INTRO_CAPTIONS = [
  { from: 0.9, to: 2.5, kicker: 'Нейросеть колледжа', title: 'ЛОГОС AI' },
  { from: 2.5, to: 4.0, kicker: 'Знает всё о корпусе', title: 'Каждый кабинет, этаж и лестница' },
  { from: 4.0, to: 5.5, kicker: 'Помогает учиться', title: 'Теория, задачи и подготовка к зачёту' },
  { from: 5.5, to: 7.0, kicker: 'Понимает вас', title: 'Читает фото, слушает голос' },
  { from: 7.0, to: 8.4, kicker: 'Ответ за секунды', title: 'Спросите о чём угодно' },
]
export const INTRO_BUTTON_AT = 8.4
export const INTRO_FADE_OUT = 0.9

// Какой кадр надписи показывать в момент t и насколько он проявился (0…1):
// плавно появляется за 0,35 с и гаснет за 0,3 с до конца.
export function captionAt(t, captions = INTRO_CAPTIONS) {
  const index = captions.findIndex((item) => t >= item.from && t < item.to)
  if (index < 0) return null
  const { from, to } = captions[index]
  const fadeIn = Math.min(1, (t - from) / 0.35)
  const fadeOut = Math.min(1, (to - t) / 0.3)
  return { index, caption: captions[index], opacity: Math.max(0, Math.min(fadeIn, fadeOut)) }
}

// Заставка показывается один раз: если в браузере уже есть отметка, пропускаем.
export function shouldShowIntro(read) {
  try { return read(INTRO_KEY) !== '1' } catch { return true }
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Облако нейронов: точки на сфере (золотая спираль, чтобы лежали ровно) со
// случайным сдвигом по радиусу, чтобы «мозг» был объёмным, а не оболочкой.
// Связи — каждый нейрон тянется к ближайшим соседям.
export function buildBrain(count = 260, { seed = 11, links = 3, maxLink = 0.5 } = {}) {
  const random = mulberry32(seed)
  const nodes = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const angle = golden * i
    const radius = 0.62 + random() * 0.38
    nodes.push({ x: Math.cos(angle) * ring * radius, y: y * radius, z: Math.sin(angle) * ring * radius, order: random() })
  }
  const seen = new Set()
  const edges = []
  nodes.forEach((a, from) => {
    const near = []
    nodes.forEach((b, to) => {
      if (to === from) return
      near.push([Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), to])
    })
    near.sort((p, q) => p[0] - q[0])
    for (const [length, to] of near.slice(0, links)) {
      if (length > maxLink) continue
      const key = from < to ? `${from}-${to}` : `${to}-${from}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push([from, to])
    }
  })
  const outgoing = nodes.map(() => [])
  edges.forEach(([from, to], index) => { outgoing[from].push(index); outgoing[to].push(index) })
  return { nodes, edges, outgoing }
}

// Звёздная пыль вокруг: точки вылетают из центра к зрителю (эффект полёта).
export function buildStars(count = 160, seed = 5) {
  const random = mulberry32(seed)
  return Array.from({ length: count }, () => ({ angle: random() * Math.PI * 2, spread: 0.15 + random() * 0.95, phase: random(), speed: 0.05 + random() * 0.1 }))
}

// Камера: наезд с 0,55 до 1 за первые секунды и медленный дрейф дальше.
export function cameraAt(t) {
  const approach = Math.min(1, t / 6)
  const eased = 1 - (1 - approach) ** 3
  return { zoom: 0.55 + 0.45 * eased + Math.max(0, t - 6) * 0.012, yaw: t * 0.22 + (1 - eased) * -1.2, pitch: -0.28 + Math.sin(t * 0.35) * 0.08 }
}

// Высота чёрных «киношных» полос в долях экрана: выезжают за 1,1 с, перед
// концом чуть отступают.
export function barHeight(t, max = 0.1) {
  const open = Math.min(1, t / 1.1)
  return max * (1 - (1 - open) ** 3)
}

// Облако проецируется в экран: поворот (yaw, pitch) и перспектива.
export function projectBrain(brain, { yaw, pitch, fov = 2.6 }, out) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  brain.nodes.forEach((n, i) => {
    const x1 = n.x * cy + n.z * sy
    const z1 = -n.x * sy + n.z * cy
    const y2 = n.y * cp - z1 * sp
    const z2 = n.y * sp + z1 * cp
    const scale = fov / (fov + z2)
    out.sx[i] = x1 * scale
    out.sy[i] = y2 * scale
    out.scale[i] = scale
    out.depth[i] = Math.min(1, Math.max(0, 0.5 - z2 / 2.2))
  })
  return out
}

export function createBrainProjection(count) {
  return { sx: new Float32Array(count), sy: new Float32Array(count), scale: new Float32Array(count), depth: new Float32Array(count) }
}

// Нейрон «включается» в момент order * 2,6 с; возвращает 0…1.
export function nodeReveal(t, order) {
  return Math.min(1, Math.max(0, (t - 0.2 - order * 2.6) / 0.6))
}

// Для слабых устройств и «Уменьшить движение»: ничего не движется, но кадр
// собран целиком, а кнопка и последняя надпись видны сразу.
export function introMode({ lite, reduced }) {
  return lite || reduced ? 'still' : 'full'
}
