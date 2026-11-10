import { useSyncExternalStore } from 'react'
import { rooms } from './data.js'
import { planRoomBounds, roomAccess } from './map-geometry.js'
import { getSiteSettings } from './site-settings.js'

// Место в здании по Bluetooth-маячкам. GPS под крышей ошибается на 5–30 м и не
// знает этаж, а маячок у двери слышно только рядом: по силе его сигнала (RSSI)
// видно, как далеко до него. Где какой маячок висит, команда записывает в
// панели /admin/settings (имя маячка → помещение).
//
// Что умеют браузеры (Web Bluetooth):
//   • Chrome и другие Chromium на Android и компьютере слушают эфир через
//     navigator.bluetooth.requestLEScan — пока это экспериментальная функция,
//     её включают в chrome://flags → «Experimental Web Platform features».
//   • Там, где есть только выбор одного устройства (watchAdvertisements),
//     следим за одним ближайшим маячком.
//   • Safari и все браузеры на iPhone сайту Bluetooth не дают — остаётся GPS.
// Поэтому Bluetooth здесь — уточнение, а не замена: нет поддержки или маячков —
// всё работает как раньше.

export const BLE_FRESH_MS = 8000 // маячок, который молчит дольше, не учитываем
const IBEACON_COMPANY = 0x004c

// Расстояние до маячка в метрах по силе сигнала. tx — RSSI на расстоянии 1 м
// (пишут на маячке или в его приложении, обычно около −59), n — насколько
// быстро сигнал гаснет в коридоре со стенами.
export function rssiToMetres(rssi, tx = -59, n = 2.4) {
  if (!Number.isFinite(rssi)) return null
  return Math.max(0.3, Math.min(40, 10 ** ((tx - rssi) / (10 * n))))
}

// RSSI скачет на ±6 дБ от замера к замеру, поэтому усредняем.
export function smoothRssi(previous, rssi, k = 0.35) {
  return Number.isFinite(previous) ? previous + k * (rssi - previous) : rssi
}

export const beaconKey = (id) => String(id || '').trim().toLowerCase()

// iBeacon в «данных производителя» Apple: 02 15, UUID, major, minor, мощность.
// Возвращаем «uuid:major:minor» — так маячок записывают в панели.
export function ibeaconId(view) {
  if (!view || view.byteLength < 23 || view.getUint8(0) !== 0x02 || view.getUint8(1) !== 0x15) return null
  let hex = ''
  for (let index = 2; index < 18; index += 1) hex += view.getUint8(index).toString(16).padStart(2, '0')
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  return `${uuid}:${view.getUint16(18)}:${view.getUint16(20)}`
}

// Где маячок на плане: у двери своего помещения, а если двери в данных нет —
// в его середине.
export function beaconPoint(beacon) {
  const room = rooms.find((item) => item.id === beacon.roomId)
  if (!room) return null
  const door = roomAccess[room.id]?.door
  if (door) return { floor: room.floor, point: [door[0], door[1]] }
  const box = planRoomBounds[room.id]
  return box ? { floor: room.floor, point: [box[0] + box[2] / 2, box[1] + box[3] / 2] } : null
}

// Место по свежим замерам. readings — { ключ маячка: { rssi, at } }.
// Этаж берём у самого близкого маячка, точку — как среднее маячков этого
// этажа с весом 1/d²: ближний тянет сильнее. Один маячок — стоим рядом с ним.
export function beaconFix(readings, beacons, now = Date.now()) {
  const heard = []
  for (const beacon of beacons) {
    const reading = readings[beaconKey(beacon.id)]
    const place = beaconPoint(beacon)
    if (!reading || !place || now - reading.at > BLE_FRESH_MS) continue
    const metres = rssiToMetres(reading.rssi, beacon.tx)
    if (metres !== null) heard.push({ ...place, metres, at: reading.at, roomId: beacon.roomId })
  }
  if (!heard.length) return null
  heard.sort((a, b) => a.metres - b.metres)
  const floor = heard[0].floor
  const near = heard.filter((item) => item.floor === floor).slice(0, 4)
  let weight = 0
  let x = 0
  let y = 0
  for (const item of near) {
    const w = 1 / (item.metres * item.metres)
    weight += w
    x += item.point[0] * w
    y += item.point[1] * w
  }
  // Точность: с одним маячком знаем только «в стольких метрах от него»,
  // с несколькими — заметно лучше, но не точнее пары метров.
  const accuracy = near.length === 1 ? Math.max(2, Math.min(25, heard[0].metres)) : Math.max(2, Math.min(12, heard[0].metres * 0.7))
  return { floor, point: [x / weight, y / weight], accuracy, count: near.length, nearest: heard[0].roomId, at: Math.max(...near.map((item) => item.at)) }
}

