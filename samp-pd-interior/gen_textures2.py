#!/usr/bin/env python3
"""Дополнительные текстуры v2 (реалистичнее: загрязнение, швы, RGBA-карточки растений, печать на полу).
Вызывается из gen_textures.py. PNG, степени двойки там, где это важно для .txd."""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import gen_textures as g

OUT, rng, font, star = g.OUT, g.rng, g.font, g.star


def rgba(name, img):
    img.save(os.path.join(OUT, name + ".png"))


def grime(arr, amount=10):
    n = arr.shape[0]
    arr = arr + g.blur(g.noise(n, 24, amount * 2), 3)[..., None]
    arr = arr + g.noise(n, 3, amount)[..., None]
    return arr


def wall_cream(name="wall_cream", n=512):
    base = g.solid(n, (216, 206, 182))
    base = grime(base, 8)
    for y in range(0, n, 32):                       # еле заметные швы кладки/плитки
        base[y:y + 1, :] *= .93
    for x in range(0, n, 128):
        base[:, x:x + 1] *= .96
    # потёки сверху
    for _ in range(14):
        x = int(rng.integers(0, n)); w = int(rng.integers(2, 6)); l = int(rng.integers(40, 200))
        base[:l, x:x + w] *= .96
    g.save(base, name)


def tile_beige(name="tile_beige", n=512):
    img = np.zeros((n, n, 3))
    h = n // 2
    for i in range(2):
        for j in range(2):
            c = np.array([208, 198, 172]) * rng.uniform(.93, 1.04)
            img[i * h:(i + 1) * h, j * h:(j + 1) * h] = c
    img = grime(img, 10)
    # шов + грязь в швах
    for k in (0, h):
        img[k:k + 4, :] = (128, 118, 98)
        img[:, k:k + 4] = (128, 118, 98)
    # потёртости
    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil, "RGBA")
    for _ in range(40):
        x, y = rng.integers(0, n, 2)
        d.line([x, y, x + int(rng.integers(-40, 40)), y + int(rng.integers(-10, 10))], fill=(110, 100, 80, 40), width=2)
    pil.save(os.path.join(OUT, name + ".png"))


def tile_grey(name="tile_grey", n=512):
    img = np.zeros((n, n, 3)); h = n // 2
    for i in range(2):
        for j in range(2):
            img[i * h:(i + 1) * h, j * h:(j + 1) * h] = np.array([104, 108, 112]) * rng.uniform(.9, 1.06)
    img = grime(img, 9)
    for k in (0, h):
        img[k:k + 4, :] = (50, 52, 54)
        img[:, k:k + 4] = (50, 52, 54)
    g.save(img, name)


def wallpaper_navy(name="wainscot", n=256):
    img = g.solid(n, (30, 44, 78))
    for x in range(0, n, 64):
        img[:, x:x + 2] = (16, 24, 44)
        img[:, x + 2:x + 4] = (54, 74, 120)
    for y in (0, 3):
        img[y:y + 3, :] = (16, 24, 44)
    g.save(grime(img, 5), name)


def rug_red(name="rug_red", n=256):
    pil = Image.new("RGB", (n, n), (88, 18, 24))
    d = ImageDraw.Draw(pil)
    d.rectangle([8, 8, n - 9, n - 9], outline=(200, 160, 70), width=5)
    d.rectangle([22, 22, n - 23, n - 23], outline=(50, 10, 14), width=3)
    for i in range(6):
        d.ellipse([n / 2 - 70 + i * 4, n / 2 - 70 + i * 4, n / 2 + 70 - i * 4, n / 2 + 70 - i * 4],
                  outline=(150 + i * 8, 100, 50), width=2)
    arr = np.asarray(pil, dtype=float) + g.noise(n, 2, 14)[..., None]
    g.save(arr, name)


