import { useMemo } from 'react'
import wordmark from '../assets/logo-wordmark.js'
import { CARTOON2_LINES, CARTOON2_VERSIONS } from './cartoon2-script.js'
import adultTimeline from './cartoon2-timeline.json'
import cleanTimeline from './cartoon2-timeline-clean.json'
import { AD_PINK, STAGE_H, STAGE_W } from './PromoStage.jsx'
import { Boom, Brekin, GOLD, INK, NAVY, SKIN, Student, appear, ease, mouthOf, pop, seg, stageTimeline } from './CartoonStage.jsx'

// Вторая серия мультика, «Вайб-кодинг», — кадр в момент t (секунды).
// Устроена как первая (CartoonStage.jsx, оттуда же студент и Mr.Брекин): всё
// считается от времени, scripts/render-promo.mjs --film=cartoon2 снимает кадры.
// Информатик Дмитрий Александрович ругает студента за сайт, сделанный с
// нейросетью, и тут прилетает Mr.Брекин. Персонажи вымышлены.

const STAGES = { adult: stageTimeline(CARTOON2_LINES, adultTimeline), clean: stageTimeline(CARTOON2_LINES, cleanTimeline) }
export const cartoon2Duration = (version = 'adult') => (STAGES[version] || STAGES.adult).duration

const WALL = '#e6f0ec'
const FLOOR = '#c6d4ce'
const RED = '#ff3b30'
const MONO = "600 22px/1.5 'JetBrains Mono', 'Fira Code', ui-monospace, monospace"

// ---------- Информатик ----------
// Точка (x, y) — между ботинками. mood: calm | angry | shock. wave — машет указкой.
function Teacher({ x, y, scale = 1, mood = 'calm', mouth = 0, t = 0, wave = 0, steam = 0, bob = 0 }) {
  const face = mood === 'angry' ? '#ff9f8a' : SKIN
  const arm = -40 - wave * (30 + Math.sin(t * 14) * 25)
  const shock = mood === 'shock'
  return <svg width={300 * scale} height={490 * scale} viewBox="-150 -470 300 490" style={{ position: 'absolute', left: x - 150 * scale, top: y - 470 * scale + bob, overflow: 'visible' }} aria-hidden="true">
    {[-18, 18].map((dx) => <g key={dx}><rect x={dx - 13} y="-160" width="26" height="150" rx="6" fill="#3d4352" stroke={INK} strokeWidth="4" /><ellipse cx={dx + (dx < 0 ? -6 : 6)} cy="-6" rx="24" ry="11" fill="#1d1d24" /></g>)}
    {/* Левая рука висит, правая с указкой — машет, когда злится. */}
    <path d="M-62 -290 L-78 -170" stroke="#6f7f5a" strokeWidth="26" strokeLinecap="round" /><circle cx="-79" cy="-164" r="14" fill={SKIN} stroke={INK} strokeWidth="3" />
    <g transform={`rotate(${arm} 62 -290)`}>
      <path d="M62 -290 L62 -175" stroke="#6f7f5a" strokeWidth="26" strokeLinecap="round" />
      <path d="M62 -170 L62 -40" stroke="#9a6b3f" strokeWidth="6" strokeLinecap="round" />
      <circle cx="62" cy="-168" r="14" fill={SKIN} stroke={INK} strokeWidth="3" />
    </g>
    <path d="M-66 -296 Q-66 -312 -40 -314 H40 Q66 -312 66 -296 L70 -150 Q0 -136 -70 -150 Z" fill="#6f7f5a" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
    <path d="M-22 -314 L0 -280 L22 -314 Z" fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <path d="M0 -284 L-9 -268 L0 -200 L9 -268 Z" fill="#c0392b" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <g transform={shock ? 'translate(0 -10)' : ''}>
      <circle cx="-60" cy="-366" r="12" fill={face} stroke={INK} strokeWidth="4" /><circle cx="60" cy="-366" r="12" fill={face} stroke={INK} strokeWidth="4" />
      <ellipse cx="0" cy="-372" rx="58" ry="64" fill={face} stroke={INK} strokeWidth="5" />
      {/* Лысина с венчиком седых волос. */}
      <path d="M-58 -380 C-62 -410 -48 -420 -40 -404 M58 -380 C62 -410 48 -420 40 -404" fill="none" stroke="#a8adb6" strokeWidth="12" strokeLinecap="round" />
      <path d="M-20 -424 Q0 -430 20 -424" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".6" />
      {[-22, 22].map((dx) => <g key={dx}>
        {shock ? <><circle cx={dx} cy="-372" r="10" fill="#fff" /><circle cx={dx} cy="-372" r="4.5" fill={INK} /></> : <circle cx={dx} cy="-372" r="5" fill={INK} />}
        <circle cx={dx} cy="-372" r="18" fill="none" stroke={INK} strokeWidth="5" />
        <path d={mood === 'angry' ? `M${dx - 16} ${dx < 0 ? -404 : -394} L${dx + 16} ${dx < 0 ? -394 : -404}` : `M${dx - 16} ${shock ? -408 : -398} H${dx + 16}`} stroke="#8a8f99" strokeWidth="9" strokeLinecap="round" />
      </g>)}
      <path d="M-4 -372 H4" stroke={INK} strokeWidth="5" />
      {mouth > 0 || shock
        ? <ellipse cx="0" cy="-324" rx={mood === 'angry' ? 20 : 14} ry={shock && !mouth ? 12 : 4 + mouth * 14} fill="#7a1033" stroke={INK} strokeWidth="3" />
        : <path d="M-14 -324 H14" stroke={INK} strokeWidth="5" strokeLinecap="round" />}
      <path d="M-30 -336 C-18 -350 -6 -344 0 -338 C6 -344 18 -350 30 -336 C18 -334 8 -330 0 -334 C-8 -330 -18 -334 -30 -336Z" fill="#a8adb6" stroke={INK} strokeWidth="3" />
    </g>
    {/* Пар из ушей, когда кипит. */}
    {steam > 0 && [-1, 1].map((side) => [0, 1, 2].map((i) => { const p = (t * 1.6 + i / 3) % 1; return <circle key={`${side}${i}`} cx={side * (70 + p * 40)} cy={-380 - p * 70} r={8 + p * 14} fill="#fff" opacity={(1 - p) * .85 * steam} /> }))}
  </svg>
}

