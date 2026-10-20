import { useEffect, useState } from 'react'
import { rooms } from './data.js'
import { searchableRoom } from './i18n.js'

// Общий поиск по колледжу: помещения и преподаватели. Им пользуются строка
// поиска в шапке, поиск на главной, справочник и поля «Откуда / Куда».
// Голосом номер часто приходит словами («двести одиннадцать»), поэтому
// запрос сначала приводится к цифрам.

const UNITS = { ноль: 0, нуль: 0, один: 1, одна: 1, первый: 1, два: 2, две: 2, второй: 2, три: 3, третий: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9 }
const TEENS = { десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19 }
const TENS = { двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90 }
const HUNDREDS = { сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900 }
// «Двести одиннадцатый», «сто четырнадцатая» — порядковые формы тоже числа.
const ORDINAL = [
  [/^(перв)/, 'один'], [/^(втор)/, 'два'], [/^(трет)/, 'три'], [/^(четверт)/, 'четыре'], [/^(пят)(ый|ая|ое|ого|ой)$/, 'пять'], [/^(шест)(ой|ая|ое|ого)$/, 'шесть'],
  [/^(седьм)/, 'семь'], [/^(восьм)/, 'восемь'], [/^(девят)(ый|ая|ое|ого|ой)$/, 'девять'], [/^(десят)(ый|ая|ое|ого|ой)$/, 'десять'],
  [/^(одиннадцат|двенадцат|тринадцат|четырнадцат|пятнадцат|шестнадцат|семнадцат|восемнадцат|девятнадцат|двадцат|тридцат|пятидесят|шестидесят|семидесят|восьмидесят)(ый|ая|ое|ого|ой)$/, null],
  [/^(сороков)(ой|ая|ое|ого)$/, 'сорок'], [/^(девяност)(ый|ая|ое|ого|ой)$/, 'девяносто'], [/^(сот)(ый|ая|ое|ого|ой)$/, 'сто'],
]
const ORDINAL_STEMS = { одиннадцат: 'одиннадцать', двенадцат: 'двенадцать', тринадцат: 'тринадцать', четырнадцат: 'четырнадцать', пятнадцат: 'пятнадцать', шестнадцат: 'шестнадцать', семнадцат: 'семнадцать', восемнадцат: 'восемнадцать', девятнадцат: 'девятнадцать', двадцат: 'двадцать', тридцат: 'тридцать', пятидесят: 'пятьдесят', шестидесят: 'шестьдесят', семидесят: 'семьдесят', восьмидесят: 'восемьдесят' }

function cardinal(word) {
  for (const [pattern, value] of ORDINAL) {
    const match = word.match(pattern)
    if (match) return value || ORDINAL_STEMS[match[1]]
  }
  return word
}

// «двести одиннадцать» → 211, «два один один» → 211, «сто четырнадцатый» → 114.
export function spokenNumbers(text) {
  const words = String(text ?? '').toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean)
  const out = []
  let group = null // текущее число из слов
  let digits = '' // цифры по одной: «два один один»
  const flush = () => {
    if (group) { out.push(String(group.value)); group = null }
    if (digits) { out.push(digits); digits = '' }
  }
  for (const raw of words) {
    const word = cardinal(raw.replace(/[.,!?]+$/, ''))
    const hundred = HUNDREDS[word]
    const ten = TENS[word]
    const teen = TEENS[word]
    const unit = UNITS[word]
    if (hundred !== undefined) {
      if (digits) flush()
      if (group) flush()
      group = { value: hundred, slot: 'hundreds' }
    } else if (ten !== undefined || teen !== undefined) {
      if (digits) flush()
      if (group && group.slot === 'hundreds') group = { value: group.value + (ten ?? teen), slot: ten !== undefined ? 'tens' : 'done' }
      else { flush(); group = { value: ten ?? teen, slot: ten !== undefined ? 'tens' : 'done' } }
    } else if (unit !== undefined) {
      if (group && (group.slot === 'hundreds' || group.slot === 'tens')) group = { value: group.value + unit, slot: 'done' }
      else if (group) { const head = String(group.value); group = null; digits = head + unit }
      else digits += String(unit)
    } else {
      flush()
      out.push(raw)
    }
  }
  flush()
  return out.join(' ')
}

export const normalize = (value) => spokenNumbers(String(value ?? '')).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
  .replace(/^(кабинет|каб\.?|аудитория|ауд\.?|комната)\s+(?=\d)/, '')

export function scoreRoom(room, query, digits = query.replace(/\D/g, '')) {
  const name = normalize(room.name)
  const aliases = normalize(room.aliases)
  if (digits && room.number) {
    const numberDigits = room.number.replace(/\D/g, '')
    if (numberDigits) {
      if (numberDigits === digits) return 200
      if (room.number.split(/[ ,()]+/).some((part) => part === digits)) return 190
      if (numberDigits.startsWith(digits)) return 150
      if (numberDigits.includes(digits)) return 90
    }
  }
  if (!query) return 1
  if (name.startsWith(query)) return 120
  const words = `${name} ${aliases}`.split(' ')
  if (words.some((word) => word.startsWith(query))) return 100
  if (name.includes(query) || aliases.includes(query)) return 70
  if (normalize(searchableRoom(room)).includes(query)) return 60
  if (normalize(room.category).includes(query)) return 40
  return 0
}

