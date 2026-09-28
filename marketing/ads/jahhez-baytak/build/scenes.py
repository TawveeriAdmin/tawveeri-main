"""Timeline + scene drawing for the «جهّز بيتك بذكاء» ad. frame(t) -> PIL RGB image."""
from __future__ import annotations

import math
import os
from functools import lru_cache

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from characters import (
    APPLIANCE_LABEL, draw_appliance, draw_bar, draw_bubble, draw_check_badge, draw_groom,
    draw_house, draw_keys, draw_ring, draw_rope,
)
from common import (
    BLACK, BOLD, CREAM, GOLD, GREEN, GREEN_DEEP, H, HEAD, INK, INK_SOFT, MED, MINT, MINT_DARK,
    RED, SS, W, WHITE, Canvas, clamp, ease_in_cubic, ease_in_out, ease_out_back, ease_out_cubic,
    font, lerp, paste_logo, rgba, seg, shake,
)

UI_DIR = os.environ.get("AD_UI_DIR", "/tmp/claude-0/-home-user-tawveeri-main/4dc8aa92-1ec1-5288-8ec7-2880e0b7ef46/scratchpad/work/ui")

# --------------------------------------------------------------------------------------
# timeline (seconds)
# --------------------------------------------------------------------------------------
T_OPEN = (0.0, 3.2)
T_CTX = (3.2, 5.6)
T_ESC = (5.6, 8.2)
T_FREEZE = (8.2, 10.4)
T_TURN = (10.4, 12.4)
T_UI = [
    ("A", 12.4, 14.9),
    ("B", 14.9, 17.4),
    ("C1", 17.4, 19.9),
    ("C2", 19.9, 22.4),
]
T_PAY = (22.4, 25.4)
T_CTA = (25.4, 28.5)
DURATION = T_CTA[1]

# real plan shares (from the recording: AC 2x2,766=5,532 · fridge 1,799 · washer 2,299 of 9,630)
SHARES = [("ac", 5532 / 9630, "التكييف ×2"), ("fridge", 1799 / 9630, "الثلاجة"),
          ("washer", 2299 / 9630, "الغسالة")]

UI_SHOTS = {
    # crop in source (576x1024) coords, scale factor
    "A": dict(crop=(0, 280, 576, 760), scale=1.5,
              title=["حدّد أجهزتك"], sub="مكيفين، ثلاجة، غسالة… بالعدد اللي تبيه", step=0),
    "B": dict(crop=(0, 430, 576, 990), scale=1.5,
              title=["وحدّد مساحاتك وميزانيتك"], sub="غرفة النوم، الصالة، وكم معك للأجهزة", step=1),
    "C1": dict(crop=(0, 20, 576, 600), scale=1.5,
               title=["تطلع لك خطة", "من عروض المتاجر"], sub="وتشاركها مع أهلك قبل ما تشتري", step=2),
    "C2": dict(crop=(0, 330, 576, 1000), scale=1.3,
               title=["كل جهاز أخذ نصيبه"], sub="الشراء من المتجر نفسه — والأسعار كما رُصدت، تتغيّر", step=2),
}
STEPS = ["احتياجاتك", "ميزانيتك", "خطة أجهزتك"]


