import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeries, dayKeys, pageRanking, periodTotals, qrRanking } from './stats-model.js'

const hours = (map) => Array.from({ length: 24 }, (_, hour) => map[hour] || 0)
const days = {
  '2026-10-20': { v: 10, u: 4, q: { 'room-a': 1 }, p: { '/map': 6, '/': 4 }, h: hours({ 9: 10 }) },
  '2026-10-25': { v: 30, u: 12, q: { 'room-a': 2, 'room-b': 5 }, p: { '/map': 20, '/ai': 10 }, h: hours({ 10: 20, 11: 10 }) },
  '2026-10-26': { v: 8, u: 3, q: { 'room-b': 1 }, p: { '/': 8 }, h: hours({ 8: 8 }) },
}
const today = '2026-10-26'

test('dayKeys includes both ends', () => {
  assert.deepEqual(dayKeys('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
})

test('week series is seven days with zeros for silent days', () => {
  const series = buildSeries(days, today, 'week', 'u')
  assert.equal(series.length, 7)
  assert.equal(series[0].key, '2026-10-20')
  assert.equal(series[0].value, 4)
  assert.equal(series[1].value, 0)
  assert.equal(series[6].value, 3)
})

test('day series is hourly', () => {
  const series = buildSeries(days, today, 'day', 'v')
  assert.equal(series.length, 24)
  assert.equal(series[8].value, 8)
})

test('all-time groups by month once there is enough history', () => {
  const long = { ...days, '2026-08-03': { v: 5, u: 2, q: {}, p: {}, h: hours({}) } }
  const series = buildSeries(long, today, 'all', 'v')
  assert.deepEqual(series.map((item) => item.key), ['2026-08', '2026-09', '2026-10'])
  assert.equal(series[2].value, 48)
})

test('totals compare with the previous period', () => {
  const { totals } = periodTotals(days, today, 'week')
  assert.equal(totals.u.value, 19)
  assert.equal(totals.v.value, 48)
  assert.equal(totals.qr.value, 9)
  const month = periodTotals(days, today, 'month')
  assert.equal(month.totals.u.value, 19)
  assert.equal(month.totals.u.previous, 0)
  assert.equal(month.totals.u.delta, null)
  assert.equal(periodTotals(days, today, 'all').totals.u.previous, null)
})

test('rankings are sorted by count', () => {
  const keys = dayKeys('2026-10-20', today)
  assert.deepEqual(qrRanking(days, keys), [{ room: 'room-b', count: 6 }, { room: 'room-a', count: 3 }])
  assert.equal(pageRanking(days, keys)[0].path, '/map')
})

test('empty data yields flat zero series', () => {
  assert.ok(buildSeries({}, today, 'month', 'u').every((item) => item.value === 0))
  assert.equal(buildSeries({}, today, 'all', 'u').length, 1)
})
