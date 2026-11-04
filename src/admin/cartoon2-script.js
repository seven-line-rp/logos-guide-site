// Сценарий второй серии мультика: «Вайб-кодинг» (вкладка «Мультик» в /admin).
// Информатик Дмитрий Александрович распекает студента за то, что сайт сделан
// с нейросетью, и тут прилетает Mr.Брекин VPN. Персонажи вымышлены.
//
// Устроено как первая серия (cartoon-script.js): say и caption — версия с матом
// (adult), clean — та же фраза без мата. voice — кто говорит: student, teacher,
// brekin или narrator (голоса — в build-promo-voice.py). lead и tail — лишняя
// тишина до и после фразы, с. После правки текста пересоберите озвучку:
//   python3 scripts/build-promo-voice.py --film cartoon2 ...
//   python3 scripts/build-promo-voice.py --film cartoon2-clean ...   (docs/promo.md)

const same = (say, caption = say) => ({ say, caption, clean: { say, caption } })

export const CARTOON2_LINES = [
  { id: 'call', scene: 'lab', voice: 'teacher', lead: 1.2, ...same('Так, Орлов. Ну-ка покажи, что ты там накодил.') },
  { id: 'show', scene: 'screen', voice: 'student', lead: .6, ...same('Вот, Дмитрий Александрович. Путеводитель по колледжу: карта, маршруты, расписание.') },
  {
    id: 'rant', scene: 'rant', voice: 'teacher', lead: .5,
    say: 'Это что, опять нейросеть?! Вайб-кодер хренов! Это не ты сделал, это ИИ сделал!',
    caption: 'Это что, опять нейросеть?! Вайб-кодер хренов! Это не ты сделал, это ИИ сделал!',
    clean: { say: 'Это что, опять нейросеть?! Вайб-кодер несчастный! Это не ты сделал, это ИИ сделал!', caption: 'Это что, опять нейросеть?! Вайб-кодер несчастный! Это не ты сделал, это ИИ сделал!' },
  },
  {
    id: 'grade', scene: 'rant', voice: 'teacher',
    say: 'В моё время код писали руками, в тетрадке! Два, нахрен!',
    caption: 'В моё время код писали руками, в тетрадке! Два, нахрен!',
    clean: { say: 'В моё время код писали руками, в тетрадке! Ставлю два!', caption: 'В моё время код писали руками, в тетрадке! Ставлю два!' },
  },
  {
    id: 'sad', scene: 'rant', voice: 'student', lead: .3,
    say: 'Ну пиздец, приехали.',
    caption: 'Ну пиздец, приехали.',
    clean: { say: 'Ну всё, приехали.', caption: 'Ну всё, приехали.' },
  },
  {
    id: 'burst', scene: 'poof', voice: 'brekin', lead: 1.2, tail: .4,
    say: 'Да иди ты нахуй.',
    caption: 'Да иди ты нахуй.',
    clean: {
      say: 'Извиняюсь, ты совершил глубочайшую ошибку. Не сделано И И, а сделано с помощью И И.',
      caption: 'Извиняюсь, ты совершил глубочайшую ошибку: не сделано ИИ, а сделано с ПОМОЩЬЮ ИИ.',
    },
  },
  {
    id: 'stun', scene: 'poof', voice: 'teacher',
    say: 'Это ещё что за хрен в шляпе?!',
    caption: 'Это ещё что за хрен в шляпе?!',
    clean: { say: 'Это ещё что за чудо в шляпе?!', caption: 'Это ещё что за чудо в шляпе?!' },
  },
  { id: 'proud', scene: 'poof', voice: 'student', ...same('Это мистер Бре́кин. Он со мной.', 'Это Mr.Брекин. Он со мной.') },
  {
    id: 'outro', scene: 'end', voice: 'narrator', lead: .6,
    ...same('Мистер Бре́кин ви-пи-эн. Обходит пары стороной и заступается за своих. Логос гайд точка ру.', 'Mr.Брекин VPN. Обходит пары стороной и заступается за своих.'),
  },
]

export const CARTOON2_SCENES = ['lab', 'screen', 'rant', 'poof', 'end']

// Две версии второй серии, как у первой (CARTOON_VERSIONS в cartoon-script.js).
export const CARTOON2_VERSIONS = [
  {
    id: 'adult',
    title: 'С матом',
    note: 'Как герои говорят на самом деле. 18+',
    age: '18+',
    film: 'cartoon2',
    video: '/promo/cartoon/logos-cartoon-2.mp4',
    poster: '/promo/cartoon/poster-2.jpg',
    download: 'logos-cartoon-2.mp4',
    voice: '/promo/cartoon/voice-2.mp3',
    music: '/promo/cartoon/music-2.mp3',
  },
  {
    id: 'clean',
    title: 'Без мата',
    note: 'Та же история без крепких словечек — можно показывать всем',
    age: null,
    film: 'cartoon2-clean',
    video: '/promo/cartoon/logos-cartoon-2-clean.mp4',
    poster: '/promo/cartoon/poster-2-clean.jpg',
    download: 'logos-cartoon-2-clean.mp4',
    voice: '/promo/cartoon/voice-2-clean.mp3',
    music: '/promo/cartoon/music-2-clean.mp3',
  },
]
