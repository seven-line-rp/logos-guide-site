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

test('the voice, music, videos and poster are in the repository', () => {
  for (const file of ['voice.mp3', 'music.mp3', 'logos-promo.mp4', 'logos-promo-video.mp4', 'poster.jpg']) assert.ok(existsSync(new URL(`../public/promo/${file}`, import.meta.url)), file)
})

test('every screen the video shows was captured', () => {
  const shots = JSON.parse(readFileSync(new URL('./admin/promo-shots.json', import.meta.url), 'utf8'))
  for (const [name, shot] of Object.entries(shots)) assert.ok(existsSync(new URL(`../public${shot.src}`, import.meta.url)), name)
  const stage = readFileSync(new URL('./admin/PromoStage.jsx', import.meta.url), 'utf8')
  for (const name of new Set([...stage.matchAll(/(?<![\w-])shots(?:\.([a-z]+)|\['([a-z0-9-]+)'\])/g)].map((match) => match[1] || match[2]))) assert.ok(shots[name], `снимок ${name} есть в promo-shots.json`)
})

test('the voice-over guide lists every phrase file', () => {
  const guide = readFileSync(new URL('../promo-voice/README.md', import.meta.url), 'utf8')
  PROMO_LINES.forEach((line, index) => assert.ok(guide.includes(`${String(index + 1).padStart(2, '0')}-${line.id}.`), line.id))
})

test('promo files are not cached for offline use', () => {
  assert.match(readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8'), /OFFLINE_SKIP = \/\^\([^)]*promo\\\//)
})

// Мультик «Mr.Брекин спешит на помощь» (/admin/cartoon) — отдельный ролик со своим сценарием.
test('the cartoon script, voice timings and files match', async () => {
  const { CARTOON_LINES, CARTOON_SCENES } = await import('./admin/cartoon-script.js')
  const cartoon = JSON.parse(readFileSync(new URL('./admin/cartoon-timeline.json', import.meta.url), 'utf8'))
  assert.deepEqual(cartoon.lines.map((line) => line.id), CARTOON_LINES.map((line) => line.id), 'фразы и тайминги из одной сборки')
  let previous = 0
  for (const line of cartoon.lines) {
    assert.ok(line.start >= previous && line.end > line.start, `${line.id}: ${line.start}–${line.end}`)
    previous = line.end
  }
  assert.deepEqual([...new Set(CARTOON_LINES.map((line) => line.scene))], CARTOON_SCENES, 'сцены идут по порядку')
  for (const line of CARTOON_LINES) assert.ok(['student', 'brekin', 'narrator'].includes(line.voice), `${line.id}: голос ${line.voice}`)
  for (const file of ['voice.mp3', 'music.mp3', 'logos-cartoon.mp4', 'poster.jpg']) assert.ok(existsSync(new URL(`../public/promo/cartoon/${file}`, import.meta.url)), file)
})
