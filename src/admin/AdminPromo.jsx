import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Download, Mic, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import PromoStage, { PROMO_DURATION, captionAt } from './PromoStage.jsx'
import { PROMO_LINES } from './promo-script.js'
import timeline from './promo-timeline.json'
import { fresh } from './fresh-url.js'
import { assembleTakes, deleteTake, duckCurve, extensionFor, loadBuffer, loadTakes, playMix, recordVideo, renderMix, saveTake, wavBlob } from './promo-audio.js'

// Вкладка «Промо-ролик» в /admin.
// Видео без звука (public/promo/logos-promo-video.mp4) + звук, который собирается
// прямо в браузере: голос (синтезированный или свой, записанный здесь по фразам)
// и музыка, которая приседает под голос. Готовый ролик можно скачать.
// ?render=1 — только сцена 1280×720 для scripts/render-promo.mjs.

// Адреса с версией сайта (fresh-url.js), чтобы после обновления не играла старая копия.
const VIDEO_URL = fresh('/promo/logos-promo-video.mp4')
const FULL_URL = fresh('/promo/logos-promo.mp4')
const VOICE_URL = fresh('/promo/voice.mp3')
const MUSIC_URL = fresh('/promo/music.mp3')
const POSTER_URL = fresh('/promo/poster.jpg')
const SLOTS = timeline.lines.map((line, index) => ({ ...line, ...PROMO_LINES[index], slotEnd: timeline.lines[index + 1]?.start ?? timeline.duration }))
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const download = (blob, name) => {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

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

function useAudioContext() {
  const ref = useRef(null)
  return useCallback(() => {
    if (!ref.current) ref.current = new AudioContext({ sampleRate: 44100 })
    if (ref.current.state === 'suspended') ref.current.resume()
    return ref.current
  }, [])
}

function Studio() {
  const getContext = useAudioContext()
  const videoRef = useRef(null)
  const stopRef = useRef(() => {})
  const frameRef = useRef(0)
  const micRef = useRef(null)
  const recorderRef = useRef(null)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [source, setSource] = useState('synth') // synth | own | none
  const [musicOn, setMusicOn] = useState(true)
  const [musicLevel, setMusicLevel] = useState(.9)
  const [voiceLevel, setVoiceLevel] = useState(1)
  const [buffers, setBuffers] = useState({ synth: null, music: null })
  const [takes, setTakes] = useState({}) // id -> AudioBuffer
  const [blobs, setBlobs] = useState({}) // id -> Blob (для сохранения и прослушивания)
  const [recording, setRecording] = useState(null) // { id, phase: 'ready' | 'speak' }
  const [status, setStatus] = useState('')
  const [exporting, setExporting] = useState(null)

  // Синтезированный голос и музыка грузятся при первом нажатии (браузер не даёт
  // создать звук до действия человека), записи своего голоса — из IndexedDB.
  const ensureBuffers = useCallback(async () => {
    if (buffers.synth && buffers.music) return buffers
    const context = getContext()
    const [synth, music] = await Promise.all([loadBuffer(context, VOICE_URL), loadBuffer(context, MUSIC_URL)])
    const next = { synth, music }
    setBuffers(next)
    return next
  }, [buffers, getContext])
  useEffect(() => {
    let alive = true
    loadTakes().then(async (saved) => {
      if (!alive || !Object.keys(saved).length) return
      setBlobs(saved)
      const context = getContext()
      const decoded = {}
      for (const [id, blob] of Object.entries(saved)) {
        try { decoded[id] = await context.decodeAudioData(await blob.arrayBuffer()) } catch { /* битая запись — пропускаем */ }
      }
      if (alive) { setTakes(decoded); setSource('own') }
    })
    return () => { alive = false }
  }, [getContext])

  const own = useMemo(() => (Object.keys(takes).length ? assembleTakes(getContext(), takes, timeline) : null), [takes, getContext])
  const voiceBuffer = source === 'synth' ? buffers.synth : source === 'own' ? own?.buffer : null
  const duck = useMemo(() => duckCurve(voiceBuffer, timeline.duration), [voiceBuffer])
  const mixFor = (loaded, offset) => ({
    voice: source === 'synth' ? loaded.synth : source === 'own' ? own?.buffer : null,
    music: musicOn ? loaded.music : null,
    duck: source === 'synth' ? duckCurve(loaded.synth, timeline.duration) : duck,
    voiceGain: voiceLevel,
    musicGain: musicLevel,
    own: source === 'own',
    offset,
  })

  const stopSound = () => { stopRef.current(); stopRef.current = () => {} }
  const tick = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setT(video.currentTime)
    if (!video.paused && !video.ended) frameRef.current = requestAnimationFrame(tick)
  }, [])
  useEffect(() => () => { stopSound(); cancelAnimationFrame(frameRef.current); micRef.current?.getTracks().forEach((track) => track.stop()) }, [])

  const play = async (from = videoRef.current?.currentTime || 0, { silent = false } = {}) => {
    const video = videoRef.current
    if (!video) return
    const loaded = await ensureBuffers()
    stopSound()
    if (from >= PROMO_DURATION - .05) from = 0
    video.currentTime = from
    if (!silent) stopRef.current = playMix(getContext(), getContext().destination, mixFor(loaded, from))
    try { await video.play() } catch { stopSound(); return }
    setPlaying(true)
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(tick)
  }
  const pause = () => { videoRef.current?.pause(); stopSound(); setPlaying(false) }
  const seek = (value) => {
    const wasPlaying = playing
    if (videoRef.current) videoRef.current.currentTime = value
    setT(value)
    if (wasPlaying) play(value)
  }

  // ---------- Запись своей фразы ----------
  // Видео играет с секунды до фразы, суфлёр показывает текст. Когда суфлёр
  // загорается, говорите. Запись идёт до начала следующей фразы.
  const record = async (slot) => {
    if (recording) return
    setStatus('')
    try {
      if (!micRef.current) micRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch {
      setStatus('Нет доступа к микрофону. Разрешите его в настройках браузера для этого сайта и нажмите ещё раз.')
      return
    }
    pause()
    const lead = 1.2
    const from = Math.max(0, slot.start - lead)
    const recorder = new MediaRecorder(micRef.current)
    const chunks = []
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      try {
        const buffer = await getContext().decodeAudioData(await blob.arrayBuffer())
        setTakes((current) => ({ ...current, [slot.id]: buffer }))
        setBlobs((current) => ({ ...current, [slot.id]: blob }))
        saveTake(slot.id, blob)
        setSource('own')
      } catch { setStatus('Не получилось прочитать запись. Попробуйте ещё раз.') }
      setRecording(null)
    }
    recorderRef.current = recorder
    setRecording({ id: slot.id, phase: 'ready' })
    recorder.start()
    await play(from, { silent: true })
    const video = videoRef.current
    const watch = () => {
      if (!recorderRef.current || recorderRef.current.state !== 'recording') return
      if (video.currentTime >= slot.start - .1) setRecording((current) => (current && current.phase === 'ready' ? { ...current, phase: 'speak' } : current))
      if (video.currentTime >= slot.slotEnd + .35 || video.ended) { pause(); recorder.stop(); return }
      requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  }
  const stopRecording = () => { if (recorderRef.current?.state === 'recording') { pause(); recorderRef.current.stop() } }
  const removeTake = (id) => {
    deleteTake(id)
    setTakes((current) => { const next = { ...current }; delete next[id]; return next })
    setBlobs((current) => { const next = { ...current }; delete next[id]; return next })
  }
  const listen = (id) => { const blob = blobs[id]; if (blob) new Audio(URL.createObjectURL(blob)).play() }

  // ---------- Скачать ----------
  const exportVideo = async () => {
    pause()
    setStatus('')
    const loaded = await ensureBuffers()
    setExporting(0)
    try {
      const blob = await recordVideo({ videoUrl: VIDEO_URL, mix: mixFor(loaded, 0), duration: PROMO_DURATION, onProgress: setExporting })
      download(blob, `logos-promo.${extensionFor(blob)}`)
      setStatus(extensionFor(blob) === 'webm' ? 'Ролик скачан в формате WebM. Его открывают браузеры, VLC и Telegram; для других программ переведите в MP4 любым конвертером.' : 'Ролик скачан.')
    } catch (error) {
      setStatus(error.message)
    }
    setExporting(null)
  }
  const exportAudio = async () => {
    const loaded = await ensureBuffers()
    download(wavBlob(await renderMix(mixFor(loaded, 0), timeline.duration)), 'logos-promo-sound.wav')
  }

  const caption = captionAt(t)
  const recordingSlot = recording && SLOTS.find((slot) => slot.id === recording.id)
  const recorded = Object.keys(takes).length
  const busy = Boolean(recording) || exporting !== null

  return <section className="adm-promo-player" aria-label="Промо-ролик">
    <div className="adm-promo-screen" onClick={() => (busy ? null : playing ? pause() : play())}>
      <video ref={videoRef} src={VIDEO_URL} poster={POSTER_URL} muted playsInline preload="auto" onEnded={() => { stopSound(); setPlaying(false); setT(PROMO_DURATION) }} />
      {!playing && !busy && <span className="adm-promo-big-play" aria-hidden="true"><Play size={34} fill="currentColor" /></span>}
      {recordingSlot && <div className={`adm-promo-prompter ${recording.phase === 'speak' ? 'is-speak' : ''}`} role="status"><span>{recording.phase === 'speak' ? 'Говорите' : 'Приготовьтесь'}</span><strong>{recordingSlot.caption}</strong></div>}
      {exporting !== null && <div className="adm-promo-prompter is-export" role="status"><span>Собираем ролик, не закрывайте вкладку</span><strong>{Math.round(exporting * 100)}%</strong></div>}
    </div>

    <div className="adm-promo-controls">
      <button type="button" className="adm-promo-play" onClick={() => (playing ? pause() : play())} disabled={busy} aria-label={playing ? 'Пауза' : 'Смотреть ролик'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}<span>{playing ? 'Пауза' : 'Смотреть'}</span></button>
      <label className="adm-promo-seek"><span className="visually-hidden">Перемотка</span>
        <input type="range" min="0" max={PROMO_DURATION} step="0.05" value={Math.min(t, PROMO_DURATION)} disabled={busy} onChange={(event) => seek(Number(event.target.value))} />
      </label>
      <span className="adm-promo-time">{clock(t)} / {clock(Math.round(PROMO_DURATION))}</span>
      <button type="button" className="adm-icon" onClick={() => seek(0)} disabled={busy} aria-label="С начала" title="С начала"><RotateCcw size={16} /></button>
    </div>

    <div className="adm-promo-mixer">
      <fieldset className="adm-promo-voice">
        <legend>Голос</legend>
        {[['synth', 'Синтезированный'], ['own', `Свой${recorded ? ` (${recorded} из ${SLOTS.length})` : ''}`], ['none', 'Без голоса']].map(([value, label]) => <label key={value} className={source === value ? 'is-on' : ''}>
          <input type="radio" name="promo-voice" value={value} checked={source === value} disabled={busy || (value === 'own' && !recorded)} onChange={() => { pause(); setSource(value) }} />{label}
        </label>)}
      </fieldset>
      <label className="adm-promo-level"><span>Громкость голоса</span><input type="range" min="0" max="1.6" step="0.05" value={voiceLevel} onChange={(event) => setVoiceLevel(Number(event.target.value))} disabled={busy || source === 'none'} /></label>
      <label className="adm-promo-level"><span><input type="checkbox" checked={musicOn} onChange={(event) => { pause(); setMusicOn(event.target.checked) }} disabled={busy} /> Музыка</span><input type="range" min="0" max="1.4" step="0.05" value={musicLevel} onChange={(event) => setMusicLevel(Number(event.target.value))} disabled={busy || !musicOn} aria-label="Громкость музыки" /></label>
      <p className="adm-promo-hint">Громкость применяется со следующего запуска. Музыка сама становится тише, когда звучит голос.</p>
    </div>

    <div className="adm-promo-takes">
      <div className="adm-promo-takes-head">
        <h2>Свой голос</h2>
        <p>Нажмите «Записать» у фразы: ролик начнёт играть за секунду до неё, а когда суфлёр на экране станет зелёным, прочитайте текст. Записи хранятся только в этом браузере.</p>
      </div>
      {status && <p className="adm-promo-note" role="status">{status}</p>}
      {own?.tooLong.length > 0 && <p className="adm-promo-warn">Фразы длиннее своего места в ролике и наедут на следующую: {own.tooLong.map(({ id, over }) => `${SLOTS.findIndex((slot) => slot.id === id) + 1} (на ${over.toFixed(1)} с)`).join(', ')}. Прочитайте их чуть быстрее или соберите ролик по своему темпу скриптом из promo-voice/README.md.</p>}
      <ol className="adm-promo-script">
        {SLOTS.map((slot, index) => {
          const current = (t >= slot.start && t < slot.slotEnd) || recording?.id === slot.id
          const has = Boolean(takes[slot.id])
          return <li key={slot.id} className={current ? 'is-current' : ''}>
            <button type="button" className="adm-promo-line" onClick={() => seek(Math.max(0, slot.start - .3))} disabled={busy}><span className="adm-promo-at">{index + 1}. {clock(slot.start)}</span><span>{slot.caption}</span></button>
            <span className="adm-promo-line-tools">
              {has && <Check size={16} className="adm-promo-done" aria-label="Записано" />}
              {recording?.id === slot.id
                ? <button type="button" className="adm-button adm-promo-rec is-on" onClick={stopRecording}><Square size={14} fill="currentColor" /> Стоп</button>
                : <button type="button" className="adm-button adm-promo-rec" onClick={() => record(slot)} disabled={busy}><Mic size={15} /> {has ? 'Перезаписать' : 'Записать'}</button>}
              {has && <button type="button" className="adm-icon" onClick={() => listen(slot.id)} disabled={busy} aria-label={`Прослушать фразу ${index + 1}`} title="Прослушать"><Play size={15} /></button>}
              {has && <button type="button" className="adm-icon adm-icon-danger" onClick={() => removeTake(slot.id)} disabled={busy} aria-label={`Удалить запись фразы ${index + 1}`} title="Удалить запись"><Trash2 size={15} /></button>}
            </span>
          </li>
        })}
      </ol>
    </div>

    <div className="adm-promo-export">
      <button type="button" className="adm-button adm-button-primary" onClick={exportVideo} disabled={busy}><Download size={16} /> Скачать ролик с этим звуком</button>
      <button type="button" className="adm-button" onClick={exportAudio} disabled={busy}>Скачать звук (WAV)</button>
      <a className="adm-button" href={FULL_URL} download="logos-promo.mp4">Готовый MP4 с синтезированным голосом</a>
    </div>
    {caption && playing && <p className="visually-hidden" aria-live="polite">{caption.caption}</p>}
  </section>
}

export default function AdminPromo() {
  const [params] = useSearchParams()
  if (params.get('render') === '1') return <RenderOnly />
  return <>
    <div className="adm-head">
      <div>
        <h1>Промо-ролик</h1>
        <p>Ролик о путеводителе на {Math.round(PROMO_DURATION)} секунд на настоящих экранах сайта: поиск кабинета, карта, маршрут, расписание и таблички «Вы здесь». Можно озвучить своим голосом прямо здесь и скачать.</p>
      </div>
    </div>
    <Studio />
    <p className="adm-fine">Музыка сочинена для ролика скриптом (scripts/build-promo-music.py), прав на неё не нужно. Синтезированный голос — Piper, голос «Дмитрий» (лицензия CC0). Как собрать ролик по своему темпу из записей на телефон — promo-voice/README.md и docs/promo.md.</p>
  </>
}
