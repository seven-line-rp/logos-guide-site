import { rooms } from './data.js'
import { isInsidePlan, isManualPoint, planSizes } from './map-geometry.js'

// Где человек на плане: ручная метка и GPS. GPS переводится в координаты плана
// по точкам привязки корпуса — тем же, что в Android-приложении
// (logos-guide, app/src/main/assets/navigation_graph.json → gpsAnchors): углы
// здания, снятые по спутниковой карте. Планы сайта и приложения нарисованы в
// одной системе координат (viewBox 758×552 и 767×561), поэтому точки подходят
// без пересчёта. Этаж браузер не знает, его выбирает человек.

const EARTH_RADIUS = 6_371_000
const RAD = Math.PI / 180
const EARTH_METRES_PER_DEGREE = 111_320

// Метров в одной единице плана (как metersPerUnit в приложении).
export const METRES_PER_UNIT = { 1: 0.08332894, 2: 0.08334442 }

export const BUILDING_ANCHORS = {
  1: [
    { id: '1_5', latitude: 55.214762, longitude: 36.536331, x: 757.08, y: 241.82 },
    { id: '1_6', latitude: 55.215103, longitude: 36.537163, x: 146.95, y: 241.82 },
    { id: '1_7', latitude: 55.215359, longitude: 36.536879, x: 146.95, y: 550.6 },
    { id: '1_8', latitude: 55.215429, longitude: 36.537066, x: 0, y: 550.6 },
  ],
  2: [
    { id: '2_1', latitude: 55.215005, longitude: 36.537568, x: 0, y: 0 },
    { id: '2_2', latitude: 55.214928, longitude: 36.537406, x: 148.5, y: 0 },
    { id: '2_3', latitude: 55.214996, longitude: 36.53731, x: 148.5, y: 94.76 },
    { id: '2_4', latitude: 55.214671, longitude: 36.536464, x: 767, y: 94.76 },
  ],
}

// Точность, при которой метку ещё есть смысл показывать (как в приложении:
// минимум 20 м × 2,5, но не меньше 45 м). Хуже — только сообщение.
export const GPS_GOOD_ACCURACY = 20
export const GPS_SHOW_LIMIT = 50

export function readManualLocation(raw) {
  try {
    const value = JSON.parse(raw)
    return isManualPoint(value, rooms) ? value : null
  } catch { return null }
}

export function validAnchor(value, floor) {
  return value && value.floor === floor && isManualPoint(value, rooms) &&
    Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
}

export function readGpsAnchors(raw) {
  try {
    const saved = JSON.parse(raw)
    return Object.fromEntries([1, 2].map((floor) => [floor, Array.isArray(saved?.[floor]) ? saved[floor].filter((item) => validAnchor(item, floor)).slice(0, 2) : []]))
  } catch { return { 1: [], 2: [] } }
}

function geoDelta(origin, point) {
  const latitude = origin.latitude * Math.PI / 180
  return [
    (point.longitude - origin.longitude) * EARTH_METRES_PER_DEGREE * Math.cos(latitude),
    -(point.latitude - origin.latitude) * EARTH_METRES_PER_DEGREE,
  ]
}

export function addGpsAnchor(anchors, floor, point, coords) {
  const current = anchors[floor] || []
  const next = { ...point, floor, latitude: coords.latitude, longitude: coords.longitude }
  if (!validAnchor(next, floor)) return anchors
  if (current.length === 1 && Math.hypot(...geoDelta(current[0], next)) < 3) return anchors
  return { ...anchors, [floor]: current.length === 1 ? [current[0], next] : [next] }
}

const validCoords = (coords) => coords && Number.isFinite(coords.latitude) && Math.abs(coords.latitude) <= 90 &&
  Number.isFinite(coords.longitude) && Math.abs(coords.longitude) <= 180

// Локальная плоскость вокруг якорей: метры на восток и на север.
function localFrame(anchors) {
  const latitude = anchors.reduce((sum, item) => sum + item.latitude, 0) / anchors.length
  const longitude = anchors.reduce((sum, item) => sum + item.longitude, 0) / anchors.length
  const scale = Math.cos(latitude * RAD)
  return (point) => [(point.longitude - longitude) * RAD * EARTH_RADIUS * scale, (point.latitude - latitude) * RAD * EARTH_RADIUS]
}

function solve3(m) {
  for (let col = 0; col < 3; col += 1) {
    let pivot = col
    for (let row = col + 1; row < 3; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]]
    const divisor = m[col][col]
    for (let j = col; j < 4; j += 1) m[col][j] /= divisor
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue
      const factor = m[row][col]
      for (let j = col; j < 4; j += 1) m[row][j] -= factor * m[col][j]
    }
  }
  return [m[0][3], m[1][3], m[2][3]]
}

// Аффинное преобразование (восток, север) → (x, y) методом наименьших
// квадратов по трём и более точкам, как GeoReferencer в приложении.
function fitAffine(samples, column) {
  const normal = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
  for (const row of samples) {
    const vector = [row[0], row[1], 1]
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) normal[i][j] += vector[i] * vector[j]
      normal[i][3] += vector[i] * row[column]
    }
  }
  return solve3(normal)
}

