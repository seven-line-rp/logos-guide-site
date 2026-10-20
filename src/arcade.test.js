import test from 'node:test'
import assert from 'node:assert/strict'
import { addTile, canMove2048, emptyBoard, move2048, newSnake, stepSnake, tttMove, tttWinner, turnSnake } from './arcade.js'

const fixed = (...values) => { let index = 0; return () => values[index++ % values.length] }

test('2048: equal tiles merge once per move and score the sum', () => {
  const board = [[2, 2, 2, 2], [4, 0, 4, 8], [0, 0, 0, 0], [2, 0, 0, 2]]
  const { board: left, gained, moved } = move2048(board, 'left')
  assert.deepEqual(left, [[4, 4, 0, 0], [8, 8, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0]])
  assert.equal(gained, 4 + 4 + 8 + 4)
  assert.equal(moved, true)
  assert.deepEqual(move2048(board, 'right').board[0], [0, 0, 4, 4])
  assert.deepEqual(move2048(board, 'up').board.map((row) => row[0]), [2, 4, 2, 0])
  assert.deepEqual(move2048(board, 'down').board.map((row) => row[3]), [0, 2, 8, 2])
})

test('2048: a move that changes nothing is not a move, and a full stuck board ends the game', () => {
  const stuck = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]
  assert.equal(move2048(stuck, 'left').moved, false)
  assert.equal(canMove2048(stuck), false)
  assert.equal(canMove2048(emptyBoard()), false)
  assert.equal(canMove2048(addTile(emptyBoard(), fixed(0, 0.5))), true)
})

test('2048: new tiles land only on free cells', () => {
  const board = [[2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 0], [2, 2, 2, 2]]
  const next = addTile(board, fixed(0.3, 0.95))
  assert.equal(next[2][3], 4)
  assert.equal(board[2][3], 0)
})

test('snake grows on food, cannot reverse, and dies on walls and itself', () => {
  let state = newSnake(fixed(0))
  state = { ...state, food: { x: state.snake[0].x + 1, y: state.snake[0].y } }
  const before = state.snake.length
  state = stepSnake(state, fixed(0))
  assert.equal(state.snake.length, before + 1)
  assert.equal(state.score, 1)
  assert.equal(turnSnake(state, 'left').queued, state.queued)
  let runner = { ...state, food: null }
  for (let index = 0; index < 20 && runner.alive; index += 1) runner = stepSnake(runner)
  assert.equal(runner.alive, false)
  const loop = { grid: 8, snake: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }], dir: 'left', queued: 'down', food: null, alive: true, score: 0 }
  assert.equal(stepSnake(loop).alive, false)
})

test('tic-tac-toe: finds lines and draws, hard computer never misses a win or a block', () => {
  assert.deepEqual(tttWinner(['X', 'X', 'X', '', '', '', '', '', '']), { player: 'X', line: [0, 1, 2] })
  assert.equal(tttWinner(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']).player, null)
  assert.equal(tttWinner(['', '', '', '', '', '', '', '', '']), null)
  assert.equal(tttMove(['O', 'O', '', 'X', 'X', '', '', '', ''], 'O'), 2)
  assert.equal(tttMove(['X', 'X', '', '', 'O', '', '', '', ''], 'O'), 2)
})

test('tic-tac-toe: hard computer cannot be beaten', () => {
  // Перебираем все партии, где человек (X) ходит как угодно, а компьютер (O) играет лучшим ходом.
  const play = (cells) => {
    const result = tttWinner(cells)
    if (result) return assert.notEqual(result.player, 'X')
    cells.forEach((value, index) => {
      if (value) return
      const next = [...cells]
      next[index] = 'X'
      if (tttWinner(next)) return assert.notEqual(tttWinner(next).player, 'X')
      next[tttMove(next, 'O')] = 'O'
      play(next)
    })
  }
  play(Array(9).fill(''))
})
