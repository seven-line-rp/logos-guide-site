import { useEffect, useState } from 'react'

// Сколько миллисекунд до начала следующей минуты.
export function msToNextMinute(now = new Date()) {
  return 60000 - (now.getSeconds() * 1000 + now.getMilliseconds())
}

// Текущее время с точностью до минуты: обновляется ровно на границе минуты
// (а не раз в полминуты, как раньше, когда отсчёт «через 5 мин» мог отставать)
// и сразу, когда вкладка возвращается из фона — после разблокировки телефона
// таймеры браузера стоят, и без этого статус пары был бы устаревшим.
export function useMinuteNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer = 0
    const tick = () => {
      setNow(new Date())
      timer = window.setTimeout(tick, msToNextMinute() + 50)
    }
    timer = window.setTimeout(tick, msToNextMinute() + 50)
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(new Date()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  return now
}
