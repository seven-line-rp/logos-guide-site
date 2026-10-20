import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowUpRight, BookOpen, Bot, CalendarDays, Check, Compass, Gamepad2, GraduationCap, Info, LayoutGrid, Map as MapIcon, MapPin, Moon, Navigation, Search, Sparkles, Sun, X } from 'lucide-react'
import { navigation, rooms } from '../data'
import { lockBodyScroll, storageGet, storageSet } from '../storage'
import { setLanguage, useLanguage } from '../i18n.js'
import { cancelMiss, reportMiss, searchRooms, searchTeachers, shortName, useTeachers } from '../search.js'
import VoiceSearchButton from './VoiceSearchButton.jsx'
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

// Разделы в меню: карточки с иконкой и подсказкой.
const menuSections = [
  { to: '/map', label: 'Карта этажей', hint: 'План 1 и 2 этажа в 2D и 3D', icon: MapIcon, tone: 'blue' },
  { to: '/route', label: 'Маршрут', hint: 'Путь по шагам с голосом', icon: Navigation, tone: 'violet' },
  { to: '/rooms', label: 'Кабинеты', hint: 'Справочник помещений', icon: LayoutGrid, tone: 'sky' },
  { to: '/schedule', label: 'Моё расписание', hint: 'Пары и звонки', icon: CalendarDays, tone: 'green' },
  { to: '/ai', label: 'ИИ-Агент', badge: 'ТЕСТ', hint: 'Спросите ЛОГОС AI', icon: Bot, tone: 'violet' },
  { to: '/tour', label: 'Экскурсия в 3D', hint: 'Прогулка по колледжу', icon: Compass, tone: 'amber' },
  { to: '/games', label: 'Игры', hint: 'Квизы по плану', icon: Gamepad2, tone: 'pink' },
  { to: '/services', label: 'Пространства', hint: 'Столовая, библиотека, залы', icon: Sparkles, tone: 'sky' },
  { to: '/about', label: 'О проекте', hint: 'Команда и идея', icon: Info, tone: 'slate' },
]

function Brand() {
  return <Link className="brand" to="/" aria-label="На главную"><img className="brand-mark" src="/logo.svg" alt="" /><span className="brand-copy"><strong>ЛОГОС</strong><small>ПУТЕВОДИТЕЛЬ</small></span></Link>
}

function resultPath(room) {
  return `/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`
}