def mat_navy(name="mat_lspd", n=256):
    pil = Image.new("RGB", (n, n // 2), (24, 28, 40))
    d = ImageDraw.Draw(pil)
    d.rectangle([4, 4, n - 5, n // 2 - 5], outline=(70, 80, 100), width=4)
    d.text((n / 2, n / 4), "POLICE", font=font(54), fill=(210, 214, 220), anchor="mm")
    arr = np.asarray(pil, dtype=float) + g.noise(n, 2, 12)[:n // 2, :, None]
    g.save(arr, name)


def keyboard_tex(name="keyboard", n=128):
    pil = Image.new("RGB", (n * 2, n), (28, 28, 30))
    d = ImageDraw.Draw(pil)
    for r in range(5):
        for c in range(15):
            x0 = 6 + c * 16; y0 = 10 + r * 20
            d.rectangle([x0, y0, x0 + 13, y0 + 16], fill=(58, 58, 62))
    pil.save(os.path.join(OUT, name + ".png"))


def books_tex(name="books", w=256, h=64):
    pil = Image.new("RGB", (w, h), (20, 14, 10))
    d = ImageDraw.Draw(pil)
    x = 2
    cols = [(120, 30, 30), (30, 60, 110), (40, 90, 50), (190, 160, 90), (70, 50, 40), (200, 200, 190), (90, 40, 90)]
    while x < w - 4:
        bw = int(rng.integers(5, 12)); bh = int(rng.integers(40, 60))
        c = cols[int(rng.integers(0, len(cols)))]
        d.rectangle([x, h - bh, x + bw, h], fill=c)
        d.line([x + 1, h - bh + 6, x + bw - 1, h - bh + 6], fill=(220, 200, 120), width=1)
        x += bw + 1
        if rng.random() < .1:
            x += int(rng.integers(6, 14))
    pil.save(os.path.join(OUT, name + ".png"))


def locker_tex(name="locker_front", n=128):
    img = g.solid(n, (58, 84, 124))
    img = g.with_noise(img, ((2, 6), (16, 5)))
    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)
    d.rectangle([2, 2, n - 3, n - 3], outline=(30, 46, 72), width=3)
    for k in range(5):
        d.line([20, 14 + k * 5, n - 20, 14 + k * 5], fill=(24, 36, 58), width=2)
    for k in range(5):
        d.line([20, n - 36 + k * 5, n - 20, n - 36 + k * 5], fill=(24, 36, 58), width=2)
    d.rectangle([n - 30, n // 2 - 8, n - 24, n // 2 + 14], fill=(190, 194, 200))
    pil.save(os.path.join(OUT, name + ".png"))


def plant_card(name="plant_a", n=256):
    pil = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(pil)
    cx = n // 2
    for i in range(46):
        a = rng.uniform(-1.25, 1.25)
        L = rng.uniform(60, 125)
        base_y = n - 24 - rng.uniform(0, 70)
        ex, ey = cx + math.sin(a) * L, base_y - math.cos(a) * L
        g_ = int(rng.integers(70, 150))
        col = (int(g_ * .35), g_, int(g_ * .3), 255)
        # лист как удлинённый эллипс вдоль стебля
        mx, my = (cx + ex) / 2, (base_y + ey) / 2
        w = rng.uniform(9, 17)
        pts = []
        for t in np.linspace(0, 2 * math.pi, 14):
            lx, ly = math.cos(t) * L / 2, math.sin(t) * w
            ang = math.atan2(ey - base_y, ex - cx)
            pts.append((mx + lx * math.cos(ang) - ly * math.sin(ang), my + lx * math.sin(ang) + ly * math.cos(ang)))
        d.polygon(pts, fill=col)
        d.line([cx, base_y, ex, ey], fill=(int(g_ * .25), int(g_ * .7), int(g_ * .2), 255), width=1)
    d.rectangle([cx - 3, n - 40, cx + 3, n], fill=(70, 50, 30, 255))
    pil = pil.filter(ImageFilter.GaussianBlur(.5))
    rgba(name, pil)


def seal_floor(name="seal_floor", n=512):
    pil = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(pil)
    c = n // 2
    d.ellipse([4, 4, n - 5, n - 5], fill=(34, 62, 112, 255), outline=(205, 210, 220, 255), width=10)
    d.ellipse([70, 70, n - 71, n - 71], fill=(150, 175, 205, 255), outline=(205, 210, 220, 255), width=6)
    # силуэт города
    x = 110
    while x < n - 120:
        w_ = int(rng.integers(14, 30)); h_ = int(rng.integers(50, 150))
        d.rectangle([x, c + 70 - h_, x + w_, c + 70], fill=(44, 68, 108, 255))
        for wy in range(c + 70 - h_ + 6, c + 66, 12):
            d.rectangle([x + 4, wy, x + 6, wy + 4], fill=(230, 220, 150, 255))
        x += w_ + 3
    d.rectangle([100, c + 70, n - 100, c + 110], fill=(34, 62, 112, 255))
    # надпись по кругу
    text = "LOS SANTOS  *  POLICE DEPARTMENT  *  "
    f = font(34)
    R = c - 40
    step = 2 * math.pi / len(text)
    for i, ch in enumerate(text):
        ang = -math.pi / 2 + i * step
        glyph = Image.new("RGBA", (50, 50), (0, 0, 0, 0))
        ImageDraw.Draw(glyph).text((25, 25), ch, font=f, fill=(240, 240, 245, 255), anchor="mm")
        glyph = glyph.rotate(-math.degrees(ang) - 90, resample=Image.BICUBIC)
        pil.alpha_composite(glyph, (int(c + R * math.cos(ang) - 25), int(c + R * math.sin(ang) - 25)))
    rgba(name, pil)


def badge_wall(name="badge_wall", n=256):
    pil = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(pil)
    star(d, n / 2, n / 2, n * .46, (214, 176, 70, 255), 7)
    d.ellipse([n * .28, n * .28, n * .72, n * .72], fill=(30, 50, 100, 255), outline=(240, 220, 150, 255), width=5)
    star(d, n / 2, n / 2, n * .17, (225, 190, 80, 255))
    d.text((n / 2, n * .9), "LSPD", font=font(26), fill=(110, 80, 20, 255), anchor="mm")
    rgba(name, pil)


def sign_board(name, lines, size=(512, 256), title=None):
    pil = Image.new("RGB", size, (24, 40, 80))
    d = ImageDraw.Draw(pil)
    d.rectangle([5, 5, size[0] - 6, size[1] - 6], outline=(205, 205, 210), width=5)
    y = size[1] * (.16 if title else .5 - .1 * (len(lines) - 1))
    if title:
        d.text((size[0] / 2, y), title, font=font(30), fill=(235, 190, 70), anchor="mm")
        y += 52
    f = font(40 if len(lines) <= 2 else 34)
    for ln in lines:
        d.text((size[0] / 2, y), ln, font=f, fill=(240, 240, 245), anchor="mm")
        y += 52 if len(lines) <= 2 else 46
    pil.save(os.path.join(OUT, name + ".png"))


def art(name, kind, size=(256, 192)):
    pil = Image.new("RGB", size, (30, 40, 60))
    d = ImageDraw.Draw(pil)
    w, h = size
    if kind == "city":
        for y in range(h):
            t = y / h
            d.line([0, y, w, y], fill=(int(20 + 120 * t), int(30 + 70 * t), int(70 + 40 * t)))
        x = 0
        while x < w:
            bw = int(rng.integers(14, 30)); bh = int(rng.integers(40, 120))
            d.rectangle([x, h - bh, x + bw, h], fill=(18, 22, 36))
            for wy in range(h - bh + 5, h - 4, 9):
                for wx in range(x + 3, x + bw - 3, 6):
                    if rng.random() < .5:
                        d.rectangle([wx, wy, wx + 2, wy + 4], fill=(240, 210, 120))
            x += bw + 2
    elif kind == "cert":
        d.rectangle([0, 0, w, h], fill=(238, 232, 214))
        d.rectangle([8, 8, w - 9, h - 9], outline=(160, 120, 40), width=4)
        d.text((w / 2, 34), "CERTIFICATE", font=font(26), fill=(60, 40, 20), anchor="mm")
        for k in range(5):
            d.line([30, 70 + k * 20, w - 30, 70 + k * 20], fill=(120, 110, 100), width=2)
        star(d, w - 44, h - 40, 22, (190, 150, 50))
    elif kind == "portrait":
        d.rectangle([0, 0, w, h], fill=(90, 96, 110))
        d.ellipse([w / 2 - 34, 30, w / 2 + 34, 100], fill=(190, 150, 120))
        d.rectangle([w / 2 - 60, 100, w / 2 + 60, h], fill=(26, 40, 80))
        d.rectangle([w / 2 - 6, 100, w / 2 + 6, 140], fill=(240, 240, 240))
        d.polygon([(w / 2 - 34, 30), (w / 2 + 34, 30), (w / 2 + 34, 18), (w / 2 - 34, 18)], fill=(20, 28, 54))
    elif kind == "map":
        d.rectangle([0, 0, w, h], fill=(210, 205, 185))
        for k in range(0, w, 24):
            d.line([k, 0, k, h], fill=(150, 150, 140), width=1)
        for k in range(0, h, 24):
            d.line([0, k, w, k], fill=(150, 150, 140), width=1)
        d.line([10, h - 30, w - 20, 40], fill=(200, 60, 40), width=4)
        d.polygon([(40, 40), (90, 30), (110, 80), (50, 90)], fill=(150, 190, 140))
    pil.save(os.path.join(OUT, name + ".png"))


def screens():
    n = 256
    pil = Image.new("RGB", (n, n), (14, 18, 24))
    d = ImageDraw.Draw(pil)
    for i in range(2):
        for j in range(2):
            x0, y0 = 6 + i * 124, 6 + j * 124
            d.rectangle([x0, y0, x0 + 118, y0 + 118], fill=(34 + 8 * j, 44 + 10 * i, 40))
            d.line([x0, y0 + 80, x0 + 118, y0 + 100], fill=(90, 100, 90), width=3)
            d.text((x0 + 6, y0 + 4), f"CAM {i * 2 + j + 1:02d}", font=font(14), fill=(220, 240, 220))
    pil.save(os.path.join(OUT, "screen_cctv.png"))
    pil = Image.new("RGB", (n, n), (16, 28, 44))
    d = ImageDraw.Draw(pil)
    for k in range(0, n, 20):
        d.line([k, 0, k, n], fill=(30, 52, 78), width=1)
        d.line([0, k, n, k], fill=(30, 52, 78), width=1)
    d.line([20, 220, 100, 140, 160, 170, 240, 60], fill=(240, 200, 60), width=3)
    for (x, y) in [(60, 80), (140, 100), (200, 190), (90, 200)]:
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(220, 50, 50))
    pil.save(os.path.join(OUT, "screen_map.png"))


def whiteboard_tex(name="whiteboard", n=256):
    pil = Image.new("RGB", (n * 2, n), (236, 238, 240))
    d = ImageDraw.Draw(pil)
    d.text((30, 20), "TODAY'S BRIEFING", font=font(30), fill=(30, 60, 150))
    for k in range(7):
        d.line([30, 80 + k * 26, 200 + int(rng.integers(0, 260)), 80 + k * 26], fill=(40, 40, 50), width=3)
    d.line([30, 250, 130, 250], fill=(180, 30, 30), width=4)
    pil.save(os.path.join(OUT, name + ".png"))


def restroom_tile(name="tile_white", n=256):
    img = g.solid(n, (226, 230, 232))
    for k in range(0, n, 64):
        img[k:k + 2, :] = (160, 164, 168)
        img[:, k:k + 2] = (160, 164, 168)
    g.save(grime(img, 5), name)


def extra_signs():
    g.sign("sign_restroom", "RESTROOMS")
    g.sign("sign_holding", "HOLDING")
    g.sign("sign_observation", "OBSERVATION")
    sign_board("sign_protect", ["TO PROTECT", "AND TO SERVE"])
    sign_board("sign_values", ["COMMUNITY", "SAFETY", "PROFESSIONALISM", "RESPECT", "INTEGRITY"])


def run():
    wall_cream(); tile_beige(); tile_grey(); wallpaper_navy(); rug_red(); mat_navy()
    keyboard_tex(); books_tex(); locker_tex(); plant_card(); seal_floor(); badge_wall()
    art("art_city", "city"); art("art_cert", "cert"); art("art_portrait", "portrait", (192, 256))
    art("art_map", "map"); screens(); whiteboard_tex(); restroom_tile(); extra_signs()
