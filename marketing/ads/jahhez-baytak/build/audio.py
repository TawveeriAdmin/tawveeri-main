"""Original music bed + sound design for the ad, synthesised from scratch (no third-party
samples, no licensing exposure). Output: 48 kHz stereo WAV.
"""
from __future__ import annotations

import math
import wave

import numpy as np

SR = 48000
DUR = 28.5
BPM = 118
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)

# -------------------------------------------------------------------------- primitives
def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env_exp(dur, decay, attack=0.002):
    t = t_axis(dur)
    e = np.exp(-t / decay)
    a = np.clip(t / attack, 0, 1)
    return e * a


def bandpass_noise(dur, lo, hi, seed=None):
    n = int(SR * dur)
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float)
    # soft edges
    m = np.convolve(m, np.ones(9) / 9, mode="same")
    return np.fft.irfft(X * m, n)


def lowpass(x, cutoff):
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X * m, n)


def note(name):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8,
             "A": 9, "Bb": 10, "B": 11}
    n, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[n] - 9 + (o - 4) * 12) / 12)


# -------------------------------------------------------------------------- instruments
def dum(vel=1.0):
    dur = 0.45
    t = t_axis(dur)
    f = 55 + 110 * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(dur, 0.16)
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
    x = np.tanh(1.6 * x)
    e = env_exp(dur, dur * 0.55, attack=0.004)
    return x * e * vel


def pluck(f, dur, vel=1.0, bright=1.0):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for k in range(1, 8):
        a = (1 / k) ** 1.1 * (bright if k > 1 else 1)
        x += a * np.sin(2 * np.pi * f * k * t * (1 + 0.0007 * (k - 1))) * np.exp(-t * (2.6 + 1.3 * k))
    x *= np.clip(t / 0.004, 0, 1)
    return x * vel * 0.5


def pad(freqs, dur, vel=1.0, attack=0.6):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for f in freqs:
        for d in (-0.35, 0.0, 0.35):
            x += np.sin(2 * np.pi * f * (2 ** (d / 1200)) * t + rng.uniform(0, 6.28))
    x = lowpass(x, 1800)
    a = np.clip(t / attack, 0, 1)
    rel = np.clip((dur - t) / 0.8, 0, 1)
    return x / (3 * len(freqs)) * a * rel * vel


def bell(f, dur=1.4, vel=1.0):
    t = t_axis(dur)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2)
         + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4.5)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 7))
    return x * np.clip(t / 0.002, 0, 1) * vel * 0.6


# -------------------------------------------------------------------------- sfx
def sfx_creak(dur, intensity=1.0):
    """Rope creak: low sawtooth with pitch wobble, gated in bursts."""
    t = t_axis(dur)
    f = 70 + 25 * np.sin(2 * np.pi * 0.9 * t) + 15 * np.sin(2 * np.pi * 2.7 * t + 1)
    ph = np.cumsum(f) / SR
    saw = 2 * (ph % 1) - 1
    gate = (np.sin(2 * np.pi * 1.3 * t) > 0.55).astype(float)
    gate = np.convolve(gate, np.ones(400) / 400, mode="same")
    grit = bandpass_noise(dur, 300, 1800) * 0.4
    x = (saw * 0.5 + grit) * gate * (0.5 + 0.5 * t / dur) * intensity
    return lowpass(x, 2200)


def sfx_pop(vel=1.0):
    dur = 0.18
    t = t_axis(dur)
    f = 420 * np.exp(-t / 0.05) + 180
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, 0.04)
    return x * vel * 0.8


def sfx_whoosh(dur=0.45, vel=1.0, up=True):
    t = t_axis(dur)
    n = int(SR * dur)
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X *= 1 / (1 + (f / 2500) ** 2)
    x = np.fft.irfft(X, n)
    e = np.sin(np.pi * t / dur) ** 2
    if not up:
        e = e[::-1] * np.linspace(1, 0.2, n)
    return x * e * vel * 0.9


def sfx_thud(vel=1.0):
    dur = 0.35
    t = t_axis(dur)
    f = 40 + 160 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, 0.12)
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
    """Record scratch: filtered noise with a fast pitch wobble, then a stop."""
    dur = 0.55
    t = t_axis(dur)
    n = len(t)
    wob = 1200 + 900 * np.sin(2 * np.pi * 7 * t) * np.exp(-t * 2)
    x = rng.standard_normal(n)
    # amplitude modulation gives the zig-zag feel
    am = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 7 * t))
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X *= ((f > 500) & (f < 3500)).astype(float)
    x = np.fft.irfft(X, n) * am
    tone = np.sin(2 * np.pi * np.cumsum(wob) / SR) * 0.35
    e = np.ones(n)
    e[int(n * 0.85):] = np.linspace(1, 0, n - int(n * 0.85))
    return (x + tone) * e * vel * 0.7


