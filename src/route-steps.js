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

export function buildRouteSteps({ startLabel, startFloor, targetFloor, targetName, route, sameRoom }) {
  const firstLeg = route.byFloor[startFloor]
  const lastLeg = route.byFloor[targetFloor]
  const steps = [{
    kind: 'start',
    title: sameRoom ? 'Вы уже на месте' : `Начало: ${startLabel}`,
    detail: `${startFloor} этаж`,
    say: sameRoom ? 'Вы уже на месте.' : `Начинаем движение от: ${startLabel}.`,
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
      detail: route.transfer.kind === 'lift'
        ? 'Переход на лифте'
        : `Переход по лестнице (${MOVE_LABEL[route.transfer.kind] || route.transfer.kind})`,
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
    detail: `${targetFloor} этаж · дверь помещения на плане`,
    say: `Вы пришли: ${targetName}.`,
    voiceCue: ['arrive'],
    floor: targetFloor,
    progress: lastIndex(lastLeg),
  })
  return steps
}
