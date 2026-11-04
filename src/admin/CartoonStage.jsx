import { useMemo } from 'react'
import wordmark from '../assets/logo-wordmark.js'
import { CARTOON_LINES, CARTOON_VERSIONS } from './cartoon-script.js'
import adultTimeline from './cartoon-timeline.json'
import cleanTimeline from './cartoon-timeline-clean.json'
import shots from './promo-shots.json'
import { AD_PINK, MrShield, STAGE_H, STAGE_W } from './PromoStage.jsx'

// Кадр мультика «Mr.Брекин спешит на помощь» в момент t (секунды).
// Как и промо-ролик (PromoStage.jsx), всё считается от времени: так анимация идёт
// в такт озвучке, её можно перематывать, а scripts/render-promo.mjs --film=cartoon
// снимает те же кадры в MP4. Сцена — 1280×720.
// Герои: студент (голос student) и Mr.Брекин — щит в цилиндре из рекламной паузы
// промо-ролика (голос brekin).
// У ролика две версии — с матом и без (CARTOON_VERSIONS). Фразы и сцены у них
// одни и те же, отличаются только текст и тайминги озвучки, поэтому сцены
// собираются для нужной версии, а субтитров в кадре нет: реплики звучат.

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const seg = (t, a, b) => clamp((t - a) / (b - a))
const ease = (x) => 1 - (1 - x) ** 3
const appear = (t, a, d = .4) => ease(seg(t, a, a + d))
// Упругое появление: чуть больше нужного размера и обратно.
const pop = (t, a, d = .45) => { const x = seg(t, a, a + d); return x === 0 ? 0 : 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2 }

// Тайминги озвучки и сцены одной версии ролика (adult — с матом, clean — без).
const TIMELINES = { adult: adultTimeline, clean: cleanTimeline }
function buildTimeline(version) {
  const timeline = TIMELINES[version] || adultTimeline
  const line = Object.fromEntries(timeline.lines.map((item) => [item.id, item]))
  const lines = CARTOON_LINES.map((item, index) => ({ ...item, ...line[item.id], next: timeline.lines[index + 1]?.start ?? timeline.duration }))
  const starts = []
  for (const item of lines) if (!starts.some((scene) => scene.id === item.scene)) starts.push({ id: item.scene, start: Math.max(0, item.start - .3 - (item.lead || 0)) })
  starts[0].start = 0
  const scenes = starts.map((scene, index) => ({ ...scene, end: starts[index + 1]?.start ?? timeline.duration }))
  return { duration: timeline.duration, lines, line, scenes }
}
const STAGES = Object.fromEntries(Object.keys(TIMELINES).map((version) => [version, buildTimeline(version)]))
export const cartoonDuration = (version = 'adult') => (TIMELINES[version] || adultTimeline).duration
export const CARTOON_DURATION = adultTimeline.duration

const INK = '#14081f'
const SKIN = '#ffd9b8'
const HOODIE = '#2f6bff'
const NAVY = '#0f2557'
const GOLD = '#ffd267'
const WALL = '#eef2fb'
const FLOOR = '#cdd6ea'

// Кто говорит в момент t и насколько открыт рот (быстро хлопает, пока звучит фраза).
// lines — фразы той версии ролика, которую сейчас показываем.
const mouthOf = (lines, who, t) => {
  const speaking = lines.find((line) => t >= line.start - .03 && t <= line.end + .03)
  return speaking?.voice === who ? .35 + .65 * Math.abs(Math.sin(t * 21)) : 0
}

