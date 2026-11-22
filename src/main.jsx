import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './styles-more.css'
import './refinement.css'
import './visual-pass.css'
import './welcome.css'
import './polish.css'
import './premium.css'
import './navigator.css'
import './contrast.css'
import './mobile.css'
import './home-hero.css'
import './tour.css'
import './site-docs.css'
import './hero-scene.css'
import './about.css'
import './route-scene.css'
import './dark-theme.css'
import './maps-modern.css'
import './features.css'
import './header.css'
import '@fontsource-variable/onest'
import '@fontsource-variable/caveat/wght.css'
import './design.css'
import './room-cards.css'
import './room-extras.css'
import './arcade.css'
import './walk.css'
import './search.css'
import './a11y.css'
import './human.css'
import './motion.css'
import './feedback.css'
import './clean.css'
import './perf.css'
import './notify.css'
import './admin/admin.css'
import './soft.css'
import './route.css'
import './finish.css'
import './arrival.css'
import './search-fields.css'
import './map-page.css'
// Общее выравнивание кнопок и новых блоков — для всех тем.
import './align.css'
// Тема «Пикми» — последней, чтобы перекрывать общие правила.
import './pickme.css'
// Тёмная тема задаётся окончательно здесь, поверх накопившихся слоёв.
import './dark.css'
// Главная: общая сетка, отступы и эффекты для всех трёх тем — самым последним слоем.
import './landing.css'
import './edition.css'
import './interactions.js'
import { applyMapContrast } from './map-contrast.js'
import { applyTextSize, readTextSize } from './text-size.js'
import { installErrorReporting } from './error-report.js'
import { initSiteSettings, readCachedSettings } from './site-settings.js'
import { initTheme } from './theme.js'

applyMapContrast()
applyTextSize(readTextSize())
// Какие темы включены, знает сервер (панель /admin/settings); до его ответа — копия из браузера.
initTheme(window.location.search, readCachedSettings().themes)
initSiteSettings()
// Сообщения о сбоях страницы для оповещений владельцу (только в рабочей сборке).
if (import.meta.env.PROD) installErrorReporting()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Заставка из index.html ждёт этого события: два кадра — и первая страница уже на экране.
requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('logos-app-ready'))))

// Офлайн-режим: sw.js собирается вместе с сайтом (см. vite.config.js), поэтому только в сборке.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
