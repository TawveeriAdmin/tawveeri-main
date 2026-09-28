"""Illustrated cast v2: expressive appliances with arms/legs, the groom (stand/sit poses),
props (budget bar, ropes, bubbles) and effects (sweat, dust, stars, motion lines)."""
from __future__ import annotations

import math

from common import (
    BOLD, GOLD, GOLD_DARK, GREEN, GREEN_DEEP, HEAD, INK, INK_SOFT, MED, MINT, RED,
    RED_DEEP, SKIN, SKIN_DARK, STEEL, STEEL_DARK, WHITE, Canvas, clamp, font, lerp, rgba,
)

ROPE = (184, 137, 79)
ROPE_DARK = (140, 98, 50)
GLASS = (58, 76, 88)
SWEAT = (120, 190, 235)
CLOTH_EDGE = (205, 210, 208)
BEARD = (60, 44, 34)


# ======================================================================================
# effects
# ======================================================================================
def draw_sweat(c: Canvas, x, y, s, layer, k=1.0):
    """Teardrop; k animates the fall (0..1)."""
    if k <= 0:
        return
    y = y + 26 * s * k
    r = 8 * s * (1 - 0.3 * k)
    c.poly([(x, y - r * 2.2), (x - r, y - r * 0.2), (x + r, y - r * 0.2)], SWEAT, layer=layer)
    c.circle(x, y, r, SWEAT, layer=layer)
    c.circle(x - r * 0.3, y - r * 0.2, r * 0.3, WHITE, layer=layer)


def draw_motion_lines(c: Canvas, x, y, dirx, diry, s, layer, n=3, length=60, alpha=170):
    """Speed lines trailing opposite to (dirx, diry)."""
    L = math.hypot(dirx, diry) or 1
    ux, uy = dirx / L, diry / L
    px, py = -uy, ux
    for i in range(n):
        off = (i - (n - 1) / 2) * 22 * s
        x0, y0 = x + px * off - ux * 10 * s, y + py * off - uy * 10 * s
        ln = length * s * (1 - 0.25 * abs(i - (n - 1) / 2))
        c.line([(x0, y0), (x0 - ux * ln, y0 - uy * ln)], rgba(INK, alpha), 5 * s, layer)


def draw_dust(c: Canvas, x, y, s, layer, k=1.0, spread=1.0):
    """Puff of dust that expands and fades with k (0..1)."""
    if k <= 0 or k >= 1:
        return
    a = int(200 * (1 - k) ** 1.5)
    for i, (dx, dy, r) in enumerate([(-1.0, -0.2, 26), (-0.5, -0.6, 22), (0.2, -0.7, 28),
                                      (0.8, -0.3, 22), (1.2, 0.0, 18), (-1.3, 0.1, 16)]):
        rx = x + dx * (40 + 90 * k) * s * spread
        ry = y + dy * (20 + 40 * k) * s
        rr = r * s * (0.6 + 0.8 * k)
        c.circle(rx, ry, rr, rgba((214, 206, 190), a), layer=layer)


def draw_star(c: Canvas, x, y, r, layer, color=GOLD, rot=0.0):
    pts = []
    for i in range(10):
        ang = rot + i * math.pi / 5 - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((x + rr * math.cos(ang), y + rr * math.sin(ang)))
    c.poly(pts, color, outline=GOLD_DARK, width=2, layer=layer)


def draw_dizzy_stars(c: Canvas, cx, cy, t, s, layer, n=4, rx=95, ry=28):
    for i in range(n):
        ang = t * 4.2 + i * 2 * math.pi / n
        x = cx + rx * s * math.cos(ang)
        y = cy + ry * s * math.sin(ang)
        depth = 0.7 + 0.3 * math.sin(ang)
        draw_star(c, x, y, 16 * s * depth, layer, rot=t * 3 + i)


