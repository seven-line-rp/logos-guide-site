import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, MapPin, Printer, QrCode } from 'lucide-react'
import { PageHeading, Reveal } from '../components/Primitives.jsx'
import RoomSearchSelect from '../components/RoomSearchSelect.jsx'
import { quickPlaces, rooms } from '../data.js'
import { findNearest, nearbyKinds } from '../places.js'
import { setHere } from '../route-prefs.js'
import { qrSvg } from '../share.js'

// «Вы здесь». На дверях можно повесить QR-табличку со ссылкой
// /here?room=<id>: человек сканирует её, и путеводитель сразу знает, откуда
// строить маршрут (logos-here, как после пройденного маршрута). Без ?room
// страница собирает листы с такими табличками для печати.

const roomName = (room) => `${room.name}${room.number ? ` №${room.number}` : ''}`
// Табличка нужна там, куда приходят люди: без лифтов, лестниц и самих входов.
const signRooms = rooms.filter((room) => !/^(lift|stairs)-/.test(room.id))

export const hereLink = (origin, roomId) => `${origin}/here?room=${encodeURIComponent(roomId)}`

function YouAreHere({ room }) {
  const navigate = useNavigate()
  const [target, setTarget] = useState('')
  useEffect(() => { setHere(room.id) }, [room.id])
  const nearest = useMemo(() => nearbyKinds.map((kind) => ({ kind, found: findNearest(room.id, kind.id, room.id) })).filter((item) => item.found), [room.id])
  const go = (to) => navigate(`/route?from=${encodeURIComponent(room.id)}&to=${encodeURIComponent(to)}`)
  const popular = quickPlaces.map((place) => rooms.find((item) => item.id === place.roomId)).filter((item) => item && item.id !== room.id)

  return <>
    <PageHeading className="page-heading-compact" eyebrow="Вы здесь" title={<>{room.name}{room.number && <em> №{room.number}</em>}</>} description={`${room.floor} этаж. Куда идём? Маршрут начнётся отсюда.`} />
    <section className="here-section container">
      <Reveal className="here-card">
        <span className="here-pin" aria-hidden="true"><MapPin size={22} /></span>
        <div className="here-pick">
          <RoomSearchSelect label="Куда" value={target} onChange={(id) => { setTarget(id); if (id && id !== room.id) go(id) }} placeholder="Номер кабинета, место или фамилия" />
          <small className="here-pick-hint">Выберите место — маршрут откроется сразу.</small>
        </div>
      </Reveal>
      <Reveal className="here-block" delay={60}>
        <h2>Ближайшее отсюда</h2>
        <div className="here-chips">{nearest.map(({ kind, found }) => <button key={kind.id} type="button" className="here-chip" onClick={() => go(found.room.id)}><span>{kind.label}</span><small>{found.seconds < 60 ? '<1 мин' : `${Math.round(found.seconds / 60)} мин`}</small></button>)}</div>
      </Reveal>
      <Reveal className="here-block" delay={120}>
        <h2>Часто ищут</h2>
        <div className="here-chips">{popular.map((item) => <button key={item.id} type="button" className="here-chip" onClick={() => go(item.id)}><span>{roomName(item)}</span><small>{item.floor} этаж</small></button>)}</div>
      </Reveal>
      <p className="here-note"><Link to={`/map?floor=${room.floor}&room=${room.id}`}>Показать это место на карте <ArrowRight size={14} /></Link></p>
    </section>
  </>
}

function SignSheet() {
  const [floor, setFloor] = useState('all')
  const [codes, setCodes] = useState({})
  const list = signRooms.filter((room) => floor === 'all' || String(room.floor) === floor)
  useEffect(() => {
    let alive = true
    Promise.all(signRooms.map(async (room) => [room.id, await qrSvg(hereLink(window.location.origin, room.id))]))
      .then((entries) => { if (alive) setCodes(Object.fromEntries(entries)) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return <>
    <PageHeading className="page-heading-compact no-print" eyebrow="QR-таблички" title={<>Таблички <em>«Вы здесь»</em></>} description="Распечатайте и повесьте у дверей. Человек сканирует код — и маршрут начинается от этого места, без поиска «где я»." />
    <section className="here-signs container">
      <div className="here-signs-bar no-print">
        <div className="directory-category-filters" role="group" aria-label="Этаж">{[['all', 'Все'], ['1', '1 этаж'], ['2', '2 этаж']].map(([id, label]) => <button key={id} type="button" className={floor === id ? 'directory-chip directory-chip-active' : 'directory-chip'} aria-pressed={floor === id} onClick={() => setFloor(id)}>{label}</button>)}</div>
        <button type="button" className="button button-primary" onClick={() => window.print()}><Printer size={16} /> Распечатать {list.length}</button>
      </div>
      <div className="here-sign-grid">
        {list.map((room) => <article key={room.id} className="here-sign">
          <div className="here-sign-qr" role="img" aria-label={`QR-код: ${roomName(room)}`} dangerouslySetInnerHTML={{ __html: codes[room.id] || '' }} />
          <div className="here-sign-copy"><span><QrCode size={13} aria-hidden="true" /> Вы здесь</span><strong>{roomName(room)}</strong><small>{room.floor} этаж · наведите камеру, чтобы построить маршрут</small></div>
        </article>)}
      </div>
    </section>
  </>
}

export default function HerePage() {
  const [params] = useSearchParams()
  const room = rooms.find((item) => item.id === params.get('room'))
  return room ? <YouAreHere room={room} /> : <SignSheet />
}
