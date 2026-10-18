import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findRoom, normalizeText, parseIntent, rankRooms, roomAnswer, routePreview, scanRooms,
} from './assistant-intents.js'
import { rooms } from './data.js'

test('rooms are found by name, number, alias and in any case form', () => {
  assert.equal(findRoom('Столовая')?.id, 'canteen')
  assert.equal(findRoom('столовой')?.id, 'canteen', 'родительный падеж')
  assert.equal(findRoom('из столовой')?.id, 'canteen', 'предлог не мешает')
  assert.equal(findRoom('Библиотеки')?.id, 'library-214')
  assert.equal(findRoom('читальный зал')?.id, 'library-214', 'по псевдониму')
  assert.equal(findRoom('214')?.id, 'library-214', 'по номеру')
  assert.equal(findRoom('учебная часть')?.id, 'academic-office')
  assert.equal(findRoom('актовый зал')?.id, 'auditorium-104')
  assert.equal(findRoom('буфет')?.id, 'canteen', 'по слову из псевдонимов')
  assert.equal(findRoom('кабинет физики')?.id, 'physics-211')
  assert.equal(findRoom('пингвины в антарктиде'), null)
  assert.equal(findRoom(''), null)
  assert.equal(findRoom(42), null)
  assert.equal(normalizeText('  СтоЛОВАЯ,  №138! '), 'столовая 138')
  assert.equal(findRoom('№214')?.id, 'library-214', 'номер со знаком №')
})

test('ranking prefers an exact number over a loose mention', () => {
  assert.equal(rankRooms('138')[0].room.id, 'class-138')
  const ranked = rankRooms('лестница')
  assert.ok(ranked.length > 1, 'несколько лестниц — несколько вариантов')
  assert.ok(ranked.every((item) => item.room.id.startsWith('stairs-')))
  assert.deepEqual(rankRooms('и'), [], 'союзы не считаются запросом')
})

test('rooms are located inside a whole sentence', () => {
  const mentions = scanRooms('построй маршрут от столовой до библиотеки')
  assert.deepEqual(mentions.map((item) => item.room.id), ['canteen', 'library-214'])
  assert.deepEqual(scanRooms('где тут физика и столовая').map((item) => item.room.id), ['physics-211', 'canteen'], 'союз «и» не даёт лишнего кабинета')
  assert.deepEqual(scanRooms('привет, как дела'), [])
})

test('a route request turns into a real route on the map', () => {
  for (const text of [
    'Построй маршрут от Столовой до Библиотеки',
    'построй маршрут от столовой до библиотеки',
    'как дойти из столовой в библиотеку',
    'маршрут Столовая → Библиотека',
    'Построй маршрут от 138 до библиотеки',
    'Проведи меня от актового зала до кабинета физики',
  ]) {
    const intent = parseIntent(text)
    assert.equal(intent?.kind, 'route', text)
    assert.ok(intent.route.link.startsWith('/route?from='), text)
    assert.ok(intent.route.link.includes('&ai=1'), text)
    assert.match(intent.content, /Строю маршрут по плану колледжа/)
  }
  const intent = parseIntent('Построй маршрут от Столовой до Библиотеки')
  assert.equal(intent.route.fromId, 'canteen')
  assert.equal(intent.route.toId, 'library-214')
  assert.equal(intent.route.crossFloor, true)
  assert.ok(intent.route.meters > 10, `${intent.route.meters} м`)
  assert.ok(intent.route.minutes >= 1)
  assert.ok(intent.route.footsteps > 10)
  assert.ok(intent.route.transfer.length > 0, 'назван способ перехода')
  assert.ok(intent.route.variants >= 2, 'между этажами несколько вариантов')
})

test('route metrics match the page itself and never invent numbers', () => {
  const across = routePreview('canteen', 'library-214')
  assert.equal(across.samePlace, false)
  const sameFloor = routePreview('canteen', 'workshop-115')
  assert.equal(sameFloor.crossFloor, false)
  assert.equal(sameFloor.transfer, '')
  assert.ok(sameFloor.meters > 0)
  const sameRoom = routePreview('canteen', 'canteen')
  assert.equal(sameRoom.samePlace, true, 'та же точка помечена, а не выдумана')
  assert.equal(sameRoom.meters, 0)
  assert.equal(routePreview('canteen', 'нет-такого'), null)
})

test('the same route request from the same place is not confused', () => {
  const intent = parseIntent('построй маршрут от библиотеки до библиотеки')
  assert.notEqual(intent?.kind, 'route')
})

test('placeholder questions are answered locally, without the model', () => {
  const library = parseIntent('Где находится библиотека?')
  assert.equal(library.kind, 'answer')
  assert.match(library.answer, /Библиотека/)
  assert.match(library.answer, /2 этаж/)
  assert.match(library.answer, /\[Открыть на карте\]\(\/map\?floor=2&room=library-214\)/)
  assert.equal(roomAnswer(rooms.find((room) => room.id === 'canteen')).includes('/map?floor=1&room=canteen'), true)

  const capabilities = parseIntent('Что умеет этот сайт?')
  assert.equal(capabilities.kind, 'answer')
  assert.match(capabilities.answer, /LOGOS AI/)

  const floors = parseIntent('Как построить маршрут между этажами?')
  assert.equal(floors.kind, 'answer')
  assert.match(floors.answer, /лифт и три лестницы/)

  const tour = parseIntent('что за Туторил?')
  assert.equal(tour.kind, 'answer')
  assert.match(tour.answer, /обучени/i)
})

test('half-understood route asks for the missing point instead of guessing', () => {
  const intent = parseIntent('построй маршрут от столовой')
  assert.equal(intent.kind, 'answer')
  assert.match(intent.answer, /Нашёл только одно место/)
  assert.match(intent.answer, /Столовая/)
})

test('questions the assistant cannot verify still go to the model', () => {
  for (const text of ['Кто директор колледжа?', 'какое расписание на завтра', 'сколько стоит обучение', 'расскажи анекдот', 'где взять справку', '']) {
    assert.equal(parseIntent(text), null, text)
  }
})
