"""Timeline + scene drawing v2 for the «جهّز بيتك بذكاء» ad. frame(t) -> PIL RGB image."""
from __future__ import annotations

import math
import os
from functools import lru_cache

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from characters import (
    APPLIANCE_SIZE, draw_appliance, draw_bar, draw_bubble, draw_check_badge, draw_dizzy_stars,
    draw_dust, draw_groom, draw_keys, draw_motion_lines, draw_ring, draw_rope, draw_skid,
)
from common import (
    BOLD, CREAM, GOLD, GREEN, GREEN_DEEP, H, HEAD, INK, INK_SOFT, MED, MINT, MINT_DARK, RED,
    SS, W, WHITE, Canvas, clamp, ease_in_cubic, ease_in_out, ease_out_back, ease_out_cubic,
    ease_out_elastic, font, lerp, paste_logo, rgba, seg, shake,
)

UI_DIR = os.environ.get(
    "AD_UI_DIR",
    "/tmp/claude-0/-home-user-tawveeri-main/4dc8aa92-1ec1-5288-8ec7-2880e0b7ef46/scratchpad/work/ui2")

# ======================================================================================
# timeline (seconds)
# ======================================================================================
T_OPEN = (0.0, 3.4)
T_CTX = (3.4, 5.8)
T_ESC = (5.8, 9.0)      # snap at local 1.8 (t = 7.6)
T_LINE = (9.0, 11.4)
T_TURN = (11.4, 13.6)
T_UI = [("A", 13.6, 16.4), ("B", 16.4, 19.2), ("C1", 19.2, 22.6), ("C2", 22.6, 25.4)]
T_PAY = (25.4, 28.4)
T_CTA = (28.4, 31.5)
DURATION = T_CTA[1]
SNAP = T_ESC[0] + 1.8

# Voice-over cues: (line no, start, end, text). Single source of truth for the SRT and mix_vo.py.
VO_CUES = [
    (1, 0.3, 2.6, "كل جهاز يبي الميزانية له!"),
    (2, 3.6, 5.6, "عريس، وبيت جديد… وخمسطعش ألف للأجهزة."),
    (3, 6.0, 7.4, "وكلٍّ يشدّ من جهته…"),
    (4, 9.2, 11.2, "يا جماعة… أبي أجهِّز بيت، مو جهاز!"),
    (5, 11.9, 13.3, "توفيري يرتّبها لك."),
    (6, 13.9, 15.4, "حدّد أجهزتك…"),
    (7, 16.7, 18.6, "ومساحاتك وميزانيتك…"),
    (8, 19.5, 22.3, "وتطلع لك خطة من عروض المتاجر… وتشاركها مع أهلك."),
    (9, 22.9, 24.6, "والشراء من المتجر نفسه."),
    (10, 25.7, 28.1, "كلٍّ أخذ نصيبه… وخطة أجهزتك جاهزة."),
    (11, 28.7, 31.1, "ابدأ خطة بيتك… على توفيري دوت كوم."),
]

# real plan shares (recording: AC 2x2,766=5,532 · fridge 1,799 · washer 2,299 of 9,630)
SHARES = [("ac", 5532 / 9630, "التكييف ×2"), ("fridge", 1799 / 9630, "الثلاجة"),
          ("washer", 2299 / 9630, "الغسالة")]

# ======================================================================================
# product shots (source 576x1024 frames extracted at 30fps per segment)
# ======================================================================================
UI_SHOTS = {
    "A": dict(crop=(0, 280, 576, 760), scale=1.5, title=["حدّد أجهزتك"],
              sub="مكيفين، ثلاجة، غسالة… بالعدد اللي تبيه", step=0,
              ring=(0.9, (30, 430, 330, 490)), focus=(0.55, 0.45)),
    "B": dict(crop=(0, 430, 576, 990), scale=1.5, title=["ومساحاتك وميزانيتك"],
              sub="غرفة النوم، الصالة، وكم معك للأجهزة", step=1,
              ring=(0.8, (180, 680, 330, 726)), ring2=(2.05, (40, 935, 540, 1000)), focus=(0.5, 0.55)),
    "C1": dict(crop=(0, 45, 576, 700), scale=1.3, title=["خطة من عروض المتاجر"],
               sub="بأسعار كما رُصدت وقت التسجيل — تتغيّر", step=2,
               ring=(1.0, (300, 280, 560, 345)), focus=(0.5, 0.45)),
    "C2": dict(crop=(0, 20, 576, 600), scale=1.5, title=["شاركها مع أهلك", "قبل ما تشتري"],
               sub="والشراء من المتجر نفسه", step=2, share=(0.7, (131, 62)), focus=(0.3, 0.3)),
}
STEPS = ["احتياجاتك", "ميزانيتك", "خطة أجهزتك"]


