"""Drop the recorded voice-over lines onto the finished cut.

Usage:
    python3 mix_vo.py <video.mp4> <vo_dir> <out.mp4>

<vo_dir> holds one file per line, named by its number: 01.wav … 11.wav (mp3/m4a also fine).
Each line is placed at its cue from scenes.VO_CUES; the music/SFX bed is ducked by 9 dB under
speech (with a 120 ms ramp). If a take runs longer than its cue window a warning is printed —
re-record shorter or accept the overlap deliberately.
"""
from __future__ import annotations

import glob
import os
import subprocess
import sys
import tempfile

import imageio_ffmpeg
import numpy as np

import scenes as S

SR = 48000


def decode(path):
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    raw = subprocess.run([ff, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main(video, vo_dir, out):
    n = int(SR * S.DURATION)
    vo = np.zeros(n, dtype=np.float32)
    duck = np.ones(n, dtype=np.float32)
    ramp = int(0.12 * SR)
    for num, start, end, text in S.VO_CUES:
        cands = glob.glob(os.path.join(vo_dir, f"{num:02d}.*")) + glob.glob(os.path.join(vo_dir, f"{num}.*"))
        if not cands:
            print(f"[missing] line {num:02d} — {text}")
            continue
        x = decode(cands[0])
        # trim leading/trailing silence (-45 dBFS)
        thr = 10 ** (-45 / 20)
        idx = np.where(np.abs(x) > thr)[0]
        if len(idx):
            x = x[max(0, idx[0] - int(0.02 * SR)):idx[-1] + int(0.05 * SR)]
        peak = np.max(np.abs(x)) or 1.0
        x = x / peak * 0.8
        length = len(x) / SR
        if length > (end - start) + 0.35:
            print(f"[long] line {num:02d}: {length:.2f}s for a {end - start:.2f}s window — {text}")
        i0 = int(start * SR)
        m = min(len(x), n - i0)
        vo[i0:i0 + m] += x[:m]
        a, b = max(0, i0 - ramp), min(n, i0 + m + ramp)
        duck[a:b] = np.minimum(duck[a:b], 10 ** (-9 / 20))
    # smooth the duck envelope
    k = np.ones(ramp) / ramp
    duck = np.convolve(duck, k, mode="same")
    bed = decode(video)
    bed = bed[:n] if len(bed) >= n else np.pad(bed, (0, n - len(bed)))
    mix = bed * duck + vo
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix / (np.max(np.abs(mix)) or 1.0) * 0.9
    tmp = tempfile.mktemp(suffix=".wav")
    import wave
    st = np.stack([mix, mix], axis=1)
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ff, "-y", "-v", "error", "-i", video, "-i", tmp, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out],
                   check=True)
    os.remove(tmp)
    print("wrote", out)


if __name__ == "__main__":
    main(*sys.argv[1:4])
