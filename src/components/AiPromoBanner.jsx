import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

// Баннер «ЛОГОС AI» на главной. Иллюстрация — SVG в коде (без картинки),
// поэтому чёткая на любом экране и подстраивается под тёмную тему.
// Вся карточка — ссылка на /ai, «Перейти» выглядит как кнопка.

const star = (cx, cy, r) => `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`

function PromoArt() {
  return <svg className="ai-promo-art" viewBox="0 0 360 250" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="ai-promo-back" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#c9d3ff" /><stop offset="1" stopColor="#6f86ff" /></linearGradient>
      <linearGradient id="ai-promo-front" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d6ddff" /></linearGradient>
      <linearGradient id="ai-promo-tail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dfe5ff" /><stop offset="1" stopColor="#9fb0ff" /></linearGradient>
      <filter id="ai-promo-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#3d5cff" floodOpacity=".18" /></filter>
      <filter id="ai-promo-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
    </defs>
    <rect x="18" y="58" width="208" height="124" rx="62" fill="url(#ai-promo-back)" opacity=".92" />
    <g className="ai-promo-front" filter="url(#ai-promo-shadow)">
      <path d="M300 214c4 14 0 24-6 28 18-2 32-14 36-34z" fill="url(#ai-promo-tail)" />
      <rect x="118" y="92" width="214" height="136" rx="50" fill="url(#ai-promo-front)" />
      <circle className="ai-promo-dot" cx="180" cy="160" r="10" fill="#3d5cff" />
      <circle className="ai-promo-dot" cx="225" cy="160" r="10" fill="#3d5cff" />
      <circle className="ai-promo-dot" cx="270" cy="160" r="10" fill="#3d5cff" />
    </g>
    <rect x="80" y="40" width="72" height="72" rx="26" fill="#e9eeff" opacity=".9" filter="url(#ai-promo-glow)" />
    <path className="ai-promo-star" d={star(116, 76, 36)} fill="#1f4ff0" />
    <path className="ai-promo-spark" d={star(300, 46, 15)} fill="#9db0ff" />
    <path className="ai-promo-spark" d={star(326, 72, 8)} fill="#9db0ff" />
    <path className="ai-promo-spark" d={star(36, 200, 13)} fill="#9db0ff" />
  </svg>
}

export default function AiPromoBanner() {
  return <section className="ai-promo-section container" aria-labelledby="ai-promo-title">
    <Link className="ai-promo" to="/ai">
      <PromoArt />
      <span className="ai-promo-copy">
        <span className="ai-promo-brand">ЛОГОС AI</span>
        <h2 id="ai-promo-title">На сайте появился<br />ИИ-помощник</h2>
        <p>Задайте вопрос — и получите ответ</p>
        <span className="ai-promo-button">Перейти в чат <ArrowRight size={18} /></span>
      </span>
    </Link>
  </section>
}
