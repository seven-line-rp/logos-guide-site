import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BookOpen, Check, MapPin, Moon, Search, Sparkles, Sun, X } from 'lucide-react'
import { navigation, rooms } from '../data'
import { lockBodyScroll, storageGet, storageSet } from '../storage'
import { setLanguage, useLanguage, searchableRoom } from '../i18n.js'
import { isSearchShortcut } from '../shortcuts.js'
import { startTour } from '../tour-bus.js'
import { openCookieSettings } from '../consent.js'
import { SITE_AUTHOR, SITE_VERSION_LABEL } from '../version.js'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toast, setToast] = useState('')
  const timer = useRef(null)
  const notify = useCallback((message) => {
    setToast(message)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(''), 2500)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className={`toast ${toast ? 'toast-visible' : ''}`} role="status" aria-live="polite"><span className="toast-icon"><Check size={15} /></span>{toast}</div>
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }

function Brand() {
  return <Link className="brand" to="/" aria-label="Колледж — на главную"><img className="brand-mark" src="/logo.svg" alt="" /><span className="brand-copy"><strong>ЛОГОС</strong><small>ПУТЕВОДИТЕЛЬ</small></span></Link>
}

function resultPath(room) {
  return `/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`
}

function SearchDialog({ open, onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    if (open) {
      setQuery('')
      const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
      const unlock = lockBodyScroll()
      return () => { window.clearTimeout(timer); unlock() }
    }
    return undefined
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => onClose(), [location.pathname, onClose])
  if (!open) return null

  const normalized = query.trim().toLocaleLowerCase('ru')
  const matches = rooms.filter((room) => {
    const text = searchableRoom(room)
    return !normalized || text.includes(normalized)
  }).slice(0, 7)
  const countLabel = matches.length === 1 ? 'место' : matches.length > 1 && matches.length < 5 ? 'места' : 'мест'

  return (
    <div className="search-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <div className="search-dialog-top"><span className="eyebrow"><span className="eyebrow-dot" />ПОИСК ПО КОЛЛЕДЖУ</span><button className="icon-button" onClick={onClose} aria-label="Закрыть поиск"><X size={18} /></button></div>
        <h2 id="search-title" className="visually-hidden">Найти кабинет или пространство</h2>
        <label className="search-input-wrap"><Search size={19} /><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Номер кабинета, название, место…" /><kbd>ESC</kbd></label>
        <div className="search-results" aria-live="polite">
          {matches.length ? matches.map((room) => <Link key={room.id} className="search-result" to={resultPath(room)} onClick={onClose}><span className="search-result-icon"><MapPin size={16} /></span><span className="search-result-copy"><small>{room.category} · {room.floor} этаж</small><strong>{room.name}{room.number && ` №${room.number}`}</strong></span><ArrowUpRight className="search-result-arrow" size={17} /></Link>) : <div className="search-empty"><span>Такого места не нашли.</span><small>Проверьте номер или попробуйте «библиотека», «столовая».</small></div>}
        </div>
        <div className="search-foot"><span><kbd>K</kbd> быстрый поиск</span><span>{matches.length} {countLabel}</span></div>
      </section>
    </div>
  )
}

