#!/usr/bin/env python3
"""LSPD interior (планировка по референсу): широкое лобби, коридор, ряд служебных помещений, блок камер.

Порядок:  python3 gen_textures.py  →  python3 generate_pd.py
Выход: pd_interior.obj/.mtl, pd_interior_boxes.json, scene.json (см. pd_lib.write_files).
Оси: X — вправо (восток), Y — вглубь здания (север), Z — вверх; единицы — метры.
Аргумент face у place(): направление, В КОТОРОЕ СМОТРИТ пользователь предмета
(у предмета, стоящего у стены, — в сторону этой стены).
"""
import pd_lib as L
import pd_models  # noqa: F401  — подмена деталированной мебелью
from pd_lib import *   # noqa: F401,F403
from pd_props import *  # noqa: F401,F403

W, D = 56.0, 36.0          # размеры здания

L.ROOMS.update({
    "lobby": [0, 0, W, 16], "corridor": [0, 16, W, 20], "briefing": [0, 20, 12, 36], "chief": [12, 20, 22, 36],
    "interrogation": [22, 20, 31, 28], "observation": [22, 28, 31, 36], "locker": [31, 20, 40, 28],
    "restroom": [31, 28, 40, 36], "evidence": [40, 20, 46, 36], "holding": [46, 20, 49, 36], "cells": [49, 20, 56, 36],
})


