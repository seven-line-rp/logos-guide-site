import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowUpRight, Bell, BellRing, Check, Clapperboard, KeyRound, LayoutDashboard, LogOut, Moon, QrCode, Sun, TriangleAlert } from 'lucide-react'
import { storageGet, storageSet } from '../storage.js'
import { postNotices, readKey, saveKey } from './admin-api.js'

// Оболочка панели /admin: своя шапка вместо сайтовой, вход по ключу и
// вложенные разделы (Обзор, Объявления, Уведомления, Карточки). Карточки для печати
// ключа не требуют — это просто QR-коды.

const NAV = [
  { to: '/admin', label: 'Обзор', icon: LayoutDashboard, end: true },
  { to: '/admin/notices', label: 'Объявления', icon: Bell },
  { to: '/admin/push', label: 'Уведомления', icon: BellRing },
  { to: '/admin/cards', label: 'Карточки', icon: QrCode },
  { to: '/admin/promo', label: 'Промо-ролик', icon: Clapperboard },
]

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
    <p>Статистика посещений, объявления на карте, уведомления и карточки для дверей. Введите ключ доступа — его выдаёт команда сайта.</p>
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
  // Карточки и промо-ролик не секретные: открываются без ключа.
  const open = location.pathname.startsWith('/admin/cards') || location.pathname.startsWith('/admin/promo')

  const login = (value, warning) => { saveKey(value); setKey(value); setNotice(warning) }
  const logout = () => { saveKey(''); setKey(''); setNotice('') }

  return <div className="adm">
    <header className="adm-top">
      <div className="adm-top-inner">
        <NavLink to="/admin" className="adm-brand" aria-label="Панель сайта"><img src="/logo.svg" alt="" /><span><strong>ЛОГОС</strong><small>Панель</small></span></NavLink>
        <nav className="adm-nav" aria-label="Разделы панели">
          {NAV.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `adm-nav-link ${isActive ? 'adm-nav-link-active' : ''}`}><Icon size={16} aria-hidden="true" /><span>{label}</span></NavLink>)}
        </nav>
        <div className="adm-top-actions">
          <button type="button" className="adm-icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <a className="adm-icon adm-icon-text" href="/"><span>На сайт</span><ArrowUpRight size={14} aria-hidden="true" /></a>
          {key && <button type="button" className="adm-icon" onClick={logout} aria-label="Выйти" title="Выйти"><LogOut size={16} /></button>}
        </div>
      </div>
    </header>
    <div className="adm-main">
      {notice && <p className="adm-alert adm-alert-warn" role="status"><TriangleAlert size={16} /> {notice}</p>}
      {key || open ? <Outlet context={{ adminKey: key, logout }} /> : <LoginCard onLogin={login} />}
      {!key && open && <p className="adm-hint"><Check size={14} /> Карточки и промо-ролик открыты без ключа. Статистика и объявления — после <NavLink to="/admin">входа</NavLink>.</p>}
    </div>
  </div>
}
