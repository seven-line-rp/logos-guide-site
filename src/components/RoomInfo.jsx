import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { roomDetails } from '../room-info.js'

// «Что сейчас» по звонкам, известные факты и пункты «Что здесь». Обновляется раз в 30 секунд.
export default function RoomInfo({ room }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const { status, facts, notes } = roomDetails(room, now)
  if (!status && !facts.length && !notes.length) return null
  return <>
    {status && <div className={`room-status room-status-${status.tone}`} role="status"><span className="room-status-dot" aria-hidden="true" /><span>{status.text}</span></div>}
    {notes.length > 0 && <div className="room-notes"><span className="room-notes-title">Что здесь</span><ul>{notes.map((note) => <li key={note}><Check size={15} aria-hidden="true" />{note}</li>)}</ul></div>}
    {facts.length > 0 && <dl className="room-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
  </>
}
