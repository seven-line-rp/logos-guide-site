import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, BookOpen, Building2, Bot, CalendarDays, Check, Compass, Flag, Gamepad2, GraduationCap, History, Info, LayoutGrid, ListChecks, Map as MapIcon, MapPin, Moon, Navigation, Search, Sun, Type, Users, X } from 'lucide-react'
import { navigation, quickPlaces, rooms } from '../data'
import { clearRecentPlaces, readRecentPlaces, rememberPlace } from '../places.js'
import { readTextSize, setTextSize } from '../text-size.js'
import { lockBodyScroll, storageGet, storageSet } from '../storage'
import { setLanguage, useLanguage } from '../i18n.js'
import { cancelMiss, reportMiss, searchRooms, searchTeachers, shortName, useTeachers } from '../search.js'
import VoiceSearchButton from './VoiceSearchButton.jsx'
import { isSearchShortcut } from '../shortcuts.js'
import { startTour } from '../tour-bus.js'
import { openCookieSettings } from '../consent.js'
import { SITE_AUTHOR, SITE_VERSION_LABEL } from '../version.js'
import { isLitePerf } from '../perf.js'

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

// Меню: разделы сгруппированы по задачам человека, а не по устройству сайта.
const menuGroups = [
  { title: 'Найти дорогу', items: [
    { to: '/map', label: 'Карта этажей', hint: 'План 1 и 2 этажа', icon: MapIcon, tone: 'blue' },
    { to: '/route', label: 'Маршрут', hint: 'Путь по шагам с голосом', icon: Navigation, tone: 'violet' },
    { to: '/rooms', label: 'Кабинеты', hint: 'Справочник помещений', icon: LayoutGrid, tone: 'sky' },
    { to: '/teachers', label: 'Преподаватели', hint: 'Кто где сидит', icon: Users, tone: 'green' },
    { to: '/services', label: 'Пространства', hint: 'Столовая, библиотека, залы', icon: Building2, tone: 'amber' },
  ] },
  { title: 'Учёба', items: [
    { to: '/schedule', label: 'Моё расписание', hint: 'Пары и звонки', icon: CalendarDays, tone: 'green' },
    { to: '/start', label: 'Первая неделя', hint: 'Чек-лист для новичков', icon: ListChecks, tone: 'blue' },
    { to: '/ai', label: 'ИИ-помощник', badge: 'АЛЬФА', hint: 'Спросите о чём угодно', icon: Bot, tone: 'violet' },
  ] },
  { title: 'Познакомиться', items: [
    { to: '/tour', label: 'Экскурсия в 3D', hint: 'Прогулка по колледжу', icon: Compass, tone: 'amber' },
    { to: '/games', label: 'Игры', hint: 'Квизы по плану', icon: Gamepad2, tone: 'pink' },
    { to: '/about', label: 'О проекте', hint: 'Команда и идея', icon: Info, tone: 'slate' },
    { to: '/docs', label: 'Документация', hint: 'Как всё устроено', icon: BookOpen, tone: 'slate' },
    { to: '/feedback', label: 'Сообщить о проблеме', hint: 'Баг, идея, ошибка ИИ', icon: Flag, tone: 'pink' },
  ] },
]

function Brand() {
  return <Link className="brand" to="/" aria-label="На главную"><img className="brand-mark" src="/logo.svg" alt="" /><span className="brand-copy"><strong>ЛОГОС</strong><small>ПУТЕВОДИТЕЛЬ</small></span></Link>
}

function resultPath(room) {
  return `/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`
}

function routePath(room) {
  return `/route?to=${encodeURIComponent(room.id)}`
}

