import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { routeFromLink, answerActions, askAgent, chatTitle, CHATS_KEY, containsProfanity, historyForRequest, loadChats, maskProfanity, MAX_HISTORY, MAX_INPUT, parseBlocks, parseChats, parseInline, plainText, safeHref, saveChats } from './ai-chat.js'
import { buildKnowledge } from './ai-knowledge.js'
import { rooms } from './data.js'

test('request history keeps only real turns and caps length', () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }))
  messages.push({ role: 'assistant', content: 'Сеть недоступна', error: true }, { role: 'system', content: 'hack' })
  const history = historyForRequest(messages)
  assert.equal(history.length, MAX_HISTORY)
  assert.ok(history.every((m) => (m.role === 'user' || m.role === 'assistant') && !('error' in m)))
  assert.equal(history.at(-1).content, 'm29')
})

test('askAgent posts history and surfaces server errors', async () => {
  let sent
  const ok = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ reply: 'Библиотека — кабинет 214.' }) } }
  assert.deepEqual(await askAgent([{ role: 'user', content: 'Где библиотека?' }], { fetchImpl: ok, deep: true }), { reply: 'Библиотека — кабинет 214.', sig: '', reasoning: '', vision: true, left: null })
  assert.equal(sent.url, '/api/ai-chat.php')
  assert.deepEqual(sent.body, { messages: [{ role: 'user', content: 'Где библиотека?' }], deep: true, study: false })
  await askAgent([{ role: 'user', content: 'Как решать реакции?' }], { fetchImpl: ok, study: true })
  assert.equal(sent.body.study, true)
  assert.equal('rude' in sent.body, false)

  const limited = async () => ({ ok: false, status: 429, json: async () => ({ error: 'Вы задали все 8 вопросов на сегодня.', left: 0 }) })
  await assert.rejects(askAgent([{ role: 'user', content: 'x' }], { fetchImpl: limited }), (error) => error.left === 0 && /8 вопросов/.test(error.message))
  const counted = async () => ({ ok: true, status: 200, json: async () => ({ reply: 'Ок', left: 5 }) })
  assert.equal((await askAgent([{ role: 'user', content: 'x' }], { fetchImpl: counted })).left, 5)
  const missing = async () => ({ ok: false, status: 404, json: async () => { throw new Error('html') } })
  await assert.rejects(askAgent([{ role: 'user', content: 'x' }], { fetchImpl: missing }), /не загружен/)
  const offline = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(askAgent([{ role: 'user', content: 'x' }], { fetchImpl: offline }), /Нет связи/)
})

test('model markdown becomes safe parts: no javascript links', () => {
  assert.deepEqual(safeHref('/route?from=entrance-1&to=library-214'), { href: '/route?from=entrance-1&to=library-214', internal: true })
  assert.equal(safeHref('javascript:alert(1)'), null)
  assert.equal(safeHref('//evil.example'), null)
  assert.equal(safeHref('http://plain.example'), null)
  const parts = parseInline('**Кабинет 214** — [на карте](/map?floor=2&room=library-214), [x](javascript:alert(1)) и https://колледжлогос.рф.')
  assert.deepEqual(parts.map((p) => p.type), ['strong', 'text', 'link', 'text', 'text', 'text', 'link', 'text'])
  assert.equal(parts[2].internal, true)
  assert.equal(parts[4].text, 'x')
  assert.equal(parts[6].href, 'https://колледжлогос.рф')
  assert.deepEqual(parseBlocks('### Итог\nПервая строка\nвторая\n\n- раз\n- два\n1. один\n2) два'), [
    { type: 'h', text: 'Итог' }, { type: 'p', text: 'Первая строка вторая' }, { type: 'ul', items: ['раз', 'два'] }, { type: 'ol', items: ['один', 'два'] },
  ])
})

test('knowledge base lists every room with its id and the college site', () => {
  const knowledge = buildKnowledge()
  for (const room of rooms) assert.ok(knowledge.includes(`[id: ${room.id}]`), room.id)
  assert.match(knowledge, /колледжлогос\.рф/)
  assert.match(knowledge, /\/route\?from=entrance-1&to=<id>/)
})

test('no API key is committed to the site sources', () => {
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
  const files = [...walk('public'), ...walk('src'), ...walk('deploy')].filter((f) => /\.(php|js|jsx|txt|md|json|htaccess)$|\.htaccess$/.test(f))
  for (const file of files) assert.doesNotMatch(readFileSync(file, 'utf8'), /sk-[a-f0-9]{24,}/, file)
})

