import { useEffect, useState } from 'react'
import { useTheme } from '../theme.js'
import { isLitePerf } from '../perf.js'

// Конфетти цветов флага: падает поверх страницы, не ловит нажатия. В режимах
// «Лёгкий» и «Уменьшить движение» его нет.
const PIECES = 30
const COLORS = ['#ffffff', '#2f6fd6', '#e8392b']

export default function UnityDecor() {
  const theme = useTheme()
  const [calm, setCalm] = useState(true)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setCalm(query.matches || isLitePerf())
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [theme])
  if (theme !== 'unity' || calm) return null
  return <div className="unity-confetti" aria-hidden="true">
    {Array.from({ length: PIECES }, (_, index) => <i key={index} style={{
      left: `${(index * 37 + 11) % 100}%`,
      '--c': COLORS[index % 3],
      '--s': `${6 + (index * 5) % 6}px`,
      '--d': `${11 + (index * 7) % 9}s`,
      '--w': `${-((index * 13) % 17)}s`,
      '--x': `${((index * 29) % 61) - 30}px`,
    }} />)}
  </div>
}
