import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Footer, Header, ToastProvider } from './components/Shell'
import CookieBanner from './components/CookieBanner.jsx'
import OfflineNotice from './components/OfflineNotice.jsx'
import SiteTour from './components/SiteTour.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import HomePage from './pages/HomePage'
import { translate, useLanguage } from './i18n.js'
import { trackView } from './stats.js'

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
const TestNotificationsPage = lazy(() => import('./pages/TestNotificationsPage'))
const AdminPush = lazy(() => import('./admin/AdminPush'))

const titles = {
  '/': 'Путеводитель по колледжу',
  '/map': 'Карта этажей | Путеводитель колледжа',
  '/rooms': 'Кабинеты | Путеводитель колледжа',
  '/route': 'Маршрут | Путеводитель колледжа',
  '/games': 'Игры | Путеводитель колледжа',
  '/services': 'Пространства | Путеводитель колледжа',
  '/about': 'О путеводителе | Колледж',
  '/docs': 'Документация | Путеводитель колледжа',
  '/privacy': 'Политика конфиденциальности | Путеводитель колледжа',
  '/terms': 'Пользовательское соглашение | Путеводитель колледжа',
  '/consent': 'Согласие на обработку персональных данных | Путеводитель колледжа',
  '/ai': 'ИИ-Агент | Путеводитель колледжа',
  '/schedule': 'Моё расписание | Путеводитель колледжа',
  '/tour': 'Экскурсия в 3D | Путеводитель колледжа',
  '/teachers': 'Преподаватели | Путеводитель колледжа',
  '/start': 'Первая неделя | Путеводитель колледжа',
  '/here': 'Вы здесь | Путеводитель колледжа',
  '/testNotification': 'Уведомления (тест) | Путеводитель колледжа',
  '/testnotification': 'Уведомления (тест) | Путеводитель колледжа',
  '/admin': 'Панель | Путеводитель колледжа',
  '/admin/notices': 'Объявления | Путеводитель колледжа',
  '/admin/cards': 'Карточки на двери | Путеводитель колледжа',
  '/admin/push': 'Уведомления | Путеводитель колледжа',
}

// Адрес вне списка выше — это страница приложения «404»: показываем это и в заголовке вкладки,
// чтобы неверная ссылка не выглядела как ошибка сервера (см. deploy/reg-ru.md про перезагрузку).
const notFoundTitle = 'Страница не найдена | Путеводитель колледжа'

function RouteEffects() {
  const language = useLanguage()
  const location = useLocation()
  useEffect(() => {
    // Новая страница открывается сверху сразу: плавная прокрутка через всю
    // длинную страницу на слабых телефонах дёргается.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.title = translate(titles[location.pathname] || notFoundTitle, language)
  }, [location.pathname, language])
  useEffect(() => { trackView(location.pathname) }, [location.pathname])
  return null
}

function NotFoundPage() {
  return <section className="not-found container"><strong>404</strong><h1>Такой страницы нет</h1><p>Возможно, ссылка устарела или в адресе опечатка.</p><div><Link className="button button-primary" to="/map"><ArrowLeft size={15} /> Открыть карту</Link><Link className="button button-white" to="/">На главную <ArrowRight size={14} /></Link></div></section>
}

function Site() {
  useLanguage()
  const location = useLocation()
  const admin = location.pathname.startsWith('/admin')
  const pageKey = admin ? 'admin' : location.pathname
  return <><RouteEffects />{!admin && <Header />}<main id="main-content" className="site-main page-transition" key={pageKey}><ErrorBoundary key={pageKey}><Suspense fallback={<div className="page-loading container" role="status"><span className="page-loading-dots" aria-hidden="true"><i /><i /><i /></span> Открываем раздел…</div>}><Routes location={location}><Route path="/" element={<HomePage />} /><Route path="/map" element={<MapPage />} /><Route path="/rooms" element={<RoomsPage />} /><Route path="/route" element={<RoutePage />} /><Route path="/games" element={<GamesPage />} /><Route path="/services" element={<ServicesPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/docs" element={<DocsPage />} /><Route path="/privacy" element={<PrivacyPage />} /><Route path="/terms" element={<TermsPage />} /><Route path="/consent" element={<ConsentPage />} /><Route path="/ai" element={<AiAgentPage />} /><Route path="/schedule" element={<SchedulePage />} /><Route path="/tour" element={<TourPage />} /><Route path="/teachers" element={<TeachersPage />} /><Route path="/start" element={<StartPage />} /><Route path="/here" element={<HerePage />} /><Route path="/feedback" element={<FeedbackPage />} /><Route path="/testNotification" element={<TestNotificationsPage />} /><Route path="/admin" element={<AdminLayout />}><Route index element={<AdminOverview />} /><Route path="notices" element={<AdminNotices />} /><Route path="cards" element={<AdminCardsPage />} /><Route path="push" element={<AdminPush />} /></Route><Route path="*" element={<NotFoundPage />} /></Routes></Suspense></ErrorBoundary></main>{location.pathname !== '/ai' && !admin && <Footer />}{!admin && <><SiteTour /><CookieBanner /></>}<OfflineNotice /></>
}

export default function App() {
  return <ToastProvider><BrowserRouter><Site /></BrowserRouter></ToastProvider>
}
