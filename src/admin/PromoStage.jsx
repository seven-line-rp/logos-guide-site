import { useMemo } from 'react'
import QRCode from 'qrcode'
import wordmark from '../assets/logo-wordmark.js'
import { PROMO_LINES } from './promo-script.js'
import timeline from './promo-timeline.json'
import shots from './promo-shots.json'

// Кадр промо-ролика в момент t (секунды). Всё считается от времени, без таймеров
// и CSS-анимаций: так ролик идёт ровно в такт озвучке, его можно перематывать,
// а scripts/render-promo.mjs снимает те же кадры в MP4.
// Сцена — 1280×720, снаружи её масштабируют под ширину плеера.
// В середине ролика — настоящие экраны сайта (public/promo/shots, снимает
// scripts/capture-promo-shots.mjs) с курсором и наездами камеры.

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
  for (const line of CAPTIONS) if (!starts.some((scene) => scene.id === line.scene)) starts.push({ id: line.scene, start: Math.max(0, line.start - .35 - (line.lead || 0)) })
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

// ---------- Окно браузера и телефон с настоящими экранами ----------
const WIN = { x: 120, y: 26, w: 1040, h: 585, bar: 38 }

// Камера: увеличение zoom, в центре кадра — точка (fx, fy) снимка.
function cameraFor(shot, focus, zoom, viewW, viewH) {
  const k = (viewW / shot.w) * zoom
  const cx = focus ? focus.x + focus.w / 2 : shot.w / 2
  const cy = focus ? focus.y + focus.h / 2 : shot.h / 2
  let tx = viewW / 2 - cx * k
  let ty = viewH / 2 - cy * k
  tx = Math.min(0, Math.max(viewW - shot.w * k, tx))
  ty = Math.min(0, Math.max(viewH - shot.h * k, ty))
  return { k, tx, ty }
}
const mixCam = (a, b, p) => ({ k: a.k + (b.k - a.k) * p, tx: a.tx + (b.tx - a.tx) * p, ty: a.ty + (b.ty - a.ty) * p })

// Несколько снимков подряд с плавной сменой: layers = [{ shot, opacity }].
function Screen({ layers, cam, viewW, viewH }) {
  return <div style={{ position: 'relative', width: viewW, height: viewH, overflow: 'hidden', background: '#fff' }}>
    {layers.map(({ shot, opacity }) => <img key={shot.src} src={shot.src} alt="" draggable="false" style={{ position: 'absolute', left: 0, top: 0, width: shot.w * cam.k, height: shot.h * cam.k, transform: `translate(${cam.tx}px, ${cam.ty}px)`, opacity }} />)}
  </div>
}

