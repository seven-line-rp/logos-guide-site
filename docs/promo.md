# Промо-ролик

Вкладка «Промо-ролик» в панели (`/admin/promo`, открывается без ключа). Ролик на
43 секунды показан на настоящих экранах сайта: поиск кабинета, карта, маршрут,
расписание и таблички «Вы здесь». Субтитров в ролике нет.

Посреди ролика — шуточная рекламная пауза (около 5 секунд): плашка «Реклама»
с помехами, как при переключении канала, и «реклама» несуществующего
Mr.Брекин VPN, который «обходит ваши пары стороной» — карточки пар облетают его
щит. Внизу кадра подписано, что это шутка. Читает её другой голос Piper
(`ru_RU-denis-medium`, CC0), под неё вместо фоновой музыки играет свой джингл.
Сразу после паузы ролик показывает расписание — как на пары всё-таки дойти.

## Озвучить своим голосом

Текст фраз и названия файлов лежат в [`promo-voice/README.md`](../promo-voice/README.md).
Есть два способа.

**Прямо в панели, без программ.** В разделе «Свой голос» у каждой фразы есть
кнопка «Записать». Ролик начинает играть за секунду до фразы, на экране
появляется суфлёр. Когда он станет зелёным, читайте. Записи хранятся только в
этом браузере (IndexedDB) и не пропадают после перезагрузки. Дальше:

- «Голос: Свой» — смотреть ролик с вашим голосом. Музыка сама приглушается, когда
  звучит голос. Громкость голоса и музыки настраивается ползунками.
- «Скачать ролик с этим звуком» — ролик собирается в браузере за время его показа
  (около 40 секунд, вкладку не сворачивать). Chrome и Edge сохраняют MP4, другие
  браузеры — WebM.
- «Скачать звук (WAV)» — только звук: голос с музыкой, для монтажа в другой программе.

Ролик в этом случае не меняется под ваш темп. Если фраза длиннее своего места,
панель предупредит, на сколько секунд.

**Записи на телефон и сборка по своему темпу.** Запишите фразы на диктофон,
положите файлы в `promo-voice/` и выполните:

```bash
python3 scripts/build-promo-voice.py --from-dir promo-voice
python3 scripts/build-promo-music.py
npm run dev
node scripts/render-promo.mjs
```

Скрипт обрежет тишину, уберёт лёгкий шум, выровняет громкость и пересчитает
тайминги. Анимация подстроится под ваш темп. Потом закоммитьте `public/promo/`,
`src/admin/promo-timeline.json` и `promo-voice/`.

## Из чего собран ролик

| Файл | Что это | Чем собирается |
| --- | --- | --- |
| `src/admin/promo-script.js` | текст фраз и сцена каждой фразы | правится руками |
| `src/admin/promo-timeline.json` | когда начинается и кончается фраза | `build-promo-voice.py` |
| `public/promo/voice.mp3` | голос по умолчанию (синтез Piper) | `build-promo-voice.py` |
| `public/promo/music.mp3` | фоновая музыка | `build-promo-music.py` |
| `public/promo/shots/*.webp`, `src/admin/promo-shots.json` | снимки экранов сайта и координаты кнопок на них | `capture-promo-shots.mjs` |
| `src/admin/PromoStage.jsx` | анимация: кадр ролика в момент `t` | правится руками |
| `public/promo/logos-promo-video.mp4` | ролик без звука, на него в панели накладывается голос | `render-promo.mjs` |
| `public/promo/logos-promo.mp4` | готовый ролик с синтезированным голосом и музыкой | `render-promo.mjs` |
| `public/promo/poster.jpg` | обложка плеера | `render-promo.mjs` |

Анимация считается от времени, поэтому её можно перематывать, а MP4 снимается
кадр за кадром из тех же сцен. Файлы `public/promo/` не попадают в офлайн-кэш
сайта (`OFFLINE_SKIP` в `vite.config.js`).

