import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, GraduationCap, LayoutGrid, Map as MapIcon, Navigation } from 'lucide-react'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { translate, useLanguage } from '../i18n.js'
import { composePlanArt } from '../map-art.js'

const sections = [
  { href: '/route', icon: Navigation, title: 'Маршрут', description: 'Путь от входа или любого кабинета' },
  { href: '/rooms', icon: LayoutGrid, title: 'Кабинеты', description: 'Аудитории, залы и общие зоны' },
  { href: '/teachers', icon: GraduationCap, title: 'Преподаватели', description: 'Поиск по фамилии или предмету' },
]

const floors = [
  { number: 1, label: 'Первый этаж', plan: floorOnePlan },
  { number: 2, label: 'Второй этаж', plan: floorTwoPlan },
]

export default function EditionHome({ search }) {
  const language = useLanguage()
  const [floorIndex, setFloorIndex] = useState(0)
  const floor = floors[floorIndex]

  return (
    <div className="edition-home" id="top">
      <section className="edition-hero" aria-labelledby="edition-title">
        <div className="edition-hero-grid container">
          <div className="edition-copy">
            <h1 id="edition-title">{translate('Найдите путь', language)} <span>{translate('в «Логосе»', language)}</span></h1>
            <p>{translate('Карта колледжа подскажет, где проходит пара и как туда дойти.', language)}</p>
            <div className="edition-search">
              <label htmlFor="home-room-search">{translate('Поиск по колледжу', language)}</label>
              {search}
            </div>
            <div className="edition-actions">
              <Link className="edition-button edition-button-primary" to="/map"><MapIcon size={19} aria-hidden="true" />{translate('Открыть карту', language)}<ArrowUpRight size={17} aria-hidden="true" /></Link>
              <Link className="edition-button edition-button-secondary" to="/route"><Navigation size={18} aria-hidden="true" />{translate('Построить маршрут', language)}</Link>
            </div>
          </div>
          <div className="edition-art" aria-hidden="true">
            <div className="edition-orbit" />
            <img className="edition-compass" src="/art/edition-compass.webp" alt="" width="926" height="1024" fetchPriority="high" />
          </div>
          <a className="edition-scroll" href="#edition-plan"><ArrowDown size={17} aria-hidden="true" />{translate('Планы этажей', language)}</a>
        </div>
      </section>

      <nav className="edition-shortcuts container" aria-label={translate('Разделы сайта', language)}>
        {sections.map(({ href, icon: Icon, title, description }) => (
          <Link to={href} key={href}>
            <Icon className="edition-shortcut-icon" size={23} aria-hidden="true" />
            <span><strong>{translate(title, language)}</strong><small>{translate(description, language)}</small></span>
            <ArrowUpRight className="edition-shortcut-arrow" size={17} aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <section className="edition-plan container" id="edition-plan" aria-labelledby="edition-plan-title">
        <div className="edition-plan-copy">
          <h2 id="edition-plan-title">{translate('Колледж по этажам', language)}</h2>
          <p>{translate('Выберите этаж, чтобы посмотреть его план. На карте можно выбрать кабинет и узнать, как до него дойти.', language)}</p>
          <Link className="edition-library" to="/route?to=library-214">
            <BookOpen size={22} aria-hidden="true" />
            <span><strong>{translate('Маршрут в библиотеку', language)}</strong><small>{translate('Кабинет 214, второй этаж', language)}</small></span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="edition-plan-board">
          <div className="edition-plan-switch" role="group" aria-label={translate('Выбор этажа', language)}>
            {floors.map(({ number, label }, index) => (
              <button type="button" key={number} aria-pressed={index === floorIndex} onClick={() => setFloorIndex(index)}>
                {translate(label, language)}
              </button>
            ))}
          </div>
          <div className="edition-plan-image" role="img" aria-label={translate(floor.label, language)}>
            <div className="floor-map-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: composePlanArt(floor.plan, floor.number, language) }} />
          </div>
          <Link className="edition-plan-link" to={`/map?floor=${floor.number}`}>
            {translate('Открыть этаж на карте', language)}<ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  )
}