export function Header() {
  const language = useLanguage()
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuToggleRef = useRef(null)
  const [theme, setTheme] = useState(() => storageGet('site-theme') || 'light')
  const location = useLocation()
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const changeTheme = () => setTheme((value) => value === 'dark' ? 'light' : 'dark')
  const openSearch = () => { setMobileOpen(false); setSearchOpen(true) }
  const takeTour = () => { setMobileOpen(false); startTour() }

  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    storageSet('site-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d1d1c' : '#1854e8')
  }, [theme])
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isSearchShortcut(event)) { event.preventDefault(); setMobileOpen(false); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setMobileOpen(false); menuToggleRef.current?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  return <>
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navigation.map((item) => <NavLink end key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>{item.label}{item.badge && <span className="nav-badge">{item.badge}</span>}</NavLink>)}
        </nav>
        <div className="header-actions">
          <NavLink className={({ isActive }) => `header-docs ${isActive ? 'header-docs-active' : ''}`} to="/docs" title="Документация по сайту"><BookOpen size={16} /><span>Документация</span></NavLink>
          <button className="theme-toggle header-theme" type="button" onClick={changeTheme} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className="search-trigger" type="button" aria-keyshortcuts="K" onClick={openSearch} aria-label="Найти кабинет"><Search size={18} /><span>Найти место</span><kbd>K</kbd></button>
          <Link className="header-cta" to="/map">Открыть карту <ArrowUpRight size={15} /></Link>
          <NavLink className={({ isActive }) => `mobile-map-link ${isActive ? 'mobile-map-link-active' : ''}`} to="/map" aria-label="Открыть карту"><MapPin size={18} /><span>Карта</span></NavLink>
          <button ref={menuToggleRef} className={`mobile-menu-toggle ${mobileOpen ? 'is-open' : ''}`} type="button" onClick={() => setMobileOpen((value) => !value)} aria-controls="site-menu" aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={mobileOpen}>{mobileOpen ? <X size={23} /> : <span className="menu-lines"><i /><i /><i /></span>}</button>
        </div>
      </div>
      <nav id="site-menu" className="mobile-nav-panel" aria-label="Меню сайта" hidden={!mobileOpen}>
        <div className="mobile-nav-language"><span>Язык интерфейса</span><div className="language-switch" role="group" aria-label="Язык сайта">{['ru', 'en'].map((locale) => <button key={locale} type="button" lang={locale} aria-pressed={language === locale} onClick={() => setLanguage(locale)} title={locale === 'ru' ? 'Русская версия' : 'English version'}>{locale.toUpperCase()}</button>)}</div></div>
        <div className="mobile-nav-links">{navigation.map((item, index) => <NavLink end key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `mobile-nav-link ${isActive ? 'mobile-nav-link-active' : ''}`}><span className="mobile-nav-index">0{index + 1}</span>{item.label}{item.badge && <span className="nav-badge">{item.badge}</span>}<ArrowRight size={17} /></NavLink>)}</div>
        <div className="mobile-nav-bottom"><span>Найдите нужное место</span><button type="button" onClick={openSearch}><Search size={17} /> Поиск кабинета</button></div>
        <div className="mobile-nav-bottom"><span>Впервые на сайте?</span><NavLink to="/docs" className="mobile-docs-link"><BookOpen size={16} /> Документация</NavLink><button className="mobile-tour-button" type="button" onClick={takeTour}><Sparkles size={16} /> Пройти обучение</button></div>
        <div className="mobile-nav-bottom"><span>Оформление</span><button type="button" onClick={changeTheme}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</button></div>
      </nav>
    </header>
    {mobileOpen && <button type="button" className="menu-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" tabIndex={-1} />}
    <SearchDialog open={searchOpen} onClose={closeSearch} />
  </>
}

export function Footer() {
  return <footer className="site-footer"><div className="footer-top container"><div className="footer-brand-block"><Brand /><p>План двух этажей,<br />кабинеты и маршруты.</p><span className="footer-version">Версия {SITE_VERSION_LABEL} · by {SITE_AUTHOR}</span></div><div className="footer-links-group"><span className="footer-label">НАВИГАЦИЯ</span><Link to="/map">Карта этажей</Link><Link to="/rooms">Кабинеты</Link><Link to="/route">Маршрут</Link></div><div className="footer-links-group"><span className="footer-label">ПОЛЕЗНОЕ</span><Link to="/services">Пространства</Link><Link to="/games">Игры</Link><Link to="/about">О путеводителе</Link><Link to="/docs">Документация</Link></div><div className="footer-note"><span className="footer-label">БЫСТРЫЙ СТАРТ</span><p>Не знаете номер кабинета? Найдите его по названию или отметьте на карте.</p><Link className="footer-about-link" to="/rooms">Найти кабинет <ArrowUpRight size={14} /></Link></div></div><div className="footer-bottom container"><span>ПУТЕВОДИТЕЛЬ КОЛЛЕДЖА</span><nav className="footer-legal" aria-label="Правовая информация"><Link to="/privacy">Политика конфиденциальности</Link><Link to="/privacy#cookies">Cookie</Link><button type="button" onClick={openCookieSettings}>Настройки cookie</button></nav><a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Наверх ↑</a></div></footer>
}
