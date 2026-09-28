"""Original music bed + sound design (v2 timeline), synthesised from scratch — no third-party
samples, no licensing exposure. Output: 48 kHz stereo WAV. Timings follow scenes.py.
"""
from __future__ import annotations

import wave

import numpy as np

import scenes as S

SR = 48000
DUR = S.DURATION
BPM = 118
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)


# -------------------------------------------------------------------------- primitives
def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env_exp(dur, decay, attack=0.002):
    t = t_axis(dur)
    return np.exp(-t / decay) * np.clip(t / attack, 0, 1)


def bandpass_noise(dur, lo, hi):
    n = int(SR * dur)
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.convolve(((f >= lo) & (f <= hi)).astype(float), np.ones(9) / 9, mode="same")
    return np.fft.irfft(X * m, n)


def lowpass(x, cutoff):
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X / (1 + (f / cutoff) ** 4), n)


def note(name):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8,
             "A": 9, "Bb": 10, "B": 11}
    n, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[n] - 9 + (o - 4) * 12) / 12)


def place(buf, x, t0, gain=1.0):
    i = int(t0 * SR)
    if i < 0 or i >= len(buf):
        return
    m = min(len(x), len(buf) - i)
    buf[i:i + m] += x[:m] * gain


# -------------------------------------------------------------------------- instruments
def dum(vel=1.0):
    dur = 0.45
    t = t_axis(dur)
    f = 55 + 110 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, 0.16)
    click = bandpass_noise(dur, 1500, 5000) * env_exp(dur, 0.008) * 0.25
    return (body + click) * vel


def tak(vel=1.0):
    dur = 0.12
    n = bandpass_noise(dur, 2500, 8000) * env_exp(dur, 0.028)
    ring = np.sin(2 * np.pi * 1900 * t_axis(dur)) * env_exp(dur, 0.02) * 0.6
    return (n * 0.8 + ring) * vel


def shaker(vel=0.3):
    dur = 0.07
    return bandpass_noise(dur, 6000, 13000) * env_exp(dur, 0.02, attack=0.008) * vel


def bass(f, dur, vel=1.0):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return np.tanh(1.6 * x) * env_exp(dur, dur * 0.55, attack=0.004) * vel


def pluck(f, dur, vel=1.0, bright=1.0):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for k in range(1, 8):
        a = (1 / k) ** 1.1 * (bright if k > 1 else 1)
        x += a * np.sin(2 * np.pi * f * k * t * (1 + 0.0007 * (k - 1))) * np.exp(-t * (2.6 + 1.3 * k))
    return x * np.clip(t / 0.004, 0, 1) * vel * 0.5


def pad(freqs, dur, vel=1.0, attack=0.6):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for f in freqs:
        for d in (-0.35, 0.0, 0.35):
            x += np.sin(2 * np.pi * f * (2 ** (d / 1200)) * t + rng.uniform(0, 6.28))
    x = lowpass(x, 1800)
    return x / (3 * len(freqs)) * np.clip(t / attack, 0, 1) * np.clip((dur - t) / 0.8, 0, 1) * vel


def bell(f, dur=1.4, vel=1.0):
    t = t_axis(dur)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2)
         + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4.5)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 7))
    return x * np.clip(t / 0.002, 0, 1) * vel * 0.6


# -------------------------------------------------------------------------- sfx
def sfx_creak(dur, intensity=1.0):
    t = t_axis(dur)
    f = 70 + 25 * np.sin(2 * np.pi * 0.9 * t) + 15 * np.sin(2 * np.pi * 2.7 * t + 1)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    gate = np.convolve((np.sin(2 * np.pi * 1.3 * t) > 0.55).astype(float), np.ones(400) / 400, mode="same")
    grit = bandpass_noise(dur, 300, 1800) * 0.4
    return lowpass((saw * 0.5 + grit) * gate * (0.5 + 0.5 * t / dur) * intensity, 2200)


def sfx_grunt(vel=1.0, pitch=1.0):
    """Cartoon effort grunt: short pitched buzz with a dip."""
    dur = 0.22
    t = t_axis(dur)
    f = (150 + 70 * np.exp(-t / 0.05)) * pitch
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    x = lowpass(saw, 1200 * pitch) * env_exp(dur, 0.09, attack=0.01)
    return x * vel * 0.6