def draw_skid(c: Canvas, x, y, dirx, s, layer, k=1.0):
    """Skid marks under a foot being dragged toward dirx (+1 right / -1 left)."""
    if k <= 0:
        return
    for i in range(3):
        yy = y + (i - 1) * 7 * s
        L = (30 + 30 * k) * s
        c.line([(x, yy), (x - dirx * L, yy)], rgba(INK_SOFT, int(160 * k)), 3 * s, layer)


def floor_shadow(c: Canvas, cx, cy, w, layer, alpha=55):
    c.ellipse(cx - w / 2, cy - w * 0.09, cx + w / 2, cy + w * 0.09, rgba(INK, alpha), layer=layer)


# ======================================================================================
# faces
# ======================================================================================
def _eye(c: Canvas, ex, ey, r, expr, layer, body, pupil=(0.0, 0.0)):
    if expr == "happy":
        c.arc(ex - r, ey - r * 0.6, ex + r, ey + r * 1.2, 200, 340, INK, max(3, r * 0.28), layer)
        return
    if expr == "effort":
        # squeezed shut: > <  style chevrons
        c.line([(ex - r * 0.9, ey - r * 0.6), (ex, ey), (ex - r * 0.9, ey + r * 0.6)], INK, max(3, r * 0.25), layer)
        return
    if expr == "dizzy":
        for k in range(3):
            rr = r * (0.95 - k * 0.3)
            c.arc(ex - rr, ey - rr, ex + rr, ey + rr, 20 + k * 120, 300 + k * 120, INK, max(2, r * 0.18), layer)
        return
    R = r * (1.28 if expr in ("shocked", "shout") else 1.0)
    c.circle(ex, ey, R, WHITE, outline=INK, width=max(2, r * 0.16), layer=layer)
    pr = R * (0.28 if expr == "shocked" else 0.48)
    px = ex + pupil[0] * R * 0.45
    py = ey + pupil[1] * R * 0.4 + (R * 0.12 if expr == "angry" else 0)
    c.circle(px, py, pr, INK, layer=layer)
    c.circle(px - pr * 0.35, py - pr * 0.35, pr * 0.32, WHITE, layer=layer)
    # eyelids
    lid = {"angry": 0.38, "sad": 0.3, "smug": 0.5, "relaxed": 0.12}.get(expr, 0.0)
    if lid > 0:
        top = ey - R
        cut = top + 2 * R * lid
        c.poly([(ex - R - 2, top - 4), (ex + R + 2, top - 4), (ex + R + 2, cut), (ex - R - 2, cut)], body, layer=layer)
        c.arc(ex - R, ey - R, ex + R, ey + R, 180, 360, INK, max(2, r * 0.16), layer)


