import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Image, Printer } from 'lucide-react'
import { CARD, doorCardSvg } from '../door-card.js'
import { brandedQrSvg, svgToPng } from '../share.js'
import { hereLink, roomName, signFileName, signRooms } from '../signs.js'
import { makeZip } from '../zip.js'

// Карточки помещений для печати на двери (/admin/cards): логотип, название,
// QR «Вы здесь» и подпись команды. Предпросмотр, печать на A4 (две карточки на
// лист) и скачивание: PNG 2560×1387 (2K) и 1920×1040 (FHD), плюс SVG.

const SIZES = [['png-2k', 2560, 1387], ['png-fhd', 1920, 1040]]

function download(blob, name) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

export default function AdminCardsPage() {
  const [floor, setFloor] = useState('all')
  const [cards, setCards] = useState({})
  const [busy, setBusy] = useState('')
  useEffect(() => {
    let alive = true
    Promise.all(signRooms.map(async (room) => [room.id, doorCardSvg(room, await brandedQrSvg(hereLink(window.location.origin, room.id)))]))
      .then((entries) => { if (alive) setCards(Object.fromEntries(entries)) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const list = useMemo(() => signRooms.filter((room) => floor === 'all' || String(room.floor) === floor), [floor])
  const ready = signRooms.every((room) => cards[room.id])

  const downloadOne = async (room) => {
    setBusy(room.id)
    try { download(new Blob([await svgToPng(cards[room.id], SIZES[0][1], SIZES[0][2])], { type: 'image/png' }), signFileName(room, 'png')) } finally { setBusy('') }
  }
  const downloadAll = async () => {
    setBusy('zip')
    try {
      const files = []
      for (const room of signRooms) {
        files.push({ name: `svg/${signFileName(room)}`, data: cards[room.id] })
        for (const [folder, width, height] of SIZES) {
          try { files.push({ name: `${folder}/${signFileName(room, 'png')}`, data: await svgToPng(cards[room.id], width, height) }) } catch { /* без PNG архив всё равно полезен */ }
        }
      }
      download(new Blob([makeZip(files)], { type: 'application/zip' }), 'logos-kartochki-dlya-dverey.zip')
    } finally { setBusy('') }
  }

  return <section className="admin-cards container">
    <div className="no-print">
      <span className="eyebrow">Для сотрудников</span>
      <h1>Карточки на двери</h1>
      <p className="admin-lead">У каждого помещения своя карточка: логотип, название, QR-код «Вы здесь» и подпись команды. Сканируя код, человек сразу строит маршрут от этой двери.</p>
      <div className="here-signs-bar">
        <div className="directory-category-filters" role="group" aria-label="Этаж">{[['all', 'Все'], ['1', '1 этаж'], ['2', '2 этаж']].map(([id, label]) => <button key={id} type="button" className={floor === id ? 'directory-chip directory-chip-active' : 'directory-chip'} aria-pressed={floor === id} onClick={() => setFloor(id)}>{label}</button>)}</div>
        <div className="here-signs-actions">
          <button type="button" className="button" onClick={downloadAll} disabled={!ready || Boolean(busy)}><Download size={16} /> {busy === 'zip' ? 'Собираем архив…' : `Скачать все (ZIP, ${signRooms.length})`}</button>
          <button type="button" className="button button-primary" onClick={() => window.print()} disabled={!ready}><Printer size={16} /> Распечатать {list.length}</button>
        </div>
      </div>
      <p className="admin-cards-note">В архиве три папки: <b>png-2k</b> (2560×1387), <b>png-fhd</b> (1920×1040) и <b>svg</b> (векторные). Для печати берите PNG 2K или SVG; кнопка «Распечатать» кладёт по две карточки на лист A4.</p>
    </div>
    <div className="door-card-grid">
      {list.map((room) => <article key={room.id} className="door-card">
        <div className="door-card-art" role="img" aria-label={`Карточка: ${roomName(room)}`} style={{ aspectRatio: `${CARD.width} / ${CARD.height}` }} dangerouslySetInnerHTML={{ __html: cards[room.id] || '' }} />
        <button type="button" className="door-card-save no-print" onClick={() => downloadOne(room)} disabled={!cards[room.id] || Boolean(busy)} aria-label={`Скачать PNG: ${roomName(room)}`}><Image size={15} /> {busy === room.id ? 'Готовим…' : 'PNG 2K'}</button>
      </article>)}
    </div>
    <p className="admin-foot no-print"><Link to="/admin">← К объявлениям</Link></p>
  </section>
}