function Browser({ url, children, enter = 1 }) {
  return <div style={{ position: 'absolute', left: WIN.x, top: WIN.y + (1 - enter) * 50, width: WIN.w, opacity: enter, borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 40px 90px -40px rgba(9,24,54,.55), 0 0 0 1px rgba(15,37,87,.08)' }}>
    <div style={{ height: WIN.bar, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: '#eef2f8', borderBottom: '1px solid #dfe5ef' }}>
      {['#ff6058', '#ffbd2e', '#28c941'].map((color) => <i key={color} style={{ width: 11, height: 11, borderRadius: '50%', background: color }} />)}
      <div style={{ marginLeft: 14, flex: 1, maxWidth: 460, height: 24, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRadius: 7, background: '#fff', color: MUTED, fontSize: 13 }}>🔒 <span style={{ color: INK }}>{url}</span></div>
    </div>
    {children}
  </div>
}

// Курсор: путь из точек [время, x, y] в координатах сцены, клики — времена.
function Cursor({ t, path, clicks = [] }) {
  if (!path.length || t < path[0][0] - .3) return null
  let x = path[0][1]
  let y = path[0][2]
  for (let i = 1; i < path.length; i += 1) {
    const [t0, x0, y0] = path[i - 1]
    const [t1, x1, y1] = path[i]
    if (t >= t0) { const p = easeInOut(seg(t, t0, t1)); x = x0 + (x1 - x0) * p; y = y0 + (y1 - y0) * p }
  }
  const click = clicks.map((at) => t - at).find((d) => d >= 0 && d < .45)
  const fadeIn = appear(t, path[0][0] - .3, .3)
  return <>
    {click !== undefined && <span style={{ position: 'absolute', left: x - 26, top: y - 26, width: 52, height: 52, borderRadius: '50%', border: `3px solid ${UI}`, opacity: 1 - click / .45, transform: `scale(${.4 + click * 1.6})` }} />}
    <svg width="30" height="34" viewBox="0 0 30 34" style={{ position: 'absolute', left: x - 4, top: y - 2, opacity: fadeIn, transform: click !== undefined && click < .12 ? 'scale(.9)' : 'none', filter: 'drop-shadow(0 3px 5px rgba(9,24,54,.35))' }} aria-hidden="true"><path d="M4 2 L4 26 L10.5 20 L15 30 L19.5 28 L15 18.5 L24 18.5 Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" /></svg>
  </>
}

// Точка снимка → координаты сцены внутри окна браузера при данной камере.
const onStage = (rect, cam, fx = .5, fy = .5) => [WIN.x + cam.tx + (rect.x + rect.w * fx) * cam.k, WIN.y + WIN.bar + cam.ty + (rect.y + rect.h * fy) * cam.k]

// ---------- Сцена 2: логотип → главная сайта ----------
function Brand({ local }) {
  const logo = 1 - seg(local, 1.5, 2.0)
  const enter = appear(local, 1.7, .7)
  const home = shots.home
  const cam = mixCam(cameraFor(home, home.rects.hero, 1.35, WIN.w, WIN.h), cameraFor(home, null, 1, WIN.w, WIN.h), easeInOut(seg(local, 1.9, 3.4)))
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: logo, transform: `scale(${.95 + appear(local, .1, .9) * .05})` }}>
      {/* Слоган уже есть в самом логотипе («Твой личный компас…»), второй не добавляем. */}
      <Wordmark width={820} reveal={easeInOut(seg(local, .15, 1.1))} />
    </div>
    {enter > 0 && <Browser url="logos-guide.ru" enter={enter}><Screen layers={[{ shot: home, opacity: 1 }]} cam={cam} viewW={WIN.w} viewH={WIN.h} /></Browser>}
  </div>
}

// ---------- Сцена 3: поиск на главной ----------
function SearchScene({ t }) {
  const s0 = LINE.search.start
  const m0 = LINE.map.start
  const typing = [shots.home, shots['type-1'], shots['type-2'], shots['type-3']]
  const typeAt = [0, s0 + 1.2, s0 + 1.55, s0 + 1.9]
  // Буквы появляются сразу, без перехода: иначе подсказки двух снимков двоятся.
  const layers = typing.map((shot, i) => ({ shot, opacity: i === 0 || t >= typeAt[i] ? 1 : 0 }))
  const zoomIn = easeInOut(seg(t, s0 + .1, s0 + 1.1))
  const full = cameraFor(shots.home, null, 1, WIN.w, WIN.h)
  const close = cameraFor(shots['type-3'], { x: 44, y: 470, w: 530, h: 180 }, 1.55, WIN.w, WIN.h)
  const cam = mixCam(full, close, zoomIn)
  // К концу сцены — переход на карту: снимок карты проявляется поверх.
  const toMap = seg(t, m0 - .1, m0 + .35)
  const mapCam = mixCam(cameraFor(shots.map, null, 1, WIN.w, WIN.h), cameraFor(shots.map, { x: 560, y: 380, w: 680, h: 340 }, 1.3, WIN.w, WIN.h), easeInOut(seg(t, m0 + .5, m0 + 2.2)))
  const field = onStage(shots.home.rects.search, close, .35, .5)
  const pick = onStage(shots['type-3'].rects.first, close, .3, .5)
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <Browser url={toMap > .5 ? 'logos-guide.ru/map?floor=2&room=physics-211' : 'logos-guide.ru'}>
      <div style={{ position: 'relative' }}>
        <Screen layers={layers} cam={cam} viewW={WIN.w} viewH={WIN.h} />
        <div style={{ position: 'absolute', inset: 0, opacity: toMap }}><Screen layers={[{ shot: shots.map, opacity: 1 }]} cam={mapCam} viewW={WIN.w} viewH={WIN.h} /></div>
      </div>
    </Browser>
    {toMap < 1 && <Cursor t={t} path={[[s0, 900, 560], [s0 + .9, field[0], field[1]], [s0 + 2.4, field[0], field[1]], [m0 - .45, pick[0], pick[1]]]} clicks={[s0 + .95, m0 - .3]} />}
  </div>
}

