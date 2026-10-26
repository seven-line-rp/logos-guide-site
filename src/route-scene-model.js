// Камера интерактивной карты маршрута (src/components/RouteScene.jsx).
// План лежит в CSS 3D: камера наводится на точку плана (x, y), наклоняется
// (tilt), поворачивается (yaw) и приближает (zoom). Здесь только математика —
// без React и DOM, её проверяют тесты.

export const TILT_3D = 52
// Меньше 0.45 весь этаж (≈760 px) уже мельче ладони, а сотни 3D-слоёв при сильном
// отдалении перегружают видеопамять телефона: вкладку перезагружает браузер.
export const ZOOM_MIN = 0.45
export const ZOOM_MAX = 4.5
export const FOLLOW_ZOOM = { '3d': 2.1, top: 1.7 }

const RAD = Math.PI / 180
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const round = (value) => Math.round(value * 1000) / 1000

export function cameraTransform(camera, center) {
  const { x, y, zoom, tilt, yaw } = camera
  return `translate3d(${round(center[0])}px, ${round(center[1])}px, 0) rotateX(${round(tilt)}deg) rotateZ(${round(yaw)}deg) scale(${round(zoom)}) translate3d(${round(-x)}px, ${round(-y)}px, 0)`
}

// Угол, ближайший к reference: камера не крутится лишний оборот через ±180°.
export function nearestAngle(angle, reference) {
  return angle + 360 * Math.round((reference - angle) / 360)
}

// Сдвиг на экране (dx, dy в пикселях) → сдвиг в единицах плана. Наклон
// сжимает вертикаль примерно в cos(tilt) раз (перспективу не учитываем).
export function screenToPlanDelta(camera, dx, dy) {
  const squash = Math.max(0.25, Math.cos(camera.tilt * RAD))
  const sx = dx / camera.zoom
  const sy = dy / squash / camera.zoom
  const angle = -camera.yaw * RAD
  return [sx * Math.cos(angle) - sy * Math.sin(angle), sx * Math.sin(angle) + sy * Math.cos(angle)]
}

export function clampCamera(camera, size) {
  return {
    ...camera,
    x: clamp(camera.x, 0, size.width),
    y: clamp(camera.y, 0, size.height),
    zoom: clamp(camera.zoom, ZOOM_MIN, ZOOM_MAX),
    tilt: clamp(camera.tilt, 0, 70),
  }
}

// Палец тянет план: точка под ним едет вместе с ним.
export function panCamera(camera, dx, dy, size) {
  const [px, py] = screenToPlanDelta(camera, dx, dy)
  return clampCamera({ ...camera, x: camera.x - px, y: camera.y - py }, size)
}

// Приближение к точке экрана (offset — от центра кадра): точка под курсором
// остаётся на месте.
export function zoomCamera(camera, factor, offset, size) {
  const zoom = clamp(camera.zoom * factor, ZOOM_MIN, ZOOM_MAX)
  const [px, py] = screenToPlanDelta(camera, offset[0], offset[1])
  const k = 1 - camera.zoom / zoom
  return clampCamera({ ...camera, zoom, x: camera.x + px * k, y: camera.y + py * k }, size)
}

// Щипок двумя пальцами: prev и next — состояния пальцев до и после движения
// ({ distance, angle, center }); offset — центр щипка относительно центра кадра.
// Пальцы расходятся — приближаем, сходятся — отдаляем; в 3D ещё и поворачиваем.
export function pinchCamera(camera, prev, next, offset, size, rotate = false) {
  let value = zoomCamera(camera, next.distance / prev.distance, offset, size)
  value = panCamera(value, next.center[0] - prev.center[0], next.center[1] - prev.center[1], size)
  return rotate ? { ...value, yaw: value.yaw + (next.angle - prev.angle) * 180 / Math.PI } : value
}

