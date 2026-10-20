// Логика простых игр «на перемену» (2048, змейка, крестики-нолики) без React:
// чистые функции, которые легко проверить тестами. Случайность передаётся
// параметром rng, чтобы тесты были повторяемыми.

// ---------- 2048 ----------

export const SIZE_2048 = 4

export function emptyBoard(size = SIZE_2048) {
  return Array.from({ length: size }, () => Array(size).fill(0))
}

export function addTile(board, rng = Math.random) {
  const free = []
  board.forEach((row, y) => row.forEach((value, x) => { if (!value) free.push([y, x]) }))
  if (!free.length) return board
  const [y, x] = free[Math.floor(rng() * free.length)]
  const next = board.map((row) => [...row])
  next[y][x] = rng() < 0.9 ? 2 : 4
  return next
}

export function newGame2048(rng = Math.random) {
  return addTile(addTile(emptyBoard(), rng), rng)
}

// Сдвиг одной строки влево: склеиваем равные соседние плитки, каждую — один раз за ход.
function slideRow(row) {
  const tiles = row.filter(Boolean)
  const out = []
  let gained = 0
  for (let index = 0; index < tiles.length; index += 1) {
    if (tiles[index] === tiles[index + 1]) {
      out.push(tiles[index] * 2)
      gained += tiles[index] * 2
      index += 1
    } else out.push(tiles[index])
  }
  while (out.length < row.length) out.push(0)
  return { row: out, gained }
}

const transpose = (board) => board[0].map((_, x) => board.map((row) => row[x]))
const mirror = (board) => board.map((row) => [...row].reverse())

export function move2048(board, direction) {
  let view = board
  if (direction === 'right') view = mirror(board)
  if (direction === 'up') view = transpose(board)
  if (direction === 'down') view = mirror(transpose(board))
  let gained = 0
  let slid = view.map((row) => { const result = slideRow(row); gained += result.gained; return result.row })
  if (direction === 'right') slid = mirror(slid)
  if (direction === 'up') slid = transpose(slid)
  if (direction === 'down') slid = transpose(mirror(slid))
  const moved = slid.some((row, y) => row.some((value, x) => value !== board[y][x]))
  return { board: slid, moved, gained }
}

export function canMove2048(board) {
  return ['left', 'right', 'up', 'down'].some((direction) => move2048(board, direction).moved)
}

export const maxTile = (board) => Math.max(...board.flat())

// ---------- Змейка ----------

export const SNAKE_GRID = 16
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }

function placeFood(snake, grid, rng) {
  const busy = new Set(snake.map(({ x, y }) => `${x},${y}`))
  const free = []
  for (let y = 0; y < grid; y += 1) for (let x = 0; x < grid; x += 1) if (!busy.has(`${x},${y}`)) free.push({ x, y })
  return free.length ? free[Math.floor(rng() * free.length)] : null
}

export function newSnake(rng = Math.random, grid = SNAKE_GRID) {
  const mid = Math.floor(grid / 2)
  const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }]
  return { grid, snake, dir: 'right', queued: 'right', food: placeFood(snake, grid, rng), alive: true, score: 0 }
}

// Поворот запоминается до следующего шага; развернуться на 180° нельзя.
export function turnSnake(state, direction) {
  if (!DIRS[direction] || direction === OPPOSITE[state.dir]) return state
  return { ...state, queued: direction }
}

export function stepSnake(state, rng = Math.random) {
  if (!state.alive) return state
  const dir = state.queued
  const [dx, dy] = DIRS[dir]
  const head = { x: state.snake[0].x + dx, y: state.snake[0].y + dy }
  const eats = state.food && head.x === state.food.x && head.y === state.food.y
  const body = eats ? state.snake : state.snake.slice(0, -1)
  const hitsWall = head.x < 0 || head.y < 0 || head.x >= state.grid || head.y >= state.grid
  const hitsSelf = body.some(({ x, y }) => x === head.x && y === head.y)
  if (hitsWall || hitsSelf) return { ...state, dir, alive: false }
  const snake = [head, ...body]
  return { ...state, dir, snake, food: eats ? placeFood(snake, state.grid, rng) : state.food, score: state.score + (eats ? 1 : 0) }
}

// ---------- Крестики-нолики ----------

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

export function tttWinner(cells) {
  for (const line of LINES) {
    const [a, b, c] = line
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return { player: cells[a], line }
  }
  return cells.every(Boolean) ? { player: null, line: [] } : null
}

function minimax(cells, turn, me) {
  const result = tttWinner(cells)
  if (result) return result.player === me ? 10 : result.player ? -10 : 0
  const other = turn === 'X' ? 'O' : 'X'
  const scores = cells.map((value, index) => {
    if (value) return null
    const next = [...cells]
    next[index] = turn
    return minimax(next, other, me) * 0.9
  }).filter((score) => score !== null)
  return turn === me ? Math.max(...scores) : Math.min(...scores)
}

// Ход компьютера. На «лёгком» уровне он иногда ходит случайно — так его можно обыграть.
export function tttMove(cells, me, level = 'hard', rng = Math.random) {
  const free = cells.map((value, index) => value ? -1 : index).filter((index) => index >= 0)
  if (!free.length) return -1
  if (level === 'easy' && rng() < 0.45) return free[Math.floor(rng() * free.length)]
  const other = me === 'X' ? 'O' : 'X'
  let best = free[0]
  let bestScore = -Infinity
  for (const index of free) {
    const next = [...cells]
    next[index] = me
    const score = minimax(next, other, me)
    if (score > bestScore) { bestScore = score; best = index }
  }
  return best
}
