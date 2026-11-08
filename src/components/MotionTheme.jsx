import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { rooms } from '../data.js'
import { translate, useLanguage } from '../i18n.js'
import { useTheme } from '../theme.js'

// Части темы Motion (src/theme.js): светлая «бумага», графитовый текст, один
// лаймовый сигнал. Движение — только по делу: появление при загрузке, отклик на
// наведение и нажатие. Ничего не двигается само по себе бесконечно.
// Стили — src/motion-theme.css (токены в начале файла).

const pad = (value) => String(value).padStart(2, '0')

// Часы с точностью до минуты: секунды в макете отвлекали бы от главного.
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(timer)
  }, [])
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// Заголовок по словам: каждое слово один раз выезжает снизу из-под маски.
export function MotionWords({ text }) {
  useLanguage()
  const words = translate(text).split(' ')
  return <span className="mo-words" aria-label={translate(text)}>{words.map((word, index) => <Fragment key={`${word}-${index}`}>{index > 0 && ' '}<span className="mo-word" aria-hidden="true"><span style={{ '--i': index }}>{word}</span></span></Fragment>)}</span>
}

// Строка над заголовком: вместо декоративного значка — короткая справка о навигаторе.
export function MotionChip() {
  const theme = useTheme()
  if (theme !== 'motion') return null
  return <div className="mo-intro"><span className="mo-intro-mark" aria-hidden="true" />Колледж «Логос» <span aria-hidden="true">/</span> 2 этажа <span aria-hidden="true">/</span> {rooms.length} помещений</div>
}

const PLAN_ROOMS = [[14, 14, 70, 52], [92, 14, 60, 52], [160, 14, 70, 52], [238, 14, 68, 52], [14, 104, 90, 52], [112, 104, 58, 52], [178, 104, 128, 52]]
const PLAN_ROUTE = 'M40 66 V 85 H 240 V 104'

// Схема этажа в карточке: маршрут прорисовывается один раз, точка встаёт у двери.
function MiniPlan() {
  return <svg className="mo-plan" viewBox="0 0 320 170" aria-hidden="true">
    {PLAN_ROOMS.map(([x, y, w, h], index) => <rect key={index} className={index === 6 ? 'mo-plan-target' : 'mo-plan-room'} x={x} y={y} width={w} height={h} rx="6" />)}
    <path className="mo-plan-route-bg" d={PLAN_ROUTE} />
    <path className="mo-plan-route" d={PLAN_ROUTE} pathLength="100" />
    <circle className="mo-plan-start" cx="40" cy="66" r="4" />
    <g className="mo-plan-dot"><circle r="8" /><circle r="4" /></g>
  </svg>
}

// Сцена справа на главной: спокойный «экран продукта» — маршрут и следующая пара.
export function MotionStage() {
  const clock = useClock()
  return <div className="mo-stage" aria-hidden="true">
    <div className="mo-card mo-card-route">
      <div className="mo-card-head">
        <span className="mo-card-title"><i />Маршрут</span>
        <span className="mo-mono">{clock}</span>
      </div>
      <MiniPlan />
      <div className="mo-card-bottom">
        <div className="mo-route-names"><span className="mo-mono">Откуда → куда</span><strong>Вход → 217</strong></div>
        <dl className="mo-route-stats">
          <div><dt className="mo-mono">Время</dt><dd>2 мин</dd></div>
          <div><dt className="mo-mono">Путь</dt><dd>48 м</dd></div>
        </dl>
      </div>
    </div>
    <div className="mo-card mo-card-next">
      <span className="mo-mono">Следующая пара</span>
      <div className="mo-next-row"><b>217</b><span><strong>Физика</strong><small>2 этаж · через 12 мин</small></span></div>
    </div>
  </div>
}

// Оглавление разделов под главным экраном: неподвижное, с номерами.
const SECTIONS = [['/map', 'Карта этажей'], ['/route', 'Маршрут до двери'], ['/rooms', 'Кабинеты'], ['/teachers', 'Преподаватели'], ['/schedule', 'Расписание'], ['/ai', 'ИИ-помощник'], ['/games', 'Игры'], ['/tour', 'Экскурсия в 3D']]

export function MotionIndex() {
  const theme = useTheme()
  useLanguage()
  if (theme !== 'motion') return null
  return <nav className="mo-sections" aria-label="Разделы сайта">
    <ol className="container mo-sections-list">
      {SECTIONS.map(([to, label], index) => <li key={to}><Link to={to}><span className="mo-mono">{pad(index + 1)}</span><span className="mo-sections-name">{translate(label)}</span><ArrowUpRight size={16} aria-hidden="true" /></Link></li>)}
    </ol>
  </nav>
}

// Полоска прокрутки страницы вверху экрана (CSS scroll-timeline).
export function MotionProgress() {
  const theme = useTheme()
  if (theme !== 'motion') return null
  return <div className="mo-scroll-progress" aria-hidden="true" />
}
