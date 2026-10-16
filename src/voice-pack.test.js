import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { VOICE_PACKS, VOICE_PACK_PHRASES, voicePackForPreset } from './voice-pack.js'
import { VOICE_PRESETS } from './speech.js'
import { rooms } from './data.js'
import { buildIndoorRoute } from './map-routing.js'
import { buildRouteSteps } from './route-steps.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('every voice pack phrase has a recorded file for each pack voice', () => {
  assert.ok(Object.keys(VOICE_PACK_PHRASES).length >= 10, 'пакет неожиданно опустел')
  assert.ok(Object.keys(VOICE_PACKS).length >= 2, 'должны быть женская и мужская записи')
  for (const [key, phrase] of Object.entries(VOICE_PACK_PHRASES)) {
    assert.ok(phrase.text, `${key}: у фразы должен быть текст для фолбэка и подписи`)
    for (const pack of Object.values(VOICE_PACKS)) {
      assert.ok(existsSync(path.join(projectRoot, 'public', pack.dir, `${key}.mp3`)), `${pack.dir}: нет записанного файла ${key}.mp3`)
    }
  }
})

test('steps of any route only reference phrases that exist in the pack', () => {
  const name = (room) => `${room.name}${room.number ? ` №${room.number}` : ''}`
  const crossFloor = rooms.filter((room) => room.floor === 1).flatMap((from) =>
    rooms.filter((room) => room.floor === 2).map((to) => [from, to]))
  assert.ok(crossFloor.length > 0)
  for (const [from, to] of crossFloor) {
    for (const transition of ['lift', 'stairs']) {
      const route = buildIndoorRoute(from.id, to.id, transition)
      const steps = buildRouteSteps({
        startLabel: name(from),
        startFloor: from.floor,
        targetFloor: to.floor,
        targetName: name(to),
        route,
        sameRoom: false,
      })
      const cues = steps.flatMap((step) => step.voiceCue || [])
      for (const key of cues) {
        assert.ok(VOICE_PACK_PHRASES[key], `${from.id} → ${to.id}: шаг ссылается на отсутствующую фразу «${key}»`)
      }
      // Манёвры, которые можно записать заранее, всегда озвучиваются пакетом.
      for (const step of steps) {
        if (step.kind === 'transfer' || step.kind === 'arrive' || step.kind === 'guide') {
          assert.ok((step.voiceCue || []).length > 0, `${from.id} → ${to.id}: у шага «${step.title}» нет ключа озвучки`)
        }
      }
    }
  }
})

test('the preset list exposes both recorded navigator voices', () => {
  for (const pack of Object.values(VOICE_PACKS)) {
    assert.ok(VOICE_PRESETS.some((preset) => preset.id === pack.presetId), `в списке голосов нет пресета ${pack.presetId}`)
    assert.equal(voicePackForPreset(pack.presetId).presetId, pack.presetId)
  }
  assert.equal(voicePackForPreset('female'), null, 'обычные пресеты — не пакеты')
})
