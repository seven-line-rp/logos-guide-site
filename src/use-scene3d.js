import { useSyncExternalStore } from 'react'
import { onPerfChange, sceneAllowed } from './perf.js'

// Можно ли показывать большую 3D-сцену на этом устройстве (см. canRunScene3d в
// perf.js). Ответ пересчитывается при смене режима «Лёгкий» и размера окна.
function subscribe(listener) {
  window.addEventListener('resize', listener)
  const stop = onPerfChange(listener)
  return () => { window.removeEventListener('resize', listener); stop() }
}

export function useScene3d() {
  return useSyncExternalStore(subscribe, sceneAllowed, () => false)
}
