import { useState } from 'react'
import { Check, Flag, Send, X } from 'lucide-react'

// «Сообщить о неточности»: короткая форма в карточке помещения. Сообщение
// уходит на /api/report.php (см. deploy/reports.md) вместе с id помещения.

export const REPORT_KINDS = [
  ['wrong-place', 'Не там на плане'],
  ['closed', 'Закрыто или нет прохода'],
  ['moved', 'Переехало'],
  ['wrong-name', 'Другое название или номер'],
  ['other', 'Другое'],
]

export default function ReportProblem({ room }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('')
  const [text, setText] = useState('')
  const [state, setState] = useState({ status: 'idle', error: '' })

  const close = () => { setOpen(false); setKind(''); setText(''); setState({ status: 'idle', error: '' }) }
  const send = async (event) => {
    event.preventDefault()
    if (!kind) { setState({ status: 'idle', error: 'Выберите, что не так.' }); return }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setState({ status: 'idle', error: 'Нет интернета. Попробуйте, когда появится сеть.' }); return }
    setState({ status: 'sending', error: '' })
    try {
      const response = await fetch('/api/report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: room.id, kind, text, page: `${location.pathname}${location.search}`, website: event.currentTarget.website?.value || '' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Не получилось отправить. Попробуйте позже.')
      setState({ status: 'sent', error: '' })
    } catch (error) {
      setState({ status: 'idle', error: error.message || 'Не получилось отправить. Попробуйте позже.' })
    }
  }

  if (!open) return <button className="report-toggle" onClick={() => setOpen(true)}><Flag size={14} /> Сообщить о неточности</button>
  if (state.status === 'sent') return <div className="report-box report-done" role="status"><Check size={18} /><span><strong>Спасибо!</strong> Команда проверит «{room.name}» и поправит карту.</span><button className="report-close" onClick={close} aria-label="Закрыть"><X size={15} /></button></div>

  return <form className="report-box" onSubmit={send}>
    <div className="report-head"><strong>Что не так с «{room.name}»?</strong><button type="button" className="report-close" onClick={close} aria-label="Закрыть"><X size={15} /></button></div>
    <div className="report-kinds" role="radiogroup" aria-label="Что не так">
      {REPORT_KINDS.map(([id, label]) => <label key={id} className={kind === id ? 'report-kind report-kind-active' : 'report-kind'}><input type="radio" name="kind" value={id} checked={kind === id} onChange={() => setKind(id)} />{label}</label>)}
    </div>
    <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={600} rows={3} placeholder={kind === 'other' ? 'Опишите, что не так' : 'Комментарий, если хотите'} aria-label="Комментарий" />
    <input className="report-trap" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    {state.error && <p className="report-error" role="alert">{state.error}</p>}
    <button className="button button-primary report-send" type="submit" disabled={state.status === 'sending'}><Send size={14} /> {state.status === 'sending' ? 'Отправляем…' : 'Отправить'}</button>
    <p className="report-note">Отправятся только помещение, выбранный вариант и ваш комментарий.</p>
  </form>
}
