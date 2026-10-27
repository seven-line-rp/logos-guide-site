import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Check, Laptop, RefreshCw, Send, Smartphone, TriangleAlert, Users } from 'lucide-react'
import { PUSH_KINDS } from '../push.js'
import { SITE_VERSION_LABEL } from '../version.js'
import { postPush } from './admin-api.js'

// Рассылка push-уведомлений всем, кто включил их на /testNotification и
// выбрал нужную тему. Звонки, события из объявлений и новую версию сайта
// сервер присылает и сам, по крону (deploy/push.md).

const KINDS = ['news', 'event', 'update', 'lesson-start']
const TOPIC_OF = { news: 'news', event: 'events', update: 'updates', 'lesson-start': 'lessons' }
const LINKS = [['/', 'Главная'], ['/map', 'Карта'], ['/schedule', 'Расписание'], ['/route', 'Маршрут']]
const PRESETS = [
  { label: 'Новая версия сайта', kind: 'update', title: `ЛОГОС обновился: ${SITE_VERSION_LABEL}`, body: 'Посмотрите, что нового на сайте.', url: '/' },
  { label: 'Пары отменены', kind: 'lesson-start', title: 'Сегодня пары отменяются', body: 'Подробности у куратора и в учебной части.', url: '/schedule' },
  { label: 'Мероприятие', kind: 'event', title: 'Концерт в актовом зале', body: 'Сегодня в 15:00, вход свободный.', url: '/map?room=auditorium-104' },
]
const empty = { kind: 'news', title: '', body: '', url: '/' }
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

