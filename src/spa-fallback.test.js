import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Перезагрузка страницы по прямому адресу (/map, /rooms, /route?from=118) не должна
// заканчиваться серверной ошибкой «404 — страница не найдена». Основной механизм —
// public/.htaccess и try_files в nginx (см. deploy/reg-ru.md), а клиентская страховка —
// public/404.html + скрипт spa-fallback:restore в index.html. Тесты ниже запускают
// настоящие скрипты из этих файлов в песочнице и проверяют весь путь возвращения адреса.

const SITE = 'https://logos-guide.ru'

function read(file) {
  return readFileSync(new URL(file, import.meta.url), 'utf8')
}

function extractScript(file, marker) {
  const pattern = new RegExp(`<script>\\s*/\\* ${marker} \\*/([\\s\\S]*?)</script>`)
  const match = read(file).match(pattern)
  assert.ok(match, `${file}: не найден скрипт ${marker}`)
  return match[1]
}

// Мини-окно браузера: location и history меняют один и тот же текущий адрес,
// а все переходы попадают в replaced — по ним видно, что именно сделал скрипт.
function createWindow(href) {
  const state = { url: new URL(href), replaced: [] }
  const apply = (target) => {
    state.replaced.push(target)
    state.url = new URL(target, state.url)
  }
  const window = {
    location: {
      get origin() { return state.url.origin },
      get pathname() { return state.url.pathname },
      get search() { return state.url.search },
      get hash() { return state.url.hash },
      replace: apply,
    },
    history: { replaceState: (_data, _title, target) => apply(target) },
  }
  return { window, state }
}

function runScript(script, href) {
  const { window, state } = createWindow(href)
  const sandbox = { window, URL, URLSearchParams, encodeURIComponent }
  vm.runInNewContext(script, sandbox)
  return state
}

const current = (state) => state.url.pathname + state.url.search + state.url.hash

const captureScript = extractScript('../public/404.html', 'spa-fallback:capture')
const restoreScript = extractScript('../index.html', 'spa-fallback:restore')

test('server 404 page hands the requested address back to the app', () => {
  const captured = runScript(captureScript, `${SITE}/route?from=118&to=214#plan`)
  assert.deepEqual(captured.replaced, ['/?__redirect=' + encodeURIComponent('/route?from=118&to=214#plan')])
  assert.equal(captured.url.pathname, '/')

  const restored = runScript(restoreScript, SITE + captured.replaced[0])
  assert.equal(current(restored), '/route?from=118&to=214#plan')
})

test('every routed page survives a hard reload without a server rewrite', () => {
  for (const path of ['/map', '/rooms', '/games', '/services', '/about', '/route?mode=lift', '/creators']) {
    const captured = runScript(captureScript, SITE + path)
    const restored = runScript(restoreScript, SITE + captured.replaced[0])
    assert.equal(current(restored), path, path)
  }
})

test('404 page does not redirect the site root and cannot loop', () => {
  for (const href of [`${SITE}/`, SITE]) {
    const state = runScript(captureScript, href)
    assert.deepEqual(state.replaced, [], href)
  }
})

test('restore script keeps unrelated query parameters and ignores missing ones', () => {
  const merged = runScript(restoreScript, `${SITE}/?__redirect=%2Fmap&lang=en`)
  assert.equal(current(merged), '/map?lang=en')

  const untouched = runScript(restoreScript, `${SITE}/map?floor=2`)
  assert.deepEqual(untouched.replaced, [])
  assert.equal(current(untouched), '/map?floor=2')
})

test('restore script rejects external addresses', () => {
  for (const target of ['//evil.example/steal', 'https://evil.example/steal', '/\\evil.example']) {
    const state = runScript(restoreScript, `${SITE}/?__redirect=${encodeURIComponent(target)}`)
    assert.equal(state.url.origin, SITE, target)
    assert.equal(state.url.pathname, '/', target)
  }
})

test('restore script runs before the application bundle boots', () => {
  const source = read('../index.html')
  assert.ok(source.indexOf('spa-fallback:restore') > -1)
  assert.ok(source.indexOf('spa-fallback:restore') < source.indexOf('type="module"'))
})

test('apache fallback ships with the build and keeps real files intact', () => {
  const htaccess = read('../public/.htaccess')
  assert.match(htaccess, /RewriteEngine On/)
  assert.match(htaccess, /RewriteCond %\{REQUEST_FILENAME\} -f/)
  assert.match(htaccess, /RewriteRule \^ index\.html \[L\]/)
  // Страховка на случай отключённого mod_rewrite.
  assert.match(htaccess, /ErrorDocument 404 \/404\.html/)
})

test('nginx snippet keeps deep links on index.html', () => {
  const nginx = read('../deploy/nginx-spa.conf')
  assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html;/)
  assert.match(nginx, /error_page 404 \/404\.html;/)
})
