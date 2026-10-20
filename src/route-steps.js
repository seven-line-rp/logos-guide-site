// Построение списка шагов маршрута. Держим его отдельно от разметки, потому
// что от шагов зависит и подпись в навигации, и точка на плане: каждый шаг
// знает свой этаж и вершину маршрута (progress), по которой рисуется точка.
//
// kind нужен странице, чтобы выбрать иконку и текст кнопки перехода.

const MOVE_LABEL = {
  'stairs-west': 'западное крыло',
  'stairs-middle': 'центральная лестница',
  'stairs-north': 'северная лестница',
}

const lastIndex = (leg) => Math.max(0, (leg?.points.length ?? 1) - 1)
const SIDE_WORD = { left: 'слева', right: 'справа' }

// «Дверь справа, сразу после 114» — по ориентирам из map-routing.js.
function doorHint(arrival, what) {
  if (!arrival?.side) return ''
  return `${what} ${SIDE_WORD[arrival.side]}${arrival.after ? `, после: ${arrival.after}` : ''}`
}

export function buildRouteSteps({ startLabel, startFloor, targetFloor, targetName, route, sameRoom }) {
  const firstLeg = route.byFloor[startFloor]
  const lastLeg = route.byFloor[targetFloor]
  const steps = [{
    kind: 'start',
    title: sameRoom ? 'Вы уже на месте' : `Начало: ${startLabel}`,
    detail: `${startFloor} этаж`,
    say: sameRoom ? 'Вы уже на месте.' : `Начинаем движение от: ${startLabel}.`,
    // На iPhone системный русский голос может отсутствовать: первый шаг
    // всегда имеет записанную фразу, а название помещения видно на экране.
    voiceCue: [sameRoom ? 'arrive' : 'route-built'],
    floor: startFloor,
    progress: 0,
  }]

  const addGuides = (leg, floor) => leg?.guides?.forEach((guide) => steps.push({
    kind: 'guide',
    title: guide.title,
    detail: guide.detail,
    say: guide.say,
    // Ключ фразы голосового пакета (src/voice-pack.js): манёвры озвучены
    // заранее записанными файлами, синтезатор — запасной вариант.
    voiceCue: guide.voiceKey ? [guide.voiceKey] : [],
    floor,
    progress: guide.index,
  }))

  if (sameRoom) return steps

  addGuides(firstLeg, startFloor)

  if (route.transfer) {
    const up = targetFloor > startFloor
    const move = up ? 'Поднимитесь' : 'Спуститесь'
    const floorName = targetFloor === 2 ? 'второй' : 'первый'
    steps.push({
      kind: 'transfer',
      title: `${move} на ${targetFloor} этаж`,
      detail: [route.transfer.kind === 'lift'
        ? 'Переход на лифте'
        : `Переход по лестнице (${MOVE_LABEL[route.transfer.kind] || route.transfer.kind})`, doorHint(firstLeg?.arrival, route.transfer.kind === 'lift' ? 'Лифт' : 'Вход на лестницу')].filter(Boolean).join('. '),
      say: `${move} на ${floorName} этаж ${route.transfer.kind === 'lift' ? 'на лифте' : 'по лестнице'}.`,
      voiceCue: [up ? 'transfer-up' : 'transfer-down'],
      floor: startFloor,
      progress: lastIndex(firstLeg),
    })
    addGuides(lastLeg, targetFloor)
  }

  steps.push({
    kind: 'arrive',
    title: `Приход: ${targetName}`,
    detail: doorHint(lastLeg?.arrival, 'Дверь') ? `${doorHint(lastLeg.arrival, 'Дверь')}. ${targetFloor} этаж` : `${targetFloor} этаж, дверь отмечена на плане`,
    say: `Вы пришли: ${targetName}.${lastLeg?.arrival?.side ? ` Дверь ${SIDE_WORD[lastLeg.arrival.side]}.` : ''}`,
    voiceCue: ['arrive'],
    floor: targetFloor,
    progress: lastIndex(lastLeg),
  })
  return steps
}

// Маршрут с остановкой по пути («через раздевалку в 211»): шаги каждой части
// подряд. Приход в промежуточную точку становится шагом «Остановка», у второй
// части нет своего «Начала». leg — номер части: по нему страница выбирает,
// какую линию показать на плане.
export function buildTripSteps(legs) {
  return legs.flatMap((leg, legIndex) => {
    const steps = buildRouteSteps(leg).map((step) => ({ ...step, leg: legIndex }))
    const isLast = legIndex === legs.length - 1
    const body = legIndex > 0 && steps[0].kind === 'start' ? steps.slice(1) : steps
    return body.map((step) => step.kind === 'arrive' && !isLast ? {
      ...step,
      kind: 'stop',
      title: `Остановка: ${leg.targetName}`,
      say: `Остановка: ${leg.targetName}. Когда будете готовы, идите дальше.`,
    } : step)
  })
}
