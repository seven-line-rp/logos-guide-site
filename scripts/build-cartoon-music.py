#!/usr/bin/env python3
"""Музыка и звуки мультика «Mr.Брекин спешит на помощь»: public/promo/cartoon/music.mp3
(с матом) и music-clean.mp3 (без мата).

Сочинено этим скриптом (синтез на numpy), прав не нужно. Инструменты берутся из
build-promo-music.py. Тайминги — из таймингов озвучки (cartoon-timeline.json и
cartoon-timeline-clean.json) и сценария, поэтому звуки попадают в те же моменты,
что и анимация (CartoonStage.jsx): весёлый «ум-па» в фа мажоре, на ошибке —
скрежет пластинки и грустная туба, «ПУФ!» с волшебным перезвоном, «ЩЁЛК!» кнопки,
погоня, школьный звонок и финал.

Запуск: python3 scripts/build-cartoon-music.py [--version adult|clean|all]
       (нужны numpy, ffmpeg и node)
"""
import argparse
import importlib.util
import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('promo_music', ROOT / 'scripts' / 'build-promo-music.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
RATE = m.RATE
BEAT = 60 / 120
BAR = BEAT * 4
rng = np.random.default_rng(2611)

# F – C – Dm – Bb, по такту; мелодия — восьмыми (None — пауза).
CHORDS = [[41, 57, 60, 65], [36, 55, 60, 64], [38, 57, 62, 65], [34, 58, 62, 65]]
MELODY = [77, None, 79, 81, None, 79, 77, 76, 72, None, 74, 76, 77, None, 74, None]


# Версии мультика: тайминги озвучки и куда класть музыку (см. build-promo-voice.py).
VERSIONS = {
    'adult': ('src/admin/cartoon-timeline.json', 'public/promo/cartoon/music.mp3'),
    'clean': ('src/admin/cartoon-timeline-clean.json', 'public/promo/cartoon/music-clean.mp3'),
}


def scenes(version):
    """Начало каждой сцены — как в CartoonStage.jsx: первая фраза сцены минус lead и 0,3 с."""
    code = "import('./src/admin/cartoon-script.js').then((s) => console.log(JSON.stringify(s.CARTOON_LINES)))"
    script = json.loads(subprocess.run(['node', '-e', code], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    timeline = json.loads((ROOT / VERSIONS[version][0]).read_text(encoding='utf-8'))
    lines = {line['id']: {**line, **next(item for item in script if item['id'] == line['id'])} for line in timeline['lines']}
    starts = {}
    for line in lines.values():
        starts.setdefault(line['scene'], max(0, line['start'] - .3 - line.get('lead', 0)))
    starts['hall'] = 0
    return timeline['duration'], lines, starts


def xylo(note, seconds=.35):
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    f = m.hz(note)
    return (np.sin(2 * np.pi * f * t) + .25 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 30)) * np.exp(-t * 11) * m.env(n, .002, .03)


def tuba(note, seconds):
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    wobble = 1 + .012 * np.sin(2 * np.pi * 5.5 * t)
    phase = 2 * np.pi * np.cumsum(m.hz(note) * wobble) / RATE
    return np.tanh(2.2 * np.sin(phase)) * m.env(n, .03, .12)


def noise(seconds, cutoff):
    n = int(seconds * RATE)
    return m.lowpass(rng.standard_normal(n), cutoff)


def scratch():
    """Скрежет пластинки: шум, который тянется вверх и обрывается."""
    n = int(.45 * RATE)
    t = np.arange(n) / RATE
    tone = np.sin(2 * np.pi * np.cumsum(300 + 1500 * t / .45) / RATE)
    return (tone * .5 + rng.standard_normal(n) * .4) * np.exp(-t * 4) * m.env(n, .005, .05)


def whoosh():
    n = int(.7 * RATE)
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2
    return noise(.7, 2500) * shape * 3


def bell(seconds=1.2):
    """Школьный звонок: высокий тон с дребезгом."""
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    tone = np.sin(2 * np.pi * 1850 * t) + .5 * np.sin(2 * np.pi * 2610 * t)
    return tone * (.55 + .45 * np.sign(np.sin(2 * np.pi * 22 * t))) * m.env(n, .005, .25)


def build(version):
    duration, lines, start = scenes(version)
    n = int((duration + .2) * RATE)
    music, fx = np.zeros(n), np.zeros(n)
    error_at = lines['fail']['start'] - .35
    press_at = lines['button']['start'] + 1.35
    run_from, run_to = start['run'], start['door']

    # Основная тема: бас «ум» на сильные доли, аккорд «па» на слабые, ксилофон сверху.
    for bar in range(int(np.ceil(duration / BAR))):
        at = bar * BAR
        chord = CHORDS[bar % 4]
        for beat in range(4):
            when = at + beat * BEAT
            if beat % 2 == 0:
                m.place(music, m.bass(chord[0] + 12, BEAT * .8), when, .45)
            else:
                for note in chord[1:]:
                    m.place(music, m.pluck(note - 24, .25), when, .12)
        for step, note in enumerate(MELODY[(bar % 2) * 8:(bar % 2) * 8 + 8]):
            if note is not None and bar % 4 != 3:
                m.place(music, xylo(note), at + step * BEAT / 2, .22)
    # Погоня: быстрые шестнадцатые и бочка на каждую долю.
    for step in range(int((run_to - run_from) / (BEAT / 4))):
        when = run_from + step * BEAT / 4
        m.place(music, xylo([65, 69, 72, 77][step % 4] + 12, .12), when, .12)
        if step % 4 == 0:
            m.place(music, m.kick(), when, .5)
    # На ошибке музыка обрывается и молчит до появления Mr.Брекина.
    gate = np.ones(n)
    off, on = int(error_at * RATE), int((start['poof'] + .1) * RATE)
    gate[off:on] = 0
    gate[on:on + int(.3 * RATE)] = np.linspace(0, 1, int(.3 * RATE))
    music *= gate
    m.place(fx, scratch(), error_at - .05, .6)
    for i, note in enumerate([46, 45, 44]):  # «уа-уа-уааа»
        m.place(fx, tuba(note, .45 if i < 2 else 1.1), error_at + .5 + i * .5, .35)
    # «ПУФ!» и перезвон.
    m.place(fx, whoosh(), start['poof'] + .1, .5)
    for i, note in enumerate([84, 88, 91, 96, 100]):
        m.place(fx, xylo(note, .6), start['poof'] + .35 + i * .07, .2)
    # «ЩЁЛК!» кнопки и взлёт.
    m.place(fx, noise(.03, 9000) * 4, press_at, .5)
    for i, note in enumerate([72, 76, 79, 84]):
        m.place(fx, xylo(note), press_at + .08 + i * .08, .25)
    m.place(fx, bell(), start['door'] + .05, .22)
    # Финал: аккорд и затухание.
    for note in [53, 57, 60, 65]:
        m.place(fx, m.pad(note, 3.0), start['end'], .2)

    mix = m.lowpass(music, 6000) + fx
    mix *= m.env(n, .05, 2.0)
    mix = np.tanh(mix * 1.1) / np.max(np.abs(np.tanh(mix * 1.1))) * .9
    stereo = np.stack([mix, np.roll(mix, int(.01 * RATE)) * .96], axis=1)
    target = ROOT / VERSIONS[version][1]
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / 'music.wav'
        with wave.open(str(raw), 'wb') as out:
            out.setnchannels(2)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes((stereo * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-af', 'loudnorm=I=-20:TP=-2:LRA=11',
                        '-ar', '44100', '-b:a', '128k', str(target)], check=True)
    print(f'{VERSIONS[version][1]}: {duration} с')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', choices=[*VERSIONS, 'all'], default='all', help='какую версию озвучить музыкой')
    args = parser.parse_args()
    for version in VERSIONS if args.version == 'all' else [args.version]:
        build(version)


if __name__ == '__main__':
    main()
