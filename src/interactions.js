// Premium micro-interactions: magnetic buttons, tilt cards, ripple, parallax, cursor glow, scroll progress.
import { isLitePerf } from './perf.js'

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || isLitePerf()
// На телефоне hover-эффекты не работают, но раньше их MutationObserver всё
// равно пересканировал DOM при каждом обновлении React.
const coarsePointer = window.matchMedia('(pointer: coarse)').matches

function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true })
  else fn()
}

function initScrollProgress() {
  let bar = document.querySelector('.scroll-progress')
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'scroll-progress'
    document.body.prepend(bar)
  }
  const update = () => {
    const h = document.documentElement
    const max = h.scrollHeight - h.clientHeight
    const pct = max > 0 ? (h.scrollTop / max) * 100 : 0
    bar.style.width = pct + '%'
  }
  window.addEventListener('scroll', update, { passive: true })
  update()
}

// Шапку ищем при каждой прокрутке: этот файл выполняется до первой отрисовки
// React, и раньше .site-header здесь ещё не было — тень не появлялась никогда.
function initHeaderScroll() {
  const update = () => {
    document.querySelector('.site-header')?.classList.toggle('scrolled', window.scrollY > 12)
  }
  window.addEventListener('scroll', update, { passive: true })
  update()
}

// Свечение едет за курсором только пока мышь движется: цикл кадров сам
// останавливается, когда пятно догнало курсор. Двигаем transform, а не
// left/top, — тогда страница не пересчитывает вёрстку.
function initCursorGlow() {
  if (reduced || coarsePointer) return
  let glow = document.querySelector('.cursor-glow')
  if (!glow) {
    glow = document.createElement('div')
    glow.className = 'cursor-glow'
    document.body.appendChild(glow)
  }
  let x = window.innerWidth / 2, y = window.innerHeight / 2
  let tx = x, ty = y
  let frame = 0
  const loop = () => {
    x += (tx - x) * 0.18
    y += (ty - y) * 0.18
    glow.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
    frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : 0
  }
  window.addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY
    glow.classList.add('active')
    if (!frame) frame = requestAnimationFrame(loop)
  }, { passive: true })
  document.documentElement.addEventListener('mouseleave', () => glow.classList.remove('active'))
}

// Наведение на карточки и кнопки отслеживает один обработчик на документе
// (делегирование), а не по обработчику на каждый элемент и наблюдатель за
// всей страницей: раньше при каждом обновлении React страница пересканировалась.
function hoverEffect(selector, onMove, onLeave) {
  let current = null
  let frame = 0
  document.addEventListener('mousemove', (event) => {
    const el = event.target instanceof Element ? event.target.closest(selector) : null
    if (el !== current) {
      cancelAnimationFrame(frame)
      if (current) onLeave(current)
      current = el
    }
    if (!el) return
    const { clientX, clientY } = event
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => onMove(el, clientX, clientY))
  }, { passive: true })
  document.documentElement.addEventListener('mouseleave', () => {
    cancelAnimationFrame(frame)
    if (current) onLeave(current)
    current = null
  })
}

function initMagnetic() {
  if (reduced || coarsePointer) return
  hoverEffect('.button, .header-cta, .magnetic, .text-link', (el, x, y) => {
    const rect = el.getBoundingClientRect()
    const dx = (x - (rect.left + rect.width / 2)) * 0.18
    const dy = (y - (rect.top + rect.height / 2)) * 0.18
    el.style.transform = `translate(${dx}px, ${dy}px)`
  }, (el) => { el.style.transform = '' })
}

function initTilt() {
  if (reduced || coarsePointer) return
  hoverEffect('.tilt, .quick-place-card, .floor-switch-card, .game-mode-tab, .quiz-option, .service-card, .about-person, .about-value-row, .faq-item, .directory-card', (el, x, y) => {
    const rect = el.getBoundingClientRect()
    const px = (x - rect.left) / rect.width - 0.5
    const py = (y - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${px * 8}deg) rotateX(${-py * 8}deg) translateY(-4px)`
  }, (el) => { el.style.transform = '' })
}

function initRipple() {
  if (reduced || coarsePointer) return
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.button, .header-cta, .quiz-option, .game-mode-tab, .text-link, .quick-place-card, .floor-switch-card, .ripple-host')
    if (!target) return
    const rect = target.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const ripple = document.createElement('span')
    ripple.className = 'ripple'
    ripple.style.width = ripple.style.height = size + 'px'
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px'
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px'
    target.classList.add('ripple-host')
    target.appendChild(ripple)
    setTimeout(() => ripple.remove(), 650)
  })
}

function initParallax() {
  if (reduced || coarsePointer) return
  const els = () => document.querySelectorAll('[data-parallax]')
  const update = () => {
    const sy = window.scrollY
    els().forEach((el) => {
      const speed = parseFloat(el.dataset.parallax || '0.1')
      el.style.transform = `translateY(${sy * speed}px)`
    })
  }
  window.addEventListener('scroll', update, { passive: true })
  update()
}

onReady(() => {
  initScrollProgress()
  initHeaderScroll()
  initCursorGlow()
  initMagnetic()
  initTilt()
  initRipple()
  initParallax()
})
