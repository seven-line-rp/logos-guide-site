import { useState } from 'react'
import { ArrowRight, Accessibility, CircleHelp, Compass, Map, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeading, Reveal, SectionLabel } from '../components/Primitives'

const questions = [
  { title: 'Как пользоваться планом?', answer: 'Выберите этаж, затем нажмите на помещение. В карточке появятся назначение и номер, если он указан на исходной схеме. Синие короткие линии показывают дверные проёмы.' },
  { title: 'Можно ли построить маршрут между этажами?', answer: 'Да. Укажите точку старта и место назначения. Путеводитель покажет, что нужно сменить этаж, и позволит выбрать лифт или лестницу. Ориентируйтесь также на указатели в здании.' },
  { title: 'Маршрут учитывает доступность?', answer: 'На планах отмечен лифт, но схема не подтверждает доступность каждого помещения и прохода. Если вам нужен безбарьерный маршрут, заранее уточните его у сотрудников колледжа.' },
  { title: 'Что делать, если кабинет не найден?', answer: 'Попробуйте поискать по номеру или части названия. Схема собрана по предоставленному плану; если информация на месте отличается, ориентируйтесь на актуальные указатели и обратитесь к сотрудникам.' },
]

const team = [
  { name: 'Давыдова Ксения', role: 'Руководитель проекта', image: 'ksenia-davydova.jpg' },
  { name: 'Лисовой Данила', role: 'Дизайнер и разработчик сайта', image: 'danila-lisovoy.jpg' },
  { name: 'Бодян Тимофей', role: 'Разработчик приложения для Android', image: 'timofey-bodyan.jpg' },
  { name: 'Брекин Артем', role: 'Вдохновитель проекта', image: 'artem-brekin.jpg' },
]

function TeamPortrait({ person }) {
  const initials = person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')
  return <div className="about-person-photo">
    <span className="about-person-placeholder" aria-hidden="true">{initials}</span>
    <img className="about-person-art" src={`/images/creators/${person.image}`} alt={person.name} loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} />
  </div>
}

export default function AboutPage() {
  const [openIndex, setOpenIndex] = useState(0)
  return <>
    <PageHeading eyebrow="О ПРОЕКТЕ" title={<>Путеводитель<br /><em>по колледжу.</em></>} description="Проект помогает найти кабинет, посмотреть план этажей и проложить путь между помещениями." aside={<div className="about-page-mark"><Compass size={23} /><span>ЗДЕСЬ<br />НАЧИНАЕТСЯ<br />ВАШ МАРШРУТ</span><i>↗</i></div>} />
    <section className="about-values-band"><div className="container about-values"><Reveal className="about-values-quote"><SectionLabel index="01">НАША ИДЕЯ</SectionLabel><blockquote>«Меньше искать.<br /><em>Больше успевать.»</em></blockquote><p>Навигатор для тех, кто только пришёл, спешит на пару или просто хочет быстро найти нужное место.</p></Reveal><div className="about-value-list">{[{ icon: Map, title: 'План этажей', detail: 'Кликабельная схема с номерами кабинетов и подсказками.' }, { icon: CircleHelp, title: 'Понятные ответы', detail: 'Поиск по названию, номеру и назначению помещения.' }, { icon: ShieldCheck, title: 'Честные ориентиры', detail: 'Если информации не хватает, мы не придумываем её.' }].map((item, index) => { const Icon = item.icon; return <Reveal className="about-value-row" key={item.title} delay={index * 65}><span>0{index + 1}</span><i><Icon size={18} /></i><div><strong>{item.title}</strong><small>{item.detail}</small></div><ArrowRight size={15} /></Reveal> })}</div></div></section>
    <section className="about-team-band" aria-labelledby="about-team-title"><div className="container about-team"><header className="about-team-heading"><div><SectionLabel index="02">КОМАНДА ПРОЕКТА</SectionLabel><h2 id="about-team-title">Авторы<br /><em>путеводителя.</em></h2></div><div className="about-project-mark"><span>ФОРМАТ</span><strong>Индивидуальный<br />проект</strong><i /> <span>ГРУППА</span><strong>П‑1</strong></div></header><div className="about-team-grid">{team.map((person, index) => <Reveal key={person.name} className="about-person" delay={index * 55}><TeamPortrait person={person} /><div className="about-person-copy"><span className="about-person-index">0{index + 1}</span><h3>{person.name}</h3><p>{person.role}</p></div></Reveal>)}</div></div></section>
    <section className="about-access container"><div className="about-access-icon"><Accessibility size={23} /></div><div><SectionLabel index="03">ВАЖНО ОБ УДОБСТВЕ</SectionLabel><h2>Маршрут должен<br /><em>подходить человеку.</em></h2><p>Лифт отмечен на схеме. Но состояние проходов, доступность конкретных кабинетов и временные ограничения могут меняться. Если нужна помощь с маршрутом, уточните детали у сотрудников колледжа.</p></div><Link to="/map">Посмотреть лифт на карте <ArrowRight size={14} /></Link></section>
    <section className="faq-band"><div className="container faq-layout"><div className="faq-heading"><SectionLabel index="04">ЧАСТЫЕ ВОПРОСЫ</SectionLabel><h2>Перед тем,<br />как <em>начать.</em></h2><p>Коротко о возможностях и ограничениях путеводителя.</p></div><div className="faq-list">{questions.map((item, index) => <div className={`faq-item ${openIndex === index ? 'faq-item-open' : ''}`} key={item.title}><button onClick={() => setOpenIndex(openIndex === index ? -1 : index)} aria-expanded={openIndex === index}><span>0{index + 1}</span><strong>{item.title}</strong><i><b /><b /></i></button>{openIndex === index && <p>{item.answer}</p>}</div>)}</div></div></section>
    <section className="about-bottom container"><span className="about-bottom-symbol">⌖</span><div><SectionLabel index="05">ГОТОВЫ ПОПРОБОВАТЬ?</SectionLabel><h2>Куда идём <em>сначала?</em></h2></div><div className="about-bottom-actions"><Link className="button button-primary" to="/map">Открыть карту <ArrowRight size={15} /></Link><Link to="/games">Или сыграть в мини-квиз <ArrowRight size={14} /></Link></div></section>
  </>
}
