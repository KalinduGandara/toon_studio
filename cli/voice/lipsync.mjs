// Audio -> mouth openness track. Works on any provider's audio (no phonemes needed):
// one digit per 1/MOUTH_FPS s, 0 = closed ... 3 = wide open, relative to the clip's loudest frame.
import fs from 'node:fs';

export const MOUTH_FPS = 30;
const THRESHOLDS = [0.12, 0.35, 0.65]; // fraction of the clip's peak frame RMS

/** Read a PCM s16 WAV (what voice/index.mjs writes). Returns mono float samples. */
export function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${file}: not a WAV file`);
  }
  let pos = 12;
  let fmt = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!fmt || fmt.format !== 1 || fmt.bits !== 16) throw new Error(`${file}: expected PCM s16`);
      const frames = Math.floor(Math.min(size, buf.length - body) / (2 * fmt.channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.channels; c++) s += buf.readInt16LE(body + 2 * (i * fmt.channels + c));
        samples[i] = s / fmt.channels / 32768;
      }
      return {samples, sampleRate: fmt.sampleRate};
    }
    pos = body + size + (size % 2);
  }
  throw new Error(`${file}: no data chunk`);
}

export function mouthTrack(samples, sampleRate, fps = MOUTH_FPS) {
  const hop = sampleRate / fps;
  const n = Math.ceil(samples.length / hop);
  const rms = new Float64Array(n);
  for (let f = 0; f < n; f++) {
    const a = Math.floor(f * hop);
    const b = Math.min(samples.length, Math.floor((f + 1) * hop));
    let sum = 0;
    for (let i = a; i < b; i++) sum += samples[i] * samples[i];
    rms[f] = b > a ? Math.sqrt(sum / (b - a)) : 0;
  }
  const peak = Math.max(...rms, 1e-9);
  const levels = Array.from(rms, (r) => THRESHOLDS.filter((t) => r / peak >= t).length);
  // drop one-frame flickers (a frame unlike both equal neighbours)
  for (let f = 1; f < n - 1; f++) {
    if (levels[f - 1] === levels[f + 1] && levels[f] !== levels[f - 1]) levels[f] = levels[f - 1];
  }
  return levels.join('');
}
