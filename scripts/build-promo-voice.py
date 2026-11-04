#!/usr/bin/env python3
"""Озвучка промо-ролика: текст из src/admin/promo-script.js -> public/promo/voice.mp3
и тайминги фраз в src/admin/promo-timeline.json (по ним идёт анимация).

Голос — Piper (https://github.com/OHF-Voice/piper1-gpl), бесплатный, работает без
интернета. Голос ru_RU-dmitri-medium обучен на наборе с лицензией CC0.

Запуск (нужны python3, node и ffmpeg):
  python3 -m venv .venv-tts && .venv-tts/bin/pip install piper-tts
  .venv-tts/bin/python scripts/build-promo-voice.py --voice путь/ru_RU-dmitri-medium.onnx
Подробно — docs/promo.md.
"""
import argparse
import json
import subprocess
import tempfile
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
LEAD_IN = 0.7   # тишина в начале, с
GAP = 0.45      # пауза между фразами, с
TAIL = 2.2      # тишина в конце, пока висит финальный кадр, с


def read_lines():
    code = "import('./src/admin/promo-script.js').then((m) => console.log(JSON.stringify(m.PROMO_LINES)))"
    out = subprocess.run(['node', '-e', code], cwd=ROOT, check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--voice', required=True, help='файл .onnx голоса Piper (рядом должен лежать .onnx.json)')
    parser.add_argument('--speed', type=float, default=1.06, help='length_scale: больше — медленнее')
    args = parser.parse_args()

    voice = PiperVoice.load(args.voice)
    config = SynthesisConfig(length_scale=args.speed, noise_scale=0.6, noise_w_scale=0.75)
    rate = voice.config.sample_rate
    lines = read_lines()

    with tempfile.TemporaryDirectory() as tmp:
        frames = bytearray()
        silence = lambda seconds: b'\x00\x00' * int(rate * seconds)
        frames += silence(LEAD_IN)
        timeline = []
        for index, line in enumerate(lines):
            part = Path(tmp) / f'{index}.wav'
            with wave.open(str(part), 'wb') as out:
                voice.synthesize_wav(line['say'], out, syn_config=config)
            with wave.open(str(part), 'rb') as clip:
                data = clip.readframes(clip.getnframes())
            start = len(frames) / 2 / rate
            frames += data
            end = len(frames) / 2 / rate
            timeline.append({'id': line['id'], 'start': round(start, 3), 'end': round(end, 3)})
            frames += silence(GAP if index < len(lines) - 1 else TAIL)
        joined = Path(tmp) / 'voice.wav'
        with wave.open(str(joined), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(rate)
            out.writeframes(bytes(frames))
        duration = round(len(frames) / 2 / rate, 3)
        target = ROOT / 'public' / 'promo' / 'voice.mp3'
        target.parent.mkdir(parents=True, exist_ok=True)
        # Громкость по стандарту для роликов (-16 LUFS), лёгкое тепло в низах.
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(joined),
                        '-af', 'highpass=f=70,equalizer=f=180:t=q:w=1:g=2,loudnorm=I=-16:TP=-1.5:LRA=11',
                        '-ar', '44100', '-ac', '1', '-b:a', '96k', str(target)], check=True)

    (ROOT / 'src' / 'admin' / 'promo-timeline.json').write_text(
        json.dumps({'voice': Path(args.voice).stem, 'duration': duration, 'lines': timeline}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'voice.mp3: {duration} с, фраз: {len(timeline)}')


if __name__ == '__main__':
    main()
