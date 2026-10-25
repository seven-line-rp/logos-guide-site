import test from 'node:test'
import assert from 'node:assert/strict'
import { calloutKind, chartBounds, cleanReply, compileExpression, niceTicks, parseChartSpec, splitSubject, stripCjk } from './ai-format.js'
import { parseBlocks, parseInline, plainText } from './ai-chat.js'

test('иероглифы вырезаются, русский текст и знаки остаются', () => {
  assert.equal(stripCjk('Привет, 你好 мир！'), 'Привет, мир!')
  assert.equal(stripCjk('Ответ：42。'), 'Ответ: 42.')
  assert.equal(stripCjk('Закон Ома（U = IR）работает'), 'Закон Ома (U = IR) работает')
  assert.equal(stripCjk('Обычный текст ✓ 😀 ≤ ∑'), 'Обычный текст ✓ 😀 ≤ ∑')
  assert.equal(stripCjk('日本語のテキスト'), '')
})

test('если человек сам пишет по-китайски, ответ не трогаем', () => {
  assert.equal(cleanReply('你好 значит «привет»', 'Как будет привет по-китайски: 你好?'), '你好 значит «привет»')
  assert.equal(cleanReply('Привет 你好', 'Привет'), 'Привет')
})

test('метка предмета отделяется от текста', () => {
  assert.deepEqual(splitSubject('[[предмет: math]]\nРешение'), { subject: 'math', text: 'Решение' })
  assert.deepEqual(splitSubject('[[subject:physics]] Тут'), { subject: 'physics', text: 'Тут' })
  assert.deepEqual(splitSubject('[[предмет: чушь]]Текст'), { subject: '', text: 'Текст' })
  assert.deepEqual(splitSubject('Без метки'), { subject: '', text: 'Без метки' })
})

test('формулы в строке: $…$ и \\(…\\), но не цены', () => {
  const parts = parseInline('Корни: $x_1 = \\frac{-b}{2a}$ и \\(a^2\\), цена 5$ или 10$.')
  assert.deepEqual(parts.filter((p) => p.type === 'math').map((p) => p.text), ['x_1 = \\frac{-b}{2a}', 'a^2'])
  assert.equal(parseInline('Купил за 5$ и 10$').some((p) => p.type === 'math'), false)
  assert.deepEqual(parseInline('это *важно* и 2 * 3 * 4').filter((p) => p.type === 'em').map((p) => p.text), ['важно'])
})

test('блоки: формула, таблица, плашка, график', () => {
  const blocks = parseBlocks([
    '$$', 'x = \\frac{-b \\pm \\sqrt{D}}{2a}', '$$',
    '| Вещество | Формула |', '|:--|--:|', '| Вода | H2O |', '| Соль | NaCl |',
    '> **Ответ:** 42',
    '```chart', '{"type":"function","fn":"x^2","from":-3,"to":3}', '```',
  ].join('\n'))
  assert.deepEqual(blocks.map((b) => b.type), ['math', 'table', 'callout', 'chart'])
  assert.equal(blocks[0].text, 'x = \\frac{-b \\pm \\sqrt{D}}{2a}')
  assert.deepEqual(blocks[1].head, ['Вещество', 'Формула'])
  assert.deepEqual(blocks[1].aligns, ['', 'right'])
  assert.equal(blocks[1].rows.length, 2)
  assert.equal(blocks[2].kind, 'answer')
  assert.equal(blocks[3].spec.kind, 'function')
})

test('однострочная формула $$…$$ и сломанный график остаются читаемыми', () => {
  assert.deepEqual(parseBlocks('$$E = mc^2$$'), [{ type: 'math', text: 'E = mc^2' }])
  const broken = parseBlocks('```chart\n{не json\n```')
  assert.equal(broken[0].type, 'code')
})

test('plainText для копирования и озвучки', () => {
  assert.equal(plainText('[[предмет: math]]\nТаблица:\n| a | b |\n|--|--|\n| 1 | 2 |'), 'Таблица:\na | b\n1 | 2')
})

test('безопасный калькулятор функций', () => {
  assert.equal(compileExpression('x^2 - 4')(3), 5)
  assert.equal(compileExpression('y = 2x + 1')(4), 9)
  assert.equal(compileExpression('3(x+1)')(1), 6)
  assert.equal(compileExpression('-x^2')(3), -9)
  assert.ok(Math.abs(compileExpression('sin(pi/2)')(0) - 1) < 1e-12)
  assert.equal(compileExpression('|x|')(-7), 7)
  assert.equal(compileExpression('2**3')(0), 8)
  for (const bad of ['alert(1)', 'x; process.exit()', 'constructor', '(x', 'x +', '2 $ 3']) assert.throws(() => compileExpression(bad), undefined, bad)
})

test('график функции и точек', () => {
  const spec = parseChartSpec('{"type":"function","fn":["x^2","1/x"],"from":-2,"to":2,"title":"Парабола"}')
  assert.equal(spec.series.length, 2)
  assert.equal(spec.series[0].points.length, 241)
  assert.ok(spec.series[1].points.some((p) => p[1] === null || Math.abs(p[1]) > 10))
  const bounds = chartBounds(spec)
  assert.ok(bounds.y1 < 100, 'асимптота не растягивает ось')
  assert.equal(parseChartSpec('{"type":"function","fn":"alert(1)"}'), null)
  assert.equal(parseChartSpec('{"type":"line","points":[[0,0],[1,2],[2,3]]}').series[0].points.length, 3)
  assert.equal(parseChartSpec('{"type":"bar","labels":["Пн","Вт"],"values":[3,5]}').series[0].values.length, 2)
  assert.equal(parseChartSpec('{"type":"pie","data":[["А",30],["Б",70]]}').items.length, 2)
  assert.equal(parseChartSpec('{"type":"pie","data":[]}'), null)
})

test('отметки осей и подписи плашек', () => {
  assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10])
  assert.equal(calloutKind('Дано:'), 'given')
  assert.equal(calloutKind('Итог'), 'answer')
  assert.equal(calloutKind('Что-то'), 'note')
  for (const [label, kind] of [['Кратко:', 'summary'], ['Определение', 'definition'], ['Формула:', 'rule'], ['Пример', 'example'], ['Важно:', 'warn'], ['Совет:', 'tip'], ['Проверка', 'check'], ['Типичные ошибки', 'warn']]) assert.equal(calloutKind(label), kind, label)
})
