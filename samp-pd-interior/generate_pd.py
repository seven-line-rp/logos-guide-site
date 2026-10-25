#!/usr/bin/env python3
"""Генератор интерьера полицейского департамента для SA-MP.

Выход: pd_interior.obj + pd_interior.mtl (Z вверх, метры, 1 unit = 1 м, как в GTA SA),
а также pd_interior_boxes.json (список коллизионных боксов для .col) и
pd_interior_objects.inc (Pawn-массив с расстановкой спавн-точек).
Только стандартная библиотека.
"""
import json
import os

OUT = os.path.dirname(os.path.abspath(__file__))
H = 3.2          # высота потолка
T = 0.2          # толщина стен
DOOR_W, DOOR_H = 1.4, 2.3

verts, faces, boxes = [], [], []   # faces: (material, [vertex idx])
MATS = {
    "wall_white":  (0.86, 0.86, 0.84),
    "wall_blue":   (0.20, 0.30, 0.50),
    "floor_tile":  (0.62, 0.62, 0.60),
    "floor_dark":  (0.25, 0.25, 0.27),
    "carpet_blue": (0.12, 0.17, 0.30),
    "ceiling":     (0.92, 0.92, 0.90),
    "wood":        (0.38, 0.24, 0.13),
    "metal":       (0.45, 0.47, 0.50),
    "metal_dark":  (0.15, 0.16, 0.18),
    "bars":        (0.10, 0.10, 0.11),
    "locker":      (0.30, 0.40, 0.55),
    "fabric_blue": (0.10, 0.18, 0.40),
    "light":       (1.00, 1.00, 0.90),
    "badge_gold":  (0.80, 0.65, 0.15),
    "glass":       (0.55, 0.75, 0.85),
}


