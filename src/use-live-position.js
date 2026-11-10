import { useEffect, useMemo, useRef, useState } from 'react'
import { useBluetooth } from './bluetooth-location.js'
import { METRES_PER_UNIT, choosePosition, createPositionSmoother, locateOnPlan, planAngleForBearing } from './map-location.js'
import { useCompass, useGeolocation } from './use-location.js'

// Где человек прямо сейчас — для карты («Где я») и ведения по маршруту.
// Складывает GPS, компас и Bluetooth-маячки: когда GPS слабый или его нет, а
// рядом слышно маячок, место берётся по нему (choosePosition в map-location.js).
// floor — этаж, который сейчас на экране: GPS этаж не знает, маячки знают.
//
// Возвращает:
//   marker  — точка для плана { floor, point, radius, mode, heading, accuracy, source } или null
//   gps     — состояние геолокации (status, coords)
//   located — что получилось из GPS на этом этаже (inside, distance…), для сообщений
//   ble     — состояние Bluetooth (status, fix, heard)
export function useLivePosition(enabled, floor, gpsAnchors) {
  const gps = useGeolocation(enabled)
  const compass = useCompass(enabled)
  const ble = useBluetooth()
  const smoother = useRef(createPositionSmoother())
  const [state, setState] = useState({ located: null, position: null })

  useEffect(() => {
    if (!enabled) { smoother.current.reset(); setState({ located: null, position: null }); return }
    const located = gps.status === 'active' && gps.coords ? locateOnPlan(floor, gps.coords, gpsAnchors) : null
    const choice = choosePosition({ gps: located, accuracy: gps.coords?.accuracy, ble: ble.fix })
    if (!choice) { smoother.current.reset(); setState({ located, position: null }); return }
    const at = choice.source === 'bluetooth' ? ble.fix.at : gps.at
    const point = smoother.current.update(choice.floor, choice.point, choice.accuracy, at)
    setState({ located, position: { ...choice, point } })
  }, [enabled, floor, gpsAnchors, gps.status, gps.coords, gps.at, ble.fix])

  const marker = useMemo(() => {
    const position = state.position
    if (!position) return null
    return {
      floor: position.floor,
      point: position.point,
      radius: position.accuracy / (METRES_PER_UNIT[position.floor] || 0.0833),
      mode: 'gps', // так план рисует «живую» метку с кругом точности
      source: position.source,
      accuracy: position.accuracy,
      snapped: position.snapped,
      inside: true,
      heading: Number.isFinite(compass) ? planAngleForBearing(position.floor, compass) : null,
    }
  }, [state.position, compass])

  return { marker, gps, located: state.located, ble, compassHeading: compass }
}
