import { useMemo } from 'react'
import QRCode from 'qrcode'
import wordmark from '../assets/logo-wordmark.js'
import { PROMO_LINES } from './promo-script.js'
import timeline from './promo-timeline.json'

// Кадр промо-ролика в момент t (секунды). Всё считается от времени, без таймеров
// и CSS-анимаций: так ролик идёт ровно в такт озвучке, его можно перематывать,
// а scripts/render-promo.mjs снимает те же кадры в MP4.
// Сцена — 1280×720, снаружи её масштабируют под ширину плеера.

export const STAGE_W = 1280
export const STAGE_H = 720

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
// Доля пройденного отрезка [a, b] со сглаживанием.
const seg = (t, a, b) => clamp((t - a) / (b - a))
const ease = (x) => 1 - (1 - x) ** 3
const easeInOut = (x) => (x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const appear = (t, a, d = .5) => ease(seg(t, a, a + d))

const LINE = Object.fromEntries(timeline.lines.map((line) => [line.id, line]))
const CAPTIONS = PROMO_LINES.map((line) => ({ ...line, ...LINE[line.id] }))
// Сцена начинается чуть раньше своей первой фразы, кончается с началом следующей.
const SCENES = (() => {
  const starts = []
  for (const line of CAPTIONS) if (!starts.some((scene) => scene.id === line.scene)) starts.push({ id: line.scene, start: Math.max(0, line.start - .35) })
  starts[0].start = 0
  return starts.map((scene, index) => ({ ...scene, end: starts[index + 1]?.start ?? timeline.duration }))
})()
export const PROMO_DURATION = timeline.duration

const BLUE = '#1f3dff'
const UI = '#245ce5'
const NAVY = '#0f2557'
const INK = '#13213a'
const MUTED = '#5d6d86'
const PALE = '#f4f7fc'
const LINEC = '#d4dcea'
const GOLD = '#ffd267'

// Знак-компас из logo.svg: круг с вырезанной стрелкой.
function Compass({ size, needle = 45, color = BLUE, cut = '#fff' }) {
  return <svg width={size} height={size} viewBox="-32 -32 64 64" aria-hidden="true">
    <circle r="30" fill={color} />
    <g transform={`rotate(${needle})`}><path d="M0 -26L7 0L0 26L-7 0Z" fill={cut} stroke={cut} strokeWidth="2.4" strokeLinejoin="round" /><circle r="3.4" fill={color} /></g>
  </svg>
}

// SVG логотипа — свой файл из репозитория (src/assets), не пользовательский ввод.
function Wordmark({ width, dark = false, reveal = 1 }) {
  const svg = useMemo(() => (dark ? wordmark.replaceAll('#0000FF', '#8fa6ff').replaceAll('#13213A', '#e5edfb') : wordmark), [dark])
  return <div style={{ width, clipPath: `inset(0 ${100 - reveal * 100}% 0 0)` }} dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ') }} />
}

// ---------- Сцена 1: «Куда идти?» ----------
function Hook({ t }) {
  const words = ['Первая пара.', 'Новый корпус.', 'Куда идти?']
  const swing = Math.sin(t * 5.2) * 70 * (1 - seg(t, 2.6, 3.6)) + 45
  return <div style={{ position: 'absolute', inset: 0, background: NAVY }}>
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0, opacity: .22 }} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={640 + i * 74} y={150 + (i % 2) * 230} width="66" height="190" fill="none" stroke="#8fa6ff" strokeWidth="2" />)}
      <path d="M610 360 H1280" stroke="#8fa6ff" strokeWidth="3" strokeDasharray="6 10" />
    </svg>
    <div style={{ position: 'absolute', left: 110, top: 190 }}>
      {words.map((word, i) => <div key={word} style={{ color: i === 2 ? GOLD : '#fff', fontSize: 88, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.03em', opacity: appear(t, .35 + i * .8, .45), transform: `translateY(${(1 - appear(t, .35 + i * .8, .45)) * 26}px)` }}>{word}</div>)}
    </div>
    <div style={{ position: 'absolute', left: 900, top: 230, opacity: appear(t, .2, .6) }}><Compass size={260} needle={swing} color="#2a4bff" cut={NAVY} /></div>
  </div>
}

// ---------- Сцена 2: логотип ----------
function Brand({ t }) {
  const p = appear(t, .1, .9)
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: PALE }}>
    <div style={{ display: 'grid', justifyItems: 'center', gap: 34, transform: `scale(${.94 + p * .06})` }}>
      {/* Слоган уже есть в самом логотипе («Твой личный компас…»), второй не добавляем. */}
      <Wordmark width={820} reveal={easeInOut(seg(t, .15, 1.1))} />
    </div>
  </div>
}

// Телефон с экраном сайта.
function Phone({ children, x, y, scale = 1, opacity = 1 }) {
  return <div style={{ position: 'absolute', left: x, top: y, width: 330, height: 640, borderRadius: 46, padding: 12, background: '#0d1830', boxShadow: '0 40px 80px -30px rgba(9,24,54,.55)', transform: `scale(${scale})`, transformOrigin: 'top center', opacity }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 36, background: PALE }}>{children}</div>
  </div>
}

