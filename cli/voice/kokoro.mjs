// Kokoro-82M provider (local, Apache-2.0). Runs kokoro_worker.py with a Python that has
// `kokoro` installed: $TOON_KOKORO_PYTHON, else the maths venv (../maths/.venv), which
// already has Kokoro and its cached weights.
//
// Settings in voices.json: {"voice": "af_heart", "speed": 1.0}. The voice id's first letter
// is Kokoro's language code (a = US English, b = UK English).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PYTHON = path.resolve(HERE, '../../../maths/.venv/bin/python');

export const name = 'kokoro';

export async function synthesize(jobs) {
  const python = process.env.TOON_KOKORO_PYTHON || DEFAULT_PYTHON;
  if (!fs.existsSync(python)) {
    throw new Error(`Kokoro needs a Python with kokoro installed: set TOON_KOKORO_PYTHON (tried ${python})`);
  }
  const payload = jobs.map((j) => {
    if (!j.settings.voice) throw new Error('kokoro settings need "voice"');
    return {text: j.text, voice: j.settings.voice, speed: j.settings.speed ?? 1.0, out: j.out};
  });
  const res = spawnSync(python, [path.join(HERE, 'kokoro_worker.py')], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`kokoro worker failed (${res.status}):\n${(res.stderr || '').split('\n').slice(-15).join('\n')}`);
  }
}