function SearchDialog({ open, onClose }) {
  const [query, setQuery] = useState('')
  const teachers = useTeachers()
  const missed = Boolean(query.trim()) && !searchRooms(query, 1).length && !searchTeachers(teachers, query, 1).length
  useEffect(() => { if (missed) reportMiss(query); else cancelMiss() }, [missed, query])
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

  const matches = query.trim() ? searchRooms(query, 7).map((entry) => entry.room) : rooms.slice(0, 7)
  const teacherHits = searchTeachers(teachers, query, 3)

  const countLabel = matches.length === 1 ? 'место' : matches.length > 1 && matches.length < 5 ? 'места' : 'мест'

  return (
    <div className="search-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <div className="search-dialog-top"><span className="eyebrow">Поиск по колледжу</span><button className="icon-button" onClick={onClose} aria-label="Закрыть поиск"><X size={18} /></button></div>
        <h2 id="search-title" className="visually-hidden">Найти кабинет или пространство</h2>
        <label className="search-input-wrap"><Search size={19} /><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Номер кабинета, место или преподаватель…" /><VoiceSearchButton onText={setQuery} /><kbd>ESC</kbd></label>
        <div className="search-results" aria-live="polite">
          {teacherHits.map(({ teacher, room, bySubject }) => <Link key={teacher.name} className="search-result search-teacher" to={room ? resultPath(room) : '/map?floor=1&room=academic-office'} onClick={onClose}><span className="search-result-icon"><GraduationCap size={16} /></span><span className="search-result-copy"><small>{[teacher.position, (teacher.subjects || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ') || 'Преподаватель'}</small><strong>{shortName(teacher.name)}</strong><em>{room ? `${room.name}${room.number ? ` №${room.number}` : ''}${bySubject ? ', по предмету' : ''}` : 'Кабинет уточните в учебной части'}</em></span><ArrowUpRight className="search-result-arrow" size={17} /></Link>)}
          {matches.length ? matches.map((room) => <Link key={room.id} className="search-result" to={resultPath(room)} onClick={onClose}><span className="search-result-icon"><MapPin size={16} /></span><span className="search-result-copy"><small>{room.category}, {room.floor} этаж</small><strong>{room.name}{room.number && ` №${room.number}`}</strong></span><ArrowUpRight className="search-result-arrow" size={17} /></Link>) : teacherHits.length ? null : <div className="search-empty"><span>Такого места не нашли.</span><small>Проверьте номер или попробуйте «библиотека», «столовая».</small></div>}
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
    <header className="site-header hd">
      <div className="header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navigation.map((item) => <NavLink end key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>{item.label}{item.badge && <span className="nav-badge">{item.badge}</span>}</NavLink>)}
        </nav>
        <div className="header-actions">
          <button className="search-trigger" type="button" aria-keyshortcuts="K" onClick={openSearch} aria-label="Найти кабинет"><Search size={17} /><span>Найти место</span><kbd>K</kbd></button>
          <NavLink className={({ isActive }) => `header-docs hd-icon ${isActive ? 'header-docs-active' : ''}`} to="/docs" title="Документация по сайту" aria-label="Документация"><BookOpen size={17} /><span>Документация</span></NavLink>
          <button className="theme-toggle header-theme hd-icon" type="button" onClick={changeTheme} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <Link className="header-cta" to="/map"><MapPin size={16} /> Открыть карту</Link>
          <NavLink className={({ isActive }) => `mobile-map-link ${isActive ? 'mobile-map-link-active' : ''}`} to="/map" aria-label="Открыть карту"><MapPin size={18} /><span>Карта</span></NavLink>
          <button ref={menuToggleRef} className={`mobile-menu-toggle hd-burger ${mobileOpen ? 'is-open' : ''}`} type="button" onClick={() => setMobileOpen((value) => !value)} aria-controls="site-menu" aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={mobileOpen}><span className="hd-burger-lines" aria-hidden="true"><i /><i /><i /></span><span className="hd-burger-label">Меню</span></button>
        </div>
      </div>
      <nav id="site-menu" className="hd-menu" aria-label="Меню сайта" hidden={!mobileOpen}>
        <div className="hd-menu-inner">
          <div className="hd-menu-grid">
            {menuSections.map((item, index) => { const Icon = item.icon; return <NavLink end key={item.to} to={item.to} style={{ '--i': index }} onClick={() => setMobileOpen(false)} className={({ isActive }) => `hd-menu-card hd-tone-${item.tone} ${isActive ? 'is-active' : ''}`}>
              <span className="hd-menu-icon" aria-hidden="true"><Icon size={19} /></span>
              <span className="hd-menu-text"><strong>{item.label}{item.badge && <span className="nav-badge">{item.badge}</span>}</strong><small>{item.hint}</small></span>
              <ArrowUpRight className="hd-menu-arrow" size={16} aria-hidden="true" />
            </NavLink> })}
          </div>
          <div className="hd-menu-side">
            <button type="button" className="hd-menu-search" onClick={openSearch}><Search size={17} /><span>Найти место</span><kbd>K</kbd></button>
            <div className="hd-menu-row">
              <span>Язык</span>
              <div className="hd-seg" role="group" aria-label="Язык сайта">{['ru', 'en'].map((locale) => <button key={locale} type="button" lang={locale} aria-pressed={language === locale} onClick={() => setLanguage(locale)} title={locale === 'ru' ? 'Русская версия' : 'English version'}>{locale.toUpperCase()}</button>)}</div>
            </div>
            <div className="hd-menu-row">
              <span>Тема</span>
              <div className="hd-seg" role="group" aria-label="Тема оформления"><button type="button" aria-pressed={theme !== 'dark'} onClick={() => setTheme('light')}><Sun size={14} /> Светлая</button><button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={14} /> Тёмная</button></div>
            </div>
            <div className="hd-menu-actions">
              <NavLink to="/docs" className="hd-menu-link" onClick={() => setMobileOpen(false)}><BookOpen size={16} /> Документация</NavLink>
              <button type="button" className="hd-menu-link hd-menu-tour" onClick={takeTour}><Sparkles size={16} /> Пройти обучение</button>
            </div>
          </div>
        </div>
      </nav>
    </header>
    {mobileOpen && <button type="button" className="menu-scrim hd-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" tabIndex={-1} />}
    <SearchDialog open={searchOpen} onClose={closeSearch} />
  </>
}

export function Footer() {
  return <footer className="site-footer"><div className="footer-top container"><div className="footer-brand-block"><Brand /><p>План двух этажей,<br />кабинеты и маршруты.</p><span className="footer-version">Версия {SITE_VERSION_LABEL}, by {SITE_AUTHOR}</span></div><div className="footer-links-group"><span className="footer-label">Навигация</span><Link to="/map">Карта этажей</Link><Link to="/rooms">Кабинеты</Link><Link to="/route">Маршрут</Link></div><div className="footer-links-group"><span className="footer-label">Полезное</span><Link to="/services">Пространства</Link><Link to="/games">Игры</Link><Link to="/schedule">Моё расписание</Link><Link to="/tour">Экскурсия в 3D</Link><Link to="/about">О путеводителе</Link><Link to="/docs">Документация</Link></div><div className="footer-note"><span className="footer-label">Быстрый старт</span><p>Не знаете номер кабинета? Найдите его по названию или отметьте на карте.</p><Link className="footer-about-link" to="/rooms">Найти кабинет <ArrowUpRight size={14} /></Link></div></div><div className="footer-bottom container"><span>Путеводитель колледжа</span><nav className="footer-legal" aria-label="Правовая информация"><Link to="/privacy">Политика конфиденциальности</Link><Link to="/privacy#cookies">Cookie</Link><button type="button" onClick={openCookieSettings}>Настройки cookie</button></nav><a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Наверх ↑</a></div></footer>
}
