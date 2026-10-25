#!/usr/bin/env python3
"""Превью pd_interior.obj: вид сверху (без потолка). Нужен matplotlib."""
import os, sys
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

d = os.path.dirname(os.path.abspath(__file__))
mats, kd, v, polys, cur = {}, {}, [], [], None
name = None
for l in open(os.path.join(d, "pd_interior.mtl")):
    p = l.split()
    if p and p[0] == "newmtl": name = p[1]
    elif p and p[0] == "Kd": kd[name] = tuple(map(float, p[1:4]))
for l in open(os.path.join(d, "pd_interior.obj")):
    p = l.split()
    if not p: continue
    if p[0] == "v": v.append(tuple(map(float, p[1:4])))
    elif p[0] == "usemtl": cur = p[1]
    elif p[0] == "f": polys.append((cur, [v[int(i) - 1] for i in p[1:]]))

def render(path, elev, azim):
    fig = plt.figure(figsize=(12, 9)); ax = fig.add_subplot(111, projection="3d")
    sel = [(m, q) for m, q in polys if m != "ceiling" and not (m == "light")]
    ax.add_collection3d(Poly3DCollection([q for _, q in sel], facecolors=[kd[m] for m, _ in sel],
                                          edgecolors=(0, 0, 0, .15), linewidths=.3))
    ax.set_xlim(0, 36); ax.set_ylim(0, 26); ax.set_zlim(0, 36)
    ax.set_box_aspect((36, 26, 6)); ax.view_init(elev, azim); ax.set_axis_off()
    fig.savefig(path, dpi=110, bbox_inches="tight"); plt.close(fig)

render(os.path.join(d, "preview_top.png"), 90, -90)
