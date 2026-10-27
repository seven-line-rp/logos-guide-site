import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn, spawnSync } from 'node:child_process'
import { promisify } from 'node:util'
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto'
import { createServer } from 'node:http'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { join } from 'node:path'
import { BELLS, LUNCH } from './schedule.js'

// Push-уведомления (public/api/push.php) на настоящем PHP. Вместо FCM и Apple —
// свой HTTP-сервер: он принимает зашифрованные сообщения, а тест расшифровывает
// их по RFC 8291 и проверяет подпись VAPID. Без php тесты пропускаются.

const hasPhp = spawnSync('php', ['-v']).status === 0
const skip = hasPhp ? false : 'php не установлен'
const PORT = 19700 + (process.pid % 300)
const PUSH_PORT = PORT + 1
const site = `http://127.0.0.1:${PORT}`
const ADMIN = 'test-admin-key'
let server
let receiver
let root
const received = []

before(async () => {
  if (!hasPhp) return
  root = mkdtempSync(join(tmpdir(), 'logos-push-test-'))
  mkdirSync(join(root, 'public_html'))
  cpSync('public/api', join(root, 'public_html', 'api'), { recursive: true })
  writeMeta('0.9.0')
  writeFileSync(join(root, 'logos-ai-config.php'), `<?php return ['notices_key' => '${ADMIN}', 'push_contact' => 'mailto:test@example.com', 'push_test_hosts' => ['127.0.0.1:${PUSH_PORT}']];\n`)
  receiver = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      received.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks) })
      res.writeHead(req.url.startsWith('/gone') ? 410 : 201).end()
    })
  }).listen(PUSH_PORT, '127.0.0.1')
  server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', join(root, 'public_html')], { stdio: 'ignore' })
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await fetch(site); break } catch { await new Promise((resolve) => setTimeout(resolve, 100)) }
  }
})

after(() => {
  server?.kill()
  receiver?.close()
  if (root) rmSync(root, { recursive: true, force: true })
})

function writeMeta(version) {
  writeFileSync(join(root, 'public_html', 'api', 'push-meta.json'), JSON.stringify({ bells: BELLS, lunch: LUNCH, version, versionLabel: `${version} тест` }))
}

const post = (body, headers = {}) => fetch(`${site}/api/push.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
const b64url = (buffer) => Buffer.from(buffer).toString('base64url')

function browser(path) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  return { ecdh, auth, subscription: { endpoint: `http://127.0.0.1:${PUSH_PORT}${path}`, keys: { p256dh: b64url(ecdh.getPublicKey()), auth: b64url(auth) } } }
}

// Расшифровка aes128gcm так же, как это делает браузер.
function decrypt(body, { ecdh, auth }) {
  const salt = body.subarray(0, 16)
  assert.equal(body.readUInt32BE(16), 4096)
  assert.equal(body[20], 65)
  const serverKey = body.subarray(21, 86)
  const data = body.subarray(86)
  const shared = ecdh.computeSecret(serverKey)
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), serverKey]), 32))
  const key = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))
  const decipher = createDecipheriv('aes-128-gcm', key, nonce)
  decipher.setAuthTag(data.subarray(-16))
  const plain = Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()])
  assert.equal(plain.at(-1), 2)
  return JSON.parse(plain.subarray(0, -1).toString('utf8'))
}