// ---------- Студент ----------
// Точка (x, y) — между ступнями. mood: calm | shock | angry | happy.
// step — фаза шага (идёт или бежит), 0 — стоит.
function Student({ x, y, scale = 1, mood = 'calm', mouth = 0, step = 0, stride = 0, phone = true, flip = false, shake = 0 }) {
  const legs = [0, Math.PI].map((phase) => Math.sin(step + phase) * stride)
  const bob = stride ? Math.abs(Math.sin(step)) * -10 * stride : 0
  const sx = Math.sin(shake * 60) * 6 * (shake > 0 ? 1 : 0)
  const swing = Math.sin(step) * stride
  return <svg width={260 * scale} height={420 * scale} viewBox="-130 -400 260 420" style={{ position: 'absolute', left: x - 130 * scale, top: y - 400 * scale, overflow: 'visible' }} aria-hidden="true">
    <g transform={`translate(${sx} ${bob}) scale(${flip ? -1 : 1} 1)`}>
      {legs.map((angle, i) => <g key={i} transform={`translate(${i ? 18 : -18} -125) rotate(${angle * 40})`}>
        <path d="M0 0 V112" stroke="#22304d" strokeWidth="26" strokeLinecap="round" />
        <ellipse cx="12" cy="118" rx="26" ry="12" fill="#fff" stroke={INK} strokeWidth="4" />
      </g>)}
      <rect x="-82" y="-250" width="38" height="112" rx="12" fill="#ffb020" stroke={INK} strokeWidth="4" />
      <g transform={`rotate(${-swing * 35} -40 -228)`}><path d="M-40 -228 L-62 -150" stroke={HOODIE} strokeWidth="24" strokeLinecap="round" /><circle cx="-62" cy="-146" r="13" fill={SKIN} stroke={INK} strokeWidth="3" /></g>
      <path d="M-56 -238 Q-58 -260 -30 -262 H30 Q58 -260 56 -238 L60 -118 Q0 -104 -60 -118 Z" fill={HOODIE} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M-26 -160 H26 V-136 H-26 Z" fill="#2453d6" />
      {phone
        ? <g><path d="M40 -228 L80 -186 L58 -170" fill="none" stroke={HOODIE} strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" /><rect x="50" y="-214" width="30" height="50" rx="6" fill="#0d1830" stroke={INK} strokeWidth="3" /><rect x="54" y="-208" width="22" height="36" rx="3" fill={mood === 'angry' ? '#ff5d5d' : '#8fd0ff'} /><circle cx="58" cy="-170" r="13" fill={SKIN} stroke={INK} strokeWidth="3" /></g>
        : <g transform={`rotate(${swing * 35} 40 -228)`}><path d="M40 -228 L62 -150" stroke={HOODIE} strokeWidth="24" strokeLinecap="round" /><circle cx="62" cy="-146" r="13" fill={SKIN} stroke={INK} strokeWidth="3" /></g>}
      <g transform={mood === 'angry' ? `translate(${Math.sin(shake * 80) * 3} 0)` : ''}>
        <circle cx="0" cy="-310" r="60" fill={mood === 'angry' ? '#ffb39a' : SKIN} stroke={INK} strokeWidth="5" />
        <circle cx="-52" cy="-304" r="12" fill={SKIN} stroke={INK} strokeWidth="4" />
        <path d="M-60 -318 C-62 -380 30 -392 60 -332 C40 -350 10 -352 -10 -340 C-24 -350 -40 -346 -60 -318Z" fill="#3b2a20" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        {mood === 'shock' && <><circle cx="-6" cy="-312" r="14" fill="#fff" stroke={INK} strokeWidth="3" /><circle cx="30" cy="-312" r="14" fill="#fff" stroke={INK} strokeWidth="3" /><circle cx="-4" cy="-312" r="5" fill={INK} /><circle cx="32" cy="-312" r="5" fill={INK} /></>}
        {mood === 'happy' && <><path d="M-16 -312 Q-6 -324 4 -312" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d="M20 -312 Q30 -324 40 -312" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" /></>}
        {(mood === 'calm' || mood === 'angry') && <><circle cx="-6" cy="-312" r="6" fill={INK} /><circle cx="30" cy="-312" r="6" fill={INK} /></>}
        {mood === 'angry' && <><path d="M-20 -334 L6 -324" stroke={INK} strokeWidth="6" strokeLinecap="round" /><path d="M44 -334 L18 -324" stroke={INK} strokeWidth="6" strokeLinecap="round" /></>}
        {mouth > 0
          ? <ellipse cx="14" cy="-280" rx={mood === 'angry' ? 18 : 13} ry={3 + mouth * 13} fill="#7a1033" stroke={INK} strokeWidth="3" />
          : mood === 'happy' ? <path d="M0 -284 Q14 -268 28 -284" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            : mood === 'shock' ? <ellipse cx="14" cy="-278" rx="8" ry="10" fill="#7a1033" stroke={INK} strokeWidth="3" />
              : <path d="M4 -280 H24" stroke={INK} strokeWidth="5" strokeLinecap="round" />}
      </g>
    </g>
  </svg>
}

// Mr.Брекин парит и покачивается. size — ширина щита.
function Brekin({ x, y, t, size = 230, mouth = 0, appearAt = 0 }) {
  const p = pop(t, appearAt)
  if (p <= 0) return null
  return <div style={{ position: 'absolute', left: x - 115, top: y - 150 + Math.sin(t * 3) * 10, transform: `scale(${p * size / 230})`, transformOrigin: '50% 60%' }}>
    <MrShield wobble={Math.sin(t * 2.4) * 6} mouth={mouth} />
  </div>
}

// ---------- Коридор колледжа ----------
const DOOR_GAP = 380
function Hall({ offset = 0, rooms = ['207', '209', '211', '213', '215', '217'], blur = 0 }) {
  return <div style={{ position: 'absolute', inset: 0, background: WALL, filter: blur ? `blur(${blur}px)` : 'none' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 540, bottom: 0, background: FLOOR, borderTop: `6px solid #9fb0d2` }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 150, height: 14, background: '#dbe3f4' }} />
    {Array.from({ length: 12 }, (_, i) => {
      const index = i + Math.floor(offset / DOOR_GAP)
      const left = 120 + index * DOOR_GAP - offset
      const room = rooms[((index % rooms.length) + rooms.length) % rooms.length]
      return <div key={index} style={{ position: 'absolute', left, top: 250, width: 160, height: 290, borderRadius: '8px 8px 0 0', background: '#8aa0c8', border: `5px solid ${INK}`, borderBottom: 0 }}>
        <div style={{ position: 'absolute', left: 30, top: 26, width: 90, height: 40, borderRadius: 8, background: '#fff', border: `3px solid ${INK}`, color: INK, font: '800 24px/34px Onest Variable, system-ui', textAlign: 'center' }}>{room}</div>
        <div style={{ position: 'absolute', right: 18, top: 150, width: 14, height: 14, borderRadius: '50%', background: GOLD, border: `3px solid ${INK}` }} />
        {index % 2 === 0 && <div style={{ position: 'absolute', left: 205, top: -40, width: 110, height: 140, background: '#fff', border: `4px solid ${INK}`, borderRadius: 6, color: '#245ce5', font: '800 15px/1.2 Onest Variable, system-ui', padding: 10, textAlign: 'center' }}>Расписание звонков<div style={{ marginTop: 8, color: '#5d6d86', fontWeight: 600, fontSize: 13 }}>8:30<br />10:10<br />11:50</div></div>}
      </div>
    })}
  </div>
}

