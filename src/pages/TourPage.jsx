import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MapPin, Navigation, Pause, Play, RotateCcw } from 'lucide-react'
import RouteScene from '../components/RouteScene.jsx'
import { roomLabel } from '../components/RoomSearchSelect.jsx'
import { findTour, tourLeg, tours } from '../tours.js'

// Экскурсия по колледжу в 3D: путь до каждой остановки прорисовывается,
// камера летит к ней, а карточка рассказывает, что здесь. «Смотреть»
// листает остановки сами каждые несколько секунд.
const AUTOPLAY_MS = 7000

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
  useEffect(() => {
    if (!playing) return undefined
    if (last) { setPlaying(false); return undefined }
    const timer = window.setTimeout(() => setIndex((value) => Math.min(tour.stops.length - 1, value + 1)), AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [playing, index, last, tour.stops.length])
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
        <span className="eyebrow">Экскурсия в 3D</span>
        <h1>{tour.title}</h1>
        <p>{tour.subtitle}, {tour.stops.length} остановок, ~{tour.minutes} мин</p>
      </div>
      <div className="ex-switch" role="tablist" aria-label="Экскурсия">
        {tours.map((item) => <button type="button" role="tab" key={item.id} aria-selected={item.id === tour.id} onClick={() => setParams({ id: item.id })}>{item.title}</button>)}
      </div>
    </header>

    <div className="ex-layout">
      <div className="ex-stage">
        <RouteScene floor={leg.floor} points={leg.points} progress={leg.points.length - 1} following={following} onFollowChange={setFollowing} mode="3d" targetId={stop.roomId} selectedId={stop.roomId} transfer={transfer} />
        <div className="ex-card" key={`${tour.id}-${index}`} aria-live="polite">
          <span className="ex-card-step">Остановка {index + 1} из {tour.stops.length}, {leg.floor} этаж</span>
          <h2>{stop.title}</h2>
          <p>{stop.text}</p>
          <span className="ex-card-room"><MapPin size={14} /> {roomLabel(leg.room)}{leg.meters ? `, ≈ ${Math.round(leg.meters)} м от прошлой остановки` : ''}</span>
          <div className="ex-controls">
            <button type="button" className="ex-ctl" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Предыдущая остановка"><ArrowLeft size={17} /></button>
            <button type="button" className="ex-ctl" onClick={() => (last ? (setIndex(0), setPlaying(true)) : setPlaying((value) => !value))} aria-label={playing ? 'Пауза' : last ? 'Смотреть заново' : 'Смотреть автоматически'} title={playing ? 'Пауза' : 'Смотреть автоматически'}>{playing ? <Pause size={17} /> : last ? <RotateCcw size={16} /> : <Play size={16} />}</button>
            {!last
              ? <button type="button" className="ex-next" onClick={() => { setPlaying(false); setIndex(index + 1) }}>Дальше <ArrowRight size={16} /></button>
              : <Link className="ex-next" to={`/route?from=entrance-1&to=${encodeURIComponent(stop.roomId)}`}><Navigation size={15} /> Маршрут сюда</Link>}
          </div>
          {playing && <span className="ex-timer" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} key={`t-${index}`} />}
        </div>
      </div>

      <ol className="ex-stops" aria-label="Остановки">
        {tour.stops.map((item, i) => <li key={item.roomId + i} className={i === index ? 'is-now' : i < index ? 'is-done' : ''}>
          <button type="button" onClick={() => { setPlaying(false); setIndex(i) }}>
            <span className="ex-stop-num">{i + 1}</span>
            <span><strong>{item.title}</strong><small>{tourLeg(tour, i).floor} этаж</small></span>
          </button>
        </li>)}
      </ol>
    </div>
  </section>
}
