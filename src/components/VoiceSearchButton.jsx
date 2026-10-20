import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { spokenNumbers } from '../search.js'

// Голосовой поиск: «где двести одиннадцатый» → «где 211». Распознавание речи
// встроено в браузер (Chrome, Edge, Safari); где его нет, кнопка не видна.
// В Chrome звук для распознавания уходит разработчику браузера — об этом
// сказано в политике конфиденциальности (раздел про ИИ-агента и микрофон).

const Recognition = typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition

export default function VoiceSearchButton({ onText, className = '' }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognition = useRef(null)
  useEffect(() => () => recognition.current?.abort(), [])
  if (!Recognition) return null

  const toggle = () => {
    if (listening) { recognition.current?.stop(); return }
    const next = new Recognition()
    next.lang = 'ru-RU'
    next.interimResults = true
    next.maxAlternatives = 1
    next.onresult = (event) => {
      const text = [...event.results].map((result) => result[0].transcript).join(' ')
      onText(spokenNumbers(text).replace(/^(где|найди|найти|покажи|как пройти (в|к))\s+/i, '').trim())
    }
    next.onerror = (event) => setError(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'Разрешите микрофон в настройках браузера' : event.error === 'no-speech' ? 'Не расслышали, попробуйте ещё раз' : '')
    next.onend = () => setListening(false)
    recognition.current = next
    setError('')
    setListening(true)
    try { next.start() } catch { setListening(false) }
  }

  return <>
    <button type="button" className={`voice-search ${listening ? 'is-listening' : ''} ${className}`} onClick={toggle} aria-pressed={listening} aria-label={listening ? 'Остановить голосовой ввод' : 'Сказать, что найти'} title={listening ? 'Слушаю…' : 'Голосовой поиск'}>
      {listening ? <MicOff size={17} /> : <Mic size={17} />}
    </button>
    {error && <span className="voice-search-error" role="status">{error}</span>}
  </>
}