// ---------- Кабинет информатики ----------
function Lab() {
  return <div style={{ position: 'absolute', inset: 0, background: WALL }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 560, bottom: 0, background: FLOOR, borderTop: '6px solid #98aca4' }} />
    <div style={{ position: 'absolute', left: 60, top: 90, width: 420, height: 270, borderRadius: 10, background: '#fff', border: `6px solid ${INK}`, padding: '18px 24px', color: '#245ce5', font: "800 30px/1.2 'Onest Variable', system-ui" }}>
      Информатика
      <div style={{ marginTop: 14, color: INK, font: MONO, fontSize: 20 }}>for i in range(10):<br />&nbsp;&nbsp;print("пиши руками")</div>
      <div style={{ marginTop: 14, color: RED, font: "800 22px/1.2 'Onest Variable', system-ui" }}>НЕЙРОСЕТИ — ЗЛО!</div>
    </div>
    <div style={{ position: 'absolute', left: 860, top: 70, width: 300, height: 210, borderRadius: 8, background: '#bfe3ff', border: `6px solid ${INK}` }}><div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 6, background: INK }} /></div>
    {/* Парта с монитором, на нём — код. */}
    <div style={{ position: 'absolute', left: 500, top: 350, width: 230, height: 140, borderRadius: 10, background: '#1e1e2e', border: `6px solid ${INK}`, padding: 12 }}>
      {[70, 120, 90, 150, 60].map((w, i) => <div key={i} style={{ width: w, height: 8, margin: '6px 0', borderRadius: 4, background: ['#7dd3fc', '#f9a8d4', '#c6ff3d', '#fde68a', '#a5b4fc'][i] }} />)}
    </div>
    <div style={{ position: 'absolute', left: 595, top: 496, width: 40, height: 30, background: INK }} />
    <div style={{ position: 'absolute', left: 440, top: 526, width: 360, height: 24, borderRadius: 6, background: '#b0855a', border: `5px solid ${INK}` }} />
  </div>
}

