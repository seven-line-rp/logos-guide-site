#!/usr/bin/env python3
"""Библиотека примитивов и мебели для генератора интерьера LSPD (SA-MP).

Выход (в эту же папку):
  pd_interior.obj / .mtl     — модель (Z вверх, метры, UV, нормали, текстуры из textures/)
  pd_interior_boxes.json     — коллизионные AABB-боксы
  scene.json                 — материалы PBR, светильники, комнаты (для рендера превью)
Сначала:  python3 gen_textures.py   затем:  python3 generate_pd.py
"""
import json
import math
import os
import random

OUT = os.path.dirname(os.path.abspath(__file__))
R = random.Random(7)

H = 3.4            # высота потолка
T = 0.2            # толщина стен
DOOR_H = 2.3
WAIN_H = 0.95      # высота панелей на стенах

# name: (texture, colour, tile_m, roughness, metalness, extras)
MATS = {
    "wall_paint":   ("wall_paint", (1, 1, 1), 2.0, .92, 0, {}),
    "wall_blue":    ("wall_blue", (1, 1, 1), 2.0, .9, 0, {}),
    "wall_grey":    ("wall_grey", (1, 1, 1), 2.0, .92, 0, {}),
    "brick":        ("brick", (1, 1, 1), 1.0, .95, 0, {}),
    "panel_navy":   ("panel_navy", (1, 1, 1), 1.0, .6, 0, {}),
    "floor_tile":   ("floor_tile", (.78, .78, .76), 1.2, .35, 0, {}),
    "floor_vinyl":  ("floor_vinyl", (1, 1, 1), 1.2, .45, 0, {}),
    "carpet_blue":  ("carpet_blue", (1, 1, 1), 1.0, 1, 0, {}),
    "carpet_grey":  ("carpet_grey", (1, 1, 1), 1.0, 1, 0, {}),
    "concrete":     ("concrete", (1, 1, 1), 2.0, .95, 0, {}),
    "parquet":      ("parquet", (1, 1, 1), 1.6, .4, 0, {}),
    "ceiling_tile": ("ceiling_tile", (1, 1, 1), 1.2, .95, 0, {}),
    "wood_light":   ("wood_light", (1, 1, 1), 1.0, .5, 0, {}),
    "wood_dark":    ("wood_dark", (1, 1, 1), 1.0, .45, 0, {}),
    "granite":      ("granite", (1, 1, 1), 1.0, .2, .1, {}),
    "metal":        ("metal", (1, 1, 1), 1.0, .45, .55, {}),
    "metal_dark":   ("metal_dark", (1, 1, 1), 1.0, .5, .5, {}),
    "locker":       (None, (.20, .31, .52), 1.0, .4, .6, {}),
    "plastic_black": (None, (.04, .04, .045), 1.0, .5, 0, {}),
    "plastic_white": (None, (.9, .9, .88), 1.0, .5, 0, {}),
    "leather":      (None, (.05, .05, .055), 1.0, .45, 0, {}),
    "fabric_blue":  (None, (.08, .16, .38), 1.0, .95, 0, {}),
    "fabric_grey":  (None, (.30, .31, .34), 1.0, .95, 0, {}),
    "fabric_red":   (None, (.26, .035, .05), 1.0, .95, 0, {}),
    "navy":         (None, (.06, .09, .18), 1.0, .8, 0, {}),
    "bars":         (None, (.07, .07, .08), 1.0, .5, .9, {}),
    "gold":         (None, (.85, .66, .18), 1.0, .3, 1, {}),
    "chrome":       (None, (.8, .82, .85), 1.0, .15, 1, {}),
    "rubber":       (None, (.03, .03, .03), 1.0, .9, 0, {}),
    "olive":        (None, (.22, .27, .16), 1.0, .7, .2, {}),
    "red":          (None, (.65, .05, .04), 1.0, .4, .1, {}),
    "leaf":         (None, (.08, .32, .10), 1.0, .7, 0, {}),
    "soil":         (None, (.13, .08, .05), 1.0, 1, 0, {}),
    "pot":          (None, (.55, .55, .52), 1.0, .5, 0, {}),
    "paper":        (None, (.92, .92, .9), 1.0, .9, 0, {}),
    "cardboard":    ("cardboard", (1, 1, 1), .6, .9, 0, {}),
    "book_a":       (None, (.35, .08, .08), 1.0, .8, 0, {}),
    "book_b":       (None, (.08, .20, .36), 1.0, .8, 0, {}),
    "book_c":       (None, (.10, .30, .15), 1.0, .8, 0, {}),
    "book_d":       (None, (.65, .55, .30), 1.0, .8, 0, {}),
    "glass":        (None, (.65, .82, .9), 1.0, .05, 0, {"opacity": .22}),
    "mirror_glass": ("mirror", (1, 1, 1), 1.0, .08, .6, {}),
    "light":        (None, (1, 1, .95), 1.0, .5, 0, {"emissive": 1.0}),
    "screen_dark":  (None, (.01, .015, .02), 1.0, .2, 0, {}),
    "screen_desktop": ("screen_desktop", (1, 1, 1), 1.0, .3, 0, {"emissive_map": 1.0}),
    "screen_slide": ("screen_slide", (1, 1, 1), 1.0, .3, 0, {"emissive_map": 1.0}),
    "exit_light":   ("sign_exit", (1, 1, 1), 1.0, .5, 0, {"emissive_map": 1.2}),
    "sign_logo":    ("sign_logo", (1, 1, 1), 1.0, .5, 0, {}),
    "poster_wanted": ("poster_wanted", (1, 1, 1), 1.0, .9, 0, {}),
    "noticeboard":  ("noticeboard", (1, 1, 1), 1.0, .9, 0, {}),
    "heightchart":  ("heightchart", (1, 1, 1), 1.0, .9, 0, {}),
    "clock":        ("clock", (1, 1, 1), 1.0, .4, 0, {}),
    "flag_us":      ("flag_us", (1, 1, 1), 1.0, .9, 0, {}),
    "flag_state":   ("flag_state", (1, 1, 1), 1.0, .9, 0, {}),
    "caution":      (None, (.9, .75, .05), 1.0, .6, 0, {}),
    "whiteboard":   (None, (.95, .95, .95), 1.0, .25, 0, {}),
    "wall_cream":   ("wall_cream", (1, 1, 1), 2.0, .92, 0, {}),
    "wainscot":     ("wainscot", (1, 1, 1), 1.0, .6, 0, {}),
    "tile_beige":   ("tile_beige", (1, 1, 1), 1.2, .38, 0, {}),
    "tile_grey":    ("tile_grey", (1, 1, 1), 1.2, .45, 0, {}),
    "tile_white":   ("tile_white", (1, 1, 1), 1.0, .3, 0, {}),
    "rug_red":      ("rug_red", (1, 1, 1), 3.6, 1, 0, {}),
    "mat_lspd":     ("mat_lspd", (1, 1, 1), 1.0, 1, 0, {}),
    "keyboard":     ("keyboard", (1, 1, 1), 1.0, .6, 0, {}),
    "books":        ("books", (1, 1, 1), 1.0, .9, 0, {}),
    "locker_front": ("locker_front", (1, 1, 1), 1.0, .4, .5, {}),
    "plant_card":   ("plant_a", (1, 1, 1), 1.0, .8, 0, {"alpha_test": .45}),
    "seal_floor":   ("seal_floor", (1, 1, 1), 1.0, .35, 0, {"alpha_test": .08}),
    "badge_wall":   ("badge_wall", (1, 1, 1), 1.0, .4, .3, {"alpha_test": .4}),
    "sign_protect": ("sign_protect", (1, 1, 1), 1.0, .5, 0, {}),
    "sign_values":  ("sign_values", (1, 1, 1), 1.0, .5, 0, {}),
    "sign_restroom": ("sign_restroom", (1, 1, 1), 1.0, .5, 0, {}),
    "sign_holding": ("sign_holding", (1, 1, 1), 1.0, .5, 0, {}),
    "sign_observation": ("sign_observation", (1, 1, 1), 1.0, .5, 0, {}),
    "art_city":     ("art_city", (1, 1, 1), 1.0, .3, 0, {}),
    "art_cert":     ("art_cert", (1, 1, 1), 1.0, .3, 0, {}),
    "art_portrait": ("art_portrait", (1, 1, 1), 1.0, .3, 0, {}),
    "art_map":      ("art_map", (1, 1, 1), 1.0, .5, 0, {}),
    "screen_cctv":  ("screen_cctv", (1, 1, 1), 1.0, .3, 0, {"emissive_map": 1.0}),
    "screen_map":   ("screen_map", (1, 1, 1), 1.0, .3, 0, {"emissive_map": 1.0}),
    "whiteboard_tex": ("whiteboard", (1, 1, 1), 1.0, .25, 0, {}),
    "rope_red":     (None, (.5, .02, .03), 1.0, .6, 0, {}),
    "brick_front":  ("brick", (1, 1, 1), 1.0, .95, 0, {}),
    "wall_cream_front": ("wall_cream", (1, 1, 1), 2.0, .92, 0, {}),
    "wainscot_front": ("wainscot", (1, 1, 1), 1.0, .6, 0, {}),
    "roof":         ("concrete", (1, 1, 1), 2.0, .95, 0, {}),
    "fixture_frame": ("metal", (1, 1, 1), 1.0, .35, .85, {}),
    "fixture_dark": ("metal_dark", (1, 1, 1), 1.0, .4, .8, {}),
}
for k in ("lobby", "briefing", "chief", "interrogation", "evidence", "armory", "locker", "cells", "restricted"):
    MATS["sign_" + k] = ("sign_" + k, (1, 1, 1), 1.0, .5, 0, {})

