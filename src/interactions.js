// Тень у шапки, когда страница прокручена.
// Шапку ищем при каждой прокрутке, потому что этот файл выполняется раньше,
// чем React успевает её отрисовать.
function initHeaderScroll() {
  const update = () => {
    document.querySelector('.site-header')?.classList.toggle('scrolled', window.scrollY > 12)
  }
  window.addEventListener('scroll', update, { passive: true })
  update()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeaderScroll, { once: true })
else initHeaderScroll()