def draw_face(c: Canvas, cx, cy, s, expr, layer, eye_gap=60, eye_r=17, mouth_dy=34, pupil=(0.0, 0.0),
              body=WHITE, brow=True, sweat=0.0, sweat_side=1):
    exl, exr = cx - eye_gap * s, cx + eye_gap * s
    ey = cy - 8 * s
    r = eye_r * s
    _eye(c, exl, ey, r, expr, layer, body, pupil)
    if expr == "effort":
        # mirror chevron for the right eye
        c.line([(exr + r * 0.9, ey - r * 0.6), (exr, ey), (exr + r * 0.9, ey + r * 0.6)], INK, max(3, r * 0.25), layer)
    else:
        _eye(c, exr, ey, r, expr, layer, body, pupil)
    bw = max(3, 3.8 * s)
    if brow:
        if expr in ("angry", "shout", "effort"):
            c.line([(exl - r, ey - r * 1.55), (exl + r * 0.9, ey - r * 0.75)], INK, bw, layer)
            c.line([(exr + r, ey - r * 1.55), (exr - r * 0.9, ey - r * 0.75)], INK, bw, layer)
        elif expr in ("sad", "shocked", "dizzy"):
            c.line([(exl - r, ey - r * 1.1), (exl + r, ey - r * 1.7)], INK, bw, layer)
            c.line([(exr + r, ey - r * 1.1), (exr - r, ey - r * 1.7)], INK, bw, layer)
        elif expr == "smug":
            c.line([(exl - r, ey - r * 1.35), (exl + r, ey - r * 1.55)], INK, bw, layer)
            c.line([(exr + r, ey - r * 1.35), (exr - r, ey - r * 1.55)], INK, bw, layer)
        else:
            c.line([(exl - r, ey - r * 1.55), (exl + r, ey - r * 1.55)], INK, bw, layer)
            c.line([(exr - r, ey - r * 1.55), (exr + r, ey - r * 1.55)], INK, bw, layer)
    # mouth
    my = cy + mouth_dy * s
    mw = 26 * s
    if expr == "shout":
        c.ellipse(cx - mw * 0.85, my - mw * 0.7, cx + mw * 0.85, my + mw * 1.0, INK, layer=layer)
        c.ellipse(cx - mw * 0.5, my + mw * 0.3, cx + mw * 0.5, my + mw * 0.95, RED, layer=layer)
    elif expr == "shocked":
        c.ellipse(cx - mw * 0.45, my - mw * 0.3, cx + mw * 0.45, my + mw * 0.8, INK, layer=layer)
    elif expr == "effort":
        c.rect(cx - mw, my - mw * 0.35, cx + mw, my + mw * 0.35, WHITE, radius=6 * s, outline=INK, width=bw * 0.8, layer=layer)
        for i in range(1, 4):
            x = cx - mw + i * mw / 2
            c.line([(x, my - mw * 0.35), (x, my + mw * 0.35)], INK, 2 * s, layer)
    elif expr == "angry":
        c.arc(cx - mw, my, cx + mw, my + mw * 1.5, 200, 340, INK, bw, layer)
    elif expr == "sad":
        c.arc(cx - mw, my, cx + mw, my + mw * 1.7, 200, 340, INK, bw, layer)
        draw_sweat(c, exr + r * 0.2, ey + r * 1.3, s * 0.7, layer, k=0.5)  # a tear
    elif expr == "dizzy":
        pts = [(cx - mw + i * mw / 3, my + (mw * 0.25 if i % 2 else -mw * 0.25)) for i in range(7)]
        c.line(pts, INK, bw, layer)
    elif expr == "happy":
        c.arc(cx - mw * 1.1, my - mw * 1.2, cx + mw * 1.1, my + mw * 0.6, 15, 165, INK, bw, layer)
        c.ellipse(cx - mw * 0.55, my - mw * 0.05, cx + mw * 0.55, my + mw * 0.55, INK, layer=layer)
    elif expr in ("relaxed", "smug"):
        c.arc(cx - mw, my - mw * 1.1, cx + mw, my + mw * 0.4, 20, 160, INK, bw, layer)
    else:
        c.line([(cx - mw * 0.6, my), (cx + mw * 0.6, my)], INK, bw, layer)
    if sweat > 0:
        draw_sweat(c, cx + sweat_side * (eye_gap + 34) * s, ey - r * 1.2, s, layer, k=sweat)


# ======================================================================================
# appliances
# ======================================================================================
def _limbs(c: Canvas, cx, cy, w, h, s, layer, hands, legs, lean_dir, body):
    """Stick arms toward the hand targets, and legs planted (bracing away from lean_dir)."""
    if legs != "none":
        spread = 0.28 if legs == "brace" else 0.22
        for side in (-1, 1):
            hx = cx + side * w * spread
            fy = cy + h / 2 + 34 * s
            fx = hx - lean_dir * 26 * s * (1 if legs == "brace" else 0.3)
            c.line([(hx, cy + h / 2 - 8 * s), (fx, fy)], STEEL_DARK, 12 * s, layer)
            c.rect(fx - 20 * s, fy - 8 * s, fx + 20 * s, fy + 8 * s, INK, radius=7 * s, layer=layer)
    if hands:
        for i, (tx, ty) in enumerate(hands):
            side = -1 if tx < cx else 1
            ax, ay = cx + side * w / 2, cy - h * 0.05
            c.line([(ax, ay), (tx, ty)], STEEL_DARK, 16 * s, layer)
            c.line([(ax, ay), (tx, ty)], body, 10 * s, layer)
            c.circle(tx, ty, 17 * s, body, outline=STEEL_DARK, width=3 * s, layer=layer)


