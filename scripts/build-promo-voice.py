#!/usr/bin/env python3
"""Озвучка промо-ролика -> public/promo/voice.mp3 и тайминги фраз в
src/admin/promo-timeline.json (по ним идёт анимация, поэтому ролик сам
подстраивается под темп голоса).

Мультик озвучивается двумя версиями:
    --film cartoon        public/promo/cartoon/voice.mp3,        src/admin/cartoon-timeline.json
    --film cartoon-clean  public/promo/cartoon/voice-clean.mp3,  src/admin/cartoon-timeline-clean.json
Разница только в тексте фраз (поле clean в cartoon-script.js), поэтому фразы,
сцены и паузы совпадают, а темп речи и тайминги у версий свои.

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

3. Переозвучка отдельных реплик в уже собранном ролике (--patch-dir). Нужна,
   когда меняется голос одного-двух героев, а остальное пересобирать не надо:
   файлы в папке называются по id фразы из сценария (call.mp3, show.mp3…).
       python3 scripts/build-promo-voice.py --film cartoon2 --patch-dir promo-voice/cartoon2
   Остальные фразы, паузы и тайминги берутся из готовой озвучки как есть,
   поэтому анимация и снятый MP4 остаются валидными: звук в ролик
   перекладывается без пересъёмки — node scripts/render-promo.mjs --film=… --audio-only

После сборки озвучки пересоберите музыку и видео (docs/promo.md):
    python3 scripts/build-promo-music.py
    node scripts/render-promo.mjs
    node scripts/render-promo.mjs --film=cartoon-clean
"""
import argparse
import json
import subprocess
import tempfile
import wave
from pathlib import Path

try:  # нужен только для --patch-dir (подгонка записей под таймлайн)
    import numpy as np
except ImportError:  # остальным режимам сборки numpy не требуется
    np = None

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
    'promo': ('./src/admin/promo-script.js', 'PROMO_LINES', None, 'public/promo/voice.mp3', 'src/admin/promo-timeline.json', GAP),
    'cartoon': ('./src/admin/cartoon-script.js', 'CARTOON_LINES', 'adult', 'public/promo/cartoon/voice.mp3', 'src/admin/cartoon-timeline.json', .5),
    'cartoon-clean': ('./src/admin/cartoon-script.js', 'CARTOON_LINES', 'clean', 'public/promo/cartoon/voice-clean.mp3', 'src/admin/cartoon-timeline-clean.json', .5),
    # Вторая серия мультика, «Вайб-кодинг» (cartoon2-script.js).
    'cartoon2': ('./src/admin/cartoon2-script.js', 'CARTOON2_LINES', 'adult', 'public/promo/cartoon/voice-2.mp3', 'src/admin/cartoon2-timeline.json', .5),
    'cartoon2-clean': ('./src/admin/cartoon2-script.js', 'CARTOON2_LINES', 'clean', 'public/promo/cartoon/voice-2-clean.mp3', 'src/admin/cartoon2-timeline-clean.json', .5),
}
# Голоса по полю voice у фразы: какая модель (main — --voice, alt — --alt-voice),
# темп (length_scale, больше — медленнее) и высота в полутонах.
# ad — диктор рекламной паузы, student и brekin — герои мультика.
# Высоту без нужды не трогаем: сдвиг через asetrate тянет за собой форманты,
# и голос звучит как из бочки. У «Дмитрия» и «Дениса» и так разные голоса:
# студент — Дмитрий как есть, Mr.Брекин — Денис, он ниже и говорит солиднее.
STYLES = {
    'ad': ('alt', .9, 0),
    'student': ('main', 1, 0),
    'brekin': ('alt', 1.06, 0),
    'narrator': ('main', 1, 0),
    # Информатик Дмитрий Александрович (вторая серия): тот же Денис, но медленнее
    # и на два полутона ниже — старше и строже, чем Mr.Брекин.
    'teacher': ('alt', 1.14, -2),
}


def pitch(semitones, source_rate):
    """Фильтр ffmpeg: сдвиг высоты голоса без изменения темпа.

    asetrate меняет частоту дискретизации, а вместе с ней и высоту: чтобы
    поднять голос на N полутонов, надо взять её в 2**(N/12) раз больше
    исходной. Исходная у Piper своя (обычно 22 050 Гц), поэтому считать от
    RATE нельзя — иначе голос уезжает вверх и ускоряется вдвое.
    """
    if not semitones:
        return []
    factor = 2 ** (semitones / 12)
    return [f'asetrate={source_rate * factor:.0f}', f'aresample={RATE}', f'atempo={1 / factor:.5f}']


def sample_rate(path):
    """Частота дискретизации записи — из заголовка wav (Piper отдаёт wav)."""
    with wave.open(str(path), 'rb') as clip:
        return clip.getframerate()


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
        clips.append(to_pcm(raw, Path(tmp) / f'{index}.wav', pitch(semitones, sample_rate(raw))))
    return clips


def clips_in(folder):
    """Записи из папки: {id фразы: путь}. Номер в начале названия не важен."""
    files = {}
    for path in Path(folder).iterdir():
        if path.suffix.lower() in AUDIO:
            stem = path.stem.split('-', 1)[-1] if path.stem[:2].isdigit() else path.stem
            files[stem] = path
    return files


def trim_edges(x):
    """Срезать тишину по краям: от первого до последнего громкого отсчёта."""
    loud = np.flatnonzero(np.abs(x) > max(60, np.abs(x).max() * .02))
    if not len(loud):
        return x
    return x[max(0, loud[0] - int(.02 * RATE)):loud[-1] + int(.05 * RATE)]


