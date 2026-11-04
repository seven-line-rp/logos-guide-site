import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Pause, Play, RotateCcw } from 'lucide-react'
import PromoStage, { PROMO_DURATION, STAGE_H, STAGE_W } from './PromoStage.jsx'
import { PROMO_LINES } from './promo-script.js'
import timeline from './promo-timeline.json'

// Вкладка «Промо-ролик» в /admin. Ролик собран из кода (PromoStage) и идёт
// в такт озвучке public/promo/voice.mp3: время берётся из аудио. Готовый MP4
// (public/promo/logos-promo.mp4) снимается из этих же кадров скриптом
// scripts/render-promo.mjs. ?render=1 — только сцена 1280×720 для этого скрипта.

const VOICE_URL = '/promo/voice.mp3'
const VIDEO_URL = '/promo/logos-promo.mp4'
const START = Object.fromEntries(timeline.lines.map((line) => [line.id, line.start]))
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function RenderOnly() {
  const [t, setT] = useState(0)
  useEffect(() => {
    // Скрипт съёмки вызывает window.__promoSeek(t) перед каждым кадром.
    window.__promoSeek = (value) => new Promise((resolve) => { setT(value); requestAnimationFrame(() => requestAnimationFrame(resolve)) })
    window.__promoDuration = PROMO_DURATION
    return () => { delete window.__promoSeek; delete window.__promoDuration }
  }, [])
  return <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}><PromoStage t={t} /></div>
}

function Player() {
  const audioRef = useRef(null)
  const frameRef = useRef(0)
  const boxRef = useRef(null)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [scale, setScale] = useState(.5)

  // Сцена 1280×720 масштабируется под ширину плеера.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return undefined
    const fit = () => setScale(box.clientWidth / STAGE_W)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const tick = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setT(audio.currentTime)
    if (!audio.paused && !audio.ended) frameRef.current = requestAnimationFrame(tick)
  }, [])
  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (audio.ended || audio.currentTime >= PROMO_DURATION - .05) audio.currentTime = 0
      try { await audio.play() } catch { return }
    } else audio.pause()
  }
  const seek = (value) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = value
    setT(value)
  }

  return <section className="adm-promo-player" aria-label="Промо-ролик">
    <div ref={boxRef} className="adm-promo-screen" style={{ height: STAGE_H * scale }} onClick={toggle}>
      <div style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: '0 0' }}><PromoStage t={t} /></div>
      {!playing && <span className="adm-promo-big-play" aria-hidden="true"><Play size={34} fill="currentColor" /></span>}
    </div>
    <audio ref={audioRef} src={VOICE_URL} preload="auto"
      onPlay={() => { setPlaying(true); cancelAnimationFrame(frameRef.current); frameRef.current = requestAnimationFrame(tick) }}
      onPause={() => { setPlaying(false); setT(audioRef.current?.currentTime || 0) }}
      onEnded={() => { setPlaying(false); setT(PROMO_DURATION) }}
      onSeeked={() => setT(audioRef.current?.currentTime || 0)} />
    <div className="adm-promo-controls">
      <button type="button" className="adm-promo-play" onClick={toggle} aria-label={playing ? 'Пауза' : 'Смотреть ролик'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}<span>{playing ? 'Пауза' : t > 0 && t < PROMO_DURATION ? 'Продолжить' : 'Смотреть'}</span></button>
      <label className="adm-promo-seek"><span className="visually-hidden">Перемотка</span>
        <input type="range" min="0" max={PROMO_DURATION} step="0.05" value={Math.min(t, PROMO_DURATION)} onChange={(event) => seek(Number(event.target.value))} />
      </label>
      <span className="adm-promo-time">{clock(t)} / {clock(Math.round(PROMO_DURATION))}</span>
      <button type="button" className="adm-icon" onClick={() => seek(0)} aria-label="С начала" title="С начала"><RotateCcw size={16} /></button>
    </div>
    <ol className="adm-promo-script">
      {PROMO_LINES.map((line) => {
        const start = START[line.id]
        const current = t >= start && t < (timeline.lines.find((item) => item.id === line.id)?.end ?? start) + .4
        return <li key={line.id} className={current ? 'is-current' : ''}><button type="button" onClick={() => seek(Math.max(0, start - .3))}><span className="adm-promo-at">{clock(start)}</span><span>{line.caption}</span></button></li>
      })}
    </ol>
  </section>
}

export default function AdminPromo() {
  const [params] = useSearchParams()
  if (params.get('render') === '1') return <RenderOnly />
  return <>
    <div className="adm-head">
      <div>
        <h1>Промо-ролик</h1>
        <p>Ролик о путеводителе на {Math.round(PROMO_DURATION)} секунд: поиск кабинета, маршрут, расписание и таблички «Вы здесь». Подходит для дня открытых дверей, экрана в холле и чата группы.</p>
      </div>
      <div className="adm-head-tools">
        <a className="adm-button" href={VIDEO_URL} download="logos-promo.mp4"><Download size={16} /> Скачать MP4</a>
        <a className="adm-button" href={VOICE_URL} download="logos-promo-voice.mp3">Озвучка MP3</a>
      </div>
    </div>
    <Player />
    <p className="adm-fine">Голос синтезирован бесплатной нейросетью Piper (голос «Дмитрий», набор записей с лицензией CC0). Как поменять текст или голос и пересобрать ролик — в docs/promo.md.</p>
  </>
}
