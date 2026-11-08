// Voice layer: script lines -> normalised WAV clips + manifest (durations, mouth tracks).
//
// TTS engines are "providers" (see PROVIDERS). A provider only turns text into WAV files;
// caching, loudness, sample rate and lip sync live here, so swapping Kokoro for Chatterbox
// means adding one provider file, one PROVIDERS entry and its settings in voices.json.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {mouthTrack, MOUTH_FPS, readWav} from './lipsync.mjs';

export const PROVIDERS = {
  kokoro: () => import('./kokoro.mjs'),
};

const SAMPLE_RATE = 48000;

export async function loadProvider(name) {
  const load = PROVIDERS[name];
  if (!load) throw new Error(`unknown TTS provider "${name}" (known: ${Object.keys(PROVIDERS).join(', ')})`);
  const mod = await load();
  if (typeof mod.synthesize !== 'function') throw new Error(`provider "${name}" has no synthesize()`);
  return mod;
}

/** Map each script line to the provider settings of its speaker's logical voice. */
export function resolveJobs(script, voices, provider) {
  const seen = new Set();
  return script.lines.map((line) => {
    if (!line.id || seen.has(line.id)) throw new Error(`line ids must be unique and non-empty (got "${line.id}")`);
    seen.add(line.id);
    const member = script.cast?.[line.who];
    if (!member) throw new Error(`line ${line.id}: "${line.who}" is not in cast`);
    const voice = voices.voices?.[member.voice];
    if (!voice) throw new Error(`line ${line.id}: voice "${member.voice}" is not in voices.json`);
    const settings = voice[provider];
    if (!settings) throw new Error(`voice "${member.voice}" has no settings for provider "${provider}"`);
    const key = createHash('sha256')
      .update(JSON.stringify([provider, settings, line.text]))
      .digest('hex')
      .slice(0, 16);
    return {id: line.id, who: line.who, text: line.text, caption: line.caption, settings, key};
  });
}

/**
 * Synthesise every line (cached by provider + settings + text), normalise to 48 kHz mono
 * 16-bit at a common loudness, and write <outDir>/<id>.wav plus manifest.json.
 */
export async function buildVoice({script, voices, provider, outDir, cacheDir, log = () => {}}) {
  const jobs = resolveJobs(script, voices, provider);
  fs.mkdirSync(outDir, {recursive: true});
  fs.mkdirSync(cacheDir, {recursive: true});
  const cached = (j) => path.join(cacheDir, `${j.key}.wav`);
  const raw = (j) => path.join(cacheDir, `${j.key}.raw.wav`);

  const todo = jobs.filter((j) => !fs.existsSync(cached(j)));
  if (todo.length) {
    log(`voice: synthesising ${todo.length}/${jobs.length} lines with ${provider}`);
    const mod = await loadProvider(provider);
    await mod.synthesize(todo.map((j) => ({text: j.text, settings: j.settings, out: raw(j)})));
    for (const j of todo) {
      if (!fs.existsSync(raw(j))) throw new Error(`provider ${provider} did not write ${raw(j)}`);
      normalise(raw(j), cached(j));
      fs.rmSync(raw(j));
    }
  } else {
    log(`voice: all ${jobs.length} lines cached`);
  }

  const lines = {};
  for (const j of jobs) {
    const file = `${j.id}.wav`;
    fs.copyFileSync(cached(j), path.join(outDir, file));
    const {samples, sampleRate} = readWav(cached(j));
    lines[j.id] = {
      who: j.who,
      text: j.text,
      ...(j.caption ? {caption: j.caption} : {}),
      file,
      duration: +(samples.length / sampleRate).toFixed(3),
      mouth: mouthTrack(samples, sampleRate),
    };
  }
  const manifest = {provider, mouthFps: MOUTH_FPS, lines};
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  return manifest;
}

/** Same loudness and format for every provider: 48 kHz mono s16, -16 LUFS, 60 ms tail. */
function normalise(src, dst) {
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', src,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.06',
    '-ar', String(SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le', dst,
  ]);
}
