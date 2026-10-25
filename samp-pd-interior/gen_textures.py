#!/usr/bin/env python3
"""Процедурные текстуры (PNG, степени двойки — годятся для .txd).
Нужны Pillow + numpy (+ matplotlib только ради шрифта DejaVu). Результат: textures/*.png"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)

try:
    import matplotlib
    FD = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data/fonts/ttf")
except Exception:
    FD = ""


def font(size, bold=True):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    try:
        return ImageFont.truetype(os.path.join(FD, name), size)
    except Exception:
        return ImageFont.load_default()


def save(arr, name):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name + ".png"))


def blur(a, r):
    """Гауссово размытие 2D-массива."""
    lo, hi = a.min(), a.max()
    scale = 255 / (hi - lo + 1e-9)
    im = Image.fromarray(((a - lo) * scale).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im, dtype=float) / scale + lo


def noise(n, cell, amp):
    k = max(2, n // cell)
    small = rng.random((k, k))
    img = Image.fromarray((small * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
    return (np.asarray(img, dtype=float) / 255 - .5) * amp


def solid(n, col):
    return np.ones((n, n, 3)) * np.array(col, dtype=float)


def with_noise(base, amps=((16, 8), (64, 4), (2, 5))):
    n = base.shape[0]
    out = base.copy()
    for cell, a in amps:
        out += noise(n, cell, a)[..., None]
    return out


def wall_paint(name, col):
    save(with_noise(solid(256, col), ((32, 4), (4, 3))), name)


def tile_floor(name, c1, c2, grout, n=512):
    img = np.zeros((n, n, 3))
    h = n // 2
    for i in range(2):
        for j in range(2):
            img[i * h:(i + 1) * h, j * h:(j + 1) * h] = c1 if (i + j) % 2 == 0 else c2
    img = with_noise(img, ((64, 6), (8, 4), (2, 3)))
    for k in (0, h):
        img[k:k + 3, :] = grout
        img[:, k:k + 3] = grout
    save(img, name)


def carpet(name, col, n=256):
    save(with_noise(solid(n, col), ((2, 10), (4, 6), (32, 4))), name)


def concrete(name, col, n=256):
    img = with_noise(solid(n, col), ((8, 10), (32, 8), (2, 6)))
    for _ in range(40):
        x, y = rng.integers(0, n - 14, 2)
        img[y:y + 1, x:x + rng.integers(2, 12)] -= 14
    save(img, name)


def parquet(name, n=512):
    img = np.zeros((n, n, 3))
    ph = n // 8
    for i in range(8):
        shift = int(rng.integers(0, n // 2))
        for x0 in range(-n // 2, n, n // 2):
            xs, xe = max(0, x0 + shift), min(n, x0 + shift + n // 2)
            if xe > xs:
                img[i * ph:(i + 1) * ph, xs:xe] = np.array([112, 70, 38]) * rng.uniform(.8, 1.12)
                img[i * ph:(i + 1) * ph, xs:xs + 2] *= .55
        img[i * ph:i * ph + 2, :] *= .55
    grain = blur(noise(n, 2, 24), .7)
    img += grain[..., None] * np.array([1, .8, .6])
    save(img, name)


def wood(name, col, n=256):
    stripes = np.sin(np.linspace(0, 18 * math.pi, n))[:, None] * 7 + noise(n, 2, 14)
    stripes = blur(stripes, .8)
    save(solid(n, col) + stripes[..., None] * np.array([1, .75, .5]), name)


def brushed(name, col, n=256):
    streak = rng.normal(0, 1, (n, 1)) * 5 + rng.normal(0, 1, (n, n)) * 2
    save(solid(n, col) + blur(streak, .5)[..., None], name)


def granite(name, col, n=256):
    save(with_noise(solid(n, col), ((2, 18), (8, 10))), name)


def ceiling_tile(name, n=512):
    img = with_noise(solid(n, (232, 232, 226)), ((2, 6), (16, 3)))
    h = n // 2
    for k in (0, h):
        img[k:k + 5, :] = (170, 170, 168)
        img[:, k:k + 5] = (170, 170, 168)
    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)
    for _ in range(260):
        x, y = rng.integers(0, n, 2)
        d.point((int(x), int(y)), fill=(150, 150, 148))
    pil.save(os.path.join(OUT, name + ".png"))


def brick(name, n=256):
    img = np.zeros((n, n, 3)); rows = 8; bh = n // rows; bw = n // 4
    for r in range(rows):
        off = (bw // 2) if r % 2 else 0
        for c in range(-1, 5):
            x0 = c * bw + off
            a, b = max(0, x0), max(0, min(n, x0 + bw))
            if b > a:
                img[r * bh:(r + 1) * bh, a:b] = np.array([150, 82, 60]) * rng.uniform(.82, 1.12)
            if 0 <= x0 < n:
                img[r * bh:(r + 1) * bh, x0:x0 + 3] = (178, 172, 160)
        img[r * bh:r * bh + 3, :] = (178, 172, 160)
    save(with_noise(img, ((2, 6),)), name)


def panel_navy(name, n=256):
    img = solid(n, (28, 40, 70))
    for x in range(0, n, 64):
        img[:, x:x + 3] = (14, 20, 38)
        img[:, x + 3:x + 5] = (52, 70, 110)
    save(with_noise(img, ((16, 4), (2, 3))), name)


def cardboard(name, n=128):
    img = with_noise(solid(n, (170, 128, 82)), ((2, 8), (16, 6)))
    img[n // 2 - 3:n // 2 + 3, :] = (196, 168, 120)
    save(img, name)


def star(d, cx, cy, r, fill, points=5):
    pts = []
    for i in range(points * 2):
        rr = r if i % 2 == 0 else r * .45
        a = -math.pi / 2 + i * math.pi / points
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)


def screen_desktop(name, n=256):
    pil = Image.new("RGB", (n, n), (18, 52, 98))
    d = ImageDraw.Draw(pil)
    d.rectangle([0, n - 18, n, n], fill=(10, 24, 50))
    d.rectangle([20, 20, 150, 120], fill=(235, 238, 242))
    d.rectangle([20, 20, 150, 34], fill=(40, 90, 170))
    for y in range(44, 112, 10):
        d.line([30, y, 140, y], fill=(150, 160, 175), width=2)
    d.rectangle([110, 90, 230, 190], fill=(24, 30, 42))
    d.rectangle([110, 90, 230, 104], fill=(180, 40, 40))
    d.text((120, 130), "LSPD", font=font(24), fill=(120, 200, 255))
    pil.save(os.path.join(OUT, name + ".png"))


def screen_slide(name, n=512):
    pil = Image.new("RGB", (n, n), (14, 24, 52))
    d = ImageDraw.Draw(pil)
    d.rectangle([0, 0, n, 70], fill=(30, 70, 140))
    d.text((24, 14), "ROLL CALL - BRIEFING", font=font(34), fill=(255, 255, 255))
    for i, t in enumerate(["01  Patrol assignments", "02  Wanted suspects", "03  Vehicle status",
                           "04  Radio codes", "05  Training"]):
        d.text((40, 110 + i * 64), t, font=font(28, False), fill=(210, 225, 245))
    star(d, 410, 400, 70, (230, 190, 60))
    pil.save(os.path.join(OUT, name + ".png"))


def sign(name, text, size=(512, 128), bg=(22, 40, 84), fg=(240, 240, 240), with_star=True):
    pil = Image.new("RGB", size, bg)
    d = ImageDraw.Draw(pil)
    d.rectangle([4, 4, size[0] - 5, size[1] - 5], outline=(200, 170, 70), width=4)
    fs = size[1] // 2
    f = font(fs)
    while d.textlength(text, font=f) > size[0] - (150 if with_star else 40) and fs > 10:
        fs -= 2
        f = font(fs)
    off = 96 if with_star else 0
    if with_star:
        star(d, 60, size[1] // 2, size[1] * .36, (225, 185, 60))
    d.text(((size[0] + off) / 2, size[1] / 2), text, font=f, fill=fg, anchor="mm")
    pil.save(os.path.join(OUT, name + ".png"))


def big_logo(name):
    n = (1024, 256)
    pil = Image.new("RGB", n, (22, 40, 84))
    d = ImageDraw.Draw(pil)
    d.rectangle([8, 8, n[0] - 9, n[1] - 9], outline=(205, 172, 70), width=6)
    star(d, 140, 128, 96, (225, 185, 60))
    d.ellipse([112, 100, 168, 156], fill=(22, 40, 84))
    d.text((600, 100), "LOS SANTOS", font=font(76), fill=(245, 245, 245), anchor="mm")
    d.text((600, 182), "POLICE DEPARTMENT", font=font(66), fill=(225, 185, 60), anchor="mm")
    pil.save(os.path.join(OUT, name + ".png"))


def exit_sign(name):
    pil = Image.new("RGB", (256, 128), (10, 120, 50))
    ImageDraw.Draw(pil).text((128, 64), "EXIT", font=font(70), fill=(255, 255, 255), anchor="mm")
    pil.save(os.path.join(OUT, name + ".png"))


def wanted(name):
    pil = Image.new("RGB", (256, 384), (226, 210, 170))
    d = ImageDraw.Draw(pil)
    d.text((128, 40), "WANTED", font=font(58), fill=(120, 20, 20), anchor="mm")
    d.rectangle([48, 80, 208, 260], fill=(110, 110, 112))
    d.ellipse([98, 100, 158, 170], fill=(70, 70, 72))
    d.rectangle([78, 180, 178, 260], fill=(70, 70, 72))
    d.text((128, 300), "ARMED & DANGEROUS", font=font(22), fill=(60, 20, 20), anchor="mm")
    d.text((128, 340), "$ 50 000", font=font(34), fill=(120, 20, 20), anchor="mm")
    pil.save(os.path.join(OUT, name + ".png"))


def board(name):
    n = 256
    pil = Image.fromarray(np.clip(with_noise(solid(n, (150, 108, 60)), ((2, 10), (16, 6))), 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)
    for (x, y, w, h, c) in [(20, 24, 70, 90, (240, 240, 235)), (110, 18, 60, 80, (250, 240, 150)),
                            (186, 30, 54, 70, (235, 245, 250)), (30, 140, 90, 70, (250, 250, 250)),
                            (140, 130, 80, 100, (240, 215, 215))]:
        d.rectangle([x, y, x + w, y + h], fill=c)
        for k in range(y + 14, y + h - 4, 9):
            d.line([x + 6, k, x + w - 6, k], fill=(120, 120, 130), width=1)
        d.ellipse([x + w / 2 - 3, y + 2, x + w / 2 + 3, y + 8], fill=(200, 40, 40))
    pil.save(os.path.join(OUT, name + ".png"))


def mirror(name, n=256):
    g = np.linspace(0, 1, n)[None, :, None]
    img = np.ones((n, n, 3)) * np.array([70, 90, 105]) * (.7 + .5 * g)
    save(img + noise(n, 64, 10)[..., None], name)


def heightchart(name):
    pil = Image.new("RGB", (128, 512), (232, 232, 228))
    d = ImageDraw.Draw(pil)
    for i in range(0, 512, 16):
        d.line([0, i, 40 if i % 64 == 0 else 22, i], fill=(30, 30, 30), width=2)
        if i % 64 == 0:
            d.text((50, i + 8), str(220 - i // 16 * 10), font=font(16, False), fill=(30, 30, 30), anchor="lm")
    pil.save(os.path.join(OUT, name + ".png"))


def clock(name):
    pil = Image.new("RGB", (128, 128), (240, 240, 236))
    d = ImageDraw.Draw(pil)
    for i in range(12):
        a = i * math.pi / 6
        d.line([64 + 52 * math.sin(a), 64 - 52 * math.cos(a), 64 + 60 * math.sin(a), 64 - 60 * math.cos(a)],
               fill=(20, 20, 20), width=4)
    d.line([64, 64, 64 + 30 * math.sin(2.4), 64 - 30 * math.cos(2.4)], fill=(20, 20, 20), width=5)
    d.line([64, 64, 64 + 46 * math.sin(.6), 64 - 46 * math.cos(.6)], fill=(20, 20, 20), width=3)
    pil.save(os.path.join(OUT, name + ".png"))


def flag_us(name):
    pil = Image.new("RGB", (256, 128), (255, 255, 255))
    d = ImageDraw.Draw(pil)
    for i in range(0, 13, 2):
        d.rectangle([0, i * 128 / 13, 256, (i + 1) * 128 / 13], fill=(178, 34, 52))
    d.rectangle([0, 0, 108, 69], fill=(60, 59, 110))
    for r in range(5):
        for c in range(6):
            d.ellipse([8 + c * 17, 6 + r * 12, 12 + c * 17, 10 + r * 12], fill=(255, 255, 255))
    pil.save(os.path.join(OUT, name + ".png"))


def flag_state(name):
    pil = Image.new("RGB", (256, 128), (20, 50, 110))
    d = ImageDraw.Draw(pil)
    star(d, 128, 60, 44, (230, 190, 60))
    d.text((128, 112), "SAN ANDREAS", font=font(16), fill=(240, 240, 240), anchor="mm")
    pil.save(os.path.join(OUT, name + ".png"))


def cityscape(name):
    pil = Image.new("RGB", (512, 256))
    d = ImageDraw.Draw(pil)
    for y in range(256):
        t = y / 255
        d.line([0, y, 512, y], fill=(int(120 + 100 * t), int(175 + 60 * t), int(235 - 10 * t)))
    x = 0
    while x < 512:
        w = int(rng.integers(20, 50)); h = int(rng.integers(50, 170)); c = int(rng.integers(70, 120))
        d.rectangle([x, 256 - h, x + w, 256], fill=(c, c + 8, c + 22))
        x += w + int(rng.integers(0, 6))
    pil.save(os.path.join(OUT, name + ".png"))


if __name__ == "__main__":
    wall_paint("wall_paint", (228, 226, 216))
    wall_paint("wall_blue", (34, 56, 104))
    wall_paint("wall_grey", (178, 182, 186))
    panel_navy("panel_navy")
    tile_floor("floor_tile", (196, 196, 190), (166, 168, 166), (110, 110, 108))
    tile_floor("floor_vinyl", (70, 72, 76), (58, 60, 64), (30, 30, 32))
    carpet("carpet_blue", (30, 48, 92))
    carpet("carpet_grey", (92, 94, 100))
    concrete("concrete", (150, 150, 146))
    parquet("parquet")
    wood("wood_light", (176, 124, 72))
    wood("wood_dark", (84, 50, 28))
    brushed("metal", (172, 176, 182))
    brushed("metal_dark", (56, 60, 66))
    granite("granite", (44, 46, 50))
    ceiling_tile("ceiling_tile")
    brick("brick")
    cardboard("cardboard")
    screen_desktop("screen_desktop")
    screen_slide("screen_slide")
    big_logo("sign_logo")
    for key, text in [("lobby", "LOBBY / RECEPTION"), ("briefing", "BRIEFING ROOM"),
                      ("chief", "CHIEF OF POLICE"), ("interrogation", "INTERROGATION"),
                      ("evidence", "EVIDENCE"), ("armory", "ARMORY"), ("locker", "LOCKER ROOM"),
                      ("cells", "HOLDING CELLS")]:
        sign("sign_" + key, text)
    sign("sign_restricted", "AUTHORIZED PERSONNEL ONLY", bg=(150, 28, 28), with_star=False)
    exit_sign("sign_exit")
    wanted("poster_wanted")
    board("noticeboard")
    mirror("mirror")
    heightchart("heightchart")
    clock("clock")
    flag_us("flag_us")
    flag_state("flag_state")
    cityscape("cityscape")
    import gen_textures2
    gen_textures2.run()
    print("textures:", len(os.listdir(OUT)))