// Камера, в которую целиком помещаются точки (маршрут этажа) с отступом.
export function fitCamera(points, viewport, { tilt = 0, yaw = 0, padding = 70, size = null, minSpan = 0 } = {}) {
  const list = points?.length ? points : size ? [[0, 0], [size.width, size.height]] : [[0, 0]]
  const angle = yaw * RAD
  const rotated = list.map(([x, y]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)])
  const xs = rotated.map((point) => point[0])
  const ys = rotated.map((point) => point[1])
  // Короткий путь не приближаем вплотную: вокруг должно быть видно здание.
  const width = Math.max(minSpan, Math.max(...xs) - Math.min(...xs)) + padding * 2
  const height = (Math.max(minSpan * 0.7, Math.max(...ys) - Math.min(...ys)) + padding * 2) * Math.max(0.3, Math.cos(tilt * RAD))
  const zoom = clamp(Math.min(viewport.width / width, viewport.height / height), ZOOM_MIN, 2.6)
  const x = (Math.min(...list.map((point) => point[0])) + Math.max(...list.map((point) => point[0]))) / 2
  const y = (Math.min(...list.map((point) => point[1])) + Math.max(...list.map((point) => point[1]))) / 2
  return { x, y, zoom, tilt, yaw }
}

// Направление пути в вершине index (в градусах, 0 — вправо по плану).
export function pathHeading(points, index) {
  if (!points?.length || points.length < 2) return null
  const i = clamp(index ?? 0, 0, points.length - 1)
  const [a, b] = i < points.length - 1 ? [points[i], points[i + 1]] : [points[i - 1], points[i]]
  return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD
}

// Поворот камеры «по ходу движения»: путь уходит вверх экрана.
export function headingYaw(heading, reference = 0) {
  return heading === null ? reference : nearestAngle(-90 - heading, reference)
}

export function pathLength(points) {
  let total = 0
  for (let index = 1; index < (points?.length || 0); index += 1) total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1])
  return total
}

export function pathData(points) {
  return points?.length ? `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L')}` : ''
}

// Точка плана (x, y, высота z) → координаты на экране сцены. Повторяет
// преобразование камеры и перспективу CSS, чтобы подписи можно было
// рисовать плоским слоем поверх 3D: так их не перекрывают стены.
export function projectPoint(camera, center, [x, y, z = 0], { perspective = 1500, origin = center } = {}) {
  const vx = (x - camera.x) * camera.zoom
  const vy = (y - camera.y) * camera.zoom
  const vz = z * camera.zoom
  const yaw = camera.yaw * RAD
  const tilt = camera.tilt * RAD
  const rx = vx * Math.cos(yaw) - vy * Math.sin(yaw)
  const ry = vx * Math.sin(yaw) + vy * Math.cos(yaw)
  const py = ry * Math.cos(tilt) - vz * Math.sin(tilt)
  const pz = ry * Math.sin(tilt) + vz * Math.cos(tilt)
  const sx = center[0] + rx
  const sy = center[1] + py
  const k = perspective / Math.max(1, perspective - pz)
  return [origin[0] + (sx - origin[0]) * k, origin[1] + (sy - origin[1]) * k]
}

// ---------- Плавный полёт камеры ----------
// Камера не «телепортируется» CSS-переходом между двумя матрицами, а летит
// покадрово: координаты, поворот и наклон меняются с мягким разгоном и
// торможением, а на длинных перелётах камера чуть отдаляется в середине пути,
// как в картах, — так видно, откуда и куда она летит.
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export function flyDuration(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y) * Math.max(from.zoom, to.zoom)
  const turn = Math.abs(nearestAngle(to.yaw, from.yaw) - from.yaw)
  const zoom = Math.abs(Math.log(to.zoom / from.zoom))
  return clamp(650 + distance * 0.9 + turn * 3 + zoom * 380, 650, 1700)
}

export function flyFrame(from, to, t) {
  const k = clamp(t, 0, 1)
  const e = easeInOut(k)
  const mix = (a, b) => a + (b - a) * e
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const lift = Math.min(0.3, distance / 900) * Math.sin(Math.PI * k)
  return {
    x: mix(from.x, to.x),
    y: mix(from.y, to.y),
    zoom: mix(from.zoom, to.zoom) * (1 - lift),
    tilt: mix(from.tilt, to.tilt),
    yaw: mix(from.yaw, nearestAngle(to.yaw, from.yaw)),
  }
}
