import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Footer, Header, ToastProvider } from './components/Shell'
import CookieBanner from './components/CookieBanner.jsx'
import OfflineNotice from './components/OfflineNotice.jsx'
import SiteTour from './components/SiteTour.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import UnityConfetti from './components/UnityConfetti.jsx'
import { UnityThemeWatcher } from './components/Unity.jsx'
import HomePage from './pages/HomePage'
import { translate, useLanguage } from './i18n.js'
import { trackView } from './stats.js'
import { HOME_DESCRIPTION, HOME_TITLE, PAGES, PRIVATE_TITLES, SITE_NAME, SITE_URL } from './seo.js'

const MapPage = lazy(() => import('./pages/MapPage'))
const RoomsPage = lazy(() => import('./pages/RoomsPage'))
const RoutePage = lazy(() => import('./pages/RoutePage'))
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const AdminOverview = lazy(() => import('./admin/AdminOverview'))
const AdminNotices = lazy(() => import('./admin/AdminNotices'))
const AdminCardsPage = lazy(() => import('./pages/AdminCardsPage'))
const GamesPage = lazy(() => import('./pages/GamesPage'))
const ServicesPage = lazy(() => import('./pages/ServicesPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const ConsentPage = lazy(() => import('./pages/ConsentPage'))
const AiAgentPage = lazy(() => import('./pages/AiAgentPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const TourPage = lazy(() => import('./pages/TourPage'))
const TeachersPage = lazy(() => import('./pages/TeachersPage'))
const StartPage = lazy(() => import('./pages/StartPage'))
const HerePage = lazy(() => import('./pages/HerePage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const AdminPush = lazy(() => import('./admin/AdminPush'))
const AdminPromo = lazy(() => import('./admin/AdminPromo'))

// Название сайта стоит в каждом заголовке вкладки: по нему сайт находят в поиске
// («Логос Путеводитель»), и Google берёт заголовок именно отсюда. Заголовки и
// описания страниц лежат в src/seo.js: оттуда же их берёт сборка для поисковиков.
const titles = { ...Object.fromEntries(Object.entries(PAGES).map(([path, page]) => [path, page.title])), ...PRIVATE_TITLES }

// Адрес вне списка выше — это страница приложения «404»: показываем это и в заголовке вкладки,
// чтобы неверная ссылка не выглядела как ошибка сервера (см. deploy/reg-ru.md про перезагрузку).
const notFoundTitle = 'Страница не найдена'

function RouteEffects() {
  const language = useLanguage()
  const location = useLocation()
  useEffect(() => {
    // Новая страница открывается сверху сразу: плавная прокрутка через всю
    // длинную страницу на слабых телефонах дёргается.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const page = location.pathname in titles ? titles[location.pathname] : notFoundTitle
    document.title = page ? `${translate(page, language)} | ${SITE_NAME}` : translate(HOME_TITLE, language)
    // Канонический адрес страницы — всегда на основном домене, без параметров.
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${SITE_URL}${location.pathname === '/' ? '/' : location.pathname}`)
    document.querySelector('meta[name="description"]')?.setAttribute('content', translate(PAGES[location.pathname]?.description || HOME_DESCRIPTION, language))
  }, [location.pathname, language])
  useEffect(() => { trackView(location.pathname) }, [location.pathname])
  return null
}

// Значок загрузки раздела: компас из логотипа, как на заставке в index.html.
function PageLoadingCompass() {
  return <svg className="page-loading-compass" viewBox="-32 -32 64 64" aria-hidden="true" focusable="false"><circle className="plc-disc" r="30" /><g className="plc-needle"><path className="plc-cut" d="M0 -26L7 0L0 26L-7 0Z" strokeLinejoin="round" strokeWidth="2.4" /><circle className="plc-disc" r="3.4" /></g></svg>
}

function NotFoundPage() {
  return <section className="not-found container"><div className="not-found-copy"><strong>404</strong><h1>Такой страницы нет</h1><p>Возможно, ссылка устарела или в адресе опечатка. Нужный кабинет проще найти на карте.</p><div><Link className="button button-primary" to="/map"><ArrowLeft size={15} /> Открыть карту</Link><Link className="button button-white" to="/">На главную <ArrowRight size={14} /></Link></div></div><img className="not-found-art" src="/art/lost.webp" width="520" height="436" alt="" decoding="async" /></section>
}

function Site() {
  useLanguage()
  const location = useLocation()
  const admin = location.pathname.startsWith('/admin')
  const pageKey = admin ? 'admin' : location.pathname
  return <><RouteEffects />{!admin && <Header />}<main id="main-content" className="site-main page-transition" key={pageKey}><ErrorBoundary key={pageKey}><Suspense fallback={<div className="page-loading container" role="status"><PageLoadingCompass /> Открываем раздел…</div>}><Routes location={location}><Route path="/" element={<HomePage />} /><Route path="/map" element={<MapPage />} /><Route path="/rooms" element={<RoomsPage />} /><Route path="/route" element={<RoutePage />} /><Route path="/games" element={<GamesPage />} /><Route path="/services" element={<ServicesPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/docs" element={<DocsPage />} /><Route path="/privacy" element={<PrivacyPage />} /><Route path="/terms" element={<TermsPage />} /><Route path="/consent" element={<ConsentPage />} /><Route path="/ai" element={<AiAgentPage />} /><Route path="/schedule" element={<SchedulePage />} /><Route path="/tour" element={<TourPage />} /><Route path="/teachers" element={<TeachersPage />} /><Route path="/start" element={<StartPage />} /><Route path="/here" element={<HerePage />} /><Route path="/feedback" element={<FeedbackPage />} /><Route path="/notifications" element={<NotificationsPage />} /><Route path="/testNotification" element={<Navigate to="/notifications" replace />} /><Route path="/admin" element={<AdminLayout />}><Route index element={<AdminOverview />} /><Route path="notices" element={<AdminNotices />} /><Route path="cards" element={<AdminCardsPage />} /><Route path="push" element={<AdminPush />} /><Route path="promo" element={<AdminPromo />} /></Route><Route path="*" element={<NotFoundPage />} /></Routes></Suspense></ErrorBoundary></main>{location.pathname !== '/ai' && !admin && <Footer />}{!admin && <><SiteTour /><CookieBanner /></>}<OfflineNotice /><UnityConfetti /><UnityThemeWatcher /></>
}

export default function App() {
  return <ToastProvider><BrowserRouter><Site /></BrowserRouter></ToastProvider>
}