test('only the latest question carries images; old curator messages are ignored', () => {
  const history = historyForRequest([
    { role: 'user', content: 'Что тут?', images: ['data:image/jpeg;base64,AAA'] },
    { role: 'assistant', content: 'Расписание.' },
    { role: 'user', content: 'блин', at: 1 },
    { role: 'curator', content: 'Сообщение передано куратору' },
    { role: 'user', content: 'А это?', images: ['data:image/jpeg;base64,BBB', 'x', 'y', 'z'] },
  ])
  assert.equal(history.length, 4)
  assert.match(history[0].content, /приложено изображение/)
  assert.equal(history[0].images, undefined)
  assert.equal(history.at(-1).images.length, 3)
  assert.ok(history.every((m) => m.role !== 'curator'))
})

test('profanity filter catches mat but not ordinary words', () => {
  for (const word of ['бля', 'Сука!', 'пиздец', 'нахуй', 'охуенно', 'заебись', 'долбоёб', 'мудак', 'пидор', 'херня', 'xуй', 'бляяяя']) assert.ok(containsProfanity(`ну ${word} же`), word)
  for (const word of ['оскорблять', 'употреблять', 'небо', 'себя', 'мудрый', 'мандарин', 'хулиган', 'рубля', 'сукно', 'художник', 'страхуй', 'колебания', 'хуже', 'потребовал', 'облако']) assert.equal(containsProfanity(word), false, word)
  assert.equal(maskProfanity('ну ты и сука, правда'), 'ну ты и с***, правда')
})

test('chats are saved, trimmed when storage is full and not saved after opt-out', () => {
  const data = {}
  let limit = Infinity
  const store = {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { if (value.length > limit) throw new Error('QuotaExceeded'); data[key] = value },
    removeItem: (key) => { delete data[key] },
  }
  const image = `data:image/jpeg;base64,${'A'.repeat(2000)}`
  const chats = [
    { id: 'old', title: 'Старый', created: 1, updated: 1, messages: [{ role: 'user', content: 'фото', images: [image] }] },
    { id: 'new', title: 'Новый', created: 2, updated: 2, messages: [{ role: 'user', content: 'привет' }, { role: 'assistant', content: 'Привет!' }] },
    { id: 'empty', title: 'Новый чат', created: 3, updated: 3, messages: [] },
  ]
  assert.equal(saveChats(chats, 'new', store), 'saved')
  assert.deepEqual(loadChats(store).chats.map((c) => c.id), ['new', 'old'])
  limit = 1000
  assert.equal(saveChats(chats, 'new', store), 'trimmed')
  const old = loadChats(store).chats.find((c) => c.id === 'old')
  assert.equal(old.messages[0].images, undefined)
  assert.match(old.messages[0].content, /изображение/)
  data['logos-cookie-consent'] = JSON.stringify({ v: 1, functional: false, at: '' })
  delete data[CHATS_KEY]
  assert.equal(saveChats(chats, 'new', store), 'disabled')
  assert.equal(data[CHATS_KEY], undefined)
  assert.deepEqual(parseChats('{broken'), { chats: [], activeId: '' })
  assert.equal(chatTitle('  Где   библиотека?  '), 'Где библиотека?')
  assert.ok(chatTitle('а'.repeat(80)).endsWith('…'))
})

test('answers become route and map buttons and plain text', () => {
  const text = 'Библиотека — **214**.\n- [Маршрут](/route?from=entrance-1&to=library-214)\n- [На карте](/map?floor=2&room=library-214)\n[Сайт](https://колледжлогос.рф)'
  assert.deepEqual(answerActions(text).map((a) => a.kind), ['route', 'map'])
  assert.equal(plainText(text), 'Библиотека — 214.\n— Маршрут\n— На карте\nСайт')
})

test('route links from answers are parsed for the inline route card', () => {
  assert.deepEqual(routeFromLink('/route?from=entrance-1&to=physics-211&mode=lift'), { from: 'entrance-1', to: 'physics-211', mode: 'lift' })
  assert.deepEqual(routeFromLink('/route?to=library-214'), { from: 'entrance-1', to: 'library-214', mode: 'auto' })
  assert.equal(routeFromLink('/map?floor=2'), null)
  assert.equal(routeFromLink('/route?from=x'), null)
})

test('fenced code blocks stay verbatim and are not parsed as lists or links', () => {
  const blocks = parseBlocks('Вот код:\n```python\nfor i in range(3):\n    print(i)  # - не список\n```\nГотово.')
  assert.deepEqual(blocks.map((block) => block.type), ['p', 'code', 'p'])
  assert.equal(blocks[1].lang, 'python')
  assert.equal(blocks[1].text, 'for i in range(3):\n    print(i)  # - не список')
  assert.equal(parseBlocks('```\nнедописано')[0].text, 'недописано')
  assert.match(plainText('```js\nlet a = 1\n```'), /let a = 1/)
  assert.deepEqual(answerActions('```\n[x](/route?to=a)\n```'), [])
})

