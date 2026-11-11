import test from 'node:test'
import assert from 'node:assert/strict'
import { beaconFix, beaconPoint, bluetoothSupport, ibeaconId, rssiToMetres, smoothRssi } from './bluetooth-location.js'
import { isOffRoute, liveStepIndex, pointAtDistance, projectOnRoute, routeLengths, sensorProgress } from './live-route.js'
import { createStepDetector } from './step-sensor.js'
import { choosePosition } from './map-location.js'
import { cleanSettings } from './site-settings.js'
import { buildRouteOptions } from './map-routing.js'
import { buildRouteSteps } from './route-steps.js'

test('signal strength turns into distance: weaker means farther', () => {
  assert.equal(rssiToMetres(-59, -59), 1)
  assert.ok(rssiToMetres(-75, -59) > rssiToMetres(-65, -59))
  assert.ok(rssiToMetres(-83, -59) > 8 && rssiToMetres(-83, -59) < 12)
  assert.equal(rssiToMetres(-20, -59), 0.3, 'вплотную — не ближе 30 см')
  assert.equal(rssiToMetres(-120, -59), 40, 'не дальше 40 м')
  assert.equal(rssiToMetres(undefined), null)
  assert.equal(smoothRssi(undefined, -70), -70)
  assert.ok(smoothRssi(-70, -60) < -60 && smoothRssi(-70, -60) > -70, 'скачок сглаживается')
})

test('iBeacon frames are read as uuid:major:minor', () => {
  const bytes = [0x02, 0x15, 0xf7, 0x82, 0x6d, 0xa6, 0x4f, 0xa2, 0x4e, 0x98, 0x80, 0x24, 0xbc, 0x5b, 0x71, 0xe0, 0x89, 0x3e, 0x00, 0x01, 0x00, 0x2a, 0xc5]
  assert.equal(ibeaconId(new DataView(new Uint8Array(bytes).buffer)), 'f7826da6-4fa2-4e98-8024-bc5b71e0893e:1:42')
  assert.equal(ibeaconId(new DataView(new Uint8Array([1, 2, 3]).buffer)), null)
  assert.equal(ibeaconId(undefined), null)
})

test('beacons place you on the plan: nearest decides the floor, old readings are dropped', () => {
  const beacons = cleanSettings({ beacons: [{ id: 'LOGOS-211', roomId: 'physics-211' }, { id: 'logos-214', roomId: 'library-214', tx: -62 }, { id: 'LOGOS-CANTEEN', roomId: 'canteen' }, { id: 'ghost', roomId: 'no-such-room' }, { id: 'logos-211', roomId: 'canteen' }] }).beacons
  assert.deepEqual(beacons.map((beacon) => beacon.id), ['LOGOS-211', 'logos-214', 'LOGOS-CANTEEN'], 'неизвестное помещение и повтор имени отброшены')
  assert.equal(beacons[0].tx, -59)
  const now = 1_000_000
  assert.equal(beaconFix({}, beacons, now), null)
  // Один маячок: стоим у его двери, точность — расстояние до него.
  const one = beaconFix({ 'logos-211': { rssi: -59, at: now } }, beacons, now)
  assert.equal(one.floor, 2)
  assert.deepEqual(one.point, beaconPoint(beacons[0]).point)
  assert.equal(one.count, 1)
  assert.equal(one.accuracy, 2)
  // Два маячка на этаже: точка между ними, ближе к тому, что слышно лучше.
  const [a, b] = [beaconPoint(beacons[0]).point, beaconPoint(beacons[1]).point]
  const two = beaconFix({ 'logos-211': { rssi: -60, at: now }, 'logos-214': { rssi: -80, at: now } }, beacons, now)
  assert.ok(Math.hypot(two.point[0] - a[0], two.point[1] - a[1]) < Math.hypot(two.point[0] - b[0], two.point[1] - b[1]))
  // Маячок первого этажа слышно слабее: этаж остаётся вторым.
  assert.equal(beaconFix({ 'logos-211': { rssi: -62, at: now }, 'logos-canteen': { rssi: -85, at: now } }, beacons, now).floor, 2)
  assert.equal(beaconFix({ 'logos-211': { rssi: -60, at: now - 9000 } }, beacons, now), null, 'замер старше 8 секунд не считается')
})

test('the browser check never throws without Web Bluetooth', () => {
  assert.equal(bluetoothSupport({}, undefined), 'none')
  assert.equal(bluetoothSupport({ bluetooth: { requestLEScan() {} } }, undefined), 'scan')
  assert.equal(bluetoothSupport({ bluetooth: { requestDevice() {} } }, function Device() {}), 'none')
})

test('Bluetooth takes over when GPS is weak or missing, GPS stays when it is good', () => {
  const now = 50_000
  const gps = { floor: 1, point: [300, 168], inside: true, snapped: false }
  const ble = { floor: 2, point: [200, 168], accuracy: 3, at: now - 1000 }
  assert.equal(choosePosition({ gps, accuracy: 6, now }).source, 'gps')
  assert.equal(choosePosition({ gps, accuracy: 35, ble, now }).source, 'bluetooth', 'слабый GPS — берём маячок')
  assert.equal(choosePosition({ gps, accuracy: 35, ble, now }).floor, 2, 'этаж знает только маячок')
  assert.equal(choosePosition({ ble, now }).source, 'bluetooth', 'GPS нет вовсе')
  assert.equal(choosePosition({ gps, accuracy: 8, ble: { ...ble, accuracy: 3 }, now }).source, 'bluetooth', 'маячок точнее')
  assert.equal(choosePosition({ gps, accuracy: 4, ble: { ...ble, accuracy: 9 }, now }).source, 'gps', 'GPS точнее')
  assert.equal(choosePosition({ gps, accuracy: 35, ble: { ...ble, at: now - 20_000 }, now }).source, 'gps', 'маячок давно молчит')
  assert.equal(choosePosition({ gps, accuracy: 80, now }), null, 'GPS хуже 50 м не показываем')
  assert.equal(choosePosition({ gps: { ...gps, inside: false }, accuracy: 8, now }), null, 'снаружи метки нет')
})

