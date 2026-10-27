import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Grid2x2, Pause, Play, RotateCcw, Hash, X as Cross, Circle, Waypoints } from 'lucide-react'
import { canMove2048, maxTile, move2048, newGame2048, addTile, newSnake, stepSnake, turnSnake, SNAKE_GRID, tttMove, tttWinner } from '../arcade.js'
import { storageGet, storageSet } from '../storage.js'

const KEY_DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', ц: 'up', ы: 'down', ф: 'left', в: 'right' }

function useBest(key) {
  const [best, setBest] = useState(() => Number(storageGet(key) || 0))
  const offer = useCallback((value) => setBest((current) => {
    if (value <= current) return current
    storageSet(key, String(value))
    return value
  }), [key])
  return [best, offer]
}

// Свайп по полю: направление по наибольшему смещению пальца.
function useSwipe(onSwipe) {
  const start = useRef(null)
  return {
    onTouchStart: (event) => { const touch = event.touches[0]; start.current = { x: touch.clientX, y: touch.clientY } },
    onTouchEnd: (event) => {
      if (!start.current) return
      const touch = event.changedTouches[0]
      const dx = touch.clientX - start.current.x
      const dy = touch.clientY - start.current.y
      start.current = null
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
    },
  }
}

function Pad({ onMove, label }) {
  return <div className="arcade-pad" role="group" aria-label={label}>
    <button onClick={() => onMove('up')} aria-label="Вверх"><ArrowUp size={18} /></button>
    <button onClick={() => onMove('left')} aria-label="Влево"><ArrowLeft size={18} /></button>
    <button onClick={() => onMove('down')} aria-label="Вниз"><ArrowDown size={18} /></button>
    <button onClick={() => onMove('right')} aria-label="Вправо"><ArrowRight size={18} /></button>
  </div>
}

function Score({ label, value }) {
  return <div className="arcade-score"><small>{label}</small><strong>{value}</strong></div>
}

function Game2048() {
  const [game, setGame] = useState(() => ({ board: newGame2048(), score: 0 }))
  const [best, offerBest] = useBest('game-2048-best')
  const over = !canMove2048(game.board)
  const won = maxTile(game.board) >= 2048
  const fieldRef = useRef(null)
  const move = useCallback((direction) => setGame((current) => {
    const result = move2048(current.board, direction)
    if (!result.moved) return current
    return { board: addTile(result.board), score: current.score + result.gained }
  }), [])
  useEffect(() => { offerBest(game.score) }, [game.score, offerBest])
  const swipe = useSwipe(move)
  const onKey = (event) => { const direction = KEY_DIRS[event.key]; if (direction) { event.preventDefault(); move(direction) } }
  const restart = () => { setGame({ board: newGame2048(), score: 0 }); fieldRef.current?.focus() }

  return <div className="arcade-game">
    <div className="arcade-head"><Score label="Счёт" value={game.score} /><Score label="Рекорд" value={best} /><button className="arcade-ghost" onClick={restart}><RotateCcw size={15} /> Заново</button></div>
    <div ref={fieldRef} className="g2048-board" tabIndex={0} onKeyDown={onKey} {...swipe} aria-label="Поле 2048. Двигайте плитки стрелками или свайпом">
      {game.board.flat().map((value, index) => <span key={index} className={`g2048-cell ${value ? `g2048-v${Math.min(value, 4096)}` : ''}`}>{value || ''}</span>)}
      {(over || won) && <div className="arcade-overlay" role="status"><strong>{won ? 'Есть 2048!' : 'Ходов больше нет'}</strong><span>Счёт: {game.score}</span><button className="button button-primary" onClick={restart}><RotateCcw size={15} /> Ещё раз</button></div>}
    </div>
    <p className="arcade-hint">Стрелки, WASD или свайп. Одинаковые плитки складываются.</p>
    <Pad onMove={move} label="Управление 2048" />
  </div>
}

