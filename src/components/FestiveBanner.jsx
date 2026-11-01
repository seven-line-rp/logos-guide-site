import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { UNITY, daysToUnity, setFestive, useFestive } from '../festive.js'

function daysText(days) {
  const mod10 = days % 10
  const mod100 = days % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? 'дня' : 'дней'
  return `${days} ${word}`
}

// Праздничная полоса на главной. Показывается, пока включено оформление
// (см. src/festive.js); там же можно его выключить.
export default function FestiveBanner() {
  const on = useFestive()
  if (!on) return null
  const days = daysToUnity()
  const when = days === 0 ? 'Сегодня' : days > 0 && days <= 7 ? `Через ${daysText(days)}` : '4 ноября'
  const note = days === 0 ? 'Занятий нет, колледж отдыхает.' : '4 ноября занятий нет. Маршруты и карта работают как обычно.'
  return <section className="festive-banner container" aria-label={UNITY.title}>
    <div className="festive-banner-card">
      <span className="festive-banner-flag" aria-hidden="true"><i /><i /><i /></span>
      <div className="festive-banner-copy">
        <span className="festive-banner-when"><Sparkles size={13} aria-hidden="true" /> {when}</span>
        <strong>С Днём народного единства!</strong>
        <p>{note}</p>
      </div>
      <div className="festive-banner-actions">
        <Link className="festive-banner-link" to="/map">Погулять по карте <ArrowRight size={14} /></Link>
        <button type="button" className="festive-banner-off" onClick={() => setFestive(false)}>Убрать оформление</button>
      </div>
    </div>
  </section>
}