def _ac_body(c, cx, cy, s, sx, sy, expr, layer, pupil, sweat, hands, legs, lean_dir):
    w, h = 340 * s * sx, 128 * s * sy
    _limbs(c, cx, cy, w, h, s, layer, hands, legs, lean_dir, WHITE)
    c.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, WHITE, radius=26 * s,
           outline=STEEL_DARK, width=3 * s, layer=layer)
    c.rect(cx - w / 2 + 6 * s, cy - h / 2 + 6 * s, cx + w / 2 - 6 * s, cy - h / 2 + 30 * s,
           STEEL, radius=18 * s, layer=layer)
    c.rect(cx - w / 2 + 14 * s, cy + h / 2 - 34 * s, cx + w / 2 - 14 * s, cy + h / 2 - 14 * s,
           STEEL, radius=8 * s, outline=STEEL_DARK, width=2 * s, layer=layer)
    for i in range(1, 6):
        x = cx - w / 2 + 14 * s + i * (w - 28 * s) / 6
        c.line([(x, cy + h / 2 - 32 * s), (x, cy + h / 2 - 16 * s)], STEEL_DARK, 2 * s, layer)
    c.circle(cx + w / 2 - 34 * s, cy - h / 2 + 18 * s, 5 * s, MINT, layer=layer)
    draw_face(c, cx, cy - 6 * s, s, expr, layer, eye_gap=54, eye_r=15, mouth_dy=26, pupil=pupil,
              body=WHITE, sweat=sweat, sweat_side=-1)


def _fridge_body(c, cx, cy, s, sx, sy, expr, layer, pupil, sweat, hands, legs, lean_dir):
    w, h = 220 * s * sx, 340 * s * sy
    top = cy - h / 2
    _limbs(c, cx, cy, w, h, s, layer, hands, legs, lean_dir, STEEL)
    c.rect(cx - w / 2, top, cx + w / 2, cy + h / 2, STEEL, radius=22 * s,
           outline=STEEL_DARK, width=3 * s, layer=layer)
    sy_ = top + h * 0.40
    c.line([(cx - w / 2, sy_), (cx + w / 2, sy_)], STEEL_DARK, 4 * s, layer)
    hx = cx - w / 2 + 22 * s
    c.rect(hx - 6 * s, top + 30 * s, hx + 6 * s, sy_ - 20 * s, WHITE, radius=6 * s,
           outline=STEEL_DARK, width=2 * s, layer=layer)
    c.rect(hx - 6 * s, sy_ + 20 * s, hx + 6 * s, sy_ + 120 * s, WHITE, radius=6 * s,
           outline=STEEL_DARK, width=2 * s, layer=layer)
    draw_face(c, cx + 10 * s, top + h * 0.22, s, expr, layer, eye_gap=40, eye_r=15, mouth_dy=90,
              pupil=pupil, body=STEEL, sweat=sweat, sweat_side=1)


