// Разбор страницы «Педагогический состав» в список преподавателей для
// public/teachers.json. Вёрстка страницы может меняться, поэтому разбор
// опирается на текст, а не на классы: ищем строки с ФИО (фамилия, имя,
// отчество) и берём несколько строк после них — должность и дисциплины.

const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', laquo: '«', raquo: '»', ndash: '–', mdash: '—', lt: '<', gt: '>', apos: "'", hellip: '…' }

export function htmlToLines(html) {
  const text = String(html)
    .replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|td|th|tr|h[1-6]|section|article|figcaption|dd|dt)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (match, code) => {
      if (code[0] === '#') return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
      return ENTITIES[code.toLowerCase()] ?? match
    })
  return text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

const NAME = /^([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)\s+([А-ЯЁ][а-яё]+)\s+([А-ЯЁ][а-яё]+(?:вич|вна|ична|чна|ич|оглы|кызы))(?=$|[\s,.–—:-])/
const POSITION = /преподавател|мастер|педагог|методист|руководител|воспитател|заведующ|директор|советник|тьютор|психолог|библиотекар|инструктор|концертмейстер/i
const SUBJECTS = /дисциплин|предмет|преподава|модул|МДК|ПМ\.|курс[ыа]?\b/i
const NOISE = /^(образование|квалификация|стаж|повышение|профессиональная переподготовка|учёная степень|ученая степень|звание|общий стаж|e-?mail|телефон)/i

function splitSubjects(text) {
  return text.replace(/^[^:]*(дисциплин[а-я]*|предмет[а-я]*|преподава[а-я]*)[^:]*:\s*/i, '')
    .split(/[;,]|\s—\s|\s–\s/)
    .map((item) => item.replace(/^[«"]|[»"]$/g, '').replace(/\.$/, '').trim())
    .filter((item) => item.length > 2 && item.length < 120 && !NOISE.test(item))
}

export function parseTeachers(html) {
  const lines = htmlToLines(html)
  const teachers = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(NAME)
    if (!match) continue
    const name = match.slice(1, 4).join(' ')
    const rest = lines[index].slice(match[0].length).replace(/^[\s,.–—:-]+/, '')
    const block = [rest, ...lines.slice(index + 1, index + 9)].filter(Boolean)
    const end = block.findIndex((line, i) => i > 0 && NAME.test(line))
    const own = end > 0 ? block.slice(0, end) : block
    // На странице колледжа подпись стоит отдельной строкой («Преподаваемые
    // дисциплины:»), а значение — на следующей.
    const values = []
    for (let i = 0; i < own.length; i += 1) {
      if (/^[^:]{2,60}:$/.test(own[i])) { if (SUBJECTS.test(own[i]) && own[i + 1]) values.push(own[i + 1]); i += 1 }
    }
    const labelled = new Set(own.flatMap((line, i) => (/^[^:]{2,60}:$/.test(line) ? [line, own[i + 1]] : [])))
    const first = own.find((line) => !labelled.has(line) && POSITION.test(line) && line.length < 200 && !SUBJECTS.test(line.replace(/преподавател[а-я]*/gi, '')))
    // «Преподаватель, инженер в компании …» — для сайта хватает первой части.
    const position = first ? first.split(/[,;]\s+/)[0].replace(/\s*\((.+)\)\s*/, ' $1').trim() : ''
    const subjectLines = values.length ? values : own.filter((line) => line !== first && SUBJECTS.test(line) && !NOISE.test(line))
    const subjects = [...new Set(subjectLines.flatMap(splitSubjects))]
    // Должность «преподаватель физики» сама называет предмет.
    if (!subjects.length && /преподавател[а-я]*\s+\S/i.test(position)) {
      const from = position.replace(/^.*?преподавател[а-я]*\s+/i, '').trim()
      if (from) subjects.push(from)
    }
    teachers.push({ name, ...(position ? { position: position.replace(/[.;,]$/, '') } : {}), ...(subjects.length ? { subjects } : {}) })
  }
  const byName = new Map()
  for (const teacher of teachers) {
    const known = byName.get(teacher.name)
    if (!known) byName.set(teacher.name, teacher)
    else byName.set(teacher.name, { ...known, position: known.position || teacher.position, subjects: [...new Set([...(known.subjects || []), ...(teacher.subjects || [])])] })
  }
  return [...byName.values()].sort((first, second) => first.name.localeCompare(second.name, 'ru'))
}
