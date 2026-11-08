import { useEffect, useRef } from 'react'
import { useTheme } from '../theme.js'

// Части темы «Пикми» (src/theme.js): цветы и лепестки на главном экране,
// подпись от руки и сердечки там, где коснулись экрана. Стили — src/pickme.css.
// Всё декоративное: aria-hidden, нажатия не перехватывает. При «Уменьшить
// движение» лепестки не падают, а сердечки не появляются.

const PETAL_COLORS = ['#ff8fbf', '#ffb3d1', '#ffd1e3', '#e9b8ff', '#ffc9b5']

// Цветок из повёрнутых эллипсов-лепестков. kind: daisy — ромашка,
// sakura — сакура с сердцевидными лепестками, bloom — пышный пион.
function Flower({ kind = 'daisy', size = 120, petal = '#fff', center = '#ffd36b', className = '', style }) {
  const count = kind === 'sakura' ? 5 : kind === 'bloom' ? 10 : 12
  const r = 50
  return <svg className={`pm-flower ${className}`} style={style} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    {kind === 'bloom' && Array.from({ length: count }, (_, index) => <ellipse key={`o${index}`} cx={r} cy={r - 24} rx="15" ry="24" fill={petal} opacity=".55" transform={`rotate(${(360 / count) * index + 18} ${r} ${r})`} />)}
    {Array.from({ length: count }, (_, index) => kind === 'sakura'
      ? <path key={index} d="M50 50 C 36 36, 34 16, 44 8 Q 50 14 50 14 Q 50 14 56 8 C 66 16, 64 36, 50 50 Z" fill={petal} transform={`rotate(${(360 / count) * index} 50 50)`} />
      : <ellipse key={index} cx={r} cy={r - (kind === 'bloom' ? 18 : 25)} rx={kind === 'bloom' ? 12 : 8} ry={kind === 'bloom' ? 19 : 22} fill={petal} transform={`rotate(${(360 / count) * index} ${r} ${r})`} />)}
    <circle cx="50" cy="50" r={kind === 'sakura' ? 9 : 13} fill={center} />
    {kind === 'sakura' && [0, 72, 144, 216, 288].map((angle) => <circle key={angle} cx="50" cy="38" r="2.2" fill="#ff5fa2" transform={`rotate(${angle} 50 50)`} />)}
  </svg>
}

function Leaf({ style }) {
  return <svg className="pm-leaf" style={style} width="70" height="40" viewBox="0 0 70 40" aria-hidden="true"><path d="M2 20 C 20 0, 50 0, 68 20 C 50 40, 20 40, 2 20 Z" fill="#9fe0b5" /><path d="M6 20 H 64" stroke="#6fc791" strokeWidth="1.6" fill="none" /></svg>
}

// Лепестки падают по всей ширине главного экрана; у каждого своё место,
// задержка и скорость (CSS-переменные), чтобы не было видно повтора.
const PETALS = Array.from({ length: 16 }, (_, index) => ({
  left: (index * 61) % 100,
  delay: -((index * 1.7) % 11),
  duration: 9 + ((index * 3) % 7),
  size: 10 + ((index * 5) % 9),
  sway: 30 + ((index * 13) % 50),
  color: PETAL_COLORS[index % PETAL_COLORS.length],
}))

export function PickmeGarden() {
  return <div className="pm-garden" aria-hidden="true">
    <div className="pm-bouquet">
      <Flower kind="bloom" size={230} petal="#ff8fbf" center="#ffd36b" className="pm-f1" />
      <Flower kind="daisy" size={150} petal="#ffffff" center="#ffcf5c" className="pm-f2" />
      <Flower kind="sakura" size={120} petal="#ffc2dc" center="#fff3f8" className="pm-f3" />
      <Flower kind="bloom" size={140} petal="#e2b6ff" center="#fff0a6" className="pm-f4" />
      <Flower kind="daisy" size={92} petal="#fff7fb" center="#ff8fbf" className="pm-f5" />
      <Flower kind="sakura" size={78} petal="#ff9cc6" center="#fff" className="pm-f6" />
      <Leaf style={{ '--x': '18%', '--y': '64%', '--r': '-28deg' }} />
      <Leaf style={{ '--x': '62%', '--y': '76%', '--r': '24deg' }} />
      <Leaf style={{ '--x': '40%', '--y': '8%', '--r': '160deg' }} />
      <span className="pm-sparkle" style={{ '--x': '8%', '--y': '20%' }}>✦</span>
      <span className="pm-sparkle" style={{ '--x': '86%', '--y': '12%', '--d': '-1.2s' }}>✧</span>
      <span className="pm-sparkle" style={{ '--x': '92%', '--y': '70%', '--d': '-.6s' }}>♡</span>
      <span className="pm-sparkle" style={{ '--x': '4%', '--y': '82%', '--d': '-2s' }}>✿</span>
    </div>
    <div className="pm-petals">
      {PETALS.map((petal, index) => <i key={index} style={{ '--left': `${petal.left}%`, '--delay': `${petal.delay}s`, '--dur': `${petal.duration}s`, '--size': `${petal.size}px`, '--sway': `${petal.sway}px`, '--c': petal.color }} />)}
    </div>
  </div>
}

export function PickmeChip() {
  const theme = useTheme()
  if (theme !== 'pickme') return null
  return <span className="pm-chip"><span aria-hidden="true">✿</span> Пикми-тема <span aria-hidden="true">♡</span></span>
}

export function PickmeNote() {
  const theme = useTheme()
  if (theme !== 'pickme') return null
  return <span className="pm-note" aria-hidden="true">найдём за минутку ♡</span>
}

// Сердечки от пальца или курсора: на каждое нажатие — несколько штук,
// разлетаются и исчезают. Только в теме «Пикми».
const HEARTS = ['♡', '♥', '✿', '✦']

export function PickmeHearts() {
  const theme = useTheme()
  const layerRef = useRef(null)
  useEffect(() => {
    if (theme !== 'pickme') return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const onPointerDown = (event) => {
      const layer = layerRef.current
      if (!layer || event.button > 0) return
      for (let index = 0; index < 5; index += 1) {
        const heart = document.createElement('span')
        heart.className = 'pm-heart'
        heart.textContent = HEARTS[index % HEARTS.length]
        const angle = (Math.PI * 2 * index) / 5 + Math.random() * .6
        heart.style.left = `${event.clientX}px`
        heart.style.top = `${event.clientY}px`
        heart.style.setProperty('--dx', `${Math.cos(angle) * (26 + Math.random() * 22)}px`)
        heart.style.setProperty('--dy', `${Math.sin(angle) * (26 + Math.random() * 22) - 24}px`)
        heart.style.color = PETAL_COLORS[index % PETAL_COLORS.length]
        layer.appendChild(heart)
        window.setTimeout(() => heart.remove(), 900)
      }
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [theme])
  if (theme !== 'pickme') return null
  return <div ref={layerRef} className="pm-hearts" aria-hidden="true" />
}
