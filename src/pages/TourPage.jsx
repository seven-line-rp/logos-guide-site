import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MapPin, Navigation, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import RouteScene from '../components/RouteScene.jsx'
import { roomLabel } from '../components/RoomSearchSelect.jsx'
import { findTour, tourLeg, tours } from '../tours.js'
import { TOUR_VOICES, readTourVoice, saveTourVoice, tourClip } from '../tour-voice.js'

// Экскурсия по колледжу в 3D: путь до каждой остановки прорисовывается,
// камера летит к ней, а карточка рассказывает, что здесь. «Смотреть»
// листает остановки сами: с озвучкой — когда фраза договорена, без неё —
// каждые несколько секунд.
const AUTOPLAY_MS = 7000
const AFTER_VOICE_MS = 1400

export default function TourPage() {
  const [params, setParams] = useSearchParams()
  const tour = findTour(params.get('id'))
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [following, setFollowing] = useState(true)
  const stop = tour.stops[index]
  const leg = tourLeg(tour, index)
  const last = index === tour.stops.length - 1

  useEffect(() => { setIndex(0); setPlaying(false) }, [tour.id])
  useEffect(() => { setFollowing(true) }, [index])
  // Озвучка: женский или мужской голос либо выключена. Браузер разрешает
  // звук только после нажатия, поэтому первая фраза звучит с первой кнопки.
  const [voice, setVoice] = useState(readTourVoice)
  const [speaking, setSpeaking] = useState(false)
  const [spoken, setSpoken] = useState('')
  const audio = useRef(null)
  const touched = useRef(false)
  const clipKey = `${tour.id}-${index}-${voice}`
  useEffect(() => {
    if (voice === 'off' || !touched.current) return undefined
    const element = audio.current || (audio.current = new Audio())
    element.src = tourClip(voice, tour.id, index)
    const onEnd = () => { setSpeaking(false); setSpoken(clipKey) }
    element.onended = onEnd
    element.onerror = onEnd
    setSpeaking(true)
    element.play().catch(onEnd)
    return () => { element.pause(); element.onended = null; element.onerror = null; setSpeaking(false) }
  }, [clipKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => audio.current?.pause(), [])
  const act = (fn) => (...args) => { touched.current = true; fn(...args) }
  const chooseVoice = act((value) => { setVoice(value); saveTourVoice(value); if (value === 'off') audio.current?.pause() })
  // «Прослушать»: и повтор, и первая фраза до любого другого нажатия.
  const replay = act(() => {
    if (voice === 'off') return
    const element = audio.current || (audio.current = new Audio())
    const clip = tourClip(voice, tour.id, index)
    if (!element.src.endsWith(clip)) element.src = clip
    const onEnd = () => { setSpeaking(false); setSpoken(clipKey) }
    element.onended = onEnd
    element.onerror = onEnd
    element.currentTime = 0
    setSpeaking(true)
    element.play().catch(onEnd)
  })

  useEffect(() => {
    if (!playing) return undefined
    if (last) { setPlaying(false); return undefined }
    // С голосом ждём конца фразы, без голоса — фиксированное время.
    const waitVoice = voice !== 'off' && touched.current
    if (waitVoice && spoken !== clipKey) return undefined
    const timer = window.setTimeout(() => setIndex((value) => Math.min(tour.stops.length - 1, value + 1)), waitVoice ? AFTER_VOICE_MS : AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [playing, index, last, tour.stops.length, voice, spoken, clipKey])
  useEffect(() => {
    const onKey = (event) => {
      if (event.target?.closest?.('input, textarea')) return
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(tour.stops.length - 1, value + 1))
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour.stops.length])

  const transfer = leg.transfer && leg.transfer.endFloor === leg.floor ? { floor: 0, arrival: leg.floor, arrivalLabel: `${leg.transfer.endFloor > leg.transfer.startFloor ? '↑' : '↓'} с ${leg.transfer.startFloor} этажа` } : null

  return <section className="ex-page container">
    <header className="ex-head">
      <div>
        <span className="eyebrow"><i className="eyebrow-dot" />Экскурсия в 3D</span>
        <h1>{tour.title}</h1>
        <p>{tour.subtitle} · {tour.stops.length} остановок · ~{tour.minutes} мин</p>
      </div>
      <div className="ex-switch" role="tablist" aria-label="Экскурсия">
        {tours.map((item) => <button type="button" role="tab" key={item.id} aria-selected={item.id === tour.id} onClick={() => setParams({ id: item.id })}>{item.title}</button>)}
      </div>
    </header>

    <div className="ex-layout">
      <div className="ex-stage">
        <RouteScene floor={leg.floor} points={leg.points} progress={leg.points.length - 1} following={following} onFollowChange={setFollowing} mode="3d" targetId={stop.roomId} selectedId={stop.roomId} transfer={transfer} />
        <div className="ex-card" key={`${tour.id}-${index}`} aria-live="polite">
          <span className="ex-card-step">Остановка {index + 1} из {tour.stops.length} · {leg.floor} этаж</span>
          <h2>{stop.title}</h2>
          <p>{stop.text}</p>
          <span className="ex-card-room"><MapPin size={14} /> {roomLabel(leg.room)}{leg.meters ? ` · ≈ ${Math.round(leg.meters)} м от прошлой остановки` : ''}</span>
          <div className="ex-controls">
            <button type="button" className="ex-ctl" onClick={act(() => setIndex(Math.max(0, index - 1)))} disabled={index === 0} aria-label="Предыдущая остановка"><ArrowLeft size={17} /></button>
            <button type="button" className="ex-ctl" onClick={act(() => (last ? (setIndex(0), setPlaying(true)) : setPlaying((value) => !value)))} aria-label={playing ? 'Пауза' : last ? 'Смотреть заново' : 'Смотреть автоматически'} title={playing ? 'Пауза' : 'Смотреть автоматически'}>{playing ? <Pause size={17} /> : last ? <RotateCcw size={16} /> : <Play size={16} />}</button>
            {!last
              ? <button type="button" className="ex-next" onClick={act(() => { setPlaying(false); setIndex(index + 1) })}>Дальше <ArrowRight size={16} /></button>
              : <Link className="ex-next" to={`/route?from=entrance-1&to=${encodeURIComponent(stop.roomId)}`}><Navigation size={15} /> Маршрут сюда</Link>}
          </div>
          <div className="ex-voice" role="group" aria-label="Озвучка экскурсии">
            {voice !== 'off' && <button type="button" className={`ex-voice-play ${speaking ? 'is-speaking' : ''}`} onClick={replay} aria-label="Прослушать остановку" title="Прослушать ещё раз"><span className="ex-eq" aria-hidden="true"><i /><i /><i /><i /></span></button>}
            <div className="ex-voice-seg">
              {TOUR_VOICES.map((item) => <button type="button" key={item.id} aria-pressed={voice === item.id} onClick={() => chooseVoice(item.id)} title={`Голос: ${item.name}`}><Volume2 size={13} /> {item.label}</button>)}
              <button type="button" aria-pressed={voice === 'off'} onClick={() => chooseVoice('off')} aria-label="Без озвучки" title="Без озвучки"><VolumeX size={14} /></button>
            </div>
          </div>
          {playing && (voice === 'off' || !touched.current) && <span className="ex-timer" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} key={`t-${index}`} />}
        </div>
      </div>

      <ol className="ex-stops" aria-label="Остановки">
        {tour.stops.map((item, i) => <li key={item.roomId + i} className={i === index ? 'is-now' : i < index ? 'is-done' : ''}>
          <button type="button" onClick={act(() => { setPlaying(false); setIndex(i) })}>
            <span className="ex-stop-num">{i + 1}</span>
            <span><strong>{item.title}</strong><small>{tourLeg(tour, i).floor} этаж</small></span>
          </button>
        </li>)}
      </ol>
    </div>
  </section>
}