// ---------- Сцены ----------
function LabScene({ t, local, lines }) {
  const walk = seg(local, 0, 1.6)
  return <>
    <Lab />
    <Student x={330} y={650} mood="calm" mouth={mouthOf(lines, 'student', t)} />
    <Teacher x={1450 - ease(walk) * 450} y={640} mood="calm" t={t} bob={walk < 1 ? -Math.abs(Math.sin(local * 9)) * 10 : 0} mouth={mouthOf(lines, 'teacher', t)} />
  </>
}

// Монитор крупно: код набирается сам, справа — чат с ИИ-помощником.
const CODE = [
  ['#c084fc', 'export default function '], ['#7dd3fc', 'CampusMap'], ['#e5e7eb', '() {'],
  ['#e5e7eb', '  const '], ['#fde68a', 'route'], ['#e5e7eb', ' = findPath(from, to)'],
  ['#e5e7eb', '  return <'], ['#7dd3fc', 'Floor'], ['#e5e7eb', ' level={2} route={route} />'],
  ['#e5e7eb', '}'],
]
function ScreenScene({ t, local, lines }) {
  const typed = Math.floor(seg(local, .4, 3.4) * CODE.length)
  const rows = [[0, 3], [3, 6], [6, 9], [9, 10]]
  return <>
    <div style={{ position: 'absolute', inset: 0, background: '#d7e6e0' }} />
    <div style={{ position: 'absolute', left: 120, top: 40, width: 1040, height: 560, borderRadius: 18, background: '#1e1e2e', border: `8px solid ${INK}`, overflow: 'hidden', boxShadow: '14px 14px 0 rgba(20,8,31,.16)' }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', background: '#2b2b3d', color: '#cbd5e1', font: "600 18px/1 'Onest Variable', system-ui" }}>
        {['#ff6058', '#ffbd2e', '#28c941'].map((color) => <i key={color} style={{ width: 13, height: 13, borderRadius: '50%', background: color }} />)}
        <span style={{ marginLeft: 12 }}>logos-guide — CampusMap.jsx</span>
      </div>
      <div style={{ position: 'absolute', left: 30, top: 74, width: 600, color: '#e5e7eb', font: MONO, whiteSpace: 'pre' }}>
        {rows.map(([a, b], row) => <div key={row}>{CODE.slice(a, b).map(([color, text], i) => (a + i < typed ? <span key={i} style={{ color }}>{text}</span> : null))}</div>)}
        <span style={{ display: 'inline-block', width: 12, height: 26, background: '#c6ff3d', opacity: Math.floor(t * 3) % 2 }} />
      </div>
      <div style={{ position: 'absolute', right: 0, top: 44, bottom: 0, width: 360, padding: 20, background: '#26263a', borderLeft: '2px solid #3a3a52', font: "600 19px/1.35 'Onest Variable', system-ui" }}>
        <div style={{ color: '#a5b4fc', marginBottom: 14 }}>ИИ-помощник</div>
        <div style={{ marginLeft: 40, padding: '10px 14px', borderRadius: 14, background: '#245ce5', color: '#fff', opacity: appear(local, .2) }}>Помоги сделать карту колледжа с маршрутами</div>
        <div style={{ marginTop: 12, marginRight: 30, padding: '10px 14px', borderRadius: 14, background: '#3a3a52', color: '#e5e7eb', opacity: appear(local, 1.2) }}>Давай! Начнём с этажей. Вот как найти путь между кабинетами…</div>
        <div style={{ marginTop: 12, marginLeft: 40, padding: '10px 14px', borderRadius: 14, background: '#245ce5', color: '#fff', opacity: appear(local, 2.6) }}>Понял, лестницу я дорисую сам</div>
      </div>
    </div>
    <Student x={150} y={940} scale={1.35} mood="happy" phone={false} mouth={mouthOf(lines, 'student', t)} />
  </>
}

// Оценка «2» в красном кружке: падает печатью и остаётся.
function Stamp({ t, at }) {
  const p = seg(t, at, at + .18)
  if (p <= 0) return null
  return <div style={{ position: 'absolute', left: 110, top: 60, width: 200, height: 200, borderRadius: '50%', border: `14px solid ${RED}`, display: 'grid', placeItems: 'center', color: RED, font: "900 150px/1 'Onest Variable', system-ui", transform: `rotate(-12deg) scale(${2.2 - 1.2 * ease(p)})`, opacity: Math.min(1, p * 2) }}>2</div>
}

function RantScene({ t, local, lines, line: LINE }) {
  const stampAt = LINE.grade.end - .25
  const sad = t >= LINE.sad.start - .2
  const pulse = .5 + .5 * Math.sin(t * 9)
  return <>
    <div style={{ position: 'absolute', inset: 0, background: `rgb(255, ${200 - pulse * 30}, ${190 - pulse * 40})` }} />
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0, opacity: .35 }} aria-hidden="true">
      <g transform={`translate(780 420) rotate(${t * 12})`}>{Array.from({ length: 16 }, (_, i) => <path key={i} d="M0 0 L-70 -900 L70 -900Z" fill={i % 2 ? '#ff8a7a' : '#ffd0c8'} transform={`rotate(${i * 22.5})`} />)}</g>
    </svg>
    <Teacher x={800} y={1010} scale={1.55} mood="angry" t={t} wave={sad ? .3 : 1} steam={1 - seg(t, LINE.sad.start, LINE.sad.start + .5) * .7} mouth={mouthOf(lines, 'teacher', t)} />
    <Student x={210} y={700} scale={.9} mood={sad ? 'calm' : 'shock'} phone={false} mouth={mouthOf(lines, 'student', t)} />
    <Stamp t={t} at={stampAt} />
    <Boom x={980} y={70} text="ВАЙБ-КОДЕР?!" t={local} at={.6} size={52} color={RED} rotate={6} />
  </>
}

