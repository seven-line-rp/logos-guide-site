"""Дополнительный реквизит для интерьера LSPD (поверх pd_lib)."""
import math
import pd_lib as L
from pd_lib import *   # noqa: F401,F403  (face, box, place, push, pop, MATS, R, H ...)

lift = L._lift


def decal(cx, cy, w, d, mat, ang=0.0, z=.04):
    """Плоская картинка на полу (печать, коврик)."""
    push(cx, cy, ang)
    face(mat, [(-w / 2, -d / 2, z), (w / 2, -d / 2, z), (w / 2, d / 2, z), (-w / 2, d / 2, z)], (0, 0, 1),
         [(0, 0), (1, 0), (1, 1), (0, 1)])
    pop()


def waiting_chairs(n=3):
    """Ряд чёрных кресел ожидания; сидящий смотрит в +y."""
    w = .56
    Lw = n * w
    box(0, -.03, .30, Lw, .03, .34, "metal_dark", True)
    for k in range(n + 1):
        sx = k * w
        box(sx - .015, -.34, 0, sx + .015, .0, .30, "metal_dark")
        box(sx - .02, -.36, 0, sx + .02, -.30, .03, "metal_dark")
    for i in range(n):
        x0 = i * w + .035
        box(x0, -.27, .40, x0 + .49, .24, .46, "leather", True)
        box(x0 + .02, -.27, .46, x0 + .47, .22, .50, "leather")
        box(x0, -.31, .46, x0 + .49, -.25, .94, "leather")
        box(x0 + .03, -.32, .55, x0 + .46, -.31, .86, "plastic_black")
    for k in range(n + 1):
        sx = k * w
        box(sx - .02, -.26, .46, sx + .02, .16, .62, "plastic_black")
    return Lw


def stanchion(x, y, h=.95):
    cyl(x, y, 0, .02, .15, "chrome", 14)
    cyl(x, y, .02, h, .022, "chrome", 8)
    sphere(x, y, h + .02, .035, "chrome", 5)


def rope(x0, y0, x1, y1, z=.82, sag=.12, n=8):
    for i in range(n):
        u0, u1 = i / n, (i + 1) / n
        ax, ay = x0 + (x1 - x0) * u0, y0 + (y1 - y0) * u0
        bx, by = x0 + (x1 - x0) * u1, y0 + (y1 - y0) * u1
        za = z - sag * 4 * u0 * (1 - u0); zb = z - sag * 4 * u1 * (1 - u1)
        ln = math.hypot(bx - ax, by - ay)
        ang = math.atan2(by - ay, bx - ax)
        push((ax + bx) / 2, (ay + by) / 2, ang)
        box(-ln / 2 - .01, -.012, min(za, zb) - .012, ln / 2 + .01, .012, max(za, zb) + .012, "rope_red")
        pop()


def monitor2(screen="screen_desktop", w=.56, h=.34):
    """Экран смотрит в -y."""
    cyl(0, 0, .0, .015, .11, "plastic_black", 10)
    box(-.025, -.025, .015, .025, .02, .12, "plastic_black")
    box(-w / 2 - .015, -.02, .12, w / 2 + .015, .02, .12 + h + .03, "plastic_black")
    quad(screen, (-w / 2, -.0225, .135), (w / 2, -.0225, .135), (w / 2, -.0225, .135 + h), (-w / 2, -.0225, .135 + h))


def mug(x, y, z):
    cyl(x, y, z, z + .09, .04, "plastic_white", 10)
    box(x + .035, y - .01, z + .03, x + .06, y + .01, z + .07, "plastic_white")


def phone(x, y, z):
    box(x - .1, y - .09, z, x + .1, y + .09, z + .05, "plastic_black")
    box(x - .12, y - .03, z + .05, x + .12, y + .03, z + .075, "plastic_black")


def pc_tower():
    box(-.1, -.22, 0, .1, .22, .42, "plastic_black", True)
    box(-.1, -.225, .3, .1, -.22, .38, "metal_dark")


def printer():
    box(-.3, -.25, 0, .3, .25, .3, "plastic_white", True)
    box(-.28, -.27, .12, .28, -.22, .2, "metal_dark")
    box(-.26, -.2, .3, .26, .2, .34, "plastic_white")
    box(-.2, -.1, .34, .2, .1, .345, "paper")