// ---------- Подписи в кадре ----------
// Субтитров и облачков с репликами в кадре нет: фразы звучат голосом, а герои
// просто шевелят губами. Надписи остаются только по делу — время на стене,
// «ПУФ!», «ЩЁЛК!», финальная плашка (Boom ниже).
// ---------- Телефон крупным планом ----------
// screen: loading | error | vpn-off | vpn-on | logos
function BigPhone({ x, y, screen, t, shake = 0 }) {
  const W = 300
  const H = 600
  const sx = shake ? Math.sin(t * 70) * 10 * shake : 0
  const here = shots['phone-here']
  return <div style={{ position: 'absolute', left: x + sx, top: y, width: W + 24, padding: 12, borderRadius: 46, background: '#0d1830', border: `5px solid ${INK}`, boxShadow: '14px 14px 0 rgba(20,8,31,.16)', transform: `rotate(${shake ? Math.sin(t * 40) * 2 : -2}deg)` }}>
    <div style={{ position: 'relative', width: W, height: H, borderRadius: 34, overflow: 'hidden', background: '#fff', font: "700 22px/1.3 'Onest Variable', system-ui", color: INK, textAlign: 'center' }}>
      <div style={{ position: 'absolute', left: 22, right: 22, top: 12, display: 'flex', justifyContent: 'space-between', fontSize: 16, color: screen.startsWith('vpn') ? '#fff' : INK }}><span>8:29</span><span>{screen === 'error' ? '✕ нет сети' : screen === 'logos' || screen === 'vpn-on' ? 'VPN ●●●' : '●●○'}</span></div>
      {screen === 'loading' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', gap: 22, justifyItems: 'center' }}>
        <svg width="110" height="110" viewBox="-32 -32 64 64" style={{ transform: `rotate(${t * 400}deg)` }} aria-hidden="true"><circle r="30" fill="#1f3dff" /><path d="M0 -26L7 0L0 26L-7 0Z" fill="#fff" /></svg>
        <div>ЛОГОС<br />Путеводитель</div>
        <div style={{ width: 180, height: 10, borderRadius: 5, background: '#e2e8f4', overflow: 'hidden' }}><div style={{ width: `${(t * 37) % 100}%`, height: '100%', background: '#1f3dff' }} /></div>
      </div>}
      {screen === 'error' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', gap: 18, justifyItems: 'center', background: '#fff0ef' }}>
        <svg width="130" height="130" viewBox="-32 -32 64 64" aria-hidden="true"><circle r="30" fill="#ff5d5d" /><path d="M-14 -12 l8 8 m0 -8 l-8 8 M6 -12 l8 8 m0 -8 l-8 8" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" /><path d="M-12 16 Q0 6 12 16" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" /></svg>
        <div style={{ fontSize: 28, fontWeight: 800 }}>Путеводитель<br />недоступен</div>
        <div style={{ color: '#a14040', fontSize: 18, fontWeight: 600 }}>Проверьте соединение</div>
        <div style={{ marginTop: 6, padding: '10px 26px', borderRadius: 12, background: '#ff5d5d', color: '#fff', fontSize: 18 }}>Повторить</div>
      </div>}
      {screen.startsWith('vpn') && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', gap: 22, justifyItems: 'center', background: 'radial-gradient(circle at 50% 40%, #6a1fb5, #2a0f4f)', color: '#fff' }}>
        <div style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic' }}>Mr.Брекин <span style={{ color: '#c6ff3d' }}>VPN</span></div>
        <div style={{ width: 150, height: 150, borderRadius: '50%', display: 'grid', placeItems: 'center', background: screen === 'vpn-on' ? '#c6ff3d' : 'rgba(255,255,255,.14)', border: '6px solid #fff', boxShadow: screen === 'vpn-on' ? '0 0 50px #c6ff3d' : 'none' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={screen === 'vpn-on' ? INK : '#fff'} strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 3v9" /><path d="M6.3 7.3a8 8 0 1 0 11.4 0" /></svg>
        </div>
        <div style={{ fontSize: 18 }}>{screen === 'vpn-on' ? 'Подключено · сервер «Диван»' : 'Не подключено'}</div>
      </div>}
      {screen === 'logos' && <img src={here.src} alt="" style={{ position: 'absolute', left: 0, top: 38, width: W, height: W * here.h / here.w }} />}
    </div>
  </div>
}

// Звук, нарисованный буквами: «ПУФ!», «ДЗЫНЬ!».
function Boom({ x, y, text, t, at, color = GOLD, size = 70, rotate = -8 }) {
  const p = pop(t, at, .3)
  const out = 1 - seg(t, at + .9, at + 1.2)
  if (p <= 0 || out <= 0) return null
  return <div style={{ position: 'absolute', left: x, top: y, color, font: `900 ${size}px/1 'Onest Variable', system-ui`, letterSpacing: '.02em', WebkitTextStroke: `4px ${INK}`, paintOrder: 'stroke fill', transform: `rotate(${rotate}deg) scale(${p})`, opacity: out }}>{text}</div>
}

// ---------- Сцены ----------
function HallScene({ t, local, lines }) {
  const walk = seg(local, 0, 1.4)
  return <>
    <Hall offset={walk * 120} />
    <Student x={-140 + ease(walk) * 520} y={640} mood="calm" step={local * 9} stride={walk < 1 ? .9 : 0} mouth={mouthOf(lines, 'student', t)} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 30, textAlign: 'center', color: NAVY, font: "900 30px/1 'Onest Variable', system-ui", opacity: 1 - seg(local, 1.4, 1.8) }}>8:29 · до пары одна минута</div>
  </>
}

function PhoneScene({ t, local, lines, line: LINE }) {
  const errorAt = LINE.fail.start - .35
  const broken = t >= errorAt
  return <>
    <div style={{ position: 'absolute', inset: 0, background: broken ? '#ffe1dc' : '#e6ecfa' }} />
    {broken && <div style={{ position: 'absolute', inset: 0, background: '#ff3b30', opacity: .5 * (1 - seg(t, errorAt, errorAt + .35)) }} />}
    <BigPhone x={150} y={46} screen={broken ? 'error' : 'loading'} t={t} shake={broken ? 1 - seg(t, errorAt, errorAt + .8) : 0} />
    <Student x={960} y={980} scale={1.55} mood={broken ? 'angry' : 'calm'} phone={false} shake={broken ? local : 0} mouth={mouthOf(lines, 'student', t)} />
  </>
}

function PoofScene({ t, local, lines }) {
  const at = .15
  const puff = seg(local, at, at + 1.1)
  return <>
    <Hall offset={120} />
    <Student x={286} y={640} mood={local < .4 ? 'angry' : 'shock'} mouth={mouthOf(lines, 'student', t)} />
    {puff > 0 && puff < 1 && <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; const r = 40 + ease(puff) * 170; return <circle key={i} cx={860 + Math.cos(a) * r} cy={360 + Math.sin(a) * r * .7} r={70 * (1 - puff) + 20} fill="#fff" stroke="#c9d3e8" strokeWidth="4" opacity={1 - puff} /> })}
    </svg>}
    <Brekin x={860} y={390} t={local} appearAt={at + .2} mouth={mouthOf(lines, 'brekin', t)} size={250} />
    <Boom x={1010} y={96} text="ПУФ!" t={local} at={at} />
  </>
}