def _washer_body(c, cx, cy, s, sx, sy, expr, layer, pupil, sweat, hands, legs, lean_dir):
    w, h = 240 * s * sx, 260 * s * sy
    top = cy - h / 2
    _limbs(c, cx, cy, w, h, s, layer, hands, legs, lean_dir, WHITE)
    c.rect(cx - w / 2, top, cx + w / 2, cy + h / 2, WHITE, radius=20 * s,
           outline=STEEL_DARK, width=3 * s, layer=layer)
    c.rect(cx - w / 2 + 8 * s, top + 8 * s, cx + w / 2 - 8 * s, top + 64 * s, STEEL,
           radius=12 * s, layer=layer)
    dcx, dcy, dr = cx, top + 165 * s * sy, 78 * s
    c.circle(dcx, dcy, dr, STEEL, outline=STEEL_DARK, width=3 * s, layer=layer)
    c.circle(dcx, dcy, dr * 0.74, GLASS, layer=layer)
    c.arc(dcx - dr * 0.6, dcy - dr * 0.6, dcx + dr * 0.6, dcy + dr * 0.6, 200, 250, WHITE, 5 * s, layer)
    draw_face(c, cx, top + 44 * s, s, expr, layer, eye_gap=44, eye_r=14, mouth_dy=118 * sy,
              pupil=pupil, body=STEEL, sweat=sweat, sweat_side=-1)


APPLIANCE = {"ac": _ac_body, "fridge": _fridge_body, "washer": _washer_body}
APPLIANCE_SIZE = {"ac": (340, 128), "fridge": (220, 340), "washer": (240, 260)}


def draw_appliance(c: Canvas, kind, cx, cy, s, expr, angle=0.0, pupil=(0.0, 0.0), alpha=1.0,
                   squash=(1.0, 1.0), hands=None, legs="stand", lean_dir=0, sweat=0.0, shadow=True,
                   layer=None):
    own = layer is None
    lay = c.new_layer() if own else layer
    if shadow:
        w = APPLIANCE_SIZE[kind][0] * s * squash[0]
        floor_shadow(c, cx, cy + APPLIANCE_SIZE[kind][1] * s * squash[1] / 2 + 44 * s, w * 1.1, lay)
    APPLIANCE[kind](c, cx, cy, s, squash[0], squash[1], expr, lay, pupil, sweat, hands, legs, lean_dir)
    if own:
        c.paste_rotated(lay, angle, (cx, cy), alpha)


# ======================================================================================
# the groom
# ======================================================================================
def draw_groom(c: Canvas, cx, cy, s, expr, layer, hands=None, pose="stand", lean=0.0, stride=0.0,
               phone=False, thumbs_up=False, flap=0.0, sweat=0.0, shadow=True):
    """cx, cy = neck point (standing) or hip point (sitting)."""
    head_r = 58 * s
    if pose == "sit":
        _groom_sitting(c, cx, cy, s, expr, layer, head_r, flap, shadow)
        return
    hx, hy = cx + lean * 1.2 * s, cy - head_r - 6 * s
    sh = 84 * s
    bot = cy + 330 * s
    if shadow:
        floor_shadow(c, cx, bot + 14 * s, 330 * s, layer)
    # feet (sandals) — spread with stride, planted at the hem
    for side in (-1, 1):
        fx = cx + side * (52 * s + stride)
        c.rect(fx - 30 * s, bot - 4 * s, fx + 30 * s, bot + 14 * s, (120, 84, 56), radius=8 * s, layer=layer)
        c.rect(fx - 26 * s, bot - 12 * s, fx + 26 * s, bot + 2 * s, SKIN, radius=8 * s, layer=layer)
    # thobe (leans with `lean` px at the shoulders)
    c.poly([(cx - sh + lean, cy), (cx + sh + lean, cy), (cx + sh + 40 * s, bot), (cx - sh - 40 * s, bot)], WHITE,
           outline=CLOTH_EDGE, width=3 * s, layer=layer)
    c.line([(cx + lean, cy + 4 * s), (cx + lean * 0.5, cy + 150 * s)], (215, 220, 218), 3 * s, layer)
    c.poly([(cx - 22 * s + lean, cy), (cx + 22 * s + lean, cy), (cx + lean, cy + 34 * s)], (232, 236, 234), layer=layer)
    # arms
    if hands is None:
        hands = [(cx - sh - 30 * s, cy + 210 * s), (cx + sh + 30 * s, cy + 210 * s)]
    for (tx, ty), sx in ((hands[0], cx - sh + 10 * s + lean), (hands[1], cx + sh - 10 * s + lean)):
        c.line([(sx, cy + 20 * s), (tx, ty)], WHITE, 46 * s, layer)
        c.line([(sx, cy + 20 * s), (tx, ty)], CLOTH_EDGE, 3 * s, layer)
        c.circle(tx, ty, 22 * s, SKIN, outline=SKIN_DARK, width=2 * s, layer=layer)
        if thumbs_up and (tx, ty) == hands[1]:
            c.rect(tx - 8 * s, ty - 46 * s, tx + 8 * s, ty - 10 * s, SKIN, radius=8 * s,
                   outline=SKIN_DARK, width=2 * s, layer=layer)
    if phone:
        px, py = hands[0]
        c.rect(px - 26 * s, py - 44 * s, px + 26 * s, py + 40 * s, INK, radius=8 * s, layer=layer)
        c.rect(px - 21 * s, py - 38 * s, px + 21 * s, py + 34 * s, MINT, radius=5 * s, layer=layer)
    _groom_head(c, hx, hy, cx + lean, cy, s, expr, layer, head_r, flap, sweat)


