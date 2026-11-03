import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { UNITY, daysToUnity } from '../festive.js'
import { fireConfetti, isFlagRight, nextStripe, unityCountdown } from '../unity-fx.js'
import { setTheme, useTheme } from '../theme.js'

// Праздничные части сайта. Видны только в теме «Единство» (src/theme.js),
// стили — в src/unity.css.

function daysWord(days) {
  const mod10 = days % 10
  const mod100 = days % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'дня'
  return 'дней'
}

const pad = (value) => String(value).padStart(2, '0')

export function FlagMark() {
  return <span className="unity-flag-mark" aria-hidden="true"><i /><i /><i /></span>
}

export function UnityChip() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  return <span className="unity-chip"><FlagMark />4 ноября<span className="unity-chip-title"> · {UNITY.title}</span></span>
}

// Живой отсчёт до 4 ноября: дни, часы, минуты, секунды.
function Countdown() {
  const [left, setLeft] = useState(() => unityCountdown())
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(unityCountdown()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!left) {
    const today = daysToUnity() === 0
    return <div className="unity-banner-count" role="note"><b className="unity-banner-word">{today ? 'Сегодня' : '4 ноября'}</b><span>{today ? 'праздник' : 'с праздником'}</span></div>
  }
  const cells = [[left.days, daysWord(left.days)], [pad(left.hours), 'часов'], [pad(left.minutes), 'минут'], [pad(left.seconds), 'секунд']]
  return <div className="unity-banner-count" role="timer" aria-label={`До праздника ${left.days} ${daysWord(left.days)}`}>
    <span className="unity-count-title">До праздника</span>
    <div className="unity-count-grid">{cells.map(([value, label]) => <div key={label}><b>{value}</b><small>{label}</small></div>)}</div>
  </div>
}

export function UnityBanner() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  const note = daysToUnity() === 0 ? 'Сегодня занятий нет. Карта и маршруты работают как обычно.' : '4 ноября занятий нет. Карта и маршруты работают как обычно.'
  return <section className="unity-banner container" aria-label={UNITY.title}>
    <div className="unity-banner-card">
      <div className="unity-banner-copy">
        <span className="unity-banner-kicker"><FlagMark />4 ноября</span>
        <strong>С Днём народного единства!</strong>
        <p className="unity-banner-history">В 1612 году народное ополчение Кузьмы Минина и князя Дмитрия Пожарского освободило Москву. В этот день мы вспоминаем, что вместе страна сильнее.</p>
        <p className="unity-banner-note">{note}</p>
        <div className="unity-banner-actions">
          <Link className="unity-banner-link" to="/map">Открыть карту <ArrowRight size={15} aria-hidden="true" /></Link>
          <button type="button" className="unity-banner-salute" onClick={fireConfetti}>Праздничный салют</button>
          <button type="button" className="unity-banner-off" onClick={() => setTheme('light')}>Обычная тема</button>
        </div>
      </div>
      <Countdown />
    </div>
  </section>
}

const FACTS = [
  'Ополчение начали собирать осенью 1611 года в Нижнем Новгороде по призыву земского старосты Кузьмы Минина.',
  'Военным предводителем ополчения стал князь Дмитрий Пожарский.',
  'Праздник учредили в 2004 году, впервые его отметили 4 ноября 2005 года.',
  'Памятник Минину и Пожарскому на Красной площади открыли в 1818 году. Его автор — скульптор Иван Мартос.',
  'На памятнике надпись: «Гражданину Минину и князю Пожарскому благодарная Россия. Лета 1818».',
  '4 ноября — день Казанской иконы Божией Матери, с которой шло ополчение.',
  'В память об освобождении Москвы на Красной площади построили Казанский собор. В 1936 году его снесли, в 1993-м восстановили.',
]

const STRIPE_NAMES = { white: 'белая', blue: 'синяя', red: 'красная' }

function FlagGame() {
  const [stripes, setStripes] = useState(['red', 'white', 'blue'])
  const [moves, setMoves] = useState(0)
  const done = isFlagRight(stripes)
  const celebrated = useRef(false)
  useEffect(() => {
    if (done && !celebrated.current) { celebrated.current = true; fireConfetti() }
    if (!done) celebrated.current = false
  }, [done])
  const turn = (index) => { if (done) return; setStripes((value) => value.map((color, at) => (at === index ? nextStripe(color) : color))); setMoves((value) => value + 1) }
  const reset = () => { setStripes(['blue', 'red', 'white']); setMoves(0) }
  return <article className="unity-card unity-game">
    <span className="unity-card-kicker">Мини-игра</span>
    <h3>Соберите флаг</h3>
    <p>{done ? `Верно: белый, синий, красный. Ходов: ${moves}.` : 'Нажимайте на полосы, чтобы поменять цвет.'}</p>
    <div className={`unity-game-flag${done ? ' is-done' : ''}`} role="group" aria-label="Флаг из трёх полос">
      {stripes.map((color, index) => <button key={index} type="button" className={`unity-stripe unity-stripe-${color}`} onClick={() => turn(index)} disabled={done} aria-label={`Полоса ${index + 1}: ${STRIPE_NAMES[color]}`} />)}
    </div>
    {done && <button type="button" className="unity-card-button" onClick={reset}><RotateCcw size={15} aria-hidden="true" /> Ещё раз</button>}
  </article>
}

function Facts() {
  const [index, setIndex] = useState(0)
  return <article className="unity-card unity-facts">
    <span className="unity-card-kicker">Знаете ли вы?</span>
    <p className="unity-fact" aria-live="polite">{FACTS[index]}</p>
    <div className="unity-facts-foot">
      <span className="unity-facts-dots" aria-hidden="true">{FACTS.map((_, at) => <i key={at} className={at === index ? 'is-active' : ''} />)}</span>
      <button type="button" className="unity-card-button" onClick={() => setIndex((value) => (value + 1) % FACTS.length)}>Следующий факт <ArrowRight size={15} aria-hidden="true" /></button>
    </div>
  </article>
}

export function UnityExtras() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  return <section className="unity-extras container" aria-label="К празднику">
    <div className="section-top"><div><h2>К празднику</h2></div></div>
    <div className="unity-extras-grid"><Facts /><FlagGame /></div>
  </section>
}

export function UnityFooterNote() {
  const theme = useTheme()
  if (theme !== 'unity') return null
  return <div className="unity-footer-note container"><FlagMark /><span>С Днём народного единства! Вместе мы сильнее.</span></div>
}

// Конфетти, когда человек сам включил тему «Единство».
export function UnityThemeWatcher() {
  const theme = useTheme()
  const previous = useRef(theme)
  useEffect(() => {
    if (theme === 'unity' && previous.current !== 'unity') fireConfetti()
    previous.current = theme
  }, [theme])
  return null
}

