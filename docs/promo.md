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

## Мультик «Mr.Брекин спешит на помощь»

Вкладка «Мультик» в панели (`/admin/cartoon`, без ключа) — отдельный шуточный
ролик на 37 секунд, 18+: герои ругаются матом. Студенту через минуту на физику,
ЛОГОС не открывается («Путеводитель недоступен»), и тут с «ПУФ!» появляется
Mr.Брекин VPN: жмёт кнопку, ЛОГОС открывается, студент бежит по стрелкам и
успевает к звонку. В конце — «Если ЛОГОС недоступен — зовите Mr.Брекина*» и
честная сноска: ЛОГОС работает и без интернета. Реплики видны в облачках.

| Файл | Что это | Чем собирается |
| --- | --- | --- |
| `src/admin/cartoon-script.js` | реплики, кто говорит, сцены | правится руками |
| `src/admin/CartoonStage.jsx` | анимация: кадр мультика в момент `t` | правится руками |
| `src/admin/cartoon-timeline.json`, `public/promo/cartoon/voice.mp3` | голоса и тайминги | `build-promo-voice.py --film cartoon` |
| `public/promo/cartoon/music.mp3` | музыка и звуки (скрежет, «ПУФ!», щелчок, звонок) | `build-cartoon-music.py` |
| `public/promo/cartoon/logos-cartoon.mp4`, `poster.jpg` | готовый мультик и обложка | `render-promo.mjs --film=cartoon` |

Голоса: студент — `dmitri` на 2,5 полутона выше, Mr.Брекин — `denis` медленнее
и на 2,5 полутона ниже, рассказчик в конце — `dmitri` как есть.

```bash
.venv-tts/bin/python scripts/build-promo-voice.py --film cartoon --voice ru_RU-dmitri-medium.onnx --alt-voice ru_RU-denis-medium.onnx
python3 scripts/build-cartoon-music.py
npm run dev
node scripts/render-promo.mjs --film=cartoon
```
