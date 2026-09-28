"""Shared drawing helpers for the «جهّز بيتك بذكاء» ad renderer.

Everything is authored in a 1080x1920 coordinate space and rendered at
SS x supersampling, then downscaled for anti-aliasing.
"""
from __future__ import annotations

import math
import os
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
FONT_DIR = os.path.join(ASSETS, "fonts")

W, H = 1080, 1920
SS = 2  # supersampling factor
FPS = 30

# ---- brand palette (from the supplied logo + live UI) ----
MINT = (112, 207, 173)
MINT_DARK = (79, 176, 143)
GREEN = (46, 125, 99)         # UI button green
GREEN_DEEP = (28, 92, 72)
GOLD = (202, 160, 88)
GOLD_DARK = (168, 128, 60)
CREAM = (246, 248, 245)
INK = (30, 42, 38)
INK_SOFT = (92, 106, 100)
WHITE = (255, 255, 255)
RED = (226, 84, 66)
RED_DEEP = (176, 52, 40)
STEEL = (226, 231, 234)
STEEL_DARK = (150, 160, 166)
SKIN = (222, 178, 138)
SKIN_DARK = (190, 140, 100)


def rgba(c, a=255):
    return (c[0], c[1], c[2], int(a))


# ---- easing ----
def clamp(x, lo=0.0, hi=1.0):
    return lo if x < lo else hi if x > hi else x


def lerp(a, b, t):
    return a + (b - a) * t


def ease_out_cubic(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_cubic(t):
    t = clamp(t)
    return t ** 3


def ease_in_out(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def ease_out_back(t, s=1.70158):
    t = clamp(t)
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2


def ease_out_elastic(t):
    t = clamp(t)
    if t in (0, 1):
        return t
    return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi / 3)) + 1


def seg(t, t0, t1):
    """0..1 progress of t inside [t0, t1]."""
    if t1 <= t0:
        return 1.0 if t >= t1 else 0.0
    return clamp((t - t0) / (t1 - t0))


def shake(t, amp, freq=23.0, seed=0.0):
    return (
        amp * math.sin(t * freq * 2 * math.pi + seed) * 0.6
        + amp * math.sin(t * freq * 1.37 * 2 * math.pi + seed * 2.1) * 0.4
    )


# ---- fonts ----
@lru_cache(maxsize=None)
def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = os.path.join(FONT_DIR, name)
    return ImageFont.truetype(path, int(size * SS))


HEAD = "Tajawal-ExtraBold.ttf"
BLACK = "Tajawal-Black.ttf"
BOLD = "Tajawal-Bold.ttf"
MED = "Tajawal-Medium.ttf"


