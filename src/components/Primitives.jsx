import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

// Один IntersectionObserver на все блоки: на длинных страницах их десятки,
// и отдельный наблюдатель на каждый заметно грузит слабые телефоны.
const revealCallbacks = new WeakMap()
let revealObserver = null

function observeReveal(node, onVisible) {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) { onVisible(); return () => {} }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        revealObserver.unobserve(entry.target)
        revealCallbacks.get(entry.target)?.()
        revealCallbacks.delete(entry.target)
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
  }
  revealCallbacks.set(node, onVisible)
  revealObserver.observe(node)
  return () => { revealObserver.unobserve(node); revealCallbacks.delete(node) }
}

export function Reveal({ children, className = '', delay = 0, as: Tag = 'div', style, variant = 'up', ...props }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    return observeReveal(node, () => setVisible(true))
  }, [])

  const variantClass = `reveal-${variant}`
  return <Tag ref={ref} {...props} className={`reveal ${variantClass} ${visible ? 'reveal-visible' : ''} ${className}`} style={{ ...style, '--reveal-delay': `${delay}ms` }}>{children}</Tag>
}

export function PageHeading({ eyebrow, title, description, aside, className = '' }) {
  return <section className={`page-heading container ${className}`}><div className="page-heading-main">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{aside && <div className="page-heading-aside">{aside}</div>}</section>
}

export function SectionLabel({ children }) {
  return <div className="section-label"><span>{children}</span></div>
}

export function TextLink({ to, children, className = '' }) {
  return <Link className={`text-link ${className}`} to={to}>{children}<span><ArrowRight size={15} /></span></Link>
}

export function FloorTag({ floor }) {
  return <span className={`floor-tag floor-tag-${floor}`}>{floor} этаж</span>
}
