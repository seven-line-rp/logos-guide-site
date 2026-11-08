import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Command, Navigation } from 'lucide-react'
import { rooms } from '../data.js'
import { translate, useLanguage } from '../i18n.js'
import { useTheme } from '../theme.js'

// Части темы Motion (src/theme.js) — тестовой, «как цифровой продукт 2026 года»:
// светлый фон, чёрные элементы, один яркий лаймовый акцент и много аккуратного
// движения. Стили — src/motion-theme.css. Всё, что двигается, при «Уменьшить
// движение» замирает (там же, в конце файла).

const pad = (value) => String(value).padStart(2, '0')

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

// Заголовок по словам: каждое слово выезжает снизу из-под маски.
export function MotionWords({ text }) {
  useLanguage()
  const words = translate(text).split(' ')
  return <span className="mo-words" aria-label={translate(text)}>{words.map((word, index) => <span key={`${word}-${index}`} className="mo-word" aria-hidden="true"><span style={{ '--i': index }}>{word}</span>{index < words.length - 1 ? ' ' : ''}</span>)}</span>
}

export function MotionChip() {
  const theme = useTheme()
  if (theme !== 'motion') return null
  return <span className="mo-chip"><i aria-hidden="true" /> Motion · тестовая тема</span>
}

// Схема этажа в карточке: несколько комнат и маршрут, по которому бежит точка.
function MiniPlan() {
  return <svg className="mo-plan" viewBox="0 0 320 170" aria-hidden="true">
    <defs><pattern id="mo-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#0b0b0c" opacity=".08" /></pattern></defs>
    <rect x="0" y="0" width="320" height="170" rx="16" fill="url(#mo-dots)" />
    {[[14, 14, 70, 52], [92, 14, 60, 52], [160, 14, 70, 52], [238, 14, 68, 52], [14, 104, 90, 52], [112, 104, 58, 52], [178, 104, 128, 52]].map(([x, y, w, h], index) => <rect key={index} className={index === 6 ? 'mo-plan-target' : 'mo-plan-room'} x={x} y={y} width={w} height={h} rx="8" />)}
    <path className="mo-plan-route-bg" d="M40 66 V 85 H 240 V 104" />
    <path id="mo-route" className="mo-plan-route" d="M40 66 V 85 H 240 V 104" pathLength="100" />
    <circle className="mo-plan-start" cx="40" cy="66" r="5" />
    <g className="mo-plan-dot"><circle r="9" /><circle r="4.5" /></g>
  </svg>
}

export function MotionStage() {
  const clock = useClock()
  return <div className="mo-stage" aria-hidden="true">
    <div className="mo-grid" />
    <div className="mo-orbit"><span /><span /><span /></div>
    <div className="mo-card mo-card-route">
      <div className="mo-card-head"><span className="mo-live"><i />Маршрут</span><span className="mo-mono">{clock}</span></div>
      <MiniPlan />
      <div className="mo-card-foot">
        <div><small className="mo-mono">FROM → TO</small><strong>Вход → 217</strong></div>
        <div className="mo-eta"><Navigation size={14} /> 2 мин</div>
      </div>
      <div className="mo-progress-track"><span /></div>
    </div>
    <div className="mo-card mo-card-dark">
      <small className="mo-mono">NEXT</small>
      <strong>Следующая пара</strong>
      <span className="mo-dark-row"><b>217</b><span>2 этаж · через 12 мин</span></span>
    </div>
    <div className="mo-pill mo-pill-search"><Command size={13} /> K <span>Найти место</span></div>
    <div className="mo-pill mo-pill-toggle"><span className="mo-toggle"><i /></span><span className="mo-toggle-2d">2D</span><span className="mo-toggle-3d">3D</span></div>
    <div className="mo-pill mo-pill-count"><b>{rooms.length}</b> помещений</div>
    <svg className="mo-cursor" width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L 20 12 L 12 13.5 L 8.5 21 Z" fill="#0b0b0c" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
  </div>
}

// Бегущая строка под главным экраном: разделы сайта, чёрная полоса.
const TICKER = [['/map', 'Карта этажей'], ['/route', 'Маршрут до двери'], ['/rooms', 'Кабинеты'], ['/teachers', 'Преподаватели'], ['/schedule', 'Расписание'], ['/ai', 'ИИ-помощник'], ['/games', 'Игры'], ['/tour', 'Экскурсия в 3D']]

export function MotionTicker() {
  const theme = useTheme()
  if (theme !== 'motion') return null
  const row = (hidden) => <div className="mo-ticker-row" aria-hidden={hidden || undefined}>{TICKER.map(([to, label]) => <Link key={to} to={to} tabIndex={hidden ? -1 : undefined}>{label}<ArrowUpRight size={18} /></Link>)}</div>
  return <nav className="mo-ticker" aria-label="Разделы сайта"><div className="mo-ticker-track">{row(false)}{row(true)}</div></nav>
}

// Полоска прокрутки страницы вверху экрана (CSS scroll-timeline).
export function MotionProgress() {
  const theme = useTheme()
  if (theme !== 'motion') return null
  return <div className="mo-scroll-progress" aria-hidden="true" />
}
