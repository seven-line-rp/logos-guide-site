#!/usr/bin/env python3
"""PBR-текстуры v3: альбедо + карта нормалей (_n) + шероховатость (_r), 1024/512 px, бесшовные.
Процедурные (fBm по спектру, ячеистые структуры, износ, швы), JPEG для компактности.
Если положить рядом настоящие CC0-сканы с теми же именами (name.jpg / name_n.jpg / name_r.jpg) — они заменят эти."""
import os
import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(2024)
N = 1024


# ───────────── утилиты ─────────────
def fbm(n=N, beta=2.0, aniso=(1.0, 1.0)):
    """Бесшовный шум со спектром 1/f^beta; aniso растягивает структуры (x, y)."""
    fx = np.fft.fftfreq(n)[None, :] * aniso[0]
    fy = np.fft.fftfreq(n)[:, None] * aniso[1]
    f = np.sqrt(fx ** 2 + fy ** 2)
    f[0, 0] = 1
    spec = (rng.normal(size=(n, n)) + 1j * rng.normal(size=(n, n))) / f ** (beta / 2)
    spec[0, 0] = 0
    img = np.fft.ifft2(spec).real
    return (img - img.mean()) / (img.std() + 1e-9)


def smooth(a, lo, hi):
    t = np.clip((a - lo) / (hi - lo + 1e-9), 0, 1)
    return t * t * (3 - 2 * t)


def blur(a, r):
    lo, hi = a.min(), a.max()
    s = 255 / (hi - lo + 1e-9)
    im = Image.fromarray(((a - lo) * s).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im, dtype=float) / s + lo


def normal_map(h, strength=2.0):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * .5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * .5
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(h)
    ln = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    return np.stack([nx / ln, ny / ln, nz / ln], -1) * .5 + .5


def save_rgb(arr, name, size=None, q=90):
    a = np.clip(arr, 0, 1)
    im = Image.fromarray((a * 255 + .5).astype(np.uint8))
    if size and size != im.size[0]:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".jpg"), quality=q)


def save_set(name, albedo, height, rough, nstr=2.0, nsize=512, rsize=512):
    """albedo 0..1 RGB, height/rough 2D."""
    save_rgb(albedo, name, None, 90)
    save_rgb(normal_map(height, nstr), name + "_n", nsize, 92)
    r = np.clip(rough, 0, 1)
    save_rgb(np.stack([r, r, r], -1), name + "_r", rsize, 88)


def col(c):
    return np.array(c, dtype=float) / 255


def tonemix(base, a, b, t):
    """смесь двух цветов по маске t."""
    return a[None, None, :] * (1 - t[..., None]) + b[None, None, :] * t[..., None] if False else \
        (np.asarray(a) * (1 - t[..., None]) + np.asarray(b) * t[..., None])


# ───────────── штукатурка ─────────────
def plaster(name, base, stain=.05):
    c = col(base)
    h = fbm(N, 2.6) * .5 + fbm(N, 1.2) * .35                 # «шагрень»
    low = fbm(N, 3.2)
    alb = c[None, None, :] * (1 + low[..., None] * .045 + fbm(N, 1.5)[..., None] * .02)
    # потёки от верха
    streak = fbm(N, 2.0, (1, .06))
    alb *= (1 - smooth(streak, .7, 2.2)[..., None] * stain)
    save_set(name, alb, h, .86 + fbm(N, 2.5) * .03, nstr=1.2)


# ───────────── плитка ─────────────
def tiles(name, base, var, grout, tiles_n=2, vein=True, vein_col=(150, 140, 120), gloss=.28, small=False):
    n = N
    t = n // tiles_n
    ids = np.zeros((n, n), dtype=int)
    for i in range(tiles_n):
        for j in range(tiles_n):
            ids[i * t:(i + 1) * t, j * t:(j + 1) * t] = i * tiles_n + j
    tone = rng.uniform(1 - var, 1 + var, tiles_n * tiles_n)
    hue = rng.normal(0, .005, (tiles_n * tiles_n, 1)) * np.array([1.0, .8, .6])
    c = col(base)
    alb = c[None, None, :] * tone[ids][..., None] + hue[ids]
    if vein:
        f = fbm(n, 2.4)
        v = np.exp(-(f / .16) ** 2) * .5 + np.exp(-(fbm(n, 2.4) / .08) ** 2) * .4
        alb = alb * (1 - v[..., None] * .22) + col(vein_col)[None, None, :] * v[..., None] * .12
    alb *= 1 + fbm(n, 2.0)[..., None] * .025
    # швы
    yy, xx = np.mgrid[0:n, 0:n]
    dx = np.minimum(xx % t, t - 1 - xx % t)
    dy = np.minimum(yy % t, t - 1 - yy % t)
    d = np.minimum(dx, dy).astype(float)
    gw = 3 if not small else 2
    gmask = 1 - smooth(d, gw - 1, gw + 2)
    h = smooth(d, gw - 1, gw + 8)
    # сколы на углах/кромках
    chips = (fbm(n, 1.0) > 1.9) & (d < 14)
    h = h - chips * .25
    wear = smooth(fbm(n, 3.0), .2, 1.6)
    dirt = gmask * .5 + smooth(fbm(n, 2.4), 1.0, 2.3) * .08 + wear * .06
    alb = alb * (1 - dirt[..., None]) * (1 - gmask[..., None] * 0) \
        + col(grout)[None, None, :] * gmask[..., None] * .9 * (1 - 0)
    rough = gloss + (1 - h) * .5 + wear * .15 + fbm(n, 2.0) * .03
    save_set(name, alb, h * 1.0 + fbm(n, 2.0) * .015, rough, nstr=3.0)


