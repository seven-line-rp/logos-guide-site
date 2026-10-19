import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Cookie, Gamepad2, Keyboard, Layers, List, Map as MapIcon, Palette, Route, Search, Sparkles, Star } from 'lucide-react'
import { Reveal } from '../components/Primitives.jsx'
import { startTour } from '../tour-bus.js'

// Документация по сайту: каждый раздел — короткое описание и список
// конкретных действий. Цвет раздела совпадает с цветом шага в обучении.
const sections = [
  {
    id: 'start', tone: 'blue', icon: Sparkles, title: 'Быстрый старт',
    lead: 'Путеводитель помогает найти кабинет, увидеть его на плане и дойти по коридорам. Начать можно с любого места.',
    items: [
      ['Знаете номер', 'Нажмите «Найти место» в шапке или клавишу K и введите номер — например, 217.'],
      ['Знаете только назначение', 'Откройте «Кабинеты» и найдите по слову: «библиотека», «лаборатория», «туалет».'],
      ['Нужно дойти', 'В карточке кабинета нажмите «Построить маршрут» — сайт проведёт по коридорам и лестницам.'],
    ],
  },
  {
    id: 'map', tone: 'teal', icon: MapIcon, title: 'Карта этажей',
    lead: 'План двух этажей корпуса. Помещения нажимаются, двери показаны короткими синими линиями.',
    items: [
      ['Выбор этажа', 'Переключайтесь карточками «Первый этаж» и «Второй этаж» над планом.'],
      ['Карточка помещения', 'Нажмите на кабинет — появятся номер, этаж, описание и кнопка маршрута.'],
      ['Смена этажа по лестнице', 'Дважды нажмите на лестницу — откроется тот же пролёт на другом этаже.'],
      ['Масштаб', 'Кнопки «+», «−» и «1:1» в углу плана; на телефоне — двумя пальцами.'],
      ['Подписи и двери', 'Кнопка с ползунками рядом с «Поставить метку» скрывает подписи помещений и отметки дверей.'],
      ['Своя метка и GPS', '«Поставить метку» — коснитесь точки на плане, и она станет началом маршрута. GPS внутри здания неточен и нужен только как подсказка.'],
    ],
  },
  {
    id: 'search', tone: 'violet', icon: Search, title: 'Поиск',
    lead: 'Поиск понимает номера, названия и слова-подсказки: «еда» найдёт столовую, «дрон» — лабораторию БПЛА.',
    items: [
      ['Из любого места', 'Кнопка «Найти место» в шапке или клавиша K открывают окно поиска.'],
      ['На главной', 'Поле поиска на первом экране сразу показывает подходящие места.'],
      ['Результат', 'Нажмите на найденное место — откроется карта с выделенным помещением.'],
    ],
  },
  {
    id: 'route', tone: 'green', icon: Route, title: 'Маршрут',
    lead: 'Маршрут строится только по нарисованным коридорам и дверям, без «прохода сквозь стены».',
    items: [
      ['Откуда и куда', 'Выберите старт (вход, кабинет или вашу метку) и цель. Поля ищут по номеру и названию.'],
      ['Варианты', 'Между этажами сайт предлагает лифт и разные лестницы и отмечает самый быстрый путь.'],
      ['Пошагово', 'Кнопки «Назад» и «Дальше» ведут по шагам, а точка на плане показывает, где вы сейчас.'],
      ['Озвучка', 'Два записанных голоса «Логос» — женский и мужской. На iPhone сначала нажмите «Прослушать».'],
      ['Вид', '3D-навигатор поворачивает план по ходу движения, вид «Сверху» (2D) показывает оба этажа рядом.'],
    ],
  },
  {
    id: 'rooms', tone: 'coral', icon: List, title: 'Справочник кабинетов',
    lead: 'Полный список помещений с фильтрами — удобно, когда номер неизвестен.',
    items: [
      ['Фильтры', 'Этаж и категория: учебные кабинеты, мастерские и лаборатории, общие пространства, администрация.'],
      ['На карте', 'Кнопка «Смотреть на карте» открывает план с выделенным помещением.'],
    ],
  },
  {
    id: 'spaces', tone: 'amber', icon: Star, title: 'Пространства',
    lead: 'Библиотека, столовая, актовый зал и другие общие места с коротким описанием и переходом на карту.',
    items: [],
  },
  {
    id: 'games', tone: 'pink', icon: Gamepad2, title: 'Игры',
    lead: 'Три коротких режима, чтобы запомнить план без зубрёжки. Лучшие результаты сохраняются в браузере.',
    items: [
      ['Узнай этаж', 'Пять вопросов: на каком этаже находится помещение.'],
      ['Найди по описанию', 'Загадка-подсказка — найдите место на плане.'],
      ['Забег по карте', 'За 60 секунд найдите как можно больше мест по названию.'],
    ],
  },
  {
    id: 'settings', tone: 'indigo', icon: Palette, title: 'Тема, язык и телефон',
    lead: 'Сайт одинаково работает на компьютере и телефоне.',
    items: [
      ['Тёмная тема', 'Кнопка с луной в шапке; на телефоне — в меню.'],
      ['Язык', 'Русский и английский переключаются в меню (кнопка с тремя полосками).'],
      ['Приложение', 'Приложение «ЛОГОС» для Android сейчас на техническом обслуживании и пока не поддерживается. Сайт работает на телефоне так же, как на компьютере.'],
    ],
  },
]

