import test from 'node:test'
import assert from 'node:assert/strict'
import { CARD, doorCardSvg, fitTitle } from './door-card.js'
import { brandedQrSvg } from './share.js'
import { rooms } from './data.js'
import { signRooms, signFileName } from './signs.js'

test('titles shrink and wrap so that they fit the frame', () => {
  assert.deepEqual(fitTitle('Кабинет врача'), { size: 132, lines: ['КАБИНЕТ', 'ВРАЧА'] })
  const long = fitTitle('Лаборатория биотехнических и медицинских аппаратов №225')
  assert.ok(long.lines.length <= 4 && long.size < 132 && long.size >= 56)
  for (const room of signRooms) {
    const { size, lines } = fitTitle(`${room.name}${room.number ? ` №${room.number}` : ''}`)
    assert.ok(lines.length <= 4 && lines.every((line) => line.length * size * 0.72 <= 1000 + size), room.name)
  }
})

test('door card contains logo, title, floor, QR and the team credits', async () => {
  const room = rooms.find((item) => item.number === '214')
  const qr = await brandedQrSvg('https://example.test/here?room=x')
  const svg = doorCardSvg(room, qr)
  assert.match(svg, new RegExp(`width="${CARD.width}" height="${CARD.height}"`))
  assert.ok(svg.includes('№214') && svg.includes(`${room.floor} ЭТАЖ`))
  assert.ok(svg.includes('Разработано командой'))
  assert.ok(svg.includes('M500.842 131.274'), 'логотип встроен')
  assert.ok(svg.includes('rx="0.32"'), 'QR встроен')
  assert.equal((svg.match(/<svg/g) || []).length, 3, 'корень, логотип и QR')
  assert.ok(!svg.includes('<script') && !/filter=/.test(svg))
  assert.equal(signFileName(room, 'png').endsWith('.png'), true)
})

test('room names with markup are escaped', async () => {
  const svg = doorCardSvg({ name: 'Класс <b>&</b>', number: '', floor: 1 }, await brandedQrSvg('x'))
  assert.ok(!svg.includes('<b>') && svg.includes('&lt;B&gt;&amp;&lt;/B&gt;'))
})
