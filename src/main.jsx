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
import './route.css'
import './route-scene.css'
import './ai-agent.css'
import './dark-theme.css'
import './maps-modern.css'
import './features.css'
import './header.css'
import '@fontsource-variable/onest'
import './design.css'
import './room-cards.css'
import './room-extras.css'
import './arcade.css'
import './a11y.css'
import './interactions.js'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Офлайн-режим: sw.js собирается вместе с сайтом (см. vite.config.js), поэтому только в сборке.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
