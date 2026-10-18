// Локальный слой понимания для LOGOS AI.
// Часть вопросов помощник решает сам, без обращения к модели: поиск кабинета,
// частые вопросы и главное — маршрут. На запрос вроде «Построй маршрут от
// Столовой до Библиотеки» чат показывает, как маршрут строится, и открывает
// страницу маршрута уже с готовыми точками. Модуль не зависит от React,
// поэтому его покрывают обычные node-тесты.

import { rooms } from './data.js'
import { searchableRoom } from './i18n.js'
import { buildRouteOptions, pickRoute } from './map-routing.js'

// Совпадение по основе слова: «Столовой» и «Столовая» дают одну основу.
// Пять букв достаточно, чтобы отличать помещения колледжа друг от друга.
const STEM_LENGTH = 5
const FULL_MATCH_SCORE = 100
const MIN_PHRASE_LENGTH = 4

export function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:()«»"'№]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stem(word) {
  return word.slice(0, Math.min(STEM_LENGTH, word.length))
}

let entries = null
function roomEntries() {
  if (entries) return entries
  entries = rooms.map((room) => {
    const name = normalizeText(room.name)
    const aliasWords = normalizeText(room.aliases).split(' ').filter(Boolean)
    const stems = new Set([...name.split(' ').filter(Boolean), ...aliasWords].map(stem))
    return {
      room,
      name,
      stems,
      numbers: String(room.number || '').split(/[,/]\s*/).map((part) => normalizeText(part)).filter(Boolean),
      haystack: normalizeText(searchableRoom(room)),
    }
  })
  return entries
}

function scoreEntry(entry, term, words) {
  if (entry.numbers.includes(term)) return 140
  if (entry.name === term) return 125
  const wordStems = words.map(stem)
  const hits = wordStems.filter((part) => entry.stems.has(part)).length
  if (hits && hits === words.length) return FULL_MATCH_SCORE + hits
  if (term.length >= MIN_PHRASE_LENGTH && entry.haystack.includes(term)) {
    return 90 - Math.min(20, Math.max(0, entry.haystack.length - term.length * 4))
  }
  if (hits) return 60 + hits
  return 0
}

// Все помещения, похожие на запрос, отсортированы по уверенности.
// Короткие слова и союзы не несут смысла: «и» входит в название «Кабинет химии
// и биологии», и без фильтра фраза «физика и столовая» находила лишний кабинет.
const MIN_WORD_LENGTH = 3

