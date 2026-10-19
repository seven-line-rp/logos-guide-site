import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { askAgent, historyForRequest, MAX_HISTORY, parseBlocks, parseInline, safeHref } from './ai-chat.js'
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
  assert.equal(await askAgent([{ role: 'user', content: 'Где библиотека?' }], { fetchImpl: ok }), 'Библиотека — кабинет 214.')
  assert.equal(sent.url, '/api/ai-chat.php')
  assert.deepEqual(sent.body.messages, [{ role: 'user', content: 'Где библиотека?' }])

  const limited = async () => ({ ok: false, status: 429, json: async () => ({ error: 'Слишком много сообщений подряд.' }) })
  await assert.rejects(askAgent([{ role: 'user', content: 'x' }], { fetchImpl: limited }), /Слишком много/)
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