def sfx_twang(vel=1.0):
    """Rope going taut."""
    dur = 0.3
    t = t_axis(dur)
    f = 220 + 160 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, 0.06)
    return (x + bandpass_noise(dur, 800, 3000) * env_exp(dur, 0.02) * 0.5) * vel * 0.5


def sfx_pop(vel=1.0):
    dur = 0.18
    t = t_axis(dur)
    f = 420 * np.exp(-t / 0.05) + 180
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, 0.04) * vel * 0.8


def sfx_whoosh(dur=0.45, vel=1.0, up=True):
    t = t_axis(dur)
    n = int(SR * dur)
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    x = np.fft.irfft(X / (1 + (f / 2500) ** 2), n)
    e = np.sin(np.pi * t / dur) ** 2
    if not up:
        e = e[::-1] * np.linspace(1, 0.2, n)
    return x * e * vel * 0.9


def sfx_thud(vel=1.0, deep=False):
    dur = 0.45 if deep else 0.35
    t = t_axis(dur)
    f = (30 if deep else 40) + 160 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, 0.16 if deep else 0.12)
    slap = bandpass_noise(dur, 800, 4000) * env_exp(dur, 0.02) * 0.6
    return (x + slap) * vel


def sfx_snap(vel=1.0):
    dur = 0.5
    crack = bandpass_noise(dur, 1200, 9000) * env_exp(dur, 0.035)
    wood = bandpass_noise(dur, 200, 900) * env_exp(dur, 0.09) * 0.8
    t = t_axis(dur)
    boing = np.sin(2 * np.pi * (300 + 120 * np.sin(2 * np.pi * 12 * t) * np.exp(-t * 4)) * t) * np.exp(-t * 6) * 0.5
    return (crack + wood + boing) * vel


def sfx_scratch(vel=1.0):
    dur = 0.55
    t = t_axis(dur)
    n = len(t)
    wob = 1200 + 900 * np.sin(2 * np.pi * 7 * t) * np.exp(-t * 2)
    am = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 7 * t))
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    x = np.fft.irfft(X * ((f > 500) & (f < 3500)).astype(float), n) * am
    tone = np.sin(2 * np.pi * np.cumsum(wob) / SR) * 0.35
    e = np.ones(n)
    e[int(n * 0.85):] = np.linspace(1, 0, n - int(n * 0.85))
    return (x + tone) * e * vel * 0.7


def sfx_click(vel=1.0):
    dur = 0.06
    return bandpass_noise(dur, 1500, 6000) * env_exp(dur, 0.01) * vel


def sfx_twinkle(vel=1.0):
    """Dizzy stars: a soft descending bell arpeggio."""
    out = np.zeros(int(SR * 1.6))
    for i, n in enumerate(["A6", "F#6", "D6", "B5", "A5"]):
        place(out, bell(note(n), 0.8, 0.35), i * 0.12)
    return out * vel


def sfx_tada(vel=1.0):
    out = np.zeros(int(SR * 2.2))
    for i, n in enumerate(["D5", "F#5", "A5", "D6"]):
        place(out, pluck(note(n), 1.6, vel=1.0, bright=0.9), i * 0.07)
    place(out, bell(note("D6"), 1.8, 0.7), 0.25)
    return out * vel