def station(x, y, face, w=1.7, monitors=2, boss=False, chair="fabric_blue", screens=None):
    """Рабочее место: стол + мониторы + клавиатура + телефон + кружка + кресло."""
    place(x, y, face)
    desk(w, .8, "wood_dark" if boss else "wood_light")
    screens = screens or ["screen_desktop"] * monitors
    n = len(screens)
    for i, sc in enumerate(screens):
        ox = (i - (n - 1) / 2) * .6
        push(ox - .05, .12, 0); lift(.75, monitor2, sc); pop()
    push(-.05, -.05, 0); lift(.75, keyboard_set); pop()
    push(-w / 2 + .18, .24, 0); lift(.75, desk_lamp); pop()
    mug(w / 2 - .6, -.12, .75)
    box(.5, -.1, .75, .75, .12, .77, "paper"); box(.52, -.08, .77, .77, .14, .79, "paper")
    push(-w / 2 + .35, -.1, 0); pc_tower(); pop()
    push(0, -.95, 0); office_chair(boss, chair); pop()
    pop()


def conference_table(Lw=6.0, Wd=1.6):
    """Стол-«бочка» со скруглёнными углами; центр в (0,0)."""
    c = .35
    poly = [(-Lw / 2 + c, -Wd / 2), (Lw / 2 - c, -Wd / 2), (Lw / 2, -Wd / 2 + c), (Lw / 2, Wd / 2 - c),
            (Lw / 2 - c, Wd / 2), (-Lw / 2 + c, Wd / 2), (-Lw / 2, Wd / 2 - c), (-Lw / 2, -Wd / 2 + c)]
    extrude(poly, .72, .76, "wood_dark")
    L._record(-Lw / 2, -Wd / 2, 0, Lw / 2, Wd / 2, .76)
    for sx in (-1, 1):
        box(sx * (Lw / 2 - .8) - .25, -.3, 0, sx * (Lw / 2 - .8) + .25, .3, .72, "wood_dark")
    box(-Lw / 2 + .8, -.04, .1, Lw / 2 - .8, .04, .6, "wood_dark")
    # центральные розетки/микрофоны
    for k in range(3):
        box(-1.5 + k * 1.5 - .1, -.08, .76, -1.5 + k * 1.5 + .1, .08, .78, "plastic_black")


def wall_tv(w=1.6, h=.9, screen="screen_cctv"):
    """Телевизор на стене; смотрит в -y (стена в +y)."""
    box(-w / 2 - .02, 0, 0, w / 2 + .02, .06, h + .04, "plastic_black")
    quad(screen, (-w / 2, -.002, .02), (w / 2, -.002, .02), (w / 2, -.002, h + .02), (-w / 2, -.002, h + .02))


def cctv_dome(x, y, z):
    frustum(x, y, z, .06, .12, .12, "plastic_white", 12)
    frustum(x, y, z - .08, .08, .06, .12, "glass", 12)
    sphere(x, y, z - .02, .07, "plastic_black", 5)


def cctv_wall(x, y, nx, ny, z=2.85):
    """Камера на кронштейне, смотрит от стены (nx,ny)."""
    ang = math.atan2(ny, nx)
    push(x, y, ang)
    box(0, -.03, z - .02, .12, .03, z + .02, "metal_dark")
    box(.12, -.05, z - .06, .4, .05, z + .04, "plastic_white")
    cyl(.38, 0, z - .03, z + .0, .035, "plastic_black", 8)
    pop()


def sprinkler(x, y):
    cyl(x, y, H - .05, H, .025, "chrome", 8)
    cyl(x, y, H - .07, H - .05, .04, "chrome", 8)


def trash_can(r=.16, h=.5):
    frustum(0, 0, 0, h, r * .85, r, "metal", 12)
    cyl(0, 0, h, h + .015, r * 1.02, "metal_dark", 12)


def coffee_station():
    box(-.9, -.3, 0, .9, .3, .9, "wood_dark", True)
    box(-.92, -.32, .9, .92, .32, .94, "granite")
    box(-.7, -.2, .94, -.35, .15, 1.28, "plastic_black")       # кофемашина
    box(-.68, -.22, 1.0, -.37, -.2, 1.24, "metal")
    cyl(.2, 0, .94, 1.12, .09, "plastic_white", 10)
    for k in range(3):
        mug(.45 + k * .15, -.05, .94)


def a_frame_sign():
    """Жёлтая табличка 'мокрый пол'."""
    for sg in (-1, 1):
        box(-.14, sg * .16 - .008, 0, .14, sg * .16 + .008, .6, "caution")
    box(-.14, -.17, .6, .14, .17, .62, "caution")


def evidence_cage(w=3.0, h=2.5):
    k = 0.0
    while k <= w:
        box(k - .01, -.01, 0, k + .01, .01, h, "bars")
        k += .1
    box(0, -.02, h - .06, w, .02, h, "bars"); box(0, -.02, 1.0, w, .02, 1.04, "bars")