# ───────────── ковёр ─────────────
def carpet(name, base):
    c = col(base)
    fine = fbm(N, .2)
    loops = blur(fine, 1.2)
    big = fbm(N, 2.6)
    alb = c[None, None, :] * (.78 + .22 * smooth(loops, -1, 1.5)[..., None]) * (1 + big[..., None] * .04)
    # проходы/потёртости
    alb *= 1 + fbm(N, 3.0)[..., None] * .05
    save_set(name, alb, loops + fbm(N, 1.0) * .2, .98 - big * .01, nstr=1.6)


# ───────────── дерево ─────────────
def wood_pattern(n, rings, aniso, contrast):
    """Мелкое прямое волокно + редкие годичные линии; возвращает t (0..1), grain, pores."""
    warp = blur(fbm(n, 3.4), 9)
    warp = warp / (warp.std() + 1e-9)
    yy = np.arange(n)[:, None] / n * np.ones((1, n))
    ring = np.sin(2 * np.pi * (yy * rings + warp * .10))
    fine = blur(fbm(n, 0.9, (aniso * .5, 1.0)), .6)
    fine = fine / (fine.std() + 1e-9)
    mid = blur(fbm(n, 1.6, (aniso, 1.0)), 1.0)
    mid = mid / (mid.std() + 1e-9)
    t = np.clip(.5 + ring * .18 + fine * .10 + mid * .10, 0, 1) * contrast
    return t, fine, mid


def wood(name, base_light, base_dark, rings=14, aniso=.02, gloss=.38):
    n = N
    t, fine, mid = wood_pattern(n, rings, aniso, 1.0)
    alb = col(base_light)[None, None, :] * (1 - t[..., None]) + col(base_dark)[None, None, :] * t[..., None]
    alb *= 1 + fbm(n, 2.0, (aniso * 2, 1.0))[..., None] * .03
    seams = np.zeros((n, n))
    pw = n // 4
    for k in range(4):
        seams[k * pw:k * pw + 3, :] = 1
    alb *= (1 - seams[..., None] * .45)
    h = fine * .35 + mid * .2 - seams * .8
    save_set(name, alb, h, gloss + fine * .03 + seams * .4, nstr=1.6)


def parquet(name):
    n = N
    planks = 8
    pw = n // planks
    alb = np.zeros((n, n, 3)); h = np.zeros((n, n))
    for p in range(planks):
        tone = rng.uniform(.84, 1.14)
        shift = int(rng.integers(0, n))
        t, fine, mid = wood_pattern(n, rng.integers(5, 9), .015, 1.0)
        c = col((168, 112, 66)) * tone
        d = col((112, 68, 34)) * tone
        a = c[None, None, :] * (1 - t[..., None]) + d[None, None, :] * t[..., None]
        a = np.roll(a[:pw], shift, axis=1)
        alb[p * pw:(p + 1) * pw] = a
        h[p * pw:(p + 1) * pw] = np.roll((fine * .3 + mid * .15)[:pw], shift, axis=1)
        seg = n // 2
        for s0 in (shift % seg, (shift % seg) + seg):
            h[p * pw:(p + 1) * pw, s0:s0 + 3] -= .9
            alb[p * pw:(p + 1) * pw, s0:s0 + 3] *= .4
        h[p * pw:p * pw + 3] -= .9
        alb[p * pw:p * pw + 3] *= .4
    alb *= 1 + fbm(n, 2.2)[..., None] * .03
    rough = .3 + (h < -.6) * .5 + fbm(n, 2.0) * .03
    save_set(name, alb, h, rough, nstr=1.8)


