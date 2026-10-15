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
  { name: 'Давыдова Ксения', role: 'Руководитель проекта', background: '#dce8ff', hair: '#3e3650', skin: '#e9b99d', clothes: '#4569b3', hairShape: 'M49 75c-2-25 9-39 31-39s34 15 31 40c-12-6-20-15-23-25-10 14-24 20-39 24z' },
  { name: 'Лисовой Данила', role: 'Дизайнер и разработчик сайта', background: '#f0e4d7', hair: '#45372f', skin: '#d6a27e', clothes: '#bc7048', hairShape: 'M46 68c-2-26 10-42 34-42 25 0 37 16 35 41-10-5-17-13-20-23-9 12-26 18-49 24z' },
  { name: 'Бодян Тимофей', role: 'Разработчик приложения для Android', background: '#d9eee7', hair: '#2e3e42', skin: '#c98d6b', clothes: '#398a7b', hairShape: 'M47 66c-2-26 10-40 33-40 23 0 36 15 34 40-8-8-12-15-13-24-10 11-27 16-54 15z' },
  { name: 'Брекин Артем', role: 'Вдохновитель проекта', background: '#eee4f0', hair: '#49374b', skin: '#e2ad88', clothes: '#8064a4', hairShape: 'M46 70c-4-27 8-44 35-44 26 0 39 18 33 46-6-6-9-13-10-21-12 10-30 15-58 19z' },
]

function TeamPortrait({ person }) {
  return <svg className="about-person-art" viewBox="0 0 160 170" role="img" aria-label={`Иллюстрация: ${person.name}`}>
    <rect width="160" height="170" fill={person.background} />
    <circle cx="132" cy="28" r="23" fill="#fff" opacity=".45" />
    <path d="M19 170c2-31 23-49 61-49s59 18 61 49H19Z" fill={person.clothes} />
    <path d="M68 111h24v24c-7 8-17 8-24 0v-24Z" fill={person.skin} />
    <path d={person.hairShape} fill={person.hair} />
    <ellipse cx="80" cy="75" rx="30" ry="37" fill={person.skin} />
    <path d={person.hairShape} fill={person.hair} />
    <path d="M66 76h2m24 0h2" stroke="#392f35" strokeWidth="3" strokeLinecap="round" />
    <path d="M75 94c3 3 7 3 10 0" fill="none" stroke="#9b5e56" strokeWidth="2" strokeLinecap="round" />
    <path d="M61 135c6 8 12 12 19 12s13-4 19-12" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />
  </svg>
}

export default function AboutPage() {
  const [openIndex, setOpenIndex] = useState(0)
  return <>
    <PageHeading eyebrow="О ПУТЕВОДИТЕЛЕ / КАК ЭТО РАБОТАЕТ" title={<>Ориентироваться<br /><em>может быть просто.</em></>} description="Этот сайт помогает быстрее освоиться в колледже: найти кабинет, увидеть два этажа целиком и потренироваться запоминать план." aside={<div className="about-page-mark"><Compass size={23} /><span>ЗДЕСЬ<br />НАЧИНАЕТСЯ<br />ВАШ МАРШРУТ</span><i>↗</i></div>} />
    <section className="about-values-band"><div className="container about-values"><Reveal className="about-values-quote"><SectionLabel index="01">НАША ИДЕЯ</SectionLabel><blockquote>«Меньше искать.<br /><em>Больше успевать.»</em></blockquote><p>Навигатор для тех, кто только пришёл, спешит на пару или просто хочет быстро найти нужное место.</p></Reveal><div className="about-value-list">{[{ icon: Map, title: 'План этажей', detail: 'Кликабельная схема с номерами кабинетов и подсказками.' }, { icon: CircleHelp, title: 'Понятные ответы', detail: 'Поиск по названию, номеру и назначению помещения.' }, { icon: ShieldCheck, title: 'Честные ориентиры', detail: 'Если информации не хватает, мы не придумываем её.' }].map((item, index) => { const Icon = item.icon; return <Reveal className="about-value-row" key={item.title} delay={index * 65}><span>0{index + 1}</span><i><Icon size={18} /></i><div><strong>{item.title}</strong><small>{item.detail}</small></div><ArrowRight size={15} /></Reveal> })}</div></div></section>
    <section className="about-team-band" aria-labelledby="about-team-title"><div className="container about-team"><header className="about-team-heading"><div><SectionLabel index="02">КОМАНДА ПРОЕКТА</SectionLabel><h2 id="about-team-title">Авторы<br /><em>путеводителя.</em></h2></div><div className="about-project-mark"><span>ФОРМАТ</span><strong>Индивидуальный<br />проект</strong><i /> <span>ГРУППА</span><strong>П‑1</strong></div></header><div className="about-team-grid">{team.map((person, index) => <Reveal key={person.name} className="about-person" delay={index * 55}><TeamPortrait person={person} /><div className="about-person-copy"><span className="about-person-index">0{index + 1}</span><h3>{person.name}</h3><p>{person.role}</p></div></Reveal>)}</div></div></section>
    <section className="about-access container"><div className="about-access-icon"><Accessibility size={23} /></div><div><SectionLabel index="03">ВАЖНО ОБ УДОБСТВЕ</SectionLabel><h2>Маршрут должен<br /><em>подходить человеку.</em></h2><p>Лифт отмечен на схеме. Но состояние проходов, доступность конкретных кабинетов и временные ограничения могут меняться. Если нужна помощь с маршрутом, уточните детали у сотрудников колледжа.</p></div><Link to="/map">Посмотреть лифт на карте <ArrowRight size={14} /></Link></section>
    <section className="faq-band"><div className="container faq-layout"><div className="faq-heading"><SectionLabel index="04">ЧАСТЫЕ ВОПРОСЫ</SectionLabel><h2>Перед тем,<br />как <em>начать.</em></h2><p>Коротко о возможностях и ограничениях путеводителя.</p></div><div className="faq-list">{questions.map((item, index) => <div className={`faq-item ${openIndex === index ? 'faq-item-open' : ''}`} key={item.title}><button onClick={() => setOpenIndex(openIndex === index ? -1 : index)} aria-expanded={openIndex === index}><span>0{index + 1}</span><strong>{item.title}</strong><i><b /><b /></i></button>{openIndex === index && <p>{item.answer}</p>}</div>)}</div></div></section>
    <section className="about-bottom container"><span className="about-bottom-symbol">⌖</span><div><SectionLabel index="05">ГОТОВЫ ПОПРОБОВАТЬ?</SectionLabel><h2>Куда идём <em>сначала?</em></h2></div><div className="about-bottom-actions"><Link className="button button-primary" to="/map">Открыть карту <ArrowRight size={15} /></Link><Link to="/games">Или сыграть в мини-квиз <ArrowRight size={14} /></Link></div></section>
  </>
}