ROOMS = {}
faces = []        # (mat, pts, normals, uvs)
boxes = []        # коллизия, мировые AABB
fixtures = []     # (x, y, z) светильники
_stack = [(0.0, 0.0, 0.0)]
FACE = {"N": 0.0, "E": -math.pi / 2, "S": math.pi, "W": math.pi / 2}

# ───────────────────────── ядро ─────────────────────────
def push(x, y, th=0.0):
    tx, ty, t0 = _stack[-1]
    c, s = math.cos(t0), math.sin(t0)
    _stack.append((tx + c * x - s * y, ty + s * x + c * y, t0 + th))

def pop():
    _stack.pop()

def place(x, y, face="N"):
    push(x, y, FACE[face] if isinstance(face, str) else face)

def _T(p):
    tx, ty, t = _stack[-1]
    c, s = math.cos(t), math.sin(t)
    return (tx + c * p[0] - s * p[1], ty + s * p[0] + c * p[1], p[2])

def _TN(n):
    t = _stack[-1][2]
    c, s = math.cos(t), math.sin(t)
    return (c * n[0] - s * n[1], s * n[0] + c * n[1], n[2])

def _newell(pts):
    nx = ny = nz = 0.0
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
    return (nx / ln, ny / ln, nz / ln)

def face(mat, pts, normal=None, uv=None):
    """pts — локальные точки; normal — один вектор или список по вершинам."""
    wp = [_T(p) for p in pts]
    g = _newell(wp)
    if normal is None:
        ns = [g] * len(wp)
    elif isinstance(normal[0], (tuple, list)):
        ns = [_TN(n) for n in normal]
    else:
        ns = [_TN(normal)] * len(wp)
    avg = [sum(n[i] for n in ns) for i in range(3)]
    if g[0] * avg[0] + g[1] * avg[1] + g[2] * avg[2] < 0:
        wp.reverse(); ns.reverse()
        if uv:
            uv = list(reversed(uv))
    if uv is None:
        tile = MATS[mat][2]
        ax = max(range(3), key=lambda i: abs(g[i]))
        uv = []
        for p in wp:
            if ax == 2:
                uv.append((p[0] / tile, p[1] / tile))
            elif ax == 0:
                uv.append((p[1] / tile, p[2] / tile))
            else:
                uv.append((p[0] / tile, p[2] / tile))
    faces.append((mat, wp, ns, uv))

