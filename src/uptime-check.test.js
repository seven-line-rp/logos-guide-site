import test from 'node:test'
import assert from 'node:assert/strict'
import { checkSite, checkWithRetries, daysUntil, decide, formatMessage, main } from '../scripts/uptime-check.mjs'

const html = '<!doctype html><div id="root"></div><script type="module" src="/assets/index-abc.js"></script><link rel="stylesheet" href="/assets/index-abc.css">'

// Поддельный сервер: таблица «путь → ответ».
function server(routes) {
  const calls = []
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname + new URL(url).search
    calls.push(path)
    const route = routes[path]
    if (route instanceof Error) throw route
    const { status = 200, type = 'text/plain', body = 'x' } = route || { status: 404, body: 'no' }
    return { status, ok: status < 400, headers: { get: () => type }, text: async () => body }
  }
  return { fetchImpl, calls }
}
const healthy = {
  '/': { type: 'text/html', body: html },
  '/assets/index-abc.js': { type: 'text/javascript', body: 'console.log(1)' },
  '/assets/index-abc.css': { type: 'text/css', body: 'a{}' },
  '/api/settings.php': { type: 'application/json', body: '{"themes":["light"]}' },
}

test('a healthy site passes with no problems', async () => {
  const { fetchImpl, calls } = server(healthy)
  const result = await checkSite({ siteUrl: 'https://example.test/', fetchImpl })
  assert.deepEqual(result.down, [])
  assert.deepEqual(result.warnings, [])
  assert.ok(calls.includes('/assets/index-abc.js') && calls.includes('/assets/index-abc.css'))
})

test('missing build files, wrong index.html and server errors count as down', async () => {
  let result = await checkSite({ siteUrl: 'https://example.test', fetchImpl: server({ ...healthy, '/assets/index-abc.js': { status: 404 } }).fetchImpl })
  assert.match(result.down.join(), /index-abc\.js/)
  // Хостинг отдаёт HTML вместо файла сборки (SPA-подмена) — тоже поломка.
  result = await checkSite({ siteUrl: 'https://example.test', fetchImpl: server({ ...healthy, '/assets/index-abc.js': { type: 'text/html', body: html } }).fetchImpl })
  assert.match(result.down.join(), /index-abc\.js/)
  result = await checkSite({ siteUrl: 'https://example.test', fetchImpl: server({ '/': { status: 503 } }).fetchImpl })
  assert.match(result.down.join(), /503/)
  result = await checkSite({ siteUrl: 'https://example.test', fetchImpl: server({ '/': { type: 'text/html', body: '<html>Parked domain</html>' } }).fetchImpl })
  assert.match(result.down.join(), /нет приложения/)
  result = await checkSite({ siteUrl: 'https://example.test', fetchImpl: server({ '/': Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }) }).fetchImpl })
  assert.match(result.down.join(), /ENOTFOUND/)
})

test('the AI endpoint only produces warnings, never "down"', async () => {
  for (const [route, expected] of [[{ status: 404 }, /не найден/], [{ status: 500 }, /500/], [{ type: 'text/html', body: '<?php' }, /не JSON/], [{ type: 'application/json', body: '{"ok":false}' }, /не настроен/]]) {
    const result = await checkSite({ siteUrl: 'https://example.test', fetchImpl: server({ ...healthy, '/api/settings.php': route }).fetchImpl })
    assert.deepEqual(result.down, [])
    assert.match(result.warnings.join(), expected)
  }
  const skipped = await checkSite({ siteUrl: 'https://example.test', checkApi: false, fetchImpl: server({ ...healthy, '/api/settings.php': { status: 500 } }).fetchImpl })
  assert.deepEqual(skipped.warnings, [])
})

test('a transient failure is retried; a real outage is reported after all attempts', async () => {
  let calls = 0
  const flaky = async (url) => { calls += 1; if (calls === 1) throw new Error('reset'); return server(healthy).fetchImpl(url) }
  const waits = []
  const recovered = await checkWithRetries({ siteUrl: 'https://example.test', fetchImpl: flaky }, { pauseMs: 5, wait: async (ms) => waits.push(ms) })
  assert.equal(recovered.down.length, 0)
  assert.equal(recovered.attempts, 2)
  assert.deepEqual(waits, [5])
  const outage = await checkWithRetries({ siteUrl: 'https://example.test', fetchImpl: server({ '/': { status: 502 } }).fetchImpl }, { pauseMs: 1, wait: async () => {} })
  assert.equal(outage.attempts, 3)
  assert.equal(outage.down.length, 1)
})

test('alerts are sent on the way down and on recovery, not on every run', () => {
  const down = { down: ['главная отвечает 502'], warnings: [], ms: 100, attempts: 3 }
  const up = { down: [], warnings: [], ms: 1200, attempts: 1 }
  assert.deepEqual(decide({ result: down, previous: 'success' }), { status: 'down', notify: true, warnings: [] })
  assert.equal(decide({ result: down, previous: '' }).notify, true)
  assert.equal(decide({ result: down, previous: 'failure' }).notify, false, 'пока сайт лежит, повторов нет')
  assert.deepEqual(decide({ result: up, previous: 'failure' }), { status: 'recovered', notify: true, warnings: [] })
  assert.equal(decide({ result: up, previous: 'success' }).notify, false)
  const warned = { ...up, warnings: ['ИИ-чат не настроен'] }
  assert.equal(decide({ result: warned, previous: 'success', digest: false }).notify, false)
  assert.equal(decide({ result: warned, previous: 'success', digest: true }).notify, true)
  assert.match(decide({ result: up, previous: 'success', certDays: 5, digest: true }).warnings.join(), /через 5 дн/)
  assert.match(decide({ result: up, previous: 'success', certDays: -1, digest: true }).warnings.join(), /просрочен/)
  assert.equal(decide({ result: up, previous: 'success', certDays: 60, digest: true }).notify, false)
})

test('message texts are readable and contain no secrets', () => {
  const down = { down: ['главная отвечает 502', 'файл /assets/a.js недоступен (404)'], warnings: [], ms: 100, attempts: 3 }
  const text = formatMessage({ status: 'down', result: down, warnings: [], siteUrl: 'https://logos-guide.ru/' })
  assert.match(text, /🚨 ЛОГОС: сайт не работает\nlogos-guide\.ru\n• главная отвечает 502\n• файл/)
  assert.match(formatMessage({ status: 'recovered', result: { ...down, ms: 1500 }, warnings: [], siteUrl: 'https://logos-guide.ru' }), /✅ .*снова работает[\s\S]*1\.5 с/)
  assert.match(formatMessage({ status: 'ok', result: down, warnings: ['ИИ-чат не настроен'], siteUrl: 'https://logos-guide.ru' }), /⚠️[\s\S]*• ИИ-чат не настроен/)
})

test('certificate dates are converted to days left', () => {
  const now = Date.parse('2026-10-25T00:00:00Z')
  assert.equal(daysUntil('Nov 4 00:00:00 2026 GMT', now), 10)
  assert.equal(daysUntil('Oct 20 00:00:00 2026 GMT', now), -5)
  assert.equal(daysUntil('мусор', now), null)
})

test('without SITE_URL the check is skipped instead of failing', async () => {
  assert.equal(await main({}), 0)
})
