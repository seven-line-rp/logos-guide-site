import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Pause, Play, RotateCcw } from 'lucide-react'
import CartoonStage, { cartoonDuration } from './CartoonStage.jsx'
import { CARTOON_VERSIONS } from './cartoon-script.js'

// Вкладка «Мультик» в /admin: «Mr.Брекин спешит на помощь» — шуточный мультик
// про ЛОГОС, отдельно от промо-ролика. Две версии одного и того же ролика:
// «С матом» (18+) и «Без мата» — их можно смотреть и скачивать отдельно.
// Готовые видео собирает scripts/render-promo.mjs --film=cartoon
// и --film=cartoon-clean (docs/promo.md).
// ?render=1&version=clean — только сцена 1280×720 для съёмки кадров.

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function RenderOnly({ version }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    window.__promoSeek = (value) => new Promise((resolve) => { setT(value); requestAnimationFrame(() => requestAnimationFrame(resolve)) })
    window.__promoDuration = cartoonDuration(version)
    return () => { delete window.__promoSeek; delete window.__promoDuration }
  }, [version])
  return <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}><CartoonStage t={t} version={version} /></div>
}

// Проигрыватель одной версии: картинку рисует CartoonStage, голос и музыку берёт
// из своих файлов версии. Так версии можно смотреть, не скачивая MP4.
function Player({ film, title, note, age }) {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const voiceRef = useRef(null)
  const musicRef = useRef(null)
  const frameRef = useRef(0)
  const startedAt = useRef(0)
  const duration = cartoonDuration(film)

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
        <CartoonStage t={t} version={film} controls />
        {!playing && <div className="adm-promo-big-play" aria-hidden="true"><Play size={34} fill="currentColor" /></div>}
        <audio ref={voiceRef} src={`/promo/cartoon/voice${film === 'clean' ? '-clean' : ''}.mp3`} preload="none" />
        <audio ref={musicRef} src={`/promo/cartoon/music${film === 'clean' ? '-clean' : ''}.mp3`} preload="none" />
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
  const [params] = useSearchParams()
  const version = params.get('version') === 'clean' ? 'clean' : 'adult'
  if (params.get('render') === '1') return <RenderOnly version={version} />

  return <>
    <div className="adm-head">
      <div>
        <h1>Мультик</h1>
        <p>«Mr.Брекин спешит на помощь» — шуточный мультик: у студента не открывается ЛОГОС, а до пары минута. Две версии одного ролика — с матом и без мата. Сцен и реплик в них одинаково, отличается только текст, поэтому и длина чуть разная.</p>
      </div>
    </div>
    {CARTOON_VERSIONS.map((item) => <section key={item.id} className="adm-cartoon-version">
      <h2 className="adm-cartoon-title">{item.title}{item.age && <span className="adm-cartoon-age">18+</span>}</h2>
      <Player film={item.id} title={item.title} note={item.note} age={item.age} />
      <div className="adm-promo-export">
        <a className="adm-button adm-button-primary" href={item.video} download={item.download}><Download size={16} /> Скачать MP4</a>
      </div>
    </section>)}
    <p className="adm-fine">Mr.Брекин VPN не существует, это шутка. Музыка сочинена скриптом (scripts/build-cartoon-music.py), голоса — Piper «Дмитрий» и «Денис» (CC0). Как пересобрать — docs/promo.md.</p>
  </>
}