Если поменялся интерфейс сайта, переснимите экраны (`node scripts/capture-promo-shots.mjs`)
и ролик (`node scripts/render-promo.mjs`). Снимки делаются в четверг 5 ноября
в 10:31 по Москве с одной парой в расписании, чтобы на главной была видна
«Следующая пара».

## Музыка

Музыка сочинена скриптом `scripts/build-promo-music.py` (синтез на numpy): темп
104, аккорды C – G – Am – F, пэд, перебор, бас и лёгкий бит. Прав на неё не
нужно. Длина подстраивается под озвучку, громкость −21 LUFS, на 5 дБ тише голоса.

## Синтезированный голос

Голос по умолчанию — **Piper**, `ru_RU-dmitri-medium`: бесплатно, без
регистрации и без интернета, записи голоса под лицензией CC0. Голос `denis` тоже
CC0. Голоса `irina` (лицензия не указана) и `ruslan` (CC BY-NC-SA, только
некоммерческое) не используем.

```bash
python3 -m venv .venv-tts && .venv-tts/bin/pip install piper-tts numpy
curl -L -o ru_RU-dmitri-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx
curl -L -o ru_RU-dmitri-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx.json
.venv-tts/bin/python scripts/build-promo-voice.py --voice ru_RU-dmitri-medium.onnx --ad-voice ru_RU-denis-medium.onnx
```

Голос `denis` скачивается так же, как `dmitri` (замените `dmitri` на `denis` в адресах).

## Мультик про Mr.Брекина

Две серии, у каждой — версия с матом и без. В панели серии переключаются
кнопками вверху вкладки (`/admin/cartoon`, `/admin/cartoon?episode=2`).

### Серия 1. «Mr.Брекин спешит на помощь»

Вкладка «Мультик» в панели (`/admin/cartoon`, без ключа) — отдельный шуточный
ролик на 52 секунды. Студенту через минуту на физику, ЛОГОС не открывается
(«Путеводитель недоступен»), и тут с «ПУФ!» появляется Mr.Брекин VPN: жмёт
кнопку, ЛОГОС открывается, студент бежит по стрелкам и успевает к звонку.
В конце — «Если ЛОГОС недоступен — зовите Mr.Брекина*» и честная сноска:
ЛОГОС работает и без интернета.

Ролик выпускается в двух версиях, сцены и реплики в них одни и те же:

| Версия | Что отличается | Файлы |
| --- | --- | --- |
| с матом (`adult`, 18+) | тексты реплик, плашка 18+ в кадре | `voice.mp3`, `music.mp3`, `logos-cartoon.mp4`, `poster.jpg`, `src/admin/cartoon-timeline.json` |
| без мата (`clean`) | те же реплики без ругательств | `voice-clean.mp3`, `music-clean.mp3`, `logos-cartoon-clean.mp4`, `poster-clean.jpg`, `src/admin/cartoon-timeline-clean.json` |

У версий разная длина (реплики звучат по-разному), поэтому у каждой свой
таймлайн: `CartoonStage` берёт его по `version`. Смотреть обе версии можно
прямо в панели, там же и скачивание MP4. Облачков с репликами в кадре нет:
текст звучит голосом, герои только шевелят губами.

| Файл | Что это | Чем собирается |
| --- | --- | --- |
| `src/admin/cartoon-script.js` | реплики (`say`/`caption` + `clean`), кто говорит, сцены, версии | правится руками |
| `src/admin/CartoonStage.jsx` | анимация: кадр мультика в момент `t` для версии `version` | правится руками |
| `src/admin/cartoon-timeline.json`, `public/promo/cartoon/voice.mp3` | голос и тайминги версии с матом | `build-promo-voice.py --film cartoon` |
| `src/admin/cartoon-timeline-clean.json`, `public/promo/cartoon/voice-clean.mp3` | то же для версии без мата | `build-promo-voice.py --film cartoon-clean` |
| `public/promo/cartoon/music.mp3`, `music-clean.mp3` | музыка и звуки (скрежет, «ПУФ!», щелчок, звонок) | `build-cartoon-music.py` |
| `public/promo/cartoon/logos-cartoon.mp4`, `logos-cartoon-clean.mp4` и обложки | готовые ролики | `render-promo.mjs --film=cartoon[-clean]` |

