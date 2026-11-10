import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { join } from 'node:path'

// Панель /admin на настоящем PHP: настройки сайта (темы, маячки) и обращения
// посетителей. Отдельная папка public_html/api, как на хостинге. Без php тесты пропускаются.

const hasPhp = spawnSync('php', ['-v']).status === 0
const skip = hasPhp ? false : 'php не установлен'
const PORT = 19800 + (process.pid % 150)
const site = `http://127.0.0.1:${PORT}`
const KEY = 'test-admin-key'
let server
let root

before(async () => {
  if (!hasPhp) return
  root = mkdtempSync(join(tmpdir(), 'logos-admin-test-'))
  mkdirSync(join(root, 'public_html'))
  cpSync('public/api', join(root, 'public_html', 'api'), { recursive: true })
  writeFileSync(join(root, 'logos-ai-config.php'), `<?php return ['notices_key' => '${KEY}'];\n`)
  server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', join(root, 'public_html')], { stdio: 'ignore' })
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await fetch(site); break } catch { await new Promise((resolve) => setTimeout(resolve, 100)) }
  }
})

after(() => {
  server?.kill()
  if (root) rmSync(root, { recursive: true, force: true })
})

const json = (path, body, key) => fetch(`${site}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Admin-Key': key } : {}) }, body: JSON.stringify(body) })

test('settings: everyone reads them, only the admin key changes them', { skip }, async () => {
  assert.deepEqual(await (await fetch(`${site}/api/settings.php`)).json(), { themes: ['light', 'dark', 'pickme'], beacons: [] })
  assert.equal((await json('/api/settings.php', { themes: ['light'] })).status, 403)
  assert.equal((await json('/api/settings.php', { themes: ['light'] }, 'wrong')).status, 403)

  const off = await (await json('/api/settings.php', { themes: ['pickme', 'unity'] }, KEY)).json()
  assert.deepEqual(off.themes, ['light', 'pickme'], 'тёмная выключена, светлая осталась, неизвестная отброшена')
  assert.deepEqual((await (await fetch(`${site}/api/settings.php`)).json()).themes, ['light', 'pickme'])
  assert.ok(existsSync(join(root, 'logos-settings.json')), 'файл лежит рядом с папкой сайта, а не в ней')

  // Маячки сохраняются отдельно и не трогают темы.
  const beacons = await (await json('/api/settings.php', { beacons: [{ id: ' LOGOS-211 ', roomId: 'physics-211', tx: -61 }, { id: 'logos-211', roomId: 'canteen' }, { id: 'B2', roomId: 'canteen', tx: 5 }] }, KEY)).json()
  assert.deepEqual(beacons.beacons, [{ id: 'logos-211', roomId: 'canteen', tx: -59 }, { id: 'B2', roomId: 'canteen', tx: -20 }], 'повтор имени заменяет запись, мощность в разумных пределах')
  assert.deepEqual(beacons.themes, ['light', 'pickme'])
  assert.equal((await json('/api/settings.php', { beacons: [{ id: '', roomId: 'canteen' }] }, KEY)).status, 400)
  assert.equal((await json('/api/settings.php', { beacons: [{ id: 'x', roomId: '../etc' }] }, KEY)).status, 400)

  const all = await (await json('/api/settings.php', { themes: ['light', 'dark', 'pickme'] }, KEY)).json()
  assert.deepEqual(all.themes, ['light', 'dark', 'pickme'])
  assert.equal(all.beacons.length, 2)
})

test('reports: visitors send them, the panel lists, resolves and deletes them', { skip }, async () => {
  assert.equal((await json('/api/report.php', { room: 'class-118', kind: 'closed', text: 'Дверь заперта', page: '/map?floor=1&room=class-118' })).status, 200)
  assert.equal((await json('/api/report.php', { kind: 'bug', text: 'Кнопка не нажимается', contact: 'ivan@example.com', consent: true, agent: 'Test Browser' })).status, 200)

  assert.equal((await fetch(`${site}/api/report.php?list=1`)).status, 403)
  assert.equal((await fetch(`${site}/api/report.php?list=1`, { headers: { 'X-Admin-Key': 'wrong' } })).status, 403)
  const list = await (await fetch(`${site}/api/report.php?list=1`, { headers: { 'X-Admin-Key': KEY } })).json()
  assert.equal(list.count, 2)
  assert.equal(list.open, 2)
  assert.deepEqual(list.items.map((item) => item.kind), ['bug', 'closed'], 'новые сверху')
  assert.equal(list.items[0].contact, 'ivan@example.com')
  assert.equal(list.items[1].room, 'class-118')
  assert.ok(list.items.every((item) => /^[0-9a-f]{16}$/.test(item.id)))
  assert.doesNotMatch(JSON.stringify(list), /127\.0\.0\.1/, 'IP в обращениях нет')

  const [bug, closed] = list.items
  assert.equal((await json('/api/report.php', { action: 'done', id: closed.id })).status, 403, 'без ключа нельзя')
  assert.equal((await json('/api/report.php', { action: 'done', id: closed.id }, KEY)).status, 200)
  let after = await (await fetch(`${site}/api/report.php?list=1`, { headers: { 'X-Admin-Key': KEY } })).json()
  assert.equal(after.open, 1)
  assert.ok(after.items.find((item) => item.id === closed.id).done, 'отметка сохранилась, номер тот же')
  assert.equal((await json('/api/report.php', { action: 'reopen', id: closed.id }, KEY)).status, 200)
  assert.equal((await json('/api/report.php', { action: 'delete', id: bug.id }, KEY)).status, 200)
  assert.equal((await json('/api/report.php', { action: 'delete', id: bug.id }, KEY)).status, 404)
  after = await (await fetch(`${site}/api/report.php?list=1`, { headers: { 'X-Admin-Key': KEY } })).json()
  assert.deepEqual(after.items.map((item) => [item.kind, Boolean(item.done)]), [['closed', false]])
  assert.equal(readFileSync(join(root, 'logos-reports', 'reports.jsonl'), 'utf8').trim().split('\n').length, 1)
})
