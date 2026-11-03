import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { UNITY, daysToUnity } from '../festive.js'
import { setTheme, useTheme } from '../theme.js'

// Праздничные части главной. Видны только в теме «Единство» (src/theme.js),
// стили — в src/unity.css.

function daysWord(days) {
  const mod10 = days % 10
  const mod100 = days % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'дня'
  return 'дней'
}

function FlagMark() {
  return <span className="unity-flag-mark" aria-hidden="true"><i /><i /><i /></span>
}

export function UnityChip() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  return <span className="unity-chip"><FlagMark />4 ноября<span className="unity-chip-title"> · {UNITY.title}</span></span>
}

export function UnityBanner() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  const days = daysToUnity()
  const note = days === 0 ? 'Сегодня занятий нет. Карта и маршруты работают как обычно.' : '4 ноября занятий нет. Карта и маршруты работают как обычно.'
  const count = days > 0 ? <><b>{days}</b><span>{daysWord(days)} до праздника</span></>
    : days === 0 ? <><b className="unity-banner-word">Сегодня</b><span>праздник</span></>
    : <><b className="unity-banner-word">4 ноября</b><span>с праздником</span></>
  return <section className="unity-banner container" aria-label={UNITY.title}>
    <div className="unity-banner-card">
      <div className="unity-banner-copy">
        <span className="unity-banner-kicker"><FlagMark />4 ноября</span>
        <strong>С Днём народного единства!</strong>
        <p className="unity-banner-history">В 1612 году народное ополчение Кузьмы Минина и князя Дмитрия Пожарского освободило Москву. В этот день мы вспоминаем, что вместе страна сильнее.</p>
        <p className="unity-banner-note">{note}</p>
        <div className="unity-banner-actions">
          <Link className="unity-banner-link" to="/map">Открыть карту <ArrowRight size={15} aria-hidden="true" /></Link>
          <button type="button" className="unity-banner-off" onClick={() => setTheme('light')}>Обычная тема</button>
        </div>
      </div>
      <div className="unity-banner-count" role="note">{count}</div>
    </div>
  </section>
}