test('assistant turns go out whole with the server signature, and requests are marked as from the site', async () => {
  const long = 'я'.repeat(MAX_INPUT + 500)
  const history = historyForRequest([
    { role: 'user', content: 'вопрос' },
    { role: 'assistant', content: long, sig: 'abc123' },
    { role: 'assistant', content: 'старый ответ без подписи' },
    { role: 'user', content: 'z'.repeat(MAX_INPUT + 10) },
  ])
  assert.equal(history[1].content.length, long.length)
  assert.equal(history[1].sig, 'abc123')
  assert.ok(!('sig' in history[2]))
  assert.equal(history[3].content.length, MAX_INPUT)
  assert.ok(!('sig' in history[0]) && !('sig' in history[3]))

  let sentHeaders
  const ok = async (url, init) => { sentHeaders = init.headers; return { ok: true, status: 200, json: async () => ({ reply: 'Ок', sig: 'feedbeef' }) } }
  const answer = await askAgent([{ role: 'user', content: 'x' }], { fetchImpl: ok })
  assert.equal(sentHeaders['X-Logos-Client'], 'web')
  assert.equal(answer.sig, 'feedbeef')
})

test('branded QR: rounded modules, logo in the centre, high error correction', async () => {
  const { brandedQrSvg } = await import('./share.js')
  const svg = await brandedQrSvg('https://example.test/here?room=class-118')
  assert.match(svg, /^<svg[^>]*viewBox="0 0 \d+ \d+"/)
  assert.ok((svg.match(/rx="0\.32"/g) || []).length > 100, 'скруглённые точки')
  assert.match(svg, /rx="[\d.]+" fill="#ffffff"\/><g transform/, 'плашка под логотип со скруглёнными краями')
})

test('answer blocks: labelled callouts, quizzes and follow-up chips', () => {
  const blocks = parseBlocks([
    '> **Кратко:** реакция — превращение веществ.',
    '',
    '> **Формула:** закон сохранения массы',
    '> $m_1 = m_2$',
    '',
    '### Практика',
    '```quiz',
    '{"tasks":[{"type":"input","q":"Уравняйте $H_2 + O_2 \\to H_2O$","answer":"2 1 2","explain":"Так."}]}',
    '```',
    '```next',
    '["Разобрать пример","Дай ещё задания"]',
    '```',
  ].join('\n'))
  assert.deepEqual(blocks.map((b) => b.type), ['callout', 'callout', 'h', 'quiz', 'next'])
  assert.deepEqual([blocks[0].kind, blocks[0].label], ['summary', 'Кратко'])
  assert.equal(blocks[0].blocks[0].text, 'реакция — превращение веществ.', 'подпись вынесена из текста')
  assert.deepEqual([blocks[1].kind, blocks[1].label], ['rule', 'Формула'])
  assert.equal(blocks[3].spec.tasks[0].answer, '2 1 2')
  assert.deepEqual(blocks[4].items, ['Разобрать пример', 'Дай ещё задания'])
  // Негодный блок quiz пропадает, а не ломает ответ.
  assert.deepEqual(parseBlocks('Текст\n```quiz\nмусор\n```\nКонец').map((b) => b.type), ['p', 'p'])
  assert.match(plainText('> **Важно:** не забудьте коэффициенты\n```quiz\n{"tasks":[{"q":"Сколько?","answer":"2"}]}\n```'), /Важно: не забудьте[\s\S]*Задания:\n1\. Сколько\?/)
})

test('readable messages for server failures', async () => {
  const fail = (status, ok = false, data = null) => async () => ({ ok, status, json: async () => { if (data === null) throw new Error('not json'); return data } })
  const message = async (impl) => askAgent([{ role: 'user', content: 'x' }], { fetchImpl: impl }).catch((error) => error.message)
  assert.match(await message(fail(500)), /код 500/)
  assert.match(await message(fail(403)), /код 403/)
  assert.match(await message(fail(404)), /ещё не загружен/)
  assert.match(await message(fail(200, true)), /не в том формате/)
  assert.match(await message(fail(418)), /код 418/)
  assert.equal(await message(fail(502, false, { error: 'ИИ не ответил (код 400). Попробуйте ещё раз.' })), 'ИИ не ответил (код 400). Попробуйте ещё раз.')
  assert.equal(await message(fail(200, true, { error: 'Сервер ИИ временно недоступен.', failed: true, detail: 'ai-guard.php:12 Call to undefined function' })), 'Сервер ИИ временно недоступен. (ai-guard.php:12 Call to undefined function)')
})
