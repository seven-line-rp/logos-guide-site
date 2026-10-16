import test from 'node:test'
import assert from 'node:assert/strict'
import { isSearchShortcut } from './shortcuts.js'

test('K opens search on Latin and Russian layouts without modifiers', () => {
  for (const key of ['k', 'K', 'к', 'К', 'л', 'Л']) assert.equal(isSearchShortcut({ key }), true)
  assert.equal(isSearchShortcut({ code: 'KeyK', key: 'л' }), true)
  assert.equal(isSearchShortcut({ key: 'k', ctrlKey: true }), true)
  assert.equal(isSearchShortcut({ key: 'k', metaKey: true }), true)
  assert.equal(isSearchShortcut({ key: 'j' }), false)
})
test('search shortcut never interrupts typing, composition or key repeat', () => {
  for (const props of [{ repeat: true }, { isComposing: true }, { altKey: true }, { defaultPrevented: true }, { target: { isContentEditable: true } }, { target: { closest: () => ({}) } }]) {
    assert.equal(isSearchShortcut({ key: 'k', ...props }), false)
  }
})
