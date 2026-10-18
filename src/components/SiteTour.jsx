import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Gamepad2, Layers, List, Map as MapIcon, MapPin, RotateCcw, Route, Search, Sparkles, Star, X } from 'lucide-react'
import { TOUR_STEPS, markTutorialDone } from '../tutorial.js'
import { onTourStart } from '../tour-bus.js'

const STEP_ICONS = { compass: Compass, search: Search, map: MapIcon, star: Star, layers: Layers, pin: MapPin, route: Route, list: List, game: Gamepad2, book: BookOpen }

const FIND_TIMEOUT_MS = 5000
const FIND_INTERVAL_MS = 120
const CARD_GAP = 16
const HOLE_PAD = 10
const EDGE = 14

// Подсветка ищет элемент по списку селекторов и берёт первый *видимый*:
// так шаг про документацию работает и на компьютере (кнопка в шапке), и на
// телефоне, где кнопка спрятана в меню и подсвечивать нужно бургер.
function findTarget(targets) {
  for (const selector of targets) {
    try {
      const node = document.querySelector(selector)
      // display: none и снятые с отображения элементы не имеют клиентских рамок.
      if (node && node.getClientRects().length) return { node, selector }
    } catch {
      return null
    }
  }
  return null
}

// Позиция подсветки и карточки: карточка встаёт под элемент, а если снизу
// не хватает места — над ним. По горизонтали её центр не выходит за экран.
export function computeTourLayout(box, card, viewport) {
  const width = viewport.width
  const height = viewport.height
  if (!box) {
    if (!card) return { hole: null, card: null, arrow: 'none' }
    return {
      hole: null,
      card: { top: Math.max(EDGE, (height - card.height) / 2), left: Math.max(EDGE, (width - card.width) / 2) },
      arrow: 'none',
    }
  }
  const hole = {
    top: box.top - HOLE_PAD,
    left: box.left - HOLE_PAD,
    width: Math.max(box.width + HOLE_PAD * 2, 28),
    height: Math.max(box.height + HOLE_PAD * 2, 28),
  }
  if (!card) return { hole, card: null, arrow: 'none' }

  const centerX = Math.min(Math.max(hole.left + hole.width / 2, card.width / 2 + EDGE), width - card.width / 2 - EDGE)
  const left = centerX - card.width / 2
  // Стрелка карточки указывает на центр подсветки даже у края экрана.
  const arrowX = Math.min(Math.max(hole.left + hole.width / 2 - left, 24), card.width - 24)
  const below = hole.top + hole.height + CARD_GAP
  const above = hole.top - CARD_GAP - card.height
  let top
  let arrow
  if (below + card.height <= height - EDGE) {
    top = below
    arrow = 'up'
  } else if (above >= EDGE) {
    top = above
    arrow = 'down'
  } else if (hole.top + hole.height / 2 <= height / 2) {
    top = Math.max(EDGE, Math.min(below, height - card.height - EDGE))
    arrow = 'up'
  } else {
    top = Math.max(EDGE, above)
    arrow = 'down'
  }
  return { hole, card: { top, left, arrowX }, arrow }
}