def build():
    # ───── плиты и покрытия ─────
    box(-.6, -2.4, -.3, W + .6, D + .6, 0, "concrete")
    box(-.3, -.3, H, W + .3, D + .3, H + .3, "roof", False, {"z-": "ceiling_tile"})
    for rect, mat in [((0, 0, W, 16), "tile_beige"), ((0, 16, W, 20), "tile_beige"),
                      ((0, 20, 12, 36), "carpet_grey"), ((12, 20, 22, 36), "parquet"),
                      ((22, 20, 31, 28), "tile_grey"), ((22, 28, 31, 36), "carpet_grey"),
                      ((31, 20, 40, 28), "tile_grey"), ((31, 28, 40, 36), "tile_white"),
                      ((40, 20, 46, 36), "floor_vinyl"), ((46, 20, 49, 36), "tile_grey"),
                      ((49, 20, 56, 36), "concrete")]:
        floor_pad(*rect, mat)

    # ───── стены ─────
    wall("x", 0, 0, W, [door_op(28, 2.4)], ("brick_front", "wall_cream_front"), (False, True), panel="wainscot_front")
    wall("x", 36, 0, W, [win_op(17, 2.2)], ("wall_cream", "brick"), (True, False))
    wall("y", 0, 0, 36, [door_op(18)], ("brick", "wall_cream"), (False, True))
    wall("y", W, 0, 36, [door_op(18)], ("wall_cream", "brick"), (True, False))
    wall("x", 16, 0, W, [door_op(3), door_op(53)])
    wall("x", 20, 0, W, [door_op(6), door_op(17), door_op(26.5), door_op(35.5), door_op(43), door_op(47.5)])
    for x in (12, 22, 31, 40, 46):
        wall("y", x, 20, 36)
    wall("x", 28, 22, 40, [door_op(23.3, 1.2), door_op(35.5), win_op(28.0, 2.6, 0.9, 2.3)])
    for y in (24, 28, 32):
        box(49, y - .1, 0, W, y + .1, H, "concrete", True)

    # ───── двери и окна ─────
    door("x", 0, 28, 2.4, "glass", 0.0, "chrome", double=True)
    window("x", 36, 17, 2.2)
    door("x", 16, 3, 1.4, "wood", .7); door("x", 16, 53, 1.4, "wood", 0.0)
    door("y", 0, 18, 1.4, "metal", 0.0, "metal_dark"); door("y", W, 18, 1.4, "metal", 0.0, "metal_dark")
    door("x", 20, 6, 1.4, "wood", .85)
    door("x", 20, 17, 1.4, "wood", 0.0)
    door("x", 20, 26.5, 1.4, "metal", 0.0, "metal_dark")
    door("x", 20, 35.5, 1.4, "wood", .5)
    door("x", 20, 43, 1.4, "metal", 0.0, "metal_dark")
    door("x", 20, 47.5, 1.4, "metal", 1.0, "metal_dark")
    door("x", 28, 23.3, 1.2, "metal", .6, "metal_dark")
    door("x", 28, 35.5, 1.4, "wood", 0.0)
    window("x", 28, 28.0, 2.6, 0.9, 2.3)
    # вход снаружи: ступени, козырёк с вывеской
    box(24.5, -1.6, -.3, 31.5, 0, 0, "concrete", True)
    box(24.8, -1.2, -.3, 31.2, 0, .12, "concrete", True)
    box(25.2, -.8, -.3, 30.8, 0, .24, "concrete", True)
    box(23.6, -2.0, 3.0, 32.4, 0, 3.12, "metal_dark")
    box(23.6, -2.02, 3.12, 32.4, -1.9, 3.9, "sign_lobby")
    for sx in (24.0, 32.0):
        cyl(sx, -1.8, -.3, 3.0, .07, "metal_dark", 10)

    # ───── таблички над дверями ─────
    for d, m in [(6, "sign_briefing"), (17, "sign_chief"), (26.5, "sign_interrogation"),
                 (35.5, "sign_locker"), (43, "sign_evidence"), (47.5, "sign_holding")]:
        label("x", 20, -1, d, m, 1.3, 2.5)
    label("x", 28, +1, 35.5, "sign_restroom", 1.2, 2.5)
    exit_sign(.11, 18, 1, 0); exit_sign(W - .11, 18, -1, 0)

    # ───── ЛОББИ ─────
    decal(28, 7.0, 7.2, 7.2, "seal_floor")
    decal(28, 1.4, 2.8, 1.4, "mat_lspd"); decal(3, 15.0, 1.6, .8, "mat_lspd"); decal(53, 15.0, 1.6, .8, "mat_lspd")
    place(19, 10.4, "N"); reception_counter(18.0, 1.2); pop()
    for i, x in enumerate((22.0, 25.3, 28.6, 31.9, 35.2)):
        station(x, 13.7, "S", 1.8, 2, False, "fabric_blue",
                ["screen_desktop", "screen_map" if i == 2 else "screen_desktop"])
    for x in (19.0, 19.5, 36.5, 37.0):
        place(x, 15.6, "N"); filing_cabinet(); pop()
    wall_plane(28, 15.9, 0, -1, 1.7, 1.55, 3.25, "badge_wall", .01)
    place(23.4, 15.4, "N"); flag_pole("flag_us"); pop()
    place(32.0, 15.4, "N"); flag_pole("flag_state"); pop()
    wall_plane(11.0, 15.9, 0, -1, 3.0, 1.45, 2.95, "sign_protect", .01)
    wall_plane(45.0, 15.9, 0, -1, 3.0, 1.45, 2.95, "sign_values", .01)
    wall_plane(6.5, 15.9, 0, -1, 1.7, 1.25, 2.25, "noticeboard", .01)
    wall_plane(50.0, 15.9, 0, -1, 1.7, 1.25, 2.25, "noticeboard", .01)
    clock_on_wall(15.6, 15.9, 0, -1, 2.9, .24)
    pic_frame(41.0, 15.9, 0, -1, 1.2, .9, 1.7, "art_cert"); pic_frame(52.5, 15.9, 0, -1, .8, 1.1, 1.6, "art_portrait")
    for x in (3.0, 5.6):
        for y in (3.9, 7.5):
            place(x, y, "N"); waiting_chairs(3); pop()
    for x in (46.6, 49.2):
        for y in (3.9, 7.5):
            place(x, y, "N"); waiting_chairs(3); pop()
    for cx in (5.0, 51.0):
        box(cx - .4, 5.0, 0, cx + .4, 5.8, .45, "wood_dark", True); box(cx - .5, 4.9, .45, cx + .5, 5.9, .48, "glass")
    place(.55, 12.5, "W"); waiting_chairs(3); pop()
    place(W - .55, 9.5, "E"); waiting_chairs(3); pop()
    for (xa, xb, y) in ((14.0, 18.5, 5.6), (37.5, 42.0, 5.6)):
        stanchion(xa, y); stanchion(xb, y); rope(xa, y, xb, y)
    for (x, y) in [(1.0, 1.0), (W - 1.0, 1.0), (24.6, 1.2), (31.4, 1.2), (17.4, 9.4), (38.6, 9.4), (1.0, 15.0),
                   (W - 1.0, 15.0), (12.8, 11.5), (43.2, 11.5)]:
        place(x, y, "N"); plant(R.uniform(1.25, 1.55)); pop()
    place(W - .5, 3.0, "E"); vending_machine(); pop()
    place(W - .55, 5.0, "E"); water_cooler(); pop()
    place(W - .4, 6.0, "N"); trash_can(); pop()
    place(.4, 1.2, "N"); trash_can(); pop()
    place(23.2, 3.0, "N"); a_frame_sign(); pop()
    for y, m in [(4.0, "art_city"), (7.0, "art_cert"), (10.0, "art_portrait")]:
        pic_frame(.1, y, 1, 0, 1.0, .8, 1.5, m)
    for y, m in [(11.0, "art_map"), (13.0, "art_city"), (2.0, "art_cert")]:
        pic_frame(W - .1, y, -1, 0, 1.0, .8, 1.5, m)
    wall_plane(.11, 14.0, 1, 0, 1.4, 1.2, 2.2, "noticeboard", .004)
    cctv_dome(14, 8, H); cctv_dome(42, 8, H)

    # ───── КОРИДОР ─────
    for x in (10.0, 24.0, 40.0):
        place(x, 16.45, "N"); waiting_chairs(3); pop()
    place(1.6, 19.7, "N"); water_cooler(); pop()
    place(11.2, 19.75, "N"); fire_extinguisher(); pop()
    place(39.0, 16.3, "S"); fire_extinguisher(); pop()
    place(.9, 17.0, "N"); plant(1.4); pop(); place(W - .9, 17.0, "N"); plant(1.4); pop()
    place(21.5, 16.5, "N"); trash_can(); pop()
    for x, m in [(11.5, "art_city"), (14.0, "art_cert"), (31.5, "art_map"), (45.0, "art_portrait"), (50.5, "art_city")]:
        pic_frame(x, 16.1, 0, 1, 1.0, .75, 1.5, m)
    wall_plane(29.0, 16.11, 0, 1, 1.3, 1.25, 2.2, "noticeboard", .004)
    wall_plane(21.0, 19.91, 0, -1, 1.3, 1.25, 2.2, "noticeboard", .004)
    wall_plane(9.5, 19.91, 0, -1, .5, 1.4, 2.1, "poster_wanted", .004)
    wall_plane(10.2, 19.91, 0, -1, .5, 1.4, 2.1, "poster_wanted", .004)
    cctv_dome(14, 18, H); cctv_dome(42, 18, H)
    decal(28, 18, 52, .25, "caution", 0, .045)

    # ───── БРИФИНГ ─────
    place(6.0, 27.5, "N"); conference_table(6.0, 1.7); pop()
    for k in range(5):
        x = 3.5 + k * 1.25
        place(x, 26.1, "N"); office_chair(False, "fabric_blue"); pop()
        place(x, 28.9, "S"); office_chair(False, "fabric_blue"); pop()
    place(2.0, 27.5, "E"); office_chair(True, "leather"); pop()
    place(10.0, 27.5, "W"); office_chair(False, "fabric_blue"); pop()
    quad("screen_slide", (3.7, 35.88, .85), (8.3, 35.88, .85), (8.3, 35.88, 3.05), (3.7, 35.88, 3.05), (0, -1, 0))
    box(3.6, 35.85, .78, 8.4, 35.9, .85, "metal_dark"); box(3.6, 35.85, 3.05, 8.4, 35.9, 3.12, "metal_dark")
    box(5.8, 26.9, H - .5, 6.2, 27.5, H - .42, "plastic_black"); box(5.95, 26.85, H - .42, 6.05, 26.9, H, "metal_dark")
    wall_plane(.11, 24.0, 1, 0, 4.0, 1.0, 2.9, "whiteboard_tex", .004)
    for y0 in (33.0, 29.8):
        place(11.58, y0, "E"); bookshelf(3.0, 2.1); pop()
    place(10.5, 20.4, "S"); coffee_station(); pop()
    for y in (22.6, 24.5):
        station(10.85, y, "E", 1.7, 2, False, "fabric_blue")
    place(.42, 30.2, "W"); filing_cabinet(); pop()
    place(1.0, 35.0, "N"); plant(1.5); pop(); place(1.0, 21.0, "N"); plant(1.4); pop()
    place(10.8, 35.0, "N"); plant(1.4); pop()
    place(2.0, 35.3, "N"); flag_pole("flag_us"); pop()
    for x, m in [(2.4, "art_cert"), (10.0, "art_city")]:
        pic_frame(x, 20.11, 0, 1, 1.0, .75, 1.6, m)
    clock_on_wall(11.9, 25.0, -1, 0, 2.7, .22)

    # ───── КАБИНЕТ ШЕФА ─────
    decal(17, 28.6, 6.8, 5.0, "rug_red", 0, .036)
    station(17, 32.2, "S", 2.2, 2, True, "leather")
    place(16.0, 29.3, "N"); office_chair(False, "leather"); pop(); place(18.0, 29.3, "N"); office_chair(False, "leather"); pop()
    place(14.4, 35.4, "N"); flag_pole("flag_us"); pop(); place(19.4, 35.4, "N"); flag_pole("flag_state"); pop()
    for y0 in (32.9, 29.7):
        place(12.42, y0, "W"); bookshelf(3.0, 2.2); pop()
    place(14.6, 35.45, "N"); credenza(2.6); pop()
    place(15.4, 35.45, "N"); lift(.81, globe); pop()
    place(18.6, 35.45, "N"); credenza(2.2); pop()
    place(21.4, 25.0, "W"); sofa(2.2); pop()
    box(19.4, 25.0, 0, 20.4, 26.2, .42, "wood_dark", True); box(19.35, 24.95, .42, 20.45, 26.25, .46, "glass")
    place(21.55, 33.0, "W")
    box(-.3, 0, 0, .3, .45, 1.8, "wood_dark", True); box(-.27, .03, .3, .27, .44, 1.7, "glass")
    pop()
    place(13.0, 21.2, "N"); plant(1.4); pop(); place(21.0, 35.0, "N"); plant(1.5); pop()
    pic_frame(13.4, 20.11, 0, 1, 1.0, .75, 1.6, "art_cert"); pic_frame(20.6, 20.11, 0, 1, 1.0, .75, 1.6, "art_portrait")

    # ───── ДОПРОСНАЯ ─────
    place(26.5, 24.0, "N"); interrogation_table(); pop()
    place(23.6, 21.2, "N"); tripod_camera(); pop()
    place(30.4, 27.5, "N"); filing_cabinet(); pop()
    place(22.6, 27.0, "N"); plant(1.1, .22); pop()
    place(26.5, 22.9, "N"); metal_chair(); pop(); place(26.5, 25.1, "S"); metal_chair(); pop()
    place(22.6, 24.0, "E"); metal_chair(); pop()
    frustum(26.5, 24.0, 2.3, 1.0, .02, .02, "metal_dark", 6)
    frustum(26.5, 24.0, 1.95, .35, .25, .06, "metal_dark", 14)
    cctv_dome(29.6, 21.2, H)
    clock_on_wall(30.89, 22.5, -1, 0, 2.6, .2)

    # ───── НАБЛЮДЕНИЕ ─────
    station(28.0, 29.7, "S", 2.8, 3, False, "fabric_grey", ["screen_cctv", "screen_cctv", "screen_map"])
    place(25.0, 35.88, "N"); lift(1.4, wall_tv, 1.6, .8, "screen_cctv"); pop()
    place(28.4, 35.88, "N"); lift(1.4, wall_tv, 1.6, .8, "screen_map"); pop()
    place(22.45, 33.4, "W"); bookshelf(2.4, 2.0); pop()
    station(24.6, 31.4, "S", 1.6, 2, False, "fabric_grey", ["screen_cctv", "screen_desktop"])
    station(30.0, 33.0, "W", 1.6, 1, False, "fabric_grey")
    place(26.4, 35.4, "N"); credenza(1.8); pop()
    place(30.4, 35.0, "N"); plant(1.3); pop()

    # ───── РАЗДЕВАЛКА ─────
    place(31.6, 21.0, "W"); locker_bank(8); pop()
    place(31.6, 24.7, "W"); locker_bank(7); pop()
    place(39.4, 27.6, "E"); locker_bank(8); pop()
    place(39.4, 23.9, "E"); locker_bank(7); pop()
    place(33.6, 23.0, "N"); bench(3.6, .45); pop()
    place(33.6, 25.6, "N"); bench(3.6, .45); pop()
    place(37.0, 20.4, "S"); trash_can(); pop()
    place(33.2, 27.45, "N"); sink_counter(3); pop()
    box(33.2, 27.88, 1.1, 35.9, 27.92, 2.1, "mirror_glass")
    pic_frame(33.0, 20.11, 0, 1, .9, .7, 1.6, "noticeboard")

    # ───── САНУЗЛЫ ─────
    for xc in (32.3, 33.3, 34.3):
        place(xc, 35.6, "N"); toilet(); pop()
        place(xc - .5, 34.1, "N"); stall_partition(1.8); pop()
        place(xc - .45, 34.1, "N"); stall_door(.9); pop()
    place(34.8, 34.1, "N"); stall_partition(1.8); pop()
    for y in (29.6, 31.2, 32.8):
        place(39.82, y, "E"); sink(); pop()
        box(39.88, y - .4, 1.15, 39.9, y + .4, 2.1, "mirror_glass")
    for y in (34.0, 35.0):
        place(39.85, y, "E"); urinal(); pop()
    place(36.5, 35.5, "N"); trash_can(); pop()

    # ───── ХРАНИЛИЩЕ УЛИК ─────
    place(40.62, 22.4, "W"); evidence_shelf(10.4, .5, 2.2, 5); pop()
    place(45.38, 33.0, "E"); evidence_shelf(10.4, .5, 2.2, 5); pop()
    place(42.4, 22.4, "W"); evidence_shelf(9.0, .5, 2.2, 5); pop()
    station(43.0, 34.6, "S", 2.0, 1, False, "fabric_grey")
    box(41.0, 21.3, 0, 45.0, 21.9, 1.0, "metal", True); box(40.9, 21.2, 1.0, 45.1, 22.0, 1.05, "granite")
    cctv_dome(43, 28, H)

    # ───── СОДЕРЖАНИЕ ПОД СТРАЖЕЙ ─────
    place(46.6, 25.0, "E"); bench(2.4, .45, "metal"); pop()
    station(47.5, 34.4, "S", 1.6, 1, False, "fabric_grey")
    wall_plane(46.11, 30.5, 1, 0, .62, .05, 2.4, "heightchart", .005)
    wall_plane(46.11, 27.5, 1, 0, 1.2, 1.3, 2.2, "noticeboard", .004)
    cctv_dome(47.5, 28, H)
    for j in range(4):
        ya, yb = 20 + 4 * j, 24 + 4 * j
        yc = (ya + yb) / 2
        for k in range(int(4.0 / .11) + 1):
            y = ya + .1 + k * .11
            if y > yb - .1 or abs(y - yc) < .55:
                continue
            box(48.97, y - .012, .06, 49.03, y + .012, H - .06, "bars")
        for a0, a1 in ((ya + .08, yc - .55), (yc + .55, yb - .08)):
            box(48.95, a0, 0, 49.05, a1, .08, "bars"); box(48.95, a0, 1.0, 49.05, a1, 1.05, "bars", True)
            box(48.95, a0, H - .1, 49.05, a1, H - .06, "bars")
        box(48.95, yc - .55, DOOR_H, 49.05, yc + .55, DOOR_H + .05, "bars")
        box(48.95, yc - .55, DOOR_H + .05, 49.05, yc + .55, H, "bars")
        place(55.15, yb - .2, "E"); mattress_bed(1.9, .75); pop()
        place(55.15, yb - .2, "E"); lift(.95, mattress_bed, 1.9, .75); pop()
        for cy in (yb - .22, yb - 2.08):
            box(55.1, cy - .02, 0, 55.15, cy + .02, 1.5, "metal_dark")
        place(55.68, ya + .9, "E"); toilet_sink(); pop()
        ceiling_fixture(52.5, yc, .8, .4)

    # ───── освещение ─────
    for rect in [(0, 0, W, 16), (0, 16, W, 20), (0, 20, 12, 36), (12, 20, 22, 36), (22, 20, 31, 28), (22, 28, 31, 36),
                 (31, 20, 40, 28), (31, 28, 40, 36), (40, 20, 46, 36), (46, 20, 49, 36)]:
        ceiling_light_grid(rect, 4.6 if rect[2] - rect[0] > 12 else 4.2)


