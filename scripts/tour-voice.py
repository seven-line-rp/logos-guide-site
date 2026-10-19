#!/usr/bin/env python3
"""Собирает озвучку экскурсии в public/voice/tour/<голос>/<экскурсия>-<N>.mp3.

Голоса — нейросетевые голоса Microsoft (как в озвучке маршрута) через
пакет edge-tts: «Светлана» (женский) и «Дмитрий» (мужской). Тексты берутся
из поля `say` остановок в src/tours.js. Запускать можно на своём
компьютере или в GitHub Actions (.github/workflows/tour-voice.yml — он
сам пересобирает записи, когда меняются тексты):

    pip install edge-tts
    python3 scripts/tour-voice.py

Нужны node (прочитать src/tours.js), ffmpeg (единая громкость и формат) и
доступ в интернет.
"""
import asyncio
import json
import os
import subprocess
import tempfile

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Голос сайта → голос Microsoft, темп и высота. Чуть быстрее обычного —
# так речь звучит живее и бодрее, как у экскурсовода.
VOICES = {
    'female': {'name': 'ru-RU-SvetlanaNeural', 'rate': '+6%', 'pitch': '+0Hz'},
    'male': {'name': 'ru-RU-DmitryNeural', 'rate': '+6%', 'pitch': '+0Hz'},
}


def tours():
    script = "import('./src/tours.js').then((m) => console.log(JSON.stringify(m.tours.map((t) => ({ id: t.id, stops: t.stops.map((s) => s.say || `${s.title}. ${s.text}`) })))))"
    return json.loads(subprocess.check_output(['node', '-e', script], cwd=ROOT))


async def speak(text, voice, target):
    with tempfile.NamedTemporaryFile(suffix='.mp3') as raw:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, voice['name'], rate=voice['rate'], pitch=voice['pitch']).save(raw.name)
                break
            except Exception:  # сервис иногда сбрасывает соединение — повторяем
                if attempt == 3:
                    raise
                await asyncio.sleep(2 * (attempt + 1))
        # Единая громкость, короткая тишина в начале и тот же формат, что у
        # записей маршрута: 24 кГц, моно, 64 кбит/с.
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw.name, '-af', 'adelay=120,loudnorm=I=-16:TP=-1.5,aresample=24000',
                        '-ac', '1', '-b:a', '64k', target], check=True)


async def main():
    for tour in tours():
        for voice_id, voice in VOICES.items():
            out_dir = os.path.join(ROOT, 'public', 'voice', 'tour', voice_id)
            os.makedirs(out_dir, exist_ok=True)
            for index, text in enumerate(tour['stops']):
                target = os.path.join(out_dir, f"{tour['id']}-{index + 1}.mp3")
                await speak(text, voice, target)
                print(target)


if __name__ == '__main__':
    asyncio.run(main())
