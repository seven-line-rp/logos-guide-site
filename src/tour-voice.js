import { storageGet, storageSet } from './storage.js'

// Озвучка экскурсии: заранее записанные фразы для каждой остановки
// (public/voice/tour/<голос>/<экскурсия>-<номер>.mp3). Записи собирает
// scripts/tour-voice.py офлайн-синтезатором RHVoice — на любом устройстве
// звучат одинаково. Выбор голоса хранится в браузере (ключ tour-voice).

export const TOUR_VOICE_KEY = 'tour-voice'
export const TOUR_VOICES = [
  { id: 'female', label: 'Женский', name: 'Арина' },
  { id: 'male', label: 'Мужской', name: 'Александр' },
]

export function readTourVoice() {
  const value = storageGet(TOUR_VOICE_KEY)
  return value === 'off' || TOUR_VOICES.some((voice) => voice.id === value) ? value : 'female'
}

export function saveTourVoice(value) {
  storageSet(TOUR_VOICE_KEY, value)
}

export function tourClip(voice, tourId, index) {
  return `/voice/tour/${voice}/${tourId}-${index + 1}.mp3`
}