def toilet():
    """Спинкой к +y (стене), фронт в -y."""
    box(-.2, .05, 0, .2, .25, .4, "plastic_white", True)
    frustum(0, -.1, .12, .3, .17, .2, "plastic_white", 14)
    box(-.17, .05, .4, .17, .22, .85, "plastic_white")
    box(-.04, .03, .88, .04, .06, .92, "chrome")


def sink(w=.5):
    box(-w / 2, -.25, .8, w / 2, .15, .86, "plastic_white", True)
    box(-w / 2 + .05, -.2, .79, w / 2 - .05, .1, .8, "plastic_white")
    cyl(0, .12, .86, 1.0, .015, "chrome", 6)
    box(-.015, .0, .98, .015, .13, 1.0, "chrome")


def urinal():
    box(-.2, 0, .55, .2, .22, 1.2, "plastic_white", True)
    box(-.15, -.05, .6, .15, 0, 1.0, "plastic_white")


def stall_partition(depth=1.6, h=1.85):
    """Перегородка кабинки вдоль +y от стены; зазор снизу."""
    box(-.015, 0, .15, .015, depth, h, "metal")


def stall_door(w=.82, h=1.85):
    box(0, -.015, .15, w, .015, h, "metal")
    box(w - .12, -.03, .95, w - .06, 0, 1.0, "chrome")


def hand_dryer():
    box(-.15, 0, 0, .15, .2, .35, "metal")


def hang_picture(x, y, nx, ny, w, h, z0, mat):
    pic_frame(x, y, nx, ny, w, h, z0, mat)


def notice_stack(x, y, nx, ny):
    wall_plane(x, y, nx, ny, 1.3, 1.25, 2.2, "noticeboard", .004)


def exit_sign(x, y, nx, ny, z=2.7):
    wall_plane(x, y, nx, ny, .8, z, z + .2, "exit_light", .004)


def desk_phone_cluster():
    pass


def ceiling_light_grid(rect, spacing=4.6, w=1.2, d=.6):
    x0, y0, x1, y1 = rect
    nx = max(1, round((x1 - x0) / spacing)); ny = max(1, round((y1 - y0) / spacing))
    for i in range(nx):
        for j in range(ny):
            cx = x0 + (i + .5) * (x1 - x0) / nx
            cy = y0 + (j + .5) * (y1 - y0) / ny
            ceiling_fixture(cx, cy, w, d)
            sprinkler(cx + 1.4, cy + 1.2) if x1 - x0 > 5 else None


def label(axis, c, side, d, mat, w=1.2, z=2.45):
    """Табличка над дверью: side=+1/-1 — сторона стены."""
    if axis == "x":
        wall_plane(d, c + side * (T / 2 + .02), 0, side, w, z, z + w / 4, mat, .004)
    else:
        wall_plane(c + side * (T / 2 + .02), d, side, 0, w, z, z + w / 4, mat, .004)


def credenza(w=2.2):
    """Низкий шкаф вдоль стены; фронт в -y."""
    box(0, 0, 0, w, .5, .78, "wood_dark", True)
    for i in range(int(w / .55)):
        box(.04 + i * .55, -.012, .06, .53 + i * .55, 0, .72, "wood_light")
        box(.22 + i * .55, -.025, .4, .35 + i * .55, -.012, .43, "gold")
    box(-.03, -.03, .78, w + .03, .53, .81, "granite")


def globe():
    cyl(0, 0, 0, .03, .1, "gold", 10)
    box(-.01, -.01, .03, .01, .01, .22, "gold")
    sphere(0, 0, .34, .14, "fabric_blue", 8)


def tripod_camera():
    for a in (0, 2.1, 4.2):
        push(0, 0, a); box(0, -.015, 0, .5, .015, .02, "metal_dark"); pop()
    cyl(0, 0, .02, 1.3, .015, "metal_dark", 6)
    box(-.09, -.15, 1.3, .09, .15, 1.48, "plastic_black")
    frustum(0, .15, 1.39, .12, .05, .06, "plastic_black", 10, "y")


def sink_counter(n=3):
    """Раковины у стены (+y), фронт -y."""
    box(0, 0, 0, n * .9, .55, .8, "wood_dark", True)
    box(-.02, -.02, .8, n * .9 + .02, .57, .84, "granite")
    for i in range(n):
        push(.45 + i * .9, .0, 0); box(-.2, -.2, .84, .2, .2, .86, "metal"); cyl(0, .22, .86, 1.0, .015, "chrome", 6); pop()
