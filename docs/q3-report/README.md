# Итоги Q3

- `logos-q3-itogi.pdf` — презентация, 13 слайдов
- `logos-q3-itogi.mp4` — ролик, 79 секунд, 1080p

Оба файла собираются из `report.html`:

```bash
node docs/q3-report/render.cjs pdf
node docs/q3-report/render.cjs video
```

Периоды: Q1 — 15–22 октября 2026, Q3 — 1–15 ноября 2026. Цифры посчитаны по истории git,
скриншоты в `shots/` сняты с версий сайта на 22 октября и 15 ноября.

## Музыка

Трек «Tech House vibes», Alejandro Magaña, с mixkit.co (Mixkit Stock Music Free License:
можно использовать в видео, нельзя распространять сам файл). Поэтому `music.mp3` в репозитории
нет. Чтобы пересобрать ролик, скачайте трек и обрежьте до длины ролика:

```bash
curl -o track.mp3 https://assets.mixkit.co/music/130/130.mp3
ffmpeg -i track.mp3 -t 78.69 -af "afade=t=out:st=75.2:d=3.4" docs/q3-report/music.mp3
```

Сцены сменяются по тактам: темп задан в `report.html` константой `BAR` (122 уд/мин).
С другим треком поменяйте в ней число ударов в минуту.

## Фото команды

`team/*.png` — фотографии со страницы «О проекте» (logos-guide.ru/team/) с удалённым белым фоном.