const transforms = new WeakMap()

// Возвращает функцию coords → [x, y] на плане или null, если по точкам
// преобразование не построить (одна точка, точки совпадают).
export function geoTransform(anchors) {
  if (!Array.isArray(anchors) || anchors.length < 2 || !anchors.every(validCoords)) return null
  if (transforms.has(anchors)) return transforms.get(anchors)
  const toLocal = localFrame(anchors)
  const samples = anchors.map((item) => [...toLocal(item), item.x, item.y])
  let transform = null
  if (samples.length >= 3) {
    const cx = fitAffine(samples, 2)
    const cy = fitAffine(samples, 3)
    if (cx && cy) transform = (east, north) => [cx[0] * east + cx[1] * north + cx[2], cy[0] * east + cy[1] * north + cy[2]]
  } else {
    // Две точки: сдвиг, поворот и масштаб без перекоса.
    const [first, second] = samples
    const geoE = second[0] - first[0]
    const geoN = second[1] - first[1]
    const planX = second[2] - first[2]
    const planY = second[3] - first[3]
    const geoLength = geoE * geoE + geoN * geoN
    if (geoLength >= 9 && planX * planX + planY * planY > 1e-9) {
      const a = (planX * geoE + planY * geoN) / geoLength
      const b = (planY * geoE - planX * geoN) / geoLength
      transform = (east, north) => {
        const dE = east - first[0]
        const dN = north - first[1]
        return [first[2] + a * dE - b * dN, first[3] + b * dE + a * dN]
      }
    }
  }
  const result = transform && ((coords) => {
    if (!validCoords(coords)) return null
    const point = transform(...toLocal(coords))
    return point.every(Number.isFinite) ? point : null
  })
  transforms.set(anchors, result)
  return result
}

// Сколько единиц плана в одном метре по данным якорей (для круга точности).
export function unitsPerMetre(anchors) {
  const transform = geoTransform(anchors)
  if (!transform) return null
  const [origin] = anchors
  const east = transform({ latitude: origin.latitude, longitude: origin.longitude + 1 / (RAD * EARTH_RADIUS * Math.cos(origin.latitude * RAD)) })
  const north = transform({ latitude: origin.latitude + 1 / (RAD * EARTH_RADIUS), longitude: origin.longitude })
  const base = transform(origin)
  if (!east || !north || !base) return null
  return (Math.hypot(east[0] - base[0], east[1] - base[1]) + Math.hypot(north[0] - base[0], north[1] - base[1])) / 2
}

// Угол на плане (радианы, как atan2 в SVG) для направления по компасу.
export function planAngleForBearing(floor, bearing, anchors = BUILDING_ANCHORS[floor]) {
  const transform = geoTransform(anchors)
  if (!transform || !Number.isFinite(bearing)) return null
  const [origin] = anchors
  const step = 1 / (RAD * EARTH_RADIUS)
  const base = transform(origin)
  const target = transform({
    latitude: origin.latitude + Math.cos(bearing * RAD) * step,
    longitude: origin.longitude + Math.sin(bearing * RAD) * step / Math.cos(origin.latitude * RAD),
  })
  return base && target ? Math.atan2(target[1] - base[1], target[0] - base[0]) : null
}

// Старый вариант для своей привязки из двух точек. Одна точка — только
// отметка, а не слежение: не делаем вид, что она двигается.
export function projectGpsPoint(coords, anchors) {
  if (!coords || !anchors?.length) return null
  const first = anchors[0]
  if (anchors.length === 1) return { point: [first.x, first.y], mode: 'anchor', radius: null }
  const transform = geoTransform(anchors)
  if (!transform) return { point: [first.x, first.y], mode: 'anchor', radius: null }
  const point = transform(coords)
  if (!point) return null
  return { point, radius: Math.max(0, coords.accuracy || 0) * (unitsPerMetre(anchors) || 0), mode: 'gps' }
}

// Какие точки привязки брать на этаже: свои (если человек привязал две),
// иначе встроенные точки корпуса.
export function anchorsFor(floor, custom = {}) {
  const own = custom[floor] || []
  return own.length === 2 ? { anchors: own, source: 'custom' } : { anchors: BUILDING_ANCHORS[floor] || [], source: 'building' }
}

// Ближайшая точка контура этажа и расстояние до него в метрах — чтобы
// сказать «вы в 40 м от корпуса», когда человек снаружи.
function distanceToPlan(floor, point) {
  const size = planSizes[floor]
  if (!size) return null
  const dx = Math.max(0, -point[0], point[0] - size.width)
  const dy = Math.max(0, -point[1], point[1] - size.height)
  return Math.hypot(dx, dy) * (METRES_PER_UNIT[floor] || 0.0833)
}

