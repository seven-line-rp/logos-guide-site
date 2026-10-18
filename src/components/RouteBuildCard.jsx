import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, DoorOpen, Footprints, Layers, LoaderCircle, MapPin, MoveUp, Sparkles, Timer } from 'lucide-react'

const STAGE_MS = 460

// Как LOGOS AI «строит» маршрут в чате: этапы загораются по очереди, потом
// карточка показывает настоящие метрики (их считает тот же код, что и
// страница маршрута) и предлагает открыть маршрут на карте.
export default function RouteBuildCard({ route, autoOpen = false, onOpen, onSettled }) {
  const stages = [
    { id: 'plan', label: 'Смотрю план этажей', Icon: Layers },
    { id: 'corridors', label: 'Ищу коридоры и двери', Icon: DoorOpen },
    ...(route.crossFloor
      ? [{ id: 'transfer', label: `Считаю переход: ${route.transfer || 'между этажами'}`, Icon: MoveUp }]
      : []),
    { id: 'done', label: 'Маршрут готов', Icon: Check },
  ]
  const last = stages.length - 1
  // Восстановленный из истории диалог показываем сразу готовым: заново
  // «строить» уже построенный маршрут при каждой перезагрузке странно.
  const [stage, setStage] = useState(route.settled ? last : 0)
  const done = stage >= last
  const settledRef = useRef(false)

  useEffect(() => {
    if (done) return undefined
    const timer = window.setTimeout(() => setStage((current) => Math.min(current + 1, last)), STAGE_MS)
    return () => window.clearTimeout(timer)
  }, [stage, done, last])

  useEffect(() => {
    if (!done || route.settled || settledRef.current) return
    settledRef.current = true
    onSettled?.()
  }, [done, route.settled, onSettled])

  useEffect(() => {
    if (!done || !autoOpen) return undefined
    const timer = window.setTimeout(() => onOpen?.(route), 750)
    return () => window.clearTimeout(timer)
  }, [done, autoOpen, onOpen, route])

  const progress = Math.round(((stage + 1) / stages.length) * 100)

  return (
    <div className={`ai-route-card ${done ? 'ai-route-card-done' : ''}`}>
      <div className="ai-route-head">
        <span className="ai-route-badge"><Sparkles size={13} /> LOGOS AI строит маршрут</span>
        {!done && <span className="ai-route-percent">{progress}%</span>}
      </div>

      <div className="ai-route-points">
        <span className="ai-route-point"><MapPin size={13} />{route.fromLabel}<em>{route.fromFloor} этаж</em></span>
        <span className="ai-route-line" aria-hidden="true"><i /></span>
        <span className="ai-route-point ai-route-point-end"><MapPin size={13} />{route.toLabel}<em>{route.toFloor} этаж</em></span>
      </div>

      <ul className="ai-route-stages">
        {stages.map((item, index) => (
          <li
            key={item.id}
            className={index < stage ? 'ai-route-stage-done' : index === stage ? 'ai-route-stage-active' : 'ai-route-stage-idle'}
          >
            <span className="ai-route-stage-icon">
              {index < stage ? <Check size={12} strokeWidth={3} /> : index === stage && !done ? <LoaderCircle size={12} className="ai-route-spin" /> : <item.Icon size={12} />}
            </span>
            {item.label}
          </li>
        ))}
      </ul>

      {done && <div className="ai-route-result">
        <div className="ai-route-metrics">
          <span><strong>{route.meters}</strong> м</span>
          <span><strong>≈{route.minutes}</strong> мин</span>
          <span><Footprints size={13} /> <strong>{route.footsteps}</strong> шагов</span>
          {route.crossFloor && <span><Timer size={13} /> {route.transfer}</span>}
        </div>
        {route.variants > 1 && <p className="ai-route-note">Есть {route.variants} варианта перехода — их можно сравнить на странице маршрута.</p>}
        {route.samePlace && <p className="ai-route-note">Похоже, вы уже на месте — маршрут не нужен.</p>}
        <Link className="ai-route-open" to={route.link} onClick={() => onOpen?.(route, { silent: true })}>
          Открыть маршрут на карте <ArrowRight size={15} />
        </Link>
      </div>}
    </div>
  )
}