def _groom_head(c, hx, hy, nx, ny, s, expr, layer, head_r, flap, sweat):
    # neck
    c.rect(hx - 20 * s, hy + head_r - 20 * s, hx + 20 * s, ny + 6 * s, SKIN, radius=6 * s, layer=layer)
    # ghutra tails (behind the head), flapping
    fl = flap * 18 * s
    c.poly([(hx - head_r * 1.05, hy - head_r * 0.55), (hx + head_r * 1.05, hy - head_r * 0.55),
            (hx + head_r * 1.9 + fl, ny + 40 * s), (hx + head_r * 1.2, ny + 60 * s),
            (hx - head_r * 1.2, ny + 60 * s), (hx - head_r * 1.9 - fl, ny + 40 * s)],
           WHITE, outline=CLOTH_EDGE, width=3 * s, layer=layer)
    c.circle(hx, hy, head_r, SKIN, outline=SKIN_DARK, width=2 * s, layer=layer)
    c.arc(hx - head_r * 0.98, hy - head_r * 0.7, hx + head_r * 0.98, hy + head_r * 1.0, 20, 160,
          BEARD, 14 * s, layer)
    c.ellipse(hx - head_r * 1.08, hy - head_r * 1.16, hx + head_r * 1.08, hy - head_r * 0.2, WHITE,
              outline=CLOTH_EDGE, width=3 * s, layer=layer)
    c.ellipse(hx - head_r * 1.02, hy - head_r * 1.0, hx + head_r * 1.02, hy - head_r * 0.42,
              None, outline=INK, width=9 * s, layer=layer)
    c.ellipse(hx - head_r * 1.02, hy - head_r * 0.9, hx + head_r * 1.02, hy - head_r * 0.32,
              None, outline=INK, width=6 * s, layer=layer)
    draw_face(c, hx, hy + 10 * s, s, expr, layer, eye_gap=24, eye_r=9, mouth_dy=26, body=SKIN,
              sweat=sweat, sweat_side=1)


