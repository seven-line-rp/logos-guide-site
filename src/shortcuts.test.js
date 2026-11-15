import test from 'node:test'
import assert from 'node:assert/strict'
import { isSearchShortcut } from './shortcuts.js'

test('Ctrl+K and Cmd+K open search on Latin and Russian layouts', () => {
  for (const key of ['k', 'K', 'к', 'л']) {
    assert.equal(isSearchShortcut({ key, ctrlKey: true }), true)
    assert.equal(isSearchShortcut({ key, metaKey: true }), true)
  }
  assert.equal(isSearchShortcut({ code: 'KeyK', key: 'л', ctrlKey: true }), true)
  assert.equal(isSearchShortcut({ key: 'j', ctrlKey: true }), false)
})

test('a bare letter K no longer opens search (WCAG 2.1.4)', () => {
  for (const key of ['k', 'K', 'к', 'л']) assert.equal(isSearchShortcut({ key }), false)
})

test('slash opens search outside of text fields and can be switched off', () => {
  assert.equal(isSearchShortcut({ key: '/' }), true)
  assert.equal(isSearchShortcut({ key: '.', code: 'Slash' }), true)
  assert.equal(isSearchShortcut({ key: '/' }, { slash: false }), false)
  assert.equal(isSearchShortcut({ key: '/', target: { closest: () => ({}) } }), false)
  assert.equal(isSearchShortcut({ key: '?', shiftKey: true, code: 'Slash' }), false)
})

test('Ctrl+K works while typing; nothing fires on repeat, composition or Alt', () => {
  assert.equal(isSearchShortcut({ key: 'k', ctrlKey: true, target: { closest: () => ({}) } }), true)
  for (const props of [{ repeat: true }, { isComposing: true }, { altKey: true }, { defaultPrevented: true }]) {
    assert.equal(isSearchShortcut({ key: '/', ...props }), false)
    assert.equal(isSearchShortcut({ key: 'k', ctrlKey: true, ...props }), false)
  }
})