# -------------------------------------------------------------------------- music
def build_music():
    m = np.zeros(N)
    eighth = BEAT / 2
    snap = S.SNAP
    # --- tension groove until the snap ---
    pat = ["D", "-", "T", "T", "D", "-", "T", "-", "D", "-", "T", "T", "T", "-", "T", "T"]
    t, i = 0.0, 0
    while t < snap:
        k = pat[i % 16]
        vel = 0.85 + 0.4 * (t / snap)
        if k == "D":
            place(m, dum(0.9 * vel), t)
        elif k == "T":
            place(m, tak(0.55 * vel), t)
        f = note("D2") if t < snap - 1.4 else (note("Eb2") if t < snap - 0.6 else note("F#2"))
        place(m, bass(f, eighth * 0.9, 0.55 * vel), t)
        t += eighth
        i += 1
    seq = ["D4", "Eb4", "F#4", "G4", "A4", "G4", "F#4", "Eb4"]
    t, i = 0.0, 0
    while t < snap - 0.1:
        place(m, pluck(note(seq[i % 8]), 0.6, vel=0.7, bright=1.2), t)
        step = eighth if t < S.T_CTX[1] else eighth * 0.75 if t < snap - 1.0 else eighth * 0.5
        t += step
        i += 1
    place(m, sfx_whoosh(1.3, 0.8) * np.linspace(0.2, 1, int(SR * 1.3)), snap - 1.3)
    # --- after the snap: nothing but a low drone under the groom's line ---
    tt = t_axis(S.T_LINE[1] - S.T_LINE[0] + 0.3)
    drone = np.sin(2 * np.pi * note("D2") * tt) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.1 * tt))
    drone *= np.clip(tt / 0.4, 0, 1) * np.clip((tt[-1] - tt) / 0.4, 0, 1) * 0.16
    place(m, drone, S.T_LINE[0] - 0.1)
    # --- the turn: pad swell after the logo lands ---
    land = S.T_TURN[0] + 0.36
    place(m, pad([note("D3"), note("A3"), note("D4"), note("F#4")], S.T_TURN[1] - land + 0.2, vel=0.45, attack=0.5), land)
    # --- bright groove through the product and payoff ---
    bars = [["D2", ["D4", "F#4", "A4"]], ["B1", ["B3", "D4", "F#4"]], ["G2", ["G3", "B3", "D4"]],
            ["A2", ["A3", "C#4", "E4"]]]
    t0 = S.T_UI[0][1]
    t, bar_i = t0, 0
    while t < S.T_CTA[0]:
        b, chord = bars[bar_i % 4]
        for beat in range(4):
            tb = t + beat * BEAT
            if tb >= S.T_CTA[0]:
                break
            place(m, dum(0.7) if beat in (0, 2) else tak(0.5), tb)
            for q in range(4):
                place(m, shaker(0.22 if q % 2 == 0 else 0.14), tb + q * BEAT / 4)
            place(m, bass(note(b), BEAT * 0.8, 0.5), tb)
            if beat in (1, 3):
                place(m, bass(note(b) * (1.5 if beat == 3 else 1), BEAT * 0.4, 0.35), tb + BEAT / 2)
        for k, n in enumerate(chord):
            place(m, pluck(note(n), 1.2, vel=0.5), t + k * 0.03)
            place(m, pluck(note(n), 0.8, vel=0.3), t + 2 * BEAT + k * 0.03)
        t += 4 * BEAT
        bar_i += 1
    mel = [("D5", 0), ("F#5", 1), ("A5", 2), ("B5", 3), ("A5", 4), ("F#5", 5.5), ("E5", 6), ("D5", 7),
           ("B4", 8), ("D5", 9), ("E5", 10), ("F#5", 11), ("A5", 12), ("B5", 13.5), ("A5", 14), ("D5", 15),
           ("F#5", 16), ("A5", 17), ("B5", 18), ("A5", 19), ("F#5", 20), ("D5", 21)]
    for n, b in mel:
        tt_ = t0 + b * BEAT
        if tt_ < S.T_PAY[0] - 0.3:
            place(m, pluck(note(n), 0.9, vel=0.42, bright=0.8), tt_)
    for n, b in [("D5", 0), ("F#5", 0.5), ("A5", 1), ("D6", 1.5), ("B5", 2.5), ("A5", 3), ("F#5", 3.5), ("A5", 4)]:
        place(m, pluck(note(n), 1.0, vel=0.5, bright=0.9), S.T_PAY[0] + 0.6 + b * BEAT)
    # --- CTA hit + resolve ---
    c0 = S.T_CTA[0]
    place(m, dum(1.1), c0)
    place(m, pad([note("D3"), note("A3"), note("D4"), note("F#4"), note("A4")], S.T_CTA[1] - c0, vel=0.55, attack=0.05), c0)
    for k, n in enumerate(["D3", "A3", "D4", "F#4"]):
        place(m, pluck(note(n), 2.5, vel=0.55), c0 + k * 0.02)
    for k in range(1, 5):
        place(m, tak(0.5) if k % 2 else dum(0.75), c0 + k * BEAT)
    tail = int(SR * 1.2)
    m[-tail:] *= np.linspace(1, 0, tail)
    return m