function PoofScene({ t, local, lines, line: LINE, version }) {
  const at = .15
  const puff = seg(local, at, at + 1.1)
  const burst = LINE.burst.start
  const hit = t >= burst
  return <>
    <Lab />
    <Student x={250} y={650} mood={t >= LINE.proud.start ? 'happy' : local < .4 ? 'calm' : 'shock'} mouth={mouthOf(lines, 'student', t)} />
    <Teacher x={1030} y={640} mood={hit ? 'shock' : 'angry'} t={t} wave={hit ? 0 : .6} mouth={mouthOf(lines, 'teacher', t)} bob={hit ? Math.sin(seg(t, burst, burst + .4) * Math.PI) * -26 : 0} />
    {puff > 0 && puff < 1 && <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; const r = 40 + ease(puff) * 170; return <circle key={i} cx={640 + Math.cos(a) * r} cy={330 + Math.sin(a) * r * .7} r={70 * (1 - puff) + 20} fill="#fff" stroke="#c9d3e8" strokeWidth="4" opacity={1 - puff} /> })}
    </svg>}
    {/* На своей реплике Mr.Брекин подаётся вперёд. */}
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + .12 * Math.sin(seg(t, burst, burst + .5) * Math.PI)})`, transformOrigin: '640px 340px' }}>
      <Brekin x={640} y={340} t={local} appearAt={at + .2} mouth={mouthOf(lines, 'brekin', t)} size={250} />
    </div>
    <Boom x={760} y={70} text="ПУФ!" t={local} at={at} />
    {version !== 'clean' && <Boom x={560} y={24} text="!!!" t={t} at={burst + .2} size={90} color={AD_PINK} rotate={-10} />}
  </>
}

function EndScene({ t, local, line: LINE, version }) {
  const svg = useMemo(() => wordmark.replaceAll('#0000FF', '#8fa6ff').replaceAll('#13213A', '#e5edfb'), [])
  const logo = LINE.outro.end - .6
  return <>
    <div style={{ position: 'absolute', inset: 0, background: NAVY }} />
    <Brekin x={210} y={330} t={local} size={210} appearAt={.05} />
    <div style={{ position: 'absolute', left: 400, top: 110, width: 820, color: '#fff', font: "900 64px/1.1 'Onest Variable', system-ui", letterSpacing: '-.02em', opacity: appear(local, .1) }}>
      Mr.Брекин <span style={{ color: '#c6ff3d' }}>VPN</span>
    </div>
    <div style={{ position: 'absolute', left: 400, top: 200, width: 800, color: '#fff', font: "700 40px/1.25 'Onest Variable', system-ui", opacity: appear(local, .9) }}>
      Обходит пары стороной и заступается <span style={{ color: AD_PINK }}>за своих</span><sup style={{ fontSize: 26 }}>*</sup>
    </div>
    <div style={{ position: 'absolute', left: 400, top: 330, width: 800, color: '#c9d5ea', font: "600 26px/1.35 'Onest Variable', system-ui", opacity: appear(local, 1.8) }}>
      *Не «сделано ИИ», а сделано с помощью ИИ.
    </div>
    <div style={{ position: 'absolute', left: 400, top: 460, width: 420, opacity: appear(t, logo) }}>
      {/* SVG логотипа — свой файл из репозитория (src/assets), не пользовательский ввод. */}
      <div dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ') }} />
    </div>
    <div style={{ position: 'absolute', left: 850, top: 495, color: '#fff', font: "800 44px/1 'Onest Variable', system-ui", opacity: appear(t, logo) }}>logos-guide.ru</div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22, textAlign: 'center', color: 'rgba(255,255,255,.55)', font: "500 16px/1 'Onest Variable', system-ui", opacity: appear(local, .5) }}>
      Mr.Брекин VPN не существует. Персонажи вымышлены, совпадения случайны{version === 'clean' ? '.' : '. 18+: герои ругаются матом.'}
    </div>
  </>
}

const VIEWS = { lab: LabScene, screen: ScreenScene, rant: RantScene, poof: PoofScene, end: EndScene }

// Кадр второй серии в момент t. version — adult (с матом) или clean (без мата).
export default function Cartoon2Stage({ t, version = 'adult', controls = false }) {
  const { lines, line, scenes, duration } = STAGES[version] || STAGES.adult
  const fade = .25
  const visible = scenes.filter((scene) => t >= scene.start - fade && t < scene.end + fade)
  const stamp = CARTOON2_VERSIONS.find((item) => item.id === version) || CARTOON2_VERSIONS[0]
  return <div style={{ position: 'relative', width: STAGE_W, height: STAGE_H, overflow: 'hidden', background: WALL, fontFamily: "'Onest Variable', Onest, system-ui, sans-serif" }}>
    {visible.map((scene) => {
      const View = VIEWS[scene.id]
      const opacity = scene.start === 0 ? 1 : seg(t, scene.start, scene.start + fade)
      return <div key={scene.id} style={{ position: 'absolute', inset: 0, opacity }}><View t={t} local={t - scene.start} lines={lines} line={line} version={version} /></div>
    })}
    {/* Название серии в первые секунды. */}
    <div aria-hidden="true" style={{ position: 'absolute', left: 30, top: 24, padding: '8px 14px', borderRadius: 10, background: GOLD, color: INK, font: "900 22px/1 'Onest Variable', system-ui", border: `4px solid ${INK}`, transform: `scale(${pop(t, .1)})`, opacity: 1 - seg(t, 3.2, 3.6) }}>Серия 2 · Вайб-кодинг</div>
    {stamp.age && <div aria-hidden="true" style={{ position: 'absolute', right: 26, top: 22, padding: '4px 10px', borderRadius: 8, background: 'rgba(20,8,31,.75)', color: '#fff', font: "800 16px/1.2 'Onest Variable', system-ui" }}>{stamp.age}</div>}
    {controls && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, background: 'rgba(255,255,255,.22)' }}><div style={{ width: `${Math.min(1, t / duration) * 100}%`, height: '100%', background: AD_PINK }} /></div>}
  </div>
}
