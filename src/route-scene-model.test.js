import test from 'node:test'
import assert from 'node:assert/strict'
import { cameraTransform, clampCamera, flyDuration, flyFrame, projectPoint, fitCamera, headingYaw, nearestAngle, panCamera, pathData, pinchCamera, pathHeading, screenToPlanDelta, zoomCamera, ZOOM_MAX, ZOOM_MIN } from './route-scene-model.js'

const size = { width: 758, height: 552 }
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)

test('drag moves the plan with the finger at any rotation and zoom', () => {
  const flat = { x: 300, y: 200, zoom: 2, tilt: 0, yaw: 0 }
  const moved = panCamera(flat, 40, -20, size)
  near(moved.x, 280)
  near(moved.y, 210)
  // Камера повёрнута на 90°: сдвиг вправо по экрану — это сдвиг вверх по плану.
  const [dx, dy] = screenToPlanDelta({ ...flat, yaw: 90, zoom: 1 }, 10, 0)
  near(dx, 0)
  near(dy, -10)
  // Наклон растягивает вертикальный сдвиг: экран сжат в cos(tilt).
  const [, ty] = screenToPlanDelta({ ...flat, zoom: 1, tilt: 60 }, 0, 10)
  near(ty, 20)
})

test('zoom keeps the point under the cursor and stays within limits', () => {
  const camera = { x: 300, y: 200, zoom: 1, tilt: 0, yaw: 0 }
  const zoomed = zoomCamera(camera, 2, [100, 0], size)
  near(zoomed.zoom, 2)
  near(zoomed.x, 350) // точка в 100 px правее центра (x = 400) осталась под курсором
  assert.equal(zoomCamera(camera, 100, [0, 0], size).zoom, ZOOM_MAX)
  assert.equal(zoomCamera(camera, 0.001, [0, 0], size).zoom, ZOOM_MIN)
  const clamped = clampCamera({ x: -50, y: 9999, zoom: 1, tilt: 120, yaw: 0 }, size)
  assert.deepEqual([clamped.x, clamped.y, clamped.tilt], [0, size.height, 70])
})

test('overview frames the whole route and short routes keep context', () => {
  const route = [[100, 100], [500, 100], [500, 300]]
  const camera = fitCamera(route, { width: 800, height: 500 }, { padding: 50 })
  assert.deepEqual([camera.x, camera.y], [300, 200])
  near(camera.zoom, 1.6) // ширина 400 + поля 100 = 500 единиц на 800 px
  const short = fitCamera([[100, 100], [120, 100]], { width: 800, height: 500 }, { padding: 50, minSpan: 380 })
  assert.ok(short.zoom < 2, String(short.zoom))
})

test('heading-up camera turns the shortest way', () => {
  const path = [[0, 0], [100, 0], [100, 100]]
  assert.equal(pathHeading(path, 0), 0)
  assert.equal(pathHeading(path, 1), 90)
  assert.equal(pathHeading(path, 2), 90)
  assert.equal(pathHeading([[0, 0]], 0), null)
  assert.equal(headingYaw(0), -90) // путь вправо → поворачиваем план, чтобы он шёл вверх
  assert.equal(headingYaw(90, 170), 180)
  assert.equal(nearestAngle(-170, 170), 190)
  assert.equal(headingYaw(null, 33), 33)
})

test('camera transform and path data are plain CSS/SVG strings', () => {
  assert.equal(cameraTransform({ x: 10, y: 20, zoom: 1.5, tilt: 52, yaw: -18 }, [400, 250]), 'translate3d(400px, 250px, 0) rotateX(52deg) rotateZ(-18deg) scale(1.5) translate3d(-10px, -20px, 0)')
  assert.equal(pathData([[1, 2], [3.14159, 4]]), 'M1 2 L3.142 4')
  assert.equal(pathData([]), '')
})

test('labels are projected to the same place as the 3D floor point', () => {
  const center = [400, 250]
  const flat = { x: 100, y: 100, zoom: 2, tilt: 0, yaw: 0 }
  assert.deepEqual(projectPoint(flat, center, [110, 100]), [420, 250])
  const [, y] = projectPoint({ ...flat, tilt: 60 }, center, [100, 100, 10])
  assert.ok(y < 250) // поднятая над полом точка на наклонённом плане выше на экране
  const [farX] = projectPoint({ ...flat, tilt: 60 }, center, [100, 50], { origin: [400, 200] })
  near(farX, 400)
})

test('camera flight starts and ends exactly, eases, and lifts on long jumps', () => {
  const from = { x: 0, y: 0, zoom: 2, tilt: 52, yaw: 170 }
  const to = { x: 600, y: 0, zoom: 2, tilt: 52, yaw: -170 }
  assert.deepEqual(flyFrame(from, to, 0), from)
  const end = flyFrame(from, to, 1)
  assert.deepEqual([end.x, end.zoom, end.yaw], [600, 2, 190]) // поворот на 20°, а не на 340°
  const mid = flyFrame(from, to, 0.5)
  near(mid.x, 300)
  assert.ok(mid.zoom < 2) // в середине перелёта камера отдаляется
  assert.ok(flyFrame(from, to, 0.1).x < 60) // мягкий разгон
  assert.ok(flyDuration(from, to) > flyDuration(from, { ...from, x: 10 }))
  assert.ok(flyDuration(from, to) <= 1700)
})

test('pinch: spreading fingers zooms in, pinching zooms out, rotation only in 3D', () => {
  const camera = { x: 300, y: 200, zoom: 1, tilt: 0, yaw: 0 }
  const finger = (distance, angle = 0) => ({ distance, angle, center: [200, 200] })
  assert.ok(pinchCamera(camera, finger(100), finger(150), [0, 0], size).zoom > 1)
  assert.ok(pinchCamera(camera, finger(150), finger(100), [0, 0], size).zoom < 1)
  assert.equal(pinchCamera(camera, finger(100), finger(100, 0.5), [0, 0], size).yaw, 0)
  near(pinchCamera(camera, finger(100), finger(100, Math.PI / 2), [0, 0], size, true).yaw, 90)
})

test('zoom out stops where the whole floor is still readable', () => {
  assert.ok(ZOOM_MIN >= 0.45)
  near(zoomCamera({ x: 300, y: 200, zoom: 1, tilt: 0, yaw: 0 }, 0.01, [0, 0], size).zoom, ZOOM_MIN)
})
