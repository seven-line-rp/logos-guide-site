// Практические задания в ответах ИИ: блок ```quiz с JSON.
// Здесь разбор и проверка ответов без DOM; рисует задания components/ai-quiz.js.
// Всё из модели — только текст: ни разметки, ни ссылок, ни кода не исполняется.

export const MAX_TASKS = 5
const MAX_OPTIONS = 6
const LIMITS = { q: 500, option: 140, answer: 80, explain: 600, title: 90 }

const text = (value, limit) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, limit) : '')

// Модель иногда пишет LaTeX с одинарной обратной чертой (\frac) — для JSON
// это ошибка. Если разбор не удался, удваиваем «лишние» черты и пробуем снова.
export function parseJsonLoose(source) {
  // \to, \frac, \beta в JSON сами по себе читаются как таб и перевод страницы,
  // поэтому команды LaTeX (обратная черта и две и больше латинских букв) удваиваем сразу.
  const latex = String(source).replace(/(\\+)([A-Za-z]{2,})/g, (_, slashes, word) => (slashes.length % 2 ? `${slashes}\\` : slashes) + word)
  try { return JSON.parse(latex) } catch { /* ниже вторая попытка */ }
  try { return JSON.parse(latex.replace(/\\(?!["\\/]|u[0-9a-fA-F]{4})/g, '\\\\')) } catch { return null }
}

function normalizeTask(raw) {
  if (!raw || typeof raw !== 'object') return null
  const q = text(raw.q ?? raw.question, LIMITS.q)
  if (!q) return null
  const explain = text(raw.explain ?? raw.explanation, LIMITS.explain)
  if (raw.type === 'choice' || Array.isArray(raw.options)) {
    const options = (Array.isArray(raw.options) ? raw.options : []).slice(0, MAX_OPTIONS).map((item) => text(item, LIMITS.option)).filter(Boolean)
    const answer = Number(raw.answer)
    if (options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null
    return { type: 'choice', q, options, answer, explain }
  }
  const answer = text(raw.answer, LIMITS.answer)
  if (!answer) return null
  const accept = (Array.isArray(raw.accept) ? raw.accept : []).slice(0, 6).map((item) => text(item, LIMITS.answer)).filter(Boolean)
  return { type: 'input', q, answer, accept, explain }
}

// Возвращает { title, tasks } или null, если задания непригодны.
export function parseQuizSpec(source) {
  const raw = parseJsonLoose(String(source).trim())
  const list = Array.isArray(raw) ? raw : raw?.tasks
  if (!Array.isArray(list)) return null
  const tasks = list.slice(0, MAX_TASKS).map(normalizeTask).filter(Boolean)
  if (!tasks.length) return null
  return { title: text(raw.title, LIMITS.title), tasks }
}

// Вопросы-продолжения: блок ```next с массивом коротких строк.
export function parseNextSpec(source) {
  const raw = parseJsonLoose(String(source).trim())
  const list = Array.isArray(raw) ? raw : raw?.items
  if (!Array.isArray(list)) return null
  const items = list.map((item) => text(item, 90)).filter(Boolean).slice(0, 3)
  return items.length ? items : null
}

// Запись ответа к виду, удобному для сравнения: «H₂O» = «h2o», запятая = точка,
// «2, 1, 2» = «2 1 2», «ё» = «е».
export function canon(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/[−–—]/g, '-').replace(/[→⟶]|->/g, '→').replace(/[\s,;]+/g, ' ').replace(/[$\\{}]/g, '').trim()
}

const asNumber = (value) => {
  const clean = String(value ?? '').normalize('NFKC').trim().replace(',', '.').replace(/[−–—]/g, '-')
  return /^-?\d+(?:\.\d+)?$/.test(clean) ? Number(clean) : null
}

export function checkAnswer(task, value) {
  if (task.type === 'choice') return Number(value) === task.answer
  const given = String(value ?? '').trim()
  if (!given) return false
  const variants = [task.answer, ...task.accept]
  const number = asNumber(given)
  if (number !== null) {
    return variants.some((variant) => {
      const expected = asNumber(variant)
      return expected !== null && Math.abs(number - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-6)
    })
  }
  const wanted = canon(given)
  return variants.some((variant) => canon(variant) === wanted)
}

export function quizScore(results, total) {
  const correct = Object.values(results).filter((state) => state === 'ok').length
  return { correct, total, done: Object.keys(results).length >= total }
}
