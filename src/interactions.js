// Тень у шапки, когда страница прокручена.
// Шапку ищем при каждой прокрутке, потому что этот файл выполняется раньше,
// чем React успевает её отрисовать. Проверка — не чаще раза за кадр, а класс
// меняется только при переходе через порог, чтобы не перерисовывать шапку зря.
function initHeaderScroll() {
  let queued = false
  let last = null
  const update = () => {
    queued = false
    const header = document.querySelector('.site-header')
    if (!header) return
    const scrolled = window.scrollY > 12
    if (scrolled === last && header.classList.contains('scrolled') === scrolled) return
    last = scrolled
    header.classList.toggle('scrolled', scrolled)
  }
  window.addEventListener('scroll', () => {
    if (queued) return
    queued = true
    requestAnimationFrame(update)
  }, { passive: true })
  update()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeaderScroll, { once: true })
else initHeaderScroll()
