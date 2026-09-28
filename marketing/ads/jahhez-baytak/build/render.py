"""Render all frames in parallel, then mux with the audio bed via ffmpeg.

Usage: python3 render.py <out_dir>
"""
from __future__ import annotations

import os
import subprocess
import sys
from multiprocessing import Pool

import imageio_ffmpeg

import scenes
from common import FPS

FRAMES = int(round(scenes.DURATION * FPS))


def render_one(i: int):
    out = os.path.join(FRAME_DIR, f"{i:05d}.png")
    if os.path.exists(out):
        return i
    scenes.frame(i / FPS).save(out, compress_level=1)
    return i


if __name__ == "__main__":
    out_dir = sys.argv[1]
    FRAME_DIR = os.path.join(out_dir, "frames")
    os.makedirs(FRAME_DIR, exist_ok=True)
    workers = int(os.environ.get("AD_WORKERS", "4"))
    with Pool(workers) as pool:
        for n, _ in enumerate(pool.imap_unordered(render_one, range(FRAMES), chunksize=4), 1):
            if n % 60 == 0:
                print(f"{n}/{FRAMES}", flush=True)
    audio = os.path.join(out_dir, "ad-audio.wav")
    import audio as audio_mod
    audio_mod.write_wav(audio, audio_mod.master(audio_mod.build_music(), audio_mod.build_sfx()))
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    final = os.path.join(out_dir, "tawveeri-jahhez-baytak-9x16.mp4")
    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error",
           "-framerate", str(FPS), "-i", os.path.join(FRAME_DIR, "%05d.png"),
           "-i", audio,
           "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
           "-crf", "18", "-preset", "slow", "-movflags", "+faststart",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
           "-shortest", final]
    subprocess.run(cmd, check=True)
    print("wrote", final)
