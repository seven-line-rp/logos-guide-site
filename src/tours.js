import { rooms } from './data.js'
import { buildRouteOptions } from './map-routing.js'

// Экскурсии по колледжу: камера в 3D летит от остановки к остановке
// (страница /tour). Тексты — короткие подсказки по назначению помещений,
// без дат и фактов, которые могут устареть.

export const tours = [
  {
    id: 'first-day',
    title: 'Первый день',
    subtitle: 'Главное, что пригодится первокурснику',
    minutes: 6,
    stops: [
      { roomId: 'entrance-1', title: 'Главный вход', text: 'Отсюда начинается день. От входа видны холл и центральная лестница — запомните их как точку отсчёта.' },
      { roomId: 'hall-1', title: 'Холл', text: 'Место встречи и ожидания. Отсюда расходятся коридоры первого этажа.' },
      { roomId: 'academic-office', title: 'Учебная часть', text: 'Вопросы расписания, справки и учебного процесса решают здесь.' },
      { roomId: 'canteen', title: 'Столовая', text: 'Обед и перекус между парами — в левом крыле первого этажа.' },
      { roomId: 'medical-post', title: 'Медпункт', text: 'Если стало плохо или нужна помощь — идите сюда или попросите любого сотрудника.' },
      { roomId: 'library-214', title: 'Библиотека', text: 'Читальный зал на втором этаже: учебники и тихое место для самостоятельной работы.' },
      { roomId: 'informatics-222', title: 'Кабинет информатики', text: 'Один из кабинетов второго этажа, где проходят занятия за компьютерами.' },
    ],
  },
  {
    id: 'open-day',
    title: 'День открытых дверей',
    subtitle: 'Лаборатории и мастерские колледжа',
    minutes: 8,
    stops: [
      { roomId: 'entrance-1', title: 'Добро пожаловать', text: 'Начинаем у главного входа. Экскурсия пройдёт по двум этажам.' },
      { roomId: 'auditorium-104', title: 'Актовый зал', text: 'Здесь проходят встречи, праздники и мероприятия колледжа.' },
      { roomId: 'training-centre-113', title: 'Тренажёрный центр', text: 'Тренажёрный центр с малой полётной зоной — практика по беспилотным системам.' },
      { roomId: 'simulator-114', title: 'Симулятор беспилотных систем', text: 'Тренажёрный класс: управление беспилотниками отрабатывают на симуляторах.' },
      { roomId: 'uav-lab-209', title: 'Лаборатория БАС', text: 'Лаборатория беспилотных авиационных систем на втором этаже.' },
      { roomId: 'radio-lab-228', title: 'Лаборатория радиотехники', text: 'Радиотехнические системы и измерения.' },
      { roomId: 'biotech-lab-225', title: 'Биотехнические аппараты', text: 'Лаборатория биотехнических и медицинских аппаратов.' },
      { roomId: 'library-214', title: 'Библиотека', text: 'Финиш — читальный зал. Спасибо, что прошли экскурсию!' },
    ],
  },
]

export function findTour(id) {
  return tours.find((tour) => tour.id === id) || tours[0]
}

// Отрезок экскурсии к остановке index: путь от предыдущей остановки (на
// этаже остановки) или только сама точка для первой.
export function tourLeg(tour, index) {
  const stop = tour.stops[index]
  const room = rooms.find((item) => item.id === stop.roomId)
  if (!room) return null
  if (index === 0) {
    const [option] = buildRouteOptions('entrance-1', room.id)
    const point = option?.byFloor[room.floor]?.points?.at(-1)
    return { floor: room.floor, room, points: point ? [point] : [], meters: 0, transfer: null }
  }
  const [option] = buildRouteOptions(tour.stops[index - 1].roomId, room.id)
  const points = option?.byFloor[room.floor]?.points || []
  return { floor: room.floor, room, points, meters: option?.meters || 0, transfer: option?.transfer || null }
}