function SnakeGame() {
  const [state, setState] = useState(() => newSnake())
  const [running, setRunning] = useState(false)
  const [best, offerBest] = useBest('game-snake-best')
  const fieldRef = useRef(null)
  const speed = Math.max(70, 150 - state.score * 4)
  useEffect(() => {
    if (!running || !state.alive) return undefined
    const timer = window.setInterval(() => setState((current) => stepSnake(current)), speed)
    return () => window.clearInterval(timer)
  }, [running, state.alive, speed])
  useEffect(() => { offerBest(state.score) }, [state.score, offerBest])
  const turn = useCallback((direction) => { setState((current) => turnSnake(current, direction)); setRunning(true) }, [])
  const swipe = useSwipe(turn)
  const restart = () => { setState(newSnake()); setRunning(true); fieldRef.current?.focus() }
  const onKey = (event) => {
    if (event.key === ' ') { event.preventDefault(); if (state.alive) setRunning((value) => !value); else restart(); return }
    const direction = KEY_DIRS[event.key]
    if (direction) { event.preventDefault(); turn(direction) }
  }
  const body = new Map(state.snake.map(({ x, y }, index) => [`${x},${y}`, index]))

  return <div className="arcade-game">
    <div className="arcade-head"><Score label="Яблоки" value={state.score} /><Score label="Рекорд" value={best} />{state.alive ? <button className="arcade-ghost" onClick={() => { setRunning((value) => !value); fieldRef.current?.focus() }}>{running ? <><Pause size={15} /> Пауза</> : <><Play size={15} /> Играть</>}</button> : <button className="arcade-ghost" onClick={restart}><RotateCcw size={15} /> Заново</button>}</div>
    <div ref={fieldRef} className="snake-board" style={{ '--grid': SNAKE_GRID }} tabIndex={0} onKeyDown={onKey} {...swipe} aria-label="Поле змейки. Управление стрелками или свайпом, пробел — пауза">
      {Array.from({ length: SNAKE_GRID * SNAKE_GRID }, (_, index) => {
        const key = `${index % SNAKE_GRID},${Math.floor(index / SNAKE_GRID)}`
        const part = body.get(key)
        const food = state.food && key === `${state.food.x},${state.food.y}`
        return <span key={index} className={part === 0 ? 'snake-head' : part !== undefined ? 'snake-body' : food ? 'snake-food' : undefined} />
      })}
      {!state.alive && <div className="arcade-overlay" role="status"><strong>Врезались!</strong><span>Яблок: {state.score}</span><button className="button button-primary" onClick={restart}><RotateCcw size={15} /> Ещё раз</button></div>}
      {state.alive && !running && <button className="arcade-overlay arcade-overlay-soft" onClick={() => { setRunning(true); fieldRef.current?.focus() }}><Play size={22} /><span>{state.score ? 'Продолжить' : 'Нажмите, чтобы начать'}</span></button>}
    </div>
    <p className="arcade-hint">Стрелки, WASD или свайп. Пробел — пауза. Чем длиннее змейка, тем она быстрее.</p>
    <Pad onMove={turn} label="Управление змейкой" />
  </div>
}

function TicTacToe() {
  const [cells, setCells] = useState(() => Array(9).fill(''))
  const [level, setLevel] = useState('easy')
  const [tally, setTally] = useState({ win: 0, draw: 0, loss: 0 })
  const result = tttWinner(cells)
  const play = (index) => {
    if (cells[index] || result) return
    const next = [...cells]
    next[index] = 'X'
    if (!tttWinner(next)) next[tttMove(next, 'O', level)] = 'O'
    setCells(next)
    const outcome = tttWinner(next)
    if (!outcome) return
    const key = outcome.player === 'X' ? 'win' : outcome.player === 'O' ? 'loss' : 'draw'
    setTally((current) => ({ ...current, [key]: current[key] + 1 }))
  }
  const restart = () => setCells(Array(9).fill(''))
  const message = !result ? 'Ваш ход: вы играете крестиками' : result.player === 'X' ? 'Победа!' : result.player === 'O' ? 'Компьютер выиграл' : 'Ничья'

  return <div className="arcade-game">
    <div className="arcade-head"><Score label="Победы" value={tally.win} /><Score label="Ничьи" value={tally.draw} /><Score label="Поражения" value={tally.loss} /></div>
    <div className="ttt-level" role="group" aria-label="Сложность">{[['easy', 'Лёгкий'], ['hard', 'Непобедимый']].map(([id, label]) => <button key={id} className={level === id ? 'directory-chip directory-chip-active' : 'directory-chip'} aria-pressed={level === id} onClick={() => { setLevel(id); restart() }}>{label}</button>)}</div>
    <div className="ttt-board" role="grid" aria-label="Поле крестиков-ноликов">
      {cells.map((value, index) => <button key={index} className={`ttt-cell ${result?.line.includes(index) ? 'ttt-win' : ''} ${value ? `ttt-${value}` : ''}`} onClick={() => play(index)} disabled={Boolean(value || result)} aria-label={value ? (value === 'X' ? 'Крестик' : 'Нолик') : `Клетка ${index + 1}`}>{value === 'X' ? <Cross size={34} strokeWidth={2.4} /> : value === 'O' ? <Circle size={30} strokeWidth={2.6} /> : null}</button>)}
    </div>
    <div className="ttt-status" role="status"><span>{message}</span>{result && <button className="arcade-ghost" onClick={restart}><RotateCcw size={15} /> Ещё партия</button>}</div>
  </div>
}

const ARCADE = [
  { id: '2048', title: '2048', note: 'Складывайте плитки', icon: Grid2x2, Game: Game2048 },
  { id: 'snake', title: 'Змейка', note: 'Классика с яблоками', icon: Waypoints, Game: SnakeGame },
  { id: 'ttt', title: 'Крестики-нолики', note: 'Против компьютера', icon: Hash, Game: TicTacToe },
]

export default function Arcade() {
  const [active, setActive] = useState(ARCADE[0].id)
  const current = ARCADE.find((item) => item.id === active)
  return <section className="arcade container" aria-labelledby="arcade-title">
    <div className="arcade-intro"><h2 id="arcade-title">Мини-игры</h2><p>2048, змейка и крестики-нолики. Рекорды сохраняются в браузере.</p></div>
    <div className="arcade-tabs" role="tablist" aria-label="Мини-игры">{ARCADE.map(({ id, title, note, icon: Icon }) => <button key={id} role="tab" aria-selected={active === id} className={active === id ? 'arcade-tab arcade-tab-active' : 'arcade-tab'} onClick={() => setActive(id)}><span className="arcade-tab-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{note}</small></span></button>)}</div>
    <div className="arcade-stage" role="tabpanel" aria-label={current.title}><current.Game key={current.id} /></div>
  </section>
}
