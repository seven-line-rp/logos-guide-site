import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Bluetooth, Check, Flower2, Moon, Plus, Save, Sun, Trash2, TriangleAlert } from 'lucide-react'
import { rooms } from '../data.js'
import RoomSearchSelect, { roomLabel } from '../components/RoomSearchSelect.jsx'
import { BEACONS_MAX, SETTINGS_API, applySiteSettings, cleanBeacon, cleanSettings } from '../site-settings.js'
import { postSettings } from './admin-api.js'

// Настройки сайта для всех посетителей: какие темы можно выбрать и где висят
// Bluetooth-маячки. Сохраняются в api/settings.php тем же ключом, что и
// объявления; сайт подхватывает их при следующем открытии страницы.

const THEME_ROWS = [
  { id: 'light', icon: Sun, title: 'Светлая', hint: 'Основная тема. Всегда включена: на неё сайт переходит, если другую выключили.' },
  { id: 'dark', icon: Moon, title: 'Тёмная', hint: 'Спокойная тёмная тема для вечера и слабого света.' },
  { id: 'v2', icon: Moon, title: 'Логос 2.0', hint: 'Графитовая тема с компасом и панорамой этажей.' },
  { id: 'pickme', icon: Flower2, title: 'Пикми', hint: 'Розовая, с цветами на главном экране и сердечками.' },
]
const emptyBeacon = { id: '', roomId: 'hall-1', tx: '-59' }

