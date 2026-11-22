import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowUpRight, Bell, Check, Clapperboard, Film, Inbox, KeyRound, LayoutDashboard, LogOut, Menu, Moon, QrCode, SlidersHorizontal, Sun, TriangleAlert, X } from 'lucide-react'
import { storageGet, storageSet } from '../storage.js'
import { postNotices, readKey, saveKey } from './admin-api.js'

// Оболочка панели /admin: слева меню с разделами по группам, справа раздел.
// На телефоне меню прячется и выезжает по кнопке. Новый раздел добавляется
// одной строкой в NAV (и маршрутом в App.jsx). Карточки для печати ключа не
// требуют — это просто QR-коды.

const NAV = [
  { title: 'Главное', items: [
    { to: '/admin', label: 'Обзор', icon: LayoutDashboard, end: true },
    { to: '/admin/reports', label: 'Обращения', icon: Inbox },
  ] },
  { title: 'Публикации', items: [
    { to: '/admin/notices', label: 'Объявления', icon: Bell },
  ] },
  { title: 'Сайт', items: [
    { to: '/admin/settings', label: 'Темы и маячки', icon: SlidersHorizontal },
    { to: '/admin/cards', label: 'Карточки на двери', icon: QrCode },
  ] },
  { title: 'Видео', items: [
    { to: '/admin/promo', label: 'Промо-ролик', icon: Clapperboard },
    { to: '/admin/cartoon', label: 'Мультик', icon: Film },
  ] },
]
const ALL_ITEMS = NAV.flatMap((group) => group.items)

function useAdminTheme() {
  const [theme, setTheme] = useState(() => storageGet('site-theme') || 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    storageSet('site-theme', theme)
  }, [theme])
  return [theme, () => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))]
}

function LoginCard({ onLogin }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const key = value.trim()
      const data = await postNotices(key, { check: true })
      onLogin(key, data.writable === false ? 'Ключ верный, но сервер не может записать файл рядом с папкой сайта. Проверьте права (deploy/notices.md).' : '')
    } catch (failure) {
      setError(failure.message)
    } finally { setBusy(false) }
  }
  return <form className="adm-login" onSubmit={submit}>
    <span className="adm-login-icon" aria-hidden="true"><KeyRound size={20} /></span>
    <h1>Панель сайта</h1>
    <p>Статистика посещений, объявления на карте, обращения посетителей, темы и карточки для дверей. Введите ключ доступа — его выдаёт команда сайта.</p>
    <label>Ключ доступа<input type="password" value={value} onChange={(event) => setValue(event.target.value)} autoComplete="current-password" autoFocus required /></label>
    {error && <p className="adm-alert adm-alert-bad" role="alert"><TriangleAlert size={16} /> {error}</p>}
    <button className="adm-button adm-button-primary" type="submit" disabled={busy || !value.trim()}>{busy ? 'Проверяем…' : 'Войти'}</button>
    <small>Ключ хранится только в этой вкладке.</small>
  </form>
}

export default function AdminLayout() {
  const location = useLocation()
  const [key, setKey] = useState(readKey)
  const [notice, setNotice] = useState('')
  const [theme, toggleTheme] = useAdminTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  // Карточки, промо-ролик и мультик не секретные: открываются без ключа.
  const open = ['/admin/cards', '/admin/promo', '/admin/cartoon'].some((path) => location.pathname.startsWith(path))

  const login = (value, warning) => { saveKey(value); setKey(value); setNotice(warning) }
  const logout = () => { saveKey(''); setKey(''); setNotice('') }

  const current = ALL_ITEMS.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))

  // Меню на телефоне закрывается при переходе в раздел и по Escape.
  useEffect(() => { setMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return <div className={`adm${menuOpen ? ' adm-menu-open' : ''}`}>
    <header className="adm-bar">
      <button type="button" className="adm-icon" onClick={() => setMenuOpen(true)} aria-label="Открыть меню" aria-expanded={menuOpen} aria-controls="adm-side"><Menu size={18} /></button>
      <strong>{current?.label || 'Панель'}</strong>
    </header>
    <button type="button" className="adm-scrim" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню" tabIndex={menuOpen ? 0 : -1} />
    <aside className="adm-side" id="adm-side">
      <div className="adm-side-head">
        <NavLink to="/admin" className="adm-brand" aria-label="Панель сайта"><img src="/logo.svg" alt="" /><span><strong>ЛОГОС</strong><small>Панель сайта</small></span></NavLink>
        <button type="button" className="adm-icon adm-side-close" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню"><X size={18} /></button>
      </div>
      <nav className="adm-nav" aria-label="Разделы панели">
        {NAV.map((group) => <div key={group.title} className="adm-nav-group">
          <span className="adm-nav-title">{group.title}</span>
          {group.items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `adm-nav-link ${isActive ? 'adm-nav-link-active' : ''}`}><Icon size={17} aria-hidden="true" /><span>{label}</span></NavLink>)}
        </div>)}
      </nav>
      <div className="adm-side-foot">
        <a className="adm-nav-link" href="/"><ArrowUpRight size={17} aria-hidden="true" /><span>Открыть сайт</span></a>
        <button type="button" className="adm-nav-link" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}<span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span></button>
        {key && <button type="button" className="adm-nav-link" onClick={logout}><LogOut size={17} aria-hidden="true" /><span>Выйти</span></button>}
      </div>
    </aside>
    <div className="adm-main">
      {notice && <p className="adm-alert adm-alert-warn" role="status"><TriangleAlert size={16} /> {notice}</p>}
      {key || open ? <Outlet context={{ adminKey: key, logout }} /> : <LoginCard onLogin={login} />}
      {!key && open && <p className="adm-hint"><Check size={14} /> Карточки и видео открыты без ключа. Статистика и объявления — после <NavLink to="/admin">входа</NavLink>.</p>}
    </div>
  </div>
}
