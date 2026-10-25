"""Детализированные модели мебели (замена простых версий из pd_lib).
Импортировать ДО pd_props: `import pd_models` подменяет функции в pd_lib."""
import math
import pd_lib as L
from pd_lib import *   # noqa: F401,F403

R = L.R


# ───────────── офисное кресло ─────────────
def office_chair(boss=False, mat="fabric_blue"):
    """Сидящий смотрит в +y. Эргономичное кресло: звезда, газлифт, механизм, анатомическая спинка."""
    for i in range(5):
        a = i * 2 * math.pi / 5 + .3
        push(0, 0, a)
        frustum(.03, 0, .105, .31, .026, .018, "plastic_black", 8, "x")        # луч звезды
        cyl(.34, 0, .0, .055, .02, "metal_dark", 8)                              # вилка
        cyl(.34, 0, .028, .056, .016, "chrome", 6)
        pop()
        push(0, 0, a)
        frustum(.34, -.012, .027, .024, .027, .027, "rubber", 10, "y")           # колесо
        pop()
    cyl(0, 0, .105, .15, .052, "plastic_black", 14)
    frustum(0, 0, .13, .26, .04, .03, "chrome", 12)                                 # газлифт
    frustum(0, 0, .15, .17, .06, .038, "plastic_black", 12)                         # кожух
    box(-.11, -.13, .385, .11, .13, .43, "plastic_black", bev=.012)               # механизм
    # сиденье (профиль с «водопадом»)
    seat = [(-.235, .43), (.19, .43), (.245, .445), (.265, .475), (.25, .505), (-.20, .515), (-.245, .495), (-.255, .455)]
    extrude_x(seat, -.255, .255, mat)
    extrude_x([(-.19, .515), (.2, .515), (.225, .525), (.2, .535), (-.17, .535)], -.215, .215, mat)
    # спинка: изогнутая оболочка
    bh = 1.04 if boss else .93
    n = 7
    front, back = [], []
    for k in range(n + 1):
        t = k / n
        y = -.235 - .075 * t ** 1.7 + .02 * math.sin(math.pi * t)
        z = .52 + (bh - .52) * t
        th = .032 + .012 * math.sin(math.pi * t)
        front.append((y + th * .5, z)); back.append((y - th * .5, z))
    extrude_x(front + back[::-1], -.225, .225, mat)
    box(-.17, -.325, .56, .17, -.295, .70, "plastic_black", bev=.01)               # поясничный кронштейн
    if boss:
        extrude_x([(-.30, 1.0), (-.25, 1.0), (-.255, 1.12), (-.31, 1.12)], -.14, .14, mat)   # подголовник
    box(-.02, -.31, .52, .02, -.28, .60, "plastic_black", bev=.006)
    for sx in (-1, 1):                                                              # подлокотники
        box(sx * .27 - .016, -.06, .5, sx * .27 + .016, -.03, .64, "plastic_black", bev=.008)
        box(sx * .27 - .03, -.15, .64, sx * .27 + .03, .12, .665, "leather" if boss else "plastic_black", bev=.012)
        box(sx * .262 - .008, -.2, .5, sx * .262 + .008, -.04, .53, "metal_dark", bev=.004)


# ───────────── монитор ─────────────
def monitor2(screen="screen_desktop", w=.56, h=.34):
    """Экран смотрит в -y; тонкая рамка, овальная подставка, шея, кабель."""
    cyl(0, .02, 0, .012, .105, "plastic_black", 20)
    cyl(0, .02, .012, .016, .085, "metal_dark", 20)
    box(-.03, .0, .016, .03, .035, .125, "plastic_black", bev=.008)
    box(-w / 2 - .01, -.008, .115, w / 2 + .01, .028, .115 + h + .018, "plastic_black", bev=.006)
    box(-w / 2 - .005, .02, .13, w / 2 + .005, .03, .115 + h + .01, "metal_dark", bev=.004)
    quad(screen, (-w / 2, -.0092, .125), (w / 2, -.0092, .125), (w / 2, -.0092, .125 + h), (-w / 2, -.0092, .125 + h))
    box(-.01, -.011, .109, .01, -.0092, .114, "plastic_white_flat") if "plastic_white_flat" in L.MATS else None
    frustum(0, .035, .1, .06, .006, .006, "plastic_black", 6, "y")                  # кабель