export default function AdminSettings() {
  const { adminKey, logout } = useOutletContext()
  const [settings, setSettings] = useState(null)
  const [draft, setDraft] = useState(emptyBeacon)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState({ kind: '', text: '' })

  useEffect(() => {
    let alive = true
    fetch(SETTINGS_API, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.status === 404 ? 'На сервере ещё нет api/settings.php: выложите свежую сборку сайта.' : `Сервер ответил ${response.status}`))))
      .then((value) => { if (alive) setSettings(cleanSettings(value)) })
      .catch((error) => { if (alive) { setSettings(cleanSettings(null)); setStatus({ kind: 'bad', text: error.message }) } })
    return () => { alive = false }
  }, [])

  const save = async (patch, done) => {
    setBusy(Object.keys(patch)[0]); setStatus({ kind: '', text: 'Сохраняем…' })
    try {
      const saved = cleanSettings(await postSettings(adminKey, patch))
      setSettings(saved)
      applySiteSettings(saved) // в этой вкладке сразу, у посетителей — при следующем открытии
      setStatus({ kind: 'ok', text: done })
      return true
    } catch (error) {
      setStatus({ kind: 'bad', text: error.message })
      if (/ключ/i.test(error.message)) logout()
      return false
    } finally { setBusy('') }
  }

  const toggleTheme = (id) => {
    const themes = settings.themes.includes(id) ? settings.themes.filter((theme) => theme !== id) : [...settings.themes, id]
    save({ themes }, themes.includes(id) ? 'Тема включена для всех.' : 'Тема выключена. У тех, кто её выбрал, сайт станет светлым при следующем открытии.')
  }

  const addBeacon = (event) => {
    event.preventDefault()
    const beacon = cleanBeacon({ id: draft.id, roomId: draft.roomId, tx: draft.tx === '' ? -59 : Number(draft.tx) })
    if (!beacon) { setStatus({ kind: 'bad', text: 'Нужны имя маячка и помещение.' }); return }
    if (settings.beacons.some((item) => item.id.toLowerCase() === beacon.id.toLowerCase())) { setStatus({ kind: 'bad', text: 'Маячок с таким именем уже есть в списке.' }); return }
    if (settings.beacons.length >= BEACONS_MAX) { setStatus({ kind: 'bad', text: `Не больше ${BEACONS_MAX} маячков.` }); return }
    setSettings({ ...settings, beacons: [...settings.beacons, beacon] })
    setDraft({ ...emptyBeacon, roomId: draft.roomId, tx: draft.tx })
    setDirty(true)
    setStatus({ kind: '', text: 'Добавлено в список. Не забудьте сохранить.' })
  }
  const removeBeacon = (id) => { setSettings({ ...settings, beacons: settings.beacons.filter((item) => item.id !== id) }); setDirty(true) }
  const saveBeacons = async () => { if (await save({ beacons: settings.beacons }, 'Маячки сохранены. Сайт начнёт слушать их при следующем открытии карты.')) setDirty(false) }

  if (!settings) return <div className="adm-skeleton" aria-busy="true" aria-label="Загружаем настройки"><i /><i /></div>

  return <>
    <div className="adm-head">
      <div><h1>Темы и маячки</h1><p>Настройки для всех посетителей сайта. Меняются сразу, без пересборки.</p></div>
    </div>

    {status.text && <p className={`adm-alert ${status.kind ? `adm-alert-${status.kind}` : ''}`} role="status">{status.kind === 'ok' ? <Check size={16} /> : status.kind === 'bad' ? <TriangleAlert size={16} /> : null} {status.text}</p>}

    <section className="adm-card">
      <div className="adm-card-head"><div><h2>Темы оформления</h2><span className="adm-muted">Выключенная тема пропадает из меню у всех.</span></div></div>
      <ul className="adm-toggles">
        {THEME_ROWS.map(({ id, icon: Icon, title, hint }) => {
          const on = settings.themes.includes(id)
          return <li key={id}>
            <label className="adm-toggle">
              <span className="adm-toggle-icon" aria-hidden="true"><Icon size={17} /></span>
              <span className="adm-toggle-text"><strong>{title}</strong><small>{hint}</small></span>
              <input type="checkbox" role="switch" checked={on} disabled={id === 'light' || busy === 'themes'} onChange={() => toggleTheme(id)} />
              <i aria-hidden="true" />
            </label>
          </li>
        })}
      </ul>
    </section>

    <div className="adm-split">
      <section className="adm-card">
        <div className="adm-card-head">
          <div><h2>Bluetooth-маячки</h2><span className="adm-muted">{settings.beacons.length ? `В списке: ${settings.beacons.length}` : 'Список пуст'}</span></div>
          <button type="button" className="adm-button adm-button-primary" onClick={saveBeacons} disabled={!dirty || busy === 'beacons'}><Save size={15} /> Сохранить маячки</button>
        </div>
        {settings.beacons.length === 0 ? <p className="adm-empty">Маячков пока нет. Без них место на карте определяется только по GPS.</p> : <ul className="adm-notices">
          {settings.beacons.map((beacon) => { const room = rooms.find((item) => item.id === beacon.roomId); return <li key={beacon.id} className="adm-notice adm-notice-info">
            <span className="adm-notice-type"><Bluetooth size={13} aria-hidden="true" /> {room?.floor} эт.</span>
            <span className="adm-notice-body"><strong>{beacon.id}</strong><small>{room ? roomLabel(room) : beacon.roomId} · мощность на 1 м: {beacon.tx} дБм</small></span>
            <button type="button" className="adm-icon adm-icon-danger" onClick={() => removeBeacon(beacon.id)} aria-label={`Удалить маячок ${beacon.id}`}><Trash2 size={15} /></button>
          </li> })}
        </ul>}
        <p className="adm-fine">Маячок — любая BLE-метка, которая передаёт своё имя (или iBeacon). Повесьте её у двери и запишите сюда. Чем больше маячков в коридорах, тем точнее место: с одним сайт знает «вы рядом с этим кабинетом», с двумя-тремя считает точку между ними. Работает в Chrome на Android (в chrome://flags нужно включить Experimental Web Platform features); на iPhone браузеры сайту Bluetooth не дают, там остаётся GPS.</p>
      </section>

      <form className="adm-card adm-form" onSubmit={addBeacon}>
        <h2>Новый маячок</h2>
        <label>Имя в эфире<input value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} maxLength={80} placeholder="LOGOS-211 или uuid:major:minor" required /></label>
        <small className="adm-muted">Как маячок называется в списке Bluetooth-устройств. Для iBeacon — UUID, major и minor через двоеточие.</small>
        <RoomSearchSelect label="У какого помещения висит" value={draft.roomId} onChange={(roomId) => setDraft({ ...draft, roomId })} />
        <label>Мощность на 1 м, дБм<input type="number" min="-100" max="-20" step="1" value={draft.tx} onChange={(event) => setDraft({ ...draft, tx: event.target.value })} /></label>
        <small className="adm-muted">Написана на маячке или в его приложении (Measured Power). Если не знаете, оставьте −59.</small>
        <button className="adm-button" type="submit"><Plus size={15} /> Добавить в список</button>
      </form>
    </div>
  </>
}
