// Цитаты, любимые места и портреты преподавателей.
// Хранятся отдельно от public/teachers.json: тот файл перезаписывает
// scripts/import-teachers.mjs, а эти данные пишутся вручную.
//
// Портрет кладём в public/teachers/ под именем «Имя Фамилия.png»,
// например public/teachers/Александр Полянский.png. Пока файла нет,
// на карточке показываются инициалы.
//
// place.roomId — id из src/data.js: тогда место можно открыть на карте.
// extra: true — человека нет на странице «Педагогический состав»,
// добавляем его в список сами.

export const teacherProfiles = {
  'Полянский Александр Александрович': {
    extra: true,
    place: {
      title: 'Актовый зал',
      roomId: 'auditorium-104',
      why: 'Здесь проходит много всего классного: концерты, праздники, встречи и репетиции. Это место, где колледж собирается вместе.',
    },
    quotes: ['Доверие не купишь ни за какие сокровища мира, ибо его цена — искренность, а не золото.'],
  },
  'Батмазова Виктория Владимировна': {
    place: {
      title: 'Свой кабинет в учебной части',
      roomId: 'academic-office',
      why: 'Здесь ей нравится всё: каждая вещь на своём месте, всё устроено по её вкусу и продумано до мелочей. Порядок вокруг — продолжение порядка внутри.',
    },
    quotes: ['Самое важное — это навести порядок в душе.'],
  },
  'Прохоренко Екатерина Андреевна': {
    place: {
      title: 'Столовая',
      roomId: 'canteen',
      why: 'Приятная атмосфера: тепло, уютно, вкусно пахнет, и между парами здесь можно спокойно перевести дух.',
    },
    quotes: ['Работа не волк. Волк — волк.', 'Делай как надо. Как не надо — не делай.'],
  },
  'Елисов Андрей Владимирович': {
    extra: true,
    place: {
      title: 'Собственный кабинет',
      why: 'Своя епархия: здесь он полноправный хозяин, всё заведено по его порядку. Тут спокойно думается и решаются самые важные дела.',
    },
    quotes: ['Суди о сегодняшнем дне не по плодам, которые ты собрал, а по семенам, которые ты посеял.'],
  },
  'Золотарев Владимир Владимирович': {
    place: {
      title: 'Кабинет химии и биологии',
      roomId: 'chemistry-biology-202',
      why: 'Можно спрятаться в лаборатории — среди колб и реактивов, где тихо и всегда найдётся интересный опыт.',
    },
    quotes: [{ text: 'Docendo discimus', note: 'Уча, учимся' }],
  },
}

// «Полянский Александр Александрович» → «/teachers/Александр Полянский.png»
export function portraitUrl(name) {
  const [last = '', first = ''] = name.trim().split(/\s+/)
  return `/teachers/${encodeURIComponent(`${first} ${last}`.trim())}.png`
}

export function normalizeQuote(quote) {
  return typeof quote === 'string' ? { text: quote } : quote
}

// Список с сайта + люди, которых там нет; к каждому — его профиль.
export function withProfiles(list, profiles = teacherProfiles) {
  const names = new Set(list.map((teacher) => teacher.name))
  const extras = Object.keys(profiles).filter((name) => profiles[name].extra && !names.has(name)).map((name) => ({ name }))
  return list.concat(extras).map((teacher) => (profiles[teacher.name] ? { ...teacher, profile: profiles[teacher.name] } : teacher))
}
