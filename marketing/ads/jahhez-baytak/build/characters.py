"""Illustrated cast: the three appliances, the groom, the budget bar, ropes, bubbles."""
from __future__ import annotations

import math

from common import (
    BOLD, GOLD, GOLD_DARK, GREEN, GREEN_DEEP, HEAD, INK, INK_SOFT, MED, MINT, RED,
    RED_DEEP, SKIN, SKIN_DARK, STEEL, STEEL_DARK, WHITE, Canvas, clamp, font, lerp, rgba,
)

ROPE = (184, 137, 79)
ROPE_DARK = (140, 98, 50)
GLASS = (58, 76, 88)


# --------------------------------------------------------------------------------------
# faces
# --------------------------------------------------------------------------------------
def draw_face(c: Canvas, cx, cy, s, expr, layer, eye_gap=60, eye_r=17, mouth_dy=34, pupil_dx=0.0):
    """Cartoon face: expr in neutral/angry/shout/happy/sad/shocked/relaxed."""
    exl, exr = cx - eye_gap * s, cx + eye_gap * s
    ey = cy - 8 * s
    r = eye_r * s
    for ex in (exl, exr):
        c.circle(ex, ey, r, WHITE, outline=INK, width=3 * s, layer=layer)
        pr = r * 0.48
        px = ex + pupil_dx * r * 0.4
        py = ey + (r * 0.15 if expr in ("angry", "shout") else 0)
        c.circle(px, py, pr, INK, layer=layer)
        c.circle(px - pr * 0.35, py - pr * 0.35, pr * 0.3, WHITE, layer=layer)
    # eyebrows
    bw = 3.6 * s
    if expr in ("angry", "shout"):
        c.line([(exl - r, ey - r * 1.4), (exl + r, ey - r * 0.6)], INK, bw, layer)
        c.line([(exr + r, ey - r * 1.4), (exr - r, ey - r * 0.6)], INK, bw, layer)
    elif expr in ("sad", "shocked"):
        c.line([(exl - r, ey - r * 0.9), (exl + r, ey - r * 1.5)], INK, bw, layer)
        c.line([(exr + r, ey - r * 0.9), (exr - r, ey - r * 1.5)], INK, bw, layer)
    else:
        c.line([(exl - r, ey - r * 1.45), (exl + r, ey - r * 1.45)], INK, bw, layer)
        c.line([(exr - r, ey - r * 1.45), (exr + r, ey - r * 1.45)], INK, bw, layer)
    # mouth
    my = cy + mouth_dy * s
    mw = 26 * s
    if expr == "shout":
        c.ellipse(cx - mw * 0.8, my - mw * 0.6, cx + mw * 0.8, my + mw * 0.9, INK, layer=layer)
        c.ellipse(cx - mw * 0.45, my + mw * 0.25, cx + mw * 0.45, my + mw * 0.85, RED, layer=layer)
    elif expr == "shocked":
        c.ellipse(cx - mw * 0.5, my - mw * 0.4, cx + mw * 0.5, my + mw * 0.8, INK, layer=layer)
    elif expr == "angry":
        c.arc(cx - mw, my, cx + mw, my + mw * 1.4, 200, 340, INK, 4 * s, layer)
    elif expr == "sad":
        c.arc(cx - mw, my, cx + mw, my + mw * 1.6, 200, 340, INK, 4 * s, layer)
    elif expr in ("happy", "relaxed"):
        c.arc(cx - mw, my - mw * 1.0, cx + mw, my + mw * 0.5, 15, 165, INK, 4 * s, layer)
    else:
        c.line([(cx - mw * 0.6, my), (cx + mw * 0.6, my)], INK, 4 * s, layer)


# --------------------------------------------------------------------------------------
# appliances
# --------------------------------------------------------------------------------------
def draw_ac(c: Canvas, cx, cy, s, expr, layer, pupil_dx=0.0):
    w, h = 340 * s, 128 * s
    c.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, WHITE, radius=26 * s,
           outline=STEEL_DARK, width=3 * s, layer=layer)
    c.rect(cx - w / 2 + 6 * s, cy - h / 2 + 6 * s, cx + w / 2 - 6 * s, cy - h / 2 + 30 * s,
           STEEL, radius=18 * s, layer=layer)
    # louver
    c.rect(cx - w / 2 + 14 * s, cy + h / 2 - 34 * s, cx + w / 2 - 14 * s, cy + h / 2 - 14 * s,
           STEEL, radius=8 * s, outline=STEEL_DARK, width=2 * s, layer=layer)
    for i in range(1, 6):
        x = cx - w / 2 + 14 * s + i * (w - 28 * s) / 6
        c.line([(x, cy + h / 2 - 32 * s), (x, cy + h / 2 - 16 * s)], STEEL_DARK, 2 * s, layer)
    # led
    c.circle(cx + w / 2 - 34 * s, cy - h / 2 + 18 * s, 5 * s, MINT, layer=layer)
    draw_face(c, cx, cy - 6 * s, s, expr, layer, eye_gap=54, eye_r=15, mouth_dy=26, pupil_dx=pupil_dx)