export default function AdminPush() {
  const { adminKey, logout } = useOutletContext()
  const [stats, setStats] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [confirm, setConfirm] = useState(false)
  const [status, setStatus] = useState({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)

  const fail = (error) => {
    setStatus({ kind: 'bad', text: error.message })
    if (/ключ/i.test(error.message)) logout()
  }
  const load = () => postPush(adminKey, { action: 'count' }).then(setStats).catch(fail)
  useEffect(() => { load() }, [adminKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => { setDraft({ ...draft, ...patch }); setConfirm(false) }
  const recipients = stats ? stats.topics[TOPIC_OF[draft.kind]] || 0 : null
  const url = draft.url.trim() || '/'
  const validUrl = /^\/(?![/\\])/.test(url)

  const send = async (event) => {
    event.preventDefault()
    if (!draft.title.trim()) { setStatus({ kind: 'bad', text: 'Напишите заголовок.' }); return }
    if (!validUrl) { setStatus({ kind: 'bad', text: 'Ссылка должна вести на страницу сайта и начинаться с «/».' }); return }
    if (!confirm) { setConfirm(true); return }
    setBusy(true); setStatus({ kind: '', text: 'Отправляем…' })
    try {
      const result = await postPush(adminKey, { action: 'send', kind: draft.kind, title: draft.title, body: draft.body, url })
      setStatus({ kind: result.sent ? 'ok' : 'bad', text: result.total ? `Доставлено ${result.sent} из ${result.total}.${result.removed ? ` Удалено отписавшихся: ${result.removed}.` : ''}${result.failed ? ` Не приняли сервисы: ${result.failed}.` : ''}` : 'Никто не подписан на эту тему.' })
      if (result.sent) setDraft({ ...empty, kind: draft.kind })
      load()
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false); setConfirm(false)
    }
  }

  return <>
    <div className="adm-head">
      <div><h1>Уведомления</h1><p>Push-сообщение всем, кто включил уведомления на <a className="adm-inline-link" href="/testNotification" target="_blank" rel="noreferrer">/testNotification</a>. Пока это тестовый режим.</p></div>
      <button type="button" className="adm-button" onClick={load}><RefreshCw size={15} /> Обновить</button>
    </div>

    {status.text && <p className={`adm-alert ${status.kind ? `adm-alert-${status.kind}` : ''}`} role="status">{status.kind === 'ok' ? <Check size={16} /> : status.kind === 'bad' ? <TriangleAlert size={16} /> : null} {status.text}</p>}

    <div className="adm-kpis">
      <div className="adm-kpi adm-kpi-static"><span className="adm-kpi-label"><Users size={14} /> Подписчики</span><strong>{stats ? stats.total : '—'}</strong><small>устройств с уведомлениями</small></div>
      <div className="adm-kpi adm-kpi-static"><span className="adm-kpi-label"><Smartphone size={14} /> Телефоны</span><strong>{stats ? stats.platforms.android + stats.platforms.ios : '—'}</strong><small>{stats ? `Android ${stats.platforms.android} · iPhone ${stats.platforms.ios}` : 'Android и iPhone'}</small></div>
      <div className="adm-kpi adm-kpi-static"><span className="adm-kpi-label"><Laptop size={14} /> Компьютеры</span><strong>{stats ? stats.platforms.desktop : '—'}</strong><small>{stats?.cron === today() ? 'Крон по звонкам работает' : 'Крон сегодня не запускался'}</small></div>
    </div>

    <div className="adm-split">
      <form className="adm-card adm-form" onSubmit={send}>
        <h2>Новое уведомление</h2>
        <div className="adm-presets"><span className="adm-muted">Шаблоны:</span>{PRESETS.map((preset) => <button key={preset.label} type="button" className="adm-chip" onClick={() => set({ kind: preset.kind, title: preset.title, body: preset.body, url: preset.url })}>{preset.label}</button>)}</div>
        <div className="adm-seg" role="radiogroup" aria-label="Тема">{KINDS.map((kind) => <label key={kind} className={draft.kind === kind ? 'adm-seg-active' : ''}><input type="radio" name="kind" value={kind} checked={draft.kind === kind} onChange={() => set({ kind })} />{kind === 'lesson-start' ? 'Пары' : PUSH_KINDS[kind].label}</label>)}</div>
        <label>Заголовок<input value={draft.title} onChange={(event) => set({ title: event.target.value })} maxLength={60} placeholder="Например: Завтра день открытых дверей" required /></label>
        <label><span className="adm-label-row">Текст<small className="adm-muted">{draft.body.length}/180</small></span><textarea value={draft.body} onChange={(event) => set({ body: event.target.value })} maxLength={180} rows={3} placeholder="Начало в 11:00, актовый зал" /></label>
        <label>Ссылка при нажатии<input value={draft.url} onChange={(event) => set({ url: event.target.value })} maxLength={200} placeholder="/map" /></label>
        <div className="adm-presets">{LINKS.map(([to, label]) => <button key={to} type="button" className={`adm-chip ${url === to ? 'adm-chip-active' : ''}`} onClick={() => set({ url: to })}>{label}</button>)}</div>
        <button className={`adm-button ${confirm ? 'adm-button-danger' : 'adm-button-primary'}`} type="submit" disabled={busy || !draft.title.trim() || recipients === 0}>
          <Send size={15} /> {busy ? 'Отправляем…' : confirm ? `Да, отправить ${recipients ?? ''} подписчикам` : 'Отправить'}
        </button>
        {confirm && !busy && <small className="adm-muted">Отменить отправку нельзя. Нажмите ещё раз, чтобы подтвердить, или измените текст.</small>}
        {recipients === 0 && <small className="adm-muted">На тему «{draft.kind === 'lesson-start' ? 'Пары' : PUSH_KINDS[draft.kind].label}» пока никто не подписан.</small>}
      </form>

      <section className="adm-card adm-push-preview">
        <h2>Так увидят на телефоне</h2>
        <div className="adm-push-phone">
          <div className="adm-push-note">
            <img src="/apple-touch-icon.png" alt="" />
            <div><span><strong>ЛОГОС</strong> · сейчас</span><strong>{draft.title.trim() || 'Заголовок уведомления'}</strong>{(draft.body.trim() || !draft.title.trim()) && <p>{draft.body.trim() || 'Текст уведомления появится здесь.'}</p>}</div>
          </div>
        </div>
        <p className="adm-muted">Получат: {recipients === null ? '…' : recipients} · при нажатии откроется {url}</p>
        <p className="adm-fine">Сами по себе приходят: напоминание за 5 минут до пары и в её конце (по звонкам), события из «Объявлений» и сообщение о новой версии после выкладки. Для этого на хостинге нужен крон, см. deploy/push.md.</p>
      </section>
    </div>
  </>
}
