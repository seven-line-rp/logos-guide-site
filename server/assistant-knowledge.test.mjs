import test from 'node:test'
import assert from 'node:assert/strict'
import { ASSISTANT_SYSTEM_PROMPT } from './assistant-knowledge.mjs'
import { navigation, rooms } from '../src/data.js'

test('the assistant knows who it is and who built it', () => {
  assert.match(ASSISTANT_SYSTEM_PROMPT, /LOGOS AI/)
  assert.match(ASSISTANT_SYSTEM_PROMPT, /Логос: Путеводитель/)
  assert.match(ASSISTANT_SYSTEM_PROMPT, /Лисовой Данила, студент 1-го курса группы П-1/)
  assert.match(ASSISTANT_SYSTEM_PROMPT, /не раскрываешь, какая модель, API или провайдер/)
})

test('the assistant knows the tour command and that chats live in the browser', () => {
  assert.match(ASSISTANT_SYSTEM_PROMPT, /«Туторил»/)
  assert.match(ASSISTANT_SYSTEM_PROMPT, /Диалоги хранятся только в браузере пользователя/)
})

test('the retired open day feature is gone from the knowledge base', () => {
  assert.doesNotMatch(ASSISTANT_SYSTEM_PROMPT, /открытых дверей/i)
  assert.doesNotMatch(ASSISTANT_SYSTEM_PROMPT, /площадк/i)
  assert.doesNotMatch(ASSISTANT_SYSTEM_PROMPT, /DeepSeek/i)
})

test('every room and page of the site is in the knowledge base', () => {
  for (const item of navigation) {
    assert.ok(ASSISTANT_SYSTEM_PROMPT.includes(`${item.label} — ${item.to}`), item.to)
  }
  for (const room of rooms) {
    assert.ok(ASSISTANT_SYSTEM_PROMPT.includes(`/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`), room.id)
  }
})