def _record(x0, y0, z0, x1, y1, z1):
    cs = [_T((x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    boxes.append([round(v, 3) for v in (min(c[0] for c in cs), min(c[1] for c in cs), min(c[2] for c in cs),
                                        max(c[0] for c in cs), max(c[1] for c in cs), max(c[2] for c in cs))])

def box(x0, y0, z0, x1, y1, z1, mat, col=False, sides=None):
    """sides: dict с ключами 'x-','x+','y-','y+','z-','z+' для разных материалов."""
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1)); z0, z1 = sorted((z0, z1))
    if x1 - x0 < 1e-6 or y1 - y0 < 1e-6 or z1 - z0 < 1e-6:
        return
    sd = sides or {}
    P = lambda x, y, z: (x, y, z)
    face(sd.get("z-", mat), [P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)], (0, 0, -1))
    face(sd.get("z+", mat), [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], (0, 0, 1))
    face(sd.get("y-", mat), [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], (0, -1, 0))
    face(sd.get("y+", mat), [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], (0, 1, 0))
    face(sd.get("x-", mat), [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], (-1, 0, 0))
    face(sd.get("x+", mat), [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], (1, 0, 0))
    if col:
        _record(x0, y0, z0, x1, y1, z1)

def rbox(cx, cy, w, d, z0, z1, ang, mat, col=False):
    """Повёрнутый (вокруг Z) прямоугольный брус."""
    push(cx, cy, ang)
    box(-w / 2, -d / 2, z0, w / 2, d / 2, z1, mat, col)
    pop()

def extrude(poly, z0, z1, mat):
    """Призма из выпуклого полигона (локальные XY)."""
    n = len(poly)
    face(mat, [(x, y, z1) for x, y in poly], (0, 0, 1))
    face(mat, [(x, y, z0) for x, y in poly], (0, 0, -1))
    for i in range(n):
        (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]
        face(mat, [(ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1)], (by - ay, -(bx - ax), 0))

def frustum(cx, cy, cz, length, r0, r1, mat, n=14, axis="z", caps=True):
    """Цилиндр/конус вдоль оси z/x/y, гладкие нормали."""
    def pt(r, a, b, t):
        if axis == "z":
            return (cx + r * a, cy + r * b, cz + t)
        if axis == "x":
            return (cx + t, cy + r * a, cz + r * b)
        return (cx + r * a, cy + t, cz + r * b)

    def nv(a, b):
        return {"z": (a, b, 0), "x": (0, a, b), "y": (a, 0, b)}[axis]
    ax_n = {"z": (0, 0, 1), "x": (1, 0, 0), "y": (0, 1, 0)}[axis]
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        c0, s0, c1, s1 = math.cos(a0), math.sin(a0), math.cos(a1), math.sin(a1)
        face(mat, [pt(r0, c0, s0, 0), pt(r0, c1, s1, 0), pt(r1, c1, s1, length), pt(r1, c0, s0, length)],
             [nv(c0, s0), nv(c1, s1), nv(c1, s1), nv(c0, s0)])
    if caps:
        if r1 > 0:
            face(mat, [pt(r1, math.cos(2 * math.pi * i / n), math.sin(2 * math.pi * i / n), length)
                       for i in range(n)], ax_n)
        if r0 > 0:
            face(mat, [pt(r0, math.cos(2 * math.pi * i / n), math.sin(2 * math.pi * i / n), 0)
                       for i in range(n)], tuple(-v for v in ax_n))

def cyl(cx, cy, z0, z1, r, mat, n=14):
    frustum(cx, cy, z0, z1 - z0, r, r, mat, n)

def sphere(cx, cy, cz, r, mat, n=8):
    rings = []
    for j in range(n + 1):
        phi = math.pi * j / n
        rings.append([(cx + r * math.sin(phi) * math.cos(2 * math.pi * i / (2 * n)),
                       cy + r * math.sin(phi) * math.sin(2 * math.pi * i / (2 * n)),
                       cz + r * math.cos(phi)) for i in range(2 * n)])
    for j in range(n):
        for i in range(2 * n):
            i2 = (i + 1) % (2 * n)
            q = [rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]]
            face(mat, q, [((p[0] - cx) / r, (p[1] - cy) / r, (p[2] - cz) / r) for p in q])

def quad(mat, p0, p1, p2, p3, normal=None):
    face(mat, [p0, p1, p2, p3], normal, [(0, 0), (1, 0), (1, 1), (0, 1)])

def wall_plane(x, y, nx, ny, width, z0, z1, mat, off=.004):
    """Вертикальная плоскость на стене в (x,y) с нормалью (nx,ny), читается слева направо."""
    rx, ry = -ny, nx          # right = up × n
    # up × n = (0,0,1)×(nx,ny,0) = (-ny, nx, 0)
    px, py = x + nx * off, y + ny * off
    h = width / 2
    quad(mat, (px - rx * h, py - ry * h, z0), (px + rx * h, py + ry * h, z0),
         (px + rx * h, py + ry * h, z1), (px - rx * h, py - ry * h, z1), (nx, ny, 0))