// Положение по GPS на плане этажа. inside — точка внутри помещений и коридоров.
// Снаружи возвращаем расстояние до корпуса, а точку не показываем.
export function locateOnPlan(floor, coords, custom = {}) {
  if (!validCoords(coords)) return null
  const { anchors, source } = anchorsFor(floor, custom)
  const transform = geoTransform(anchors)
  const point = transform?.(coords)
  if (!point) return null
  const perMetre = unitsPerMetre(anchors) || 1 / (METRES_PER_UNIT[floor] || 0.0833)
  const radius = Math.max(0, coords.accuracy || 0) * perMetre
  if (isInsidePlan(floor, point, rooms)) return { floor, point, radius, mode: 'gps', source, inside: true, snapped: false, distance: 0 }
  // GPS в здании ошибается на 5–30 м, и точка часто падает во двор или на
  // крышу пустого места плана. Если корпус в пределах точности, ставим метку в
  // ближайший коридор или кабинет и честно пишем, что положение примерное.
  const reach = Math.max(Math.min(coords.accuracy || 0, GPS_SHOW_LIMIT), 12) * perMetre
  const nearest = nearestInside(floor, point, reach)
  if (nearest) return { floor, point: nearest, radius, mode: 'gps', source, inside: true, snapped: true, distance: Math.hypot(nearest[0] - point[0], nearest[1] - point[1]) / perMetre }
  return { floor, point, radius, mode: 'gps', source, inside: false, snapped: false, distance: distanceToPlan(floor, point) }
}

// Ближайшая точка внутри помещений и коридоров: обходим кольца вокруг точки.
export function nearestInside(floor, [x, y], maxDistance) {
  const step = 5
  for (let r = step; r <= maxDistance; r += step) {
    const count = Math.max(8, Math.ceil(2 * Math.PI * r / step))
    let best = null
    for (let i = 0; i < count; i += 1) {
      const angle = i / count * 2 * Math.PI
      const candidate = [x + Math.cos(angle) * r, y + Math.sin(angle) * r]
      if (isInsidePlan(floor, candidate, rooms)) { best = candidate; break }
    }
    if (best) return best
  }
  return null
}

export function gpsPointOnPlan(floor, coords, anchors) {
  const projection = projectGpsPoint(coords, anchors[floor])
  if (!projection || !isInsidePlan(floor, projection.point, rooms)) return null
  return { ...projection, floor }
}

// Сглаживание как PositionSmoother в приложении: простой фильтр Калмана, где
// человек идёт не быстрее 1,6 м/с. Резкий скачок при хорошей точности
// принимаем сразу, иначе метку тянет плавно.
export function createPositionSmoother({ walkingSpeed = 1.6, resetAfterMs = 30_000 } = {}) {
  let state = null
  return {
    reset() { state = null },
    update(floor, [x, y], accuracy, timeMs) {
      const scale = METRES_PER_UNIT[floor] || 0.0833
      const sigma = Number.isFinite(accuracy) && accuracy > 0 ? Math.max(accuracy, 1) : 15
      const measurement = sigma * sigma
      const elapsed = state ? timeMs - state.time : 0
      if (!state || state.floor !== floor || elapsed < 0 || elapsed > resetAfterMs) {
        state = { floor, x, y, variance: measurement, time: timeMs }
        return [x, y]
      }
      const travel = walkingSpeed * elapsed / 1000
      const predicted = state.variance + travel * travel + 0.25
      const jump = Math.hypot(x - state.x, y - state.y) * scale
      if (jump > 3 * Math.sqrt(predicted + measurement) && sigma <= Math.sqrt(predicted)) {
        state = { floor, x, y, variance: measurement, time: timeMs }
        return [x, y]
      }
      const gain = predicted / (predicted + measurement)
      state = { floor, x: state.x + gain * (x - state.x), y: state.y + gain * (y - state.y), variance: (1 - gain) * predicted, time: timeMs }
      return [state.x, state.y]
    },
  }
}

// Чему верить, когда есть и GPS, и Bluetooth-маячки. Маячок рядом надёжнее GPS
// под крышей и знает этаж, поэтому берём его, если замер свежий и GPS нет,
// он слабый (хуже BLE_PREFER_OVER м) или грубее маячков. Иначе — GPS, если
// точка внутри корпуса и точность лучше GPS_SHOW_LIMIT.
export const BLE_PREFER_OVER = 12

export function choosePosition({ gps = null, accuracy = null, ble = null, now = Date.now(), freshMs = 8000 } = {}) {
  const bleOk = Boolean(ble && now - ble.at <= freshMs)
  const gpsOk = Boolean(gps && gps.inside && Number.isFinite(accuracy) && accuracy <= GPS_SHOW_LIMIT)
  if (bleOk && (!gpsOk || accuracy > BLE_PREFER_OVER || ble.accuracy <= accuracy)) {
    return { source: 'bluetooth', floor: ble.floor, point: ble.point, accuracy: ble.accuracy, snapped: false }
  }
  if (gpsOk) return { source: 'gps', floor: gps.floor, point: gps.point, accuracy, snapped: gps.snapped }
  return null
}