def wall_fixtures():
    """Розетки по периметру каждого помещения (мимо проёмов и углов), выключатели, пожарные извещатели."""
    M = pd_models
    off = .1 + .02
    for name, (x0, y0, x1, y1) in L.ROOMS.items():
        if name in ("cells",):
            continue
        for t in [x0 + 1.4 + k * 3.7 for k in range(int((x1 - x0 - 2.0) / 3.7) + 1)]:
            if t < x1 - .9 and not L.in_opening("x", y0, t, .45):
                M.outlet(t, y0 + off, 0, 1, .4)
            if t < x1 - .9 and not L.in_opening("x", y1, t + 1.0, .45) and name not in ("lobby",):
                M.outlet(t + 1.0, y1 - off, 0, -1, .4)
        for t in [y0 + 1.4 + k * 3.7 for k in range(int((y1 - y0 - 2.0) / 3.7) + 1)]:
            if t < y1 - .9 and not L.in_opening("y", x0, t, .45):
                M.outlet(x0 + off, t, 1, 0, .4)
            if t < y1 - .9 and not L.in_opening("y", x1, t + 1.0, .45):
                M.outlet(x1 - off, t + 1.0, -1, 0, .4)
    # выключатели у дверей кабинетов (внутри комнат)
    for d in (6.3, 17.3, 26.8, 35.8, 43.3):
        M.switch(d + .95, 20.1 + .02, 0, 1, 1.25)
    for x in (20.0, 46.0):
        M.fire_alarm(x, 16.12, 0, 1, 1.25)
    M.fire_alarm(10.0, 19.88, 0, -1, 1.25)
    M.fire_alarm(2.0, 15.88, 0, -1, 1.25)
    M.fire_alarm(54.0, 15.88, 0, -1, 1.25)


if __name__ == "__main__":
    build()
    wall_fixtures()
    assert len(L._stack) == 1, "несбалансированный push/pop"
    nv = L.write_files()
    print(f"faces={len(L.faces)} verts={nv} collision_boxes={len(L.boxes)} lights={len(L.fixtures)} "
          f"materials={len({m for m, *_ in L.faces})}")
