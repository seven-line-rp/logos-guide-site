import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

// Три карточки на главной: найти кабинет, построить маршрут, дойти.
// Картинки лежат в public/cards/ (квадрат 960×960); чтобы заменить картинку,
// достаточно положить файл с тем же именем.
export const HOME_CARDS = [
  {
    to: '/rooms',
    image: '/cards/find.webp',
    title: 'Найдите кабинет',
    text: 'По номеру, названию или фамилии преподавателя: «217», «столовая», «Иванова».',
  },
  {
    to: '/route',
    image: '/cards/route.webp',
    title: 'Постройте маршрут',
    text: 'От входа или от любой двери. Между этажами — лифт или одна из трёх лестниц.',
  },
  {
    to: '/here',
    image: '/cards/walk.webp',
    title: 'Идите по подсказкам',
    text: 'Голос говорит, где повернуть. QR-табличка у двери покажет, где вы сейчас.',
  },
]

export default function HomeCards() {
  return <section className="home-cards container" aria-labelledby="home-cards-title">
    <div className="landing-head">
      <h2 id="home-cards-title">Как это работает</h2>
      <p>Регистрация и установка не нужны: сайт открывается в браузере телефона.</p>
    </div>
    <div className="home-cards-grid">
      {HOME_CARDS.map((card) => <Link key={card.to} to={card.to} className="home-card">
        <span className="home-card-media"><img src={card.image} alt="" width="960" height="960" loading="lazy" decoding="async" /></span>
        <span className="home-card-body">
          <strong>{card.title} <ArrowUpRight size={17} aria-hidden="true" /></strong>
          <span className="home-card-text">{card.text}</span>
        </span>
      </Link>)}
    </div>
  </section>
}