def active_rms(x):
    """Громкость только по звучащим отсчётам — тишина её не размывает."""
    peak = np.abs(x).max() if len(x) else 0
    if not peak:
        return 0.0
    voiced = x[np.abs(x) > peak * .05].astype(np.float64)
    return float(np.sqrt(np.mean(voiced ** 2))) if len(voiced) else 0.0


def fit_to_slot(clip, slot, tmp, name):
    """Запись -> ровно slot отсчётов: тишина по краям срезана, темп подогнан.

    Место каждой фразы в ролике фиксировано таймлайном (по нему нарисована
    анимация), поэтому новая запись подгоняется под ту же длину: медленнее —
    чуть ускоряем (atempo, высота голоса не меняется), короче — добиваем тишиной.
    """
    samples = np.frombuffer(clip, dtype='<i2').astype(np.float32)
    samples = trim_edges(samples)
    if not len(samples):
        return np.zeros(slot, dtype=np.float32)
    tempo = len(samples) / slot
    if tempo > 1.005:
        raw = Path(tmp) / f'{name}-raw.wav'
        sped = Path(tmp) / f'{name}-tempo.wav'
        with wave.open(str(raw), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(np.clip(samples, -32768, 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-af', f'atempo={tempo:.5f}',
                        '-ac', '1', '-ar', str(RATE), '-sample_fmt', 's16', str(sped)], check=True)
        with wave.open(str(sped), 'rb') as clip_file:
            samples = np.frombuffer(clip_file.readframes(clip_file.getnframes()), dtype='<i2').astype(np.float32)
    return samples[:slot] if len(samples) > slot else np.pad(samples, (0, slot - len(samples)))


def patched(folder, lines, voice_out, timeline_out):
    """Заменить отдельные фразы в готовой озвучке, не трогая остальное.

    Тайминги, паузы и прочие голоса остаются прежними: правим только те
    отрезки дорожки, для которых в папке есть запись. Новая реплика
    подгоняется по длине под свой отрезок и по громкости — под старую,
    чтобы персонажи звучали ровно.
    """
    clips = clips_in(folder)
    known = {line['id'] for line in lines}
    if not clips:
        raise SystemExit(f'В {folder} нет записей: нужны файлы вида call.mp3, show.mp3…')
    if unknown := sorted(set(clips) - known):
        raise SystemExit(f'Нет таких фраз: {", ".join(unknown)}. Есть: {", ".join(sorted(known))}')
    timeline = json.loads((ROOT / timeline_out).read_text(encoding='utf-8'))
    replaced = []
    with tempfile.TemporaryDirectory() as tmp:
        old = np.frombuffer(to_pcm(ROOT / voice_out, Path(tmp) / 'old.wav'), dtype='<i2').astype(np.float32)
        track = old.copy()
        for item in timeline['lines']:
            path = clips.get(item['id'])
            if not path:
                continue
            first, last = int(round(item['start'] * RATE)), int(round(item['end'] * RATE))
            slot = last - first
            fresh = fit_to_slot(to_pcm(path, Path(tmp) / f"{item['id']}.wav", CLEAN), slot, tmp, item['id'])
            was, now = active_rms(old[first:last]), active_rms(fresh)
            if was and now:
                gain = min(3.0, max(.5, was / now))
                fresh = fresh * gain
            peak = np.abs(fresh).max()
            if peak > 32767 * .98:
                fresh *= 32767 * .98 / peak
            track[first:last] = fresh
            replaced.append(item['id'])
        joined = Path(tmp) / 'voice.wav'
        with wave.open(str(joined), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(np.clip(track, -32768, 32767).astype('<i2').tobytes())
        target = ROOT / voice_out
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(joined), '-ar', str(RATE), '-ac', '1',
                        '-b:a', '112k', str(target)], check=True)
    print(f'{voice_out}: заменено фраз — {len(replaced)} ({", ".join(replaced)}), тайминги без изменений')


def version_lines(script, name, version):
    """Фразы одной версии ролика: у clean вместо say и caption — поля из clean."""
    lines = read_lines(script, name)
    if version != 'clean':
        return lines
    return [{**line, **line.get('clean', {})} for line in lines]


def main():
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--from-dir', help='папка со своими записями фраз (promo-voice)')
    source.add_argument('--voice', help='файл .onnx голоса Piper (рядом должен лежать .onnx.json)')
    source.add_argument('--patch-dir', help='папка с новыми записями отдельных фраз: заменить их в уже собранной озвучке (файлы — по id: call.mp3, show.mp3…)')
    parser.add_argument('--alt-voice', '--ad-voice', dest='alt_voice', help='Piper: второй голос (диктор рекламы, Mr.Брекин), по умолчанию тот же')
    parser.add_argument('--film', choices=FILMS, default='promo', help='какой ролик озвучить: promo, cartoon и cartoon2 (серии мультика с матом), cartoon-clean и cartoon2-clean (без мата)')
    parser.add_argument('--speed', type=float, default=1.06, help='Piper: length_scale, больше — медленнее')
    args = parser.parse_args()
    script, name, version, voice_out, timeline_out, gap = FILMS[args.film]
    lines = version_lines(script, name, version)

    if args.patch_dir:
        if np is None:
            raise SystemExit('Для --patch-dir нужен numpy: pip install numpy')
        patched(args.patch_dir, lines, voice_out, timeline_out)
        return

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