const shortcuts = [
  ['K', 'Открыть поиск'],
  ['Esc', 'Закрыть окно, меню или обучение'],
  ['→  /  Enter', 'Следующий шаг обучения'],
  ['←', 'Предыдущий шаг обучения'],
  ['Tab', 'Перейти к следующему элементу; Enter или пробел — нажать'],
]

const faq = [
  ['Схема совпадает со зданием?', 'Это ориентир. Проходы могут быть временно закрыты — следуйте указателям и уточняйте у сотрудников.'],
  ['Почему GPS показывает не тот кабинет?', 'Спутниковый сигнал внутри здания слабый, а этаж телефон не определяет. Надёжнее поставить метку вручную.'],
  ['Где сообщить об ошибке?', 'Напишите команде проекта — контакты на странице «О проекте». Укажите этаж и номер кабинета.'],
  ['Какие данные сохраняет сайт?', 'Только настройки в вашем браузере. Подробности — в политике конфиденциальности.'],
]

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined
    const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean)
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActive(visible[0].target.id)
    }, { rootMargin: '-90px 0px -60% 0px' })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [ids])
  return active
}

const tocIds = [...sections.map((section) => section.id), 'shortcuts', 'faq', 'privacy']

export default function DocsPage() {
  const active = useActiveSection(tocIds)
  return <>
    <section className="docs-hero">
      <div className="container docs-hero-inner">
        <div className="docs-hero-copy">
          <span className="eyebrow"><i className="eyebrow-dot" />Документация</span>
          <h1>Как пользоваться <em>путеводителем.</em></h1>
          <p>Все разделы сайта по порядку: карта, поиск, маршруты, справочник и игры. Если удобнее смотреть, а не читать, — пройдите интерактивное обучение.</p>
          <div className="docs-hero-actions">
            <button type="button" className="button button-primary docs-tour-button" onClick={startTour}><Sparkles size={16} /> Пройти обучение</button>
            <a className="docs-hero-link" href="#start">Читать с начала <ArrowRight size={14} /></a>
          </div>
        </div>
        <ol className="docs-hero-steps" aria-label="Три шага">
          <li data-tone="violet"><Search size={18} /><span><strong>Найдите</strong> кабинет по номеру или названию</span></li>
          <li data-tone="teal"><Layers size={18} /><span><strong>Посмотрите</strong> его на плане этажа</span></li>
          <li data-tone="green"><Route size={18} /><span><strong>Дойдите</strong> по маршруту с подсказками</span></li>
        </ol>
      </div>
    </section>

    <div className="container docs-layout">
      <nav className="docs-toc" aria-label="Разделы документации">
        <span className="docs-toc-title"><BookOpen size={14} /> Разделы</span>
        <ol>
          {sections.map((section) => <li key={section.id}><a href={`#${section.id}`} data-tone={section.tone} aria-current={active === section.id ? 'true' : undefined}>{section.title}</a></li>)}
          <li><a href="#shortcuts" aria-current={active === 'shortcuts' ? 'true' : undefined}>Горячие клавиши</a></li>
          <li><a href="#faq" aria-current={active === 'faq' ? 'true' : undefined}>Частые вопросы</a></li>
          <li><a href="#privacy" aria-current={active === 'privacy' ? 'true' : undefined}>Данные и cookie</a></li>
        </ol>
      </nav>

      <div className="docs-content">
        {sections.map((section) => {
          const Icon = section.icon
          return <Reveal as="article" key={section.id} id={section.id} className="docs-section" data-tone={section.tone}>
            <header className="docs-section-head">
              <span className="docs-section-icon" aria-hidden="true"><Icon size={20} /></span>
              <h2>{section.title}</h2>
            </header>
            <p className="docs-lead">{section.lead}</p>
            {section.items.length > 0 && <dl className="docs-items">
              {section.items.map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}
            </dl>}
            {section.id === 'spaces' && <Link className="docs-inline-link" to="/services">Открыть «Пространства» <ArrowRight size={14} /></Link>}
          </Reveal>
        })}

        <Reveal as="article" id="shortcuts" className="docs-section" data-tone="blue">
          <header className="docs-section-head">
            <span className="docs-section-icon" aria-hidden="true"><Keyboard size={20} /></span>
            <h2>Горячие клавиши</h2>
          </header>
          <table className="docs-shortcuts">
            <tbody>{shortcuts.map(([keys, action]) => <tr key={keys}><th scope="row">{keys.split('  /  ').map((key, position) => <span key={key}>{position > 0 && ' / '}<kbd>{key}</kbd></span>)}</th><td>{action}</td></tr>)}</tbody>
          </table>
        </Reveal>

        <Reveal as="article" id="faq" className="docs-section" data-tone="violet">
          <header className="docs-section-head">
            <span className="docs-section-icon" aria-hidden="true"><BookOpen size={20} /></span>
            <h2>Частые вопросы</h2>
          </header>
          <div className="docs-faq">
            {faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </Reveal>

        <Reveal as="article" id="privacy" className="docs-section" data-tone="amber">
          <header className="docs-section-head">
            <span className="docs-section-icon" aria-hidden="true"><Cookie size={20} /></span>
            <h2>Данные и cookie</h2>
          </header>
          <p className="docs-lead">Сайт работает без регистрации и не собирает персональные данные. Настройки хранятся только в вашем браузере, от них можно отказаться в любой момент.</p>
          <Link className="docs-inline-link" to="/privacy">Политика конфиденциальности <ArrowRight size={14} /></Link>
        </Reveal>
      </div>
    </div>
  </>
}
