import test from 'node:test'
import assert from 'node:assert/strict'
import { normalize, roomForTeacher, searchRooms, searchTeachers, shortName, spokenNumbers } from './search.js'

test('spoken room numbers become digits', () => {
  assert.equal(spokenNumbers('двести одиннадцать'), '211')
  assert.equal(spokenNumbers('где двести одиннадцатый кабинет'), 'где 211 кабинет')
  assert.equal(spokenNumbers('сто четырнадцать'), '114')
  assert.equal(spokenNumbers('сто сорок восемь'), '148')
  assert.equal(spokenNumbers('два один один'), '211')
  assert.equal(spokenNumbers('двести двадцать девятая'), '229')
  assert.equal(spokenNumbers('сто двадцать'), '120')
  assert.equal(spokenNumbers('библиотека'), 'библиотека')
  assert.equal(normalize('Кабинет двести семнадцать'), '217')
  assert.equal(normalize('каб. 118'), '118')
})

test('room search finds numbers, words and voice input the same way', () => {
  assert.equal(searchRooms('211')[0].room.id, 'physics-211')
  assert.equal(searchRooms('двести одиннадцать')[0].room.id, 'physics-211')
  assert.equal(searchRooms('библиот')[0].room.id, 'library-214')
  assert.equal(searchRooms('141')[0].room.id, 'academic-office', 'номер из списка учебной части')
  assert.deepEqual(searchRooms('ксерокс'), [])
})

test('teachers are found by name or subject and point to the subject room', () => {
  const list = [
    { name: 'Иванова Анна Сергеевна', position: 'Преподаватель', subjects: ['Физика', 'Астрономия'] },
    { name: 'Петров Пётр Петрович', position: 'Преподаватель', subjects: ['История'] },
    { name: 'Сидорова Мария', position: 'Педагог-психолог' },
    { name: '', subjects: ['мусор'] },
  ]
  const byName = searchTeachers(list, 'иванов')
  assert.equal(byName.length, 1)
  assert.equal(byName[0].room.id, 'physics-211')
  assert.equal(byName[0].bySubject, true)
  assert.equal(searchTeachers(list, 'петр')[0].room, null, 'у истории нет своего кабинета на плане')
  assert.equal(searchTeachers(list, 'Пётр')[0].teacher.name, 'Петров Пётр Петрович')
  assert.equal(searchTeachers(list, 'астроном')[0].teacher.name, 'Иванова Анна Сергеевна')
  assert.equal(roomForTeacher(list[2]).room.id, 'psychologist-224')
  assert.equal(roomForTeacher({ name: 'Кто-то', roomId: 'class-217' }).bySubject, false)
  assert.deepEqual(searchTeachers(list, 'ив'), [], 'слишком короткий запрос')
  assert.equal(shortName('Иванова Анна Сергеевна'), 'Иванова А. С.')
})
