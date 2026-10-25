// Модель «нейросети» для заставки ЛОГОС AI: слои точек в 3D и связи между
// соседними слоями. Здесь только математика (без DOM), поэтому её можно
// проверять тестами; рисует сеть neural-scene.js.

// Сколько нейронов в каждом слое. «full» — компьютер, «light» — телефон.
export const LAYOUTS = {
  full: [4, 7, 8, 7, 3],
  light: [3, 5, 5, 3],
}

// Детерминированный генератор: сеть выглядит одинаково при каждом заходе.
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

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

// Нейроны стоят слоями вдоль оси X, внутри слоя — столбиком по Y со
// случайной глубиной по Z. Каждый нейрон тянется к двум-трём ближайшим
// нейронам следующего слоя; у каждого нейрона следующего слоя есть хотя бы
// одна входящая связь, поэтому сигнал доходит до выхода.
export function buildNetwork(layout = LAYOUTS.full, { seed = 7, fanOut = 2 } = {}) {
  const random = mulberry32(seed)
  const nodes = []
  const layers = layout.map((count, layer) => {
    const ids = []
    for (let i = 0; i < count; i += 1) {
      const slot = count === 1 ? 0 : (i + 0.5) / count * 2 - 1
      ids.push(nodes.length)
      nodes.push({
        layer,
        x: layout.length === 1 ? 0 : (layer / (layout.length - 1) - 0.5) * 2.3,
        y: slot * 0.95 + (random() - 0.5) * 0.18,
        z: (random() - 0.5) * 1.5,
      })
    }
    return ids
  })
  const edges = []
  for (let layer = 0; layer < layers.length - 1; layer += 1) {
    const next = layers[layer + 1]
    const linked = new Set()
    for (const from of layers[layer]) {
      const nearest = [...next].sort((a, b) => distance(nodes[from], nodes[a]) - distance(nodes[from], nodes[b])).slice(0, Math.min(fanOut, next.length))
      for (const to of nearest) { edges.push([from, to]); linked.add(to) }
    }
    for (const to of next) {
      if (linked.has(to)) continue
      const from = [...layers[layer]].sort((a, b) => distance(nodes[to], nodes[a]) - distance(nodes[to], nodes[b]))[0]
      edges.push([from, to])
    }
  }
  const outgoing = nodes.map(() => [])
  edges.forEach(([from], index) => outgoing[from].push(index))
  return { nodes, edges, layers, outgoing }
}

// Перспективная проекция: поворот вокруг вертикали (yaw) и наклон (pitch),
// затем деление на глубину. out — массивы Float32Array под каждый нейрон
// (sx, sy — экранные координаты в долях размера сцены, scale — масштаб
// перспективы, depth — 0 далеко … 1 близко).
export function projectNetwork(network, { yaw = 0, pitch = 0, fov = 3.2 } = {}, out = createProjection(network.nodes.length)) {
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch)
  network.nodes.forEach((node, index) => {
    const x1 = node.x * cosY + node.z * sinY
    const z1 = -node.x * sinY + node.z * cosY
    const y2 = node.y * cosP - z1 * sinP
    const z2 = node.y * sinP + z1 * cosP
    const scale = fov / (fov + z2)
    out.sx[index] = x1 * scale
    out.sy[index] = y2 * scale
    out.scale[index] = scale
    out.depth[index] = Math.min(1, Math.max(0, 0.5 - z2 / 3))
  })
  return out
}

export function createProjection(count) {
  return { sx: new Float32Array(count), sy: new Float32Array(count), scale: new Float32Array(count), depth: new Float32Array(count) }
}

// Как собрана сеть к моменту t (0…1): слои «включаются» слева направо.
export function layerReveal(progress, layer, layerCount) {
  return Math.min(1, Math.max(0, progress * (layerCount + 1) - layer))
}

// Какой уровень качества выбрать: от устройства и режима. Возвращает
// 'full' | 'light' | 'still' (одна неподвижная картинка).
export function sceneQuality({ allowed3d, lite, reduced }) {
  if (lite || reduced) return 'still'
  return allowed3d ? 'full' : 'light'
}

// Если кадры не укладываются в бюджет, спускаемся на ступень ниже.
export function nextQuality(quality, averageFrameMs) {
  const budget = quality === 'full' ? 22 : 40
  if (averageFrameMs <= budget) return quality
  return quality === 'full' ? 'light' : 'still'
}
