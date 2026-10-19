import test from 'node:test'
import assert from 'node:assert/strict'
import { transformSync } from '@babel/core'
import localizeJsx from '../scripts/localize-jsx.js'
import { translate, setLanguage, searchableRoom } from './i18n.js'

test('language switches both ways without altering source data', () => {
  setLanguage('en')
  assert.equal(translate('Открыть карту'), 'Open map')
  assert.equal(translate('Язык интерфейса'), 'Interface language')
  assert.equal(translate('Оформление'), 'Appearance')
  assert.equal(translate('Поиск по колледжу'), 'Search the campus')
  assert.equal(translate('Найдите кабинет по номеру или названию. Покажем его на карте и подскажем маршрут.'), 'Find a room by number or name, see it on the map and get directions.')
  assert.equal(translate('Обучение по сайту'), 'Site tour')
  assert.equal(translate('Библиотека (читальный зал) №214'), 'Library (reading room) №214')
  assert.equal(translate('2 этаж · Библиотека'), 'Floor 2 · Library')
  setLanguage('ru')
  assert.equal(translate('Открыть карту'), 'Открыть карту')
  assert.equal(translate(42), 42)
  const element = { type: 'span' }
  assert.equal(translate(element, 'en'), element)
})
test('room search supports both languages regardless of selected locale', () => {
  const room = { name: 'Кабинет физики', number: '211', category: 'Учебные кабинеты', aliases: 'физика' }
  assert.match(searchableRoom(room), /physics/)
  assert.match(searchableRoom(room), /физика/)
  assert.equal(room.name, 'Кабинет физики')
})
test('presentation transform handles nested JSX and accessible labels, not form values or handlers', () => {
  const { code } = transformSync(`const C = () => <div>{items.map(item => <span title="Открыть карту">Кабинеты {item.name}</span>)}<input value="Библиотека" placeholder="Найти кабинет" onChange={onChange} /></div>`, {
    configFile: false, babelrc: false, generatorOpts: { jsescOption: { minimal: true } }, parserOpts: { plugins: ['jsx'] }, plugins: [localizeJsx],
  })
  assert.match(code, /__translate\("Кабинеты /)
  assert.match(code, /__translate\(item.name\)/)
  assert.match(code, /title=\{__translate\("Открыть карту"\)\}/)
  assert.match(code, /placeholder=\{__translate\("Найти кабинет"\)\}/)
  assert.match(code, /value="Библиотека"/)
  assert.match(code, /onChange=\{onChange\}/)
})