function VpnScene({ t, lines, line: LINE }) {
  const pressAt = LINE.button.start + 1.35
  const logosAt = LINE.button.end + .15
  const screen = t >= logosAt ? 'logos' : t >= pressAt ? 'vpn-on' : 'vpn-off'
  const press = t >= pressAt - .25 && t < pressAt + .15
  return <>
    <div style={{ position: 'absolute', inset: 0, background: '#efe7ff' }} />
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0, opacity: t >= pressAt ? .5 : 0 }} aria-hidden="true">
      <g transform={`translate(640 380) rotate(${t * 25})`}>{Array.from({ length: 14 }, (_, i) => <path key={i} d="M0 0 L-80 -900 L80 -900Z" fill={i % 2 ? '#d8c4ff' : '#fff'} transform={`rotate(${i * (360 / 14)})`} />)}</g>
    </svg>
    <BigPhone x={478} y={50} screen={screen} t={t} />
    {press && <svg width="90" height="110" viewBox="0 0 90 110" style={{ position: 'absolute', left: 620, top: 330 + (t < pressAt ? 0 : 14) }} aria-hidden="true"><path d="M30 104 V40 a12 12 0 0 1 24 0 V64 h14 a12 12 0 0 1 12 12 V104Z" fill={SKIN} stroke={INK} strokeWidth="4" strokeLinejoin="round" /></svg>}
    <Boom x={286} y={196} text="ЩЁЛК!" t={t} at={pressAt} size={56} color="#c6ff3d" />
    <Student x={210} y={760} scale={1.1} mood={t >= logosAt ? 'happy' : 'shock'} phone={false} mouth={mouthOf(lines, 'student', t)} />
    <Brekin x={1060} y={420} t={t} mouth={mouthOf(lines, 'brekin', t)} />
  </>
}

