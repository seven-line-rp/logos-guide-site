import { useEffect, useState } from 'react'
import { roomDetails } from '../room-info.js'

// «Что сейчас» по звонкам и известные факты о помещении. Обновляется раз в 30 секунд.
export default function RoomInfo({ room }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const { status, facts } = roomDetails(room, now)
  if (!status && !facts.length) return null
  return <>
    {status && <div className={`room-status room-status-${status.tone}`} role="status"><span className="room-status-dot" aria-hidden="true" /><span>{status.text}</span></div>}
    {facts.length > 0 && <dl className="room-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
  </>
}