def keyboard_set():
    box(-.225, -.33, 0, .225, -.13, .014, "plastic_black", bev=.006)
    quad("keyboard", (-.21, -.32, .0145), (.21, -.32, .0145), (.21, -.145, .0145), (-.21, -.145, .0145), (0, 0, 1))
    box(.28, -.31, 0, .33, -.2, .008, "rubber", bev=.003)                           # коврик/мышь
    box(.285, -.27, .008, .325, -.215, .024, "plastic_black", bev=.012)
    box(-.45, -.1, 0, -.15, .08, .06, "plastic_black", bev=.012)                    # телефон
    box(-.42, -.06, .06, -.2, .04, .075, "plastic_black", bev=.006)
    frustum(-.15, -.0, .045, .0, 0, 0, "plastic_black", 3) if False else None


# ───────────── стол ─────────────
def _rounded_top(w, d, r=.05, seg=3):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def desk(w=1.6, d=.8, mat="wood_light", drawers=True, user_side="-"):
    """Центр в (0,0); пользователь со стороны -y. Верх 0.75."""
    extrude(_rounded_top(w, d, .045), .722, .75, mat)
    extrude(_rounded_top(w - .01, d - .01, .04), .70, .722, "metal_dark")
    L._record(-w / 2, -d / 2, 0, w / 2, d / 2, .75)
    box(-w / 2 + .05, d / 2 - .03, .12, w / 2 - .05, d / 2 - .012, .70, mat, bev=.006)       # царга/щит
    px = w / 2 - .46 if drawers else None
    if drawers:
        box(px, -d / 2 + .04, .06, w / 2 - .04, d / 2 - .04, .70, mat, True, bev=.008)
        for k in range(3):
            z0 = .1 + k * .2
            box(px + .015, -d / 2 + .028, z0, w / 2 - .055, -d / 2 + .042, z0 + .18, mat, bev=.006)
            cyl(px + .205, -d / 2 + .02, z0 + .14, z0 + .141, .001, "chrome", 3) if False else None
            box(px + .1, -d / 2 + .0, z0 + .135, px + .26, -d / 2 + .026, z0 + .15, "chrome", bev=.004)
        box(px, -d / 2 + .03, .02, w / 2 - .04, d / 2 - .04, .06, "metal_dark", bev=.004)
        # левая стойка — тумба-панель
        box(-w / 2 + .03, -d / 2 + .05, .0, -w / 2 + .06, d / 2 - .04, .70, mat, True, bev=.006)
        box(-w / 2 + .03, -d / 2 + .05, .0, -w / 2 + .05, d / 2 - .04, .03, "metal_dark", bev=.004)
    else:
        for sx in (-1, 1):
            box(sx * (w / 2 - .07) - .02, -d / 2 + .05, 0, sx * (w / 2 - .07) + .02, d / 2 - .05, .70, "metal_dark", True, bev=.006)
            box(sx * (w / 2 - .07) - .035, -d / 2 + .03, 0, sx * (w / 2 - .07) + .035, d / 2 - .03, .025, "metal_dark", bev=.006)
    # кабель-канал
    box(-w / 2 + .3, d / 2 - .1, .45, w / 2 - .5, d / 2 - .05, .5, "metal_dark", bev=.004)


# ───────────── растение: объёмные листья ─────────────
def _leaf(cx, cy, cz, az, length, width, elev, droop, mat="leaf_blade", segs=6):
    """Лист-лента: стартует под углом elev к горизонту, провисает; UV вдоль листа."""
    ca, sa = math.cos(az), math.sin(az)
    px, py = -sa, ca                                    # поперёк листа
    x, y, z = cx, cy, cz
    ang = elev
    ds = length / segs
    prev = None
    for k in range(segs + 1):
        t = k / segs
        wd = width * (math.sin(math.pi * min(1.0, .12 + .88 * (1 - (1 - t) ** 1.0))) ** .7) * (1 - .15 * t)
        wd = max(wd, .002)
        left = (x - px * wd, y - py * wd, z)
        right = (x + px * wd, y + py * wd, z)
        cur = (left, right, t)
        if prev:
            (l0, r0, t0), (l1, r1, t1) = prev, cur
            nrm = (-sa * 0 + ca * math.sin(ang) * .0 + (ca) * .0, 0, 1)
            fold = .004
            mid0 = ((l0[0] + r0[0]) / 2, (l0[1] + r0[1]) / 2, (l0[2] + r0[2]) / 2 + fold)
            mid1 = ((l1[0] + r1[0]) / 2, (l1[1] + r1[1]) / 2, (l1[2] + r1[2]) / 2 + fold)
            face(mat, [l0, mid0, mid1, l1], None, [(0, t0), (.5, t0), (.5, t1), (0, t1)])
            face(mat, [mid0, r0, r1, mid1], None, [(.5, t0), (1, t0), (1, t1), (.5, t1)])
            face(mat, [l1, mid1, mid0, l0], None, [(0, t1), (.5, t1), (.5, t0), (0, t0)])
            face(mat, [mid1, r1, r0, mid0], None, [(.5, t1), (1, t1), (1, t0), (.5, t0)])
        prev = cur
        x += ca * math.cos(ang) * ds
        y += sa * math.cos(ang) * ds
        z += math.sin(ang) * ds
        ang -= droop / segs


