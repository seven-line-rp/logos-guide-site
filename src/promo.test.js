import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { PROMO_LINES, PROMO_SCENES } from './admin/promo-script.js'

// Промо-ролик (/admin/promo): сценарий, тайминги озвучки и файлы должны совпадать.
// Если тест упал после правки текста — пересоберите озвучку (docs/promo.md).

const timeline = JSON.parse(readFileSync(new URL('./admin/promo-timeline.json', import.meta.url), 'utf8'))

test('every script line has a voiced slot, in order, inside the track', () => {
  assert.deepEqual(timeline.lines.map((line) => line.id), PROMO_LINES.map((line) => line.id), 'фразы и тайминги из одной сборки')
  let previous = 0
  for (const line of timeline.lines) {
    assert.ok(line.start >= previous && line.end > line.start, `${line.id}: ${line.start}–${line.end}`)
    previous = line.end
  }
  assert.ok(timeline.duration > previous, 'финальный кадр после последней фразы')
})

test('every line points to a scene the stage can draw', () => {
  for (const line of PROMO_LINES) assert.ok(PROMO_SCENES.includes(line.scene), `${line.id}: ${line.scene}`)
  assert.deepEqual([...new Set(PROMO_LINES.map((line) => line.scene))], PROMO_SCENES, 'сцены идут по порядку')
})

test('the voice track and the video are in the repository', () => {
  for (const file of ['../public/promo/voice.mp3', '../public/promo/logos-promo.mp4']) assert.ok(existsSync(new URL(file, import.meta.url)), file)
})

test('promo files are not cached for offline use', () => {
  assert.match(readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8'), /OFFLINE_SKIP = \/\^\([^)]*promo\\\//)
})
