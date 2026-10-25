import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { isLitePerf, sceneAllowed } from '../perf.js'
import { INTRO_BUTTON_AT, INTRO_CAPTIONS, INTRO_FADE_OUT, captionAt, introMode } from '../ai-intro.js'
import { createIntroScene } from '../ai-intro-scene.js'
import { lockBodyScroll } from '../storage.js'

// Заставка при первом заходе в ЛОГОС AI (см. ai-intro.js): на весь экран, как
// кино. Сцену рисует ai-intro-scene.js, здесь — надписи, кнопка «Приступить»,
// «Пропустить», клавиатура и плавный уход. При «Уменьшить движение» и в режиме
// «Лёгкий» вместо анимации показывается сразу итоговый кадр с кнопкой.
export default function AiIntro({ onDone }) {
  const canvasRef = useRef(null)
  const startRef = useRef(null)
  const skipRef = useRef(null)
  const [time, setTime] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [still] = useState(() => introMode({
    lite: isLitePerf(),
    reduced: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }) === 'still')

  useEffect(() => {
    const canvas = canvasRef.current
    const unlock = lockBodyScroll()
    // Телефоны получают облегчённую сцену, компьютеры — полную.
    const scene = createIntroScene(canvas, { quality: still ? 'still' : sceneAllowed() ? 'full' : 'light' })
    scene.start()
    let frame = 0
    let shownAt = 0
    const begin = performance.now()
    // Часы заставки идут сами, не зависят от кадров сцены. Состояние
    // обновляем ~15 раз в секунду: этого хватает для плавных надписей.
    const loop = (now) => {
      frame = requestAnimationFrame(loop)
      const t = (now - begin) / 1000
      if (now - shownAt < 66 && t < INTRO_BUTTON_AT + 1) return
      shownAt = now
      setTime(Math.min(t, INTRO_BUTTON_AT + 1))
      if (t >= INTRO_BUTTON_AT + 1) cancelAnimationFrame(frame)
    }
    if (!still) frame = requestAnimationFrame(loop)
    const timer = window.setTimeout(() => (still ? startRef : skipRef).current?.focus(), 60)
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); scene.destroy(); unlock() }
  }, [still])

  const done = still || time >= INTRO_BUTTON_AT
  const shown = still ? INTRO_BUTTON_AT + 1 : time
  const current = still ? null : captionAt(time)

  const finish = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onDone, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : INTRO_FADE_OUT * 1000)
  }

  // Esc и Enter завершают заставку; Tab держим внутри неё (две кнопки).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); finish() }
      if (event.key === 'Enter' && done && document.activeElement?.tagName !== 'BUTTON') { event.preventDefault(); finish() }
      if (event.key === 'Tab') {
        const buttons = [skipRef.current, startRef.current].filter(Boolean)
        if (!buttons.length) return
        const first = buttons[0], lastButton = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); lastButton.focus() }
        else if (!event.shiftKey && document.activeElement === lastButton) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Когда появилась кнопка «Приступить», фокус переходит на неё.
  useEffect(() => { if (done && !still) startRef.current?.focus() }, [done, still])

  return createPortal(
    <div className={`ai-intro ${leaving ? 'is-leaving' : ''} ${still ? 'is-still' : ''}`} role="dialog" aria-modal="true" aria-label="Знакомство с ЛОГОС AI" aria-describedby="ai-intro-summary">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="ai-intro-vignette" aria-hidden="true" />
      <p id="ai-intro-summary" className="ai-intro-sr">ЛОГОС AI — нейросеть колледжа. {INTRO_CAPTIONS.map((item) => `${item.kicker}: ${item.title}.`).join(' ')}</p>

      {!done && <button ref={skipRef} type="button" className="ai-intro-skip" onClick={finish}>Пропустить</button>}

      {current && <div className="ai-intro-caption" key={current.index} style={{ opacity: current.opacity }} aria-hidden="true">
        <span className="ai-intro-kicker">{current.caption.kicker}</span>
        <strong className={`ai-intro-title ${current.index === 0 ? 'is-brand' : ''}`}>{current.caption.title}</strong>
      </div>}

      {done && <div className="ai-intro-final">
        <span className="ai-intro-kicker">Нейросеть колледжа</span>
        <strong className="ai-intro-title is-brand">ЛОГОС AI</strong>
        <p>Спросите про кабинеты, маршруты, учёбу и зачёты.</p>
        <button ref={startRef} type="button" className="ai-intro-start" onClick={finish}>Приступить <ArrowRight size={18} aria-hidden="true" /></button>
      </div>}

      {!still && <div className="ai-intro-progress" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(1, shown / INTRO_BUTTON_AT)})` }} /></div>}
    </div>,
    document.body,
  )
}
