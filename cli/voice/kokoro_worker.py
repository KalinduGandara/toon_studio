"""Kokoro worker: reads [{text, voice, speed, out}] as JSON on stdin, writes one WAV per job."""

import json
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SAMPLE_RATE = 24000


def main() -> None:
    jobs = json.load(sys.stdin)
    pipes: dict[str, KPipeline] = {}
    for job in jobs:
        lang = job["voice"][0]
        if lang not in pipes:
            pipes[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
        parts = [r.audio.numpy() for r in pipes[lang](job["text"], voice=job["voice"], speed=job["speed"])]
        if not parts:
            sys.exit(f"kokoro produced no audio for: {job['text']!r}")
        sf.write(job["out"], np.concatenate(parts), SAMPLE_RATE, subtype="PCM_16")


if __name__ == "__main__":
    main()