# ───────────────────────── стены, двери, окна ─────────────────────────
def wall(axis, c, a, b, ops=(), side_mats=("wall_cream", "wall_cream"), wains=(True, True), panel="wainscot", cap="plastic_white"):
    """axis 'x': стена вдоль X на y=c; 'y': вдоль Y на x=c.
    ops: dict(c, w, z0, z1). side_mats: (отрицательная сторона, положительная)."""
    ops = sorted(ops, key=lambda o: o["c"])
    lo, hi = c - T / 2, c + T / 2
    sm = {"y-": side_mats[0], "y+": side_mats[1]} if axis == "x" else {"x-": side_mats[0], "x+": side_mats[1]}

    def piece(s, e, z0, z1):
        if e - s < 1e-4 or z1 - z0 < 1e-4:
            return
        if axis == "x":
            box(s, lo, z0, e, hi, z1, side_mats[1], True, sm)
            if z0 == 0:
                wh = min(z1, WAIN_H)
                for k, (p0, p1) in enumerate(((lo - .018, lo), (hi, hi + .018))):
                    if wains[k]:
                        box(s, p0, 0, e, p1, wh, panel)
                        if z1 > WAIN_H:
                            box(s, p0 - (.012 if k == 0 else 0), wh, e, p1 + (.012 if k == 1 else 0), wh + .035, cap)
        else:
            box(lo, s, z0, hi, e, z1, side_mats[1], True, sm)
            if z0 == 0:
                wh = min(z1, WAIN_H)
                for k, (p0, p1) in enumerate(((lo - .018, lo), (hi, hi + .018))):
                    if wains[k]:
                        box(p0, s, 0, p1, e, wh, panel)
                        if z1 > WAIN_H:
                            box(p0 - (.012 if k == 0 else 0), s, wh, p1 + (.012 if k == 1 else 0), e, wh + .035, cap)
    pos = a
    for o in ops:
        s, e = o["c"] - o["w"] / 2, o["c"] + o["w"] / 2
        piece(pos, s, 0, H)
        piece(s, e, 0, o["z0"])          # подоконник
        piece(s, e, o["z1"], H)          # перемычка
        pos = e
    piece(pos, b, 0, H)

def door_op(c, w=1.4):
    return dict(c=c, w=w, z0=0, z1=DOOR_H)

def win_op(c, w=2.0, z0=1.05, z1=2.45):
    return dict(c=c, w=w, z0=z0, z1=z1, window=True)

def door_frame(axis, c, d, w, mat="wood_dark"):
    t, dep = .06, T + .08
    z = DOOR_H + .05
    if axis == "x":
        box(d - w / 2 - t, c - dep / 2, 0, d - w / 2, c + dep / 2, z, mat)
        box(d + w / 2, c - dep / 2, 0, d + w / 2 + t, c + dep / 2, z, mat)
        box(d - w / 2 - t, c - dep / 2, DOOR_H, d + w / 2 + t, c + dep / 2, z, mat)
    else:
        box(c - dep / 2, d - w / 2 - t, 0, c + dep / 2, d - w / 2, z, mat)
        box(c - dep / 2, d + w / 2, 0, c + dep / 2, d + w / 2 + t, z, mat)
        box(c - dep / 2, d - w / 2 - t, DOOR_H, c + dep / 2, d + w / 2 + t, z, mat)

def leaf(width, kind):
    """Створка вдоль +x от шарнира (0,0)."""
    th = .045
    if kind == "wood":
        box(0, -th / 2, .02, width, th / 2, DOOR_H - .01, "wood_light")
        for z0, z1 in ((.15, 1.0), (1.15, 2.15)):
            box(.14, -th / 2 - .006, z0, width - .14, th / 2 + .006, z1, "wood_dark")
    elif kind == "metal":
        box(0, -th / 2, .02, width, th / 2, DOOR_H - .01, "metal")
        box(.0, -th / 2 - .004, .02, width, th / 2 + .004, .25, "metal_dark")
        box(.3, -th / 2 - .006, 1.35, width - .3, th / 2 + .006, 1.85, "glass")
        box(.28, -th / 2 - .004, 1.33, width - .28, th / 2 + .004, 1.87, "metal_dark")
    elif kind == "glass":
        w = .07
        box(0, -.03, .02, w, .03, DOOR_H - .01, "chrome")
        box(width - w, -.03, .02, width, .03, DOOR_H - .01, "chrome")
        box(0, -.03, .02, width, .03, .18, "chrome")
        box(0, -.03, DOOR_H - .1, width, .03, DOOR_H - .01, "chrome")
        box(w, -.008, .18, width - w, .008, DOOR_H - .1, "glass")
    hx = width - .12
    for sgn in (1, -1):
        box(width - .22, sgn * (th / 2 + .02) - .01, .95, width - .06, sgn * (th / 2 + .02) + .01, 1.0, "chrome")
        box(width - .14, sgn * (th / 2 + .01) - .01, .92, width - .12, sgn * (th / 2 + .01) + .01, 1.0, "chrome")

def door(axis, c, d, w=1.4, kind="wood", swing=0.0, frame="wood_dark", double=False):
    """Дверь в стене axis на линии c, проём с центром d. swing — угол открытия (рад)."""
    door_frame(axis, c, d, w, frame)
    base = 0.0 if axis == "x" else math.pi / 2
    hx = lambda off: (d + off, c) if axis == "x" else (c, d + off)
    if double:
        half = w / 2 - .01
        x, y = hx(-w / 2 + .02)
        push(x, y, base + swing); leaf(half, kind); pop()
        x, y = hx(w / 2 - .02)
        push(x, y, base + math.pi - swing); leaf(half, kind); pop()
    else:
        x, y = hx(-w / 2 + .02)
        push(x, y, base + swing); leaf(w - .04, kind); pop()

def window(axis, c, d, w=2.0, z0=1.05, z1=2.45, ext_sill=True):
    t = .05
    def B(a0, a1, zz0, zz1, mat, th=t):
        if axis == "x":
            box(d + a0, c - th / 2, zz0, d + a1, c + th / 2, zz1, mat)
        else:
            box(c - th / 2, d + a0, zz0, c + th / 2, d + a1, zz1, mat)
    B(-w / 2, w / 2, z0 + .0, z0 + .05, "chrome")
    B(-w / 2, w / 2, z1 - .05, z1, "chrome")
    B(-w / 2, -w / 2 + .05, z0, z1, "chrome")
    B(w / 2 - .05, w / 2, z0, z1, "chrome")
    B(-.02, .02, z0, z1, "chrome")
    B(-w / 2 + .05, w / 2 - .05, z0 + .05, z1 - .05, "glass", .012)
    for off in (-T / 2 - .05, T / 2 + .0):
        if axis == "x":
            box(d - w / 2 - .06, c + off, z0 - .04, d + w / 2 + .06, c + off + .05, z0, "granite")
        else:
            box(c + off, d - w / 2 - .06, z0 - .04, c + off + .05, d + w / 2 + .06, z0, "granite")