export default function SiteTour() {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('tour')
  const [layout, setLayout] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const nodeRef = useRef(null)
  const selectorRef = useRef('')
  const cardRef = useRef(null)
  const actionRef = useRef(null)
  const lastKeyRef = useRef('')

  const finish = useCallback(() => {
    nodeRef.current = null
    selectorRef.current = ''
    lastKeyRef.current = ''
    setLayout(null)
    setPhase('done')
    markTutorialDone()
  }, [])

  const close = useCallback(() => {
    nodeRef.current = null
    selectorRef.current = ''
    lastKeyRef.current = ''
    setLayout(null)
    setActive(false)
    setPhase('tour')
    setIndex(0)
  }, [])

  const goNext = useCallback(() => {
    setIndex((current) => {
      if (current + 1 >= TOUR_STEPS.length) {
        finish()
        return current
      }
      nodeRef.current = null
      selectorRef.current = ''
      lastKeyRef.current = ''
      return current + 1
    })
  }, [finish])

  const goPrevious = useCallback(() => {
    setIndex((current) => {
      if (current <= 0) return current
      nodeRef.current = null
      selectorRef.current = ''
      lastKeyRef.current = ''
      return current - 1
    })
  }, [])

  const restart = useCallback(() => {
    nodeRef.current = null
    selectorRef.current = ''
    lastKeyRef.current = ''
    setLayout(null)
    setPhase('tour')
    setIndex(0)
  }, [])

  useEffect(() => onTourStart(() => {
    nodeRef.current = null
    selectorRef.current = ''
    lastKeyRef.current = ''
    setPhase('tour')
    setIndex(0)
    setLayout(null)
    setActive(true)
  }), [])

  // Шаг может жить на другой странице: сначала переходим, потом ищем элемент.
  useEffect(() => {
    if (!active || phase !== 'tour') return undefined
    const step = TOUR_STEPS[index]
    if (!step) return undefined
    if (step.to && `${location.pathname}${location.search}` !== step.to) {
      navigate(step.to)
      return undefined
    }
    let cancelled = false
    let timer = 0
    const startedAt = Date.now()
    const resolve = () => {
      if (cancelled) return
      if (!step.targets.length) {
        nodeRef.current = null
        selectorRef.current = ''
        return
      }
      const found = findTarget(step.targets)
      if (found) {
        nodeRef.current = found.node
        selectorRef.current = found.selector
        found.node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
        return
      }
      if (Date.now() - startedAt > FIND_TIMEOUT_MS) {
        goNext() // элемент так и не появился — не держим человека на пустом шаге
        return
      }
      timer = window.setTimeout(resolve, FIND_INTERVAL_MS)
    }
    resolve()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [active, phase, index, location.pathname, location.search, navigate, goNext])

  // Рамка и карточка следят за элементом: план можно двигать пальцем, а страница
  // прокручивается, поэтому пересчитываем позицию каждый кадр.
  useEffect(() => {
    if (!active) return undefined
    let frame = 0
    const tick = () => {
      frame = window.requestAnimationFrame(tick)
      const node = nodeRef.current
      const box = node ? node.getBoundingClientRect() : null
      const card = cardRef.current ? cardRef.current.getBoundingClientRect() : null
      const next = computeTourLayout(box, card && card.width ? { width: card.width, height: card.height } : null, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
      const key = `${next.arrow}|${JSON.stringify(next.hole)}|${JSON.stringify(next.card)}`
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key
        setLayout(next)
      }
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [active])

  useEffect(() => {
    if (!active) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (phase === 'tour') finish()
        else close()
        return
      }
      if (phase !== 'tour') return
      if (event.key === 'ArrowRight' || (event.key === 'Enter' && event.target === document.body)) {
        event.preventDefault()
        goNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrevious()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, phase, finish, close, goNext, goPrevious])

  useEffect(() => {
    if (!active) return undefined
    const timer = window.setTimeout(() => actionRef.current?.focus({ preventScroll: true }), 120)
    return () => window.clearTimeout(timer)
  }, [active, index, phase])

  if (!active) return null

  const step = TOUR_STEPS[index]
  const isDone = phase === 'done'
  const tone = isDone ? 'green' : step.tone
  const StepIcon = STEP_ICONS[step.icon] || Sparkles
  const positioned = Boolean(layout?.card)
  const cardStyle = positioned
    ? { top: `${Math.round(layout.card.top)}px`, left: `${Math.round(layout.card.left)}px`, '--tour-arrow-x': `${Math.round(layout.card.arrowX ?? 40)}px` }
    : { top: '-9999px', left: '-9999px' }
  const holeStyle = layout?.hole ? {
    top: `${Math.round(layout.hole.top)}px`,
    left: `${Math.round(layout.hole.left)}px`,
    width: `${Math.round(layout.hole.width)}px`,
    height: `${Math.round(layout.hole.height)}px`,
  } : null

  return (
    <div
      className={`tour-layer ${isDone || !layout?.hole ? 'tour-layer-centered' : ''}`}
      data-tone={tone}
      role="dialog"
      aria-modal="true"
      aria-label={isDone ? 'Обучение завершено' : 'Обучение по сайту'}
    >
      <div className="tour-scrim" aria-hidden="true" />

      {!isDone && holeStyle && (
        <button
          type="button"
          className={`tour-hole tour-arrow-${layout.arrow}`}
          data-tour-target={selectorRef.current}
          style={holeStyle}
          onClick={goNext}
          aria-label="Показать следующий шаг"
        >
          <span className="tour-hole-ring" aria-hidden="true" />
          <span className="tour-hole-pulse" aria-hidden="true" />
          <span className="tour-hole-pulse tour-hole-pulse-late" aria-hidden="true" />
        </button>
      )}

      <section key={isDone ? 'done' : step.id} className={`tour-card ${positioned ? 'tour-card-placed' : ''} ${layout?.arrow ? `tour-card-arrow-${layout.arrow}` : ''} ${isDone ? 'tour-card-done' : ''}`} style={cardStyle} ref={cardRef}>
        {isDone ? <>
          <div className="tour-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, position) => <i key={position} />)}</div>
          <div className="tour-band">
            <span className="tour-icon tour-icon-large" aria-hidden="true"><Check size={26} strokeWidth={2.6} /></span>
            <button type="button" className="tour-skip" onClick={close} aria-label="Закрыть обучение"><X size={15} /></button>
          </div>
          <div className="tour-body">
            <span className="tour-eyebrow">Обучение завершено</span>
            <h2>Теперь вы <em>знаете сайт.</em></h2>
            <p>Пройти обучение ещё раз можно в разделе «Документация» или в меню. Там же — подробные ответы на частые вопросы.</p>
            <ul className="tour-summary" aria-label="Что вы узнали">
              {TOUR_STEPS.slice(1).map((item) => <li key={item.id} data-tone={item.tone}>{item.eyebrow}</li>)}
            </ul>
            <div className="tour-actions">
              <button type="button" className="tour-ghost" onClick={restart}><RotateCcw size={15} /> Ещё раз</button>
              <button type="button" ref={actionRef} className="tour-primary" onClick={close}>Понятно</button>
            </div>
          </div>
        </> : <>
          <div className="tour-band">
            <span className={`tour-icon ${index === 0 ? 'tour-icon-large' : ''}`} aria-hidden="true"><StepIcon size={index === 0 ? 26 : 20} strokeWidth={2.2} /></span>
            <span className="tour-band-copy">
              <span className="tour-step-label">{index === 0 ? 'Обучение по сайту' : `Шаг ${index} из ${TOUR_STEPS.length - 1}`}</span>
              <strong>{step.eyebrow}</strong>
            </span>
            <button type="button" className="tour-skip" onClick={close} aria-label="Пропустить обучение"><X size={15} /></button>
          </div>
          <div className="tour-body">
            <h2>{step.title}</h2>
            <p>{step.text}</p>
            <div className="tour-progress" aria-hidden="true">
              {TOUR_STEPS.map((item, position) => <i key={item.id} data-tone={item.tone} className={position < index ? 'tour-progress-done' : position === index ? 'tour-progress-active' : ''} />)}
            </div>
            <div className="tour-actions">
              <button type="button" className="tour-ghost" onClick={finish}>Пропустить</button>
              {index > 0 && <button type="button" className="tour-back" onClick={goPrevious} aria-label="Предыдущий шаг"><ArrowLeft size={16} /></button>}
              <button type="button" ref={actionRef} className="tour-primary" onClick={goNext}>{step.action}<ArrowRight size={16} /></button>
            </div>
          </div>
        </>}
      </section>
    </div>
  )
}
