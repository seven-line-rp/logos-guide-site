import test from 'node:test'
import assert from 'node:assert/strict'
import { rooms } from './data.js'
import { normalizeQuote, portraitUrl, teacherProfiles, withProfiles } from './teacher-profiles.js'

test('portrait file is named «Имя Фамилия.png»', () => {
  assert.equal(decodeURIComponent(portraitUrl('Полянский Александр Александрович')), '/teachers/Александр Полянский.png')
})

test('profiles attach to teachers and extras are added once', () => {
  const list = withProfiles([{ name: 'Золотарев Владимир Владимирович' }, { name: 'Иванов Иван Иванович' }])
  assert.ok(list[0].profile)
  assert.equal(list[1].profile, undefined)
  assert.ok(list.some((teacher) => teacher.name === 'Полянский Александр Александрович'))
  assert.equal(withProfiles([{ name: 'Елисов Андрей Владимирович' }]).filter((teacher) => teacher.name === 'Елисов Андрей Владимирович').length, 1)
})

test('every profile place points to a real room and every quote has text', () => {
  for (const profile of Object.values(teacherProfiles)) {
    if (profile.place?.roomId) assert.ok(rooms.some((room) => room.id === profile.place.roomId), profile.place.roomId)
    for (const quote of profile.quotes || []) assert.ok(normalizeQuote(quote).text)
  }
})