@lru_cache(maxsize=1024)
def ui_frame(shot: str, idx: int) -> Image.Image:
    files = sorted(os.listdir(os.path.join(UI_DIR, shot)))
    idx = max(0, min(idx, len(files) - 1))
    im = Image.open(os.path.join(UI_DIR, shot, files[idx])).convert("RGB")
    cfg = UI_SHOTS[shot]
    x0, y0, x1, y1 = cfg["crop"]
    im = im.crop((x0, y0, x1, y1))
    sc = cfg["scale"] * SS
    im = im.resize((int((x1 - x0) * sc), int((y1 - y0) * sc)), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))


# ======================================================================================
# shared bits
# ======================================================================================
def headline(c: Canvas, lines, y, size=76, color=INK, alpha=1.0, layer=None, line_h=None, fnt=None):
    fnt = fnt or font(HEAD, size)
    c.text_lines(540, y, lines, fnt, rgba(color, 255 * alpha), line_h or size * 1.18, layer=layer)


def title_plate(c: Canvas, lines, y, alpha, size=64, line_h=76):
    """Dark rounded plate with white headline, slides down slightly as it appears."""
    if alpha <= 0:
        return
    lay = c.new_layer()
    n = len(lines)
    h = 60 + line_h * n
    c.rect(100, y - h / 2, 980, y + h / 2, rgba(INK, 235), radius=30, layer=lay)
    headline(c, lines, y - (1 - alpha) * 24, size=size, color=WHITE, layer=lay, line_h=line_h)
    c.composite(lay, alpha)


def floor_line(c: Canvas, y=1560, alpha=1.0):
    lay = c.new_layer()
    c.rect(0, y, W, H, (238, 241, 237), layer=lay)
    c.line([(0, y), (W, y)], (222, 227, 222), 3, lay)
    c.composite(lay, alpha)


def bubble_pop(t, t0, dur=0.28):
    return ease_out_back(seg(t, t0, t0 + dur), s=2.0)


# ======================================================================================
# the tug-of-war engine
# ======================================================================================
BASE = {"fridge": (190.0, 820.0), "ac": (800.0, 560.0), "washer": (860.0, 1420.0)}
BAR0 = (540.0, 1000.0)
PULLERS = ("fridge", "ac", "washer")

HEAVES_OPEN = [(0.15, "fridge", 1.0), (0.7, "ac", 1.0), (1.25, "washer", 0.8), (1.8, "fridge", 1.1),
               (2.35, "ac", 1.2), (2.9, "washer", 1.0)]
HEAVES_ESC = [(0.1, "fridge", 1.2), (0.35, "ac", 1.2), (0.6, "washer", 1.0), (0.85, "fridge", 1.3),
              (1.1, "ac", 1.3), (1.35, "washer", 1.1), (1.6, "all", 1.5)]


def _unit(p, q):
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy) or 1
    return dx / L, dy / L


def pull_state(t, heaves):
    """Returns bar displacement, per-puller animation phases and tension."""
    disp = [0.0, 0.0]
    st = {p: dict(ant=0.0, pull=0.0, tension=0.35, sq=(1.0, 1.0), off=0.0) for p in PULLERS}
    skid = 0.0
    for t0, who, k in heaves:
        u = t - t0
        targets = PULLERS if who == "all" else (who,)
        if u < -0.2 or u > 1.6:
            continue
        if u < 0:
            a = ease_in_out((u + 0.2) / 0.2)
            for p in targets:
                s_ = st[p]
                s_["ant"] = max(s_["ant"], a)
            continue
        if u < 0.16:
            q = ease_out_cubic(u / 0.16)
            amp = q
            skid = max(skid, q)
        elif u < 0.9:
            amp = 1 - 0.75 * ease_in_out((u - 0.16) / 0.74)
            q = 0.0
        else:
            amp = 0.25 * (1 - ease_in_out((u - 0.9) / 0.7))
            q = 0.0
        for p in targets:
            d = _unit(BAR0, BASE[p])
            share = 0.5 if who == "all" else 1.0
            disp[0] += d[0] * 70 * k * amp * share
            disp[1] += d[1] * 70 * k * amp * share
            s_ = st[p]
            s_["pull"] = max(s_["pull"], q)
            s_["tension"] = max(s_["tension"], amp)
            s_["off"] = max(s_["off"], 22 * amp)
    for p in PULLERS:
        s_ = st[p]
        a, q = s_["ant"], s_["pull"]
        s_["sq"] = (1 + 0.09 * a - 0.07 * q, 1 - 0.09 * a + 0.09 * q)
    return (disp[0], disp[1]), st, skid


