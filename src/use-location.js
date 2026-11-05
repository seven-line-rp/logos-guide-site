import { useEffect, useRef, useState } from 'react'

// Слежение за GPS и компасом для карты. Логика как в Android-приложении:
// свежие координаты с высокой точностью, без старых кэшированных точек;
// если за 20 секунд ничего не пришло — честно говорим об этом.

const FIRST_FIX_TIMEOUT = 20_000
const MAX_FIX_AGE = 15_000

export function useGeolocation(enabled) {
  const [state, setState] = useState({ status: 'idle', coords: null, at: 0 })
  useEffect(() => {
    if (!enabled) { setState({ status: 'idle', coords: null, at: 0 }); return undefined }
    if (typeof window === 'undefined' || !window.isSecureContext || !navigator.geolocation) {
      setState({ status: 'unsupported', coords: null, at: 0 })
      return undefined
    }
    let gotFix = false
    setState({ status: 'loading', coords: null, at: 0 })
    const timer = window.setTimeout(() => { if (!gotFix) setState((current) => current.coords ? current : { ...current, status: 'timeout' }) }, FIRST_FIX_TIMEOUT)
    const onFix = ({ coords, timestamp }) => {
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return
      // Старая точка из кэша браузера не годится для «где я сейчас».
      if (timestamp && Date.now() - timestamp > MAX_FIX_AGE && gotFix) return
      gotFix = true
      setState({ status: 'active', coords: { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, heading: coords.heading }, at: Date.now() })
    }
    const onError = (error) => {
      if (error.code === 1) setState({ status: 'denied', coords: null, at: 0 })
      else if (!gotFix) setState((current) => ({ ...current, status: error.code === 3 ? 'loading' : 'unavailable' }))
    }
    const watchId = navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30_000 })
    return () => { window.clearTimeout(timer); navigator.geolocation.clearWatch(watchId) }
  }, [enabled])
  return state
}

// Направление взгляда по компасу телефона (градусы от севера по часовой).
// Android Chrome даёт deviceorientationabsolute, iPhone — webkitCompassHeading
// после разрешения (его спрашиваем по нажатию кнопки, см. requestCompass).
export function useCompass(enabled) {
  const [heading, setHeading] = useState(null)
  const last = useRef(0)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') { setHeading(null); return undefined }
    const onOrientation = (event) => {
      let value = null
      if (Number.isFinite(event.webkitCompassHeading)) value = event.webkitCompassHeading
      else if (event.absolute && Number.isFinite(event.alpha)) value = 360 - event.alpha
      if (value === null) return
      const screen = window.screen?.orientation?.angle || 0
      const now = Date.now()
      if (now - last.current < 120) return
      last.current = now
      setHeading(((value + screen) % 360 + 360) % 360)
    }
    const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(type, onOrientation)
    return () => window.removeEventListener(type, onOrientation)
  }, [enabled])
  return heading
}

export async function requestCompass() {
  try {
    const Orientation = globalThis.DeviceOrientationEvent
    if (typeof Orientation?.requestPermission === 'function') return (await Orientation.requestPermission()) === 'granted'
  } catch { return false }
  return true
}
