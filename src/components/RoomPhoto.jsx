import { useState } from 'react'
import { photoSrcSet, photosFor } from '../data'

// Фото помещения в карточке на карте и в «Пространствах». Если снимков
// несколько, под фото появляются точки для переключения (кроме карточек-ссылок: dots={false}).
export default function RoomPhoto({ room, className = '', sizes = '(max-width: 680px) 100vw, 360px', dots = true }) {
  const photos = photosFor(room)
  const [index, setIndex] = useState(0)
  if (!photos.length) return null
  const current = photos[Math.min(index, photos.length - 1)]
  return <figure className={`room-photo ${className}`}>
    <img key={current} src={current} srcSet={photoSrcSet(current)} sizes={sizes} alt={`${room.name}: фото помещения`} loading="lazy" decoding="async" width="960" height="720" />
    {dots && photos.length > 1 && <div className="room-photo-dots" role="group" aria-label="Фото">{photos.map((src, i) => <button key={src} className={i === index ? 'room-photo-dot room-photo-dot-active' : 'room-photo-dot'} onClick={() => setIndex(i)} aria-label={`Фото ${i + 1} из ${photos.length}`} aria-pressed={i === index} />)}</div>}
  </figure>
}
