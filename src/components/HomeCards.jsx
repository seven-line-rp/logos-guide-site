import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { trackSpotlight } from './LandingFx.jsx'

// Три карточки с картинками на главной: «как это работает» в три шага.
// Раскладка по мотивам Focus Cards (ui.aceternity.com): под курсором карточка
// остаётся яркой, соседние приглушаются. Картинки лежат в public/cards/,
// чтобы заменить картинку, достаточно положить файл с тем же именем.
export const HOME_CARDS = [
  {
    to: '/rooms',
    image: '/cards/card-1.webp',
    step: '01',
    kicker: 'Найти',
    title: 'Кабинет по номеру или фамилии',
    text: 'Пишите как удобно: «217», «столовая» или фамилию преподавателя. Поиск поймёт и откроет место на плане.',
  },
  {
    to: '/route',
    image: '/cards/card-2.webp',
    step: '02',
    kicker: 'Проложить',
    title: 'Маршрут от входа до двери',
    text: 'Лифт или одна из трёх лестниц: путеводитель выберет короткий путь и покажет его по этажам.',
  },
  {
    to: '/here',
    image: '/cards/card-3.webp',
    step: '03',
    kicker: 'Дойти',
    title: 'С подсказками на каждом повороте',
    text: 'Голос подскажет, куда свернуть, а QR-табличка у двери покажет, что вы пришли куда нужно.',
  },
]

export default function HomeCards() {
  return <section className="home-cards container" aria-labelledby="home-cards-title">
    <div className="landing-head">
      <span className="landing-kicker">Как это работает</span>
      <h2 id="home-cards-title">Три шага до нужной двери</h2>
      <p>Без регистрации и установки: открыли сайт, нашли кабинет, пошли.</p>
    </div>
    <div className="home-cards-grid" onPointerMove={trackSpotlight}>
      {HOME_CARDS.map((card) => <Link key={card.step} to={card.to} className="home-card fx-spot">
        <span className="home-card-media">
          <img src={card.image} alt="" width="960" height="720" loading="lazy" decoding="async" />
          <span className="home-card-step" aria-hidden="true">{card.step}</span>
        </span>
        <span className="home-card-body">
          <small>{card.kicker}</small>
          <strong>{card.title}</strong>
          <span className="home-card-text">{card.text}</span>
          <span className="home-card-more">Попробовать <ArrowUpRight size={15} aria-hidden="true" /></span>
        </span>
      </Link>)}
    </div>
  </section>
}