def plant(h=1.2, pot=.28):
    """Драцена/фикус: горшок с каймой, грунт, ствол, ~34 объёмных листа."""
    frustum(0, 0, 0, .36, pot * .74, pot, "pot", 20)
    frustum(0, 0, .36, .035, pot * 1.04, pot * 1.04, "pot", 20)
    frustum(0, 0, .335, .0, pot * .96, pot * .96, "soil", 20, caps=True)
    cyl(0, 0, .335, .365, pot * .94, "soil", 20)
    for _ in range(9):
        a = R.uniform(0, 6.28); rr = R.uniform(.05, pot * .8)
        sphere(math.cos(a) * rr, math.sin(a) * rr, .372, R.uniform(.012, .022), "pot", 4)
    trunk_top = .35 + h * .55
    frustum(0, 0, .365, trunk_top - .365, .022, .014, "wood_dark", 8)
    n = 34
    for i in range(n):
        az = i * 2.399 + R.uniform(-.2, .2)
        t = i / n
        zb = trunk_top - .05 - (1 - t) * h * .28
        elev = math.radians(R.uniform(35, 80) - (1 - t) * 30)
        L_ = h * R.uniform(.42, .62) * (.7 + .3 * t)
        _leaf(0, 0, zb, az, L_, R.uniform(.026, .04), elev, R.uniform(.9, 1.7))
    for i in range(7):                                                              # верхушка
        _leaf(0, 0, trunk_top, i * 0.9, h * .3, .03, math.radians(R.uniform(70, 85)), .6)


# ───────────── двери ─────────────
def door_frame(axis, c, d, w, mat="wood_dark"):
    """Наличник с обеих сторон + короб."""
    t, dep = .075, T + .1
    z = DOOR_H + .075
    def B(x0, y0, z0, x1, y1, z1):
        box(x0, y0, z0, x1, y1, z1, mat, bev=.008)
    if axis == "x":
        B(d - w / 2 - t, c - dep / 2, 0, d - w / 2, c + dep / 2, z)
        B(d + w / 2, c - dep / 2, 0, d + w / 2 + t, c + dep / 2, z)
        B(d - w / 2 - t, c - dep / 2, DOOR_H, d + w / 2 + t, c + dep / 2, z)
    else:
        B(c - dep / 2, d - w / 2 - t, 0, c + dep / 2, d - w / 2, z)
        B(c - dep / 2, d + w / 2, 0, c + dep / 2, d + w / 2 + t, z)
        B(c - dep / 2, d - w / 2 - t, DOOR_H, c + dep / 2, d + w / 2 + t, z)


def _lever(width, th):
    for sgn in (1, -1):
        y = sgn * (th / 2)
        frustum(width - .09, y, .96, sgn * .012, .028, .028, "chrome", 14, "y")
        frustum(width - .09, y + sgn * .012, .96, sgn * .045, .009, .009, "chrome", 8, "y")
        box(width - .09 - .125 * 0 - .12, y + sgn * .05 - .008, .954, width - .09 + .01, y + sgn * .05 + .008, .974, "chrome", bev=.005)
    box(width - .075, -th / 2 - .004, .86, width - .045, th / 2 + .004, .905, "chrome", bev=.004)   # цилиндр замка