// ---------- Сцена 4: маршрут ----------
function RouteScene({ t, local }) {
  const r0 = LINE.route.start
  const f0 = LINE.floors.start
  const steps = [shots['route-1'], shots['route-2'], shots['route-3']]
  const stepAt = [0, f0 + .9, f0 + 2.5]
  const layers = steps.map((shot, i) => ({ shot, opacity: i === 0 ? 1 : seg(t, stepAt[i], stepAt[i] + .25) }))
  const r = shots['route-1'].rects
  const onForm = cameraFor(steps[0], { x: 60, y: 150, w: 420, h: 220 }, 1.5, WIN.w, WIN.h)
  const full = cameraFor(steps[0], null, 1, WIN.w, WIN.h)
  const onScene = cameraFor(steps[0], r.scene, 1.25, WIN.w, WIN.h)
  const cam = t < f0 - .2 ? mixCam(onForm, full, easeInOut(seg(t, r0 + 1.2, r0 + 2.2))) : mixCam(full, onScene, easeInOut(seg(t, f0 - .2, f0 + .7)))
  const next = onStage(r.next, onScene)
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <Browser url="logos-guide.ru/route?from=entrance-1&to=physics-211" enter={appear(local, 0, .35)}><Screen layers={layers} cam={cam} viewW={WIN.w} viewH={WIN.h} /></Browser>
    <Cursor t={t} path={[[f0 + .2, 700, 420], [f0 + .75, next[0], next[1]], [f0 + 2.3, next[0], next[1]]]} clicks={[f0 + .85, f0 + 2.4]} />
  </div>
}

// Телефон с настоящим экраном сайта. highlight — рамка вокруг элемента снимка.
function PhoneShot({ shot, highlight, glow = 0, x, y, enter = 1 }) {
  const viewW = 256
  const viewH = Math.round(viewW * shot.h / shot.w)
  const cam = cameraFor(shot, null, 1, viewW, viewH)
  return <div style={{ position: 'absolute', left: x, top: y + (1 - enter) * 60, width: viewW + 18, padding: 9, borderRadius: 40, background: '#0d1830', boxShadow: '0 40px 80px -34px rgba(9,24,54,.6)', opacity: enter }}>
    <div style={{ position: 'relative', borderRadius: 31, overflow: 'hidden' }}>
      <Screen layers={[{ shot, opacity: 1 }]} cam={cam} viewW={viewW} viewH={viewH} />
      {highlight && <span style={{ position: 'absolute', left: highlight.x * cam.k - 4, top: highlight.y * cam.k - 4, width: highlight.w * cam.k + 8, height: highlight.h * cam.k + 8, borderRadius: 16, boxShadow: `0 0 0 3px ${GOLD}, 0 0 24px 4px rgba(255,210,103,.55)`, opacity: glow }} />}
    </div>
  </div>
}