// ---------- Работа с браузером ----------

export function bluetoothSupport(nav = globalThis.navigator, Device = globalThis.BluetoothDevice) {
  const bluetooth = nav?.bluetooth
  if (!bluetooth || globalThis.isSecureContext === false) return 'none'
  if (typeof bluetooth.requestLEScan === 'function') return 'scan'
  if (typeof bluetooth.requestDevice === 'function' && typeof Device?.prototype?.watchAdvertisements === 'function') return 'device'
  return 'none'
}

let state = { status: 'off', fix: null, heard: 0, error: '' }
let readings = {}
let stopScan = null
let timer = 0
const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
const setState = (patch) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()) }

function refresh() {
  const now = Date.now()
  const fix = beaconFix(readings, getSiteSettings().beacons, now)
  const heard = Object.values(readings).filter((reading) => now - reading.at <= BLE_FRESH_MS).length
  if (heard !== state.heard || fix?.at !== state.fix?.at || Boolean(fix) !== Boolean(state.fix)) setState({ fix, heard })
}

function onAdvertisement(event) {
  if (!Number.isFinite(event.rssi)) return
  const known = new Set(getSiteSettings().beacons.map((beacon) => beaconKey(beacon.id)))
  const ids = [beaconKey(event.name || event.device?.name), beaconKey(ibeaconId(event.manufacturerData?.get?.(IBEACON_COMPANY)))]
  for (const id of ids) {
    if (!id || !known.has(id)) continue
    readings[id] = { rssi: smoothRssi(readings[id]?.rssi, event.rssi), at: Date.now() }
  }
  refresh()
}

// Вызывать только из обработчика нажатия: браузер спрашивает разрешение.
export async function enableBluetooth() {
  if (state.status === 'on' || state.status === 'starting') return state.status
  const support = bluetoothSupport()
  if (support === 'none') { setState({ status: 'unsupported' }); return 'unsupported' }
  const beacons = getSiteSettings().beacons
  if (!beacons.length) { setState({ status: 'no-beacons' }); return 'no-beacons' }
  setState({ status: 'starting', error: '' })
  try {
    const bluetooth = navigator.bluetooth
    if (support === 'scan') {
      const scan = await bluetooth.requestLEScan({ acceptAllAdvertisements: true, keepRepeatedDevices: true })
      bluetooth.addEventListener('advertisementreceived', onAdvertisement)
      stopScan = () => { bluetooth.removeEventListener('advertisementreceived', onAdvertisement); try { scan.stop() } catch { /* уже остановлен */ } }
    } else {
      // Один маячок на выбор: по имени из списка; iBeacon без имени так не найти.
      const names = beacons.map((beacon) => beacon.id).filter((id) => !/^[0-9a-f-]{36}:\d+:\d+$/i.test(id))
      const device = await bluetooth.requestDevice(names.length ? { filters: names.map((name) => ({ name })), optionalManufacturerData: [IBEACON_COMPANY] } : { acceptAllDevices: true, optionalManufacturerData: [IBEACON_COMPANY] })
      const abort = new AbortController()
      device.addEventListener('advertisementreceived', onAdvertisement)
      await device.watchAdvertisements({ signal: abort.signal })
      stopScan = () => { device.removeEventListener('advertisementreceived', onAdvertisement); abort.abort() }
    }
    timer = window.setInterval(refresh, 2000)
    setState({ status: 'on' })
    return 'on'
  } catch (error) {
    // NotFoundError — человек закрыл окно выбора, NotAllowedError — запретил.
    const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
    setState({ status: denied ? 'denied' : error?.name === 'NotFoundError' ? 'off' : 'error', error: error?.message || '' })
    return state.status
  }
}

export function disableBluetooth() {
  stopScan?.()
  stopScan = null
  window.clearInterval(timer)
  readings = {}
  setState({ status: 'off', fix: null, heard: 0, error: '' })
}

export function getBluetoothState() { return state }

const serverState = { status: 'off', fix: null, heard: 0, error: '' }
export function useBluetooth() {
  return useSyncExternalStore(subscribe, getBluetoothState, () => serverState)
}
