import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_TOPICS, inAppBrowser, PUSH_KINDS, base64UrlToBytes, detectPlatform, notificationOptions, readTopics, samplePush } from './push.js'

test('platform detection covers Android, iPhone, iPad in desktop mode and computers', () => {
  assert.equal(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0'), 'android')
  assert.equal(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'), 'ios')
  assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5), 'ios')
  assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 0), 'desktop')
  assert.equal(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0'), 'desktop')
})

test('every kind has a sample, and a lesson reminder offers the route', () => {
  for (const kind of Object.keys(PUSH_KINDS)) {
    const sample = samplePush(kind)
    assert.equal(sample.kind, kind)
    assert.ok(sample.title && sample.body && sample.url.startsWith('/'))
  }
  const sample = samplePush('lesson-start')
  assert.equal(sample.title, 'Через 5 минут: 2-я пара')
  assert.equal(sample.url, '/route')
  assert.deepEqual(notificationOptions(sample).actions, [{ action: 'open', title: 'Маршрут' }])
  assert.equal(notificationOptions(samplePush('event')).actions, undefined)
})

test('topics default to everything and keys decode from base64url', () => {
  assert.deepEqual(readTopics(), ALL_TOPICS)
  assert.deepEqual([...base64UrlToBytes('-_8')], [251, 255])
})

test('the service worker shows pushes and opens links; there is no personal schedule in it', () => {
  const sw = readFileSync('scripts/sw-template.js', 'utf8')
  assert.match(sw, /addEventListener\('push'/)
  assert.match(sw, /addEventListener\('notificationclick'/)
  assert.doesNotMatch(sw, /schedule\.json/)
})

test('in-app browsers are recognised, normal ones are not', () => {
  assert.equal(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'), true)
  assert.equal(inAppBrowser('Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0'), true)
  assert.equal(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'), false)
  assert.equal(inAppBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0'), false)
})

test('reminders follow the bells: 5 minutes before each lesson still ahead today', async () => {
  const { lessonReminders } = await import('./push.js')
  // Вторник, 10:30: первая пара прошла, до напоминания о второй 5 минут.
  const plan = lessonReminders(new Date(2026, 9, 27, 10, 30))
  assert.deepEqual(plan.map((item) => item.push.title), ['Через 5 минут: 2-я пара', 'Через 5 минут: 3-я пара', 'Через 5 минут: 4-я пара'])
  assert.equal(plan[0].delay, 5 * 60_000)
  assert.equal(plan[0].push.tag, 'lesson-2026-10-27-10:40', 'тот же tag, что ставит сервис-воркер: дубля не будет')
  assert.equal(lessonReminders(new Date(2026, 9, 27, 8, 0))[0].delay, 55 * 60_000, 'первое напоминание в 8:55')
  assert.equal(lessonReminders(new Date(2026, 9, 27, 10, 37))[0].delay, 0, 'открыли сайт за 3 минуты до пары — напоминаем сразу')
  assert.deepEqual(lessonReminders(new Date(2026, 9, 26, 8, 0)).map((item) => item.bell.start), ['09:00', '09:40', '11:20', '13:10', '15:00'], 'понедельник: свои звонки')
  assert.deepEqual(lessonReminders(new Date(2026, 9, 25, 8, 0)), [], 'воскресенье')
  assert.deepEqual(lessonReminders(new Date(2026, 10, 4, 8, 0)), [], 'праздник')
})