def draw_tug(c: Canvas, t, heaves, stretch=1.0, cracks=0.0, sweat=0.0, groom_override=None):
    disp, st, skid = pull_state(t, heaves)
    mag = math.hypot(*disp)
    bar_cx, bar_cy = BAR0[0] + disp[0], BAR0[1] + disp[1]
    bar_w = 420 * stretch
    bar_l = (bar_cx - bar_w / 2 + 8, bar_cy)
    bar_r = (bar_cx + bar_w / 2 - 8, bar_cy)
    floor_line(c)
    # puller positions: base + anticipation (toward bar) / pull (away)
    pos, grips = {}, {}
    for p in PULLERS:
        d = _unit(BAR0, BASE[p])
        s_ = st[p]
        px = BASE[p][0] + d[0] * (s_["off"] - 14 * s_["ant"]) + shake(t, 3 * s_["tension"], 19, hash(p) % 7)
        py = BASE[p][1] + d[1] * (s_["off"] - 14 * s_["ant"]) + shake(t, 3 * s_["tension"], 17, hash(p) % 5)
        pos[p] = (px, py)
        # grip point: on the line from the bar end to the appliance, just outside its body
        end = bar_l if p == "fridge" else bar_r
        ux, uy = _unit(end, (px, py))
        w_, h_ = APPLIANCE_SIZE[p]
        back = (w_ if abs(ux) > abs(uy) else h_) / 2 + 40
        grips[p] = (px - ux * back, py - uy * back)
    # ropes
    lay = c.new_layer()
    for p in PULLERS:
        end = bar_l if p == "fridge" else bar_r
        draw_rope(c, end, grips[p], lay, sag=70, tension=st[p]["tension"])
    c.composite(lay)
    # groom (resists: moves 70% with the bar, leans against it)
    gx, gy = 540 + disp[0] * 0.7, 1235 + disp[1] * 0.35
    lean = -disp[0] * 0.35
    any_pull = max(st[p]["pull"] for p in PULLERS)
    expr = groom_override or ("effort" if any_pull > 0.3 else ("shocked" if mag > 55 else "angry"))
    lay = c.new_layer()
    if skid > 0:
        dirx = 1 if disp[0] > 0 else -1
        for side in (-1, 1):
            draw_skid(c, gx + side * 60 + dirx * 20, gy + 336, dirx, 1.0, lay, k=skid)
    draw_groom(c, gx, gy, 1.0, expr, lay, hands=[bar_l, bar_r], lean=lean, stride=18 + mag * 0.25,
               flap=math.sin(t * 9) * (0.4 + mag / 80), sweat=sweat)
    c.composite(lay)
    # bar
    lay = c.new_layer()
    draw_bar(c, bar_cx, bar_cy, bar_w, 110, lay, cracks=cracks, rings=True)
    c.composite(lay)
    # appliances (lean away from the bar while pulling)
    exprs = {"fridge": "effort", "ac": "shout", "washer": "effort"}
    for p in PULLERS:
        s_ = st[p]
        d = _unit(BAR0, BASE[p])
        px, py = pos[p]
        gx_, gy_ = grips[p]
        hands = [(gx_ - d[1] * 12, gy_ + d[0] * 12), (gx_ + d[1] * 12, gy_ - d[0] * 12)]
        base_ang = {"fridge": -9, "ac": 12, "washer": 8}[p]
        ang = base_ang * (0.6 + 0.8 * s_["tension"]) - 6 * s_["ant"] * (1 if p == "fridge" else -1)
        e = exprs[p] if s_["pull"] > 0.2 or s_["tension"] > 0.7 else "angry"
        pupil = (-d[0] * 0.7, -d[1] * 0.5)
        draw_appliance(c, p, px, py, 1.0, e, angle=ang, pupil=pupil, squash=s_["sq"], hands=hands,
                       legs="brace", lean_dir=1 if d[0] > 0 else -1, sweat=sweat)
    return disp, pos, (bar_cx, bar_cy, bar_w), st


# ======================================================================================
# scenes
# ======================================================================================
def scene_open(c: Canvas, t):
    sweat = ((t * 1.4) % 1.0) if t > 1.2 else 0.0
    cracks = seg(t, 1.9, 3.4) * 0.8
    stretch = 1.0 + 0.08 * seg(t, 0, 3.4)
    draw_tug(c, t, HEAVES_OPEN, stretch=stretch, cracks=cracks, sweat=sweat)
    f = font(HEAD, 56)
    lay = c.new_layer()
    draw_bubble(c, 250, 560, ["لي!"], f, lay, tail=(200, 660), scale=bubble_pop(t, 0.3), shake_amt=2, t=t)
    draw_bubble(c, 790, 330, ["أنا اثنين!"], f, lay, tail=(810, 480), scale=bubble_pop(t, 0.85), shake_amt=2, t=t)
    draw_bubble(c, 690, 1620, ["لا لي!"], f, lay, tail=(790, 1520), scale=bubble_pop(t, 1.4), shake_amt=2, t=t)
    c.composite(lay)
    title_plate(c, ["كل جهاز يبي الميزانية له!"], 190, ease_out_cubic(seg(t, 2.0, 2.35)), size=66)


