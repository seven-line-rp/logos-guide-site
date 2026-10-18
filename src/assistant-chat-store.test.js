import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIVE_CHAT_STORAGE_KEY, CHATS_STORAGE_KEY, EMPTY_CHAT_TITLE, HISTORY_SENT_TO_MODEL, MAX_CHATS,
  chatPreview, createChat, createMemoryStore, formatChatTime, historyForModel, messageCountLabel,
  readActiveChatId, readChats, removeChat, renameChat, titleFromMessages, upsertChat,
  writeActiveChatId, writeChats,
} from './assistant-chat-store.js'

const message = (role, content, at = '2026-10-18T10:00:00.000Z') => ({ id: `${role}-${content.length}-${at}`, role, content, at })

test('a fresh chat starts empty and gets a title from the first question', () => {
  const chat = createChat('2026-10-18T10:00:00.000Z')
  assert.equal(chat.title, EMPTY_CHAT_TITLE)
  assert.deepEqual(chat.messages, [])
  assert.equal(titleFromMessages([message('assistant', 'Привет!')]), EMPTY_CHAT_TITLE)
  assert.equal(titleFromMessages([message('user', 'Где находится библиотека?')]), 'Где находится библиотека?')
  const long = 'Р'.repeat(80)
  assert.equal(titleFromMessages([message('user', long)]).length, 43)
  assert.match(titleFromMessages([message('user', long)]), /…$/)
})

test('chats survive a reload and broken records are dropped', () => {
  const store = createMemoryStore()
  const chat = createChat('2026-10-18T10:00:00.000Z')
  chat.messages = [message('user', 'Где столовая?'), message('assistant', 'Столовая на первом этаже.')]
  writeChats([chat], store)
  writeActiveChatId(chat.id, store)

  const restored = readChats(store)
  assert.equal(restored.length, 1)
  assert.equal(restored[0].id, chat.id)
  assert.equal(restored[0].messages.length, 2)
  assert.equal(readActiveChatId(store), chat.id)

  store.setItem(CHATS_STORAGE_KEY, '{ не JSON')
  assert.deepEqual(readChats(store), [])
  store.setItem(CHATS_STORAGE_KEY, JSON.stringify([null, 42, { messages: 'не массив' }, { id: 'ok', messages: [{ role: 'user', content: 'вопрос' }, { role: 'system', content: 'лишнее' }] }]))
  const normalized = readChats(store)
  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].id, 'ok')
  assert.equal(normalized[0].messages.length, 1, 'unsupported roles are dropped')
  assert.equal(normalized[0].title, 'вопрос')
})

test('the newest chat goes first and the list is capped', () => {
  let chats = []
  for (let index = 0; index < MAX_CHATS + 5; index += 1) {
    const chat = createChat(`2026-10-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`)
    chats = upsertChat(chats, { ...chat, updatedAt: `2026-10-18T${String(index % 24).padStart(2, '0')}:00:00.000Z` })
  }
  assert.equal(chats.length, MAX_CHATS)
  const times = chats.map((chat) => chat.updatedAt)
  assert.deepEqual(times, [...times].sort().reverse(), 'sorted by the last message')
  assert.deepEqual(removeChat(chats, chats[0].id).length, MAX_CHATS - 1)
})

test('updating a chat moves it to the top instead of duplicating it', () => {
  const first = createChat('2026-10-18T09:00:00.000Z')
  const second = createChat('2026-10-18T10:00:00.000Z')
  let chats = upsertChat([first], second)
  chats = upsertChat(chats, { ...first, updatedAt: '2026-10-18T11:00:00.000Z' })
  assert.equal(chats.length, 2)
  assert.equal(chats[0].id, first.id)
})

test('a chat can be renamed and falls back to the first question', () => {
  const chat = { ...createChat(), messages: [message('user', 'Где библиотека?')] }
  assert.equal(renameChat([chat], chat.id, '  Карта  ')[0].title, 'Карта')
  assert.equal(renameChat([chat], chat.id, '   ')[0].title, 'Где библиотека?')
  assert.equal(renameChat([chat], 'other', 'Имя')[0].title, EMPTY_CHAT_TITLE)
})

test('a route card survives the reload with the message', () => {
  const store = createMemoryStore()
  const route = {
    fromId: 'canteen', toId: 'library-214', fromLabel: 'Столовая', toLabel: 'Библиотека (читальный зал) №214',
    fromFloor: 1, toFloor: 2, crossFloor: true, samePlace: false, meters: 78, minutes: 2, footsteps: 111,
    transfer: 'лифт', variants: 4, link: '/route?from=canteen&to=library-214&ai=1',
  }
  const chat = { ...createChat(), messages: [message('user', 'Построй маршрут'), { ...message('assistant', 'Строю'), route }] }
  writeChats([chat], store)
  const restored = readChats(store)[0]
  assert.equal(restored.messages[1].route.fromId, 'canteen')
  assert.equal(restored.messages[1].route.meters, 78)
  assert.equal(restored.messages[1].route.link, '/route?from=canteen&to=library-214&ai=1')

  store.setItem(CHATS_STORAGE_KEY, JSON.stringify([{
    id: 'broken',
    messages: [{ role: 'assistant', content: 'Строю', route: { fromId: 'canteen' } }, { role: 'user', content: 'привет', route: { fromId: 'a', toId: 'b' } }],
  }]))
  const cleaned = readChats(store)[0]
  assert.equal(cleaned.messages.length, 2)
  assert.equal(cleaned.messages[0].route, undefined, 'неполная карточка отбрасывается')
  assert.equal(cleaned.messages[1].route, undefined, 'у пользовательских сообщений карточки не бывает')
})

test('only a short tail of the conversation is sent to the model', () => {
  const messages = Array.from({ length: HISTORY_SENT_TO_MODEL + 8 }, (_, index) => message(index % 2 ? 'assistant' : 'user', `сообщение ${index}`))
  const history = historyForModel(messages)
  assert.equal(history.length, HISTORY_SENT_TO_MODEL)
  assert.equal(history.at(-1).content, `сообщение ${messages.length - 1}`)
  assert.deepEqual(Object.keys(history[0]), ['role', 'content'], 'ids and timestamps stay in the browser')
})

test('sidebar labels are readable', () => {
  assert.equal(messageCountLabel(1), '1 сообщение')
  assert.equal(messageCountLabel(3), '3 сообщения')
  assert.equal(messageCountLabel(5), '5 сообщений')
  assert.equal(messageCountLabel(11), '11 сообщений')
  assert.equal(messageCountLabel(21), '21 сообщение')
  assert.equal(chatPreview({ messages: [] }), 'Пустой диалог')
  assert.equal(chatPreview({ messages: [message('user', 'Где столовая?')] }), 'Вы: Где столовая?')
  assert.equal(chatPreview({ messages: [message('assistant', 'Р'.repeat(90))] }), `Р`.repeat(60) + '…')
  assert.equal(formatChatTime('не дата'), '')
  assert.match(formatChatTime(new Date(Date.now() - 120_000).toISOString()), /мин назад/)
  assert.match(formatChatTime('2020-01-05T10:00:00.000Z'), /^05\.01\.20$/)
  const store = createMemoryStore()
  writeActiveChatId('', store)
  assert.equal(readActiveChatId(store), '')
  assert.equal(store.getItem(ACTIVE_CHAT_STORAGE_KEY), null)
})
