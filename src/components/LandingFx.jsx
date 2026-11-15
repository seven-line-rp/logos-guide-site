import { useEffect, useRef, useState } from 'react'

// Небольшие эффекты для главной, переписанные без Tailwind и framer-motion:
// идеи взяты из magicui.design (Number Ticker), reactbits.dev (Spotlight Card).
// Все уважают «уменьшить движение»: число сразу встаёт на место, подсветки нет.

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Число, которое досчитывает до значения, когда попадает на экран.
export function NumberTicker({ value, duration = 1100 }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
  useEffect(() => {
    const node = ref.current
    if (!node || reducedMotion() || !('IntersectionObserver' in window)) { setShown(value); return undefined }
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        setShown(Math.round(value * (1 - (1 - t) ** 3)))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    observer.observe(node)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [value, duration])
  return <span ref={ref} className="fx-ticker" aria-label={String(value)}><span aria-hidden="true">{shown}</span></span>
}

// Подсветка под курсором: обработчик пишет координаты в CSS-переменные
// ближайшего элемента с классом .fx-spot, остальное делает landing.css.
export function trackSpotlight(event) {
  const card = event.target.closest?.('.fx-spot')
  if (!card) return
  const box = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${event.clientX - box.left}px`)
  card.style.setProperty('--my', `${event.clientY - box.top}px`)
}
