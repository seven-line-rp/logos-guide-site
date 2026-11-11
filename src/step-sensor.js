import { useEffect, useState } from 'react'

// Шаги по датчику движения телефона (акселерометр). Нужны, чтобы вести по
// маршруту там, где GPS не ловит: так же навигаторы едут в тоннеле по
// инерциальным датчикам. Работает в Chrome на Android и в Safari на iPhone
// (там разрешение спрашивается по нажатию, см. requestMotion). Маячки и
// интернет не нужны.

const GRAVITY_SMOOTH = 0.02 // как быстро «забываем» наклон телефона
const SIGNAL_SMOOTH = 0.3
const STEP_THRESHOLD = 1.1 // м/с² над средним: толчок при шаге
const REARM_BELOW = 0.3 // после толчка ждём, пока ускорение вернётся к покою
const MIN_STEP_MS = 280 // быстрее 3,5 шага в секунду не ходят
const MAX_GAP_MS = 2000

// Счётчик шагов без React: в push приходит длина вектора ускорения (вместе с
// земным притяжением) и время. Возвращает true, когда засчитан шаг.
// Одиночный толчок (телефон положили на стол) шагом не считается: первый шаг
// засчитывается задним числом, когда за ним в течение двух секунд идёт второй.
export function createStepDetector() {
  let gravity = null
  let signal = 0
  let armed = true
  let lastPeak = -Infinity
  let pending = false
  return {
    push(magnitude, time) {
      if (!Number.isFinite(magnitude) || !Number.isFinite(time)) return 0
      if (gravity === null) { gravity = magnitude; return 0 }
      gravity += GRAVITY_SMOOTH * (magnitude - gravity)
      signal += SIGNAL_SMOOTH * (magnitude - gravity - signal)
      if (!armed) { if (signal < REARM_BELOW) armed = true; return 0 }
      if (signal < STEP_THRESHOLD || time - lastPeak < MIN_STEP_MS) return 0
      armed = false
      const gap = time - lastPeak
      lastPeak = time
      if (gap > MAX_GAP_MS) { pending = true; return 0 } // первый толчок после паузы: ждём второго
      const steps = pending ? 2 : 1
      pending = false
      return steps
    },
  }
}

export function motionSupported() {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window && window.isSecureContext !== false
}

// iPhone даёт датчики только после разрешения, а спросить его можно только в
// обработчике нажатия. На Android разрешение не нужно.
export async function requestMotion() {
  try {
    const Motion = globalThis.DeviceMotionEvent
    if (typeof Motion?.requestPermission === 'function') return (await Motion.requestPermission()) === 'granted'
  } catch { return false }
  return motionSupported()
}

// Сколько шагов пройдено с момента включения. active — датчик прислал хотя бы
// один замер (на компьютере событие есть, а замеров нет).
export function useStepCounter(enabled) {
  const [state, setState] = useState({ steps: 0, active: false })
  useEffect(() => {
    if (!enabled || !motionSupported()) { setState({ steps: 0, active: false }); return undefined }
    const detector = createStepDetector()
    let seen = false
    const onMotion = (event) => {
      const a = event.accelerationIncludingGravity
      if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z)) return
      const steps = detector.push(Math.hypot(a.x, a.y, a.z), event.timeStamp || performance.now())
      if (steps || !seen) {
        seen = true
        setState((current) => ({ steps: current.steps + steps, active: true }))
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [enabled])
  return state
}