# ───────────────────────── мебель ─────────────────────────
def office_chair(boss=False, mat="fabric_blue"):
    """Сидящий смотрит в +y."""
    for i in range(5):
        a = i * 2 * math.pi / 5
        rbox(math.cos(a) * .17, math.sin(a) * .17, .36, .04, .08, .11, a, "metal_dark")
        cyl(math.cos(a) * .32, math.sin(a) * .32, .0, .06, .03, "rubber", 8)
    cyl(0, 0, .11, .44, .028, "chrome", 8)
    box(-.24, -.24, .44, .24, .24, .50, mat)
    box(-.22, -.22, .50, .22, .22, .53, mat)
    bh = 1.02 if boss else .86
    box(-.23, -.27, .52, .23, -.21, bh, mat)
    if boss:
        box(-.25, -.285, .86, .25, -.215, 1.12, mat)
    for sx in (-1, 1):
        box(sx * .27 - .018, -.18, .56, sx * .27 + .018, .12, .6, "plastic_black")
        box(sx * .27 - .015, -.18, .5, sx * .27 + .015, -.15, .6, "plastic_black")

def monitor():
    """Экран смотрит в -y."""
    cyl(0, 0, .0, .015, .11, "plastic_black", 10)
    box(-.025, -.025, .015, .025, .02, .12, "plastic_black")
    box(-.29, -.02, .12, .29, .02, .56, "plastic_black")
    quad("screen_desktop", (.27, -.0225, .14), (-.27, -.0225, .14), (-.27, -.0225, .54), (.27, -.0225, .54))

def keyboard_set():
    box(-.22, -.32, 0, .22, -.12, .022, "plastic_black")
    quad("keyboard", (-.2, -.3, .0225), (.2, -.3, .0225), (.2, -.14, .0225), (-.2, -.14, .0225), (0, 0, 1))
    box(.28, -.30, 0, .33, -.2, .02, "plastic_black")
    box(-.45, -.1, 0, -.15, .08, .07, "plastic_black")        # телефон
    box(-.42, -.06, .07, -.2, .04, .09, "plastic_black")

def desk(w=1.6, d=.8, mat="wood_light", drawers=True, user_side="-"):
    """Центр в (0,0); пользователь со стороны -y. Верх 0.75."""
    box(-w / 2, -d / 2, .72, w / 2, d / 2, .75, mat, True)
    box(-w / 2 + .04, d / 2 - .03, .1, w / 2 - .04, d / 2, .72, mat)       # передняя панель-щит
    if drawers:
        box(w / 2 - .46, -d / 2 + .03, .08, w / 2 - .03, d / 2 - .03, .72, mat, True)
        for k in range(3):
            z0 = .12 + k * .2
            box(w / 2 - .44, -d / 2 + .01, z0, w / 2 - .05, -d / 2 + .03, z0 + .17, "wood_dark")
            box(w / 2 - .30, -d / 2 - .005, z0 + .13, w / 2 - .19, -d / 2 + .01, z0 + .15, "chrome")
        box(-w / 2 + .03, -d / 2 + .03, 0, -w / 2 + .07, d / 2 - .03, .72, mat, True)
    else:
        for sx in (-1, 1):
            box(sx * (w / 2 - .06) - .03, -d / 2 + .04, 0, sx * (w / 2 - .06) + .03, d / 2 - .04, .72, mat, True)

def workstation(x, y, face, w=1.6, boss=False, chair_mat="fabric_blue", screen=True):
    place(x, y, face)
    desk(w, .8, "wood_dark" if boss else "wood_light")
    # монитор и клавиатура лежат на столе (z=0.75)
    push(-.1, .12, 0); _lift(.75, monitor); pop()
    push(-.1, -.1, 0); _lift(.75, keyboard_set); pop()
    # лампа
    push(-w / 2 + .15, .22, 0); _lift(.75, desk_lamp); pop()
    # бумаги
    box(.2, -.1, .75, .45, .12, .765, "paper")
    box(.22, -.08, .765, .47, .14, .78, "paper")
    push(0, -.9, 0)
    office_chair(boss, chair_mat)
    pop()
    pop()

def _lift(z, fn, *a, **k):
    """Вызывает fn со сдвигом по Z — реализовано смещением всех добавленных граней."""
    n0 = len(faces)
    fn(*a, **k)
    for i in range(n0, len(faces)):
        m, pts, ns, uv = faces[i]
        faces[i] = (m, [(p[0], p[1], p[2] + z) for p in pts], ns, uv)

def desk_lamp():
    cyl(0, 0, 0, .02, .09, "plastic_black", 10)
    box(-.012, -.012, .02, .012, .012, .34, "metal_dark")
    box(-.01, -.01, .32, .01, .2, .345, "metal_dark")
    frustum(0, .2, .26, .08, .05, .08, "plastic_black", 10)

def filing_cabinet(h=1.35):
    """Фронт смотрит в -y; глубина .6."""
    box(-.23, -.3, 0, .23, .3, h, "metal", True)
    n = int(h / .33)
    for k in range(n):
        z0 = .04 + k * (h - .06) / n
        box(-.21, -.315, z0, .21, -.3, z0 + (h - .06) / n - .02, "metal_dark")
        box(-.07, -.33, z0 + (h - .06) / n - .1, .07, -.315, z0 + (h - .06) / n - .08, "chrome")