def sfx_click(vel=1.0):
    dur = 0.06
    return bandpass_noise(dur, 1500, 6000) * env_exp(dur, 0.01) * vel


def sfx_tada(vel=1.0):
    out = np.zeros(int(SR * 2.2))
    for i, n in enumerate(["D5", "F#5", "A5", "D6"]):
        x = pluck(note(n), 1.6, vel=1.0, bright=0.9)
        place(out, x, i * 0.07)
    place(out, bell(note("D6"), 1.8, 0.7), 0.25)
    return out * vel


# -------------------------------------------------------------------------- helpers
def place(buf, x, t0, gain=1.0):
    i = int(t0 * SR)
    if i < 0 or i >= len(buf):
        return
    m = min(len(x), len(buf) - i)
    buf[i:i + m] += x[:m] * gain


# -------------------------------------------------------------------------- music
def build_music():
    m = np.zeros(N)
    eighth = BEAT / 2

    # --- Section 1: tension (0 → 8.2) ---
    # darbuka: D . T T D . T . per beat pairs (8ths)
    pat = ["D", "-", "T", "T", "D", "-", "T", "-", "D", "-", "T", "T", "T", "-", "T", "T"]
    t = 0.0
    i = 0
    while t < 8.2:
        k = pat[i % 16]
        vel = 0.9 + 0.35 * (t / 8.2)
        if k == "D":
            place(m, dum(0.9 * vel), t)
        elif k == "T":
            place(m, tak(0.55 * vel), t)
        # bass pulse on every 8th, D2, rising to Eb2/F#2 at the end
        f = note("D2") if t < 6.2 else (note("Eb2") if t < 7.2 else note("F#2"))
        place(m, bass(f, eighth * 0.9, 0.55 * vel), t)
        t += eighth
        i += 1
    # hijaz ostinato pluck, D4 Eb4 F#4 G4 A4, accelerating
    seq = ["D4", "Eb4", "F#4", "G4", "A4", "G4", "F#4", "Eb4"]
    t = 0.0
    i = 0
    while t < 8.0:
        place(m, pluck(note(seq[i % 8]), 0.6, vel=0.7, bright=1.2), t)
        step = eighth if t < 5.6 else eighth * 0.75 if t < 7.0 else eighth * 0.5
        t += step
        i += 1
    # riser into the freeze
    place(m, sfx_whoosh(1.6, 0.8) * np.linspace(0.2, 1, int(SR * 1.6)), 6.6)

    # --- Section 2: silence + turn (8.2 → 12.4): pad swells under the logo ---
    place(m, pad([note("D3"), note("A3"), note("D4"), note("F#4")], 2.4, vel=0.45, attack=0.5), 10.5)

    # --- Section 3: bright groove (12.4 → 25.4) ---
    bars = [["D2", ["D4", "F#4", "A4"]], ["B1", ["B3", "D4", "F#4"]], ["G2", ["G3", "B3", "D4"]],
            ["A2", ["A3", "C#4", "E4"]]]
    t0 = 12.4
    t = t0
    bar_i = 0
    while t < 25.4:
        b, chord = bars[bar_i % 4]
        # kick 1 & 3, tak 2 & 4, shaker 16ths
        for beat in range(4):
            tb = t + beat * BEAT
            if beat in (0, 2):
                place(m, dum(0.7), tb)
            else:
                place(m, tak(0.5), tb)
            for q in range(4):
                place(m, shaker(0.22 if q % 2 == 0 else 0.14), tb + q * BEAT / 4)
            place(m, bass(note(b), BEAT * 0.8, 0.5), tb)
            if beat in (1, 3):
                place(m, bass(note(b) * 1.5 if beat == 3 else note(b), BEAT * 0.4, 0.35), tb + BEAT / 2)
        # chord pluck on beat 1 (and a lighter one on 3)
        for k, n in enumerate(chord):
            place(m, pluck(note(n), 1.2, vel=0.5), t + k * 0.03)
            place(m, pluck(note(n), 0.8, vel=0.3), t + 2 * BEAT + k * 0.03)
        t += 4 * BEAT
        bar_i += 1
    # gentle pentatonic melody for the product section
    mel = [("D5", 0), ("F#5", 1), ("A5", 2), ("B5", 3), ("A5", 4), ("F#5", 5.5), ("E5", 6), ("D5", 7),
           ("B4", 8), ("D5", 9), ("E5", 10), ("F#5", 11), ("A5", 12), ("B5", 13.5), ("A5", 14), ("D5", 15)]
    for n, b in mel:
        tt = t0 + b * BEAT * 1.0
        if tt < 22.2:
            place(m, pluck(note(n), 0.9, vel=0.42, bright=0.8), tt)
    # payoff melody lift
    for n, b in [("D5", 0), ("F#5", 0.5), ("A5", 1), ("D6", 1.5), ("B5", 2.5), ("A5", 3), ("F#5", 3.5), ("A5", 4)]:
        place(m, pluck(note(n), 1.0, vel=0.5, bright=0.9), 22.6 + b * BEAT)

    # --- Section 4: CTA hit + resolve (25.4 → 28.5) ---
    place(m, dum(1.1), 25.4)
    place(m, pad([note("D3"), note("A3"), note("D4"), note("F#4"), note("A4")], 3.1, vel=0.55, attack=0.05), 25.4)
    for k, n in enumerate(["D3", "A3", "D4", "F#4"]):
        place(m, pluck(note(n), 2.5, vel=0.55), 25.4 + k * 0.02)
    place(m, tak(0.5), 25.4 + BEAT)
    place(m, dum(0.7), 25.4 + 2 * BEAT)
    place(m, tak(0.5), 25.4 + 3 * BEAT)
    place(m, dum(0.9), 25.4 + 4 * BEAT)
    # fade the tail
    tail = int(SR * 1.2)
    m[-tail:] *= np.linspace(1, 0, tail)
    # a quiet low drone keeps the freeze from reading as an audio dropout
    tt = t_axis(1.9)
    drone = np.sin(2 * np.pi * note("D2") * tt) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.1 * tt))
    drone *= np.clip(tt / 0.3, 0, 1) * np.clip((1.9 - tt) / 0.3, 0, 1) * 0.16
    # duck the music hard during the freeze (8.2 → 10.4)
    a, b = int(8.2 * SR), int(8.55 * SR)
    m[a:b] *= np.linspace(1, 0, b - a) ** 4
    m[b:int(10.45 * SR)] *= 0.0
    place(m, drone, 8.55)
    return m