Голоса: студент — `dmitri` как есть (~185 Гц), Mr.Брекин — `denis` чуть
медленнее (~140 Гц), рассказчик в конце — `dmitri`. Высоту голоса не крутим:
`pitch()` в `build-promo-voice.py` считает `asetrate` от реальной частоты файла
(Piper отдаёт 22050 Гц), иначе голос ускоряется и звучит на октаву выше.

```bash
.venv-tts/bin/python scripts/build-promo-voice.py --film cartoon --voice ru_RU-dmitri-medium.onnx --alt-voice ru_RU-denis-medium.onnx
.venv-tts/bin/python scripts/build-promo-voice.py --film cartoon-clean --voice ru_RU-dmitri-medium.onnx --alt-voice ru_RU-denis-medium.onnx
python3 scripts/build-cartoon-music.py            # все ролики, или --film cartoon-clean
npm run dev
node scripts/render-promo.mjs --film=cartoon
node scripts/render-promo.mjs --film=cartoon-clean
```

### Серия 2. «Вайб-кодинг»

Информатик Дмитрий Александрович просит студента показать сайт, видит в мониторе
чат с ИИ-помощником и устраивает разнос: «Вайб-кодер! Это не ты сделал, это ИИ
сделал! Два!» Тут с «ПУФ!» прилетает Mr.Брекин. В версии с матом он говорит
«Да иди ты нахуй», в версии без мата — «Извиняюсь, ты совершил глубочайшую
ошибку: не сделано ИИ, а сделано с ПОМОЩЬЮ ИИ». Финал: «Mr.Брекин VPN. Обходит
пары стороной и заступается за своих». Персонажи вымышлены — это подписано в кадре.

| Файл | Что это | Чем собирается |
| --- | --- | --- |
| `src/admin/cartoon2-script.js` | реплики, сцены, версии второй серии | правится руками |
| `src/admin/Cartoon2Stage.jsx` | анимация второй серии (студент и Mr.Брекин — из `CartoonStage.jsx`) | правится руками |
| `src/admin/cartoon2-timeline.json`, `cartoon2-timeline-clean.json`, `public/promo/cartoon/voice-2.mp3`, `voice-2-clean.mp3` | голоса и тайминги | `build-promo-voice.py --film cartoon2` и `--film cartoon2-clean` |
| `public/promo/cartoon/music-2.mp3`, `music-2-clean.mp3` | музыка и звуки (скрежет, гул, удар «Два!», «ПУФ!») | `build-cartoon-music.py` |
| `public/promo/cartoon/logos-cartoon-2.mp4`, `logos-cartoon-2-clean.mp4`, `poster-2.jpg`, `poster-2-clean.jpg` | готовые ролики | `render-promo.mjs --film=cartoon2[-clean]` |

Информатика озвучивает `denis` медленнее и на два полутона ниже, чем Mr.Брекина.

```bash
.venv-tts/bin/python scripts/build-promo-voice.py --film cartoon2 --voice ru_RU-dmitri-medium.onnx --alt-voice ru_RU-denis-medium.onnx
.venv-tts/bin/python scripts/build-promo-voice.py --film cartoon2-clean --voice ru_RU-dmitri-medium.onnx --alt-voice ru_RU-denis-medium.onnx
python3 scripts/build-cartoon-music.py
npm run dev
node scripts/render-promo.mjs --film=cartoon2
node scripts/render-promo.mjs --film=cartoon2-clean
```