def leaf(width, kind):
    """Створка вдоль +x от шарнира (0,0): панели, петли, ручка-рычаг, доводчик."""
    th = .045
    for hz in (.25, 1.1, 1.95):                                                      # петли
        cyl(.006, 0, hz, hz + .1, .011, "chrome", 8)
    if kind == "wood":
        box(0, -th / 2, .02, width, th / 2, DOOR_H - .01, "wood_light", bev=.006)
        for z0, z1 in ((.18, 1.0), (1.2, 2.12)):
            for sg in (-1, 1):
                box(.13, sg * th / 2 - (0 if sg > 0 else .008), z0, width - .13, sg * th / 2 + (.008 if sg > 0 else 0), z1, "wood_dark", bev=.004)
                box(.17, sg * th / 2 + sg * .008 - (0 if sg > 0 else .004), z0 + .05, width - .17, sg * th / 2 + sg * .008 + (.004 if sg > 0 else 0), z1 - .05, "wood_light", bev=.003)
    elif kind == "metal":
        box(0, -th / 2, .02, width, th / 2, DOOR_H - .01, "metal", bev=.006)
        box(0, -th / 2 - .003, .02, width, th / 2 + .003, .22, "metal_dark", bev=.003)             # отбойная пластина
        box(.28, -th / 2 - .02, 1.3, width - .28, th / 2 + .02, 1.9, "metal_dark", bev=.01)        # рамка окошка
        box(.32, -.008, 1.34, width - .32, .008, 1.86, "glass")
        for z in (.7, 1.0):
            box(.04, th / 2, z, .07, th / 2 + .012, z + .15, "metal_dark", bev=.004)
        box(width - .13, -th / 2 - .02, .35, width - .06, th / 2 + .02, .45, "chrome", bev=.004)   # накладка
    elif kind == "glass":
        w = .075
        box(0, -.03, .02, w, .03, DOOR_H - .01, "chrome", bev=.006)
        box(width - w, -.03, .02, width, .03, DOOR_H - .01, "chrome", bev=.006)
        box(0, -.03, .02, width, .03, .2, "chrome", bev=.006)
        box(0, -.03, DOOR_H - .12, width, .03, DOOR_H - .01, "chrome", bev=.006)
        box(w, -.006, .2, width - w, .006, DOOR_H - .12, "glass")
        for sg in (-1, 1):                                                          # тяговая ручка-труба
            cyl(width - .12, sg * .07, .85, 1.45, .016, "chrome", 10)
            for z in (.9, 1.4):
                frustum(width - .12, sg * .03, z, sg * .04, .008, .008, "chrome", 6, "y")
        return
    _lever(width, th)
    box(width * .35, -th / 2 - .01, DOOR_H - .1, width * .85, -th / 2 + .01, DOOR_H - .06, "metal_dark", bev=.003) if False else None


def ceiling_fixture(x, y, w=1.2, d=.6):
    """Потолочный светильник-тroffer: корпус, утопленная линза с призматикой."""
    box(x - w / 2 - .035, y - d / 2 - .035, H - .07, x + w / 2 + .035, y + d / 2 + .035, H - .045, "fixture_frame", bev=.006)
    box(x - w / 2 - .01, y - d / 2 - .01, H - .075, x + w / 2 + .01, y + d / 2 + .01, H - .07, "fixture_dark", bev=0)
    box(x - w / 2, y - d / 2, H - .082, x + w / 2, y + d / 2, H - .075, "light", bev=0)
    for k in range(1, 6):
        box(x - w / 2, y - d / 2 + k * d / 6 - .004, H - .086, x + w / 2, y - d / 2 + k * d / 6 + .004, H - .082, "fixture_frame", bev=0)
    L.fixtures.append((x, y, H - .35))


# ───────────── подмена в pd_lib ─────────────
for _n in ("office_chair", "monitor2", "keyboard_set", "desk", "plant", "door_frame", "leaf", "ceiling_fixture"):
    setattr(L, _n, globals()[_n])
L.MATS["leaf_blade"] = ("leaf_blade", (1, 1, 1), 1.0, .6, 0, {"double": True})
L.MATS["pot"] = ("concrete", (.82, .8, .76), 1.0, .6, 0, {})


# ───────────── розетки, выключатели, пожарка ─────────────
def outlet(x, y, nx, ny, z=.4, double=True):
    ang = math.atan2(ny, nx) - math.pi / 2
    push(x + nx * .003, y + ny * .003, ang)
    box(-.035, -.003, z, .035, .004, z + .115, "plastic_white", bev=.003)
    for dz in ((.03, .075) if double else (.055,)):
        box(-.012, .004, z + dz, .012, .0045, z + dz + .02, "plastic_black", bev=0)
    pop()


def switch(x, y, nx, ny, z=1.2):
    ang = math.atan2(ny, nx) - math.pi / 2
    push(x + nx * .003, y + ny * .003, ang)
    box(-.03, -.003, z, .03, .003, z + .1, "plastic_white", bev=.003)
    box(-.009, .003, z + .035, .009, .008, z + .07, "plastic_white", bev=.004)
    pop()


def fire_alarm(x, y, nx, ny, z=1.3):
    ang = math.atan2(ny, nx) - math.pi / 2
    push(x + nx * .003, y + ny * .003, ang)
    box(-.05, -.004, z, .05, .03, z + .12, "red", bev=.006)
    box(-.025, .03, z + .04, .025, .036, z + .08, "plastic_white", bev=.003)
    box(-.06, -.004, z + .25, .06, .05, z + .35, "plastic_white", bev=.008)           # стробоскоп
    pop()
