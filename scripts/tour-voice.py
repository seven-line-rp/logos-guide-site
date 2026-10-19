#!/usr/bin/env python3
"""Собирает озвучку экскурсии в public/voice/tour/<голос>/<экскурсия>-<N>.mp3.

Синтезатор — RHVoice (офлайн, свободные русские голоса). Тексты берутся из
поля `say` остановок в src/tours.js, поэтому после правки текста достаточно
запустить скрипт заново.

    python3 -m venv .rhv && .rhv/bin/pip install -U setuptools scons rhvoice-wrapper rhvoice-wrapper-data rhvoice-wrapper-bin
    git clone --depth 1 https://github.com/RHVoice/arina-rus.git voices/arina-rus
.rhv/bin/python scripts/tour-voice.py voices

Нужны node (чтобы прочитать src/tours.js) и ffmpeg (wav → mp3).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Голос сайта → голос RHVoice и настройки: чуть живее темп, мягкая высота.
# Арина и Александр выбраны как самые светлые и «молодые» по звучанию
# (средняя высота голоса около 185 и 145 Гц); Александр чуть быстрее.
VOICES = {
    'female': {'name': 'arina', 'rate': 0.05, 'pitch': 0.0},
    'male': {'name': 'aleksandr', 'rate': 0.12, 'pitch': 0.05},
}


def tours():
    script = "import('./src/tours.js').then((m) => console.log(JSON.stringify(m.tours.map((t) => ({ id: t.id, stops: t.stops.map((s) => s.say || `${s.title}. ${s.text}`) })))))"
    return json.loads(subprocess.check_output(['node', '-e', script], cwd=ROOT))


def data_dir(extra_voices):
    import rhvoice_wrapper_data
    base = rhvoice_wrapper_data.data_path
    target = tempfile.mkdtemp(prefix='rhvoice-')
    shutil.copytree(os.path.join(base, 'languages'), os.path.join(target, 'languages'))
    # Голоса из пакета (в том числе Александр) и скачанные дополнительно (Арина).
    shutil.copytree(os.path.join(base, 'voices'), os.path.join(target, 'voices'))
    for name in os.listdir(extra_voices):
        source = os.path.join(extra_voices, name)
        if os.path.isfile(os.path.join(source, 'voice.info')) and not os.path.exists(os.path.join(target, 'voices', name.replace('-rus', ''))):
            shutil.copytree(source, os.path.join(target, 'voices', name.replace('-rus', '')), ignore=shutil.ignore_patterns('.git'))
    return target


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    from rhvoice_wrapper import TTS
    from rhvoice_wrapper import rhvoice_bindings
    import rhvoice_wrapper_bin
    # Обёртка передаёт путь к библиотеке байтами, а ctypes в Python 3.13
    # принимает только строку.
    select = rhvoice_bindings._lib_selector
    rhvoice_bindings._lib_selector = lambda path: select(path).decode() if isinstance(select(path), bytes) else select(path)
    data = data_dir(sys.argv[1])
    tts = TTS(threads=1, data_path=data, lib_path=str(rhvoice_wrapper_bin.lib_path))
    try:
        for tour in tours():
            for voice_id, voice in VOICES.items():
                out_dir = os.path.join(ROOT, 'public', 'voice', 'tour', voice_id)
                os.makedirs(out_dir, exist_ok=True)
                for index, text in enumerate(tour['stops']):
                    wav = tts.get(text, voice=voice['name'], format_='wav', sets={'absolute_rate': voice['rate'], 'absolute_pitch': voice['pitch']})
                    target = os.path.join(out_dir, f"{tour['id']}-{index + 1}.mp3")
                    # Громкость к единому уровню, короткая тишина в начале, mp3 как у остальных записей.
                    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-af', 'adelay=120,loudnorm=I=-16:TP=-1.5,aresample=24000',
                                    '-ac', '1', '-b:a', '64k', target], input=wav, check=True)
                    print(target)
    finally:
        tts.join()
        shutil.rmtree(data, ignore_errors=True)


if __name__ == '__main__':
    main()
