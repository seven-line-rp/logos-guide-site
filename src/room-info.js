import { bellState, bellsFor, dateKey } from './bells.js'

// Подробности для карточки помещения: что сейчас происходит по звонкам и
// полезные факты. Только то, что известно наверняка: расписание звонков и
// обедов (bells.js) и приёмные часы колледжа из открытых источников.
// Преподавателей и часы отдельных кабинетов команда может дописать в roomFacts.

const STUDY = new Set(['Учебные кабинеты', 'Мастерские и лаборатории'])
const OFFICE_HOURS = { start: 8 * 60, end: 18 * 60, label: 'по будням 08:00–18:00' }

// Сюда можно добавлять известные факты о помещениях: { 'physics-211': [['Преподаватель', 'Иванова А. А.']] }
export const roomFacts = {}

// «Что здесь»: короткие пункты о том, зачем приходят в помещение. Показываются
// списком в карточке на карте и попадают в базу знаний ИИ-помощника.
export const roomNotes = {
  canteen: ['Проходит обед после определённых пар.', 'Можно купить булочки или сладости.'],
  'auditorium-104': ['Проходят различные мероприятия.', 'Иногда приезжают гости из компаний-спонсоров и не только.'],
  'library-214': ['Можно почитать книги.', 'Проходит пара по русскому языку.', 'Иногда проводятся мероприятия.'],
  'training-centre-113': ['Проходит практика по беспилотным работам.'],
  'chemistry-biology-202': ['Оснащён специальными партами.', 'Проводятся лабораторные работы.'],
  'informatics-222': ['Оснащён компьютерами.', 'Изучают программирование.'],
}

const pairWord = (bell) => bell.label.replace('-я пара', '-й паре').replace('РОВ', '«Разговорам о важном»')

function studyStatus(now) {
  const state = bellState(now)
  if (!state) return { tone: 'idle', text: 'Сегодня занятий нет' }
  if (state.kind === 'lesson') return { tone: 'busy', text: `Идёт ${state.bell.label === 'РОВ' ? 'РОВ' : state.bell.label}, до ${state.bell.end}` }
  if (state.kind === 'lunch') return { tone: 'free', text: `Обед у ${state.course} курса, ${state.next ? `следующая пара в ${state.next.start}` : 'дальше пар нет'}` }
  if (state.kind === 'before') return { tone: 'idle', text: `Занятия начнутся в ${state.next.start}` }
  if (state.kind === 'break') return { tone: 'free', text: `Перемена, к ${pairWord(state.next)} в ${state.next.start}` }
  return { tone: 'idle', text: 'Пары на сегодня закончились' }
}

function canteenStatus(now) {
  const { lunch } = bellsFor(dateKey(now))
  if (!lunch.length) return { status: { tone: 'idle', text: 'Сегодня занятий нет' }, facts: [] }
  const state = bellState(now)
  const facts = lunch.map((item) => [`Обед ${item.course} курса`, `${item.start}–${item.end}`])
  if (state?.kind === 'lunch') return { status: { tone: 'busy', text: `Сейчас обед у ${state.course} курса, до ${lunch.find((item) => item.course === state.course).end}` }, facts }
  const minute = now.getHours() * 60 + now.getMinutes()
  const next = lunch.find((item) => Number(item.start.slice(0, 2)) * 60 + Number(item.start.slice(3)) > minute)
  return { status: next ? { tone: 'free', text: `Следующий обед в ${next.start}, у ${next.course} курса` } : { tone: 'idle', text: 'Обеды на сегодня закончились' }, facts }
}

function officeStatus(now) {
  const day = now.getDay()
  const minute = now.getHours() * 60 + now.getMinutes()
  const open = day >= 1 && day <= 5 && minute >= OFFICE_HOURS.start && minute < OFFICE_HOURS.end
  return {
    status: open ? { tone: 'free', text: 'Сейчас приёмные часы колледжа' } : { tone: 'idle', text: 'Сейчас не приёмные часы' },
    facts: [['Приёмные часы колледжа', OFFICE_HOURS.label]],
  }
}

export function roomDetails(room, now = new Date()) {
  if (!room) return { status: null, facts: [], notes: [] }
  let result = { status: null, facts: [] }
  if (room.id === 'canteen') result = canteenStatus(now)
  else if (room.category === 'Администрация' && room.id !== 'psychologist-224') result = officeStatus(now)
  else if (STUDY.has(room.category)) result = { status: studyStatus(now), facts: [] }
  return { status: result.status, facts: [...result.facts, ...(roomFacts[room.id] || [])], notes: roomNotes[room.id] || [] }
}
