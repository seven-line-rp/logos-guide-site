import { useEffect, useState } from 'react'
import { ArrowRight, Award, Check, Compass, MapPin, RotateCcw, Target, Timer, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { games, rooms } from '../data'
import FloorMap from '../components/FloorMap'
import { PageHeading, Reveal, SectionLabel } from '../components/Primitives'

const QUIZ_LENGTH = 5
const RIDDLE_LENGTH = 5
const SPEED_SECONDS = 60

// Названия, которые встречаются на плане только один раз: по ним можно спросить без номера кабинета.
const uniqueRooms = rooms.filter((room) => rooms.filter((item) => item.name === room.name).length === 1)

// Загадки: описание места без названия. Порядок и выбор при каждом раунде новые.
const riddles = [
  { id: 'library-214', text: 'Тихое место, где можно взять книгу почитать или заняться в тишине.' },
  { id: 'canteen', text: 'Здесь перекусывают между парами, пока очередь не выросла.' },
  { id: 'auditorium-104', text: 'Большой зал со сценой, где проходят собрания и концерты.' },
  { id: 'physics-211', text: 'Кабинет, где разбирают законы движения, силы и энергии.' },
  { id: 'simulator-114', text: 'Тренажёрный класс, где учатся управлять беспилотниками, не поднимая их в небо.' },
  { id: 'psychologist-224', text: 'Здесь можно поговорить о трудностях и попросить поддержку.' },
  { id: 'changing-room', text: 'Место, где оставляют верхнюю одежду перед занятиями.' },
  { id: 'director-149', text: 'Кабинет руководителя колледжа, который принимает посетителей по записи.' },
  { id: 'uav-lab-209', text: 'Лаборатория на втором этаже, где собирают и проверяют беспилотные аппараты.' },
  { id: 'informatics-222', text: 'Класс с компьютерами, где пишут программы и работают с сетями.' },
  { id: 'academic-office', text: 'Здесь отвечают на вопросы о расписании и учебном процессе.' },
  { id: 'entrance-1', text: 'Точка, с которой начинается большинство маршрутов по колледжу.' },
  { id: 'meteorology-236', text: 'Лаборатория, где изучают погоду и климат.' },
  { id: 'electrical-lab-207', text: 'Лаборатория на втором этаже, где проверяют электрические схемы.' },
]
const riddleRooms = riddles.map((item) => ({ ...item, room: rooms.find((room) => room.id === item.id) })).filter((item) => item.room)

function shuffle(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

function makeQuizRound() {
  return shuffle(uniqueRooms).slice(0, QUIZ_LENGTH).map((room) => ({ room, options: shuffle([1, 2]) }))
}

function makeRiddleRound() {
  return shuffle(riddleRooms).slice(0, RIDDLE_LENGTH)
}

function pickOther(pool, previousId) {
  const choices = pool.filter((room) => room.id !== previousId)
  return choices[Math.floor(Math.random() * choices.length)]
}

function ModeIcon({ id }) {
  if (id === 'floor-quiz') return <Compass size={18} />
  if (id === 'speed-run') return <Timer size={18} />
  return <Target size={18} />
}


function Confetti() {
  const pieces = Array.from({ length: 28 })
  return <div className="confetti-wrap" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    {pieces.map((_, i) => {
      const left = Math.random() * 100
      const delay = Math.random() * 0.4
      const dx = (Math.random() - 0.5) * 200
      const color = ['#245ce5', '#ffd267', '#1454ee', '#0d1c3b'][i % 4]
      return <span key={i} className="confetti-piece" style={{ left: left + '%', top: '10%', animationDelay: delay + 's', '--dx': dx + 'px', background: color }} />
    })}
  </div>
}

export default function GamesPage() {
  const [mode, setMode] = useState(games[0].id)
  const [quizRound, setQuizRound] = useState(makeQuizRound)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState(null)
  const [quizScore, setQuizScore] = useState(0)
  const [riddleRound, setRiddleRound] = useState(makeRiddleRound)
  const [riddleIndex, setRiddleIndex] = useState(0)
  const [riddleFeedback, setRiddleFeedback] = useState('')
  const [riddleScore, setRiddleScore] = useState(0)
  const [speedTarget, setSpeedTarget] = useState(null)
  const [speedRunning, setSpeedRunning] = useState(false)
  const [speedLeft, setSpeedLeft] = useState(SPEED_SECONDS)
  const [speedScore, setSpeedScore] = useState(0)
  const [speedMiss, setSpeedMiss] = useState(0)
  const [speedFeedback, setSpeedFeedback] = useState('')
  const [bestQuiz, setBestQuiz] = useState(() => Number(localStorage.getItem('game-quiz-best') || 0))
  const [bestSpeed, setBestSpeed] = useState(() => Number(localStorage.getItem('game-speed-best') || 0))

  const quizRoom = quizRound[quizIndex]?.room
  const quizFinished = quizIndex >= quizRound.length
  useEffect(() => {
    if (quizFinished && quizScore > bestQuiz) {
      setBestQuiz(quizScore)
      localStorage.setItem('game-quiz-best', String(quizScore))
    }
  }, [quizFinished, quizScore, bestQuiz])
  const riddle = riddleRound[riddleIndex]
  const riddleFinished = riddleIndex >= riddleRound.length
  const riddleFound = riddleFeedback === 'ok'
  const speedFinished = speedLeft === 0
  useEffect(() => {
    if (speedFinished && speedScore > bestSpeed) {
      setBestSpeed(speedScore)
      localStorage.setItem('game-speed-best', String(speedScore))
    }
  }, [speedFinished, speedScore, bestSpeed])

  // Таймер забега: тикает только пока игра идёт и время не вышло.
  useEffect(() => {
    if (!speedRunning || speedFinished) return undefined
    const timer = window.setInterval(() => setSpeedLeft((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [speedRunning, speedFinished])

  const answerFloor = (answer) => {
    if (quizAnswer !== null || quizFinished) return
    const correct = Number(answer) === quizRoom.floor
    setQuizAnswer({ value: Number(answer), correct })
    if (correct) setQuizScore((score) => score + 1)
  }
  const nextQuiz = () => { setQuizIndex((index) => index + 1); setQuizAnswer(null) }
  const restartQuiz = () => { setQuizRound(makeQuizRound()); setQuizIndex(0); setQuizAnswer(null); setQuizScore(0) }

  const onRiddleSelect = (room) => {
    if (riddleFound || riddleFinished) return
    if (room.id === riddle.room.id) { setRiddleFeedback('ok'); setRiddleScore((score) => score + 1) }
    else setRiddleFeedback(`miss:${room.id}`)
  }
  const nextRiddle = () => { setRiddleIndex((index) => index + 1); setRiddleFeedback('') }
  const restartRiddles = () => { setRiddleRound(makeRiddleRound()); setRiddleIndex(0); setRiddleFeedback(''); setRiddleScore(0) }

  const startSpeed = () => {
    setSpeedScore(0); setSpeedMiss(0); setSpeedLeft(SPEED_SECONDS); setSpeedFeedback('')
    setSpeedTarget(pickOther(uniqueRooms, null))
    setSpeedRunning(true)
  }
  const onSpeedSelect = (room) => {
    if (!speedRunning || speedFinished || !speedTarget) return
    if (room.id === speedTarget.id) {
      setSpeedScore((score) => score + 1)
      setSpeedFeedback('ok')
      setSpeedTarget(pickOther(uniqueRooms, speedTarget.id))
    } else {
      setSpeedMiss((count) => count + 1)
      setSpeedFeedback('miss')
    }
  }
  const stopSpeed = () => { setSpeedRunning(false); setSpeedLeft(0) }

  return <>
    <PageHeading eyebrow="Игры" title={<>Потренируйтесь<br /><em>по карте.</em></>} description="Три режима: угадайте этаж, найдите место по загадке или успейте за минуту. Каждый раунд собирается заново." />

    <section className="games-section container"><div className="game-mode-tabs" role="tablist" aria-label="Выберите игру">{games.map((item) => <button key={item.id} role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'game-mode-tab game-mode-active' : 'game-mode-tab'} onClick={() => setMode(item.id)}><span className="game-mode-icon"><ModeIcon id={item.id} /></span><span><small>{item.tag}</small><strong>{item.title}</strong><em>{item.description}</em></span><ArrowRight size={16} /></button>)}</div>

      {mode === 'floor-quiz' && <Reveal className="game-panel" key="quiz"><div className="game-panel-head"><div><SectionLabel index="01">УЗНАЙ ЭТАЖ</SectionLabel><h2>{quizFinished ? 'Раунд завершён!' : 'На каком этаже это место?'}</h2></div><div className="game-score"><Award size={17} /><span><strong>{quizScore}</strong> / {quizRound.length}</span></div></div>
        {!quizFinished ? <><div className="game-progress-line"><span style={{ width: `${quizIndex / quizRound.length * 100}%` }} /></div><div className="quiz-question"><span className="quiz-question-index">ВОПРОС {String(quizIndex + 1).padStart(2, '0')} / {String(quizRound.length).padStart(2, '0')}</span><h3>{quizRoom.name}</h3><p>Без номера — только по названию.</p></div><div className="quiz-options" role="group" aria-label="Выберите этаж">{quizRound[quizIndex].options.map((floor) => { const picked = quizAnswer?.value === floor; const correct = quizAnswer && floor === quizRoom.floor; return <button key={floor} className={`quiz-option ${picked ? 'quiz-option-picked' : ''} ${quizAnswer && correct ? 'quiz-option-correct' : ''} ${picked && !quizAnswer.correct ? 'quiz-option-wrong' : ''}`} onClick={() => answerFloor(floor)} disabled={quizAnswer !== null}><span className="quiz-option-number">0{floor}</span><span>{floor === 1 ? 'Первый этаж' : 'Второй этаж'}</span>{quizAnswer && correct && <Check size={16} />}{picked && !quizAnswer.correct && <X size={16} />}</button> })}</div>{quizAnswer && <div className={`quiz-feedback game-feedback-pop ${quizAnswer.correct ? 'quiz-feedback-correct' : 'quiz-feedback-wrong'}`} role="status"><span>{quizAnswer.correct ? 'Верно!' : `Почти — это ${quizRoom.floor} этаж.`}</span><button onClick={nextQuiz}>{quizIndex === quizRound.length - 1 ? 'Итоги' : 'Следующий вопрос'} <ArrowRight size={14} /></button></div>}</> : <div className="game-finish" style={{ position: 'relative' }}><Confetti /><span className="game-finish-medal"><Award size={27} /></span><span className="eyebrow">ВАШ РЕЗУЛЬТАТ</span><strong>{quizScore}<small> / {quizRound.length}</small></strong><p>{quizScore === quizRound.length ? 'Безупречно! Ты уже почти местный.' : quizScore >= 3 ? 'Хороший ориентир — с каждым разом будет легче.' : 'Теперь карта точно запомнится лучше.'}</p><p className="game-best">Лучший результат: {bestQuiz} / {quizRound.length}{quizScore === bestQuiz && quizScore > 0 ? " · новый рекорд!" : ""}</p><button className="button button-primary" onClick={restartQuiz}><RotateCcw size={15} /> Новый раунд</button></div>}
      </Reveal>}

      {mode === 'find-room' && <Reveal className="game-panel find-game-panel" key="riddle"><div className="game-panel-head"><div><SectionLabel index="02">ЗАГАДКИ</SectionLabel><h2>{riddleFinished ? 'Все загадки разгаданы!' : riddleFound ? 'Верно, это оно!' : 'Найдите место по описанию'}</h2></div><div className="game-score"><Target size={17} /><span><strong>{riddleScore}</strong> / {riddleRound.length}</span></div></div>
        {!riddleFinished ? <><div className="find-target-card"><span className="find-target-symbol"><Target size={18} /></span><span><small>ЗАГАДКА {riddleIndex + 1} ИЗ {riddleRound.length}</small><strong>{riddle.text}</strong></span></div><div className="find-feedback-line game-feedback-pop" role="status">{riddleFound ? <><Check size={15} /> Верно! {riddle.room.name} — на плане подсвечено.</> : riddleFeedback.startsWith('miss') ? <><X size={15} /> Не то место. Попробуйте ещё раз.</> : <><MapPin size={15} /> Нажмите на помещение, которое подходит под описание.</>}</div><div className="find-map-toolbar"><span>ЭТАЖ {riddle.room.floor} · НАЗВАНИЯ СКРЫТЫ</span>{riddleFound && <button onClick={nextRiddle}>Следующая загадка <ArrowRight size={14} /></button>}</div><FloorMap floor={riddle.room.floor} compact showLabels={false} showDoorMarks={false} gameTargetId="" gameFeedback={riddleFound ? riddle.room.id : ''} onSelect={onRiddleSelect} /></> : <div className="game-finish" style={{ position: 'relative' }}><Confetti /><span className="game-finish-medal"><Target size={27} /></span><span className="eyebrow">ТОЧНОСТЬ</span><strong>{riddleScore}<small> / {riddleRound.length}</small></strong><p>Хороший результат! Теперь вы умеете читать план по описанию.</p><button className="button button-primary" onClick={restartRiddles}><RotateCcw size={15} /> Новые загадки</button></div>}
      </Reveal>}

      {mode === 'speed-run' && <Reveal className="game-panel" key="speed"><div className="game-panel-head"><div><SectionLabel index="03">НА ВРЕМЯ</SectionLabel><h2>{speedFinished ? 'Время вышло!' : speedRunning ? 'Успевайте!' : 'Готовы?'}</h2></div><div className="game-score"><Timer size={17} /><span><strong>{speedScore}</strong> найдено</span></div></div>
        {!speedRunning && !speedFinished && <div className="speed-start-wrap"><span className="game-finish-medal"><Timer size={27} /></span><p>На экране появляется название места. Нажмите его на плане. Ошибки не штрафуются, но тратят время. У вас {SPEED_SECONDS} секунд.</p><button className="button button-primary" onClick={startSpeed}>Начать забег <ArrowRight size={15} /></button></div>}
        {(speedRunning || speedFinished) && <><div className={`timer-bar ${speedLeft <= 10 ? 'timer-low' : ''}`}><span style={{ width: `${speedLeft / SPEED_SECONDS * 100}%` }} /></div>
          <div className="speed-stats"><div><small>Осталось</small><strong>{speedLeft} с</strong></div><div><small>Найдено</small><strong>{speedScore}</strong></div><div><small>Ошибки</small><strong>{speedMiss}</strong></div></div>
          {speedRunning && !speedFinished && speedTarget && <><div className="speed-target">{speedTarget.name}</div><div className="find-feedback-line game-feedback-pop" role="status">{speedFeedback === 'ok' ? <><Check size={15} /> Есть! Следующее место.</> : speedFeedback === 'miss' ? <><X size={15} /> Мимо — ищите дальше.</> : <><MapPin size={15} /> Нажмите это место на плане.</>}</div><FloorMap floor={speedTarget.floor} compact showLabels={false} showDoorMarks={false} onSelect={onSpeedSelect} /><div className="find-map-toolbar"><span>ЭТАЖ {speedTarget.floor}</span><button onClick={stopSpeed}>Закончить досрочно</button></div></>}
          {speedFinished && <div className="game-finish" style={{ position: 'relative' }}><Confetti /><span className="game-finish-medal"><Timer size={27} /></span><span className="eyebrow">РЕЗУЛЬТАТ ЗАБЕГА</span><strong>{speedScore}<small> мест</small></strong><p>{speedScore >= 12 ? 'Отличный результат: вы знаете колледж как свои пять пальцев.' : speedScore >= 6 ? 'Неплохо. Попробуйте ещё раз и поставьте рекорд.' : 'Первый забег — самый сложный. Повторите и станет проще.'}</p><p className="game-best">Рекорд: {bestSpeed} мест{speedScore === bestSpeed && speedScore > 0 ? " · новый рекорд!" : ""}</p><button className="button button-primary" onClick={startSpeed}><RotateCcw size={15} /> Ещё раз</button></div>}
        </>}
      </Reveal>}
    </section>

    <section className="games-bottom container"><span className="games-bottom-icon"><MapPin size={17} /></span><p>После игры откройте карту и попробуйте найти кабинет в самом колледже.</p><Link to="/map">Карта этажей <ArrowRight size={14} /></Link></section>
  </>
}
