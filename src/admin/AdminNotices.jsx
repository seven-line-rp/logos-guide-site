import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Check, Plus, Save, Trash2, TriangleAlert } from 'lucide-react'
import { rooms } from '../data.js'
import RoomSearchSelect, { roomLabel } from '../components/RoomSearchSelect.jsx'
import { NOTICE_TYPES, fetchNotices, validNotice } from '../notices.js'
import { postNotices } from './admin-api.js'

// Объявления на карте: «лестница закрыта», «концерт в 15:00». Сохраняются в
// api/notices.php по ключу из конфига на сервере (deploy/notices.md).

// datetime-local → ISO с часовым поясом браузера.
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : undefined)
const emptyDraft = { type: 'closed', roomId: 'stairs-middle-1', title: '', text: '', from: '', to: '' }
const when = (value) => new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

export default function AdminNotices() {
  const { adminKey, logout } = useOutletContext()
  const [list, setList] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [status, setStatus] = useState({ kind: '', text: '' })
  const [dirty, setDirty] = useState(false)

  useEffect(() => { fetchNotices().then((value) => setList(Array.isArray(value) ? value : [])) }, [])

  const add = (event) => {
    event.preventDefault()
    const notice = { type: draft.type, roomId: draft.roomId, title: draft.title.trim(), ...(draft.text.trim() ? { text: draft.text.trim() } : {}), ...(draft.from ? { from: fromLocalInput(draft.from) } : {}), ...(draft.to ? { to: fromLocalInput(draft.to) } : {}) }
    if (!validNotice(notice)) { setStatus({ kind: 'bad', text: 'Нужны помещение и заголовок; дата окончания — позже начала.' }); return }
    if (notice.from && notice.to && Date.parse(notice.to) <= Date.parse(notice.from)) { setStatus({ kind: 'bad', text: 'Дата окончания должна быть позже начала.' }); return }
    setList((current) => [...(current || []), notice])
    setDraft({ ...emptyDraft, roomId: draft.roomId, type: draft.type })
    setDirty(true)
    setStatus({ kind: '', text: 'Добавлено. Не забудьте сохранить.' })
  }
  const remove = (index) => { setList((current) => current.filter((_, i) => i !== index)); setDirty(true) }
  const save = async () => {
    setStatus({ kind: '', text: 'Сохраняем…' })
    try {
      const data = await postNotices(adminKey, { notices: list })
      setList(data.notices); setDirty(false)
      setStatus({ kind: 'ok', text: 'Сохранено. Посетители увидят изменения при следующем открытии страницы.' })
    } catch (error) {
      setStatus({ kind: 'bad', text: error.message })
      if (/ключ/i.test(error.message)) logout()
    }
  }

  const room = (id) => rooms.find((item) => item.id === id)
  const now = Date.now()
  const state = (notice) => (notice.to && Date.parse(notice.to) < now ? 'закончилось' : notice.from && Date.parse(notice.from) > now ? 'запланировано' : 'действует')

  return <>
    <div className="adm-head">
      <div><h1>Объявления на карте</h1><p>Закрытые лестницы и лифт маршрут обходит сам. Объявление видно на карте, в карточке помещения и на странице маршрута.</p></div>
      <button type="button" className="adm-button adm-button-primary" onClick={save} disabled={!dirty}><Save size={15} /> Сохранить на сайте</button>
    </div>

    {status.text && <p className={`adm-alert ${status.kind ? `adm-alert-${status.kind}` : ''}`} role="status">{status.kind === 'ok' ? <Check size={16} /> : status.kind === 'bad' ? <TriangleAlert size={16} /> : null} {status.text}</p>}

    <div className="adm-split">
      <section className="adm-card">
        <h2>Сейчас на сайте</h2>
        {list === null ? <p className="adm-muted">Загружаем…</p> : list.length === 0 ? <p className="adm-empty">Объявлений нет. Добавьте первое справа.</p> : <ul className="adm-notices">
          {list.map((notice, index) => <li key={`${notice.roomId}-${index}`} className={`adm-notice adm-notice-${NOTICE_TYPES[notice.type]?.tone || 'info'}`}>
            <span className="adm-notice-type">{NOTICE_TYPES[notice.type]?.label || notice.type}</span>
            <span className="adm-notice-body"><strong>{notice.title}</strong><small>{room(notice.roomId) ? roomLabel(room(notice.roomId)) : notice.roomId}{notice.text ? ` · ${notice.text}` : ''}</small><small>{notice.from ? `с ${when(notice.from)} ` : ''}{notice.to ? `до ${when(notice.to)} ` : ''}· {state(notice)}</small></span>
            <button type="button" className="adm-icon adm-icon-danger" onClick={() => remove(index)} aria-label={`Удалить «${notice.title}»`}><Trash2 size={15} /></button>
          </li>)}
        </ul>}
      </section>

      <form className="adm-card adm-form" onSubmit={add}>
        <h2>Новое объявление</h2>
        <div className="adm-seg" role="radiogroup" aria-label="Тип">{Object.entries(NOTICE_TYPES).map(([id, type]) => <label key={id} className={draft.type === id ? 'adm-seg-active' : ''}><input type="radio" name="type" value={id} checked={draft.type === id} onChange={() => setDraft({ ...draft, type: id })} />{type.label}</label>)}</div>
        <RoomSearchSelect label="Помещение" value={draft.roomId} onChange={(roomId) => setDraft({ ...draft, roomId })} />
        <label>Заголовок<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={60} placeholder="Например: Ремонт лестницы" required /></label>
        <label>Подробности<input value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} maxLength={240} placeholder="Поднимайтесь по центральной лестнице" /></label>
        <div className="adm-dates"><label>С<input type="datetime-local" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label><label>По<input type="datetime-local" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label></div>
        <small className="adm-muted">Без дат объявление висит, пока его не удалят.</small>
        <button className="adm-button" type="submit"><Plus size={15} /> Добавить в список</button>
      </form>
    </div>
  </>
}