def scene_ctx(c: Canvas, t):
    floor_line(c, 1620)
    items = [(0.0, 640, "عريس", "ring"), (0.65, 940, "بيت جديد", "keys"),
             (1.3, 1240, "15,000 ريال للأجهزة", "bar")]
    for t0, y, label, icon in items:
        k = seg(t, t0, t0 + 0.3)
        if k <= 0:
            continue
        sc = lerp(2.4, 1.0, ease_in_cubic(k))
        wob = ease_out_elastic(seg(t, t0 + 0.3, t0 + 0.9))
        rot = lerp(-16, -4, ease_in_cubic(k)) + (1 - wob) * 3
        lay = c.new_layer()
        w, h = 780 * sc, 214 * sc
        c.rect(540 - w / 2, y - h / 2, 540 + w / 2, y + h / 2, WHITE, radius=34 * sc,
               outline=INK, width=6 * sc, layer=lay)
        if icon == "ring":
            draw_ring(c, 860, y + 10, 42 * sc, lay)
            c.text(700, y - 6, label, font(HEAD, int(84 * sc)), INK, layer=lay)
        elif icon == "keys":
            draw_keys(c, 810, y - 4, 30 * sc, lay)
            c.text(700, y - 6, label, font(HEAD, int(84 * sc)), INK, layer=lay)
        else:
            draw_bar(c, 850, y, 150 * sc, 60 * sc, lay, label="", sub="", s=0.6 * sc)
            c.text(470, y - 6, label, font(HEAD, int(64 * sc)), INK, layer=lay)
        c.paste_rotated(lay, rot, (540, y), k)
        if k >= 1:
            lay = c.new_layer()
            draw_dust(c, 540, y + h / 2, 1.6, lay, k=seg(t, t0 + 0.3, t0 + 0.75), spread=3.0)
            c.composite(lay)
    a = ease_out_cubic(seg(t, 1.8, 2.1))
    if a > 0:
        headline(c, ["مكيفات + ثلاجة + غسالة… والخيارات ما تنعدّ"], 1470, size=44, color=INK_SOFT, alpha=a)


def draw_aftermath(c: Canvas, u, push=0.0, dim=True):
    """u = seconds since the snap. push (0..1) shoves everything away from the logo landing spot."""
    floor_line(c)
    k = seg(u, 0, 0.5)
    e = ease_out_cubic(k)
    center = (540, 1000)

    def pushed(x, y, amount=700):
        if push <= 0:
            return x, y
        dx, dy = _unit(center, (x, y))
        q = ease_in_cubic(push)
        return x + dx * amount * q, y + dy * amount * q

    # appliances recoil away from the bar (overshoot), then settle
    rec = ease_out_back(seg(u, 0, 0.45), s=2.5)
    placed = {}
    for p in PULLERS:
        d = _unit(BAR0, BASE[p])
        px = BASE[p][0] + d[0] * 90 * rec
        py = BASE[p][1] + d[1] * 90 * rec
        placed[p] = (px, py)
    # the groom: launched back, lands sitting
    if u < 0.25:
        q = ease_out_cubic(u / 0.25)
        lay = c.new_layer()
        draw_groom(c, 540, 1235 - 140 * q, 1.0, "shocked", lay, hands=[(360, 980 - 80 * q), (720, 980 - 80 * q)],
                   lean=0, stride=30, flap=1.0, shadow=False)
        draw_motion_lines(c, 540, 1500, 0, -1, 1.0, lay, n=4, length=90)
        c.paste_rotated(lay, -20 * q, (540, 1300))
    else:
        q = ease_in_cubic(seg(u, 0.25, 0.48))
        gy = 1330 - 160 * (1 - q)
        gx, gy = pushed(540, gy)
        lay = c.new_layer()
        draw_groom(c, gx, gy, 1.0, "dizzy" if u > 0.5 else "shocked", lay, pose="sit")
        c.composite(lay)
        if u >= 0.48:
            lay = c.new_layer()
            draw_dust(c, gx, gy + 110, 1.8, lay, k=seg(u, 0.48, 1.0), spread=3.5)
            c.composite(lay)
        if u > 0.55:
            lay = c.new_layer()
            draw_dizzy_stars(c, gx, gy - 300, u, 1.0, lay)
            c.composite(lay)
    # fragments fly to the appliances (arc), then are held
    starts = {"fridge": (440, 1000), "ac": (540, 1000), "washer": (640, 1000)}
    widths = {"fridge": 170, "ac": 230, "washer": 90}
    frag = {}
    for p in PULLERS:
        px, py = placed[p]
        tgt = {"fridge": (px + 40, py + 150), "ac": (px, py + 125), "washer": (px - 60, py - 165)}[p]
        sx, sy = starts[p]
        x, y = lerp(sx, tgt[0], e), lerp(sy, tgt[1], e) - 140 * math.sin(math.pi * e)
        frag[p] = (x, y)
    exprs = {"fridge": "happy", "ac": "smug", "washer": "sad" if u > 0.7 else "shocked"}
    for p in PULLERS:
        px, py = pushed(*placed[p])
        fx, fy = pushed(*frag[p])
        ang = {"fridge": -14 * (1 - seg(u, 0.45, 0.9)) - 4, "ac": 360 * ease_out_cubic(seg(u, 0, 0.7)) + 8,
               "washer": 6 + 10 * math.sin(u * 30) * (1 - seg(u, 0, 0.5))}[p] + 40 * push
        hands = None
        if u > 0.5 and p != "washer":
            hands = [(fx - widths[p] / 2 + 20, fy - 30), (fx + widths[p] / 2 - 20, fy - 30)]
        elif u > 0.5:
            hands = [(fx - 20, fy + 20), (fx + 20, fy + 20)]
        draw_appliance(c, p, px, py, 1.0, exprs[p], angle=ang, hands=hands, legs="stand",
                       pupil=(0, 0.5) if p == "washer" else (0, 0))
        lay = c.new_layer()
        draw_bar(c, fx, fy, widths[p], 90, lay, label="كم؟", sub="", s=0.8)
        c.composite(lay)
    if 0 < u < 0.4:
        lay = c.new_layer()
        for p in PULLERS:
            d = _unit(BAR0, BASE[p])
            draw_motion_lines(c, placed[p][0] - d[0] * 120, placed[p][1] - d[1] * 120, d[0], d[1], 1.0, lay,
                              n=3, length=80, alpha=int(200 * (1 - u / 0.4)))
        c.composite(lay)
    # the washer's complaint
    lay = c.new_layer()
    wx, wy = pushed(*placed["washer"])
    draw_bubble(c, wx - 300, wy + 60, ["وأنا؟!"], font(HEAD, 56), lay, tail=(wx - 130, wy + 40),
                scale=bubble_pop(u, 0.75), shake_amt=2, t=u)
    c.composite(lay)


