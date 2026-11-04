import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { PROMO_LINES, PROMO_SCENES } from './admin/promo-script.js'

// Мат в сценарии мультика: версия без мата их не содержит.
const VULGAR = /ёб|еб твою|хрен|охуе|сука|блять|нахуй|пизд|хуй/i

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
// У него две версии ролика: с матом (adult) и без (clean).
test('the cartoon script, voice timings and files match', async () => {
  const { CARTOON_LINES, CARTOON_SCENES, CARTOON_VERSIONS, cartoonLine } = await import('./admin/cartoon-script.js')
  assert.deepEqual([...new Set(CARTOON_LINES.map((line) => line.scene))], CARTOON_SCENES, 'сцены идут по порядку')
  for (const line of CARTOON_LINES) {
    assert.ok(['student', 'brekin', 'narrator'].includes(line.voice), `${line.id}: голос ${line.voice}`)
    assert.ok(line.say && line.caption, `${line.id}: есть что сказать и что написать`)
    assert.ok(line.clean?.say && line.clean?.caption, `${line.id}: есть версия без мата`)
  }
  for (const version of CARTOON_VERSIONS) {
    const timeline = JSON.parse(readFileSync(new URL(`./admin/cartoon-timeline${version.id === 'clean' ? '-clean' : ''}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(timeline.lines.map((line) => line.id), CARTOON_LINES.map((line) => line.id), `${version.id}: фразы и тайминги из одной сборки`)
    let previous = 0
    for (const line of timeline.lines) {
      assert.ok(line.start >= previous && line.end > line.start, `${version.id} ${line.id}: ${line.start}–${line.end}`)
      previous = line.end
    }
    for (const file of [version.video, version.poster]) assert.ok(existsSync(new URL(`../public${file}`, import.meta.url)), `${version.id}: ${file}`)
  }
  const clean = CARTOON_LINES.map((line) => cartoonLine(line, 'clean'))
  assert.ok(clean.every((line) => !VULGAR.test(`${line.say} ${line.caption}`)), 'в версии без мата нет мата')
  assert.ok(CARTOON_LINES.some((line) => VULGAR.test(`${line.say} ${line.caption}`)), 'в версии с матом он есть')
})

// Файлы голоса и музыки у версий свои, иначе одна версия звучала бы голосом другой.
test('each cartoon version has its own voice and music', async () => {
  const { CARTOON_VERSIONS } = await import('./admin/cartoon-script.js')
  const files = CARTOON_VERSIONS.map((version) => [version.id, readFileSync(new URL(`../public/promo/cartoon/voice${version.id === 'clean' ? '-clean' : ''}.mp3`, import.meta.url))])
  assert.notEqual(createHash('sha1').update(files[0][1]).digest('hex'), createHash('sha1').update(files[1][1]).digest('hex'), 'голоса версий не один и тот же файл')
  for (const version of CARTOON_VERSIONS) {
    const name = version.id === 'clean' ? '-clean' : ''
    assert.ok(existsSync(new URL(`../public/promo/cartoon/music${name}.mp3`, import.meta.url)), `музыка ${version.id}`)
    assert.ok(existsSync(new URL(`../public/promo/cartoon/voice${name}.mp3`, import.meta.url)), `голос ${version.id}`)
  }
})

// Вторая серия мультика, «Вайб-кодинг» (cartoon2-script.js): те же правила, что у первой.
test('the second cartoon episode has both versions with their own timings and files', async () => {
  const { CARTOON2_LINES, CARTOON2_SCENES, CARTOON2_VERSIONS } = await import('./admin/cartoon2-script.js')
  assert.deepEqual([...new Set(CARTOON2_LINES.map((line) => line.scene))], CARTOON2_SCENES, 'сцены идут по порядку')
  for (const line of CARTOON2_LINES) {
    assert.ok(['student', 'teacher', 'brekin', 'narrator'].includes(line.voice), `${line.id}: голос ${line.voice}`)
    assert.ok(line.say && line.clean?.say, `${line.id}: есть обе версии`)
  }
  for (const version of CARTOON2_VERSIONS) {
    const timeline = JSON.parse(readFileSync(new URL(`./admin/cartoon2-timeline${version.id === 'clean' ? '-clean' : ''}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(timeline.lines.map((line) => line.id), CARTOON2_LINES.map((line) => line.id), `${version.id}: фразы и тайминги из одной сборки`)
    for (const file of [version.video, version.poster, version.voice, version.music]) assert.ok(existsSync(new URL(`../public${file}`, import.meta.url)), `${version.id}: ${file}`)
  }
  assert.ok(CARTOON2_LINES.every((line) => !VULGAR.test(`${line.clean.say} ${line.clean.caption}`)), 'в версии без мата нет мата')
  assert.ok(CARTOON2_LINES.some((line) => VULGAR.test(line.say)), 'в версии с матом он есть')
  const burst = CARTOON2_LINES.find((line) => line.id === 'burst')
  assert.match(burst.clean.caption, /с ПОМОЩЬЮ ИИ/)
})

// В версии «с матом» мат звучит, а не только написан: облачков в кадре нет.
test('the adult cartoon voice actually swears', async () => {
  const { CARTOON_LINES } = await import('./admin/cartoon-script.js')
  assert.ok(CARTOON_LINES.filter((line) => VULGAR.test(line.say)).length >= 3)
})

// Ролики пересобираются под теми же именами. Чтобы после обновления не показывалась
// старая копия (так на сайте был промо-ролик без рекламной паузы), сервис-воркер
// не кэширует /promo/, а панель грузит ролики с версией сайта в адресе.
test('promo videos are never served stale', () => {
  const sw = readFileSync(new URL('../scripts/sw-template.js', import.meta.url), 'utf8')
  assert.match(sw, /pathname\.startsWith\('\/promo\/'\)\) return/, 'сервис-воркер пропускает /promo/ в сеть')
  for (const page of ['AdminPromo.jsx', 'AdminCartoon.jsx']) assert.match(readFileSync(new URL(`./admin/${page}`, import.meta.url), 'utf8'), /fresh\(/, `${page}: адреса с версией`)
  assert.match(readFileSync(new URL('../public/.htaccess', import.meta.url), 'utf8'), /mp4\|webm\|mp3\)\$">\s*Header set Cache-Control "no-cache"/, '.htaccess: видео перепроверяется')
})