function SearchDialog({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const teachers = useTeachers()
  const missed = Boolean(query.trim()) && !searchRooms(query, 1).length && !searchTeachers(teachers, query, 1).length
  useEffect(() => { if (missed) reportMiss(query); else cancelMiss() }, [missed, query])
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

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
  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
  }, [active])
  if (!open) return null

  // Пустой запрос: сначала недавние места, затем популярные.
  const recent = readRecentPlaces().map((id) => rooms.find((room) => room.id === id))
  const popular = quickPlaces.map((place) => rooms.find((room) => room.id === place.roomId)).filter((room) => room && !recent.includes(room))
  const matches = query.trim() ? searchRooms(query, 7).map((entry) => entry.room) : [...recent, ...popular].slice(0, 7)
  const teacherHits = searchTeachers(teachers, query, 3)
  const items = [
    ...teacherHits.map(({ teacher, room }) => ({ key: teacher.name, to: room ? resultPath(room) : '/map?floor=1&room=academic-office', room })),
    ...matches.map((room) => ({ key: room.id, to: resultPath(room), room })),
  ]
  const countLabel = matches.length === 1 ? 'место' : matches.length > 1 && matches.length < 5 ? 'места' : 'мест'
  const open_ = (item, toRoute = false) => {
    if (!item) return
    if (item.room) rememberPlace(item.room.id)
    onClose()
    navigate(toRoute && item.room ? routePath(item.room) : item.to)
  }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(items.length - 1, value + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(0, value - 1)) }
    else if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); open_(items[active], event.altKey || event.ctrlKey || event.metaKey) }
  }
  const itemProps = (index, item) => ({
    className: index === active ? 'is-active' : '',
    onMouseMove: () => { if (index !== active) setActive(index) },
    onClick: () => item.room && rememberPlace(item.room.id),
  })
  const routeButton = (item) => item.room && item.room.id !== 'entrance-1' && <Link className="search-route" to={routePath(item.room)} onClick={() => { rememberPlace(item.room.id); onClose() }} aria-label={`Маршрут: ${item.room.name}`} title="Построить маршрут"><Navigation size={15} /><span>Маршрут</span></Link>

  return (
    <div className="search-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <div className="search-dialog-top"><span className="eyebrow">Поиск по колледжу</span><button className="icon-button" onClick={onClose} aria-label="Закрыть поиск"><X size={18} /></button></div>
        <h2 id="search-title" className="visually-hidden">Найти кабинет или пространство</h2>
        <label className="search-input-wrap"><Search size={19} /><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="Номер кабинета, место или преподаватель…" role="combobox" aria-expanded="true" aria-controls="search-results" aria-activedescendant={items[active] ? `search-item-${active}` : undefined} /><VoiceSearchButton onText={setQuery} /><kbd>ESC</kbd></label>
        {!query.trim() && recent.length > 0 && <div className="search-section-label"><History size={13} /> Недавние<button type="button" onClick={() => { clearRecentPlaces(); inputRef.current?.focus() }}>Очистить</button></div>}
        {!query.trim() && !recent.length && <div className="search-section-label">Часто ищут</div>}
        <div className="search-results" id="search-results" role="listbox" ref={listRef} aria-live="polite">
          {teacherHits.map(({ teacher, room, bySubject }, index) => { const item = items[index]; return <div key={teacher.name} id={`search-item-${index}`} role="option" aria-selected={index === active} className={`search-row ${index === active ? 'is-active' : ''}`}><Link {...itemProps(index, item)} className="search-result search-teacher" to={item.to} onClick={() => { if (room) rememberPlace(room.id); onClose() }}><span className="search-result-icon"><GraduationCap size={16} /></span><span className="search-result-copy"><small>{[teacher.position, (teacher.subjects || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ') || 'Преподаватель'}</small><strong>{shortName(teacher.name)}</strong><em>{room ? `${room.name}${room.number ? ` №${room.number}` : ''}${bySubject ? ', по предмету' : ''}` : 'Кабинет уточните в учебной части'}</em></span></Link>{routeButton(item)}</div> })}
          {matches.length ? matches.map((room, offset) => { const index = teacherHits.length + offset; const item = items[index]; return <div key={room.id} id={`search-item-${index}`} role="option" aria-selected={index === active} className={`search-row ${index === active ? 'is-active' : ''}`}><Link {...itemProps(index, item)} className="search-result" to={item.to} onClick={() => { rememberPlace(room.id); onClose() }}><span className="search-result-icon">{!query.trim() && recent.includes(room) ? <History size={16} /> : <MapPin size={16} />}</span><span className="search-result-copy"><small>{room.category}, {room.floor} этаж</small><strong>{room.name}{room.number && ` №${room.number}`}</strong></span></Link>{routeButton(item)}</div> }) : teacherHits.length ? null : <div className="search-empty"><span>Такого места не нашли.</span><small>Проверьте номер или попробуйте «библиотека», «столовая». <Link to={`/ai?q=${encodeURIComponent(`Где найти: ${query.trim()}`)}`} onClick={onClose}>Спросить ИИ-помощника</Link></small></div>}
        </div>
        <div className="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> выбрать <kbd>Enter</kbd> открыть <kbd>Alt</kbd>+<kbd>Enter</kbd> маршрут</span><span>{matches.length} {countLabel}</span></div>
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
  const [textSize, setTextSizeState] = useState(readTextSize)
  const location = useLocation()
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  // Смена темы кругом от кнопки (View Transitions API). Круг — это снимок всей
  // страницы, поэтому на телефонах, в режиме «Лёгкий» и при «Уменьшить
  // движение» тему просто переключаем. Там, где круг есть, 3D-сцена главной
  // на время перехода замирает (data-theme-busy), чтобы снимок снимался с
  // неподвижной картинки, а не с идущей анимации.
  const switchTheme = (next, event) => {
    if (next === theme) return
    const plain = window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 860 || isLitePerf()
    if (!document.startViewTransition || plain) { setTheme(next); return }
    const rect = event?.currentTarget?.getBoundingClientRect()
    if (rect) {
      document.documentElement.style.setProperty('--theme-x', `${rect.left + rect.width / 2}px`)
      document.documentElement.style.setProperty('--theme-y', `${rect.top + rect.height / 2}px`)
    }
    const root = document.documentElement
    root.setAttribute('data-theme-busy', '')
    window.dispatchEvent(new Event('logos-theme-busy'))
    const done = () => { root.removeAttribute('data-theme-busy'); window.dispatchEvent(new Event('logos-theme-busy')) }
    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next))
      document.documentElement.dataset.theme = next
    })
    transition.finished.then(done, done)
    // Страховка: если браузер не завершил переход, сцена всё равно оживёт.
    window.setTimeout(done, 3000)
  }
  const changeTheme = (event) => switchTheme(theme === 'dark' ? 'light' : 'dark', event)
  const openSearch = () => { setMobileOpen(false); setSearchOpen(true) }
  const takeTour = () => { setMobileOpen(false); startTour() }
  const changeTextSize = (value) => setTextSizeState(setTextSize(value))

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

  let cardIndex = 0
  return <>
    <header className="site-header hd">
      <div className="header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navigation.map((item) => <NavLink end key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>{item.label}{item.badge && <span className="nav-badge">{item.badge}</span>}</NavLink>)}
        </nav>
        <div className="header-actions">
          <button className="search-trigger" type="button" aria-keyshortcuts="K" onClick={openSearch} aria-label="Найти кабинет"><Search size={17} /><span>Найти место</span><kbd>K</kbd></button>
          <button className="theme-toggle header-theme hd-icon" type="button" onClick={changeTheme} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <NavLink className={({ isActive }) => `mobile-map-link ${isActive ? 'mobile-map-link-active' : ''}`} to="/map" aria-label="Открыть карту"><MapPin size={18} /><span>Карта</span></NavLink>
          <button ref={menuToggleRef} className={`mobile-menu-toggle hd-burger ${mobileOpen ? 'is-open' : ''}`} type="button" onClick={() => setMobileOpen((value) => !value)} aria-controls="site-menu" aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={mobileOpen}><span className="hd-burger-lines" aria-hidden="true"><i /><i /><i /></span><span className="hd-burger-label">Ещё</span></button>
        </div>
      </div>
      <nav id="site-menu" className="hd-menu" aria-label="Меню сайта" hidden={!mobileOpen}>
        <div className="hd-menu-inner">
          <div className="hd-menu-groups">
            {menuGroups.map((group) => <section key={group.title} className="hd-menu-group" aria-label={group.title}>
              <h2 className="hd-menu-group-title">{group.title}</h2>
              <div className="hd-menu-grid">
                {group.items.map((item) => { const Icon = item.icon; const index = cardIndex++; return <NavLink end key={item.to} to={item.to} style={{ '--i': index }} onClick={() => setMobileOpen(false)} className={({ isActive }) => `hd-menu-card hd-tone-${item.tone} ${isActive ? 'is-active' : ''}`}>
                  <span className="hd-menu-icon" aria-hidden="true"><Icon size={19} /></span>
                  <span className="hd-menu-text"><strong>{item.label}{item.badge && <span className="nav-badge">{item.badge}</span>}</strong><small>{item.hint}</small></span>
                  <ArrowUpRight className="hd-menu-arrow" size={16} aria-hidden="true" />
                </NavLink> })}
              </div>
            </section>)}
          </div>
          <div className="hd-menu-side">
            <button type="button" className="hd-menu-search" onClick={openSearch}><Search size={17} /><span>Найти место</span><kbd>K</kbd></button>
            <div className="hd-menu-row">
              <span>Язык</span>
              <div className="hd-seg" role="group" aria-label="Язык сайта">{['ru', 'en'].map((locale) => <button key={locale} type="button" lang={locale} aria-pressed={language === locale} onClick={() => setLanguage(locale)} title={locale === 'ru' ? 'Русская версия' : 'English version'}>{locale.toUpperCase()}</button>)}</div>
            </div>
            <div className="hd-menu-row">
              <span>Тема</span>
              <div className="hd-seg" role="group" aria-label="Тема оформления"><button type="button" aria-pressed={theme !== 'dark'} onClick={(event) => switchTheme('light', event)}><Sun size={14} /> Светлая</button><button type="button" aria-pressed={theme === 'dark'} onClick={(event) => switchTheme('dark', event)}><Moon size={14} /> Тёмная</button></div>
            </div>
            <div className="hd-menu-row">
              <span>Текст</span>
              <div className="hd-seg" role="group" aria-label="Размер текста"><button type="button" aria-pressed={textSize !== 'large'} onClick={() => changeTextSize('normal')}>Обычный</button><button type="button" aria-pressed={textSize === 'large'} onClick={() => changeTextSize('large')}><Type size={14} /> Крупный</button></div>
            </div>
            <div className="hd-menu-actions">
              <button type="button" className="hd-menu-link hd-menu-tour" onClick={takeTour}><Compass size={16} /> Пройти обучение</button>
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
  return <footer className="site-footer"><div className="footer-top container"><div className="footer-brand-block"><Brand /><p>Карта, маршруты и всё, что<br />нужно найти в колледже.</p><span className="footer-version">Версия {SITE_VERSION_LABEL}, by {SITE_AUTHOR}</span></div>{menuGroups.map((group) => <div key={group.title} className="footer-links-group"><span className="footer-label">{group.title}</span>{group.items.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}</div>)}</div><div className="footer-bottom container"><span>Путеводитель колледжа «Логос»</span><nav className="footer-legal" aria-label="Правовая информация"><Link to="/privacy">Политика конфиденциальности</Link><Link to="/privacy#cookies">Cookie</Link><button type="button" onClick={openCookieSettings}>Настройки cookie</button></nav><a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Наверх ↑</a></div></footer>
}