def _groom_sitting(c, cx, cy, s, expr, layer, head_r, flap, shadow):
    """Sitting on the floor after the fall: legs out front, hands on the floor."""
    if shadow:
        floor_shadow(c, cx, cy + 120 * s, 420 * s, layer)
    hx, hy = cx, cy - 170 * s - head_r
    # legs out to the front-left (both to one side, one slightly behind the other)
    for i, (dx0, dy0) in enumerate(((-30, 0), (30, 14))):
        lx = cx + dx0 * s
        c.line([(lx, cy + (40 + dy0) * s), (lx - 150 * s, cy + (96 + dy0) * s)], WHITE, 58 * s, layer)
        c.line([(lx, cy + (40 + dy0) * s), (lx - 150 * s, cy + (96 + dy0) * s)], CLOTH_EDGE, 3 * s, layer)
        fx, fy = lx - 180 * s, cy + (100 + dy0) * s
        c.rect(fx - 24 * s, fy - 16 * s, fx + 24 * s, fy + 12 * s, (120, 84, 56), radius=8 * s, layer=layer)
        c.rect(fx - 20 * s, fy - 22 * s, fx + 20 * s, fy - 4 * s, SKIN, radius=8 * s, layer=layer)
    # body (thobe blob)
    c.rect(cx - 120 * s, cy - 190 * s, cx + 120 * s, cy + 70 * s, WHITE, radius=70 * s,
           outline=CLOTH_EDGE, width=3 * s, layer=layer)
    # arms propping on the floor
    for side in (-1, 1):
        ax, ay = cx + side * 100 * s, cy - 130 * s
        tx, ty = cx + side * 190 * s, cy + 60 * s
        c.line([(ax, ay), (tx, ty)], WHITE, 44 * s, layer)
        c.line([(ax, ay), (tx, ty)], CLOTH_EDGE, 3 * s, layer)
        c.circle(tx, ty, 22 * s, SKIN, outline=SKIN_DARK, width=2 * s, layer=layer)
    _groom_head(c, hx, hy, cx, cy - 190 * s, s, expr, layer, head_r, flap, 0.0)


# ======================================================================================
# props
# ======================================================================================
def draw_bar(c: Canvas, cx, cy, w, h, layer, label="15,000 ريال", sub="ميزانية الأجهزة",
             cracks=0.0, s=1.0, color=GREEN, rings=False):
    c.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, color, radius=h * 0.35,
           outline=GREEN_DEEP, width=3 * s, layer=layer)
    c.rect(cx - w / 2 + 10 * s, cy - h / 2 + 8 * s, cx + w / 2 - 10 * s, cy - h / 2 + 22 * s,
           rgba(WHITE, 60), radius=8 * s, layer=layer)
    if rings:
        for x in (cx - w / 2 + 6 * s, cx + w / 2 - 6 * s):
            c.circle(x, cy, 14 * s, None, outline=GREEN_DEEP, width=5 * s, layer=layer)
    if label:
        c.text(cx, cy - (6 if sub else 0) * s, label, font(HEAD, 56 * s), WHITE, layer=layer)
    if sub:
        c.text(cx, cy + 36 * s, sub, font(MED, 24 * s), rgba(WHITE, 220), layer=layer)
    if cracks > 0:
        k = clamp(cracks)
        pts = [(cx - w * 0.18, cy - h / 2), (cx - w * 0.12, cy - h * 0.15), (cx - w * 0.2, cy + h * 0.1),
               (cx - w * 0.1, cy + h / 2)]
        n = max(2, int(2 + k * (len(pts) - 2)))
        c.line(pts[:n], WHITE, 4 * s, layer)
        pts2 = [(cx + w * 0.22, cy + h / 2), (cx + w * 0.16, cy + h * 0.1), (cx + w * 0.26, cy - h * 0.2),
                (cx + w * 0.18, cy - h / 2)]
        n2 = max(2, int(1 + k * (len(pts2) - 1)))
        c.line(pts2[:n2], WHITE, 4 * s, layer)
        if k > 0.6:
            c.line([(cx - w * 0.02, cy - h / 2), (cx + w * 0.03, cy - h * 0.2), (cx - w * 0.03, cy + h * 0.25)],
                   WHITE, 3 * s, layer)


def draw_rope(c: Canvas, p0, p1, layer, sag=60, tension=1.0, width=1.0):
    pts = []
    for i in range(15):
        k = i / 14
        x = lerp(p0[0], p1[0], k)
        y = lerp(p0[1], p1[1], k) + sag * (1 - tension) * math.sin(math.pi * k)
        pts.append((x, y))
    c.line(pts, ROPE_DARK, 16 * width, layer)
    c.line(pts, ROPE, 10 * width, layer)
    for i in range(1, 14, 2):
        x, y = pts[i]
        c.line([(x - 5, y - 6), (x + 5, y + 6)], ROPE_DARK, 3, layer)