class Canvas:
    """RGBA canvas at supersampled resolution with base-unit helpers."""

    def __init__(self, bg=CREAM):
        self.im = Image.new("RGBA", (W * SS, H * SS), rgba(bg))
        self.d = ImageDraw.Draw(self.im)

    # scale helpers
    def s(self, v):
        return v * SS

    def box(self, x0, y0, x1, y1):
        return [x0 * SS, y0 * SS, x1 * SS, y1 * SS]

    # ---- primitives ----
    def rect(self, x0, y0, x1, y1, fill, radius=0, outline=None, width=0, layer=None):
        d = ImageDraw.Draw(layer) if layer is not None else self.d
        d.rounded_rectangle(self.box(x0, y0, x1, y1), radius=radius * SS, fill=fill,
                            outline=outline, width=int(width * SS))

    def ellipse(self, x0, y0, x1, y1, fill, outline=None, width=0, layer=None):
        d = ImageDraw.Draw(layer) if layer is not None else self.d
        d.ellipse(self.box(x0, y0, x1, y1), fill=fill, outline=outline, width=int(width * SS))

    def circle(self, cx, cy, r, fill, outline=None, width=0, layer=None):
        self.ellipse(cx - r, cy - r, cx + r, cy + r, fill, outline, width, layer)

    def line(self, pts, fill, width, layer=None):
        d = ImageDraw.Draw(layer) if layer is not None else self.d
        d.line([(x * SS, y * SS) for x, y in pts], fill=fill, width=int(width * SS), joint="curve")

    def poly(self, pts, fill, outline=None, width=0, layer=None):
        d = ImageDraw.Draw(layer) if layer is not None else self.d
        d.polygon([(x * SS, y * SS) for x, y in pts], fill=fill, outline=outline,
                  width=int(width * SS))

    def arc(self, x0, y0, x1, y1, start, end, fill, width, layer=None):
        d = ImageDraw.Draw(layer) if layer is not None else self.d
        d.arc(self.box(x0, y0, x1, y1), start=start, end=end, fill=fill, width=int(width * SS))

    # ---- text ----
    def text(self, x, y, s, fnt, fill, anchor="mm", layer=None, rtl=True, stroke=0, stroke_fill=None):
        d = ImageDraw.Draw(layer) if layer is not None else self.d
        kw = dict(font=fnt, fill=fill, anchor=anchor)
        if rtl:
            kw.update(direction="rtl", language="ar")
        else:
            kw.update(direction="ltr")
        if stroke:
            kw.update(stroke_width=int(stroke * SS), stroke_fill=stroke_fill)
        d.text((x * SS, y * SS), s, **kw)

    def text_width(self, s, fnt, rtl=True):
        kw = dict(font=fnt, anchor="ls")
        if rtl:
            kw.update(direction="rtl", language="ar")
        b = self.d.textbbox((0, 0), s, **kw)
        return (b[2] - b[0]) / SS

    def text_lines(self, x, y, lines, fnt, fill, line_h, anchor="mm", layer=None, rtl=True,
                   stroke=0, stroke_fill=None):
        n = len(lines)
        y0 = y - (n - 1) * line_h / 2
        for i, ln in enumerate(lines):
            self.text(x, y0 + i * line_h, ln, fnt, fill, anchor, layer, rtl, stroke, stroke_fill)

    # ---- layers ----
    def new_layer(self):
        return Image.new("RGBA", self.im.size, (0, 0, 0, 0))

    def composite(self, layer, alpha=1.0):
        if alpha < 1.0:
            a = layer.getchannel("A").point(lambda v: int(v * alpha))
            layer = layer.copy()
            layer.putalpha(a)
        self.im.alpha_composite(layer)
        self.d = ImageDraw.Draw(self.im)

    def paste_rotated(self, layer, angle_deg, center, alpha=1.0):
        """Rotate a full-size layer around a base-unit center and composite."""
        if abs(angle_deg) > 0.01:
            layer = layer.rotate(angle_deg, resample=Image.BICUBIC,
                                 center=(center[0] * SS, center[1] * SS))
        self.composite(layer, alpha)

    def shadow(self, draw_fn, blur=14, offset=(0, 10), alpha=90, color=(0, 0, 0)):
        """draw_fn(layer) draws the silhouette; we blur it as a drop shadow."""
        lay = self.new_layer()
        draw_fn(lay)
        a = lay.getchannel("A").point(lambda v: int(v * alpha / 255))
        sh = Image.new("RGBA", lay.size, rgba(color, 0))
        sh.putalpha(a)
        sh = sh.filter(ImageFilter.GaussianBlur(blur * SS / 2))
        moved = Image.new("RGBA", lay.size, (0, 0, 0, 0))
        moved.paste(sh, (int(offset[0] * SS), int(offset[1] * SS)))
        self.composite(moved)

    def vignette(self, strength=0.55, color=(0, 0, 0)):
        small = Image.new("L", (W // 8, H // 8), 0)
        dd = ImageDraw.Draw(small)
        cx, cy = W // 16, H // 16
        for i in range(24):
            k = i / 23
            r = int(lerp(min(cx, cy) * 0.6, max(cx, cy) * 1.4, k))
            dd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(255 * (1 - k) ** 2 * strength))
        mask = small.resize(self.im.size, Image.BILINEAR)
        mask = Image.eval(mask, lambda v: 255 - v)  # dark at edges
        inv = mask.point(lambda v: int((255 - v)))
        over = Image.new("RGBA", self.im.size, rgba(color, 0))
        over.putalpha(inv.point(lambda v: int(v * strength)))
        self.composite(over)

    def tint(self, color, alpha):
        over = Image.new("RGBA", self.im.size, rgba(color, int(255 * alpha)))
        self.composite(over)

    def gradient_bg(self, top, bottom):
        g = Image.new("RGBA", (1, H * SS))
        for y in range(H * SS):
            k = y / (H * SS - 1)
            g.putpixel((0, y), rgba(tuple(int(lerp(top[i], bottom[i], k)) for i in range(3))))
        self.im.paste(g.resize(self.im.size, Image.NEAREST))
        self.d = ImageDraw.Draw(self.im)

    def finish(self) -> Image.Image:
        return self.im.convert("RGB").resize((W, H), Image.LANCZOS)


@lru_cache(maxsize=None)
def logo_image(size: int) -> Image.Image:
    im = Image.open(os.path.join(ASSETS, "tawveeri-logo.png")).convert("RGBA")
    return im.resize((int(size * SS), int(size * SS * im.height / im.width)), Image.LANCZOS)


def paste_logo(c: Canvas, cx, cy, size, alpha=1.0, layer=None, angle=0.0):
    if size < 2:
        return
    im = logo_image(int(size))
    if abs(angle) > 0.01:
        im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    if alpha < 1.0:
        im = im.copy()
        im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
    target = layer if layer is not None else c.im
    target.alpha_composite(im, (int(cx * SS - im.width / 2), int(cy * SS - im.height / 2)))
    if layer is None:
        c.d = ImageDraw.Draw(c.im)