def bookshelf(w=2.0, h=2.1, d=.32, books=True, mat="wood_dark"):
    """Фронт в -y. Начинается в x=0."""
    box(0, 0, 0, .03, d, h, mat, True); box(w - .03, 0, 0, w, d, h, mat, True)
    box(0, d - .015, 0, w, d, h, mat)
    for k in range(6):
        z = .05 + k * (h - .08) / 5
        box(0, 0, z, w, d, z + .03, mat)
    if books:
        for k in range(5):
            z = .08 + k * (h - .08) / 5
            sh = (h - .08) / 5 - .05
            face("books", [(.03, .06, z), (w - .03, .06, z), (w - .03, .06, z + sh), (.03, .06, z + sh)], (0, -1, 0), [(0, 0), (w / .9, 0), (w / .9, 1), (0, 1)])

def bench(length=2.0, h=.45, mat="wood_light"):
    box(0, -.2, h - .05, length, .2, h, mat, True)
    for sx in (.15, length - .15):
        box(sx - .025, -.18, 0, sx + .025, .18, h - .05, "metal_dark")

def plastic_seats(n=3):
    """Ряд пластиковых кресел ожидания на раме. Сидящий смотрит +y."""
    L = n * .52
    box(0, -.03, .38, L, .03, .42, "metal_dark", True)
    for sx in (.1, L / 2, L - .1):
        box(sx - .02, -.04, 0, sx + .02, .04, .38, "metal_dark")
        box(sx - .02, -.38, 0, sx + .02, .38, .04, "metal_dark")
    for i in range(n):
        x0 = i * .52 + .03
        box(x0, -.24, .43, x0 + .46, .22, .47, "fabric_blue")
        box(x0, -.28, .47, x0 + .46, -.22, .9, "fabric_blue")
    return L

def plant(h=1.2, pot=.28):
    frustum(0, 0, 0, .34, pot * .78, pot, "pot", 14)
    cyl(0, 0, .335, .35, pot * .96, "soil", 14)
    cyl(0, 0, .35, .5, .02, "wood_dark", 6)
    n = 5
    for i in range(n):
        a = i * math.pi / n + R.random() * .2
        hw = h * .52
        c, s_ = math.cos(a), math.sin(a)
        z0, z1 = .3, .3 + h
        face("plant_card", [(-c * hw, -s_ * hw, z0), (c * hw, s_ * hw, z0), (c * hw, s_ * hw, z1), (-c * hw, -s_ * hw, z1)],
             (-s_, c, 0), [(0, 0), (1, 0), (1, 1), (0, 1)])
        face("plant_card", [(c * hw, s_ * hw, z0), (-c * hw, -s_ * hw, z0), (-c * hw, -s_ * hw, z1), (c * hw, s_ * hw, z1)],
             (s_, -c, 0), [(0, 0), (1, 0), (1, 1), (0, 1)])

def flag_pole(mat, h=2.3):
    """Флаг на подставке; полотнище вдоль +x, волнистое (8 сегментов)."""
    cyl(0, 0, 0, .04, .17, "metal_dark", 12)
    cyl(0, 0, .04, h, .018, "gold", 8)
    sphere(0, 0, h + .02, .035, "gold", 6)
    cyl(0, 0, h - 1.0, h - .96, .04, "gold", 8)
    L, Hh, seg = 1.35, .9, 10
    z0 = h - Hh - .08
    prev = None
    for i in range(seg + 1):
        u = i / seg
        y = math.sin(u * 5.0) * .045 * u
        x = .02 + u * L * (1 - .05 * u)
        cur = (x, y, u)
        if prev:
            (x0, y0, u0), (x1, y1, u1) = prev, cur
            pts = [(x0, y0, z0), (x1, y1, z0), (x1, y1, z0 + Hh), (x0, y0, z0 + Hh)]
            nrm = (-(y1 - y0), (x1 - x0), 0)
            face(mat, pts, [nrm] * 4, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)])
            face(mat, list(reversed(pts)), [tuple(-v for v in nrm)] * 4, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)][::-1])
        prev = cur

def vending_machine():
    box(-.45, -.4, 0, .45, .4, 1.85, "red", True)
    box(-.38, -.405, .75, .1, -.39, 1.7, "glass")
    box(.14, -.405, .8, .4, -.39, 1.6, "plastic_black")
    box(-.38, -.41, .1, .38, -.39, .45, "metal_dark")
    for r in range(5):
        for c in range(4):
            box(-.36 + c * .115, -.40, .8 + r * .17, -.28 + c * .115, -.38, .88 + r * .17,
                R.choice(["gold", "book_b", "book_c", "paper"]))

def water_cooler():
    box(-.15, -.15, 0, .15, .15, .95, "plastic_white", True)
    cyl(0, 0, .95, 1.4, .13, "glass", 12)
    box(-.05, -.17, .8, .05, -.15, .85, "metal")

def fire_extinguisher():
    cyl(0, 0, 0, .42, .07, "red", 12)
    frustum(0, 0, .42, .07, .07, .025, "red", 12)
    box(-.015, -.015, .5, .015, .015, .56, "chrome")
    box(-.04, -.1, .45, .04, -.02, .48, "plastic_black")

def clock_on_wall(x, y, nx, ny, z=2.55, r=.2):
    wall_plane(x, y, nx, ny, r * 2, z - r, z + r, "clock", .005)

def pic_frame(x, y, nx, ny, w, h, z0, mat, off=.004):
    wall_plane(x, y, nx, ny, w, z0, z0 + h, mat, off)
    rx, ry = -ny, nx
    t = .03
    for dz, ww, hh in ((z0 - t, w + 2 * t, t), (z0 + h, w + 2 * t, t)):
        cx, cy = x + nx * (off + .01), y + ny * (off + .01)
        rbox(cx, cy, ww if abs(rx) > 0 else .02, ww if abs(ry) > 0 else .02, dz, dz + hh, 0, "wood_dark")
    for s in (-1, 1):
        cx, cy = x + rx * s * (w / 2 + t / 2) + nx * (off + .01), y + ry * s * (w / 2 + t / 2) + ny * (off + .01)
        rbox(cx, cy, t if abs(rx) > 0 else .02, t if abs(ry) > 0 else .02, z0 - t, z0 + h + t, 0, "wood_dark")