def box(x0, y0, z0, x1, y1, z1, mat, collide=True):
    """Закрытый параллелепипед с нормалями наружу."""
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1)); z0, z1 = sorted((z0, z1))
    if x1 - x0 < 1e-6 or y1 - y0 < 1e-6 or z1 - z0 < 1e-6:
        return
    b = len(verts) + 1
    verts.extend([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                  (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)])
    for q in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
              (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        faces.append((mat, [b + i for i in q]))
    if collide:
        boxes.append([round(v, 3) for v in (x0, y0, z0, x1, y1, z1)])


def wall(axis, c, a, b, doors=(), mat="wall_white", z0=0.0, h=H):
    """Стена. axis='x': вдоль X на y=c; axis='y': вдоль Y на x=c. doors — центры проёмов."""
    cuts = sorted((d - DOOR_W / 2, d + DOOR_W / 2) for d in doors)
    pos = a
    segs = []
    for s, e in cuts:
        segs.append((pos, s)); pos = e
    segs.append((pos, b))
    lo, hi = c - T / 2, c + T / 2
    for s, e in segs:
        if axis == "x":
            box(s, lo, z0, e, hi, z0 + h, mat)
        else:
            box(lo, s, z0, hi, e, z0 + h, mat)
    for s, e in cuts:  # перемычка над проёмом
        if axis == "x":
            box(s, lo, z0 + DOOR_H, e, hi, z0 + h, mat)
        else:
            box(lo, s, z0 + DOOR_H, hi, e, z0 + h, mat)


def room_floor(x0, y0, x1, y1, mat):
    box(x0, y0, 0.0, x1, y1, 0.02, mat, collide=False)


def desk(x, y, w=1.6, d=0.8, rot=False, mat="wood"):
    sx, sy = (d, w) if rot else (w, d)
    box(x - sx / 2, y - sy / 2, 0.70, x + sx / 2, y + sy / 2, 0.76, mat)
    for dx in (-1, 1):
        for dy in (-1, 1):
            box(x + dx * (sx / 2 - .06) - .03, y + dy * (sy / 2 - .06) - .03, 0,
                x + dx * (sx / 2 - .06) + .03, y + dy * (sy / 2 - .06) + .03, .70, mat, collide=False)


def chair(x, y, mat="fabric_blue"):
    box(x - .22, y - .22, .42, x + .22, y + .22, .48, mat, collide=False)
    box(x - .22, y - .24, .48, x + .22, y - .20, .95, mat, collide=False)
    box(x - .03, y - .03, 0, x + .03, y + .03, .42, "metal_dark", collide=False)


def monitor(x, y, rot=0):
    box(x - .22, y - .03, .76, x + .22, y + .03, .98, "metal_dark", collide=False)


def build():
    # --- плиты ---
    box(0, 0, -0.3, 36, 26, 0, "floor_dark")
    box(0, 0, H, 36, 26, H + 0.3, "ceiling")

    # --- покрытия комнат ---
    room_floor(0, 0, 14, 14, "floor_tile")          # холл
    room_floor(0, 14, 36, 18, "floor_tile")         # коридор
    room_floor(0, 18, 14, 26, "carpet_blue")        # брифинг
    room_floor(14, 18, 22, 26, "carpet_blue")       # кабинет шефа
    room_floor(22, 18, 29, 26, "floor_dark")        # допросная
    room_floor(29, 18, 36, 26, "floor_dark")        # улики
    room_floor(14, 0, 24, 8, "floor_tile")          # раздевалка
    room_floor(14, 8, 24, 14, "floor_dark")         # оружейная
    room_floor(24, 5, 36, 14, "floor_tile")         # зал камер
    room_floor(24, 0, 36, 5, "floor_dark")          # камеры

    # --- наружные стены ---
    wall("x", 0, 0, 36, doors=[7], mat="wall_blue")                 # юг, главный вход
    wall("x", 26, 0, 36, mat="wall_white")                          # север
    wall("y", 0, 0, 26, doors=[16], mat="wall_white")               # запад (запасной выход)
    wall("y", 36, 0, 26, doors=[16], mat="wall_white")              # восток (выход в гараж)

    # --- внутренние: юг ---
    wall("x", 14, 0, 14, doors=[7], mat="wall_white")               # холл <-> коридор
    wall("y", 14, 0, 14, doors=[4], mat="wall_white")               # холл <-> раздевалка
    wall("y", 24, 0, 14, mat="wall_white")                          # раздевалка/оружейная | камеры
    wall("x", 8, 14, 24, mat="wall_white")                          # раздевалка | оружейная
    wall("x", 14, 14, 24, doors=[19], mat="wall_white")             # оружейная <-> коридор
    wall("x", 14, 24, 36, doors=[30], mat="wall_white")             # зал камер <-> коридор

    # --- внутренние: север ---
    wall("x", 18, 0, 36, doors=[7, 18, 25.5, 32.5], mat="wall_white")
    wall("y", 14, 18, 26, mat="wall_white")
    wall("y", 22, 18, 26, mat="wall_white")
    wall("y", 29, 18, 26, mat="wall_white")

    # --- камеры: перегородки + решётка ---
    for x in (28, 32):
        box(x - .1, 0, 0, x + .1, 5, H, "wall_white")
    for i, x0 in enumerate((24, 28, 32)):
        cx0, cx1 = x0 + .1, x0 + 4 - .1
        # решётка по y=5 с проходом 1 м
        gate0, gate1 = (cx0 + cx1) / 2 - .5, (cx0 + cx1) / 2 + .5
        for bx in [cx0 + k * 0.12 for k in range(int((cx1 - cx0) / 0.12) + 1)]:
            if gate0 <= bx <= gate1:
                continue
            box(bx - .015, 4.95, 0, bx + .015, 5.05, H, "bars", collide=False)
        box(cx0, 4.95, 0, gate0, 5.05, .06, "bars"); box(gate1, 4.95, 0, cx1, 5.05, .06, "bars")
        box(cx0, 4.95, H - .06, cx1, 5.05, H, "bars", collide=False)
        box(cx0, 4.95, 1.0, gate0, 5.05, 1.06, "bars"); box(gate1, 4.95, 1.0, cx1, 5.05, 1.06, "bars")
        box(gate0, 4.95, DOOR_H, gate1, 5.05, H, "bars")
        # нары + унитаз + раковина
        box(cx0, 0.2, 0.4, cx0 + 0.9, 2.2, 0.55, "metal")
        box(cx1 - .45, 0.2, 0, cx1 - .05, 0.6, .4, "metal")
        box(cx1 - .45, 0.7, .8, cx1 - .05, 1.1, .9, "metal", collide=False)

    # --- холл: стойка приёма, скамейки, герб ---
    box(5.0, 7.0, 0, 10.6, 7.9, 1.1, "wood")
    box(4.9, 6.9, 1.1, 10.7, 8.0, 1.16, "metal_dark")
    box(5.0, 9.5, 0.0, 10.6, 9.6, 2.0, "wood", collide=False)   # задняя панель
    for x in (6.3, 8.8):
        chair(x, 8.6); monitor(x, 7.5)
    for y in (2.5, 4.0):  # скамьи для ожидающих
        box(1.0, y, 0.0, 4.0, y + .45, .45, "wood")
    box(0.1, 8.5, 1.4, 0.15, 11.5, 2.6, "badge_gold", collide=False)  # табличка/герб на запад. стене
    box(11.5, 0.5, 0, 12.5, 1.5, 0.9, "metal_dark")             # стенд с информацией

    # --- брифинг: ряды столов + кафедра + экран ---
    for row, y in enumerate((20.5, 22.3)):
        for x in (3.0, 6.5, 10.0):
            desk(x, y, w=2.4, d=0.7); chair(x - .5, y - .9); chair(x + .5, y - .9)
    box(3.0, 25.75, 1.2, 11.0, 25.8, 2.7, "glass", collide=False)   # экран
    box(6.2, 24.2, 0, 7.8, 24.9, 1.1, "wood")                         # кафедра

    # --- кабинет шефа ---
    desk(18, 23.0, w=2.2, d=1.0); chair(18, 24.3); monitor(18, 23.2)
    chair(17.0, 21.7); chair(19.0, 21.7)
    box(14.3, 19.0, 0, 15.2, 21.5, 1.0, "metal")                      # диван/шкаф
    box(21.3, 19.0, 0, 21.8, 25.0, 2.1, "wood")                       # книжный шкаф

    # --- допросная ---
    desk(25.5, 22.0, w=1.8, d=0.9, rot=False, mat="metal")
    chair(25.5, 20.9, "metal_dark"); chair(25.5, 23.1, "metal_dark")
    box(28.8, 20.5, 1.0, 28.85, 23.5, 2.4, "glass", collide=False)    # зеркало

    # --- хранилище улик: стеллажи ---
    for y in (19.3, 21.3, 23.3):
        box(30.0, y, 0, 35.0, y + .5, 2.2, "metal")
    desk(33.0, 25.2, w=2.0, d=0.6, mat="metal")

    # --- раздевалка: шкафчики + скамья ---
    for x in [14.4 + k * .5 for k in range(16)]:
        if x + .45 > 23.8:
            break
        box(x, 0.2, 0, x + .45, 0.8, 1.9, "locker", collide=False)
    box(14.4, 0.2, 0, 23.6, 0.8, 0.0, "locker", collide=False)
    box(15.0, 3.2, 0, 22.0, 3.7, 0.45, "wood")

    # --- оружейная: стойки + стол выдачи ---
    box(14.3, 8.4, 0, 14.5, 13.6, 2.0, "metal_dark")
    box(23.5, 8.4, 0, 23.7, 13.6, 2.0, "metal_dark")
    box(15.5, 10.5, 0, 22.5, 11.3, 1.1, "metal")                      # выдача
    box(16.0, 13.5, 0.3, 22.0, 13.9, 1.8, "metal_dark", collide=False)

    # --- зал камер: стойка бронирования ---
    box(26.0, 9.0, 0, 30.5, 9.8, 1.0, "wood")
    chair(28.0, 10.4)
    box(33.0, 12.0, 0, 34.0, 13.0, 0.5, "metal")                      # лавка арестованных

    # --- коридор: двери-таблички и светильники ---
    # потолочные светильники по всем комнатам
    for (x0, y0, x1, y1) in [(0, 0, 14, 14), (0, 14, 36, 18), (0, 18, 14, 26),
                             (14, 18, 22, 26), (22, 18, 29, 26), (29, 18, 36, 26),
                             (14, 0, 24, 8), (14, 8, 24, 14), (24, 5, 36, 14)]:
        nx = max(1, int((x1 - x0) // 6)); ny = max(1, int((y1 - y0) // 6))
        for i in range(nx):
            for j in range(ny):
                cx = x0 + (i + .5) * (x1 - x0) / nx
                cy = y0 + (j + .5) * (y1 - y0) / ny
                box(cx - .6, cy - .15, H - .04, cx + .6, cy + .15, H, "light", collide=False)


def write_obj():
    used = sorted({m for m, _ in faces})
    with open(os.path.join(OUT, "pd_interior.mtl"), "w") as f:
        for m in used:
            r, g, b = MATS[m]
            f.write(f"newmtl {m}\nKd {r} {g} {b}\nKa 0 0 0\nKs 0.05 0.05 0.05\n")
            if m == "light":
                f.write("Ke 1 1 0.9\n")
            f.write("\n")
    with open(os.path.join(OUT, "pd_interior.obj"), "w") as f:
        f.write("# SA-MP Police Department interior (Z-up, meters)\nmtllib pd_interior.mtl\no pd_interior\n")
        for v in verts:
            f.write("v %.3f %.3f %.3f\n" % v)
        cur = None
        for m, idx in faces:
            if m != cur:
                f.write(f"usemtl {m}\n"); cur = m
            f.write("f " + " ".join(map(str, idx)) + "\n")
    with open(os.path.join(OUT, "pd_interior_boxes.json"), "w") as f:
        json.dump({"unit": "m", "boxes": boxes}, f)


if __name__ == "__main__":
    build()
    write_obj()
    print(f"verts={len(verts)} faces={len(faces)} collision_boxes={len(boxes)} materials={len({m for m,_ in faces})}")