// Заголовок слева от телефона.
function Side({ local, title, text }) {
  return <div style={{ position: 'absolute', left: 110, top: 200, width: 560, opacity: appear(local, .1, .5), transform: `translateY(${(1 - appear(local, .1, .5)) * 16}px)` }}>
    <div style={{ color: INK, fontSize: 62, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.03em' }}>{title}</div>
    <div style={{ marginTop: 22, color: MUTED, fontSize: 28, lineHeight: 1.4 }}>{text}</div>
  </div>
}

// ---------- Рекламная пауза: Mr.Брекин VPN ----------
// Шутка посреди ролика: «реклама» несуществующего VPN, который «обходит пары
// стороной» — карточки пар буквально облетают его щит. Сразу после неё ролик
// показывает расписание, то есть как на пары всё-таки дойти.
export const AD_PINK = '#ff3d8b'
const AD_DEEP = '#2a0f4f'
const AD_LIME = '#c6ff3d'
const LESSONS = [
  { at: 1.7, y: 270, side: -1, title: '1 пара · Физика', room: 'каб. 211' },
  { at: 2.35, y: 285, side: 1, title: '2 пара · Матанализ', room: 'каб. 305' },
  { at: 3.0, y: 270, side: -1, title: '3 пара · История', room: 'каб. 118' },
  { at: 3.6, y: 295, side: 1, title: '4 пара · Английский', room: 'каб. 402' },
]
const SHIELD = { x: 640, y: 270 }

// Щит-«мистер»: цилиндр, монокль и усы, на груди — замок VPN.
// mouth (0…1) — насколько открыт рот: в мультике (CartoonStage) он говорит.
export function MrShield({ wobble = 0, mouth = 0 }) {
  return <svg width="230" height="270" viewBox="-115 -150 230 270" aria-hidden="true" style={{ transform: `rotate(${wobble}deg)`, filter: 'drop-shadow(0 26px 30px rgba(10,0,30,.45))' }}>
    <path d="M-62 -128 H62 V-78 H-62 Z" fill="#14081f" />
    <path d="M-92 -78 H92 a8 8 0 0 1 0 14 H-92 a8 8 0 0 1 0 -14Z" fill="#14081f" />
    <path d="M-62 -92 H62 V-82 H-62 Z" fill={AD_PINK} />
    <path d="M0 -60 L86 -30 V22 C86 72 46 102 0 118 C-46 102 -86 72 -86 22 V-30 Z" fill="#fff" stroke="#14081f" strokeWidth="6" strokeLinejoin="round" />
    <circle cx="-28" cy="-14" r="8" fill="#14081f" />
    <circle cx="28" cy="-14" r="15" fill="none" stroke="#e7b400" strokeWidth="4" /><circle cx="28" cy="-14" r="7" fill="#14081f" />
    <path d="M43 -2 Q52 30 46 52" fill="none" stroke="#e7b400" strokeWidth="2.5" />
    {mouth > 0 && <ellipse cx="0" cy="32" rx="16" ry={4 + mouth * 12} fill="#7a1033" />}
    <path d="M-48 22 C-36 6 -14 6 0 18 C14 6 36 6 48 22 C36 18 22 26 0 28 C-22 26 -36 18 -48 22Z" fill="#14081f" transform={`translate(0 ${-mouth * 5})`} />
    <rect x="-20" y="62" width="40" height="30" rx="7" fill={AD_PINK} />
    <path d="M-11 62 V53 a11 11 0 0 1 22 0 V62" fill="none" stroke={AD_PINK} strokeWidth="6" />
    <circle cy="74" r="4.5" fill="#fff" /><rect x="-2" y="74" width="4" height="9" fill="#fff" />
  </svg>
}

function AdScene({ local }) {
  const ad = LINE.ad
  const talk = local - (ad.start - SCENES.find((scene) => scene.id === 'ad').start)
  // Заставка «Реклама» как на ТВ: полосы помех, потом плашка уезжает в угол.
  const bumper = 1 - seg(local, .95, 1.3)
  const noise = local < .35 ? 1 : 0
  const product = appear(local, 1.05, .45)
  const wobble = Math.sin(local * 7) * 4 * product
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(circle at 50% 42%, #6a1fb5 0%, ${AD_DEEP} 70%)` }}>
    {/* Лучи за щитом, медленно крутятся. */}
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0, opacity: .35 * product }} aria-hidden="true">
      <g transform={`translate(${SHIELD.x} ${SHIELD.y}) rotate(${local * 18})`}>
        {Array.from({ length: 12 }, (_, i) => <path key={i} d="M0 0 L-90 -900 L90 -900Z" fill={i % 2 ? AD_PINK : '#8b3dff'} transform={`rotate(${i * 30})`} />)}
      </g>
    </svg>
    {/* Карточки пар летят на щит и облетают его сверху или снизу. */}
    {LESSONS.map((lesson) => {
      const p = seg(local, lesson.at, lesson.at + 1.5)
      if (p <= 0 || p >= 1) return null
      const x = 1420 - p * 1900
      const near = Math.exp(-(((x + 130 - SHIELD.x) / 230) ** 2))
      // Вниз облёт меньше: под щитом — название.
      const y = lesson.y + lesson.side * near * (lesson.side < 0 ? 200 : 140)
      return <div key={lesson.title} style={{ position: 'absolute', left: x, top: y - 36, width: 260, padding: '12px 16px', borderRadius: 14, background: '#fff', boxShadow: '0 16px 30px -18px rgba(0,0,0,.6)', transform: `rotate(${lesson.side * near * -14}deg)`, opacity: product }}>
        <div style={{ color: INK, fontSize: 20, fontWeight: 800 }}>{lesson.title}</div>
        <div style={{ color: MUTED, fontSize: 15 }}>{lesson.room}</div>
      </div>
    })}
    <div style={{ position: 'absolute', left: SHIELD.x - 115, top: SHIELD.y - 150, opacity: product, transform: `scale(${.55 + .35 * ease(product)})` }}><MrShield wobble={wobble} /></div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 478, textAlign: 'center', opacity: appear(talk, -.1, .35), transform: `scale(${.85 + .15 * appear(talk, -.1, .35)})` }}>
      <div style={{ color: '#fff', fontSize: 84, fontWeight: 900, letterSpacing: '-.03em', fontStyle: 'italic', textShadow: `5px 5px 0 ${AD_PINK}` }}>Mr.Брекин <span style={{ color: AD_LIME }}>VPN</span></div>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 592, textAlign: 'center', color: '#fff', fontSize: 38, fontWeight: 700, opacity: appear(talk, 1.25, .35) }}>обходит ваши пары стороной</div>
    {/* Переключатель как в настоящих VPN. */}
    <div style={{ position: 'absolute', right: 44, top: 36, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderRadius: 40, background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 18, opacity: appear(local, 1.4, .4) }}>
      <span style={{ width: 54, height: 30, borderRadius: 15, background: local > 1.9 ? AD_LIME : 'rgba(255,255,255,.35)', position: 'relative' }}><i style={{ position: 'absolute', top: 3, left: 3 + appear(local, 1.9, .2) * 24, width: 24, height: 24, borderRadius: '50%', background: '#fff' }} /></span>
      <span>{local > 1.9 ? 'Подключено · сервер «Диван»' : 'Не подключено'}</span>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', color: 'rgba(255,255,255,.6)', fontSize: 15, opacity: appear(talk, .8, .4) }}>*Шутка. Такого VPN нет, а прогулы не помогают. Дойти до пары поможет ЛОГОС Путеводитель.</div>
    {/* Плашка «Реклама»: сначала на весь кадр, потом — в углу. */}
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: `rgba(20,8,31,${bumper * .9})`, opacity: bumper > 0 ? 1 : 0 }}>
      <div style={{ padding: '16px 46px', borderRadius: 18, background: GOLD, color: '#14081f', fontSize: 92, fontWeight: 900, letterSpacing: '.04em', transform: `rotate(-3deg) scale(${.7 + .3 * ease(seg(local, .05, .35))})`, opacity: bumper }}>РЕКЛАМА</div>
    </div>
    <div style={{ position: 'absolute', left: 40, top: 40, padding: '6px 14px', borderRadius: 8, background: GOLD, color: '#14081f', fontSize: 18, fontWeight: 900, letterSpacing: '.08em', opacity: 1 - bumper }}>РЕКЛАМА</div>
    {/* Помехи при переключении «канала». */}
    {noise > 0 && <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      {Array.from({ length: 26 }, (_, i) => { const r = Math.sin(i * 91.7 + Math.floor(local * 30) * 13.1) * 43758.5453; const v = r - Math.floor(r); return <rect key={i} x="0" y={i * 28} width={STAGE_W} height={6 + v * 22} fill={v > .5 ? '#fff' : '#000'} opacity={.25 + v * .5} transform={`translate(${(v - .5) * 80} 0)`} /> })}
    </svg>}
  </div>
}

