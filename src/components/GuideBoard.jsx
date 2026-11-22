import { Link } from 'react-router-dom'
import { ArrowUpRight, Users } from 'lucide-react'
import { rooms } from '../data.js'
import { useTeachers } from '../search.js'

// Указатель на главной: разделы путеводителя в виде табло, как в коридоре колледжа.
// Цифры на табличках берутся из данных сайта, а не пишутся руками: помещения из
// src/data.js, преподаватели из teachers.json. Пока список преподавателей
// не загрузился, вместо числа стоит значок, чтобы не показывать ноль.
const FLOOR_LINKS = 4 // лифт и три лестницы, см. src/map-routing.js

export default function GuideBoard() {
  const teachers = useTeachers()
  const rows = [
    { to: '/map', plate: String(rooms.length), title: 'Карта этажей', text: `${rooms.length} помещений на двух этажах: кабинеты, столовая, гардероб, медпункт.` },
    { to: '/route', plate: String(FLOOR_LINKS), title: 'Маршрут до двери', text: 'Лифт и три лестницы между этажами. Покажем самый быстрый путь и подскажем повороты голосом.' },
    { to: '/teachers', plate: teachers.length ? String(teachers.length) : null, icon: Users, title: 'Преподаватели', text: 'Введите фамилию преподавателя или сотрудника, и откроется кабинет, где его искать.' },
    { to: '/here', plate: 'QR', title: 'Таблички «Вы здесь»', text: 'Наведите камеру на код у двери, и маршрут построится от этого места.' },
  ]

  return <section className="guide-board container section-pad" aria-labelledby="guide-board-title">
    <div className="guide-board-intro">
      <h2 id="guide-board-title">Что есть в путеводителе</h2>
      <p>Всё работает в браузере, без регистрации. Карта открывается и без интернета, если сайт уже был открыт на этом телефоне.</p>
      {/* Иллюстрация сделана в Recraft, описание — docs/assets/corridor.brief.md. */}
      <img className="guide-board-art" src="/art/corridor-560.webp" srcSet="/art/corridor-560.webp 560w, /art/corridor.webp 980w" sizes="(max-width: 860px) 90vw, 400px" width="560" height="423" alt="" loading="lazy" decoding="async" />
    </div>
    <nav className="guide-board-sign" aria-label="Разделы путеводителя">
      {rows.map(({ to, plate, icon: Icon, title, text }) => <Link key={to} className="guide-board-row" to={to}>
        <span className={`guide-board-plate${plate && plate.length > 2 ? ' is-wide' : ''}`} aria-hidden="true">{plate || <Icon size={22} />}</span>
        <span className="guide-board-copy"><strong>{title}</strong><span className="guide-board-text">{text}</span></span>
        <ArrowUpRight className="guide-board-arrow" size={18} aria-hidden="true" />
      </Link>)}
    </nav>
  </section>
}