test('position is projected onto the route line', () => {
  const points = [[0, 0], [100, 0], [100, 50]]
  assert.deepEqual(routeLengths(points), [0, 100, 150])
  const mid = projectOnRoute(points, [40, 6])
  assert.deepEqual([mid.along, mid.offset, mid.point, mid.total, mid.segment], [40, 6, [40, 0], 150, 0])
  assert.equal(projectOnRoute(points, [104, 30]).along, 130)
  assert.equal(projectOnRoute(points, [-20, 0]).along, 0, 'до начала пути')
  assert.equal(projectOnRoute([], [0, 0]), null)
  assert.equal(isOffRoute(60, 1, 5), false, '5 м от линии — ещё на маршруте')
  assert.equal(isOffRoute(180, 1, 5), true, '15 м при хорошем сигнале — ушли')
  assert.equal(isOffRoute(180, 1, 20), false, 'при точности ±20 м 15 м — не повод перестраивать')
})

test('steps advance as the walker reaches each turn, never backwards or across floors', () => {
  const route = buildRouteOptions('entrance-1', 'physics-211')[0]
  const steps = buildRouteSteps({ startLabel: 'Главный вход', startFloor: 1, targetFloor: 2, targetName: 'Кабинет физики №211', route, sameRoom: false })
  const lower = route.byFloor[1].points
  const lengths = routeLengths(lower)
  const transfer = steps.findIndex((step) => step.kind === 'transfer')
  assert.ok(transfer > 0)
  assert.equal(liveStepIndex(steps, 0, lower, 0, { floor: 1, accuracy: 5 }), steps[1].progress === 0 ? 1 : 0, 'в начале пути стоим на первом шаге')
  // Дошли до лестницы: шаг «Поднимитесь», но не шаги второго этажа.
  assert.equal(liveStepIndex(steps, 0, lower, lengths.at(-1), { floor: 1, accuracy: 5 }), transfer)
  assert.equal(liveStepIndex(steps, transfer, lower, lengths.at(-1), { floor: 1, accuracy: 5 }), transfer, 'на другой этаж сами не листаем')
  assert.equal(liveStepIndex(steps, transfer, lower, 0, { floor: 1, accuracy: 5 }), transfer, 'назад не листаем')
  // За 10 м до лестницы шаг перехода ещё не наступил.
  const before = liveStepIndex(steps, 0, lower, lengths.at(-1) - 120, { floor: 1, accuracy: 5 })
  assert.ok(before < transfer)
  // На втором этаже у двери — «Приход».
  const upper = route.byFloor[2].points
  assert.equal(liveStepIndex(steps, transfer, upper, routeLengths(upper).at(-1), { floor: 2, accuracy: 5 }), steps.length - 1)
})

// Запись акселерометра: покой — 9,81 с лёгким шумом, ходьба — толчки два раза в секунду.
function feed(detector, seconds, from, walking) {
  let steps = 0
  for (let ms = 0; ms < seconds * 1000; ms += 16) {
    const t = from + ms
    const magnitude = 9.81 + (walking ? 3 * Math.max(0, Math.sin(2 * Math.PI * 2 * t / 1000)) ** 3 : 0.15 * Math.sin(t / 37))
    steps += detector.push(magnitude, t)
  }
  return steps
}

test('the step sensor counts a walk and ignores a phone lying still or a single bump', () => {
  const still = createStepDetector()
  assert.equal(feed(still, 10, 0, false), 0, 'телефон лежит — шагов нет')
  const walk = createStepDetector()
  feed(walk, 2, 0, false)
  const steps = feed(walk, 10, 2000, true)
  assert.ok(steps >= 18 && steps <= 21, `10 секунд ходьбы по 2 шага в секунду: ${steps}`)
  const bump = createStepDetector()
  feed(bump, 2, 0, false)
  let counted = 0
  for (let ms = 0; ms < 300; ms += 16) counted += bump.push(9.81 + 4, 2000 + ms)
  counted += feed(bump, 5, 2300, false)
  assert.equal(counted, 0, 'одиночный толчок — не шаг')
  assert.equal(createStepDetector().push(NaN, 0), 0)
})

test('without GPS the marker moves along the route by counted steps', () => {
  const points = [[0, 0], [120, 0], [120, 60]]
  assert.deepEqual(pointAtDistance(points, 60), { point: [60, 0], segment: 0 })
  assert.deepEqual(pointAtDistance(points, 150), { point: [120, 30], segment: 1 })
  assert.deepEqual(pointAtDistance(points, 999).point, [120, 60], 'дальше конца пути не уходим')
  assert.equal(pointAtDistance([], 10), null)
  // 10 шагов по 0,7 м от отметки: 7 метров, это около 84 единиц плана первого этажа.
  const progress = sensorProgress({ along: 20, steps: 5 }, 15, 1, 180)
  assert.ok(Math.abs(progress.walked - 7) < 1e-9)
  assert.ok(Math.abs(progress.along - (20 + 7 / 0.08332894)) < 1e-6)
  assert.ok(progress.accuracy > 3, 'чем дальше от отметки, тем грубее')
  assert.equal(sensorProgress({ along: 20, steps: 5 }, 500, 1, 180).along, 180)
  assert.equal(sensorProgress({ along: 20, steps: 5 }, 3, 1, 180).along, 20, 'назад не идём')
})
