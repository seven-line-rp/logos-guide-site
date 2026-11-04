import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Pause, Play, RotateCcw } from 'lucide-react'
import CartoonStage, { cartoonDuration } from './CartoonStage.jsx'
import Cartoon2Stage, { cartoon2Duration } from './Cartoon2Stage.jsx'
import { CARTOON_VERSIONS } from './cartoon-script.js'
import { CARTOON2_VERSIONS } from './cartoon2-script.js'
import { fresh } from './fresh-url.js'

// Вкладка «Мультик» в /admin: шуточный мультик про Mr.Брекина и ЛОГОС, отдельно
// от промо-ролика. Две серии, у каждой две версии: «С матом» (18+) и «Без мата» —
// их можно смотреть и скачивать отдельно. Готовые видео собирает
// scripts/render-promo.mjs --film=cartoon, cartoon-clean, cartoon2 и cartoon2-clean
// (docs/promo.md). ?episode=2 — вторая серия.
// ?render=1&episode=2&version=clean — только сцена 1280×720 для съёмки кадров.

const EPISODES = [
  {
    id: '1',
    title: 'Серия 1. Mr.Брекин спешит на помощь',
    about: 'У студента не открывается ЛОГОС, а до пары минута. Тут появляется Mr.Брекин VPN.',
    Stage: CartoonStage,
    duration: cartoonDuration,
    versions: CARTOON_VERSIONS,
  },
  {
    id: '2',
    title: 'Серия 2. Вайб-кодинг',
    about: 'Информатик Дмитрий Александрович разносит студента за сайт, сделанный с нейросетью. Mr.Брекин прилетает заступиться.',
    Stage: Cartoon2Stage,
    duration: cartoon2Duration,
    versions: CARTOON2_VERSIONS,
  },
]
const episodeOf = (id) => EPISODES.find((item) => item.id === id) || EPISODES[0]

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function RenderOnly({ episode, version }) {
  const [t, setT] = useState(0)
  const { Stage, duration } = episode
  useEffect(() => {
    window.__promoSeek = (value) => new Promise((resolve) => { setT(value); requestAnimationFrame(() => requestAnimationFrame(resolve)) })
    window.__promoDuration = duration(version)
    return () => { delete window.__promoSeek; delete window.__promoDuration }
  }, [duration, version])
  return <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}><Stage t={t} version={version} /></div>
}

// Проигрыватель одной версии: картинку рисует CartoonStage, голос и музыку берёт
// из своих файлов версии. Так версии можно смотреть, не скачивая MP4.
function Player({ Stage, duration: durationOf, version: { id: film, title, note, age, voice, music } }) {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const voiceRef = useRef(null)
  const musicRef = useRef(null)
  const frameRef = useRef(0)
  const startedAt = useRef(0)
  const duration = durationOf(film)

  const media = () => [voiceRef.current, musicRef.current].filter(Boolean)

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    for (const element of media()) element.pause()
    setPlaying(false)
  }, [])

  const play = useCallback(() => {
    const from = t >= duration - .15 ? 0 : t
    setT(from)
    startedAt.current = performance.now() - from * 1000
    for (const element of media()) element.currentTime = from
    for (const element of media()) element.volume = element === musicRef.current ? .55 : 1
    Promise.allSettled(media().map((element) => element.play()))
    setPlaying(true)
    const tick = () => {
      const now = (performance.now() - startedAt.current) / 1000
      if (now >= duration) { setT(duration); setPlaying(false); return }
      setT(now)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
  }, [t, duration])

  useEffect(() => stop, [stop])

  const seek = (value) => {
    stop()
    setT(value)
    for (const element of media()) element.currentTime = value
  }

  return <>
    <section className="adm-promo-player" aria-label={`Мультик: ${title}`}>
      <div className="adm-promo-screen" onClick={() => (playing ? stop() : play())} role="presentation">
        <Stage t={t} version={film} controls />
        {!playing && <div className="adm-promo-big-play" aria-hidden="true"><Play size={34} fill="currentColor" /></div>}
        <audio ref={voiceRef} src={fresh(voice)} preload="none" />
        <audio ref={musicRef} src={fresh(music)} preload="none" />
      </div>
      <div className="adm-promo-controls">
        <button type="button" className="adm-promo-play" onClick={() => (playing ? stop() : play())}>
          {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />} <span>{playing ? 'Пауза' : 'Смотреть'}</span>
        </button>
        <button type="button" className="adm-chip" onClick={() => seek(0)} aria-label="С начала"><RotateCcw size={15} /></button>
        <label className="adm-promo-seek">
          <input type="range" min={0} max={duration} step={.05} value={t} onChange={(event) => seek(Number(event.target.value))} aria-label="Время" />
        </label>
        <span className="adm-promo-time">{clock(t)} / {clock(duration)}</span>
      </div>
    </section>
    <p className="adm-muted">{note}{age ? ' 18+' : ''}</p>
  </>
}

export default function AdminCartoon() {
  const [params, setParams] = useSearchParams()
  const version = params.get('version') === 'clean' ? 'clean' : 'adult'
  const episode = episodeOf(params.get('episode'))
  if (params.get('render') === '1') return <RenderOnly episode={episode} version={version} />

  return <>
    <div className="adm-head">
      <div>
        <h1>Мультик</h1>
        <p>Шуточный мультик про Mr.Брекина и ЛОГОС. У каждой серии две версии — с матом и без мата: сцены и реплики одни и те же, отличается только текст, поэтому и длина чуть разная.</p>
      </div>
    </div>
    <div className="adm-cartoon-episodes" role="tablist" aria-label="Серии">
      {EPISODES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === episode.id} className={`adm-cartoon-episode ${item.id === episode.id ? 'is-on' : ''}`} onClick={() => setParams(item.id === '1' ? {} : { episode: item.id })}>{item.title}</button>)}
    </div>
    <p className="adm-cartoon-about">{episode.about}</p>
    {episode.versions.map((item) => <section key={`${episode.id}-${item.id}`} className="adm-cartoon-version">
      <h2 className="adm-cartoon-title">{item.title}{item.age && <span className="adm-cartoon-age">18+</span>}</h2>
      <Player Stage={episode.Stage} duration={episode.duration} version={item} />
      <div className="adm-promo-export">
        <a className="adm-button adm-button-primary" href={fresh(item.video)} download={item.download}><Download size={16} /> Скачать MP4</a>
      </div>
    </section>)}
    <p className="adm-fine">Mr.Брекин VPN не существует, это шутка. Персонажи вымышлены, совпадения случайны. Музыка сочинена скриптом (scripts/build-cartoon-music.py), голоса — Piper «Дмитрий» и «Денис» (CC0). Как пересобрать — docs/promo.md.</p>
  </>
}