def draw_fridge(c: Canvas, cx, cy, s, expr, layer, pupil_dx=0.0):
    w, h = 220 * s, 340 * s
    top = cy - h / 2
    c.rect(cx - w / 2, top, cx + w / 2, cy + h / 2, STEEL, radius=22 * s,
           outline=STEEL_DARK, width=3 * s, layer=layer)
    # door split
    sy = top + h * 0.40
    c.line([(cx - w / 2, sy), (cx + w / 2, sy)], STEEL_DARK, 4 * s, layer)
    # handles
    hx = cx - w / 2 + 22 * s
    c.rect(hx - 6 * s, top + 30 * s, hx + 6 * s, sy - 20 * s, WHITE, radius=6 * s,
           outline=STEEL_DARK, width=2 * s, layer=layer)
    c.rect(hx - 6 * s, sy + 20 * s, hx + 6 * s, sy + 120 * s, WHITE, radius=6 * s,
           outline=STEEL_DARK, width=2 * s, layer=layer)
    # feet
    c.rect(cx - w / 2 + 20 * s, cy + h / 2, cx - w / 2 + 50 * s, cy + h / 2 + 10 * s, STEEL_DARK,
           radius=4 * s, layer=layer)
    c.rect(cx + w / 2 - 50 * s, cy + h / 2, cx + w / 2 - 20 * s, cy + h / 2 + 10 * s, STEEL_DARK,
           radius=4 * s, layer=layer)
    draw_face(c, cx + 10 * s, top + h * 0.22, s, expr, layer, eye_gap=40, eye_r=15, mouth_dy=90,
              pupil_dx=pupil_dx)


def draw_washer(c: Canvas, cx, cy, s, expr, layer, pupil_dx=0.0):
    w, h = 240 * s, 260 * s
    top = cy - h / 2
    c.rect(cx - w / 2, top, cx + w / 2, cy + h / 2, WHITE, radius=20 * s,
           outline=STEEL_DARK, width=3 * s, layer=layer)
    # control panel
    c.rect(cx - w / 2 + 8 * s, top + 8 * s, cx + w / 2 - 8 * s, top + 64 * s, STEEL,
           radius=12 * s, layer=layer)
    # door
    dcx, dcy, dr = cx, top + 165 * s, 78 * s
    c.circle(dcx, dcy, dr, STEEL, outline=STEEL_DARK, width=3 * s, layer=layer)
    c.circle(dcx, dcy, dr * 0.74, GLASS, layer=layer)
    c.arc(dcx - dr * 0.6, dcy - dr * 0.6, dcx + dr * 0.6, dcy + dr * 0.6, 200, 250, WHITE, 5 * s, layer)
    # face: eyes on the panel, mouth inside the glass
    draw_face(c, cx, top + 44 * s, s, expr, layer, eye_gap=44, eye_r=14, mouth_dy=118,
              pupil_dx=pupil_dx)
    # feet
    c.rect(cx - w / 2 + 16 * s, cy + h / 2, cx - w / 2 + 44 * s, cy + h / 2 + 10 * s, STEEL_DARK,
           radius=4 * s, layer=layer)
    c.rect(cx + w / 2 - 44 * s, cy + h / 2, cx + w / 2 - 16 * s, cy + h / 2 + 10 * s, STEEL_DARK,
           radius=4 * s, layer=layer)


APPLIANCE = {"ac": draw_ac, "fridge": draw_fridge, "washer": draw_washer}
APPLIANCE_LABEL = {"ac": "المكيّف", "fridge": "الثلاجة", "washer": "الغسالة"}


