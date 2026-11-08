#!/usr/bin/env python3
"""Render the 2:25 no-narration promo cut from actual captured site screens.

Needs Pillow, NumPy, imageio-ffmpeg and the generated music-longform.mp3.
    python3 scripts/build-promo-music.py --longform
    python3 scripts/render-promo-longform.py
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode

ROOT = Path(__file__).resolve().parent.parent
WIDTH, HEIGHT, FPS = 1280, 720, 24
TIMELINE = json.loads((ROOT / 'src/admin/promo-longform-timeline.json').read_text(encoding='utf-8'))
SHOTS = json.loads((ROOT / 'src/admin/promo-shots.json').read_text(encoding='utf-8'))
OUT = ROOT / 'public/promo'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def ease(x):
    x = max(0, min(1, x))
    return x * x * (3 - 2 * x)


def make_background():
    yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH]
    x = (xx - 850) / 900
    y = (yy - 300) / 720
    glow = np.exp(-(x * x + y * y) * 2.2)
    edge = np.clip(1 - ((xx - WIDTH / 2) ** 2 / WIDTH ** 2 + (yy - HEIGHT / 2) ** 2 / HEIGHT ** 2) * .6, .5, 1)
    base = np.stack([9 + 25 * glow, 14 + 38 * glow, 34 + 92 * glow], axis=-1) * edge[..., None]
    return Image.fromarray(np.uint8(np.clip(base, 0, 255)), 'RGB')


BACKGROUND = make_background()
SHOT_IMAGES = {name: Image.open(ROOT / 'public' / info['src'].lstrip('/')).convert('RGB') for name, info in SHOTS.items()}

def rounded_mask(size, radius):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def text_lines(draw, text, xy, max_width, face, fill, spacing=10, anchor=None, stroke_width=0, stroke_fill=None):
    x, y = xy
    for paragraph in text.split('\n'):
        words = paragraph.split()
        line = ''
        lines = []
        for word in words:
            trial = f'{line} {word}'.strip()
            if line and draw.textbbox((0, 0), trial, font=face)[2] > max_width:
                lines.append(line)
                line = word
            else:
                line = trial
        if line:
            lines.append(line)
        if not lines:
            lines = ['']
        for current in lines:
            draw.text((x, y), current, font=face, fill=fill, anchor=anchor, stroke_width=stroke_width, stroke_fill=stroke_fill)
            y += face.size + spacing
    return y


def paste_shadow(canvas, image, position, radius=22, blur=28, shadow=(0, 0, 0, 120)):
    x, y = position
    alpha = rounded_mask(image.size, radius)
    sh = Image.new('RGBA', image.size, shadow)
    sh.putalpha(alpha.point(lambda p: int(p * shadow[3] / 255)))
    shadow_layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow_layer.paste(sh, (x, y + 22), sh)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow_layer)
    card = Image.new('RGBA', image.size, (0, 0, 0, 0))
    card.paste(image.convert('RGBA'), (0, 0), alpha)
    canvas.alpha_composite(card, (x, y))


def draw_screen(canvas, shot_name, t, vertical=False, x=550, y=145, width=650):
    src = SHOT_IMAGES[shot_name]
    w, h = (282, 548) if vertical else (width, 405)
    if vertical:
        screen = src.resize((w - 20, h - 20), Image.Resampling.LANCZOS)
        shell = Image.new('RGB', (w, h), '#18243d')
        shell.paste(screen, (10, 10), rounded_mask(screen.size, 24))
        ImageDraw.Draw(shell).rounded_rectangle((10, 10, w - 10, h - 10), 24, outline=(220, 229, 250), width=2)
        # Speaker pill of the phone gives a recognisable device silhouette.
        ImageDraw.Draw(shell).rounded_rectangle((w // 2 - 29, 13, w // 2 + 29, 18), 3, fill='#172138')
    else:
        shell = Image.new('RGB', (w, h), '#f7f9fd')
        draw = ImageDraw.Draw(shell)
        draw.rounded_rectangle((0, 0, w - 1, h - 1), 18, fill='#f7f9fd', outline=(225, 232, 245), width=2)
        draw.rounded_rectangle((10, 10, w - 10, 38), 10, fill='#edf1f7')
        for i, color in enumerate(('#ff625a', '#ffc344', '#32c75a')):
            draw.ellipse((22 + i * 17, 21, 30 + i * 17, 29), fill=color)
        draw.text((84, 17), 'logos-guide.ru', font=font(12), fill='#66748d')
        screen = src.resize((w - 20, h - 52), Image.Resampling.LANCZOS)
        shell.paste(screen, (10, 44))
    # Slow camera drift and a tiny roll make the still UI feel like a physical insert.
    roll = math.sin(t * .34) * (1.0 if vertical else .65)
    shell = shell.rotate(roll, resample=Image.Resampling.BICUBIC, expand=False)
    p = ease(t / 1.2)
    px = int(x + (1 - p) * 75 + math.sin(t * .23) * 4)
    py = int(y + (1 - p) * 45 + math.sin(t * .4) * 3)
    paste_shadow(canvas, shell, (px, py), 34 if vertical else 20)
    # Fine edge highlight.
    edge = ImageDraw.Draw(canvas)
    edge.rounded_rectangle((px, py, px + w, py + h), 34 if vertical else 20, outline=(194, 209, 255, 100), width=2)


def draw_compass(canvas, t, center=(940, 360), radius=122):
    x, y = center
    layer = Image.new('RGBA', (radius * 2 + 44, radius * 2 + 44), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = cy = radius + 22
    d.ellipse((cx - radius - 8, cy - radius - 8, cx + radius + 8, cy + radius + 8), fill=(59, 92, 214, 28), outline=(163, 187, 255, 150), width=2)
    d.ellipse((cx - radius + 15, cy - radius + 15, cx + radius - 15, cy + radius - 15), fill=(44, 77, 194, 255), outline=(223, 231, 255, 235), width=3)
    angle = math.radians(t * 24)
    pts = []
    for r, a in ((radius * .68, -math.pi / 2), (radius * .2, 0), (radius * .68, math.pi / 2), (radius * .2, math.pi)):
        pts.append((cx + math.cos(a + angle) * r, cy + math.sin(a + angle) * r))
    d.polygon(pts, fill='#f6f8ff')
    d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill='#ffd267', outline='white', width=3)
    layer = layer.rotate(math.sin(t * .7) * 3, resample=Image.Resampling.BICUBIC)
    paste_shadow(canvas, layer, (int(x - layer.width / 2), int(y - layer.height / 2)), radius=radius + 20, blur=35, shadow=(28, 52, 150, 75))


def draw_particles(canvas, t, seed=0):
    d = ImageDraw.Draw(canvas, 'RGBA')
    for i in range(40):
        phase = t * (.09 + (i % 5) * .018) + i * 1.71 + seed
        x = int(650 + math.cos(phase) * (190 + (i % 8) * 28))
        y = int(365 + math.sin(phase * .78) * (110 + (i % 7) * 22))
        r = 2 + i % 3
        color = (255, 210, 103, 130) if i % 7 == 0 else (142, 171, 255, 105)
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)


def draw_header(canvas, chapter, index, t, progress):
    d = ImageDraw.Draw(canvas, 'RGBA')
    d.ellipse((47, 34, 58, 45), fill=(255, 210, 103, 255))
    d.text((70, 31), 'ЛОГОС ПУТЕВОДИТЕЛЬ', font=font(13, True), fill=(229, 236, 255, 220))
    d.text((1110, 32), f'{index + 1:02d} / 12    {int(t // 60):02d}:{int(t % 60):02d}', font=font(14, True), fill=(223, 231, 255, 195))
    d.rounded_rectangle((46, 681, 1234, 685), 2, fill=(255, 255, 255, 45))
    d.rounded_rectangle((46, 681, 46 + int(1188 * progress), 685), 2, fill=(255, 210, 103, 230))


def draw_title(canvas, chapter, local):
    d = ImageDraw.Draw(canvas, 'RGBA')
    p = ease(local / 1.05)
    x = int(98 - (1 - p) * 24)
    d.text((x, 188), 'ЛОГОС · ПУТЕВОДИТЕЛЬ', font=font(15, True), fill=(159, 183, 255, int(240 * p)))
    size = 51 if len(chapter['title']) < 27 else 45
    y = text_lines(d, chapter['title'], (x, 223), 450, font(size, True), (255, 255, 255, int(255 * p)), spacing=7)
    text_lines(d, chapter['copy'], (x, y + 12), 440, font(22), (207, 218, 244, int(246 * p)), spacing=8)


def draw_stat(canvas, local):
    d = ImageDraw.Draw(canvas, 'RGBA')
    p = ease(local / 1.2)
    d.text((112, 441), '2', font=font(58, True), fill=(255, 210, 103, int(255 * p)))
    d.text((172, 457), 'этажа', font=font(22, True), fill=(219, 228, 250, int(255 * p)))
    d.text((284, 441), '47', font=font(58, True), fill=(255, 210, 103, int(255 * p)))
    d.text((389, 457), 'помещений', font=font(22, True), fill=(219, 228, 250, int(255 * p)))


def draw_search(canvas, local):
    d = ImageDraw.Draw(canvas, 'RGBA')
    x, y = 98, 446
    d.rounded_rectangle((x, y, x + 415, y + 58), 15, fill=(255, 255, 255, 22), outline=(255, 255, 255, 54), width=1)
    d.text((x + 18, y + 8), '⌕', font=font(34, True), fill=(255, 210, 103, 255))
    d.text((x + 62, y + 19), 'кабинет · предмет · фамилия', font=font(14, True), fill=(234, 239, 255, 245))
    d.rounded_rectangle((x + 63, y + 53, x + 63 + int(335 * ease(local / 2)), y + 56), 2, fill=(255, 210, 103, 240))


def draw_route(canvas, local):
    d = ImageDraw.Draw(canvas, 'RGBA')
    x, y = 122, 439
    h = int(72 * ease(local / 8))
    d.rounded_rectangle((x, y, x + 5, y + h), 3, fill=(255, 210, 103, 220))
    d.text((x + 20, y + 20), 'Поворот за поворотом', font=font(18, True), fill=(242, 246, 255, 250))


def draw_floors(canvas):
    d = ImageDraw.Draw(canvas, 'RGBA')
    for i, (name, icon, y, color) in enumerate([('Лифт', '↑', 357, (255, 210, 103, 245)), ('Три лестницы', '↗', 429, (87, 117, 255, 245))]):
        d.rounded_rectangle((120, y, 169, y + 49), 14, fill=color)
        d.text((134, y + 4), icon, font=font(30, True), fill=(22, 35, 77, 255) if i == 0 else (255, 255, 255, 255))
        d.text((185, y + 9), name, font=font(22, True), fill=(246, 248, 255, 255))


def draw_ad(canvas, local):
    p = ease(local / 1.1)
    card = Image.new('RGBA', (640, 360), (0, 0, 0, 0))
    d = ImageDraw.Draw(card, 'RGBA')
    d.rounded_rectangle((0, 0, 639, 359), 24, fill=(53, 23, 90, 255), outline=(245, 226, 255, 220), width=2)
    # Radial rays are translucent and clipped to the small advert card.
    ray_layer = Image.new('RGBA', card.size, (0, 0, 0, 0))
    ray_draw = ImageDraw.Draw(ray_layer, 'RGBA')
    cx, cy = 320, 178
    for i in range(16):
        a = i * math.tau / 16 + local * .04
        x, y = cx + math.cos(a) * 460, cy + math.sin(a) * 460
        ray_draw.polygon([(cx, cy), (x, y), (cx + math.cos(a + .06) * 460, cy + math.sin(a + .06) * 460)], fill=(255, 61, 139, 30))
    card.alpha_composite(ray_layer)
    d = ImageDraw.Draw(card, 'RGBA')
    d.rounded_rectangle((23, 18, 142, 49), 8, fill=(255, 210, 103, 255))
    d.text((35, 24), 'РЕКЛАМА', font=font(15, True), fill=(35, 16, 52, 255))
    # Compact comic shield mascot in top-center; no voiceover is embedded.
    sx, sy = 320, 112 + int(math.sin(local * 4) * 3)
    d.polygon([(sx, sy - 52), (sx + 45, sy - 37), (sx + 38, sy + 14), (sx, sy + 45), (sx - 38, sy + 14), (sx - 45, sy - 37)], fill=(251, 252, 255, 255), outline=(17, 8, 32, 255))
    d.ellipse((sx - 20, sy - 23, sx - 11, sy - 14), fill=(28, 13, 38, 255))
    d.ellipse((sx + 7, sy - 27, sx + 25, sy - 9), outline=(231, 180, 0, 255), width=3)
    d.arc((sx - 17, sy - 2, sx + 17, sy + 19), 0, 180, fill=(31, 15, 39, 255), width=4)
    d.rounded_rectangle((sx - 13, sy + 16, sx + 13, sy + 34), 6, fill=(255, 61, 139, 255))
    d.text((320, 174), 'Mr.Брекин VPN', font=font(37, True), fill=(255, 255, 255, 255), anchor='mt', stroke_width=1, stroke_fill=(25, 8, 37, 255))
    d.text((320, 225), 'Обходит ваши пары стороной', font=font(20, True), fill=(233, 242, 255, 255), anchor='mt')
    d.text((320, 312), 'Шутка. Такого VPN не существует.', font=font(12), fill=(211, 197, 226, 255), anchor='mt')
    # Slight tilt and scale-in keep the commercial insert at exactly half-frame.
    card = card.rotate(math.sin(local * 1.3) * .8, resample=Image.Resampling.BICUBIC)
    card = card.resize((int(640 * (.9 + .1 * p)), int(360 * (.9 + .1 * p))), Image.Resampling.LANCZOS)
    paste_shadow(canvas, card, ((WIDTH - card.width) // 2, (HEIGHT - card.height) // 2 - 8), radius=23, blur=28, shadow=(0, 0, 0, 160))


def draw_outro(canvas, local):
    d = ImageDraw.Draw(canvas, 'RGBA')
    draw_compass(canvas, local, center=(640, 220), radius=72)
    p = ease(local / 1.4)
    d.text((640, 365), 'ЛОГОС Путеводитель', font=font(47, True), fill=(255, 255, 255, int(255 * p)), anchor='mt')
    d.text((640, 430), 'Карта. Маршрут. Ваш учебный день.', font=font(23), fill=(206, 218, 247, int(255 * p)), anchor='mt')
    d.text((640, 492), 'logos-guide.ru', font=font(26, True), fill=(255, 210, 103, int(255 * p)), anchor='mt')


def render_scene(chapter, index, t):
    local = max(0, t - chapter['start'])
    canvas = BACKGROUND.convert('RGBA')
    draw_particles(canvas, t, index * .7)
    kind = chapter['kind']
    if kind == 'opening':
        p = ease(local / 1.2)
        d = ImageDraw.Draw(canvas, 'RGBA')
        d.text((100, 170), 'ЛОГОС · ПУТЕВОДИТЕЛЬ', font=font(16, True), fill=(159, 183, 255, int(240 * p)))
        text_lines(d, 'Первая пара.\nНовый корпус.', (98, 225), 600, font(66, True), (255, 255, 255, int(255 * p)), spacing=5)
        d.text((102, 400), 'А куда идти?', font=font(35, True), fill=(255, 210, 103, int(255 * p)))
        draw_compass(canvas, local, center=(940, 354), radius=126)
    elif kind == 'ad':
        draw_ad(canvas, local)
        d = ImageDraw.Draw(canvas, 'RGBA')
        d.text((640, 635), 'КОРОТКАЯ РЕКЛАМНАЯ ПАУЗА · ШУТКА', font=font(13, True), fill=(221, 228, 249, 170), anchor='mt')
    elif kind == 'outro':
        draw_outro(canvas, local)
    else:
        draw_title(canvas, chapter, local)
        shot = chapter.get('shot')
        if kind == 'phone':
            draw_screen(canvas, shot, local, vertical=True, x=848, y=68)
            d = ImageDraw.Draw(canvas, 'RGBA')
            d.text((120, 350), 'Следующая пара', font=font(25, True), fill=(234, 239, 255, 255))
            d.text((120, 389), 'уже на главной', font=font(28, True), fill=(255, 210, 103, 255))
        elif kind == 'qr':
            draw_screen(canvas, shot, local, vertical=True, x=872, y=68)
            d = ImageDraw.Draw(canvas, 'RGBA')
            d.rounded_rectangle((580, 220, 815, 490), 18, fill=(250, 252, 255, 255), outline=(223, 231, 247, 255), width=2)
            d.text((697, 238), '211', font=font(27, True), fill=(19, 33, 58, 255), anchor='mt')
            d.text((697, 275), 'ВЫ ЗДЕСЬ', font=font(12, True), fill=(50, 88, 210, 255), anchor='mt')
            qr = qrcode.QRCode(box_size=4, border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
            qr.add_data('https://logos-guide.ru/here?room=physics-211')
            qr.make(fit=True)
            qr_image = qr.make_image(fill_color='#13213a', back_color='white').convert('RGB').resize((146, 146), Image.Resampling.NEAREST)
            canvas.alpha_composite(qr_image.convert('RGBA'), (624, 305))
            d.text((697, 467), 'КАБИНЕТ 211', font=font(10, True), fill=(19, 33, 58, 255), anchor='mt')
        else:
            if kind == 'route' and local > 7:
                shot = 'route-2' if local < 10 else 'route-3'
            draw_screen(canvas, shot, local, x=548 if kind in ('map', 'route') else 570, y=137 if kind == 'search' else 128, width=650 if kind in ('map', 'floors') else 625)
            if kind == 'map':
                draw_stat(canvas, local)
            elif kind == 'search':
                draw_search(canvas, local)
            elif kind == 'route':
                draw_route(canvas, local)
            elif kind == 'floors':
                draw_floors(canvas)
            elif kind == 'directory':
                d = ImageDraw.Draw(canvas, 'RGBA')
                d.rounded_rectangle((115, 430, 497, 520), 18, fill=(247, 249, 253, 247), outline=(219, 228, 242, 255), width=2)
                d.text((137, 439), '24', font=font(42, True), fill=(53, 86, 218, 255))
                d.text((205, 442), 'преподавателя', font=font(17, True), fill=(19, 33, 58, 255))
                d.text((205, 468), 'и сотрудника', font=font(16), fill=(65, 79, 108, 255))
                d.text((137, 493), 'Поиск по фамилии', font=font(12, True), fill=(72, 103, 225, 255))
            elif kind == 'offline':
                d = ImageDraw.Draw(canvas, 'RGBA')
                d.rounded_rectangle((115, 355, 440, 475), 20, fill=(33, 51, 105, 242), outline=(156, 180, 255, 140), width=2)
                d.ellipse((137, 384, 197, 444), fill=(155, 240, 191, 255))
                d.text((167, 391), '✓', font=font(34, True), fill=(20, 35, 76, 255), anchor='mt')
                d.text((214, 378), 'РАБОТАЕТ ОФЛАЙН', font=font(16, True), fill=(255, 255, 255, 255))
                d.text((214, 408), 'после первого открытия', font=font(12), fill=(203, 216, 245, 255))
    # Each chapter lands on a clean cut with a gentle fade-through.
    p = min(ease(local / .52), ease((chapter['end'] - t) / .45))
    if p < 1:
        overlay = Image.new('RGBA', (WIDTH, HEIGHT), (8, 13, 32, int((1 - p) * 255)))
        canvas.alpha_composite(overlay)
    draw_header(canvas, chapter, index, t, t / TIMELINE['duration'])
    return canvas.convert('RGB')


def main():
    duration = TIMELINE['duration']
    total = int(duration * FPS)
    silent = OUT / 'logos-promo-long-video.mp4'
    final = OUT / 'logos-promo-long.mp4'
    music = OUT / 'music-longform.mp3'
    if not music.exists():
        raise SystemExit('Нет public/promo/music-longform.mp3 — сначала выполните scripts/build-promo-music.py --longform')
    cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{WIDTH}x{HEIGHT}', '-r', str(FPS), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(silent)]
    encoder = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        chapter_index = 0
        for frame in range(total):
            t = frame / FPS
            while chapter_index + 1 < len(TIMELINE['chapters']) and t >= TIMELINE['chapters'][chapter_index]['end']:
                chapter_index += 1
            chapter = TIMELINE['chapters'][chapter_index]
            image = render_scene(chapter, chapter_index, t)
            encoder.stdin.write(image.tobytes())
            if frame % FPS == 0:
                print(f'Кадры: {100 * frame // total:3d}%  {t:6.1f}/{duration:.0f} с', flush=True)
        encoder.stdin.close()
        code = encoder.wait()
        if code:
            raise SystemExit(f'Кодировщик видео завершился с кодом {code}')
    except BrokenPipeError:
        encoder.wait()
        raise SystemExit('ffmpeg остановился во время записи кадров')
    # Финальная звуковая дорожка — только созданная для этой версии музыка и SFX.
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', str(silent), '-i', str(music),
                    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
                    '-shortest', '-movflags', '+faststart', str(final)], check=True)
    poster = render_scene(TIMELINE['chapters'][1], 1, 12.0)
    poster.save(OUT / 'poster-longform.jpg', quality=88, optimize=True)
    print(f'Готово: {final} ({duration} с, без голоса)')


if __name__ == '__main__':
    main()