def scene_esc(c: Canvas, t):
    if t < 1.8:
        stretch = 1.0 + 0.32 * ease_in_cubic(t / 1.8)
        draw_tug(c, t, HEAVES_ESC, stretch=stretch, cracks=0.3 + 0.7 * seg(t, 0, 1.75), sweat=(t * 1.8) % 1.0)
        title_plate(c, ["كم لكل جهاز؟", "ومن أي متجر؟"], 210, ease_out_cubic(seg(t, 0.1, 0.4)), size=60, line_h=74)
    else:
        draw_aftermath(c, t - 1.8)
        title_plate(c, ["كم لكل جهاز؟", "ومن أي متجر؟"], 210, 1.0, size=60, line_h=74)


def scene_line(c: Canvas, t):
    draw_aftermath(c, (T_ESC[1] - SNAP) + t)
    c.tint((20, 30, 26), 0.28 * ease_out_cubic(seg(t, 0, 0.3)))
    c.vignette(0.45)
    k = bubble_pop(t, 0.15, 0.35)
    lay = c.new_layer()
    draw_bubble(c, 540, 560, ["يا جماعة…", "أبي أجهّز بيت، مو جهاز!"], font(HEAD, 74), lay,
                tail=(560, 900), scale=k, line_h=96, pad=44, radius=44)
    c.composite(lay)


def scene_turn(c: Canvas, t):
    push = seg(t, 0.42, 0.95)
    if t < 1.0:
        draw_aftermath(c, (T_ESC[1] - SNAP) + (T_LINE[1] - T_LINE[0]) + t, push=push)
        c.tint((20, 30, 26), 0.28 * (1 - seg(t, 0.4, 0.9)))
    # mint flood from the landing spot
    k = ease_in_out(seg(t, 0.4, 0.95))
    if k > 0:
        lay = c.new_layer()
        c.circle(540, 1000, lerp(0, 2300, k), MINT, layer=lay)
        c.composite(lay)
    if t >= 0.95:
        c.im.paste(rgba(MINT), [0, 0, c.im.width, c.im.height])
        c.d = ImageDraw.Draw(c.im)
    # shockwave rings
    lay = c.new_layer()
    for i in range(3):
        kk = seg(t, 0.36 + i * 0.12, 1.1 + i * 0.12)
        if 0 < kk < 1:
            r = lerp(120, 1500, ease_out_cubic(kk))
            c.circle(540, 1000, r, None, outline=rgba(WHITE, int(220 * (1 - kk))), width=18 * (1 - kk) + 3, layer=lay)
    c.composite(lay)
    # the logo drops in like a stamp
    fall = ease_in_cubic(seg(t, 0.0, 0.36))
    y = lerp(-260, 1000, fall)
    if t < 0.36:
        lay = c.new_layer()
        draw_motion_lines(c, 540, y - 200, 0, 1, 1.0, lay, n=4, length=120)
        c.composite(lay)
    imp = ease_out_elastic(seg(t, 0.36, 1.0))
    sqx = lerp(1.22, 1.0, imp) if t >= 0.36 else 1.0
    sqy = lerp(0.78, 1.0, imp) if t >= 0.36 else 1.0
    m = ease_in_out(seg(t, 1.85, 2.2))
    size = lerp(360, 100, m)
    cx = lerp(540, 975, m)
    cy = lerp(1000 if t >= 0.36 else y, 300, m)
    if t >= 0.36:
        lay = c.new_layer()
        draw_dust(c, 540, 1180, 2.2, lay, k=seg(t, 0.36, 0.9), spread=3.0)
        c.composite(lay)
    c.shadow(lambda lay: paste_logo(c, cx, cy + 12, size * sqx, layer=lay), blur=18, offset=(0, 18), alpha=70)
    # squash: paste through a resized layer
    lay = c.new_layer()
    paste_logo(c, cx, cy, size, layer=lay)
    if abs(sqx - 1) > 0.01:
        lw, lh = lay.size
        stretched = lay.resize((int(lw * sqx), int(lh * sqy)), Image.BILINEAR)
        base = Image.new("RGBA", lay.size, (0, 0, 0, 0))
        base.alpha_composite(stretched, (int(cx * SS - cx * SS * sqx), int(cy * SS - cy * SS * sqy)))
        lay = base
    c.composite(lay)
    a = ease_out_cubic(seg(t, 1.0, 1.3)) * (1 - ease_in_out(seg(t, 1.8, 2.1)))
    if a > 0:
        headline(c, ["توفيري يرتّبها لك"], 1330, size=92, color=WHITE, alpha=a)
        headline(c, ["خطة أجهزة… على قد ميزانيتك"], 1450, size=44, color=rgba(WHITE, 230), alpha=a)


