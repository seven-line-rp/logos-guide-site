import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, Lock, X } from 'lucide-react'
import { onConsentChange, onCookieSettings, readConsent, saveConsent } from '../consent.js'

// Плашка о cookie. Появляется при первом визите и по кнопке «Настройки cookie»
// в подвале. Не блокирует сайт: пока ответа нет, всё работает как обычно.
export default function CookieBanner() {
  const [consent, setConsent] = useState(() => readConsent())
  const [open, setOpen] = useState(() => !readConsent())
  const [detailed, setDetailed] = useState(false)
  const [functional, setFunctional] = useState(() => readConsent()?.functional ?? true)
  const firstButtonRef = useRef(null)

  useEffect(() => onCookieSettings(() => {
    const current = readConsent()
    setFunctional(current?.functional ?? true)
    setDetailed(true)
    setOpen(true)
  }), [])
  useEffect(() => onConsentChange((value) => setConsent(value)), [])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape' && consent) setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, consent])

  useEffect(() => {
    if (open && detailed) firstButtonRef.current?.focus({ preventScroll: true })
  }, [open, detailed])

  if (!open) return null

  const answer = (value) => {
    saveConsent(value)
    setOpen(false)
    setDetailed(false)
  }

  return (
    <section className={`cookie-banner ${detailed ? 'cookie-banner-detailed' : ''}`} role="region" aria-labelledby="cookie-title">
      <div className="cookie-head">
        <span className="cookie-icon" aria-hidden="true"><Cookie size={19} /></span>
        <h2 id="cookie-title">{detailed ? 'Настройки cookie' : 'Немного о cookie'}</h2>
        {consent && <button type="button" className="cookie-close" onClick={() => setOpen(false)} aria-label="Закрыть настройки cookie"><X size={16} /></button>}
      </div>
      <p>
        Рекламных и аналитических cookie здесь нет. В браузере сохраняются только ваши настройки: тема, язык, голос, метка на карте и рекорды в играх.{' '}
        <Link to="/privacy#cookies" onClick={() => setOpen(false)}>Подробнее</Link>
      </p>

      {detailed && <div className="cookie-options">
        <div className="cookie-option">
          <span className="cookie-option-copy"><strong>Необходимые</strong><small>Запоминают ваш ответ на этот вопрос.</small></span>
          <span className="cookie-locked"><Lock size={13} /> Всегда</span>
        </div>
        <label className="cookie-option">
          <span className="cookie-option-copy"><strong>Функциональные</strong><small>Тема, язык, голос, настройки карты, рекорды, отметка о пройденном обучении.</small></span>
          <input type="checkbox" checked={functional} onChange={(event) => setFunctional(event.target.checked)} />
          <i className="cookie-switch" aria-hidden="true"><b /></i>
        </label>
      </div>}

      <div className="cookie-actions">
        {detailed
          ? <button ref={firstButtonRef} type="button" className="cookie-primary" onClick={() => answer(functional)}>Сохранить выбор</button>
          : <>
            <button type="button" className="cookie-primary" onClick={() => answer(true)}>Принять</button>
            <button type="button" className="cookie-secondary" onClick={() => answer(false)}>Только необходимые</button>
            <button type="button" className="cookie-link" onClick={() => setDetailed(true)}>Настроить</button>
          </>}
      </div>
    </section>
  )
}