function RunScene({ t, local, lines }) {
  const offset = local * 1100
  return <>
    <Hall offset={offset} blur={1.2} />
    {/* Стрелки маршрута на полу едут вместе с коридором. */}
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => { const x = ((i * 160 - offset) % 1600 + 1600) % 1600 - 160; return <path key={i} d={`M${x} 610 l40 20 l-40 20`} fill="none" stroke="#245ce5" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity=".75" /> })}
      {Array.from({ length: 7 }, (_, i) => <path key={`s${i}`} d={`M${120 + ((i * 97) % 300)} ${300 + i * 34} h${-90 - (i % 3) * 40}`} stroke={INK} strokeWidth="5" strokeLinecap="round" opacity={.35} />)}
    </svg>
    <Student x={640} y={650} mood="happy" step={local * 17} stride={1.15} mouth={mouthOf(lines, 'student', t)} />
    <Brekin x={300} y={300} t={local * 1.6} mouth={mouthOf(lines, 'brekin', t)} size={200} />
  </>
}

function DoorScene({ t, local, lines, line: LINE }) {
  const fin = LINE.fin.start
  return <>
    {/* Третья дверь коридора — 211, она ровно в кадре. */}
    <Hall offset={120 + DOOR_GAP * 2 - 520} />
    <div style={{ position: 'absolute', left: 520 - 6, top: 180, width: 172, padding: '6px 0', borderRadius: 10, background: GOLD, border: `4px solid ${INK}`, color: INK, font: "800 20px/1.2 'Onest Variable', system-ui", textAlign: 'center' }}>Кабинет физики</div>
    <Student x={330} y={650} mood={t >= fin ? 'calm' : 'happy'} step={local * 8} stride={local < .35 ? 1 : 0} mouth={mouthOf(lines, 'student', t)} />
    <Brekin x={1030} y={372} t={local} size={210} mouth={mouthOf(lines, 'brekin', t)} />
    <Boom x={520} y={575} text="ДЗЫ-Ы-ЫНЬ!" t={local} at={.05} size={64} rotate={-4} />
  </>
}