# ───────────── металл ─────────────
def brushed(name, base, rough=.38, streak=.06):
    n = N
    s = fbm(n, 1.0, (.01, 1.0)) * .6 + fbm(n, 1.4, (.03, 1.0)) * .4
    alb = col(base)[None, None, :] * (1 + s[..., None] * streak) * (1 + fbm(n, 3.0)[..., None] * .03)
    save_set(name, alb, s * .35, rough + s * .04, nstr=1.0)


# ───────────── бетон/гранит ─────────────
def concrete(name, base):
    n = N
    f = fbm(n, 2.2) * .5 + fbm(n, 1.0) * .3
    pits = (fbm(n, .3) > 2.1).astype(float)
    pits = blur(pits, 1.3)
    alb = col(base)[None, None, :] * (1 + f[..., None] * .07) * (1 - pits[..., None] * .35)
    alb *= 1 + smooth(fbm(n, 3.0), .5, 2.0)[..., None] * .06
    save_set(name, alb, f * .5 - pits * 1.5, .86 + fbm(n, 2) * .04, nstr=2.4)


def granite(name, base):
    n = N
    sp = fbm(n, .5)
    light = smooth(sp, 1.0, 2.2); mid = smooth(fbm(n, .6), 1.1, 2.3); dark = smooth(fbm(n, .6), 1.3, 2.4)
    alb = col(base)[None, None, :] * (1 + fbm(n, 2.5)[..., None] * .06)
    alb = alb * (1 - dark[..., None] * .5) + col((150, 145, 140))[None, None, :] * light[..., None] * .3 \
        + col((90, 60, 50))[None, None, :] * mid[..., None] * .25
    save_set(name, alb, fbm(n, 2.5) * .05 + sp * .02, .14 + light * .1 + fbm(n, 2) * .02, nstr=.6)


# ───────────── кирпич ─────────────
def brick(name):
    n = N
    rows, cols = 16, 8
    bh, bw = n // rows, n // cols
    alb = np.zeros((n, n, 3)); h = np.zeros((n, n))
    mortar = col((176, 168, 152))
    alb[:] = mortar
    for r in range(rows):
        off = bw // 2 if r % 2 else 0
        for c in range(-1, cols + 1):
            x0 = c * bw + off + 4
            x1 = x0 + bw - 8
            y0 = r * bh + 4
            y1 = y0 + bh - 8
            tone = rng.uniform(.8, 1.18)
            ct = col((152, 78, 56)) * tone * (1 + rng.normal(0, .03, 3))
            xa, xb = max(0, x0), min(n, x1)
            if xb > xa:
                alb[y0:y1, xa:xb] = ct
                h[y0:y1, xa:xb] = 1.0
    surf = fbm(n, 1.4)
    alb = alb * (1 + surf[..., None] * .06) * (1 + fbm(n, 3.0)[..., None] * .05)
    h = blur(h, 1.5) + surf * .06
    save_set(name, alb, h * 2.0, .92 + fbm(n, 2) * .03, nstr=3.5)


# ───────────── потолок ─────────────
def ceiling(name):
    n = N
    t = n // 2
    base = col((232, 230, 222))
    fis = fbm(n, 1.2)
    pin = (rng.random((n, n)) > .992).astype(float)
    pin = blur(pin, .9) * 5
    alb = base[None, None, :] * (1 + fis[..., None] * .03 - pin[..., None] * .5)
    alb *= 1 - smooth(fbm(n, 3.0), 1.4, 2.6)[..., None] * .12
    yy, xx = np.mgrid[0:n, 0:n]
    d = np.minimum(np.minimum(xx % t, t - 1 - xx % t), np.minimum(yy % t, t - 1 - yy % t)).astype(float)
    grid = 1 - smooth(d, 1, 6)
    alb = alb * (1 - grid[..., None] * .35)
    h = fis * .1 - pin * .8 - grid * .8
    save_set(name, alb, h, .95 + fbm(n, 2) * .02, nstr=2.0)


# ───────────── панели/кожа/ткань ─────────────
def navy_panel(name):
    n = N
    alb = col((30, 44, 80))[None, None, :] * (1 + fbm(n, 2.4)[..., None] * .04)
    h = np.zeros((n, n))
    pw = n // 8
    xx = np.arange(n)[None, :] * np.ones((n, 1))
    d = np.minimum(xx % pw, pw - 1 - xx % pw)
    groove = 1 - smooth(d, 2, 8)
    h -= groove * 1.0
    alb *= 1 - groove[..., None] * .45
    # нижняя плинтусная кромка/реечные пояса
    h += fbm(n, 1.0) * .02
    save_set(name, alb, h, .42 + groove * .3 + fbm(n, 2) * .02, nstr=3.0)