# -------------------------------------------------------------------------- sfx track
def build_sfx():
    s = np.zeros(N)
    o = S.T_OPEN[0]
    place(s, sfx_creak(3.4, 0.55), o)
    for t0, who, k in S.HEAVES_OPEN:
        pitch = {"fridge": 0.75, "ac": 1.15, "washer": 1.35}[who]
        place(s, sfx_grunt(0.8 * k, pitch), o + t0 - 0.12)
        place(s, sfx_twang(0.7), o + t0)
    for tt in (0.3, 0.85, 1.4):
        place(s, sfx_pop(0.7), o + tt)
    place(s, sfx_thud(0.5), o + 2.0)
    # context stamps
    c0 = S.T_CTX[0]
    place(s, sfx_whoosh(0.35, 0.8), c0 - 0.1)
    for t0 in (0.0, 0.65, 1.3):
        place(s, sfx_whoosh(0.25, 0.5, up=False), c0 + t0 - 0.05)
        place(s, sfx_thud(1.0), c0 + t0 + 0.3)
    place(s, sfx_whoosh(0.35, 0.7), S.T_ESC[0] - 0.1)
    # escalation
    e0 = S.T_ESC[0]
    place(s, sfx_creak(1.8, 0.9), e0)
    place(s, sfx_thud(0.45), e0 + 0.15)
    for t0, who, k in S.HEAVES_ESC:
        if who == "all":
            for w, p in (("fridge", 0.75), ("ac", 1.15), ("washer", 1.35)):
                place(s, sfx_grunt(0.9, p), e0 + t0 - 0.12)
        else:
            place(s, sfx_grunt(0.8 * k, {"fridge": 0.75, "ac": 1.15, "washer": 1.35}[who]), e0 + t0 - 0.12)
        place(s, sfx_twang(0.6), e0 + t0)
    snap = S.SNAP
    place(s, sfx_snap(1.0), snap)
    place(s, sfx_whoosh(0.35, 0.9), snap + 0.02)
    for tt in (0.05, 0.11, 0.17):
        place(s, sfx_pop(0.5), snap + tt)
    place(s, sfx_thud(1.0, deep=True), snap + 0.48)
    place(s, sfx_twinkle(0.8), snap + 0.6)
    place(s, sfx_pop(0.8), snap + 0.75)   # «وأنا؟!»
    # the line
    place(s, sfx_scratch(1.0), S.T_LINE[0] - 0.05)
    place(s, sfx_pop(0.9), S.T_LINE[0] + 0.15)
    # the turn
    u0 = S.T_TURN[0]
    place(s, sfx_whoosh(0.4, 0.9, up=False), u0)
    place(s, sfx_thud(1.1, deep=True), u0 + 0.36)
    place(s, bell(note("A5"), 1.6, 0.9), u0 + 0.38)
    place(s, bell(note("D6"), 1.4, 0.5), u0 + 0.46)
    place(s, sfx_whoosh(0.6, 1.0), u0 + 0.4)
    # product shots
    for shot, a, b in S.T_UI:
        place(s, sfx_whoosh(0.3, 0.55), a - 0.05)
        place(s, sfx_click(0.6), a + 0.02)
        cfg = S.UI_SHOTS[shot]
        for key in ("ring", "ring2", "share"):
            if key in cfg:
                place(s, sfx_pop(0.55), a + cfg[key][0])
    # payoff
    p0 = S.T_PAY[0]
    place(s, sfx_whoosh(0.55, 0.7), p0)
    place(s, sfx_click(1.0), p0 + 0.55)
    place(s, sfx_thud(0.6), p0 + 0.55)
    place(s, bell(note("D6"), 1.2, 0.8), p0 + 0.77)
    for i in range(3):
        place(s, sfx_pop(0.6), p0 + 0.75 + i * 0.25 + 0.4)
    place(s, sfx_pop(0.5), p0 + 1.0)
    # CTA
    place(s, sfx_whoosh(0.4, 0.7), S.T_CTA[0] - 0.05)
    place(s, sfx_tada(0.9), S.T_CTA[0] + 0.05)
    place(s, sfx_thud(0.5), S.T_CTA[0] + 0.5)
    return s


def master(music, sfx):
    mix = music * 0.55 + sfx * 0.75
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    peak = np.max(np.abs(mix)) or 1.0
    mix = mix / peak * 0.89
    d = int(0.0006 * SR)
    right = np.roll(mix, d)
    right[:d] = 0
    return (np.stack([mix, right], axis=1) * 32767).astype(np.int16)


def write_wav(path, data):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "ad-audio.wav"
    write_wav(out, master(build_music(), build_sfx()))
    print("wrote", out)