// ---------- Сцена 5: расписание на главной ----------
function ScheduleScene({ local }) {
  const shot = shots['phone-day']
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <Side local={local} title="Ваш день на главной" text="Следующая пара, кабинет и сколько осталось до звонка" />
    <PhoneShot shot={shot} highlight={shot.rects.lesson} glow={appear(local, 1, .5)} x={860} y={34} enter={appear(local, 0, .6)} />
  </div>
}

// ---------- Сцена 6: табличка «Вы здесь» ----------
function HereScene({ local }) {
  const qr = useMemo(() => QRCode.create('https://logos-guide.ru/here?room=physics-211', { errorCorrectionLevel: 'M' }).modules, [])
  const cell = 150 / qr.size
  const scanned = appear(local, 2.4, .5)
  const shot = shots['phone-here']
  return <div style={{ position: 'absolute', inset: 0, background: PALE }}>
    <Side local={local} title="Табличка «Вы здесь»" text="Наведите камеру на код у двери, и маршрут начнётся оттуда" />
    {/* Табличка, как её печатает раздел /here, потом — экран, который откроется. */}
    <div style={{ position: 'absolute', left: 700, top: 150, width: 200, padding: 14, borderRadius: 14, background: '#fff', boxShadow: '0 20px 40px -24px rgba(9,24,54,.5)', textAlign: 'center', opacity: appear(local, .2, .5) * (1 - scanned * .35), transform: `rotate(-4deg) translateX(${-scanned * 30}px)` }}>
      <div style={{ color: INK, fontSize: 30, fontWeight: 800 }}>211</div>
      <div style={{ color: MUTED, fontSize: 13, marginBottom: 8 }}>Кабинет физики</div>
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">{Array.from(qr.data).map((on, i) => on ? <rect key={i} x={(i % qr.size) * cell} y={Math.floor(i / qr.size) * cell} width={cell + .3} height={cell + .3} fill={NAVY} /> : null)}</svg>
      <div style={{ marginTop: 6, color: UI, fontSize: 14, fontWeight: 700 }}>Вы здесь</div>
      <div style={{ position: 'absolute', left: 10, right: 10, top: 70 + seg(local, 1, 2.3) * 160, height: 3, borderRadius: 2, background: GOLD, boxShadow: `0 0 14px ${GOLD}`, opacity: local > 1 && local < 2.3 ? 1 : 0 }} />
    </div>
    <PhoneShot shot={shot} highlight={shot.rects.nearest} glow={appear(local, 3.2, .5)} x={900} y={34} enter={scanned} />
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

const SCENE_VIEWS = { hook: Hook, brand: Brand, search: SearchScene, route: RouteScene, ad: AdScene, schedule: ScheduleScene, here: HereScene, outro: Outro }

// Фраза сценария, которая звучит в момент t. Субтитров в самом ролике нет (их убрали
// по просьбе команды), но в панели фраза видна как суфлёр, когда записываете свой голос.
export function captionAt(t) {
  return CAPTIONS.find((line) => t >= line.start - .15 && t <= line.end + .35) || null
}

// Во время рекламной паузы значок-компас в углу прячем: там плашка «Реклама».
const AD_SCENE = SCENES.find((scene) => scene.id === 'ad')
const inAd = (t) => AD_SCENE && t >= AD_SCENE.start && t < AD_SCENE.end

export default function PromoStage({ t }) {
  const fade = .4
  const visible = SCENES.filter((scene) => t >= scene.start - fade && t < scene.end + fade)
  return <div className="promo-stage" style={{ position: 'relative', width: STAGE_W, height: STAGE_H, overflow: 'hidden', background: PALE, fontFamily: "'Onest Variable', Onest, system-ui, sans-serif" }}>
    {visible.map((scene) => {
      const View = SCENE_VIEWS[scene.id]
      // Мягкая смена сцен: новая проявляется поверх старой.
      const opacity = scene.start === 0 ? 1 : seg(t, scene.start, scene.start + fade)
      return <div key={scene.id} style={{ position: 'absolute', inset: 0, opacity }}><View t={t} local={t - scene.start} /></div>
    })}
    <div aria-hidden="true" style={{ position: 'absolute', left: 36, top: 30, opacity: t > 1 && t < SCENES.at(-1).start && !inAd(t) ? .9 : 0 }}><Compass size={40} /></div>
  </div>
}
