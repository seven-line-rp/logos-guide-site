#!/usr/bin/env python3
"""Фоновая музыка промо-ролика: public/promo/music.mp3.

Музыка сочинена этим скриптом (синтез на numpy), поэтому никаких прав и лицензий
на неё не нужно. Длина берётся из src/admin/promo-timeline.json.
Темп 104, аккорды C – G – Am – F: мягкий пэд, перебор, бас, лёгкий бит.
Первые два такта — только пэд (под вопрос «Куда идти?»), к концу музыка затихает.

Запуск: python3 scripts/build-promo-music.py  (нужны numpy и ffmpeg)
"""
import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RATE = 44100
BPM = 104
BEAT = 60 / BPM
BAR = BEAT * 4
rng = np.random.default_rng(1612)

# Аккорды по тактам (MIDI-номера нот).
CHORDS = [[48, 52, 55, 60], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]  # C G Am F
ARP = [0, 2, 3, 1, 2, 3, 1, 3]  # какие ноты аккорда играет перебор (восьмыми)


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def env(n, attack, release):
    a = max(1, int(attack * RATE))
    r = max(1, int(release * RATE))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def lowpass(x, cutoff):
    # Однополюсный фильтр: мягче и теплее звук.
    alpha = 1 - np.exp(-2 * np.pi * cutoff / RATE)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def pad(note, seconds):
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    f = hz(note + 12)
    wave_ = sum(np.sin(2 * np.pi * f * d * t) * w for d, w in [(1, 1), (1.003, .6), (0.997, .6), (2, .18), (3, .06)])
    return wave_ * env(n, .6, .8)


def pluck(note, seconds=.5):
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    f = hz(note + 24)
    tone = np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t) + .12 * np.sin(2 * np.pi * 3 * f * t)
    return tone * np.exp(-t * 7.5) * env(n, .004, .05)


def bass(note, seconds):
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    tone = np.tanh(1.6 * np.sin(2 * np.pi * hz(note - 12) * t))
    return tone * np.exp(-t * 1.6) * env(n, .01, .08)


def kick():
    n = int(.35 * RATE)
    t = np.arange(n) / RATE
    freq = 48 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(freq) / RATE) * np.exp(-t * 9)


def hat():
    n = int(.06 * RATE)
    noise = rng.standard_normal(n)
    noise = noise - lowpass(noise, 6000)  # оставляем только верх
    return noise * np.exp(-np.arange(n) / RATE * 70)


def place(track, clip, at, gain):
    start = int(at * RATE)
    end = min(len(track), start + len(clip))
    if start < end:
        track[start:end] += clip[: end - start] * gain


def main():
    duration = json.loads((ROOT / 'src' / 'admin' / 'promo-timeline.json').read_text(encoding='utf-8'))['duration']
    n = int((duration + .2) * RATE)
    pads, plucks, low, drums = (np.zeros(n) for _ in range(4))
    bars = int(np.ceil(duration / BAR))
    for bar in range(bars):
        at = bar * BAR
        chord = CHORDS[bar % 4]
        for note in chord:
            place(pads, pad(note, BAR + .6), at, .16)
        if bar >= 1:
            for step, index in enumerate(ARP):
                place(plucks, pluck(chord[index]), at + step * BEAT / 2, .2 if step % 2 == 0 else .14)
        if bar >= 2:
            place(low, bass(chord[0], BEAT * 1.8), at, .32)
            place(low, bass(chord[0], BEAT * 1.8), at + BEAT * 2, .26)
            for beat in (0, 2):
                place(drums, kick(), at + beat * BEAT, .55)
        if bar >= 4:
            for beat in range(4):
                place(drums, hat(), at + beat * BEAT + BEAT / 2, .1)
    # Пэд чуть «приседает» под бочку, чтобы бит качал, а не гудел.
    duck = np.ones(n)
    for bar in range(2, bars):
        for beat in (0, 2):
            start = int((bar * BAR + beat * BEAT) * RATE)
            if start >= n:
                continue
            length = int(.25 * RATE)
            end = min(n, start + length)
            duck[start:end] = np.minimum(duck[start:end], 1 - .35 * np.linspace(1, 0, end - start))
    mix = lowpass(pads, 2200) * duck + lowpass(plucks, 5200) + lowpass(low, 900) + drums
    # Плавное начало и затухание к концу ролика.
    fade = env(n, .8, 3.0)
    mix = mix * fade
    mix = np.tanh(mix * 1.1) / np.max(np.abs(np.tanh(mix * 1.1))) * .9
    stereo = np.stack([mix, np.roll(mix, int(.012 * RATE)) * .96], axis=1)  # чуть шире стерео

    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / 'music.wav'
        with wave.open(str(raw), 'wb') as out:
            out.setnchannels(2)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes((stereo * 32767).astype('<i2').tobytes())
        target = ROOT / 'public' / 'promo' / 'music.mp3'
        # Музыка тише голоса: -21 LUFS против -16 у голоса.
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-af', 'loudnorm=I=-21:TP=-2:LRA=9',
                        '-ar', '44100', '-b:a', '128k', str(target)], check=True)
    print(f'music.mp3: {duration} с, {bars} тактов')


if __name__ == '__main__':
    main()
