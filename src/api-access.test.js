import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

// public/api/.htaccess пускает снаружи только файлы из белого списка, остальное
// хостинг закрывает с 403. Тест сверяет список с адресами, которые реально
// вызывает сайт: новый эндпоинт без записи в .htaccess упадёт здесь, а не на проде.

const rule = readFileSync('public/api/.htaccess', 'utf8').match(/<FilesMatch "([^"]+)">/)[1]
const blocked = new RegExp(rule)
const sources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sources(`${dir}/${entry.name}`) : /\.(jsx?|mjs)$/.test(entry.name) && !entry.name.endsWith('.test.js') ? [`${dir}/${entry.name}`] : [])
const called = new Set([...sources('src'), 'scripts/sw-template.js'].flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/\/api\/([\w-]+\.php)/g)].map((match) => match[1])))

test('every endpoint the site calls is open in api/.htaccess', () => {
  assert.ok(!called.has('notify.php') && !called.has('ai-chat.php') && called.has('notices.php'), 'нашли вызовы эндпоинтов')
  for (const file of called) assert.ok(!blocked.test(file), `${file} закрыт в public/api/.htaccess — добавьте его в FilesMatch`)
})

test('helper scripts, config and data stay closed', () => {
  for (const file of ['notify-lib.php', 'ai-guard.php', 'alert.php', 'ai-config.php', 'ai-knowledge.txt', 'push-meta.json']) assert.ok(blocked.test(file), `${file} должен быть закрыт`)
})
