#!/usr/bin/env python3
"""Музыка к ролику итогов Q3: синтез на numpy, прав и лицензий не требует.
Запуск: python3 docs/q3-report/music.py  ->  music.wav рядом со скриптом."""
import wave
from pathlib import Path
import numpy as np

RATE, DUR, BPM = 44100, 61.0, 100
BEAT = 60 / BPM
BAR = BEAT * 4
N = int(RATE * DUR)
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)
CHORDS = [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62]]  # Am F C G
SCENES = [5, 13, 21, 31, 38, 49, 55]
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

def add(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * RATE)
    if i >= N: return
    sig = sig[:N - i] * gain
    L[i:i + len(sig)] += sig * (1 - max(pan, 0)); R[i:i + len(sig)] += sig * (1 + min(pan, 0))

def tone(f, d, harm=(1, .4, .2), a=.01, r=.2):
    t = np.arange(int(d * RATE)) / RATE
    s = sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm))
    return s * np.minimum(1, t / a) * np.minimum(1, (d - t) / r)

bars = int(DUR / BAR) + 1
for b in range(bars):
    t0 = b * BAR; ch = CHORDS[b % 4]
    for i, m in enumerate(ch[1:]):  # пэд
        for det in (-.12, .12):
            add(tone(hz(m + det), BAR * 1.15, (1, .25, .1), a=.5, r=.9), t0, pan=det * 4 + (i - 1.5) * .15, gain=.045)
    if t0 >= 5:  # бас
        for k in (0, 1.5, 2.5):
            add(tone(hz(ch[0] - 12), BEAT * .9, (1, .5, .15), r=.15), t0 + k * BEAT, gain=.2)
    if 5 <= t0 < 55:  # перебор восьмыми
        seq = [1, 2, 3, 4, 3, 2, 3, 4] if t0 < 38 else [1, 3, 4, 3, 2, 4, 3, 4]
        for k, idx in enumerate(seq):
            n = tone(hz(ch[idx] + 12), .35, (1, .3, .1, .05), a=.004, r=.3)
            n *= np.exp(-np.arange(len(n)) / RATE * 9)
            add(n, t0 + k * BEAT / 2, pan=.5 if k % 2 else -.5, gain=.11)
    if 13 <= t0 < 55:  # бит
        for k in range(4):
            t = np.arange(int(.25 * RATE)) / RATE
            kick = np.sin(2 * np.pi * (45 * t + 60 * (1 - np.exp(-t * 30)) / 30)) * np.exp(-t * 14)
            if k in (0, 2) or (k == 3 and b % 2): add(kick, t0 + k * BEAT, gain=.5)
            if k in (1, 3):
                sn = rng.standard_normal(int(.12 * RATE)) * np.exp(-np.arange(int(.12 * RATE)) / RATE * 30)
                add(sn, t0 + k * BEAT, gain=.1)
        for k in range(8):
            hat = np.diff(rng.standard_normal(int(.04 * RATE) + 1)) * np.exp(-np.arange(int(.04 * RATE)) / RATE * 90)
            add(hat, t0 + k * BEAT / 2, pan=.3, gain=.035 if k % 2 else .02)
    if 21 <= t0 < 55 and b % 2 == 0:  # мелодия
        for k, idx in ((0, 4), (1.5, 3), (3, 2)):
            add(tone(hz(ch[idx] + 24), .9, (1, .15), a=.01, r=.7) * 1, t0 + k * BEAT, pan=-.2, gain=.05)

for s in SCENES:  # свист на склейках
    d = 1.0; n = int(d * RATE); t = np.arange(n) / RATE
    w = np.diff(rng.standard_normal(n + 1))
    w = np.convolve(w, np.ones(24) / 24, 'same') * np.sin(np.pi * t / d) ** 3
    add(w, s - .45, pan=-.6, gain=.5); add(w[::-1], s - .45, pan=.6, gain=.5)
    add(tone(hz(81), 1.2, (1, .3), a=.002, r=1.1) * np.exp(-np.arange(int(1.2 * RATE)) / RATE * 4), s + .05, gain=.07)

for i, m in enumerate((69, 72, 76, 81)):  # вступление
    add(tone(hz(m + 12), 1.4, (1, .2), a=.003, r=1.2) * np.exp(-np.arange(int(1.4 * RATE)) / RATE * 3), .7 + i * .22, pan=(i - 1.5) * .3, gain=.09)

mix = np.stack([L, R], 1)
t = np.arange(N) / RATE
mix *= (np.minimum(1, t / .6) * np.minimum(1, (DUR - t) / 3.5))[:, None]
mix = np.tanh(mix * 1.6) / np.max(np.abs(np.tanh(mix * 1.6))) * .89
with wave.open(str(Path(__file__).parent / 'music.wav'), 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(RATE)
    f.writeframes((mix * 32767).astype('<i2').tobytes())
