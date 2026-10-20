import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRouteOptions } from './map-routing.js'
import { HERE_MAX_AGE, crowdMoment, parseHere, withCrowd } from './route-prefs.js'

const at = (time) => new Date(`2026-10-20T${time}:00`) // вторник

test('«я здесь» forgets unknown rooms and old visits', () => {
  const now = Date.parse('2026-10-20T12:00:00')
  assert.deepEqual(parseHere(JSON.stringify({ roomId: 'physics-211', at: now - 1000 }), now), { roomId: 'physics-211', at: now - 1000 })
  assert.equal(parseHere(JSON.stringify({ roomId: 'physics-211', at: now - HERE_MAX_AGE - 1 }), now), null)
  assert.equal(parseHere(JSON.stringify({ roomId: 'nope', at: now }), now), null)
  assert.equal(parseHere('{broken', now), null)
  assert.equal(parseHere(null, now), null)
})

test('breaks and lunch make transfers slower, lessons do not', () => {
  assert.equal(crowdMoment(at('10:35')).kind, 'break')
  assert.equal(crowdMoment(at('12:15')).kind, 'lunch')
  assert.equal(crowdMoment(at('08:55')).kind, 'before')
  assert.equal(crowdMoment(at('08:00')), null)
  assert.equal(crowdMoment(at('10:00')), null)
  assert.equal(crowdMoment(new Date('2026-10-25T10:35:00')), null, 'в воскресенье пар нет')
})

test('crowd time is added to transfers only and options stay sorted', () => {
  const plain = buildRouteOptions('entrance-1', 'physics-211')
  const crowded = withCrowd(plain, { kind: 'break', left: 5 })
  assert.equal(crowded.length, plain.length)
  for (let index = 1; index < crowded.length; index += 1) assert.ok(crowded[index].seconds >= crowded[index - 1].seconds)
  const lift = crowded.find((option) => option.kind === 'lift')
  assert.equal(lift.crowdSeconds, 60)
  assert.equal(lift.seconds, plain.find((option) => option.kind === 'lift').seconds + 60)
  const sameFloor = buildRouteOptions('canteen', 'class-118')
  assert.deepEqual(withCrowd(sameFloor, { kind: 'break', left: 5 }), sameFloor)
  assert.equal(withCrowd(plain, null), plain)
})
