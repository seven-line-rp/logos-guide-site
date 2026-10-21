// Premium micro-interactions: magnetic buttons, tilt cards, ripple, parallax, cursor glow, scroll progress.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
  window.addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY
    glow.classList.add('active')
  })
  window.addEventListener('mouseleave', () => glow.classList.remove('active'))
  const loop = () => {
    x += (tx - x) * 0.12
    y += (ty - y) * 0.12
    glow.style.left = x + 'px'
    glow.style.top = y + 'px'
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

function initMagnetic() {
  if (reduced || coarsePointer) return
  const selector = '.button, .header-cta, .magnetic, .text-link'
  const attach = (el) => {
    if (el.dataset.mag) return
    el.dataset.mag = '1'
    let raf = 0
    const move = (e) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) * 0.18
      const dy = (e.clientY - cy) * 0.18
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { el.style.transform = `translate(${dx}px, ${dy}px)` })
    }
    const leave = () => {
      cancelAnimationFrame(raf)
      el.style.transform = ''
    }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', leave)
  }
  const scan = () => document.querySelectorAll(selector).forEach(attach)
  scan()
  const obs = new MutationObserver(scan)
  obs.observe(document.body, { childList: true, subtree: true })
}

function initTilt() {
  if (reduced || coarsePointer) return
  const selector = '.tilt, .quick-place-card, .floor-switch-card, .game-mode-tab, .quiz-option, .service-card, .about-person, .about-value-row, .faq-item, .directory-card'
  const attach = (el) => {
    if (el.dataset.tilt) return
    el.dataset.tilt = '1'
    const move = (e) => {
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      el.style.transform = `perspective(900px) rotateY(${px * 8}deg) rotateX(${-py * 8}deg) translateY(-4px)`
    }
    const leave = () => { el.style.transform = '' }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', leave)
  }
  const scan = () => document.querySelectorAll(selector).forEach(attach)
  scan()
  const obs = new MutationObserver(scan)
  obs.observe(document.body, { childList: true, subtree: true })
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
