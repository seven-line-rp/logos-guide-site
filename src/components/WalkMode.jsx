import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, Footprints, MapPin, MoveDown, MoveUp, Pause, Volume2, X } from 'lucide-react'
import RoomPhoto from './RoomPhoto.jsx'
import { lockBodyScroll } from '../storage.js'

// Режим «Иду»: экран для ходьбы с телефоном в руке. Один шаг крупно,
// ориентиры, маленький план и большая кнопка «Дальше» внизу. Пока режим
// открыт, экран не гаснет (Screen Wake Lock, где браузер его поддерживает).

const stepIcon = (step) => step.kind === 'start' ? MapPin : step.kind === 'arrive' ? Check : step.kind === 'stop' ? Pause : step.kind === 'transfer' ? (step.title.startsWith('Поднимитесь') ? MoveUp : MoveDown) : Footprints

function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return undefined
    let lock = null
    let alive = true
    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (alive) lock = next
        else next.release().catch(() => {})
      } catch { /* батарея на исходе или вкладка в фоне — просто без блокировки */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void request() }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}

export default function WalkMode({ steps, index, onStep, onRepeat, onClose, onArrive, target, stop, children }) {
  useWakeLock()
  const nextRef = useRef(null)
  // Пока открыт режим, остальная страница недоступна ни мышью, ни с клавиатуры, ни для экранного диктора.
  useEffect(() => {
    const unlock = lockBodyScroll()
    const root = document.getElementById('root')
    if (root) root.inert = true
    return () => { unlock(); if (root) root.inert = false }
  }, [])
  useEffect(() => { nextRef.current?.focus({ preventScroll: true }) }, [index])
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const step = steps[index]
  const Icon = stepIcon(step)
  const last = index === steps.length - 1
  const photoRoom = step.kind === 'arrive' ? target : step.kind === 'stop' ? stop : null

  return createPortal(<div className="walk" role="dialog" aria-modal="true" aria-label="Режим «Иду»">
    <div className="walk-top">
      <span className="walk-count">Шаг {index + 1} из {steps.length}</span>
      <div className="walk-progress" aria-hidden="true">{steps.map((item, i) => <i key={i} className={i < index ? 'is-done' : i === index ? 'is-now' : ''} />)}</div>
      <button type="button" className="walk-close" onClick={onClose} aria-label="Закрыть режим «Иду»"><X size={20} /></button>
    </div>

    <div className="walk-body" aria-live="polite">
      <span className={`walk-icon walk-icon-${step.kind}`} aria-hidden="true"><Icon size={26} /></span>
      <span className="walk-floor">{step.floor} этаж</span>
      <h2 className="walk-title">{step.title}</h2>
      {step.detail && step.detail !== `${step.floor} этаж` && <p className="walk-detail">{step.detail.replace(new RegExp(`\\. ${step.floor} этаж$`), '')}</p>}
      {photoRoom && <RoomPhoto key={photoRoom.id} room={photoRoom} className="walk-photo" sizes="(max-width: 680px) 92vw, 420px" />}
    </div>

    <div className="walk-map">{children}</div>

    <div className="walk-controls">
      <button type="button" className="walk-ctl" onClick={() => onStep(index - 1)} disabled={index === 0} aria-label="Предыдущий шаг"><ArrowLeft size={20} /></button>
      <button type="button" className="walk-ctl" onClick={onRepeat} aria-label="Повторить подсказку голосом"><Volume2 size={19} /></button>
      {last
        ? <button ref={nextRef} type="button" className="walk-next walk-next-done" onClick={onArrive}><Check size={20} /> Я на месте</button>
        : <button ref={nextRef} type="button" className="walk-next" onClick={() => onStep(index + 1)}>Дальше <ArrowRight size={20} /></button>}
    </div>
  </div>, document.body)
}
