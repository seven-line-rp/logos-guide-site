#!/usr/bin/env python3
"""Озвучка промо-ролика -> public/promo/voice.mp3 и тайминги фраз в
src/admin/promo-timeline.json (по ним идёт анимация, поэтому ролик сам
подстраивается под темп голоса). С --film cartoon — то же для мультика:
public/promo/cartoon/voice.mp3 и src/admin/cartoon-timeline.json.

Два варианта:

1. Свой голос (основной). Запишите каждую фразу отдельным файлом и положите
   в папку promo-voice/ — какие файлы и что читать, написано в
   promo-voice/README.md. Формат любой: wav, mp3, m4a, ogg, webm.
       python3 scripts/build-promo-voice.py --from-dir promo-voice
   Тишина по краям каждой записи обрезается, лёгкий шум убирается, громкость
   выравнивается. Паузы между фразами скрипт ставит сам.

2. Синтез Piper (запасной): бесплатный голос ru_RU-dmitri-medium (набор CC0).
       python3 -m venv .venv-tts && .venv-tts/bin/pip install piper-tts
       .venv-tts/bin/python scripts/build-promo-voice.py --voice ru_RU-dmitri-medium.onnx

После сборки озвучки пересоберите музыку и видео (docs/promo.md):
    python3 scripts/build-promo-music.py
    node scripts/render-promo.mjs
"""
import argparse
import json
import subprocess
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RATE = 44100
LEAD_IN = 0.7   # тишина в начале, с
GAP = 0.45      # пауза между фразами, с
TAIL = 2.2      # тишина в конце, пока висит финальный кадр, с
AUDIO = ('.wav', '.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.webm', '.flac')

# Обработка голоса: срезаем гул ниже 80 Гц и «бубнение» около 250 Гц, поднимаем
# разборчивость (3 кГц) и воздух (8 кГц), слегка сжимаем динамику.
# Громкость по стандарту для роликов: -16 LUFS (музыка тише, -21).
POLISH = ['highpass=f=80', 'equalizer=f=250:t=q:w=1:g=-2.5', 'equalizer=f=3200:t=q:w=1.2:g=3.5',
          'equalizer=f=8000:t=q:w=1:g=2.5', 'acompressor=threshold=-20dB:ratio=3:attack=5:release=90']
