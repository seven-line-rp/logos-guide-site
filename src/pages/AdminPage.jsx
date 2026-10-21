import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, KeyRound, Plus, Save, Trash2, TriangleAlert } from 'lucide-react'
import { rooms } from '../data.js'
import RoomSearchSelect, { roomLabel } from '../components/RoomSearchSelect.jsx'
import { NOTICE_TYPES, fetchNotices, validNotice } from '../notices.js'

// Объявления на карте для сотрудников: «лестница закрыта», «концерт в 15:00».
// Страница не в меню, адрес /admin. Сохраняет список в api/notices.php по
// ключу из конфига на сервере (deploy/notices.md). Ключ живёт только в этой
// вкладке (sessionStorage) и пропадает, когда её закрывают.

const KEY_STORAGE = 'logos-admin-key'
const readKey = () => { try { return sessionStorage.getItem(KEY_STORAGE) || '' } catch { return '' } }
const saveKey = (value) => { try { if (value) sessionStorage.setItem(KEY_STORAGE, value); else sessionStorage.removeItem(KEY_STORAGE) } catch { /* приватный режим */ } }

// datetime-local → ISO с часовым поясом браузера.
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : undefined)
const emptyDraft = { type: 'closed', roomId: 'stairs-middle-1', title: '', text: '', from: '', to: '' }

// Ключ уходит в теле запроса, а не в заголовке: в заголовок нельзя положить
// русские буквы (fetch падает), а часть хостингов вырезает свои заголовки.
async function postNotices(key, body) {
  let response
  try {
    response = await fetch('/api/notices.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, key: key.normalize('NFC') }) })
  } catch {
    throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.')
  }
  const text = await response.text()
  let data = null
  try { data = JSON.parse(text) } catch { /* ниже — понятная ошибка */ }
  // Вместо ответа PHP пришла страница сайта или ошибка хостинга.
  if (!data || typeof data !== 'object') {
    throw new Error(response.status === 404 || /<html/i.test(text)
      ? 'Файл api/notices.php не отвечает: загрузите папку api из сборки на хостинг и проверьте, что там включён PHP.'
      : `Сервер ответил ${response.status}, но не PHP-скриптом. Проверьте папку api на хостинге.`)
  }
  if (!response.ok) throw new Error(data.error || `Сервер ответил ${response.status}`)
  return data
}

export default function AdminPage() {
  const [key, setKey] = useState(readKey)
  const [keyInput, setKeyInput] = useState('')
  const [list, setList] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [status, setStatus] = useState({ kind: '', text: '' })
  const [dirty, setDirty] = useState(false)

  useEffect(() => { fetchNotices().then((value) => setList(Array.isArray(value) ? value : [])) }, [])

  const [checking, setChecking] = useState(false)
  const login = async (event) => {
    event.preventDefault()
    setStatus({ kind: '', text: 'Проверяем ключ…' })
    setChecking(true)
    try {
      const data = await postNotices(keyInput.trim(), { check: true })
      setKey(keyInput.trim()); saveKey(keyInput.trim()); setKeyInput('')
      setStatus(data.writable === false ? { kind: 'bad', text: 'Ключ верный, но сервер не может записать файл рядом с папкой сайта. Проверьте права (deploy/notices.md).' } : { kind: 'ok', text: 'Вход выполнен.' })
    } catch (error) {
      setStatus({ kind: 'bad', text: error.message })
    } finally {
      setChecking(false)
    }
  }
  const logout = () => { setKey(''); saveKey('') }

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
      const data = await postNotices(key, { notices: list })
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

  return <section className="admin container">
    <span className="eyebrow">Для сотрудников</span>
    <h1>Объявления на карте</h1>
    <p className="admin-lead">Закрытые лестницы и лифт маршрут обходит сам. Объявление видно на карте, в карточке помещения и на странице маршрута.</p>
    <p className="admin-lead"><Link to="/here">Распечатать QR-таблички «Вы здесь» для дверей</Link> — по ним маршрут строится от того места, где висит табличка.</p>

    {status.text && !(status.kind === 'bad' && !key) && <p className={`admin-status ${status.kind ? `admin-status-${status.kind}` : ''}`} role="status">{status.kind === 'ok' ? <Check size={16} /> : status.kind === 'bad' ? <TriangleAlert size={16} /> : null} {status.text}</p>}

    {!key ? <form className="admin-card admin-login" onSubmit={login}>
      <label><KeyRound size={16} /> Ключ доступа<input type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} autoComplete="current-password" required /></label>
      <button className="button button-primary" type="submit" disabled={checking}>{checking ? 'Проверяем…' : 'Войти'}</button>
      {status.kind === 'bad' && <p className="admin-status admin-status-bad" role="alert"><TriangleAlert size={16} /> {status.text}</p>}
      <small>Ключ — значение notices_key из файла logos-ai-config.php на хостинге. Он хранится только в этой вкладке.</small>
    </form> : <>
      <div className="admin-card">
        <div className="admin-head"><h2>Сейчас на сайте</h2><button type="button" className="admin-link" onClick={logout}>Выйти</button></div>
        {list === null ? <p>Загружаем…</p> : list.length === 0 ? <p className="admin-empty">Объявлений нет.</p> : <ul className="admin-list">
          {list.map((notice, index) => <li key={`${notice.roomId}-${index}`} className={`admin-item admin-item-${NOTICE_TYPES[notice.type]?.tone || 'info'}`}>
            <span className="admin-item-type">{NOTICE_TYPES[notice.type]?.label || notice.type}</span>
            <span className="admin-item-body"><strong>{notice.title}</strong><small>{room(notice.roomId) ? roomLabel(room(notice.roomId)) : notice.roomId}{notice.text ? ` · ${notice.text}` : ''}</small><small>{notice.from ? `с ${new Date(notice.from).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })} ` : ''}{notice.to ? `до ${new Date(notice.to).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })} ` : ''}· {state(notice)}</small></span>
            <button type="button" className="admin-remove" onClick={() => remove(index)} aria-label={`Удалить «${notice.title}»`}><Trash2 size={16} /></button>
          </li>)}
        </ul>}
        <button type="button" className="button button-primary admin-save" onClick={save} disabled={!dirty}><Save size={15} /> Сохранить на сайте</button>
      </div>

      <form className="admin-card admin-form" onSubmit={add}>
        <h2>Новое объявление</h2>
        <div className="admin-types" role="radiogroup" aria-label="Тип">{Object.entries(NOTICE_TYPES).map(([id, type]) => <label key={id} className={draft.type === id ? 'directory-chip directory-chip-active' : 'directory-chip'}><input type="radio" name="type" value={id} checked={draft.type === id} onChange={() => setDraft({ ...draft, type: id })} />{type.label}</label>)}</div>
        <RoomSearchSelect label="Помещение" value={draft.roomId} onChange={(roomId) => setDraft({ ...draft, roomId })} />
        <label>Заголовок<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={60} placeholder="Например: Ремонт лестницы" required /></label>
        <label>Подробности<input value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} maxLength={240} placeholder="Поднимайтесь по центральной лестнице" /></label>
        <div className="admin-dates"><label>С<input type="datetime-local" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label><label>По<input type="datetime-local" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label></div>
        <small>Без дат объявление висит, пока его не удалят.</small>
        <button className="button admin-add" type="submit"><Plus size={15} /> Добавить в список</button>
      </form>
    </>}
    <p className="admin-foot"><Link to="/map">← К карте</Link></p>
  </section>
}