def scene_ui(c: Canvas, t, shot):
    cfg = UI_SHOTS[shot]
    c.im.paste(rgba(CREAM), [0, 0, c.im.width, c.im.height])
    c.d = ImageDraw.Draw(c.im)
    paste_logo(c, 975, 300, 100)
    ent = ease_out_cubic(seg(t, 0.0, 0.35))
    lay = c.new_layer()
    n = len(cfg["title"])
    headline(c, cfg["title"], 330 if n == 1 else 350, size=66, color=INK, layer=lay, line_h=76)
    headline(c, [cfg["sub"]], 420 if n == 1 else 470, size=36, color=INK_SOFT, layer=lay)
    # accent underline grows in
    uw = 220 * ease_out_cubic(seg(t, 0.2, 0.6))
    c.rect(540 - uw / 2, 385 if n == 1 else 440, 540 + uw / 2, (385 if n == 1 else 440) + 6, MINT, radius=3, layer=lay)
    c.composite(lay, ent)
    lay = c.new_layer()
    y = 560
    xs = [820, 540, 260]
    for i, name in enumerate(STEPS):
        active = i == cfg["step"]
        done = i < cfg["step"]
        col = GREEN if active else (MINT if done else (215, 222, 218))
        c.rect(xs[i] - 120, y - 26, xs[i] + 120, y + 26, col, radius=26, layer=lay)
        c.text(xs[i], y - 2, f"{i + 1}. {name}", font(BOLD, 28), WHITE if (active or done) else INK_SOFT, layer=lay)
    c.composite(lay, ent)
    # the screen card, with a slow push-in (Ken Burns) toward the focus point
    idx = int(t * 30)
    im = ui_frame(shot, idx)
    cw, ch = im.width / SS, im.height / SS
    cx, top = 540, 625
    z = 1.0 + 0.06 * ease_in_out(seg(t, 0, 2.6))
    fx, fy = cfg["focus"]
    zi = im.resize((int(im.width * z), int(im.height * z)), Image.BILINEAR)
    ox = int(-(zi.width - im.width) * fx)
    oy = int(-(zi.height - im.height) * fy)
    canvas_im = Image.new("RGB", im.size, (255, 255, 255))
    canvas_im.paste(zi, (ox, oy))
    im = canvas_im
    slide = (1 - ent) * 80
    lay = c.new_layer()
    c.rect(cx - cw / 2 - 12, top - 12 + slide, cx + cw / 2 + 12, top + ch + 12 + slide, WHITE,
           radius=40, outline=(220, 226, 222), width=2, layer=lay)
    c.composite(lay, ent)
    c.shadow(lambda l: c.rect(cx - cw / 2, top + slide, cx + cw / 2, top + ch + slide, WHITE, radius=30, layer=l),
             blur=24, offset=(0, 22), alpha=60)
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=30 * SS, fill=255)
    card = Image.new("RGBA", im.size, (0, 0, 0, 0))
    card.paste(im, (0, 0), mask)
    if ent < 1:
        card.putalpha(card.getchannel("A").point(lambda v: int(v * ent)))
    c.im.alpha_composite(card, (int((cx - cw / 2) * SS), int((top + slide) * SS)))
    c.d = ImageDraw.Draw(c.im)

    def src_to_screen(sx_, sy_):
        """source-frame coords -> screen coords (accounting for crop, scale and the push-in)."""
        x = (sx_ - cfg["crop"][0]) * cfg["scale"] * z + ox / SS
        y_ = (sy_ - cfg["crop"][1]) * cfg["scale"] * z + oy / SS
        return cx - cw / 2 + x, top + y_

    for key in ("ring", "ring2"):
        if key in cfg:
            t0, (x0, y0, x1, y1) = cfg[key]
            k = ease_out_back(seg(t, t0, t0 + 0.3), s=2.2)
            if k > 0:
                ax, ay = src_to_screen(x0, y0)
                bx, by = src_to_screen(x1, y1)
                mx, my = (ax + bx) / 2, (ay + by) / 2
                hw, hh = (bx - ax) / 2 * k + 14, (by - ay) / 2 * k + 12
                lay = c.new_layer()
                c.rect(mx - hw, my - hh, mx + hw, my + hh, None, radius=min(hw, hh), outline=GOLD, width=6, layer=lay)
                c.composite(lay)
    if "share" in cfg:
        t0, (sx_, sy_) = cfg["share"]
        k = bubble_pop(t, t0, 0.3)
        if k > 0:
            x, y_ = src_to_screen(sx_, sy_)
            lay = c.new_layer()
            c.circle(x, y_, 36 * k, None, outline=GOLD, width=6, layer=lay)
            draw_bubble(c, x + 200, y_ + 140, ["شاركها مع أهلك"], font(HEAD, 40), lay,
                        tail=(x + 16, y_ + 34), scale=k, fill=GOLD, color=WHITE)
            c.composite(lay)


