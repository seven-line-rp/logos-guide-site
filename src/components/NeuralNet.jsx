import { useEffect, useRef } from 'react'
import { isLitePerf, onPerfChange, sceneAllowed } from '../perf.js'
import { sceneQuality } from '../neural-net.js'
import { createNeuralScene } from '../neural-scene.js'

// Заставка пустого чата ЛОГОС AI: 3D-нейросеть на canvas (см. neural-scene.js).
// Уровень качества выбирается по устройству: на компьютере — полная, на
// телефоне — облегчённая (меньше нейронов, 30 к/с), в режиме «Лёгкий» и при
// «Уменьшить движение» — одна неподвижная картинка. Декоративная, для
// скринридеров скрыта.
export default function NeuralNet({ active = true }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pick = () => sceneQuality({ allowed3d: sceneAllowed(), lite: isLitePerf(), reduced: reduced.matches })
    const scene = createNeuralScene(canvas, { quality: pick() })
    sceneRef.current = scene
    scene.start()
    const repick = () => scene.setQuality(pick())
    const stop = onPerfChange(repick)
    reduced.addEventListener('change', repick)
    return () => { stop(); reduced.removeEventListener('change', repick); scene.destroy(); sceneRef.current = null }
  }, [])

  useEffect(() => { sceneRef.current?.setActive(active) }, [active])

  return <div className={`ai-neural ${active ? '' : 'is-off'}`} aria-hidden="true"><canvas ref={canvasRef} /></div>
}
