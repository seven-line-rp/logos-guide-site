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

test('every kind has a sample, and a lesson sample uses the schedule', () => {
  for (const kind of Object.keys(PUSH_KINDS)) {
    const sample = samplePush(kind)
    assert.equal(sample.kind, kind)
    assert.ok(sample.title && sample.body && sample.url.startsWith('/'))
  }
  const lesson = { date: '2026-10-27', start: '10:40', end: '12:10', subject: 'Физика', roomId: 'physics-211' }
  const sample = samplePush('lesson-start', { lesson, roomLabel: 'Кабинет физики №211' })
  assert.equal(sample.title, 'Через 5 минут: Физика')
  assert.equal(sample.url, '/route?to=physics-211')
  assert.deepEqual(notificationOptions(sample).actions, [{ action: 'open', title: 'Маршрут' }])
  assert.equal(notificationOptions(samplePush('event')).actions, undefined)
})

test('topics default to everything and keys decode from base64url', () => {
  assert.deepEqual(readTopics(), ALL_TOPICS)
  assert.deepEqual([...base64UrlToBytes('-_8')], [251, 255])
})

test('the service worker shows pushes, opens links and keeps the schedule cache', () => {
  const sw = readFileSync('scripts/sw-template.js', 'utf8')
  assert.match(sw, /addEventListener\('push'/)
  assert.match(sw, /addEventListener\('notificationclick'/)
  assert.match(sw, /caches\.open\('push-data'\)/)
  // Очистка старых версий удаляет только кэши «logos-…», кэш расписания под другим именем.
  assert.ok(!'push-data'.startsWith('logos-'))
})

test('in-app browsers are recognised, normal ones are not', () => {
  assert.equal(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'), true)
  assert.equal(inAppBrowser('Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0'), true)
  assert.equal(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'), false)
  assert.equal(inAppBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0'), false)
})

test('reminders come 5 minutes before each of today\'s own lessons, not before past ones', async () => {
  const { lessonReminders } = await import('./push.js')
  const lessons = [
    { date: '2026-10-27', start: '09:00', end: '10:30', subject: 'История', roomId: 'physics-211' },
    { date: '2026-10-27', start: '10:40', end: '12:10', subject: 'Физика', roomId: 'physics-211' },
    { date: '2026-10-27', start: '13:15', end: '14:00', subject: 'Факультатив', roomId: 'physics-211' },
    { date: '2026-10-28', start: '09:00', end: '10:30', subject: 'Завтра', roomId: 'physics-211' },
  ]
  const plan = lessonReminders(lessons, new Date(2026, 9, 27, 10, 30))
  assert.deepEqual(plan.map((item) => item.push.title), ['Через 5 минут: Физика', 'Через 5 минут: Факультатив'])
  assert.equal(plan[0].delay, 5 * 60_000)
  assert.equal(plan[0].push.tag, 'lesson-2026-10-27-10:40', 'тот же tag, что ставит сервис-воркер: дубля не будет')
  assert.equal(plan[1].delay, (13 * 60 + 10 - 10 * 60 - 30) * 60_000, 'пара не по звонкам тоже напомнит')
  const late = lessonReminders(lessons, new Date(2026, 9, 27, 10, 37))
  assert.equal(late[0].delay, 0, 'открыли сайт за 3 минуты до пары — напоминаем сразу')
})