def scene_pay(c: Canvas, t):
    c.im.paste(rgba(CREAM), [0, 0, c.im.width, c.im.height])
    c.d = ImageDraw.Draw(c.im)
    floor_line(c, 1600)
    bx0, bx1, by = 250, 830, 1040
    total = bx1 - bx0
    # segment geometry, RTL order: AC (right) · fridge · washer (left)
    segs = []
    x = bx1
    for kind, share, label in SHARES:
        w = total * share - 6
        segs.append((kind, x - w, x, label))
        x -= w + 9
    snap = 0.55
    e = ease_out_back(seg(t, 0, snap), s=1.4)
    starts = {"ac": (1350, 420), "fridge": (-260, 700), "washer": (1320, 1500)}
    lay = c.new_layer()
    for kind, x0, x1, label in segs:
        mx = (x0 + x1) / 2
        sx, sy = starts[kind]
        px, py = lerp(sx, mx, e), lerp(sy, by, e)
        col = {"ac": GREEN, "fridge": MINT_DARK, "washer": GREEN_DEEP}[kind]
        c.rect(px - (x1 - x0) / 2, py - 45, px + (x1 - x0) / 2, py + 45, col, radius=18, layer=lay)
        lab_k = seg(t, snap + 0.05, snap + 0.3)
        if lab_k < 1:
            c.text(px, py - 4, "كم؟", font(HEAD, 40), rgba(WHITE, int(255 * (1 - lab_k))), layer=lay)
        if lab_k > 0:
            c.text(px, py - 4, label, font(BOLD, 30 if kind == "ac" else 26), rgba(WHITE, int(255 * lab_k)), layer=lay)
    c.composite(lay)
    if snap <= t < snap + 0.5:
        kk = seg(t, snap, snap + 0.5)
        lay = c.new_layer()
        c.rect(bx0 - 20 - 60 * kk, by - 65 - 40 * kk, bx1 + 20 + 60 * kk, by + 65 + 40 * kk, None, radius=40,
               outline=rgba(GOLD, int(230 * (1 - kk))), width=8 * (1 - kk) + 2, layer=lay)
        c.composite(lay)
    lay = c.new_layer()
    draw_check_badge(c, bx1 + 30, by - 50, 34, lay, scale=ease_out_back(seg(t, 0.75, 1.05), s=2.6))
    c.composite(lay)
    # the appliances hop onto their shares
    feet = {"ac": 926, "fridge": 883, "washer": 905}
    scl = {"ac": 0.7, "fridge": 0.55, "washer": 0.55}
    for i, (kind, x0, x1, _) in enumerate(segs):
        t0 = 0.75 + i * 0.25
        p = ease_out_back(seg(t, t0, t0 + 0.4), s=1.6)
        if p <= 0:
            continue
        mx = (x0 + x1) / 2
        cy = feet[kind] + (1 - p) * 420
        bounce = 1 - 0.1 * math.sin(clamp((t - t0 - 0.4) / 0.25) * math.pi)
        draw_appliance(c, kind, mx, cy, scl[kind], "happy", squash=(1 / bounce, bounce), legs="stand", shadow=False)
    # groom relaxed with the phone
    p = ease_out_cubic(seg(t, 0.9, 1.3))
    if p > 0:
        lay = c.new_layer()
        draw_groom(c, 190, 1150 + (1 - p) * 160, 0.78, "relaxed", lay,
                   hands=[(120, 1330), (300, 1250)], phone=True, thumbs_up=True, flap=0.2)
        c.composite(lay, p)
    a = ease_out_cubic(seg(t, 1.15, 1.5))
    if a > 0:
        headline(c, ["كلٍّ أخذ نصيبه…"], 300, size=78, color=INK, alpha=a)
    a2 = ease_out_cubic(seg(t, 1.6, 1.95))
    if a2 > 0:
        headline(c, ["وخطة أجهزتك جاهزة"], 410, size=78, color=GREEN_DEEP, alpha=a2)