// ---------- Сцена 3: поиск ----------
function SearchScene({ t, local }) {
  const typed = '211'.slice(0, Math.floor(clamp((t - (LINE.search.start + .9)) / .32, 0, 3)))
  const listOn = appear(t, LINE.search.start + 2, .35)
  const mapOn = appear(t, LINE.map.start + .1, .5)
  const pulse = .5 + .5 * Math.sin(t * 6)
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <div style={{ position: 'absolute', left: 110, top: 220, width: 560, opacity: appear(local, .1, .5) }}>
      <div style={{ color: INK, fontSize: 64, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.03em' }}>{mapOn > .5 ? 'И сразу на карте' : 'Найдите кабинет'}</div>
      <div style={{ marginTop: 22, color: MUTED, fontSize: 28, lineHeight: 1.4 }}>По номеру, названию или фамилии преподавателя</div>
    </div>
    {/* Телефон кончается выше полосы субтитров. */}
    <Phone x={800} y={34 + (1 - appear(local, 0, .6)) * 60} scale={.86} opacity={appear(local, 0, .5)}>
      <div style={{ height: 120, padding: '54px 18px 0', background: '#1d43c8', color: '#fff', fontSize: 26, fontWeight: 800 }}>Где найти кабинет</div>
      <div style={{ margin: '-18px 14px 0', height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 14, background: '#fff', boxShadow: `0 0 0 3px ${GOLD}`, color: INK, fontSize: 20, fontWeight: 600 }}>
        <span style={{ color: UI, fontSize: 20 }}>⌕</span>{typed}<span style={{ width: 2, height: 24, background: INK, opacity: Math.floor(t * 2.4) % 2 ? 0 : 1 }} />
      </div>
      <div style={{ margin: '10px 14px 0', padding: 6, borderRadius: 14, background: '#fff', boxShadow: '0 16px 30px -18px rgba(9,24,54,.4)', opacity: listOn * (1 - mapOn), transform: `translateY(${(1 - listOn) * 10}px)` }}>
        {[['Кабинет физики №211', '2 этаж, учебные кабинеты', true], ['Кабинет №217', '2 этаж, учебные кабинеты', false]].map(([title, meta, active]) => <div key={title} style={{ padding: '10px 12px', borderRadius: 10, background: active ? '#e9effc' : 'transparent', boxShadow: active ? `inset 3px 0 0 ${UI}` : 'none' }}><div style={{ color: INK, fontSize: 16, fontWeight: 700 }}>{title}</div><div style={{ color: MUTED, fontSize: 13 }}>{meta}</div></div>)}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 200, bottom: 0, padding: 14, opacity: mapOn }}>
        <div style={{ color: INK, fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Второй этаж</div>
        <svg viewBox="0 0 280 300" width="100%" aria-hidden="true">
          {[[0, 0, 70, 110, '202'], [70, 0, 60, 110, '207'], [130, 0, 70, 110, '211'], [200, 0, 80, 110, '214'], [0, 170, 90, 130, '217'], [90, 170, 90, 130, '222'], [180, 170, 100, 130, '224']].map(([x, y, w, h, n]) => <g key={n}><rect x={x} y={y} width={w} height={h} fill={n === '211' ? `rgba(36,92,229,${.35 + pulse * .35})` : '#fff'} stroke={n === '211' ? UI : LINEC} strokeWidth="2" /><text x={x + w / 2} y={y + h / 2 + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill={n === '211' ? '#fff' : '#8d9ab0'}>{n}</text></g>)}
          <circle cx="165" cy="140" r={8 + pulse * 5} fill={GOLD} opacity=".9" />
        </svg>
      </div>
    </Phone>
  </div>
}

// ---------- Сцена 4: маршрут ----------
function RouteScene({ t, local }) {
  const draw1 = easeInOut(seg(t, LINE.route.start + .3, LINE.route.start + 2.2))
  const toSecond = easeInOut(seg(t, LINE.floors.start, LINE.floors.start + .8))
  const draw2 = easeInOut(seg(t, LINE.floors.start + .8, LINE.floors.start + 2.6))
  const bubble = appear(t, LINE.floors.start + 2.4, .35)
  const plan = (rooms, route, len, progress, label) => <svg viewBox="0 0 760 330" width="760" aria-hidden="true">
    <text x="0" y="24" fontSize="24" fontWeight="800" fill={INK}>{label}</text>
    {rooms.map(([x, y, w, h, n]) => <g key={n}><rect x={x} y={y} width={w} height={h} rx="4" fill={n === '211' && progress > .98 ? UI : '#fff'} stroke={LINEC} strokeWidth="2" /><text x={x + w / 2} y={y + h / 2 + 7} textAnchor="middle" fontSize="20" fontWeight="700" fill={n === '211' && progress > .98 ? '#fff' : '#8d9ab0'}>{n}</text></g>)}
    <path d={route} fill="none" stroke={GOLD} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - progress)} />
  </svg>
  const first = [[0, 50, 150, 110, 'Вход'], [150, 50, 110, 110, '104'], [260, 50, 90, 110, '118'], [350, 50, 90, 110, '119'], [440, 50, 90, 110, '120'], [600, 50, 160, 110, 'Лестница'], [0, 220, 180, 110, '148'], [180, 220, 420, 110, 'Столовая']]
  const second = [[0, 50, 120, 110, '202'], [120, 50, 120, 110, '207'], [240, 50, 120, 110, '209'], [360, 50, 120, 110, '211'], [480, 50, 120, 110, '214'], [600, 50, 160, 110, 'Лестница'], [0, 220, 300, 110, '217'], [300, 220, 300, 110, '222']]
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <div style={{ position: 'absolute', left: 110, top: 70, color: INK, fontSize: 52, fontWeight: 800, letterSpacing: '-.03em', opacity: appear(local, .1, .4) }}>Маршрут до двери</div>
    <div style={{ position: 'absolute', left: 110, top: 150, display: 'flex', gap: 12, opacity: appear(t, LINE.floors.start, .4) }}>
      {/* Без выдуманных минут: сколько идти, считает сам маршрут. */}
      {[['По лестнице', true], ['На лифте', false]].map(([name, best]) => <div key={name} style={{ padding: '10px 16px', borderRadius: 12, border: `2px solid ${best ? UI : LINEC}`, background: best ? '#e9effc' : '#fff', color: INK, fontSize: 20, fontWeight: 700 }}>{name}{best && <span style={{ marginLeft: 10, color: UI }}>быстрее</span>}</div>)}
    </div>
    <div style={{ position: 'absolute', left: 260, top: 230, opacity: 1 - toSecond, transform: `translateY(${-toSecond * 40}px)` }}>{plan(first, 'M75 190 H680 V160', 760, draw1, 'Первый этаж')}</div>
    <div style={{ position: 'absolute', left: 260, top: 230, opacity: toSecond, transform: `translateY(${(1 - toSecond) * 40}px)` }}>{plan(second, 'M680 160 V190 H420 V160', 600, draw2, 'Второй этаж')}</div>
    <div style={{ position: 'absolute', left: 820, top: 150, padding: '14px 20px', borderRadius: '18px 18px 18px 4px', background: NAVY, color: '#fff', fontSize: 24, fontWeight: 700, opacity: bubble, transform: `translateY(${(1 - bubble) * 12}px)` }}>🔊 Кабинет 211 справа</div>
  </div>
}

// ---------- Сцена 5: расписание ----------
function ScheduleScene({ t, local }) {
  const card = appear(local, .2, .6)
  const left = Math.max(0, 12 * 60 - Math.floor(local * 3))
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <div style={{ position: 'absolute', left: 110, top: 220, width: 520, opacity: appear(local, .1, .5) }}>
      <div style={{ color: INK, fontSize: 64, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.03em' }}>Ваш день на главной</div>
      <div style={{ marginTop: 22, color: MUTED, fontSize: 28, lineHeight: 1.4 }}>Следующая пара, кабинет и сколько до звонка</div>
    </div>
    <div style={{ position: 'absolute', left: 700, top: 110, width: 470, padding: 34, borderRadius: 22, background: '#fff', boxShadow: '0 30px 60px -34px rgba(9,24,54,.45)', opacity: card, transform: `translateY(${(1 - card) * 30}px)` }}>
      <div style={{ color: MUTED, fontSize: 20, fontWeight: 700 }}>Следующая пара</div>
      <div style={{ marginTop: 10, color: INK, fontSize: 46, fontWeight: 800, letterSpacing: '-.02em' }}>Физика</div>
      <div style={{ marginTop: 6, color: INK, fontSize: 24 }}>Кабинет 211, 2 этаж</div>
      <div style={{ marginTop: 26, display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ color: UI, fontSize: 56, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span><span style={{ color: MUTED, fontSize: 22 }}>до звонка</span></div>
      <div style={{ marginTop: 14, height: 10, borderRadius: 5, background: '#e6ecf6' }}><div style={{ width: `${30 + seg(local, 0, 4) * 20}%`, height: '100%', borderRadius: 5, background: UI }} /></div>
      <div style={{ marginTop: 26, display: 'inline-block', padding: '14px 22px', borderRadius: 12, background: UI, color: '#fff', fontSize: 22, fontWeight: 700, opacity: appear(t, LINE.schedule.start + 2, .4) }}>Как дойти</div>
    </div>
  </div>
}

// ---------- Сцена 6: табличка «Вы здесь» ----------
function HereScene({ local }) {
  const qr = useMemo(() => QRCode.create('https://logos-guide.ru/here?room=physics-211', { errorCorrectionLevel: 'M' }).modules, [])
  const scan = seg(local, 1.4, 3)
  const found = appear(local, 3.1, .4)
  const cell = 170 / qr.size
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <div style={{ position: 'absolute', left: 110, top: 220, width: 520, opacity: appear(local, .1, .5) }}>
      <div style={{ color: INK, fontSize: 64, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.03em' }}>Табличка «Вы здесь»</div>
      <div style={{ marginTop: 22, color: MUTED, fontSize: 28, lineHeight: 1.4 }}>Наведите камеру на код, и маршрут начнётся от этой двери</div>
    </div>
    {/* Дверь кабинета с табличкой */}
    <div style={{ position: 'absolute', left: 760, top: 60, width: 330, height: 520, borderRadius: '10px 10px 0 0', background: '#dfe6f3', border: '10px solid #c9d5ea', borderBottom: 0, opacity: appear(local, 0, .5) }}>
      <div style={{ position: 'absolute', left: 60, top: 70, width: 190, padding: 10, borderRadius: 10, background: '#fff', boxShadow: '0 10px 24px -14px rgba(9,24,54,.5)', textAlign: 'center' }}>
        <div style={{ color: INK, fontSize: 30, fontWeight: 800 }}>211</div>
        <div style={{ color: MUTED, fontSize: 14, marginBottom: 8 }}>Кабинет физики</div>
        <svg width="170" height="170" viewBox="0 0 170 170" aria-hidden="true">{Array.from(qr.data).map((on, i) => on ? <rect key={i} x={(i % qr.size) * cell} y={Math.floor(i / qr.size) * cell} width={cell + .3} height={cell + .3} fill={NAVY} /> : null)}</svg>
        <div style={{ marginTop: 6, color: UI, fontSize: 14, fontWeight: 700 }}>Вы здесь</div>
      </div>
      <div style={{ position: 'absolute', right: 26, top: 300, width: 16, height: 60, borderRadius: 8, background: '#9fb0cc' }} />
    </div>
    {/* Рамка камеры и полоса сканирования */}
    <div style={{ position: 'absolute', left: 800, top: 140, width: 250, height: 300, border: '4px solid rgba(36,92,229,.9)', borderRadius: 18, opacity: appear(local, 1.1, .3) * (1 - found * .6) }}>
      <div style={{ position: 'absolute', left: 8, right: 8, top: 8 + scan * 270, height: 4, borderRadius: 2, background: GOLD, boxShadow: `0 0 18px ${GOLD}`, opacity: scan < 1 ? 1 : 0 }} />
    </div>
    <div style={{ position: 'absolute', left: 700, top: 440, padding: '16px 22px', borderRadius: 16, background: NAVY, color: '#fff', fontSize: 24, fontWeight: 700, opacity: found, transform: `translateY(${(1 - found) * 14}px)` }}>Начало маршрута: кабинет 211</div>
  </div>
}

// ---------- Сцена 7: финал ----------
function Outro({ local }) {
  const p = appear(local, .1, .7)
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: NAVY }}>
    <div style={{ display: 'grid', justifyItems: 'center', gap: 30, opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      <Wordmark width={640} dark reveal={easeInOut(seg(local, .1, 1))} />
      <div style={{ color: '#fff', fontSize: 64, fontWeight: 800, letterSpacing: '-.02em', opacity: appear(local, 1, .5) }}>logos-guide.ru</div>
      <div style={{ color: '#c9d5ea', fontSize: 28, opacity: appear(local, 1.5, .5) }}>Без регистрации, прямо в браузере</div>
    </div>
  </div>
}

const SCENE_VIEWS = { hook: Hook, brand: Brand, search: SearchScene, route: RouteScene, schedule: ScheduleScene, here: HereScene, outro: Outro }

export function captionAt(t) {
  return CAPTIONS.find((line) => t >= line.start - .15 && t <= line.end + .35) || null
}

export default function PromoStage({ t }) {
  const fade = .4
  const visible = SCENES.filter((scene) => t >= scene.start - fade && t < scene.end + fade)
  const caption = captionAt(t)
  const captionIn = caption ? Math.min(seg(t, caption.start - .15, caption.start + .1), 1 - seg(t, caption.end + .1, caption.end + .35)) : 0
  return <div className="promo-stage" style={{ position: 'relative', width: STAGE_W, height: STAGE_H, overflow: 'hidden', background: PALE, fontFamily: "'Onest Variable', Onest, system-ui, sans-serif" }}>
    {visible.map((scene) => {
      const View = SCENE_VIEWS[scene.id]
      // Мягкая смена сцен: новая проявляется поверх старой.
      const opacity = scene.start === 0 ? 1 : seg(t, scene.start, scene.start + fade)
      return <div key={scene.id} style={{ position: 'absolute', inset: 0, opacity }}><View t={t} local={t - scene.start} /></div>
    })}
    <div aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: 34, maxWidth: 1040, padding: '12px 22px', borderRadius: 12, background: 'rgba(9,18,40,.78)', color: '#fff', fontSize: 27, fontWeight: 600, lineHeight: 1.3, textAlign: 'center', transform: 'translateX(-50%)', opacity: captionIn }}>{caption?.caption}</div>
    <div aria-hidden="true" style={{ position: 'absolute', left: 36, top: 30, opacity: t > 1 && t < SCENES.at(-1).start ? .9 : 0 }}><Compass size={40} /></div>
  </div>
}
