// Procedural ambient music bed (original, deterministic): slow chord pads plus soft bells.
// Used under narration via script.json  "music": {"volume": 0.2, "seed": 3}.
import fs from 'node:fs';

const SR = 48000;
// D major dream progression, MIDI notes: Dmaj7, Bm7, Gmaj7, Asus4
const CHORDS = [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 50, 52, 57]];
const BELLS = [74, 76, 78, 81, 83, 86]; // D major pentatonic, high
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns {left, right} Float32Arrays of `seconds` at 48 kHz, peak about 0.5. */
export function ambientBed(seconds, seed = 1, chordSeconds = 5) {
  const n = Math.ceil(seconds * SR);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const rnd = mulberry32(seed);
  const offset = Math.floor(rnd() * CHORDS.length);
  const fadeIn = 1.5;
  const tail = 2.5;
  // pads: each chord swells in and overlaps the next
  for (let c = 0; c * chordSeconds < seconds; c++) {
    const chord = CHORDS[(c + offset) % CHORDS.length];
    const t0 = c * chordSeconds;
    const len = chordSeconds + tail;
    const a = Math.floor(t0 * SR);
    const b = Math.min(n, Math.floor((t0 + len) * SR));
    chord.forEach((m, v) => {
      const f = hz(m);
      const det = 1 + (v - 1.5) * 0.0012;
      const pan = 0.5 + (v - 1.5) * 0.18;
      for (let i = a; i < b; i++) {
        const t = (i - a) / SR;
        const env = Math.min(1, t / fadeIn) * Math.min(1, (len - t) / tail);
        const s = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * det * t) +
          0.15 * Math.sin(2 * Math.PI * f * 0.5 * t)) * env * 0.06;
        left[i] += s * (1 - pan);
        right[i] += s * pan;
      }
    });
  }
  // bells: sparse, seeded
  for (let t0 = 0.8; t0 < seconds - 1; t0 += 1.1 + rnd() * 1.6) {
    const f = hz(BELLS[Math.floor(rnd() * BELLS.length)]);
    const pan = 0.25 + rnd() * 0.5;
    const a = Math.floor(t0 * SR);
    const b = Math.min(n, a + 3 * SR);
    for (let i = a; i < b; i++) {
      const t = (i - a) / SR;
      const s = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t * 6)) *
        Math.exp(-t * 1.8) * Math.min(1, t * 400) * 0.05;
      left[i] += s * (1 - pan);
      right[i] += s * pan;
    }
  }
  // master fade in/out and normalise
  let peak = 1e-9;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const g = Math.min(1, t / 1.0) * Math.min(1, (seconds - t) / 2.0);
    left[i] *= g;
    right[i] *= g;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  for (let i = 0; i < n; i++) {
    left[i] *= 0.5 / peak;
    right[i] *= 0.5 / peak;
  }
  return {left, right};
}

export function writeWav(file, {left, right}) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}