export function rankRooms(query) {
  const term = normalizeText(query)
  if (!term) return []
  const words = term.split(' ').filter((word) => word.length >= MIN_WORD_LENGTH)
  if (!words.length) return []
  return roomEntries()
    .map((entry) => ({ room: entry.room, score: scoreEntry(entry, term, words) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
}

export function findRoom(query) {
  return rankRooms(query)[0]?.room || null
}

// Помещения, упомянутые в фразе: идём по словам и пробуем склеить 1–3 соседних.
export function scanRooms(text) {
  const words = normalizeText(text).split(' ').filter(Boolean)
  const found = []
  let index = 0
  while (index < words.length) {
    let matched = null
    for (let size = Math.min(3, words.length - index); size >= 1; size -= 1) {
      const phrase = words.slice(index, index + size).join(' ')
      const [best] = rankRooms(phrase)
      if (best && best.score >= FULL_MATCH_SCORE) {
        matched = {
          room: best.room,
          index,
          phrase,
          // Сколько значимых слов фразы совпало: по ним понятно, действительно
          // ли сообщение про это место или место упомянуто вскользь.
          words: phrase.split(' ').filter((word) => word.length >= MIN_WORD_LENGTH).length,
        }
        index += size
        break
      }
    }
    if (!matched) index += 1
    else if (!found.some((item) => item.room.id === matched.room.id)) found.push(matched)
  }
  return found
}

export function roomLabel(room) {
  return `${room.name}${room.number ? ` №${room.number}` : ''}`
}

export function roomLink(room) {
  return `/map?floor=${room.floor}&room=${encodeURIComponent(room.id)}`
}

// Настоящий расчёт по плану: те же функции, что использует страница маршрута.
export function routePreview(fromId, toId) {
  const from = rooms.find((room) => room.id === fromId)
  const to = rooms.find((room) => room.id === toId)
  if (!from || !to) return null
  const options = buildRouteOptions(from.id, to.id)
  if (!options.length) return null
  const route = pickRoute(options, 'auto')
  const crossFloor = from.floor !== to.floor
  return {
    fromId: from.id,
    toId: to.id,
    fromLabel: roomLabel(from),
    toLabel: roomLabel(to),
    fromFloor: from.floor,
    toFloor: to.floor,
    crossFloor,
    samePlace: route.kind === 'same',
    meters: Math.round(route.meters || 0),
    minutes: Math.max(1, Math.round((route.seconds || 0) / 60)),
    footsteps: route.footsteps || 0,
    transfer: route.transfer?.label || '',
    variants: options.length,
    link: `/route?from=${encodeURIComponent(from.id)}&to=${encodeURIComponent(to.id)}&ai=1`,
  }
}

const ROUTE_VERBS = [
  'маршрут', 'дойти', 'дойду', 'проведи', 'добраться', 'попасть', 'путь',
  'как до', 'route', 'дорога', 'отведи',
]
// «от Столовой до Библиотеки», «из столовой в библиотеку», «столовая → библиотека».
const ROUTE_PATTERN = /(?:от|из)\s+(.+?)\s+(?:до|в|к|→|->|—)\s+(.+)/

const FAQ = [
  {
    id: 'capabilities',
    phrases: ['что умеет этот сайт', 'что умеет сайт', 'что ты умеешь', 'возможности сайта', 'что тут есть', 'что это за сайт', 'как пользоваться сайтом', 'что здесь можно'],
    answer: 'Я — LOGOS AI, помощник путеводителя «Логос». Умею находить кабинеты по номеру или названию, строить маршрут по коридорам с переходом между этажами, показывать план и рассказывать про разделы сайта.\n\n'
      + 'Попробуйте: [Карта этажей](/map), [Справочник кабинетов](/rooms), [Маршрут](/route), [Пространства](/services), [Игры](/games).\n'
      + 'А если написать команду «Туторил», я проведу короткое обучение по сайту.',
  },
  {
    id: 'floors',
    phrases: ['между этажами', 'на другой этаж', 'на второй этаж', 'на первый этаж', 'лифт или лестница', 'как построить маршрут', 'как работает маршрут', 'переход между этажами'],
    answer: 'Маршрут строится по нанесённым коридорам и дверям. Если точки на разных этажах, я считаю четыре варианта — лифт и три лестницы — и показываю для каждого расстояние, время и число шагов; быстрый выбирается по умолчанию.\n\n'
      + 'Просто напишите, откуда и куда идёте, например: «Построй маршрут от Столовой до Библиотеки». Или откройте [страницу маршрута](/route) и выберите точки вручную.',
  },
  {
    id: 'tour',
    phrases: ['как пройти обучение', 'что за туторил', 'что такое туторил', 'зачем команда туторил'],
    answer: '«Туторил» — команда-ключ обучения. Напишите её, и я подсвечу главные элементы сайта по шагам: поиск, карту, карточку кабинета, маршрут, справочник и игры. Обучение можно пропустить в любой момент и повторить той же командой.',
  },
  {
    id: 'voice',
    phrases: ['озвучка маршрута', 'голос помощника', 'как включить голос', 'читает вслух'],
    answer: 'На странице маршрута есть кнопка «Голос»: она читает текущий шаг вслух. Доступны две записанные озвучки «Логос» — женская и мужская, а если записи не загрузились, фразу попробует прочитать системный синтезатор речи. Выбор голоса запоминается в браузере.',
  },
  {
    id: 'gps',
    phrases: ['gps', 'моя позиция', 'где я нахожусь на карте', 'отметка на плане'],
    answer: 'Свою позицию можно задать двумя способами. Ручная отметка: на карте нажмите в помещении или коридоре — точка станет началом маршрута. GPS: нужна привязка двух известных точек на одном этаже, внутри здания координаты могут заметно расходиться с планом.',
  },
]

function findFaq(text) {
  const term = normalizeText(text)
  return FAQ.find((item) => item.phrases.some((phrase) => term.includes(phrase))) || null
}

const WHERE_WORDS = ['где', 'какой этаж', 'как найти', 'как пройти к', 'на каком этаже', 'where', 'номер']

export function roomAnswer(room) {
  return `${roomLabel(room)} — ${room.floor} этаж. ${room.description} [Открыть на карте](${roomLink(room)})`
}

// Разбираем сообщение пользователя. Возвращаем null, если вопрос лучше
// отдать модели.
export function parseIntent(text) {
  const term = normalizeText(text)
  if (!term) return null

  const hasRouteVerb = ROUTE_VERBS.some((verb) => term.includes(verb))
  const pattern = term.match(ROUTE_PATTERN)
  if (hasRouteVerb || pattern) {
    let from = null
    let to = null
    if (pattern) {
      from = findRoom(pattern[1])
      to = findRoom(pattern[2])
    }
    const mentions = from && to ? [] : scanRooms(term)
    if (mentions.length >= 2) {
      from = from || mentions[0].room
      to = to || mentions.at(-1).room
    }
    if (from && to && from.id !== to.id) {
      const route = routePreview(from.id, to.id)
      if (route) {
        return {
          kind: 'route',
          route,
          content: `Понял: ${route.fromLabel} → ${route.toLabel}. Строю маршрут по плану колледжа.`,
        }
      }
    }
    // Поняли только одну точку: честно просим вторую, а не угадываем.
    const known = from || to || mentions[0]?.room
    if (hasRouteVerb && known) {
      return {
        kind: 'answer',
        answer: `Нашёл только одно место — ${roomLabel(known)}. Напишите обе точки, например: «Построй маршрут от ${roomLabel(known)} до библиотеки».`,
      }
    }
  }

  const faq = findFaq(term)
  if (faq) return { kind: 'answer', answer: faq.answer }

  const mentions = scanRooms(term)
  // Место показываем, если его прямо спросили («где библиотека») или если
  // сообщение по сути и есть название места. «Кто директор колледжа?» — не
  // запрос кабинета, такой вопрос уходит модели.
  const words = term.split(' ').filter((word) => word.length >= MIN_WORD_LENGTH)
  const mention = mentions[0]
  const mostlyPlace = mention && words.length <= 3 && mention.words / Math.max(1, words.length) >= 0.6
  if (mention && (WHERE_WORDS.some((word) => term.includes(word)) || mostlyPlace)) {
    return { kind: 'answer', answer: roomAnswer(mention.room) }
  }

  return null
}