@lru_cache(maxsize=512)
def ui_frame(shot: str, idx: int) -> Image.Image:
    files = sorted(os.listdir(os.path.join(UI_DIR, shot)))
    idx = max(0, min(idx, len(files) - 1))
    im = Image.open(os.path.join(UI_DIR, shot, files[idx])).convert("RGB")
    cfg = UI_SHOTS[shot]
    x0, y0, x1, y1 = cfg["crop"]
    im = im.crop((x0, y0, x1, y1))
    sc = cfg["scale"] * SS
    im = im.resize((int((x1 - x0) * sc), int((y1 - y0) * sc)), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
    return im


# --------------------------------------------------------------------------------------
# reusable bits
# --------------------------------------------------------------------------------------
def headline(c: Canvas, lines, y, size=76, color=INK, alpha=1.0, layer=None, line_h=None, fnt=None):
    fnt = fnt or font(HEAD, size)
    c.text_lines(540, y, lines, fnt, rgba(color, 255 * alpha), line_h or size * 1.18, layer=layer)


def cast_positions(t, tension):
    """Appliance anchor positions during the tug-of-war; jitter grows with tension."""
    j = tension * 6
    return {
        "fridge": (190 + shake(t, j, 19, 1), 800 + shake(t, j, 17, 2)),
        "ac": (800 + shake(t, j, 21, 3), 560 + shake(t, j, 16, 4)),
        "washer": (860 + shake(t, j, 18, 5), 1420 + shake(t, j, 20, 6)),
    }


def draw_tug(c: Canvas, t, tension, bar_stretch, cracks, groom_expr, bubbles=True,
             bar_alpha=1.0, appl_expr=None, lean=1.0):
    """The core tug-of-war tableau."""
    pos = cast_positions(t, tension)
    bar_cx, bar_cy = 540 + shake(t, tension * 5, 25, 7), 1000 + shake(t, tension * 4, 22, 8)
    bar_w = 420 * bar_stretch
    bar_l = (bar_cx - bar_w / 2 + 10, bar_cy)
    bar_r = (bar_cx + bar_w / 2 - 10, bar_cy)
    # ropes (behind everything)
    lay = c.new_layer()
    draw_rope(c, bar_l, (pos["fridge"][0] + 95, pos["fridge"][1] + 60), lay, tension=tension)
    draw_rope(c, bar_r, (pos["ac"][0] - 40, pos["ac"][1] + 70), lay, tension=tension)
    draw_rope(c, bar_r, (pos["washer"][0] - 100, pos["washer"][1] - 60), lay, tension=tension)
    c.composite(lay)
    # groom
    lay = c.new_layer()
    draw_groom(c, 540, 1235, 1.0, groom_expr, lay, hands=[bar_l, bar_r])
    c.composite(lay)
    # bar
    lay = c.new_layer()
    draw_bar(c, bar_cx, bar_cy, bar_w, 110, lay, cracks=cracks)
    c.composite(lay, bar_alpha)
    # appliances leaning away (pulling)
    ex = appl_expr or {"fridge": "angry", "ac": "shout", "washer": "angry"}
    draw_appliance(c, "fridge", *pos["fridge"], 1.0, ex["fridge"], angle=-10 * lean + shake(t, tension * 2, 13, 9),
                   pupil_dx=0.6)
    draw_appliance(c, "ac", *pos["ac"], 1.0, ex["ac"], angle=12 * lean + shake(t, tension * 2, 15, 10),
                   pupil_dx=-0.6)
    draw_appliance(c, "washer", *pos["washer"], 1.0, ex["washer"], angle=9 * lean + shake(t, tension * 2, 14, 11),
                   pupil_dx=-0.6)
    return pos, (bar_cx, bar_cy, bar_w)


def bubble_pop(t, t0, dur=0.28):
    return ease_out_back(seg(t, t0, t0 + dur))


# --------------------------------------------------------------------------------------
# scenes
# --------------------------------------------------------------------------------------
def scene_open(c: Canvas, t):
    """Cold open: everybody pulls on the budget."""
    tension = clamp(0.5 + t * 0.25)
    stretch = 1.0 + 0.06 * math.sin(t * 9) + 0.05 * clamp(t / 3)
    cracks = seg(t, 1.6, 3.0)
    draw_tug(c, t, tension, stretch, cracks, "shocked" if t > 1.2 else "angry")
    # bubbles
    f = font(HEAD, 56)
    lay = c.new_layer()
    draw_bubble(c, 250, 560, ["لي!"], f, lay, tail=(200, 660), scale=bubble_pop(t, 0.35))
    draw_bubble(c, 790, 330, ["أنا اثنين!"], f, lay, tail=(810, 480), scale=bubble_pop(t, 0.85))
    draw_bubble(c, 700, 1600, ["لا، لي!"], f, lay, tail=(790, 1520), scale=bubble_pop(t, 1.35))
    c.composite(lay)
    # headline
    a = ease_out_cubic(seg(t, 1.9, 2.3))
    if a > 0:
        lay = c.new_layer()
        c.rect(120, 130, 960, 250, rgba(INK, 235), radius=30, layer=lay)
        headline(c, ["كلٍّ يبي الميزانية له!"], 190 - (1 - a) * 30, size=68, color=WHITE, layer=lay)
        c.composite(lay, a)


def scene_ctx(c: Canvas, t):
    """Three stamps: groom · new home · 15,000 for appliances."""
    items = [
        (0.0, 640, "عريس", "ring"),
        (0.65, 940, "بيت جديد", "keys"),
        (1.3, 1240, "15,000 ريال للأجهزة", "bar"),
    ]
    f = font(HEAD, 84)
    for t0, y, label, icon in items:
        k = seg(t, t0, t0 + 0.32)
        if k <= 0:
            continue
        sc = lerp(2.2, 1.0, ease_in_cubic(k))
        a = k
        rot = lerp(-14, -4, ease_in_cubic(k))
        lay = c.new_layer()
        w = 760 * sc
        h = 210 * sc
        c.rect(540 - w / 2, y - h / 2, 540 + w / 2, y + h / 2, WHITE, radius=34 * sc,
               outline=INK, width=6 * sc, layer=lay)
        if icon == "ring":
            draw_ring(c, 860, y + 10, 42 * sc, lay)
        elif icon == "keys":
            draw_keys(c, 810, y - 4, 30 * sc, lay)
        else:
            draw_bar(c, 850, y, 150 * sc, 60 * sc, lay, label="", sub="", s=0.6 * sc)
        if icon == "bar":
            c.text(470, y - 6, label, font(HEAD, int(64 * sc)), INK, layer=lay)
        else:
            c.text(700, y - 6, label, font(HEAD, int(84 * sc)), INK, layer=lay)
        # impact dust
        if k >= 1 and t < t0 + 0.55:
            kk = seg(t, t0 + 0.32, t0 + 0.55)
            r = lerp(20, 120, kk)
            c.rect(540 - w / 2 - r, y - h / 2 - r * 0.4, 540 + w / 2 + r, y + h / 2 + r * 0.4, None,
                   radius=40, outline=rgba(INK, 140 * (1 - kk)), width=6 * (1 - kk) + 1, layer=lay)
        c.paste_rotated(lay, rot, (540, y), a)
    # small line
    a = ease_out_cubic(seg(t, 1.75, 2.05))
    if a > 0:
        headline(c, ["مكيفات + ثلاجة + غسالة… والخيارات ما تنعدّ"], 1470, size=44, color=INK_SOFT, alpha=a)


def scene_esc(c: Canvas, t):
    """Escalation: the bar snaps into pieces, the groom spins."""
    snap = 1.15  # local time of the snap
    if t < snap:
        tension = 1.0
        stretch = 1.05 + 0.10 * ease_in_out(seg(t, 0, snap))
        draw_tug(c, t, tension, stretch, 1.0, "shocked", lean=1.3)
    else:
        k = seg(t, snap, snap + 0.7)
        e = ease_out_cubic(k)
        pos = cast_positions(t, 0.6)
        # ropes fall slack toward appliances
        lay = c.new_layer()
        # groom spinning
        ang = 28 * math.sin((t - snap) * 9) * (1 - k * 0.5)
        hands = [(540 - 190 - 60 * e, 1060 + 120 * e), (540 + 190 + 60 * e, 1060 - 60 * e)]
        draw_groom(c, 540, 1235, 1.0, "shocked", lay, hands=hands)
        c.paste_rotated(lay, ang, (540, 1360))
        # fragments fly to each appliance
        targets = {"fridge": (pos["fridge"][0] + 40, pos["fridge"][1] + 150),
                   "ac": (pos["ac"][0], pos["ac"][1] + 130),
                   "washer": (pos["washer"][0] - 40, pos["washer"][1] - 150)}
        starts = {"fridge": (400, 1000), "ac": (540, 1000), "washer": (680, 1000)}
        widths = {"fridge": 160, "ac": 220, "washer": 120}
        ex = {"fridge": "happy", "ac": "happy", "washer": "sad"}
        draw_appliance(c, "fridge", *pos["fridge"], 1.0, ex["fridge"], angle=-6, pupil_dx=0.3)
        draw_appliance(c, "ac", *pos["ac"], 1.0, ex["ac"], angle=8, pupil_dx=-0.3)
        draw_appliance(c, "washer", *pos["washer"], 1.0, ex["washer"], angle=5, pupil_dx=-0.3)
        lay = c.new_layer()
        for kind in ("fridge", "ac", "washer"):
            sx, sy = starts[kind]
            tx, ty = targets[kind]
            x, y = lerp(sx, tx, e), lerp(sy, ty, e) - 120 * math.sin(math.pi * e)
            wdt = widths[kind]
            draw_bar(c, x, y, wdt, 90, lay, label="كم؟", sub="", s=0.8)
        c.composite(lay)
        # washer complains
        lay = c.new_layer()
        draw_bubble(c, 700, 1610, ["وأنا؟!"], font(HEAD, 56), lay, tail=(790, 1520),
                    scale=bubble_pop(t, snap + 0.6))
        c.composite(lay)
    # headline: the real decision problem
    a = ease_out_cubic(seg(t, 0.15, 0.5))
    if a > 0:
        lay = c.new_layer()
        c.rect(100, 120, 980, 300, rgba(INK, 235), radius=30, layer=lay)
        headline(c, ["كم لكل جهاز؟", "ومن أي متجر؟"], 210, size=60, color=WHITE, layer=lay, line_h=74)
        c.composite(lay, a)


def scene_freeze(c: Canvas, t):
    """Freeze frame + the groom's line."""
    scene_esc(c, T_ESC[1] - T_ESC[0])  # last pose, no headline change
    c.tint((20, 30, 26), 0.42 * ease_out_cubic(seg(t, 0, 0.25)))
    c.vignette(0.5)
    k = bubble_pop(t, 0.1, 0.35)
    lay = c.new_layer()
    draw_bubble(c, 540, 700, ["يا جماعة…", "أبي أجهّز بيت، مو جهاز!"], font(HEAD, 74), lay,
                tail=(560, 960), scale=k, line_h=96, pad=44, radius=44)
    c.composite(lay)


def scene_turn(c: Canvas, t):
    """Mint wipe, logo lands, «توفيري يرتّبها لك»."""
    # under-layer: frozen chaos fading
    if t < 0.6:
        scene_freeze(c, T_FREEZE[1] - T_FREEZE[0])
    # circular wipe
    k = ease_in_out(seg(t, 0, 0.55))
    if k > 0:
        lay = c.new_layer()
        r = lerp(0, 2300, k)
        c.circle(540, 1000, r, MINT, layer=lay)
        c.composite(lay)
    if t >= 0.55:
        c.im.paste(rgba(MINT), [0, 0, c.im.width, c.im.height])
        c.d = ImageDraw.Draw(c.im)
    # soft rings
    lay = c.new_layer()
    for i in range(3):
        kk = seg(t, 0.4 + i * 0.25, 1.6 + i * 0.25)
        if 0 < kk < 1:
            r = lerp(150, 900, kk)
            c.circle(540, 860, r, None, outline=rgba(WHITE, 120 * (1 - kk)), width=10, layer=lay)
    c.composite(lay)
    # logo drop with bounce
    e = ease_out_back(seg(t, 0.35, 0.95), s=2.2)
    if e > 0:
        # exit: logo moves to the top corner near the end
        m = ease_in_out(seg(t, 1.55, 2.0))
        size = lerp(360 * e, 100, m)
        cx = lerp(540, 975, m)
        cy = lerp(860, 300, m)
        c.shadow(lambda lay: paste_logo(c, cx, cy + 10, size, layer=lay), blur=18, offset=(0, 18), alpha=70)
        paste_logo(c, cx, cy, size)
    a = ease_out_cubic(seg(t, 0.8, 1.1)) * (1 - ease_in_out(seg(t, 1.55, 1.9)))
    if a > 0:
        headline(c, ["توفيري يرتّبها لك"], 1180, size=92, color=WHITE, alpha=a)
        headline(c, ["خطة أجهزة… على قد ميزانيتك"], 1300, size=44, color=rgba(WHITE, 230), alpha=a)


def scene_ui(c: Canvas, t, shot, t_local_start=0.0):
    """Real product shots inside a card, with a caption and step indicator."""
    cfg = UI_SHOTS[shot]
    c.im.paste(rgba(CREAM), [0, 0, c.im.width, c.im.height])
    c.d = ImageDraw.Draw(c.im)
    # top-right logo
    paste_logo(c, 975, 300, 100)
    # caption
    ent = ease_out_cubic(seg(t, 0.0, 0.35))
    lay = c.new_layer()
    n = len(cfg["title"])
    headline(c, cfg["title"], 330 if n == 1 else 350, size=66, color=INK, layer=lay, line_h=76)
    headline(c, [cfg["sub"]], 420 if n == 1 else 470, size=36, color=INK_SOFT, layer=lay)
    c.composite(lay, ent)
    # step indicator
    lay = c.new_layer()
    y = 560 if n == 1 else 560
    xs = [820, 540, 260]
    for i, name in enumerate(STEPS):
        active = i == cfg["step"]
        done = i < cfg["step"]
        col = GREEN if active else (MINT if done else (215, 222, 218))
        c.rect(xs[i] - 120, y - 26, xs[i] + 120, y + 26, col, radius=26, layer=lay)
        c.text(xs[i], y - 2, f"{i + 1}. {name}", font(BOLD, 28), WHITE if (active or done) else INK_SOFT,
               layer=lay)
    c.composite(lay, ent)
    # UI card
    idx = int((t - t_local_start) * 30)
    im = ui_frame(shot, idx)
    cw, ch = im.width / SS, im.height / SS
    cx, top = 540, 625
    slide = (1 - ent) * 80
    lay = c.new_layer()
    c.rect(cx - cw / 2 - 12, top - 12 + slide, cx + cw / 2 + 12, top + ch + 12 + slide, WHITE,
           radius=40, outline=(220, 226, 222), width=2, layer=lay)
    c.composite(lay, ent)
    c.shadow(lambda l: c.rect(cx - cw / 2, top + slide, cx + cw / 2, top + ch + slide, WHITE,
                              radius=30, layer=l), blur=24, offset=(0, 22), alpha=60)
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=30 * SS, fill=255)
    card = Image.new("RGBA", im.size, (0, 0, 0, 0))
    card.paste(im, (0, 0), mask)
    if ent < 1:
        card.putalpha(card.getchannel("A").point(lambda v: int(v * ent)))
    c.im.alpha_composite(card, (int((cx - cw / 2) * SS), int((top + slide) * SS)))
    c.d = ImageDraw.Draw(c.im)
    # callouts
    if shot == "C1":
        k = bubble_pop(t, 0.9, 0.3)
        if k > 0:
            # share icon sits at the top-left of the plan header (source ~ (90, 45))
            sx = cx - cw / 2 + (131 - cfg["crop"][0]) * cfg["scale"]
            sy = top + (62 - cfg["crop"][1]) * cfg["scale"]
            lay = c.new_layer()
            c.circle(sx, sy, 34 * k, None, outline=GOLD, width=5, layer=lay)
            draw_bubble(c, sx + 200, sy + 140, ["شاركها مع أهلك"], font(HEAD, 40), lay,
                        tail=(sx + 16, sy + 34), scale=k, fill=GOLD, color=WHITE)
            c.composite(lay)
    if shot == "B":
        k = bubble_pop(t, 1.9, 0.3)
        if k > 0:
            bx = cx - cw / 2 + 288 * cfg["scale"]
            by = top + (965 - cfg["crop"][1]) * cfg["scale"]
            lay = c.new_layer()
            c.rect(bx - 290 * k, by - 42 * k, bx + 290 * k, by + 42 * k, None, radius=42 * k,
                   outline=GOLD, width=6, layer=lay)
            c.composite(lay)


