import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { join } from 'node:path'

// Счётчик посещений (public/api/stats.php) на настоящем PHP: отдельная папка
// public_html/api, чтобы файлы статистики не попали в общий tmp. Без php тесты пропускаются.

const hasPhp = spawnSync('php', ['-v']).status === 0
const skip = hasPhp ? false : 'php не установлен'
const PORT = 19400 + (process.pid % 300)
const site = `http://127.0.0.1:${PORT}`
let server
let root

before(async () => {
  if (!hasPhp) return
  root = mkdtempSync(join(tmpdir(), 'logos-stats-test-'))
  mkdirSync(join(root, 'public_html'))
  cpSync('public/api', join(root, 'public_html', 'api'), { recursive: true })
  writeFileSync(join(root, 'logos-ai-config.php'), "<?php return ['notices_key' => 'test-admin-key'];\n")
  server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', join(root, 'public_html')], { stdio: 'ignore' })
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await fetch(site); break } catch { await new Promise((resolve) => setTimeout(resolve, 100)) }
  }
})

after(() => {
  server?.kill()
  if (root) rmSync(root, { recursive: true, force: true })
})

const post = (body, headers = {}) => fetch(`${site}/api/stats.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Test)', ...headers }, body: JSON.stringify(body) })
const read = (key = 'test-admin-key') => fetch(`${site}/api/stats.php`, { headers: { 'X-Admin-Key': key } })

test('stats need the admin key', { skip }, async () => {
  assert.equal((await read('wrong')).status, 403)
  assert.equal((await fetch(`${site}/api/stats.php`)).status, 403)
})

test('views, unique visitors and QR scans are counted per day', { skip }, async () => {
  assert.equal((await post({ t: 'view', p: '/map' })).status, 200)
  assert.equal((await post({ t: 'view', p: '/map' })).status, 200)
  assert.equal((await post({ t: 'view', p: '/here' })).status, 200)
  assert.equal((await post({ t: 'qr', room: 'library-214' })).status, 200)
  assert.equal((await post({ t: 'qr', room: 'library-214' }, { 'User-Agent': 'Another Browser' })).status, 200)
  const data = await (await read()).json()
  const day = data.days[data.today]
  assert.equal(day.v, 3)
  assert.equal(day.u, 1, 'один и тот же браузер считается один раз')
  assert.deepEqual(day.p, { '/map': 2, '/here': 1 })
  assert.deepEqual(day.q, { 'library-214': 2 })
  assert.equal(day.h.reduce((total, count) => total + count, 0), 3)
  assert.doesNotMatch(JSON.stringify(data), /127\.0\.0\.1|Mozilla/, 'в статистике нет IP и браузера')
})

test('a second browser is a second visitor', { skip }, async () => {
  const before = (await (await read()).json()).days
  await post({ t: 'view', p: '/' }, { 'User-Agent': 'Mozilla/5.0 (Second)' })
  const after = (await (await read()).json())
  assert.equal(after.days[after.today].u, Object.values(before)[0].u + 1)
})

test('bots, bad input, admin pages and foreign origins are ignored', { skip }, async () => {
  const count = async () => { const data = await (await read()).json(); return data.days[data.today].v }
  const start = await count()
  await post({ t: 'view', p: '/map' }, { 'User-Agent': 'Googlebot/2.1' })
  await post({ t: 'view', p: '/admin/cards' })
  assert.equal((await post({ t: 'view', p: '/../etc/passwd' })).status, 400)
  assert.equal((await post({ t: 'qr', room: '<script>' })).status, 400)
  assert.equal((await post({ t: 'nope' })).status, 400)
  assert.equal((await post({ t: 'view', p: '/map' }, { Origin: 'https://evil.example' })).status, 403)
  assert.equal(await count(), start)
})
