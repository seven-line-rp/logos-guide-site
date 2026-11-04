#!/usr/bin/env python3
"""Музыка и звуки мультика про Mr.Брекина: у каждой серии и версии свой файл —
public/promo/cartoon/music.mp3 и music-clean.mp3 (серия 1 «Mr.Брекин спешит на
помощь», с матом и без), music-2.mp3 и music-2-clean.mp3 (серия 2 «Вайб-кодинг»).

Сочинено этим скриптом (синтез на numpy), прав не нужно. Инструменты берутся из
build-promo-music.py. Тайминги — из таймингов озвучки (cartoon-timeline.json и
cartoon-timeline-clean.json) и сценария, поэтому звуки попадают в те же моменты,
что и анимация (CartoonStage.jsx): весёлый «ум-па» в фа мажоре, на ошибке —
скрежет пластинки и грустная туба, «ПУФ!» с волшебным перезвоном, «ЩЁЛК!» кнопки,
погоня, школьный звонок и финал. Во второй серии: скрежет и гул на разносе,
удар «Два!», туба, «ПУФ!» и удар на реплике Mr.Брекина.

Запуск: python3 scripts/build-cartoon-music.py [--film cartoon|cartoon-clean|cartoon2|cartoon2-clean|all]
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


# Ролики мультика (как --film у build-promo-voice.py): сценарий, тайминги озвучки,
# куда класть музыку и какая серия — от неё зависят звуки.
FILMS = {
    'cartoon': ('cartoon-script.js', 'CARTOON_LINES', 'src/admin/cartoon-timeline.json', 'public/promo/cartoon/music.mp3', 1),
    'cartoon-clean': ('cartoon-script.js', 'CARTOON_LINES', 'src/admin/cartoon-timeline-clean.json', 'public/promo/cartoon/music-clean.mp3', 1),
    'cartoon2': ('cartoon2-script.js', 'CARTOON2_LINES', 'src/admin/cartoon2-timeline.json', 'public/promo/cartoon/music-2.mp3', 2),
    'cartoon2-clean': ('cartoon2-script.js', 'CARTOON2_LINES', 'src/admin/cartoon2-timeline-clean.json', 'public/promo/cartoon/music-2-clean.mp3', 2),
}


def scenes(film):
    """Начало каждой сцены — как в CartoonStage.jsx: первая фраза сцены минус lead и 0,3 с."""
    script_file, name, timeline_file, _, _ = FILMS[film]
    code = f"import('./src/admin/{script_file}').then((s) => console.log(JSON.stringify(s.{name})))"
    script = json.loads(subprocess.run(['node', '-e', code], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    timeline = json.loads((ROOT / timeline_file).read_text(encoding='utf-8'))
    lines = {line['id']: {**line, **next(item for item in script if item['id'] == line['id'])} for line in timeline['lines']}
    starts = {}
    for line in lines.values():
        starts.setdefault(line['scene'], max(0, line['start'] - .3 - line.get('lead', 0)))
    starts[script[0]['scene']] = 0
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


def theme(music, duration, minor=False):
    """Основная тема: бас «ум» на сильные доли, аккорд «па» на слабые, ксилофон сверху.
    minor — аккорды по кругу начинаются с ре минора (вторая серия, кабинет информатики)."""
    for bar in range(int(np.ceil(duration / BAR))):
        at = bar * BAR
        chord = CHORDS[(bar + (2 if minor else 0)) % 4]
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


def silence_between(music, a, b, fade=.3):
    """Музыка обрывается в момент a и плавно возвращается в момент b."""
    gate = np.ones(len(music))
    off, on = int(a * RATE), int(b * RATE)
    gate[off:on] = 0
    gate[on:on + int(fade * RATE)] = np.linspace(0, 1, len(gate[on:on + int(fade * RATE)]))
    music *= gate


def chime(fx, at, notes=(84, 88, 91, 96, 100)):
    for i, note in enumerate(notes):
        m.place(fx, xylo(note, .6), at + i * .07, .2)


def episode1(music, fx, lines, start):
    error_at = lines['fail']['start'] - .35
    press_at = lines['button']['start'] + 1.35
    run_from, run_to = start['run'], start['door']
    # Погоня: быстрые шестнадцатые и бочка на каждую долю.
    for step in range(int((run_to - run_from) / (BEAT / 4))):
        when = run_from + step * BEAT / 4
        m.place(music, xylo([65, 69, 72, 77][step % 4] + 12, .12), when, .12)
        if step % 4 == 0:
            m.place(music, m.kick(), when, .5)
    # На ошибке музыка обрывается и молчит до появления Mr.Брекина.
    silence_between(music, error_at, start['poof'] + .1)
    m.place(fx, scratch(), error_at - .05, .6)
    for i, note in enumerate([46, 45, 44]):  # «уа-уа-уааа»
        m.place(fx, tuba(note, .45 if i < 2 else 1.1), error_at + .5 + i * .5, .35)
    # «ПУФ!» и перезвон.
    m.place(fx, whoosh(), start['poof'] + .1, .5)
    chime(fx, start['poof'] + .35)
    # «ЩЁЛК!» кнопки и взлёт.
    m.place(fx, noise(.03, 9000) * 4, press_at, .5)
    for i, note in enumerate([72, 76, 79, 84]):
        m.place(fx, xylo(note), press_at + .08 + i * .08, .25)
    m.place(fx, bell(), start['door'] + .05, .22)


def episode2(music, fx, lines, start):
    """«Вайб-кодинг»: на разносе музыка обрывается, «Два» — удар печати,
    грустная туба, потом «ПУФ!» Mr.Брекина и удар на его реплике."""
    rant_at = start['rant']
    silence_between(music, rant_at, start['poof'] + .1)
    m.place(fx, scratch(), rant_at - .05, .6)
    # Низкий тревожный гул под крик информатика.
    n = int((start['poof'] - rant_at) * RATE)
    t = np.arange(n) / RATE
    drone = (np.sin(2 * np.pi * 55 * t) + .5 * np.sin(2 * np.pi * 58.3 * t)) * m.env(n, .4, .4)
    m.place(fx, drone, rant_at + .2, .18)
    stamp_at = lines['grade']['end'] - .25
    m.place(fx, m.kick(), stamp_at, 1.0)
    m.place(fx, noise(.08, 3000) * 3, stamp_at, .4)
    for i, note in enumerate([46, 45, 44]):
        m.place(fx, tuba(note, .45 if i < 2 else 1.1), lines['sad']['start'] - .1 + i * .45, .3)
    m.place(fx, whoosh(), start['poof'] + .1, .5)
    chime(fx, start['poof'] + .35)
    hit = lines['burst']['start']
    m.place(fx, m.kick(), hit, .9)
    for note in [50, 57, 62]:
        m.place(fx, m.pad(note, 1.2), hit, .16)


def build(film):
    duration, lines, start = scenes(film)
    episode = FILMS[film][4]
    n = int((duration + .2) * RATE)
    music, fx = np.zeros(n), np.zeros(n)
    theme(music, duration, minor=episode == 2)
    (episode1 if episode == 1 else episode2)(music, fx, lines, start)
    # Финал: аккорд и затухание.
    for note in [53, 57, 60, 65]:
        m.place(fx, m.pad(note, 3.0), start['end'], .2)

    mix = m.lowpass(music, 6000) + fx
    mix *= m.env(n, .05, 2.0)
    mix = np.tanh(mix * 1.1) / np.max(np.abs(np.tanh(mix * 1.1))) * .9
    stereo = np.stack([mix, np.roll(mix, int(.01 * RATE)) * .96], axis=1)
    target = ROOT / FILMS[film][3]
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
    print(f'{FILMS[film][3]}: {duration} с')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--film', choices=[*FILMS, 'all'], default='all', help='какой ролик: cartoon, cartoon-clean, cartoon2, cartoon2-clean или all')
    args = parser.parse_args()
    for film in FILMS if args.film == 'all' else [args.film]:
        build(film)


if __name__ == '__main__':
    main()