// ---------- Преподаватели ----------
// Список лежит в public/teachers.json (его заполняет scripts/import-teachers.mjs
// со страницы «Педагогический состав» на колледжлогос.рф). Кабинет берём по
// предмету: преподаватель физики — кабинет физики. Это подсказка, а не
// закреплённое место, поэтому в выдаче так и подписано.

const SUBJECT_ROOMS = [
  [/физик/, 'physics-211'], [/информатик|программир|компьютер|информационн/, 'informatics-222'], [/хими|биолог/, 'chemistry-biology-202'],
  [/иностран|английск|немецк|французск/, 'language-148'], [/аэродинамик/, 'aerodynamics-120'], [/метеоролог/, 'meteorology-236'],
  [/электротехн/, 'electrical-lab-207'], [/электрорадиомонтаж/, 'electro-radio-230'], [/радиотехн/, 'radio-lab-228'],
  [/пилотирован/, 'training-centre-113'], [/беспилот|\bбас\b|бпла|дрон/, 'uav-lab-209'], [/слесар/, 'workshop-115'], [/биотехн|медицинск.+аппарат/, 'biotech-lab-225'],
  [/психолог/, 'psychologist-224'], [/библиотек/, 'library-214'],
]

export function roomForTeacher(teacher) {
  if (teacher.roomId && rooms.some((room) => room.id === teacher.roomId)) return { room: rooms.find((room) => room.id === teacher.roomId), bySubject: false }
  const text = normalize(`${teacher.position || ''} ${(teacher.subjects || []).join(' ')}`)
  const found = SUBJECT_ROOMS.find(([pattern]) => pattern.test(text))
  return found ? { room: rooms.find((room) => room.id === found[1]), bySubject: true } : { room: null, bySubject: false }
}

export function validTeacher(value) {
  return Boolean(value && typeof value.name === 'string' && value.name.trim().length > 3
    && (value.subjects === undefined || (Array.isArray(value.subjects) && value.subjects.every((item) => typeof item === 'string'))))
}

// «Иванова Анна Сергеевна» → «Иванова А. С.»
export function shortName(name) {
  const [last, ...rest] = name.trim().split(/\s+/)
  return rest.length ? `${last} ${rest.map((part) => `${part[0]}.`).join(' ')}` : last
}

function scoreTeacher(teacher, query) {
  if (query.length < 3) return 0
  const name = normalize(teacher.name)
  const parts = name.split(' ')
  if (parts.some((part) => part.startsWith(query))) return 110
  if (name.includes(query)) return 90
  const about = normalize(`${teacher.position || ''} ${(teacher.subjects || []).join(' ')}`)
  if (about.split(/[ ,.;«»()-]+/).some((word) => word.startsWith(query))) return 60
  return 0
}

export function searchTeachers(list, query, limit = 4) {
  const normalized = normalize(query)
  if (!normalized || !Array.isArray(list)) return []
  return list.filter(validTeacher)
    .map((teacher) => ({ teacher, score: scoreTeacher(teacher, normalized), ...roomForTeacher(teacher) }))
    .filter((hit) => hit.score > 0)
    .sort((first, second) => second.score - first.score || first.teacher.name.localeCompare(second.teacher.name, 'ru'))
    .slice(0, limit)
}

export function searchRooms(query, limit = Infinity) {
  const normalized = normalize(query)
  const digits = normalized.replace(/\D/g, '')
  return rooms.map((room) => ({ room, score: scoreRoom(room, normalized, digits) }))
    .filter((entry) => entry.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
}

let teachersCache = null
export function loadTeachers(fetchImpl = typeof fetch === 'undefined' ? null : fetch) {
  if (!teachersCache) {
    teachersCache = fetchImpl
      ? fetchImpl('/teachers.json', { cache: 'no-cache' }).then((response) => (response.ok ? response.json() : [])).then((value) => (Array.isArray(value) ? value.filter(validTeacher) : [])).catch(() => [])
      : Promise.resolve([])
  }
  return teachersCache
}

export function useTeachers() {
  const [list, setList] = useState([])
  useEffect(() => {
    let alive = true
    loadTeachers().then((value) => { if (alive) setList(value) })
    return () => { alive = false }
  }, [])
  return list
}

// ---------- «Искали и не нашли» ----------
// Если поиск ничего не дал, через пару секунд тишины отправляем на сервер
// только текст запроса (api/search-miss.php): так команда видит, каких
// названий не хватает. Один и тот же запрос за визит — один раз.
const sentMisses = new Set()
let missTimer = 0
export function reportMiss(query, fetchImpl = typeof fetch === 'undefined' ? null : fetch) {
  if (typeof window === 'undefined' || !fetchImpl) return
  window.clearTimeout(missTimer)
  const text = normalize(query)
  if (text.length < 2 || text.length > 60 || sentMisses.has(text)) return
  missTimer = window.setTimeout(() => {
    sentMisses.add(text)
    fetchImpl('/api/search-miss.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: text }), keepalive: true }).catch(() => {})
  }, 2500)
}
export function cancelMiss() {
  if (typeof window !== 'undefined') window.clearTimeout(missTimer)
}