def draw_bubble(c: Canvas, cx, cy, lines, fnt, layer, tail=None, pad=28, fill=WHITE, color=INK,
                line_h=None, scale=1.0, radius=30, outline=None, shake_amt=0.0, t=0.0):
    if scale <= 0.01:
        return
    if shake_amt:
        cx += shake_amt * math.sin(t * 60)
        cy += shake_amt * math.cos(t * 47)
    line_h = line_h or fnt.size / c.s(1) * 1.15
    widths = [c.text_width(l, fnt) for l in lines]
    w = (max(widths) + pad * 2) * scale
    h = (line_h * len(lines) + pad * 1.4) * scale
    x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
    ow = 3 if outline else 0
    if tail is not None and scale > 0.5:
        tx, ty = tail
        bx = clamp(tx, x0 + 40, x1 - 40)
        if ty > y1:
            c.poly([(bx - 22, y1 - 4), (bx + 22, y1 - 4), (tx, ty)], fill, outline=outline, width=ow, layer=layer)
        elif ty < y0:
            c.poly([(bx - 22, y0 + 4), (bx + 22, y0 + 4), (tx, ty)], fill, outline=outline, width=ow, layer=layer)
        elif tx < x0:
            by = clamp(ty, y0 + 30, y1 - 30)
            c.poly([(x0 + 4, by - 18), (x0 + 4, by + 18), (tx, ty)], fill, outline=outline, width=ow, layer=layer)
        else:
            by = clamp(ty, y0 + 30, y1 - 30)
            c.poly([(x1 - 4, by - 18), (x1 - 4, by + 18), (tx, ty)], fill, outline=outline, width=ow, layer=layer)
    c.rect(x0, y0, x1, y1, fill, radius=radius * scale, outline=outline, width=ow, layer=layer)
    if scale > 0.6:
        a = clamp((scale - 0.6) / 0.4)
        c.text_lines(cx, cy, lines, fnt, rgba(color, 255 * a), line_h, layer=layer)


def draw_check_badge(c: Canvas, cx, cy, r, layer, scale=1.0):
    if scale <= 0.01:
        return
    r = r * scale
    c.circle(cx, cy, r, GOLD, outline=GOLD_DARK, width=2, layer=layer)
    c.line([(cx - r * 0.45, cy), (cx - r * 0.1, cy + r * 0.35), (cx + r * 0.5, cy - r * 0.35)],
           WHITE, max(3, r * 0.22), layer)


def draw_ring(c: Canvas, cx, cy, r, layer):
    c.circle(cx, cy, r, None, outline=GOLD, width=r * 0.28, layer=layer)
    c.circle(cx, cy - r * 1.05, r * 0.32, WHITE, outline=GOLD_DARK, width=3, layer=layer)
    c.poly([(cx - r * 0.32, cy - r * 1.05), (cx, cy - r * 0.62), (cx + r * 0.32, cy - r * 1.05),
            (cx, cy - r * 1.42)], (230, 240, 250), outline=GOLD_DARK, width=3, layer=layer)


def draw_keys(c: Canvas, cx, cy, r, layer):
    c.circle(cx, cy, r, None, outline=GOLD, width=r * 0.3, layer=layer)
    c.line([(cx + r, cy), (cx + r * 2.6, cy)], GOLD, r * 0.3, layer)
    c.line([(cx + r * 2.0, cy), (cx + r * 2.0, cy + r * 0.6)], GOLD, r * 0.3, layer)
    c.line([(cx + r * 2.5, cy), (cx + r * 2.5, cy + r * 0.5)], GOLD, r * 0.3, layer)
