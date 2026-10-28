import test from 'node:test'
import assert from 'node:assert/strict'
import { rooms } from './data.js'
import { roomDetails } from './room-info.js'

const room = (id) => rooms.find((item) => item.id === id)
// 20 октября 2026 — вторник, 24 октября — суббота, 25 октября — воскресенье.
const at = (day, time) => new Date(`2026-10-${day}T${time}:00`)

test('classrooms show the bell state: lesson, break, before and after classes', () => {
  assert.deepEqual(roomDetails(room('class-118'), at(20, '10:15')).status, { tone: 'busy', text: 'Идёт 1-я пара, до 10:30' })
  assert.equal(roomDetails(room('physics-211'), at(20, '10:35')).status.text, 'Перемена, к 2-й паре в 10:40')
  assert.equal(roomDetails(room('class-118'), at(20, '08:20')).status.text, 'Занятия начнутся в 09:00')
  assert.equal(roomDetails(room('class-118'), at(20, '17:00')).status.text, 'Пары на сегодня закончились')
  assert.equal(roomDetails(room('class-118'), at(25, '10:00')).status.text, 'Сегодня занятий нет')
  assert.equal(roomDetails(room('uav-lab-209'), at(24, '12:15')).status.tone, 'free')
})

test('canteen lists lunch times and says whose lunch is now', () => {
  const details = roomDetails(room('canteen'), at(20, '12:15'))
  assert.equal(details.status.text, 'Сейчас обед у 1 курса, до 12:30')
  assert.deepEqual(details.facts, [['Обед 1 курса', '12:10–12:30'], ['Обед 2 курса', '14:00–14:20']])
  assert.equal(roomDetails(room('canteen'), at(20, '13:00')).status.text, 'Следующий обед в 14:00, у 2 курса')
})

test('administration shows college office hours; other places stay quiet', () => {
  assert.equal(roomDetails(room('academic-office'), at(20, '09:00')).status.tone, 'free')
  assert.equal(roomDetails(room('academic-office'), at(24, '09:00')).status.tone, 'idle')
  assert.deepEqual(roomDetails(room('toilet-men-1'), at(20, '10:00')), { status: null, facts: [], notes: [] })
  assert.deepEqual(roomDetails(null), { status: null, facts: [], notes: [] })
})

test('notable rooms list what happens there', () => {
  assert.deepEqual(roomDetails(room('canteen'), at(20, '12:15')).notes, ['Проходит обед после определённых пар.', 'Можно купить булочки или сладости.'])
  assert.equal(roomDetails(room('library-214')).notes.length, 3)
  for (const id of ['auditorium-104', 'training-centre-113', 'chemistry-biology-202', 'informatics-222']) assert.ok(roomDetails(room(id)).notes.length > 0, id)
  assert.deepEqual(roomDetails(room('class-118')).notes, [])
})
