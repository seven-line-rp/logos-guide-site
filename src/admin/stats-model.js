// Превращает сырые счётчики api/stats.php в данные для графиков панели /admin.
// days: { 'YYYY-MM-DD': { v: просмотры, u: посетители, q: { помещение: сканов }, p: { путь: просмотров }, h: [24 часа] } }.
// «Посетителей» за период — сумма уникальных по дням: человек, пришедший в
// понедельник и во вторник, считается дважды (сервер не помнит людей дольше суток).

export const PERIODS = [
  { id: 'day', label: 'День', span: 1 },
  { id: 'week', label: 'Неделя', span: 7 },
  { id: 'month', label: 'Месяц', span: 30 },
  { id: 'all', label: 'Всё время', span: 0 },
]

export const METRICS = [
  { id: 'u', label: 'Посетители', hint: 'Уникальные за день' },
  { id: 'v', label: 'Просмотры', hint: 'Открытые страницы' },
  { id: 'qr', label: 'Сканы QR', hint: 'Переходы с табличек' },
]

const DAY = 86400000
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const toDate = (key) => new Date(`${key}T00:00:00Z`)
const toKey = (date) => date.toISOString().slice(0, 10)
const addDays = (key, count) => toKey(new Date(toDate(key).getTime() + count * DAY))
const sum = (values) => values.reduce((total, value) => total + value, 0)
const qrTotal = (day) => sum(Object.values(day?.q || {}))

export function dayValue(day, metric) {
  if (!day) return 0
  if (metric === 'qr') return qrTotal(day)
  return Number(day[metric]) || 0
}

export function dayKeys(from, to) {
  const keys = []
  for (let key = from; key <= to; key = addDays(key, 1)) keys.push(key)
  return keys
}

export const dayLabel = (key) => `${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`
export const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`

// Первый день данных (для «Всё время»); пока данных нет — сегодня.
export function firstDay(days, today) {
  const keys = Object.keys(days || {}).sort()
  return keys.length ? keys[0] : today
}

// Ряд для графика: [{ key, label, title, value }]. День — просмотры по часам, неделя и
// месяц — по дням, всё время — по дням (до 45 дней) или по месяцам.
export function buildSeries(days, today, period, metric) {
  const value = (key) => dayValue(days[key], metric)
  if (period === 'day') {
    // По часам сервер ведёт только просмотры, поэтому за сегодня график всегда про них.
    return Array.from({ length: 24 }, (_, hour) => ({ key: `${today}-${hour}`, label: String(hour), title: `${String(hour).padStart(2, '0')}:00`, value: Number(days[today]?.h?.[hour]) || 0 }))
  }
  if (period === 'week' || period === 'month') {
    const span = period === 'week' ? 7 : 30
    return dayKeys(addDays(today, 1 - span), today).map((key) => ({ key, label: dayLabel(key), title: dayLabel(key), value: value(key) }))
  }
  const start = firstDay(days, today)
  const keys = dayKeys(start, today)
  if (keys.length <= 45) return keys.map((key) => ({ key, label: dayLabel(key), title: dayLabel(key), value: value(key) }))
  const months = new Map()
  for (const key of keys) {
    const month = key.slice(0, 7)
    months.set(month, (months.get(month) || 0) + value(key))
  }
  return [...months].map(([month, total]) => ({ key: month, label: monthLabel(`${month}-01`), title: monthLabel(`${month}-01`), value: total }))
}

// Итог за период и сравнение с предыдущим таким же отрезком.
export function periodTotals(days, today, period) {
  const span = PERIODS.find((item) => item.id === period)?.span || 0
  const keys = span ? dayKeys(addDays(today, 1 - span), today) : dayKeys(firstDay(days, today), today)
  const previous = span ? dayKeys(addDays(today, 1 - 2 * span), addDays(today, -span)) : []
  const totals = {}
  for (const metric of METRICS) {
    const now = sum(keys.map((key) => dayValue(days[key], metric.id)))
    const before = sum(previous.map((key) => dayValue(days[key], metric.id)))
    totals[metric.id] = { value: now, previous: span ? before : null, delta: span && before > 0 ? Math.round(((now - before) / before) * 100) : null }
  }
  return { keys, totals }
}

// Сканы по помещениям за период, по убыванию.
export function qrRanking(days, keys) {
  const counts = new Map()
  for (const key of keys) for (const [room, count] of Object.entries(days[key]?.q || {})) counts.set(room, (counts.get(room) || 0) + count)
  return [...counts].map(([room, count]) => ({ room, count })).sort((a, b) => b.count - a.count || a.room.localeCompare(b.room))
}

export function pageRanking(days, keys) {
  const counts = new Map()
  for (const key of keys) for (const [path, count] of Object.entries(days[key]?.p || {})) counts.set(path, (counts.get(path) || 0) + count)
  return [...counts].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
}

export const PAGE_NAMES = {
  '/': 'Главная', '/map': 'Карта', '/rooms': 'Кабинеты', '/route': 'Маршрут', '/ai': 'ИИ-помощник', '/schedule': 'Расписание (убрано)',
  '/here': 'Вы здесь (QR)', '/teachers': 'Преподаватели', '/start': 'Первая неделя', '/tour': 'Экскурсия 3D', '/games': 'Игры',
  '/services': 'Пространства', '/about': 'О проекте', '/docs': 'Документация', '/privacy': 'Конфиденциальность', '/terms': 'Соглашение', '/consent': 'Согласие на обработку данных', '/feedback': 'Обратная связь',
}

export const formatNumber = (value) => new Intl.NumberFormat('ru-RU').format(value)