# -------------------------------------------------------------------------- sfx track
def build_sfx():
    s = np.zeros(N)
    # rope creak through the tug-of-war (0 → 3.2) and again in the escalation (5.6 → 6.75)
    place(s, sfx_creak(3.2, 0.55), 0.0)
    place(s, sfx_creak(1.15, 0.8), 5.6)
    # bubbles
    for tt in (0.35, 0.85, 1.35):
        place(s, sfx_pop(0.7), tt)
    place(s, sfx_pop(0.8), 7.35)   # «وأنا؟!»
    place(s, sfx_pop(0.9), 8.3)    # groom's line
    # headline slam in the open
    place(s, sfx_thud(0.5), 1.9)
    # cut to context + three stamps
    place(s, sfx_whoosh(0.35, 0.8), 3.05)
    for tt in (3.2, 3.85, 4.5):
        place(s, sfx_whoosh(0.25, 0.5, up=False), tt - 0.08)
        place(s, sfx_thud(1.0), tt + 0.3)
    place(s, sfx_whoosh(0.35, 0.7), 5.5)
    # headline in the escalation
    place(s, sfx_thud(0.45), 5.75)
    # the snap
    place(s, sfx_snap(1.0), 6.75)
    for k, tt in enumerate((6.8, 6.86, 6.92)):
        place(s, sfx_pop(0.5), tt)
    # record scratch into the freeze
    place(s, sfx_scratch(1.0), 8.15)
    # the turn: wipe + logo landing
    place(s, sfx_whoosh(0.6, 1.0), 10.4)
    place(s, sfx_thud(0.6), 11.3)
    place(s, bell(note("A5"), 1.6, 0.9), 11.32)
    place(s, bell(note("D6"), 1.4, 0.5), 11.4)
    # product shots: swish + click on each cut, tick on the button highlight
    for tt in (12.4, 14.9, 17.4, 19.9):
        place(s, sfx_whoosh(0.3, 0.55), tt - 0.05)
        place(s, sfx_click(0.6), tt + 0.02)
    place(s, sfx_click(0.9), 16.8)
    place(s, sfx_pop(0.6), 18.3)  # share callout
    # payoff
    place(s, sfx_whoosh(0.4, 0.6), 22.4)
    for i in range(3):
        place(s, sfx_pop(0.6), 22.4 + 0.75 + i * 0.35)
        place(s, bell(note(["D6", "F#6", "A6"][i]), 1.2, 0.7), 22.4 + 0.75 + i * 0.35 + 0.2)
    # CTA
    place(s, sfx_whoosh(0.4, 0.7), 25.35)
    place(s, sfx_tada(0.9), 25.45)
    place(s, sfx_thud(0.5), 25.9)
    return s


def master(music, sfx):
    mix = music * 0.55 + sfx * 0.75
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    peak = np.max(np.abs(mix)) or 1.0
    mix = mix / peak * 0.89
    # tiny stereo width: the sfx slightly left/right delayed
    d = int(0.0006 * SR)
    left = mix.copy()
    right = np.roll(mix, d)
    right[:d] = 0
    st = np.stack([left, right], axis=1)
    return (st * 32767).astype(np.int16)


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