def scene_pay(c: Canvas, t):
    """Resolution: each appliance on its share, the home is set."""
    c.im.paste(rgba(CREAM), [0, 0, c.im.width, c.im.height])
    c.d = ImageDraw.Draw(c.im)
    # house grows in
    e = ease_out_back(seg(t, 0.0, 0.5), s=1.2)
    if e > 0.02:
        lay = c.new_layer()
        draw_house(c, 540, 1420 - 990 * e, 900 * e, 990 * e, lay, color=MINT, width=12)
        c.composite(lay)
    # segmented bar
    bx0, bx1, by = 330, 960, 1290
    k = ease_out_cubic(seg(t, 0.35, 0.8))
    lay = c.new_layer()
    x = bx0
    total = bx1 - bx0
    order = ["ac", "fridge", "washer"]
    centers = {}
    for kind, share, label in SHARES:
        w = total * share * k
        col = GREEN if kind != "washer" else GREEN_DEEP
        c.rect(x, by - 45, x + w, by + 45, col if kind != "fridge" else MINT_DARK, radius=18, layer=lay)
        if k > 0.9:
            c.text(x + w / 2, by - 4, label, font(BOLD, 30 if kind == "ac" else 26), WHITE, layer=lay)
        centers[kind] = x + w / 2
        x += w + 8 * k
    c.composite(lay)
    # appliances pop onto their shares
    for i, kind in enumerate(order):
        t0 = 0.75 + i * 0.35
        p = ease_out_back(seg(t, t0, t0 + 0.35), s=1.8)
        if p <= 0:
            continue
        sc = {"ac": 0.72, "fridge": 0.55, "washer": 0.55}[kind]
        cy = {"ac": 1120, "fridge": 1085, "washer": 1120}[kind]
        draw_appliance(c, kind, centers[kind], cy + (1 - p) * 60, sc * p, "happy")
        lay = c.new_layer()
        bx = centers[kind] + {"ac": 120, "fridge": 70, "washer": 75}[kind]
        draw_check_badge(c, bx, cy - {"ac": 50, "fridge": 105, "washer": 80}[kind], 26, lay,
                         scale=ease_out_back(seg(t, t0 + 0.2, t0 + 0.45), s=2.5))
        c.composite(lay)
    # groom relaxed with phone
    p = ease_out_cubic(seg(t, 0.4, 0.8))
    lay = c.new_layer()
    draw_groom(c, 200, 1100 + (1 - p) * 120, 0.78, "relaxed", lay,
               hands=[(150, 1300), (300, 1200)], phone=True, thumbs_up=True)
    c.composite(lay, p)
    # headline
    a = ease_out_cubic(seg(t, 1.2, 1.55))
    if a > 0:
        headline(c, ["كلٍّ أخذ نصيبه…", "والبيت جاهز"], 260, size=76, color=INK, alpha=a, line_h=90)
        headline(c, ["خطة واضحة قبل ما تشتري"], 400, size=40, color=INK_SOFT, alpha=a)


