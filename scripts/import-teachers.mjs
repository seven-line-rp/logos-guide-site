// Обновить public/teachers.json со страницы «Педагогический состав»:
//   node scripts/import-teachers.mjs            — скачать и записать
//   node scripts/import-teachers.mjs --dry      — только показать, что нашлось
//   node scripts/import-teachers.mjs page.html  — разобрать сохранённую страницу
// После записи проверьте файл глазами: ФИО, должности и предметы.
// Кабинет можно указать вручную полем "roomId" (id из src/data.js) — тогда
// сайт покажет его вместо кабинета «по предмету».
import { readFile, writeFile } from 'node:fs/promises'
import { parseTeachers } from './teachers-parse.mjs'

const SOURCE = 'https://xn--c1abcfrgadvgb0b.xn--p1ai/%D0%BF%D0%B5%D0%B4%D0%B0%D0%B3%D0%BE%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B9-%D1%81%D0%BE%D1%81%D1%82%D0%B0%D0%B2/'
const OUT = new URL('../public/teachers.json', import.meta.url)

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const file = args.find((arg) => !arg.startsWith('--'))

const html = file ? await readFile(file, 'utf8') : await fetch(SOURCE, { headers: { 'User-Agent': 'logos-guide-site teachers import' } }).then((response) => {
  if (!response.ok) throw new Error(`Страница ответила ${response.status}`)
  return response.text()
})
const parsed = parseTeachers(html)
if (!parsed.length) {
  console.error('На странице не нашлось ни одного ФИО. Возможно, изменилась вёрстка: сохраните страницу и разберите её вручную.')
  process.exit(1)
}

// Ручные правки (roomId) из прошлого файла сохраняем.
let previous = []
try { previous = JSON.parse(await readFile(OUT, 'utf8')) } catch { /* файла ещё нет */ }
const manual = new Map(previous.filter((item) => item.roomId).map((item) => [item.name, item.roomId]))
const teachers = parsed.map((teacher) => (manual.has(teacher.name) ? { ...teacher, roomId: manual.get(teacher.name) } : teacher))

for (const teacher of teachers) console.log(`${teacher.name} | ${teacher.position || '—'} | ${(teacher.subjects || []).join(', ') || '—'}${teacher.roomId ? ` | ${teacher.roomId}` : ''}`)
console.log(`\nВсего: ${teachers.length}`)
if (!dry) {
  await writeFile(OUT, `${JSON.stringify(teachers, null, 2)}\n`)
  console.log(`Записано в ${OUT.pathname}`)
}