# Для записей с телефона или ноутбука: убрать шум комнаты и тишину по краям.
CLEAN = ['afftdn=nf=-28', 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.08',
         'areverse', 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.15', 'areverse']


# Ролики: сценарий (файл и имя списка фраз), куда класть голос и тайминги.
FILMS = {
    'promo': ('./src/admin/promo-script.js', 'PROMO_LINES', 'public/promo/voice.mp3', 'src/admin/promo-timeline.json', GAP),
    'cartoon': ('./src/admin/cartoon-script.js', 'CARTOON_LINES', 'public/promo/cartoon/voice.mp3', 'src/admin/cartoon-timeline.json', .5),
}
# Голоса по полю voice у фразы: какая модель (main — --voice, alt — --alt-voice),
# темп (length_scale, больше — медленнее) и высота в полутонах.
# ad — диктор рекламной паузы, student и brekin — герои мультика.
STYLES = {
    'ad': ('alt', .9, 0),
    'student': ('main', 1, 2.5),
    'brekin': ('alt', 1.12, -2.5),
    'narrator': ('main', 1, 0),
}


def pitch(semitones):
    """Фильтр ffmpeg: сдвиг высоты голоса без изменения темпа."""
    if not semitones:
        return []
    factor = 2 ** (semitones / 12)
    return [f'asetrate={RATE * factor:.0f}', f'aresample={RATE}', f'atempo={1 / factor:.5f}']


def read_lines(script, name):
    code = f"import('{script}').then((m) => console.log(JSON.stringify(m.{name})))"
    out = subprocess.run(['node', '-e', code], cwd=ROOT, check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def to_pcm(source, target, filters=()):
    """Любой аудиофайл -> wav, моно, 44,1 кГц, 16 бит."""
    args = ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(source)]
    if filters:
        args += ['-af', ','.join(filters)]
    subprocess.run(args + ['-ac', '1', '-ar', str(RATE), '-sample_fmt', 's16', str(target)], check=True)
    with wave.open(str(target), 'rb') as clip:
        return clip.readframes(clip.getnframes())


def recorded(folder, lines, tmp):
    files = {path.stem.split('-', 1)[-1] if path.stem[:2].isdigit() else path.stem: path
             for path in Path(folder).iterdir() if path.suffix.lower() in AUDIO}
    missing = [line['id'] for line in lines if line['id'] not in files]
    if missing:
        raise SystemExit(f'Нет записей для фраз: {", ".join(missing)}. Названия файлов — в promo-voice/README.md')
    return [to_pcm(files[line['id']], Path(tmp) / f'{index}.wav', CLEAN) for index, line in enumerate(lines)]


def synthesized(model, speed, lines, tmp, alt_model=None):
    from piper import PiperVoice, SynthesisConfig  # нужен только для синтеза
    voices = {'main': PiperVoice.load(model)}
    voices['alt'] = PiperVoice.load(alt_model) if alt_model else voices['main']
    clips = []
    for index, line in enumerate(lines):
        raw = Path(tmp) / f'{index}-raw.wav'
        which, tempo, semitones = STYLES.get(line.get('voice'), ('main', 1, 0))
        lively = line.get('voice') in STYLES
        config = SynthesisConfig(length_scale=speed * tempo, noise_scale=0.75 if lively else 0.6, noise_w_scale=0.9 if lively else 0.75)
        with wave.open(str(raw), 'wb') as out:
            voices[which].synthesize_wav(line['say'], out, syn_config=config)
        clips.append(to_pcm(raw, Path(tmp) / f'{index}.wav', pitch(semitones)))
    return clips


def main():
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--from-dir', help='папка со своими записями фраз (promo-voice)')
    source.add_argument('--voice', help='файл .onnx голоса Piper (рядом должен лежать .onnx.json)')
    parser.add_argument('--alt-voice', '--ad-voice', dest='alt_voice', help='Piper: второй голос (диктор рекламы, Mr.Брекин), по умолчанию тот же')
    parser.add_argument('--film', choices=FILMS, default='promo', help='какой ролик озвучить: promo или cartoon (мультик)')
    parser.add_argument('--speed', type=float, default=1.06, help='Piper: length_scale, больше — медленнее')
    args = parser.parse_args()
    script, name, voice_out, timeline_out, gap = FILMS[args.film]
    lines = read_lines(script, name)

    with tempfile.TemporaryDirectory() as tmp:
        clips = recorded(args.from_dir, lines, tmp) if args.from_dir else synthesized(args.voice, args.speed, lines, tmp, args.alt_voice)
        silence = lambda seconds: b'\x00\x00' * int(RATE * seconds)
        frames = bytearray(silence(LEAD_IN))
        timeline = []
        for index, (line, data) in enumerate(zip(lines, clips)):
            frames += silence(line.get('lead', 0))
            start = len(frames) / 2 / RATE
            frames += data
            timeline.append({'id': line['id'], 'start': round(start, 3), 'end': round(len(frames) / 2 / RATE, 3)})
            frames += silence(line.get('tail', 0))
            frames += silence(gap if index < len(lines) - 1 else TAIL)
        joined = Path(tmp) / 'voice.wav'
        with wave.open(str(joined), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(bytes(frames))
        duration = round(len(frames) / 2 / RATE, 3)
        target = ROOT / voice_out
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(joined), '-af', ','.join(POLISH + ['loudnorm=I=-16:TP=-1.5:LRA=9']),
                        '-ar', str(RATE), '-ac', '1', '-b:a', '112k', str(target)], check=True)

    voice_name = f'запись: {Path(args.from_dir).name}' if args.from_dir else Path(args.voice).stem
    (ROOT / timeline_out).write_text(
        json.dumps({'voice': voice_name, 'duration': duration, 'lines': timeline}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{voice_out}: {duration} с, фраз: {len(timeline)}')


if __name__ == '__main__':
    main()
