import test from 'node:test'
import assert from 'node:assert/strict'
import { canon, checkAnswer, parseNextSpec, parseQuizSpec, quizScore } from './ai-quiz.js'

const spec = JSON.stringify({ title: 'Закрепление', tasks: [
  { type: 'choice', q: 'Коэффициент перед $O_2$?', options: ['1', '2', '3'], answer: 1, explain: 'Двойка.' },
  { type: 'input', q: 'Уравняйте $H_2 + O_2 \\to H_2O$', answer: '2 1 2', accept: ['2,1,2'], explain: '$2H_2 + O_2 \\to 2H_2O$' },
  { type: 'input', q: 'Сколько будет 0,5 + 0,25?', answer: '0.75' },
] })

test('quiz spec is validated, trimmed and capped at five tasks', () => {
  const quiz = parseQuizSpec(spec)
  assert.equal(quiz.title, 'Закрепление')
  assert.deepEqual(quiz.tasks.map((task) => task.type), ['choice', 'input', 'input'])
  assert.equal(quiz.tasks[0].answer, 1)
  const many = JSON.stringify({ tasks: Array.from({ length: 9 }, (_, i) => ({ q: `Вопрос ${i}`, answer: String(i) })) })
  assert.equal(parseQuizSpec(many).tasks.length, 5)
  // Негодные задания отбрасываются, а если годных нет — блок не считается заданием.
  const broken = JSON.stringify({ tasks: [{ type: 'choice', q: 'x', options: ['a', 'b'], answer: 5 }, { q: '', answer: '1' }, { q: 'ok', answer: '' }, null] })
  assert.equal(parseQuizSpec(broken), null)
  assert.equal(parseQuizSpec('не json'), null)
  assert.equal(parseQuizSpec('{"tasks": 5}'), null)
  assert.equal(parseQuizSpec(JSON.stringify({ tasks: [{ q: 'a', options: ['x', 'y'], answer: 1 }] })).tasks[0].type, 'choice')
})

test('LaTeX with single backslashes still parses', () => {
  const loose = '{"tasks":[{"type":"input","q":"Уравняйте $H_2 + O_2 \\to H_2O$ и $\\frac{1}{2}$","answer":"2 1 2"}]}'
  const quiz = parseQuizSpec(loose)
  assert.ok(quiz.tasks[0].q.includes('\\to') && quiz.tasks[0].q.includes('\\frac'))
})

test('markup and oversized strings from the model are only text and are cut', () => {
  const long = 'я'.repeat(5000)
  const quiz = parseQuizSpec(JSON.stringify({ title: '<img src=x onerror=alert(1)>', tasks: [{ q: long, answer: 'a', explain: long }] }))
  assert.equal(quiz.tasks[0].q.length, 500)
  assert.equal(quiz.tasks[0].explain.length, 600)
  assert.equal(quiz.title, '<img src=x onerror=alert(1)>', 'остаётся строкой: страница выводит её как текст')
})

test('answers are compared forgivingly', () => {
  const [choice, balance, sum] = parseQuizSpec(spec).tasks
  assert.equal(checkAnswer(choice, 1), true)
  assert.equal(checkAnswer(choice, 0), false)
  for (const ok of ['2 1 2', '2,1,2', ' 2, 1, 2 ', '2;1;2']) assert.equal(checkAnswer(balance, ok), true, ok)
  for (const bad of ['', '1 1 1', '212', '2 2 1']) assert.equal(checkAnswer(balance, bad), false, bad)
  for (const ok of ['0.75', '0,75', '.75'.replace('.', '0.'), ' 0,750 ']) assert.equal(checkAnswer(sum, ok), true, ok)
  assert.equal(checkAnswer(sum, '0.7'), false)
  const word = { type: 'input', q: 'q', answer: 'Железо', accept: [] }
  assert.equal(checkAnswer(word, 'железо'), true)
  assert.equal(checkAnswer(word, 'ЖЕЛЕЗО '), true)
  const formula = { type: 'input', q: 'q', answer: 'H₂SO₄', accept: [] }
  assert.equal(checkAnswer(formula, 'H2SO4'), true)
  assert.equal(checkAnswer(formula, 'h2so4'), true)
  assert.equal(canon('Ёлка'), 'елка')
})

test('follow-up questions and score', () => {
  assert.deepEqual(parseNextSpec('["Первый","Второй","Третий","Четвёртый"]'), ['Первый', 'Второй', 'Третий'])
  assert.equal(parseNextSpec('[]'), null)
  assert.equal(parseNextSpec('мусор'), null)
  assert.deepEqual(quizScore({ 0: 'ok', 1: 'bad', 2: 'ok' }, 3), { correct: 2, total: 3, done: true })
  assert.equal(quizScore({ 0: 'ok' }, 3).done, false)
})