def scene_cta(c: Canvas, t):
    c.gradient_bg(MINT, GREEN_DEEP)
    e = ease_out_back(seg(t, 0.0, 0.5), s=1.8)
    if e > 0:
        c.shadow(lambda lay: paste_logo(c, 540, 640 + 10, 280 * e, layer=lay), blur=20, offset=(0, 20), alpha=80)
        paste_logo(c, 540, 640, 280 * e)
    a = ease_out_cubic(seg(t, 0.35, 0.7))
    if a > 0:
        headline(c, ["ابدأ خطة بيتك"], 930 + (1 - a) * 30, size=104, color=WHITE, alpha=a)
    a2 = ease_out_cubic(seg(t, 0.6, 0.95))
    if a2 > 0:
        lay = c.new_layer()
        c.rect(230, 1010, 850, 1110, WHITE, radius=50, layer=lay)
        c.text(540, 1057, "tawveeri.com", font(HEAD, 60), GREEN_DEEP, layer=lay, rtl=False)
        c.composite(lay, a2)
        headline(c, ["جهّز بيتك بذكاء"], 1200, size=54, color=WHITE, alpha=a2)
    a3 = ease_out_cubic(seg(t, 0.9, 1.2))
    if a3 > 0:
        headline(c, ["الخطة لأجهزة البيت · الشراء يتم لدى المتاجر",
                     "الأسعار كما رُصدت وقد تتغيّر · الخدمة في نسختها التجريبية"],
                 1330, size=26, color=rgba(WHITE, 215), alpha=a3, line_h=38, fnt=font(MED, 26))


