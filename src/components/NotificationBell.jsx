import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, BellRing, TriangleAlert, PartyPopper, Info } from 'lucide-react'
import { NOTICE_TYPES, useNotices } from '../notices.js'
import { currentSubscription, pushSupport } from '../push.js'
import { rooms } from '../data.js'

// Колокольчик в шапке: действующие объявления на карте (закрыто, событие,
// важное) и состояние push-уведомлений на этом устройстве. Настройки — на /notifications.

const NOTICE_ICONS = { closed: TriangleAlert, event: PartyPopper, info: Info }

export function noticeRoomLabel(notice) {
  const room = rooms.find((item) => item.id === notice.roomId)
  return room ? `${room.name}${room.number ? ` №${room.number}` : ''}, ${room.floor} этаж` : ''
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [subscribed, setSubscribed] = useState(null)
  const rootRef = useRef(null)
  const notices = useNotices()
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return undefined
    let alive = true
    currentSubscription().then((subscription) => { if (alive) setSubscribed(Boolean(subscription) && pushSupport().permission === 'granted') }).catch(() => { if (alive) setSubscribed(false) })
    const onPointerDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { alive = false; document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  const count = notices.length
  return <div className="nbell" ref={rootRef}>
    <button type="button" className="nbell-button hd-icon" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="nbell-panel" aria-label={count ? `Уведомления, новых объявлений: ${count}` : 'Уведомления'} title="Уведомления">
      <Bell size={17} />
      {count > 0 && <span className="nbell-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
    </button>
    {open && <section className="nbell-panel" id="nbell-panel" aria-label="Уведомления">
      <h2>Сейчас в колледже</h2>
      {count ? <ul className="nbell-list">
        {notices.map((notice, index) => {
          const Icon = NOTICE_ICONS[notice.type] || Info
          return <li key={`${notice.roomId}-${index}`}>
            <Link to={`/map?floor=${rooms.find((room) => room.id === notice.roomId)?.floor || 1}&room=${encodeURIComponent(notice.roomId)}`} className={`nbell-item bell-${NOTICE_TYPES[notice.type].tone}`}>
              <span className="nbell-item-icon" aria-hidden="true"><Icon size={15} /></span>
              <span><strong>{notice.title}</strong><small>{notice.text || noticeRoomLabel(notice)}</small></span>
            </Link>
          </li>
        })}
      </ul> : <p className="nbell-empty">Всё спокойно: закрытых проходов и событий нет.</p>}
      <Link className="nbell-foot" to="/notifications"><BellRing size={15} aria-hidden="true" />{subscribed ? 'Напоминания включены, настроить' : 'Включить напоминания о парах'}</Link>
    </section>}
  </div>
}
