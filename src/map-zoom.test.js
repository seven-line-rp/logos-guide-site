import test from 'node:test'
import assert from 'node:assert/strict'
import { zoomFrame } from './map-zoom.js'

test('zoom starts from the rendered mobile plan width, not the narrow viewport', () => {
  const first = zoomFrame({ zoom: 1, nextZoom: 1.4, stageWidth: 740, scrollLeft: 0, scrollTop: 0, anchorX: 170, anchorY: 170 })
  assert.equal(first.width, 1036)
  assert.ok(Math.abs(first.left - 68) < 0.001)
  assert.ok(Math.abs(first.top - 68) < 0.001)
  assert.ok(Math.abs(170 * 1.4 - first.left - 170) < 0.001, 'point under the fingers stays in place')

  const back = zoomFrame({ zoom: first.zoom, nextZoom: 1, stageWidth: first.width, scrollLeft: first.left, scrollTop: first.top, anchorX: 170, anchorY: 170 })
  assert.equal(back.width, 740)
  assert.ok(Math.abs(back.left) < 0.001)
})

test('zoom limits are applied without moving an already fully zoomed plan', () => {
  const frame = zoomFrame({ zoom: 3.5, nextZoom: 5, stageWidth: 2590, scrollLeft: 500, scrollTop: 100, anchorX: 170, anchorY: 120 })
  assert.equal(frame.zoom, 3.5)
  assert.equal(frame.width, 2590)
  assert.equal(frame.left, 500)
  assert.equal(frame.top, 100)
})