def draw_appliance(c: Canvas, kind, cx, cy, s, expr, angle=0.0, pupil_dx=0.0, alpha=1.0):
    lay = c.new_layer()
    APPLIANCE[kind](c, cx, cy, s, expr, lay, pupil_dx)
    c.paste_rotated(lay, angle, (cx, cy), alpha)


# --------------------------------------------------------------------------------------
# the groom (Saudi thobe + white ghutra + igal)
# --------------------------------------------------------------------------------------
def draw_groom(c: Canvas, cx, cy, s, expr, layer, hands=None, angle_arms=0.0, phone=False,
               thumbs_up=False):
    """cx, cy = neck point. hands = [(x, y), (x, y)] absolute targets for the hands."""
    head_r = 58 * s
    hx, hy = cx, cy - head_r - 6 * s
    # thobe
    sh = 84 * s  # half shoulder width
    bot = cy + 330 * s
    c.poly([(cx - sh, cy), (cx + sh, cy), (cx + sh + 40 * s, bot), (cx - sh - 40 * s, bot)], WHITE,
           outline=(205, 210, 208), width=3 * s, layer=layer)
    # collar + placket
    c.line([(cx, cy + 4 * s), (cx, cy + 150 * s)], (215, 220, 218), 3 * s, layer)
    c.poly([(cx - 22 * s, cy), (cx + 22 * s, cy), (cx, cy + 34 * s)], (232, 236, 234), layer=layer)
    # arms
    if hands is None:
        hands = [(cx - sh - 30 * s, cy + 210 * s), (cx + sh + 30 * s, cy + 210 * s)]
    for (tx, ty), sx in ((hands[0], cx - sh + 10 * s), (hands[1], cx + sh - 10 * s)):
        c.line([(sx, cy + 20 * s), (tx, ty)], WHITE, 46 * s, layer)
        c.line([(sx, cy + 20 * s), (tx, ty)], (205, 210, 208), 3 * s, layer)  # subtle edge
        c.circle(tx, ty, 22 * s, SKIN, outline=SKIN_DARK, width=2 * s, layer=layer)
        if thumbs_up and (tx, ty) == hands[1]:
            c.rect(tx - 8 * s, ty - 46 * s, tx + 8 * s, ty - 10 * s, SKIN, radius=8 * s,
                   outline=SKIN_DARK, width=2 * s, layer=layer)
    if phone:
        px, py = hands[0]
        c.rect(px - 26 * s, py - 44 * s, px + 26 * s, py + 40 * s, INK, radius=8 * s, layer=layer)
        c.rect(px - 21 * s, py - 38 * s, px + 21 * s, py + 34 * s, MINT, radius=5 * s, layer=layer)
    # neck
    c.rect(hx - 20 * s, hy + head_r - 20 * s, hx + 20 * s, cy + 6 * s, SKIN, radius=6 * s, layer=layer)
    # ghutra (white cloth draped behind the head, falling to the shoulders)
    c.poly([(hx - head_r * 1.05, hy - head_r * 0.55), (hx + head_r * 1.05, hy - head_r * 0.55),
            (hx + head_r * 1.9, cy + 40 * s), (hx + head_r * 1.2, cy + 60 * s),
            (hx - head_r * 1.2, cy + 60 * s), (hx - head_r * 1.9, cy + 40 * s)],
           WHITE, outline=(205, 210, 208), width=3 * s, layer=layer)
    # head
    c.circle(hx, hy, head_r, SKIN, outline=SKIN_DARK, width=2 * s, layer=layer)
    # beard
    c.arc(hx - head_r * 0.98, hy - head_r * 0.7, hx + head_r * 0.98, hy + head_r * 1.0, 20, 160,
          (60, 44, 34), 14 * s, layer)
    # ghutra top over the forehead
    c.ellipse(hx - head_r * 1.08, hy - head_r * 1.16, hx + head_r * 1.08, hy - head_r * 0.2, WHITE,
              outline=(205, 210, 208), width=3 * s, layer=layer)
    # igal (black double cord)
    c.ellipse(hx - head_r * 1.02, hy - head_r * 1.0, hx + head_r * 1.02, hy - head_r * 0.42,
              None, outline=INK, width=9 * s, layer=layer)
    c.ellipse(hx - head_r * 1.02, hy - head_r * 0.9, hx + head_r * 1.02, hy - head_r * 0.32,
              None, outline=INK, width=6 * s, layer=layer)
    draw_face(c, hx, hy + 10 * s, s, expr, layer, eye_gap=24, eye_r=9, mouth_dy=26)


