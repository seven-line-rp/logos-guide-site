import { useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, Footprints, Gamepad2, List, Map as MapIcon, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Primitives.jsx'
import { games, rooms } from '../data.js'

// Цифры берутся из данных сайта, а не пишутся руками: добавили кабинет —
// счётчик на этой странице обновится сам.
const staircases = new Set(rooms.filter((room) => room.id.startsWith('stairs-')).map((room) => room.id.replace(/-\d$/, ''))).size
const facts = [
  { value: rooms.length, label: 'помещений на плане' },
  { value: 2, label: 'этажа корпуса' },
  { value: staircases, label: 'лестницы между этажами' },
  { value: games.length, label: 'игры для тренировки' },
]

const principles = [
  { title: 'Только по коридорам', text: 'Маршрут строится по нарисованным коридорам и дверям. Путь «сквозь стену» или через чужой кабинет сайт не предложит.' },
  { title: 'Номер не обязателен', text: 'Кабинет находится по номеру, по названию или по слову-подсказке: «еда» приведёт в столовую, «дрон» в лабораторию БПЛА.' },
  { title: 'Честно о точности', text: 'План помогает сориентироваться. GPS внутри здания ошибается, поэтому стартовую точку можно поставить на плане вручную.' },
]

const parts = [
  { to: '/map', icon: MapIcon, title: 'Карта этажей', text: 'План двух этажей: кабинеты, двери, лестницы и лифт.' },
  { to: '/route', icon: Footprints, title: 'Маршрут', text: 'Путь по шагам с озвучкой и выбором лестницы или лифта.' },
  { to: '/rooms', icon: List, title: 'Справочник', text: 'Все помещения с фильтрами по этажу и назначению.' },
  { to: '/games', icon: Gamepad2, title: 'Игры', text: 'Короткие квизы, чтобы запомнить план без зубрёжки.' },
  { to: '/docs', icon: BookOpen, title: 'Документация', text: 'Как пользоваться сайтом и интерактивное обучение.' },
]

// Чтобы заменить инициалы фотографиями, положите JPG с этими именами в public/team/.
const team = [
  { name: 'Давыдова Ксения', role: 'Руководитель проекта', photo: 'ksenia-davydova.jpg', initials: 'КД', tone: 'blue' },
  { name: 'Лисовой Данила', role: 'Дизайнер и разработчик сайта', photo: 'danila-lisovoy.jpg', initials: 'ДЛ', tone: 'violet' },
  { name: 'Бодян Тимофей', role: 'Разработчик приложения для Android', photo: 'timofey-bodyan.jpg', initials: 'ТБ', tone: 'teal' },
  { name: 'Брекин Артем', role: 'Вдохновитель проекта', photo: 'artem-brekin.jpg', initials: 'АБ', tone: 'amber' },
]

const questions = [
  { title: 'Можно ли проложить путь между этажами?', answer: 'Да. Выберите начальную точку и кабинет, и сайт предложит лифт и каждую из лестниц, отметит самый быстрый вариант и проведёт по коридорам обоих этажей.' },
  { title: 'GPS покажет кабинет автоматически?', answer: 'Нет. Телефон не определяет этаж и внутри здания может ошибаться на десятки метров. Для примерной GPS-метки нужно привязать два известных места на этаже; без привязки надёжнее поставить метку вручную.' },
  { title: 'Если проход закрыт или нужен доступный маршрут?', answer: 'Схема не знает о временных закрытиях и не подтверждает доступность всех проходов. Лифт показан на плане, но его работу лучше заранее уточнить у сотрудников колледжа.' },
  { title: 'Что делать, если кабинет не найден?', answer: 'Попробуйте номер или часть названия в справочнике. Если надпись на двери отличается от схемы, ориентируйтесь на указатели и сообщите об этом команде проекта.' },
]

function TeamPhoto({ person }) {
  const [loaded, setLoaded] = useState(false)
  return <div className="ab-photo" data-tone={person.tone}>
    <span className="ab-photo-initials" aria-hidden="true">{person.initials}</span>
    <img className={loaded ? 'ab-photo-loaded' : ''} src={`/team/${person.photo}`} alt={`Фото: ${person.name}`} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} />
  </div>
}

