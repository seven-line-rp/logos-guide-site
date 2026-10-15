import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Footer, Header, ToastProvider } from './components/Shell'
import HomePage from './pages/HomePage'
import MapPage from './pages/MapPage'
import RoomsPage from './pages/RoomsPage'
import RoutePage from './pages/RoutePage'
import GamesPage from './pages/GamesPage'
import ServicesPage from './pages/ServicesPage'
import AboutPage from './pages/AboutPage'

const titles = {
  '/': 'Путеводитель по колледжу',
  '/map': 'Карта этажей — Путеводитель колледжа',
  '/rooms': 'Кабинеты — Путеводитель колледжа',
  '/route': 'Маршрут — Путеводитель колледжа',
  '/games': 'Игры — Путеводитель колледжа',
  '/services': 'Пространства — Путеводитель колледжа',
  '/about': 'О путеводителе — Колледж',
}

function RouteEffects() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    document.title = titles[location.pathname] || 'Путеводитель по колледжу'
  }, [location.pathname])
  return null
}

function NotFoundPage() {
  return <section className="not-found container"><span className="eyebrow"><i className="eyebrow-dot" />МАРШРУТ НЕ НАЙДЕН</span><strong>404</strong><h1>Кажется, мы<br /><em>свернули не туда.</em></h1><p>Вернитесь к карте — она поможет найти нужный кабинет или пространство.</p><div><Link className="button button-primary" to="/map"><ArrowLeft size={15} /> Открыть карту</Link><Link to="/">На главную <ArrowRight size={14} /></Link></div></section>
}

function Site() {
  const location = useLocation()
  return <><RouteEffects /><Header /><main id="main-content" className="site-main page-transition" key={location.pathname}><Routes location={location}><Route path="/" element={<HomePage />} /><Route path="/map" element={<MapPage />} /><Route path="/rooms" element={<RoomsPage />} /><Route path="/route" element={<RoutePage />} /><Route path="/games" element={<GamesPage />} /><Route path="/services" element={<ServicesPage />} /><Route path="/about" element={<AboutPage />} /><Route path="*" element={<NotFoundPage />} /></Routes></main><Footer /></>
}

export default function App() {
  return <ToastProvider><BrowserRouter><Site /></BrowserRouter></ToastProvider>
}