# --------------------------------------------------------------------------------------
# props
# --------------------------------------------------------------------------------------
def draw_bar(c: Canvas, cx, cy, w, h, layer, label="15,000 ريال", sub="ميزانية الأجهزة",
             cracks=0.0, s=1.0, color=GREEN):
    c.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, color, radius=h * 0.35,
           outline=GREEN_DEEP, width=3 * s, layer=layer)
    c.rect(cx - w / 2 + 10 * s, cy - h / 2 + 8 * s, cx + w / 2 - 10 * s, cy - h / 2 + 22 * s,
           rgba(WHITE, 60), radius=8 * s, layer=layer)
    if label:
        c.text(cx, cy - 6 * s, label, font(HEAD, 56 * s), WHITE, layer=layer)
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


def draw_rope(c: Canvas, p0, p1, layer, sag=40, tension=1.0):
    """Rope from p0 to p1 with a small sag (less sag when tense)."""
    pts = []
    for i in range(13):
        k = i / 12
        x = lerp(p0[0], p1[0], k)
        y = lerp(p0[1], p1[1], k) + sag * (1 - tension) * math.sin(math.pi * k)
        pts.append((x, y))
    c.line(pts, ROPE_DARK, 16, layer)
    c.line(pts, ROPE, 10, layer)
    # twist marks
    for i in range(1, 12, 2):
        x, y = pts[i]
        c.line([(x - 5, y - 6), (x + 5, y + 6)], ROPE_DARK, 3, layer)


def draw_bubble(c: Canvas, cx, cy, lines, fnt, layer, tail=None, pad=28, fill=WHITE, color=INK,
                line_h=None, scale=1.0, radius=30, outline=None):
    if scale <= 0.01:
        return
    line_h = line_h or fnt.size / c.s(1) * 1.15
    widths = [c.text_width(l, fnt) for l in lines]
    w = (max(widths) + pad * 2) * scale
    h = (line_h * len(lines) + pad * 1.4) * scale
    x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
    if tail is not None and scale > 0.5:
        tx, ty = tail
        # tail base on the bubble edge closest to the tail point
        bx = clamp(tx, x0 + 40, x1 - 40)
        if ty > y1:
            c.poly([(bx - 22, y1 - 4), (bx + 22, y1 - 4), (tx, ty)], fill, outline=outline,
                   width=3 if outline else 0, layer=layer)
        elif ty < y0:
            c.poly([(bx - 22, y0 + 4), (bx + 22, y0 + 4), (tx, ty)], fill, outline=outline,
                   width=3 if outline else 0, layer=layer)
        elif tx < x0:
            by = clamp(ty, y0 + 30, y1 - 30)
            c.poly([(x0 + 4, by - 18), (x0 + 4, by + 18), (tx, ty)], fill, outline=outline,
                   width=3 if outline else 0, layer=layer)
        else:
            by = clamp(ty, y0 + 30, y1 - 30)
            c.poly([(x1 - 4, by - 18), (x1 - 4, by + 18), (tx, ty)], fill, outline=outline,
                   width=3 if outline else 0, layer=layer)
    c.rect(x0, y0, x1, y1, fill, radius=radius * scale, outline=outline, width=3 if outline else 0,
           layer=layer)
    if scale > 0.6:
        a = clamp((scale - 0.6) / 0.4)
        # text rendered at full size once bubble is mostly open
        c.text_lines(cx, cy, lines, fnt, rgba(color, 255 * a), line_h, layer=layer)


def draw_check_badge(c: Canvas, cx, cy, r, layer, scale=1.0):
    if scale <= 0.01:
        return
    r = r * scale
    c.circle(cx, cy, r, GOLD, outline=GOLD_DARK, width=2, layer=layer)
    c.line([(cx - r * 0.45, cy), (cx - r * 0.1, cy + r * 0.35), (cx + r * 0.5, cy - r * 0.35)],
           WHITE, max(3, r * 0.22), layer)


def draw_house(c: Canvas, cx, top, w, h, layer, color=MINT, width=10):
    """Outline house: roof + walls."""
    c.poly([(cx - w / 2 - 30, top + h * 0.38), (cx, top), (cx + w / 2 + 30, top + h * 0.38)],
           None, outline=color, width=width, layer=layer)
    c.rect(cx - w / 2, top + h * 0.36, cx + w / 2, top + h, rgba(WHITE, 0), radius=6,
           outline=color, width=width, layer=layer)


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
