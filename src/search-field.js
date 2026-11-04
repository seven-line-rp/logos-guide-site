import { useLayoutEffect, useState } from 'react'

// Общее поведение строк поиска (главная, «Кабинеты», «Преподаватели»).
// Стили — в src/search-fields.css.

// Нажатие в любое место строки — на лупу, на отступ, рядом с кнопками — ставит
// курсор в поле. Раньше поле занимало только середину строки, и нажатие по краям
// ничего не делало. Кнопки и ссылки внутри строки работают как обычно.
export function focusInputOnPress(event) {
  if (event.button !== undefined && event.button !== 0) return
  if (event.target.closest('input, button, a, textarea, select')) return
  const input = event.currentTarget.querySelector('input')
  if (!input) return
  event.preventDefault()
  input.focus()
}

// Положение строки на экране для выпадающего списка подсказок. Список рисуется
// поверх страницы (portal), потому что первый экран главной обрезает всё, что
// выходит за его край, а на телефоне подсказки как раз туда и выходят.
export function useAnchorRect(ref, active) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!active || !ref.current) { setRect(null); return undefined }
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = ref.current?.getBoundingClientRect()
        if (box) setRect({ top: box.bottom, left: box.left, width: box.width })
      })
    }
    const box = ref.current.getBoundingClientRect()
    setRect({ top: box.bottom, left: box.left, width: box.width })
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [ref, active])
  return rect
}