# --------------------------------------------------------------------------------------
# dispatcher
# --------------------------------------------------------------------------------------
def frame(t: float) -> Image.Image:
    c = Canvas(CREAM)
    if t < T_OPEN[1]:
        scene_open(c, t - T_OPEN[0])
        # camera shake
        amp = 6 + 4 * clamp(t / 3)
        dx, dy = int(shake(t, amp, 27, 1) * SS), int(shake(t, amp, 31, 2) * SS)
        c.im = ImageChops.offset(c.im, dx, dy)
        c.d = ImageDraw.Draw(c.im)
        # hard cut flash at the very end into the context scene
    elif t < T_CTX[1]:
        scene_ctx(c, t - T_CTX[0])
    elif t < T_ESC[1]:
        scene_esc(c, t - T_ESC[0])
        tl = t - T_ESC[0]
        amp = 9 if tl < 1.15 else 4
        dx, dy = int(shake(t, amp, 29, 3) * SS), int(shake(t, amp, 33, 4) * SS)
        c.im = ImageChops.offset(c.im, dx, dy)
        c.d = ImageDraw.Draw(c.im)
        if 1.15 <= tl < 1.3:  # snap flash
            c.tint(WHITE, 0.8 * (1 - seg(tl, 1.15, 1.3)))
    elif t < T_FREEZE[1]:
        scene_freeze(c, t - T_FREEZE[0])
    elif t < T_TURN[1]:
        scene_turn(c, t - T_TURN[0])
    elif t < T_UI[-1][2]:
        for shot, a, b in T_UI:
            if t < b:
                scene_ui(c, t - a, shot)
                break
    elif t < T_PAY[1]:
        scene_pay(c, t - T_PAY[0])
    else:
        scene_cta(c, t - T_CTA[0])
    return c.finish()
