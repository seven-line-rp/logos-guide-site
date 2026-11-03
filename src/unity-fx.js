// Праздничные эффекты темы «Единство», которые запускаются из разных мест
// сайта: конфетти цветов флага на весь экран (src/components/UnityConfetti.jsx).
export const CONFETTI_EVENT = 'logos:unity-confetti'

export function fireConfetti() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CONFETTI_EVENT))
}

// Пасхалка поиска: «1612», «единство», «минин», «пожарский» запускают конфетти.
const EASTER = /^(1612|единство|минин|пожарский|4 ноября|россия)$/i
export function isUnityEasterEgg(query) {
  return EASTER.test(String(query).trim())
}

// Сколько осталось до 4 ноября 00:00 по местному времени: дни, часы, минуты, секунды.
// null — праздник уже наступил (идёт или прошёл).
export function unityCountdown(now = new Date()) {
  const target = new Date(now.getFullYear(), 10, 4)
  let left = Math.floor((target - now) / 1000)
  if (left <= 0) return null
  const days = Math.floor(left / 86400); left -= days * 86400
  const hours = Math.floor(left / 3600); left -= hours * 3600
  const minutes = Math.floor(left / 60)
  return { days, hours, minutes, seconds: left - minutes * 60 }
}

// Мини-игра «Собери флаг»: нажатие на полосу меняет её цвет по кругу.
export const FLAG_ORDER = ['white', 'blue', 'red']
export function nextStripe(color) {
  return FLAG_ORDER[(FLAG_ORDER.indexOf(color) + 1) % FLAG_ORDER.length]
}
export function isFlagRight(stripes) {
  return stripes.every((color, index) => color === FLAG_ORDER[index])
}