def scene_cta(c: Canvas, t):
    c.gradient_bg(MINT, GREEN_DEEP)
    e = ease_out_back(seg(t, 0.0, 0.5), s=1.8)
    if e > 0.02:
        c.shadow(lambda lay: paste_logo(c, 540, 650, 280 * e, layer=lay), blur=20, offset=(0, 20), alpha=80)
        paste_logo(c, 540, 640, 280 * e)
    a = ease_out_cubic(seg(t, 0.35, 0.7))
    if a > 0:
        headline(c, ["ابدأ خطة بيتك"], 940 + (1 - a) * 30, size=110, color=WHITE, alpha=a)
    a2 = ease_out_cubic(seg(t, 0.6, 0.95))
    if a2 > 0:
        lay = c.new_layer()
        c.rect(210, 1030, 870, 1140, WHITE, radius=55, layer=lay)
        c.text(540, 1082, "tawveeri.com", font(HEAD, 64), GREEN_DEEP, layer=lay, rtl=False)
        c.composite(lay, a2)
        headline(c, ["جهّز بيتك بذكاء"], 1240, size=54, color=WHITE, alpha=a2)
    a3 = ease_out_cubic(seg(t, 0.9, 1.2))
    if a3 > 0:
        headline(c, ["الخطة لأجهزة البيت · الشراء يتم لدى المتاجر"], 1340, size=28, color=rgba(WHITE, 215),
                 alpha=a3, fnt=font(MED, 28))


# ======================================================================================
# dispatcher
# ======================================================================================
def _shake_frame(c: Canvas, t, amp, seed):
    dx, dy = int(shake(t, amp, 27, seed) * SS), int(shake(t, amp, 31, seed + 1) * SS)
    c.im = ImageChops.offset(c.im, dx, dy)
    c.d = ImageDraw.Draw(c.im)


def frame(t: float) -> Image.Image:
    c = Canvas(CREAM)
    if t < T_OPEN[1]:
        tl = t - T_OPEN[0]
        scene_open(c, tl)
        _, st, skid = pull_state(tl, HEAVES_OPEN)
        _shake_frame(c, t, 3 + 9 * skid, 1)
    elif t < T_CTX[1]:
        scene_ctx(c, t - T_CTX[0])
        tl = t - T_CTX[0]
        hit = max(seg(tl, t0 + 0.3, t0 + 0.3 + 0.001) * (1 - seg(tl, t0 + 0.3, t0 + 0.55)) for t0 in (0.0, 0.65, 1.3))
        if hit > 0:
            _shake_frame(c, t, 10 * hit, 2)
    elif t < T_ESC[1]:
        tl = t - T_ESC[0]
        scene_esc(c, tl)
        if tl < 1.8:
            _, st, skid = pull_state(tl, HEAVES_ESC)
            _shake_frame(c, t, 5 + 10 * skid + 6 * seg(tl, 1.2, 1.8), 3)
        elif tl < 2.3:
            _shake_frame(c, t, 14 * (1 - seg(tl, 1.8, 2.3)), 4)
        if 1.8 <= tl < 1.95:
            c.tint(WHITE, 0.85 * (1 - seg(tl, 1.8, 1.95)))
    elif t < T_LINE[1]:
        scene_line(c, t - T_LINE[0])
    elif t < T_TURN[1]:
        tl = t - T_TURN[0]
        scene_turn(c, tl)
        if 0.36 <= tl < 0.7:
            _shake_frame(c, t, 16 * (1 - seg(tl, 0.36, 0.7)), 5)
    elif t < T_UI[-1][2]:
        for shot, a, b in T_UI:
            if t < b:
                scene_ui(c, t - a, shot)
                break
    elif t < T_PAY[1]:
        tl = t - T_PAY[0]
        scene_pay(c, tl)
        if 0.55 <= tl < 0.8:
            _shake_frame(c, t, 8 * (1 - seg(tl, 0.55, 0.8)), 6)
    else:
        scene_cta(c, t - T_CTA[0])
    return c.finish()


def cover() -> Image.Image:
    """Cover: the tug at its most legible moment + a clean brand strip below the action."""
    c = Canvas(CREAM)
    tl = 2.75
    scene_open(c, tl)
    lay = c.new_layer()
    c.rect(70, 1740, 1010, 1880, rgba(WHITE, 245), radius=40, outline=MINT, width=4, layer=lay)
    paste_logo(c, 905, 1810, 110, layer=lay)
    c.line([(820, 1770), (820, 1850)], (222, 227, 222), 3, lay)
    c.text(450, 1792, "جهّز بيتك بذكاء", font(HEAD, 56), INK, layer=lay)
    c.text(450, 1848, "ابدأ خطة بيتك · tawveeri.com", font(BOLD, 32), INK_SOFT, layer=lay)
    c.composite(lay)
    return c.finish()