export default function AboutPage() {
  return <div className="ab">
    <section className="ab-hero container">
      <div className="ab-hero-copy">
        <span className="eyebrow">О проекте</span>
        <h1>Путеводитель, который сделали <em>студенты для студентов.</em></h1>
        <p>В первые недели учёбы проще всего опоздать не из-за расписания, а из-за коридоров. Мы перенесли план корпуса на сайт, добавили поиск и маршруты, чтобы найти кабинет можно было за минуту, а не за перемену.</p>
      </div>
      <dl className="ab-facts">
        {facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
      </dl>
    </section>

    <section className="ab-section container" aria-labelledby="ab-principles">
      <header className="ab-section-head">
        <span className="ab-tag">Подход</span>
        <h2 id="ab-principles">Три правила, по которым устроен сайт</h2>
      </header>
      <ol className="ab-principles">
        {principles.map((item, index) => <Reveal as="li" key={item.title} delay={index * 60}>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </Reveal>)}
      </ol>
    </section>

    <section className="ab-section container" aria-labelledby="ab-parts">
      <header className="ab-section-head">
        <span className="ab-tag">Что внутри</span>
        <h2 id="ab-parts">Пять разделов, одна задача</h2>
      </header>
      <div className="ab-parts">
        {parts.map((part) => {
          const Icon = part.icon
          return <Link key={part.to} to={part.to} className="ab-part">
            <span className="ab-part-icon" aria-hidden="true"><Icon size={18} /></span>
            <strong>{part.title}</strong>
            <span className="ab-part-text">{part.text}</span>
            <ArrowUpRight className="ab-part-arrow" size={16} aria-hidden="true" />
          </Link>
        })}
        <div className="ab-part ab-part-app">
          <span className="ab-part-icon" aria-hidden="true"><Smartphone size={18} /></span>
          <strong>Приложение для Android</strong>
          <span className="ab-part-text">Сейчас на техническом обслуживании и пока не поддерживается. Пользуйтесь сайтом, он работает на телефоне.</span>
        </div>
      </div>
    </section>

    <section className="ab-section container" aria-labelledby="ab-team">
      <header className="ab-section-head ab-section-head-split">
        <div>
          <span className="ab-tag">Команда</span>
          <h2 id="ab-team">Кто сделал путеводитель</h2>
        </div>
        <p>Учебный проект четырёх человек: от идеи и плана корпуса до сайта и приложения.</p>
      </header>
      <ul className="ab-team">
        {team.map((person, index) => <Reveal as="li" key={person.name} className="ab-person" delay={index * 50}>
          <TeamPhoto person={person} />
          <h3>{person.name}</h3>
          <p>{person.role}</p>
        </Reveal>)}
      </ul>
    </section>

    <section className="ab-section container ab-split" aria-labelledby="ab-faq">
      <header className="ab-section-head">
        <span className="ab-tag">Вопросы</span>
        <h2 id="ab-faq">Коротко о том, что умеет и чего не умеет сайт</h2>
        <p className="ab-note">Схема помогает сориентироваться, но не заменяет указатели. Если проход закрыт, следуйте табличкам в здании.</p>
      </header>
      <div className="ab-faq">
        {questions.map((item, index) => <details key={item.title} open={index === 0}><summary>{item.title}</summary><p>{item.answer}</p></details>)}
      </div>
    </section>

    <section className="ab-cta container">
      <div>
        <h2>Нашли неточность на плане?</h2>
        <p>Расскажите любому из команды: номер кабинета, этаж и что не так. Каждое уточнение делает карту точнее для следующего курса.</p>
      </div>
      <div className="ab-cta-actions">
        <Link className="button button-primary" to="/map">Открыть карту <ArrowRight size={15} /></Link>
        <Link className="ab-cta-link" to="/docs">Документация <ArrowRight size={14} /></Link>
      </div>
    </section>
  </div>
}