function checkVapid(header, publicKey) {
  const [, token, key] = header.match(/^vapid t=([^,]+), k=(.+)$/)
  assert.equal(key, publicKey)
  const [head, claims, signature] = token.split('.')
  const point = Buffer.from(key, 'base64url')
  const jwk = { kty: 'EC', crv: 'P-256', x: b64url(point.subarray(1, 33)), y: b64url(point.subarray(33)) }
  assert.ok(verify('sha256', Buffer.from(`${head}.${claims}`), { key: createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')))
  const payload = JSON.parse(Buffer.from(claims, 'base64url'))
  assert.equal(payload.aud, `http://127.0.0.1:${PUSH_PORT}`)
  assert.equal(payload.sub, 'mailto:test@example.com')
  assert.ok(payload.exp > Date.now() / 1000)
}

// Асинхронно: пока PHP шлёт сообщения, приёмник в этом же процессе должен отвечать.
const cron = async (time) => JSON.parse((await promisify(execFile)('php', [join(root, 'public_html', 'api', 'push.php'), 'cron', String(Math.floor(time / 1000))])).stdout)

test('the server hands out one stable VAPID key', { skip }, async () => {
  const first = await (await fetch(`${site}/api/push.php`)).json()
  const second = await (await fetch(`${site}/api/push.php`)).json()
  assert.equal(Buffer.from(first.publicKey, 'base64url').length, 65)
  assert.equal(first.publicKey, second.publicKey)
  assert.ok(existsSync(join(root, 'logos-push', 'vapid.json')), 'ключи лежат вне public_html')
})

test('subscriptions only go to real push services', { skip }, async () => {
  const fake = browser('/x')
  fake.subscription.endpoint = 'https://evil.example/push'
  assert.equal((await post({ action: 'subscribe', subscription: fake.subscription })).status, 400)
  fake.subscription.endpoint = 'http://127.0.0.1:1/push'
  assert.equal((await post({ action: 'subscribe', subscription: fake.subscription })).status, 400)
  const bad = browser('/y')
  bad.subscription.keys.auth = 'short'
  assert.equal((await post({ action: 'subscribe', subscription: bad.subscription })).status, 400)
  assert.equal((await post({ action: 'subscribe', subscription: browser('/z').subscription }, { Origin: 'https://evil.example' })).status, 403)
})

test('a test push reaches the browser encrypted and signed', { skip }, async () => {
  const { publicKey } = await (await fetch(`${site}/api/push.php`)).json()
  const me = browser('/me')
  const subscribed = await post({ action: 'subscribe', subscription: me.subscription, topics: ['events', 'nonsense'], platform: 'android' })
  assert.equal(subscribed.status, 200)
  assert.deepEqual((await subscribed.json()).topics, ['events'])

  received.length = 0
  const response = await post({ action: 'test', endpoint: me.subscription.endpoint, kind: 'event' })
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal(received.length, 1)
  const [message] = received
  assert.equal(message.headers['content-encoding'], 'aes128gcm')
  assert.equal(message.headers.ttl, '300')
  checkVapid(message.headers.authorization, publicKey)
  const push = decrypt(message.body, me)
  assert.equal(push.kind, 'event')
  assert.equal(push.title, 'Концерт в актовом зале')
  assert.equal(push.test, true)

  assert.equal((await post({ action: 'test', endpoint: 'http://127.0.0.1:1/unknown', kind: 'event' })).status, 404)
})

test('the admin panel needs the key, counts subscribers and broadcasts by topic', { skip }, async () => {
  assert.equal((await post({ action: 'count' }, { 'X-Admin-Key': 'wrong' })).status, 403)
  const news = browser('/news-only')
  await post({ action: 'subscribe', subscription: news.subscription, topics: ['news'], platform: 'ios' })
  const count = await (await post({ action: 'count' }, { 'X-Admin-Key': ADMIN })).json()
  assert.equal(count.platforms.ios, 1)
  assert.equal(count.topics.news, 1)

  assert.equal((await post({ action: 'send', kind: 'news', title: '' }, { 'X-Admin-Key': ADMIN })).status, 400)
  received.length = 0
  const sent = await (await post({ action: 'send', kind: 'news', title: '  Завтра\nвыходной ', body: 'Колледж закрыт', url: '//evil.example' }, { 'X-Admin-Key': ADMIN })).json()
  assert.equal(sent.sent, 1)
  assert.equal(received.length, 1)
  assert.equal(received[0].path, '/news-only')
  const push = decrypt(received[0].body, news)
  assert.equal(push.title, 'Завтра выходной')
  assert.equal(push.url, '/', 'внешние ссылки не пропускаем')
})

test('a renewed subscription keeps its topics, a revoked one is dropped', { skip }, async () => {
  const old = browser('/old')
  await post({ action: 'subscribe', subscription: old.subscription, topics: ['updates'] })
  const renewed = browser('/renewed')
  assert.deepEqual((await (await post({ action: 'subscribe', subscription: renewed.subscription, previous: old.subscription.endpoint })).json()).topics, ['updates'])
  const list = JSON.parse(readFileSync(join(root, 'logos-push', 'subscriptions.json'), 'utf8'))
  assert.ok(!Object.values(list).some((item) => item.endpoint.endsWith('/old')))

  const gone = browser('/gone')
  await post({ action: 'subscribe', subscription: gone.subscription, topics: ['updates'] })
  const response = await post({ action: 'test', endpoint: gone.subscription.endpoint, kind: 'update' })
  assert.equal(response.status, 502)
  assert.equal((await response.json()).removed, 1)
  assert.equal((await post({ action: 'test', endpoint: gone.subscription.endpoint, kind: 'update' })).status, 404)
})

test('cron sends bells once, new events and a new site version', { skip }, async () => {
  const student = browser('/student')
  await post({ action: 'subscribe', subscription: student.subscription, topics: ['lessons', 'events', 'updates'] })
  // Вторник, 27 октября 2026, 10:35 по Москве: за 5 минут до 2-й пары.
  const tuesday = Date.parse('2026-10-27T10:35:00+03:00')
  received.length = 0
  const first = await cron(tuesday)
  assert.ok(first.ok)
  const lesson = first.sent.find((item) => item.kind === 'lesson-start')
  assert.equal(lesson.title, 'Через 5 минут: 2-я пара')
  assert.ok(!first.sent.some((item) => item.kind === 'update'), 'первый запуск только запоминает версию')
  const push = decrypt(received.find((item) => item.path === '/student').body, student)
  assert.deepEqual(push.bell, { pair: 2, label: '2-я пара', start: '10:40', end: '12:10' })

  assert.equal((await cron(tuesday + 60_000)).sent.length, 0, 'крон опоздал на минуту — повторно не шлём')
  const end = (await cron(Date.parse('2026-10-27T12:10:30+03:00'))).sent
  assert.equal(end[0].kind, 'lesson-end')
  assert.equal(end[0].title, '2-я пара закончилась')
  assert.equal((await cron(Date.parse('2026-11-01T10:35:00+03:00'))).sent.length, 0, 'в воскресенье пар нет')

  writeFileSync(join(root, 'logos-notices.json'), JSON.stringify([{ type: 'event', roomId: 'auditorium-104', title: 'Концерт в 15:00' }, { type: 'closed', roomId: 'lift-1', title: 'Лифт на ремонте' }]))
  writeMeta('1.0.0')
  received.length = 0
  const later = (await cron(Date.parse('2026-10-27T13:00:00+03:00'))).sent
  assert.deepEqual(later.map((item) => item.kind).sort(), ['event', 'update'])
  const event = decrypt(received.find((item) => item.path === '/student' && decrypt(item.body, student).kind === 'event').body, student)
  assert.equal(event.url, '/map?room=auditorium-104')
  assert.equal((await cron(Date.parse('2026-10-27T13:01:00+03:00'))).sent.length, 0)
})
