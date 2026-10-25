import test from 'node:test'
import assert from 'node:assert/strict'
import { classify, reportError, shouldReport } from './error-report.js'

test('failed section loads are told apart from ordinary errors', () => {
  assert.equal(classify('Failed to fetch dynamically imported module: https://x/assets/Map.js'), 'chunk')
  assert.equal(classify('error loading dynamically imported module'), 'chunk')
  assert.equal(classify('Importing a module script failed.'), 'chunk')
  assert.equal(classify('Cannot read properties of undefined'), 'error')
})

test('noise from extensions and foreign scripts is not reported', () => {
  assert.equal(shouldReport('ResizeObserver loop completed with undelivered notifications.'), false)
  assert.equal(shouldReport('Script error.'), false)
  assert.equal(shouldReport(''), false)
  assert.equal(shouldReport('Boom', 'chrome-extension://abc/content.js', 'https://logos-guide.ru'), false)
  assert.equal(shouldReport('Boom', 'https://cdn.other.com/widget.js', 'https://logos-guide.ru'), false)
  assert.equal(shouldReport('Boom', 'https://logos-guide.ru/assets/index-abc.js', 'https://logos-guide.ru'), true)
  assert.equal(shouldReport('Boom', '', 'https://logos-guide.ru'), true)
})

test('reports are marked as from the site, deduplicated and capped per page load', () => {
  const calls = []
  const fetchImpl = (url, init) => { calls.push({ url, init }); return Promise.resolve({ ok: true }) }
  assert.equal(reportError('react', new Error('Render exploded'), '', fetchImpl), true)
  assert.equal(reportError('react', new Error('Render exploded'), '', fetchImpl), false, 'повтор не отправляется')
  assert.equal(reportError('error', 'Second', '', fetchImpl), true)
  assert.equal(reportError('error', 'Third', '', fetchImpl), true)
  assert.equal(reportError('error', 'Fourth', '', fetchImpl), false, 'не больше трёх за загрузку страницы')
  assert.equal(calls.length, 3)
  assert.equal(calls[0].url, '/api/client-error.php')
  assert.equal(calls[0].init.headers['X-Logos-Client'], 'web')
  assert.deepEqual(Object.keys(JSON.parse(calls[0].init.body)).sort(), ['k', 'm', 'p', 's'])
  assert.equal(JSON.parse(calls[0].init.body).k, 'react')
})