def leather(name, base):
    n = N
    cell = fbm(n, 0.3)
    crack = np.exp(-(fbm(n, .6) / .35) ** 2)
    h = blur(cell, 2.2) * .4 - crack * .4
    alb = col(base)[None, None, :] * (1 + fbm(n, 2.0)[..., None] * .05) * (1 - crack[..., None] * .2)
    save_set(name, alb, h, .42 + crack * .15 + fbm(n, 2.0) * .03, nstr=2.4)


def weave(name, base, pitch=16):
    n = N
    yy, xx = np.mgrid[0:n, 0:n]
    ph = 2 * np.pi / pitch
    h = (np.sin(xx * ph) * np.sin(yy * ph)) * .5 + np.sin(xx * ph * 2 + yy * ph) * .12
    fib = blur(fbm(n, .4), .8)
    alb = col(base)[None, None, :] * (.78 + .22 * smooth(h + fib * .3, -1, 1)[..., None]) * (1 + fbm(n, 2.4)[..., None] * .05)
    save_set(name, alb, h + fib * .2, .95 + fbm(n, 2) * .02, nstr=1.8)


def vinyl(name):
    n = N
    alb = col((82, 84, 88))[None, None, :] * (1 + fbm(n, 2.4)[..., None] * .05)
    flecks = (rng.random((n, n)) > .985).astype(float)
    flecks = blur(flecks, 1.0) * 4
    alb = alb * (1 + flecks[..., None] * .35) * (1 + fbm(n, .8)[..., None] * .03)
    t = n // 2
    yy, xx = np.mgrid[0:n, 0:n]
    d = np.minimum(np.minimum(xx % t, t - 1 - xx % t), np.minimum(yy % t, t - 1 - yy % t)).astype(float)
    grout = 1 - smooth(d, 1, 4)
    alb *= 1 - grout[..., None] * .5
    save_set(name, alb, grout * -1.0 + fbm(n, 2) * .02, .5 + grout * .3 + fbm(n, 2.4) * .06, nstr=2.4)


def leaf_blade(name):
    n = 256
    yy, xx = np.mgrid[0:n, 0:n]
    u = xx / n; v = yy / n
    d = np.abs(u - .5) * 2
    base = col((30, 92, 38))[None, None, :] * np.ones((n, n, 1))
    tip = col((70, 128, 52))[None, None, :]
    alb = base * (1 - v[..., None] * .3) + tip * (v[..., None] * .3)
    vein = np.exp(-(d / .035) ** 2)
    lat = np.exp(-(((u * 0 + (np.abs(u - .5) * 6 - v * 4)) % 1 - .5) / .06) ** 2) * .25
    alb = alb * (1 + (fbm(n, 2.0)[..., None]) * .06)
    alb = alb * (1 - vein[..., None] * .0) + col((150, 178, 90))[None, None, :] * vein[..., None] * .55
    alb = alb * (1 - lat[..., None] * .15)
    h = vein * .5 - lat * .2
    save_set(name, alb, h, .5 + fbm(n, 2.0) * .04, nstr=1.2, nsize=256, rsize=256)


def run():
    leaf_blade("leaf_blade")
    plaster("wall_cream", (214, 205, 184))
    plaster("wall_paint", (226, 224, 216), .03)
    plaster("wall_grey", (176, 180, 184), .03)
    plaster("wall_blue", (36, 58, 108), .02)
    tiles("tile_beige", (214, 202, 176), .05, (120, 110, 92), 2, True, (158, 140, 108), .26)
    tiles("tile_grey", (112, 116, 120), .06, (52, 54, 56), 2, True, (160, 164, 168), .3)
    tiles("tile_white", (228, 232, 234), .02, (150, 154, 156), 4, False, (200, 200, 200), .18, small=True)
    tiles("floor_tile", (200, 198, 190), .05, (110, 108, 100), 2, True, (150, 148, 140), .3)
    carpet("carpet_grey", (96, 98, 104))
    carpet("carpet_blue", (32, 48, 92))
    parquet("parquet")
    wood("wood_light", (190, 138, 84), (128, 82, 44), 12, .02, .4)
    wood("wood_dark", (104, 62, 34), (58, 32, 16), 14, .02, .34)
    brushed("metal", (176, 180, 186), .4, .08)
    brushed("metal_dark", (62, 66, 72), .45, .1)
    concrete("concrete", (150, 150, 146))
    granite("granite", (46, 48, 52))
    brick("brick")
    ceiling("ceiling_tile")
    navy_panel("wainscot")
    navy_panel("panel_navy")
    leather("leather", (26, 26, 30))
    weave("fabric_blue", (36, 60, 118))
    weave("fabric_grey", (86, 88, 94), 14)
    vinyl("floor_vinyl")
    print("pbr textures:", len([f for f in os.listdir(OUT) if f.endswith('_n.jpg')]))


if __name__ == "__main__":
    run()