function EndScene({ t, local, line: LINE, version }) {
  const svg = useMemo(() => wordmark.replaceAll('#0000FF', '#8fa6ff').replaceAll('#13213A', '#e5edfb'), [])
  const serious = LINE.outro.end + 1.2
  return <>
    <div style={{ position: 'absolute', inset: 0, background: NAVY }} />
    <Brekin x={210} y={330} t={local} size={210} appearAt={.05} />
    <div style={{ position: 'absolute', left: 400, top: 120, width: 820, color: '#fff', font: "900 60px/1.1 'Onest Variable', system-ui", letterSpacing: '-.02em', opacity: appear(local, .1) }}>
      Если ЛОГОС недоступен — зовите <span style={{ color: AD_PINK }}>Mr.Брекина</span><sup style={{ fontSize: 36 }}>*</sup>
    </div>
    <div style={{ position: 'absolute', left: 400, top: 310, width: 800, color: '#c9d5ea', font: "600 30px/1.35 'Onest Variable', system-ui", opacity: appear(t, serious) }}>
      *А если серьёзно: ЛОГОС работает и без интернета. Откройте его один раз — карта останется в телефоне.
    </div>
    <div style={{ position: 'absolute', left: 400, top: 470, width: 420, opacity: appear(t, serious + 1.2) }}>
      {/* SVG логотипа — свой файл из репозитория (src/assets), не пользовательский ввод. */}
      <div dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ') }} />
    </div>
    <div style={{ position: 'absolute', left: 850, top: 505, color: '#fff', font: "800 44px/1 'Onest Variable', system-ui", opacity: appear(t, serious + 1.2) }}>logos-guide.ru</div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22, textAlign: 'center', color: 'rgba(255,255,255,.55)', font: "500 16px/1 'Onest Variable', system-ui", opacity: appear(local, .5) }}>
      Mr.Брекин VPN не существует. Мультик — шутка{version === 'clean' ? '.' : ', 18+: герои ругаются матом.'}
    </div>
  </>
}

const VIEWS = { hall: HallScene, phone: PhoneScene, poof: PoofScene, vpn: VpnScene, run: RunScene, door: DoorScene, end: EndScene }

// Сцена мультика в момент t. version — adult (с матом) или clean (без мата):
// от неё зависят тайминги (у версий свой темп речи) и плашка возраста.
export default function CartoonStage({ t, version = 'adult', controls = false }) {
  const { lines, line, scenes, duration } = STAGES[version] || STAGES.adult
  const fade = .25
  const visible = scenes.filter((scene) => t >= scene.start - fade && t < scene.end + fade)
  const share = Math.min(1, Math.max(0, t / duration))
  const stamp = CARTOON_VERSIONS.find((item) => item.id === version) || CARTOON_VERSIONS[0]
  return <div style={{ position: 'relative', width: STAGE_W, height: STAGE_H, overflow: 'hidden', background: WALL, fontFamily: "'Onest Variable', Onest, system-ui, sans-serif" }}>
    {visible.map((scene) => {
      const View = VIEWS[scene.id]
      const opacity = scene.start === 0 ? 1 : seg(t, scene.start, scene.start + fade)
      return <div key={scene.id} style={{ position: 'absolute', inset: 0, opacity }}><View t={t} local={t - scene.start} lines={lines} line={line} version={version} /></div>
    })}
    {stamp.age && <div aria-hidden="true" style={{ position: 'absolute', right: 26, top: 22, padding: '4px 10px', borderRadius: 8, background: 'rgba(20,8,31,.75)', color: '#fff', font: "800 16px/1.2 'Onest Variable', system-ui" }}>{stamp.age}</div>}
    {controls && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, background: 'rgba(255,255,255,.22)' }}><div style={{ width: `${share * 100}%`, height: '100%', background: AD_PINK }} /></div>}
  </div>
}
