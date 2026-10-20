import { useState } from 'react'
import { Check, Handshake, Send, X } from 'lucide-react'
import { meetLink, shareOrCopy } from '../share.js'

// «Встретиться здесь»: ссылка, по которой у друга откроется маршрут до этого
// места и плашка «Вас ждут» (см. RoutePage, параметр meet).
export default function MeetButton({ room }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState('')
  const [status, setStatus] = useState('')
  const name = `${room.name}${room.number ? ` №${room.number}` : ''}`
  const send = async (event) => {
    event.preventDefault()
    const url = meetLink(window.location.origin, { to: room.id, at })
    const result = await shareOrCopy({ title: 'Встреча в колледже', text: `Встречаемся: ${name}${at ? `, в ${at}` : ''}`, url })
    setStatus(result === 'copied' ? 'Ссылка скопирована — отправьте её в чат' : result === 'shared' ? 'Отправлено' : result === 'failed' ? 'Не удалось скопировать ссылку' : '')
  }
  if (!open) return <button type="button" className="meet-toggle" onClick={() => setOpen(true)}><Handshake size={15} /> Встретиться здесь</button>
  return <form className="meet-box" onSubmit={send}>
    <div className="meet-head"><strong>Позвать сюда</strong><button type="button" className="report-close" onClick={() => { setOpen(false); setStatus('') }} aria-label="Закрыть"><X size={15} /></button></div>
    <label className="meet-time">Во сколько <input type="time" value={at} onChange={(event) => setAt(event.target.value)} /><small>необязательно</small></label>
    <button className="button button-primary meet-send" type="submit"><Send size={14} /> Отправить ссылку</button>
    {status && <p className="meet-status" role="status"><Check size={14} /> {status}</p>}
  </form>
}
