import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { UNITY, daysToUnity } from '../festive.js'
import { setTheme, useTheme } from '../theme.js'

// Праздничные куски главной страницы. Показываются только в теме «Единство»
// (src/theme.js), стили — в src/unity.css.

function daysText(days) {
  const mod10 = days % 10
  const mod100 = days % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? 'дня' : 'дней'
  return `${days} ${word}`
}

const SLICES = 18

// Развевающийся флаг: полоски ткани качаются по очереди, получается волна.
export function UnityFlag() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  return <div className="unity-flag" aria-hidden="true">
    <span className="unity-flag-pole" />
    <span className="unity-flag-cloth">{Array.from({ length: SLICES }, (_, index) => <i key={index} style={{ '--i': index }} />)}</span>
  </div>
}

export function UnityChip() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  return <span className="unity-chip"><span className="unity-chip-flag" aria-hidden="true"><i /><i /><i /></span>4 ноября<span className="unity-chip-title"> · {UNITY.title}</span></span>
}

export function UnityBanner() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  const days = daysToUnity()
  const note = days === 0 ? 'Сегодня занятий нет, колледж отдыхает. Карта и маршруты работают как обычно.'
    : days > 0 ? 'В этот день занятий нет. Карта и маршруты работают как обычно.'
    : 'Спасибо, что вы с нами. Карта и маршруты работают как обычно.'
  return <section className="unity-banner container" aria-label={UNITY.title}>
    <div className="unity-banner-card">
      <div className="unity-banner-copy">
        <span className="unity-banner-kicker"><Sparkles size={14} aria-hidden="true" /> 4 ноября</span>
        <strong>С Днём народного единства!</strong>
        <p>{note}</p>
        <div className="unity-banner-actions">
          <Link className="unity-banner-link" to="/map">Смотреть карту <ArrowRight size={15} /></Link>
          <button type="button" className="unity-banner-off" onClick={() => setTheme('light')}>Вернуть обычную тему</button>
        </div>
      </div>
      <div className="unity-banner-count" aria-label={days > 0 ? `Через ${daysText(days)}` : days === 0 ? 'Сегодня' : 'Праздник прошёл'}>
        {days > 0 ? <><span>через</span><b>{days}</b><span>{daysText(days).split(' ')[1]}</span></> : days === 0 ? <b className="unity-banner-today">Сегодня!</b> : <b className="unity-banner-today">С праздником!</b>}
      </div>
    </div>
  </section>
}