def locker_bank(n, w=.45, h=1.9, d=.5):
    """Фронт в -y; от x=0 вдоль +x."""
    box(0, 0, 0, n * w, d, .15, "metal_dark", True)
    box(0, 0, .15, n * w, d, h, "locker", True)
    box(-.005, -.01, h, n * w + .005, d + .01, h + .1, "locker_front")
    for i in range(n):
        x0 = i * w
        face("locker_front", [(x0 + .012, -.004, .17), (x0 + w - .012, -.004, .17), (x0 + w - .012, -.004, h - .02),
                              (x0 + .012, -.004, h - .02)], (0, -1, 0), [(0, 0), (1, 0), (1, 1), (0, 1)])
        box(x0, -.012, .15, x0 + .012, 0, h, "metal_dark")
        box(x0 + .17, -.008, h - .34, x0 + w - .17, -.004, h - .29, "paper")

def rifle(kind="rifle"):
    """На вертикальной стене, ствол вверх. Лицо в -y."""
    L = 1.05 if kind == "rifle" else 1.15
    stock = "wood_dark" if kind != "rifle" else "plastic_black"
    box(-.03, -.07, .0, .03, -.01, .30, stock)
    box(-.032, -.075, .30, .032, -.005, .66, "plastic_black")
    frustum(0, -.04, .66, L - .66, .016, .014, "metal_dark", 10)
    box(-.025, -.12, .38, .025, -.075, .56, "plastic_black")
    box(-.02, -.095, .66, .02, -.04, .86, stock if kind != "rifle" else "plastic_black")

def weapon_rack(n=7, length=None):
    """Фронт в -y; вдоль +x. Стенка с держателями и винтовками."""
    L = length or n * .7
    box(0, 0, .0, L, .06, 2.2, "metal", True)
    for k in range(int(L / .08)):
        box(k * .08 + .03, -.004, .2, k * .08 + .05, 0, 2.15, "metal_dark")
    for i in range(n):
        push(.35 + i * .7, -.02 - .012, 0)
        _lift(.55, rifle, "rifle" if i % 3 else "shotgun")
        pop()
        box(.18 + i * .7, -.03, 1.2, .52 + i * .7, 0, 1.23, "metal")
    box(0, -.3, 0, L, .0, .03, "metal_dark")

def ammo_crate(w=.4, d=.25, h=.2):
    box(0, 0, 0, w, d, h, "olive", True)
    box(.02, -.002, h - .06, w - .02, .0, h - .04, "caution")

def vest():
    box(-.2, -.07, .0, .2, .06, .55, "navy")
    box(-.12, -.075, .45, .12, -.07, .5, "caution")

def evidence_shelf(L=5.0, d=.5, h=2.2, tiers=5):
    """Фронт в -y; вдоль +x."""
    for sx in (0, L - .05):
        box(sx, 0, 0, sx + .05, d, h, "metal", True)
    for sx in [L / 3, 2 * L / 3]:
        box(sx - .02, 0, 0, sx + .02, d, h, "metal")
    box(0, d - .01, 0, L, d, h, "metal")
    for k in range(tiers):
        z = .12 + k * (h - .15) / (tiers - 1)
        box(0, 0, z, L, d, z + .03, "metal")
        x = .1
        while x < L - .5:
            kind = R.random()
            if kind < .6:
                bw, bd, bh = R.uniform(.2, .45), R.uniform(.25, .4), R.uniform(.15, .3)
                box(x, .06, z + .03, x + bw, .06 + bd, z + .03 + bh, "cardboard")
                box(x + bw / 2 - .02, .06 - .002, z + .03, x + bw / 2 + .02, .06, z + .03 + bh, "paper")
            elif kind < .85:
                bw = R.uniform(.15, .3)
                box(x, .1, z + .03, x + bw, .3, z + .03 + .04, "plastic_white")
            else:
                bw = .25
                cyl(x + .12, .25, z + .03, z + .03 + .25, .09, "pot", 8)
            x += bw + R.uniform(.03, .25)

def mattress_bed(L=1.9, W=.75):
    box(0, 0, .35, L, W, .41, "metal", True)
    box(0, 0, 0, .05, W, .35, "metal"); box(L - .05, 0, 0, L, W, .35, "metal")
    box(.03, .03, .41, L - .03, W - .03, .5, "fabric_grey")
    box(L - .45, .08, .5, L - .05, W - .08, .56, "plastic_white")

def toilet_sink():
    """Нержавейка: у стены (+y). Фронт в -y."""
    box(-.2, .02, .35, .2, .22, .75, "metal", True)
    frustum(0, -.05, .38, .1, .17, .2, "metal", 12)
    box(-.19, .02, .75, .19, .06, 1.1, "metal")
    box(-.19, .02, 1.1, .19, .6, 1.13, "metal")
    cyl(0, -.05, .0, .38, .14, "metal", 12)
    box(-.18, .02, .95 - .3, .18, .5, .95 - .27, "metal")
    box(-.04, -.0, 1.0, .04, .08, 1.06, "chrome")

def interrogation_table():
    box(-.9, -.45, .73, .9, .45, .78, "metal", True)
    for sx in (-1, 1):
        box(sx * .85 - .03, -.4, 0, sx * .85 + .03, .4, .73, "metal_dark")
    box(-.2, -.41, .5, .2, -.39, .54, "metal_dark")
    cyl(.55, -.2, .78, .8, .06, "chrome", 10)       # кольцо для наручников
    box(-.14, .1, .78, .14, .3, .79, "paper")

