import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Check, ExternalLink, RefreshCw, RotateCcw, Trash2, TriangleAlert } from 'lucide-react'
import { rooms } from '../data.js'
import { REPORT_KINDS } from '../components/ReportProblem.jsx'
import { FEEDBACK_KINDS } from '../pages/FeedbackPage.jsx'
import { fetchReports, postReport } from './admin-api.js'

// Обращения посетителей: «Сообщить о неточности» в карточке кабинета и форма
// «Сообщить о проблеме» (/feedback). Лежат на сервере в logos-reports
// (public/api/report.php, deploy/reports.md). Здесь их читают, отмечают
// решёнными и удаляют.

const KIND_LABELS = { ...Object.fromEntries(REPORT_KINDS), ...Object.fromEntries(FEEDBACK_KINDS.map((kind) => [kind.id, kind.title])) }
const FILTERS = [['open', 'Новые'], ['map', 'Карта'], ['site', 'Сайт'], ['done', 'Решённые'], ['all', 'Все']]
const when = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
const roomName = (id) => { const room = rooms.find((item) => item.id === id); return room ? `${room.name}${room.number ? ` №${room.number}` : ''}` : id }
// Ссылку из сообщения открываем, только если она ведёт на страницу сайта.
const safePage = (page) => (typeof page === 'string' && /^\/(?![/\\])/.test(page) ? page : '')

export default function AdminReports() {
  const { adminKey, logout } = useOutletContext()
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('open')
  const [status, setStatus] = useState({ kind: '', text: '' })
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState('')

  const fail = (error) => {
    setStatus({ kind: 'bad', text: error.message })
    if (/ключ/i.test(error.message)) logout()
  }
  const load = () => { setBusy('load'); return fetchReports(adminKey).then((value) => { setData(value); setStatus({ kind: '', text: '' }) }).catch(fail).finally(() => setBusy('')) }
  useEffect(() => { load() }, [adminKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id, action) => {
    if (action === 'delete' && confirm !== id) { setConfirm(id); return }
    setBusy(id); setConfirm('')
    try {
      await postReport(adminKey, { action, id })
      await load()
    } catch (error) {
      fail(error)
      setBusy('')
    }
  }

  const items = useMemo(() => data?.items || [], [data])
  const counts = useMemo(() => ({
    open: items.filter((item) => !item.done).length,
    map: items.filter((item) => item.scope !== 'site' && !item.done).length,
    site: items.filter((item) => item.scope === 'site' && !item.done).length,
    done: items.filter((item) => item.done).length,
    all: items.length,
  }), [items])
  const shown = items.filter((item) => filter === 'all' ? true : filter === 'done' ? Boolean(item.done) : !item.done && (filter === 'open' || (filter === 'site') === (item.scope === 'site')))

  return <>
    <div className="adm-head">
      <div><h1>Обращения</h1><p>Сообщения о неточностях на карте и то, что прислали через «Сообщить о проблеме». Разобрались — отметьте решённым.</p></div>
      <div className="adm-head-tools">
        <div className="adm-seg" role="group" aria-label="Какие показать">{FILTERS.map(([id, label]) => <button key={id} type="button" className={filter === id ? 'adm-seg-active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}{data ? ` ${counts[id]}` : ''}</button>)}</div>
        <button type="button" className="adm-icon" onClick={load} disabled={busy === 'load'} aria-label="Обновить" title="Обновить"><RefreshCw size={15} className={busy === 'load' ? 'adm-spin' : ''} /></button>
      </div>
    </div>

    {status.text && <p className={`adm-alert ${status.kind ? `adm-alert-${status.kind}` : ''}`} role="status">{status.kind === 'bad' && <TriangleAlert size={16} />} {status.text}</p>}
    {!data && !status.text && <div className="adm-skeleton" aria-busy="true" aria-label="Загружаем обращения"><i /><i /><i /></div>}

    {data && (shown.length === 0
      ? <p className="adm-empty adm-card">{items.length === 0 ? 'Обращений пока нет. Когда кто-нибудь сообщит о неточности или напишет через форму, оно появится здесь.' : filter === 'open' ? 'Новых обращений нет: всё разобрано.' : 'В этом разделе пусто.'}</p>
      : <ul className="adm-reports">
        {shown.map((item) => {
          const site = item.scope === 'site'
          const page = safePage(item.page)
          const room = !site && rooms.find((entry) => entry.id === item.room)
          return <li key={item.id} className={`adm-card adm-report ${item.done ? 'is-done' : ''}`}>
            <div className="adm-report-head">
              <span className={`adm-report-kind adm-report-${site ? 'site' : 'map'}`}>{KIND_LABELS[item.kind] || item.kind}</span>
              <strong>{site ? 'Сайт' : roomName(item.room)}</strong>
              <time dateTime={item.at}>{when(item.at)}</time>
            </div>
            {item.text ? <p className="adm-report-text">{item.text}</p> : <p className="adm-report-text adm-muted">Без комментария.</p>}
            <dl className="adm-report-meta">
              {item.contact && <div><dt>Контакт</dt><dd>{item.contact}</dd></div>}
              {page && <div><dt>Страница</dt><dd><a className="adm-inline-link" href={page} target="_blank" rel="noreferrer">{page.length > 48 ? `${page.slice(0, 48)}…` : page}</a></dd></div>}
              {item.agent && <div><dt>Браузер</dt><dd>{item.agent}</dd></div>}
              {item.done && <div><dt>Решено</dt><dd>{when(item.done)}</dd></div>}
            </dl>
            <div className="adm-report-actions">
              {room && <a className="adm-button" href={`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> На карте</a>}
              {item.done
                ? <button type="button" className="adm-button" onClick={() => act(item.id, 'reopen')} disabled={busy === item.id}><RotateCcw size={15} /> Вернуть в новые</button>
                : <button type="button" className="adm-button adm-button-primary" onClick={() => act(item.id, 'done')} disabled={busy === item.id}><Check size={15} /> Решено</button>}
              <button type="button" className={`adm-button ${confirm === item.id ? 'adm-button-danger' : ''}`} onClick={() => act(item.id, 'delete')} disabled={busy === item.id}><Trash2 size={15} /> {confirm === item.id ? 'Точно удалить' : 'Удалить'}</button>
            </div>
          </li>
        })}
      </ul>)}
    {data && data.count > items.length && <p className="adm-fine">Показаны последние {items.length} из {data.count}. Остальные лежат в файле logos-reports/reports.jsonl на сервере.</p>}
  </>
}
