import test from 'node:test'
import assert from 'node:assert/strict'
import { htmlToLines, parseTeachers } from '../scripts/teachers-parse.mjs'

test('staff page cards become teachers with position and subjects', () => {
  const html = `<html><head><style>.a{}</style></head><body><nav>Меню Главная</nav>
    <div class="card"><h3>Иванова Анна Сергеевна</h3><p>Преподаватель</p><p>Преподаваемые дисциплины: Физика; Астрономия</p><p>Образование: высшее</p></div>
    <div class="card"><h3>Петров Пётр Петрович</h3><p>Преподаватель информатики</p><p>Общий стаж: 10 лет</p></div>
    <table><tr><td>Сидорова Мария Ивановна</td><td>Педагог-психолог</td></tr></table>
    <p>Контакты&nbsp;колледжа</p></body></html>`
  const teachers = parseTeachers(html)
  assert.deepEqual(teachers.map((teacher) => teacher.name), ['Иванова Анна Сергеевна', 'Петров Пётр Петрович', 'Сидорова Мария Ивановна'])
  assert.deepEqual(teachers[0].subjects, ['Физика', 'Астрономия'])
  assert.equal(teachers[0].position, 'Преподаватель')
  assert.deepEqual(teachers[1].subjects, ['информатики'], 'предмет из должности «преподаватель информатики»')
  assert.equal(teachers[2].position, 'Педагог-психолог')
  assert.equal(teachers[2].subjects, undefined)
})

test('lines are cleaned from tags, entities and scripts', () => {
  assert.deepEqual(htmlToLines('<script>var x = "Иванов Иван Иванович"</script><p>А&nbsp;&laquo;Б&raquo;</p>'), ['А «Б»'])
  assert.deepEqual(parseTeachers('<p>Колледж Логос основан</p><p>Добро Пожаловать Всем</p>'), [], 'без отчества это не ФИО')
})