def metal_chair():
    box(-.2, -.2, .43, .2, .2, .46, "metal_dark")
    box(-.2, -.22, .46, .2, -.19, .85, "metal_dark")
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(sx * .18 - .015, sy * .18 - .015, 0, sx * .18 + .015, sy * .18 + .015, .43, "metal_dark")

def sofa(L=2.0):
    box(0, -.45, .0, L, .45, .42, "leather", True)
    box(0, -.45, .42, L, -.3, .95, "leather", True)
    for sx in (0, L - .18):
        box(sx, -.45, .42, sx + .18, .45, .65, "leather")
    for i in range(2):
        box(.18 + i * (L - .36) / 2, -.3, .42, .18 + (i + 1) * (L - .36) / 2 - .01, .45, .55, "fabric_grey")

def podium():
    box(-.4, -.3, 0, .4, .3, 1.1, "wood_dark", True)
    box(-.45, -.35, 1.1, .45, .35, 1.14, "wood_light")
    cyl(0, .0, 1.14, 1.4, .012, "chrome", 6)
    sphere(0, 0, 1.42, .03, "plastic_black", 5)

def projector_screen():
    box(-1.9, -.03, 0, 1.9, .0, .06, "metal_dark")

def tv_on_wall(w=1.2, h=.7):
    box(-w / 2, 0, 0, w / 2, .05, h, "plastic_black")
    quad("screen_desktop", (w / 2 - .03, -.002, .03), (-w / 2 + .03, -.002, .03), (-w / 2 + .03, -.002, h - .03), (w / 2 - .03, -.002, h - .03))

def reception_counter(L=6.0, d=1.0):
    """Фронт в -y, пользователь снаружи. Длина вдоль +x от 0."""
    box(0, 0, 0, L, d, 1.08, "wood_dark", True)
    n = int(L / .9)
    for i in range(n):
        x0 = i * L / n + .06
        x1 = (i + 1) * L / n - .06
        box(x0, -.025, .14, x1, 0, 1.0, "wood_light")
        box(x0 + .05, -.032, .24, x1 - .05, -.025, .9, "wood_dark")
    box(0, -.03, 0, L, .0, .12, "metal_dark")
    box(-.08, -.1, 1.08, L + .08, d + .08, 1.13, "granite")
    box(0, -.04, 1.0, L, -.0, 1.045, "gold")
    box(0.4, .45, .75, L - .4, d - .1, .78, "wood_dark")
    box(L / 2 - .3, .1, 1.13, L / 2 + .3, .12, 1.4, "glass")

def table_long(w=2.4, d=.7):
    box(-w / 2, -d / 2, .72, w / 2, d / 2, .76, "wood_light", True)
    box(-w / 2 + .05, d / 2 - .05, .3, w / 2 - .05, d / 2 - .03, .72, "wood_light")
    for sx in (-1, 1):
        box(sx * (w / 2 - .08) - .03, -d / 2 + .06, 0, sx * (w / 2 - .08) + .03, d / 2 - .06, .72, "metal_dark", True)

def floor_pad(x0, y0, x1, y1, mat, z=.03):
    box(x0, y0, 0, x1, y1, z, mat, False, {"z+": mat, "z-": mat})

def ceiling_fixture(x, y, w=1.2, d=.6):
    box(x - w / 2 - .04, y - d / 2 - .04, H - .06, x + w / 2 + .04, y + d / 2 + .04, H, "fixture_frame")
    box(x - w / 2, y - d / 2, H - .075, x + w / 2, y + d / 2, H - .06, "light")
    fixtures.append((x, y, H - .35))

def ac_vent(x, y):
    box(x - .3, y - .3, H - .05, x + .3, y + .3, H, "fixture_frame")
    for k in range(7):
        box(x - .26, y - .26 + k * .08, H - .065, x + .26, y - .22 + k * .08, H - .05, "fixture_dark")

def write_files():
    used = sorted({m for m, *_ in faces})
    with open(os.path.join(OUT, "pd_interior.mtl"), "w") as f:
        for m in used:
            tex, col, tile, rough, metal, ex = MATS[m]
            f.write(f"newmtl {m}\nKd {col[0]} {col[1]} {col[2]}\nKa 0 0 0\nKs 0.1 0.1 0.1\n")
            if tex:
                f.write(f"map_Kd textures/{tex}.png\n")
            if "opacity" in ex:
                f.write(f"d {ex['opacity']}\n")
            if "alpha_test" in ex and tex:
                f.write(f"map_d textures/{tex}.png\n")
            if "emissive" in ex:
                f.write("Ke 1 1 0.95\n")
            f.write("\n")
    nv = 0
    lines = ["# SA-MP LSPD interior. Z-up, meters.", "mtllib pd_interior.mtl", "o pd_interior"]
    cur = None
    vlines, tlines, nlines, flines = [], [], [], []
    for m, pts, ns, uv in faces:
        if m != cur:
            flines.append(f"usemtl {m}"); cur = m
        ids = []
        for p, n, t in zip(pts, ns, uv):
            vlines.append("v %.4f %.4f %.4f" % p)
            tlines.append("vt %.4f %.4f" % (t[0], t[1]))
            nlines.append("vn %.4f %.4f %.4f" % n)
            nv += 1
            ids.append(f"{nv}/{nv}/{nv}")
        flines.append("f " + " ".join(ids))
    with open(os.path.join(OUT, "pd_interior.obj"), "w") as f:
        f.write("\n".join(lines + vlines + tlines + nlines + flines) + "\n")
    with open(os.path.join(OUT, "pd_interior_boxes.json"), "w") as f:
        json.dump({"unit": "m", "boxes": boxes}, f)
    scene = {
        "materials": {m: {"tex": MATS[m][0], "color": MATS[m][1], "rough": MATS[m][3], "metal": MATS[m][4], **MATS[m][5]}
                      for m in used},
        "lights": fixtures,
        "rooms": ROOMS,
    }
    with open(os.path.join(OUT, "scene.json"), "w") as f:
        json.dump(scene, f)
    return nv

