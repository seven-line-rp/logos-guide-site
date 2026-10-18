import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Footer, Header, ToastProvider } from './components/Shell'
import WelcomeDialog from './components/WelcomeDialog'
import CookieBanner from './components/CookieBanner.jsx'
import SiteTour from './components/SiteTour.jsx'
import HomePage from './pages/HomePage'
import { translate, useLanguage } from './i18n.js'

const MapPage = lazy(() => import('./pages/MapPage'))
const RoomsPage = lazy(() => import('./pages/RoomsPage'))
const RoutePage = lazy(() => import('./pages/RoutePage'))
const GamesPage = lazy(() => import('./pages/GamesPage'))
const ServicesPage = lazy(() => import('./pages/ServicesPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))

const titles = {
  '/': 'Путеводитель по колледжу',
  '/map': 'Карта этажей — Путеводитель колледжа',
  '/rooms': 'Кабинеты — Путеводитель колледжа',
  '/route': 'Маршрут — Путеводитель колледжа',
  '/games': 'Игры — Путеводитель колледжа',
  '/services': 'Пространства — Путеводитель колледжа',
  '/about': 'О путеводителе — Колледж',
  '/docs': 'Документация — Путеводитель колледжа',
  '/privacy': 'Политика конфиденциальности — Путеводитель колледжа',
}

// Адрес вне списка выше — это страница приложения «404»: показываем это и в заголовке вкладки,
// чтобы неверная ссылка не выглядела как ошибка сервера (см. deploy/reg-ru.md про перезагрузку).
const notFoundTitle = 'Страница не найдена — Путеводитель колледжа'

function RouteEffects() {
  const language = useLanguage()
  const location = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    document.title = translate(titles[location.pathname] || notFoundTitle, language)
  }, [location.pathname, language])
  return null
}

function NotFoundPage() {
  return <section className="not-found container"><span className="eyebrow"><i className="eyebrow-dot" />МАРШРУТ НЕ НАЙДЕН</span><strong>404</strong><h1>Кажется, мы<br /><em>свернули не туда.</em></h1><p>Вернитесь к карте — она поможет найти нужный кабинет или пространство.</p><div><Link className="button button-primary" to="/map"><ArrowLeft size={15} /> Открыть карту</Link><Link to="/">На главную <ArrowRight size={14} /></Link></div></section>
}

function Site() {
  useLanguage()
  const location = useLocation()
  return <><RouteEffects /><Header /><main id="main-content" className="site-main page-transition" key={location.pathname}><Suspense fallback={<div className="page-loading container" role="status"><span className="shimmer" style={{display:"inline-block",width:"120px",height:"14px",borderRadius:"6px"}} /> Открываем раздел…</div>}><Routes location={location}><Route path="/" element={<HomePage />} /><Route path="/map" element={<MapPage />} /><Route path="/rooms" element={<RoomsPage />} /><Route path="/route" element={<RoutePage />} /><Route path="/games" element={<GamesPage />} /><Route path="/services" element={<ServicesPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/docs" element={<DocsPage />} /><Route path="/privacy" element={<PrivacyPage />} /><Route path="*" element={<NotFoundPage />} /></Routes></Suspense></main><Footer /><WelcomeDialog /><SiteTour /><CookieBanner /></>
}

export default function App() {
  return <ToastProvider><BrowserRouter><Site /></BrowserRouter></ToastProvider>
}
