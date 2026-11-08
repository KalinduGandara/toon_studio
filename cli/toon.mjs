#!/usr/bin/env node
// toon: voice, render and export a toon_studio video.
//
//   node cli/toon.mjs voice  videos/<slug>                 # TTS clips + manifest only
//   node cli/toon.mjs render videos/<slug> [--provider p]  # voice + render + export pack
//   node cli/toon.mjs frames videos/<slug> --at 1,4.5,9    # review stills from the export
//
// Output: out/<stem>/ with <stem>.mp4, <stem>_thumb.png, <stem>_post.json, <stem>.json.
process.env.DISABLE_TELEMETRY = 'true'; // Revideo telemetry off: tools make no network calls

import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ambientBed, writeWav} from './music.mjs';
import {buildVoice} from './voice/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SIZES = {short: {x: 1080, y: 1920}, long: {x: 1920, y: 1080}};

function parseArgs(argv) {
  const [cmd, dir, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) throw new Error(`unexpected argument ${rest[i]}`);
    opts[rest[i].slice(2)] = rest[i + 1];
    i++;
  }
  return {cmd, dir, opts};
}

export function loadScript(videoDir) {
  const file = path.join(videoDir, 'script.json');
  const script = JSON.parse(fs.readFileSync(file, 'utf8'));
  script.stem ??= path.basename(videoDir);
  script.format ??= 'short';
  script.seed ??= 1;
  if (!SIZES[script.format]) throw new Error(`${file}: format must be "short" or "long"`);
  if (!Array.isArray(script.lines)) throw new Error(`${file}: "lines" must be a list`);
  if (!script.post?.title) throw new Error(`${file}: post.title is required`);
  return script;
}

// Revideo looks for audio at <render dir>/../public/<src>, so the clips live in a "public"
// folder next to the render folder (and Vite serves that same folder).
function paths(script) {
  const out = path.join(ROOT, 'out', script.stem);
  return {
    out,
    voice: path.join(out, 'public'),
    render: path.join(out, 'render'),
    cache: path.join(ROOT, 'out', '.voice-cache'),
  };
}

async function voice(videoDir, opts) {
  const script = loadScript(videoDir);
  const voices = JSON.parse(fs.readFileSync(path.join(ROOT, 'voices.json'), 'utf8'));
  const provider = opts.provider || script.provider || voices.default_provider;
  const p = paths(script);
  const manifest = await buildVoice({
    script, voices, provider, outDir: p.voice, cacheDir: p.cache, log: console.log,
  });
  return {script, manifest, provider, p};
}

/** Chrome for Revideo's puppeteer: $TOON_CHROME, else the newest cached headless shell. */
function findChrome() {
  if (process.env.TOON_CHROME) return process.env.TOON_CHROME;
  const base = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome-headless-shell');
  const builds = fs.existsSync(base) ? fs.readdirSync(base).sort((a, b) => a.localeCompare(b, 'en', {numeric: true})) : [];
  for (const b of builds.reverse()) {
    const exe = path.join(base, b, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined; // let puppeteer use its own default
}

async function render(videoDir, opts) {
  const sceneFile = path.join(videoDir, 'scene.tsx');
  if (!fs.existsSync(sceneFile)) throw new Error(`${sceneFile} not found`);
  const {script, manifest, provider, p} = await voice(videoDir, opts);
  const {renderVideo} = await import('@revideo/renderer');
  const t0 = Date.now();
  process.chdir(ROOT);
  const chrome = findChrome();
  await renderVideo({
    projectFile: './' + path.relative(ROOT, sceneFile),
    variables: {voice: manifest, seed: script.seed, format: script.format},
    settings: {
      outFile: 'raw.mp4',
      outDir: p.render,
      logProgress: false,
      projectSettings: {size: SIZES[script.format]},
      puppeteer: chrome ? {executablePath: chrome} : {},
      viteConfig: {publicDir: p.voice, logLevel: 'warn'},
    },
  });
  console.log(`render: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  exportPack(script, provider, p);
}

const TARGET_LUFS = -14; // what YouTube and TikTok normalise to

function integratedLoudness(file) {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], {encoding: 'utf8'});
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(res.stderr.split('Summary:').pop() || '');
  return m ? +m[1] : null;
}

/** One linear gain to TARGET_LUFS (keeps the dynamics; video stream copied). */
function normaliseLoudness(mp4) {
  const lufs = integratedLoudness(mp4);
  if (lufs === null || Math.abs(lufs - TARGET_LUFS) < 0.3) return;
  const tmp = mp4.replace(/\.mp4$/, '.tmp.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-map', '0', '-c:v', 'copy',
    '-af', `volume=${(TARGET_LUFS - lufs).toFixed(2)}dB,alimiter=limit=0.89:level=false`,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, mp4);
}

function meanVolume(file) {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], {encoding: 'utf8'});
  return meanFrom(res.stderr);
}

function meanFrom(text) {
  const m = /mean_volume: (-?[\d.]+|-inf) dB/.exec(text);
  return m && m[1] !== '-inf' ? +m[1] : -Infinity;
}

function probeDuration(file) {
  return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}).trim();
}

function exportPack(script, provider, p) {
  const raw = path.join(p.render, 'raw.mp4');
  const streams = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', raw], {encoding: 'utf8'});
  if (!streams.includes('audio')) throw new Error('render has no audio track: a video needs at least one spoken line or s.sound() call');
  const level = meanVolume(raw);
  if (level < -60) throw new Error(`render audio is silent (mean ${level} dB): the voice clips were not mixed in`);
  const mp4 = path.join(p.out, `${script.stem}.mp4`);
  const inputs = ['-i', raw];
  let audio = [];
  if (script.music) {
    // procedural bed under the voice, ducked while someone speaks
    const wav = path.join(p.out, 'music.wav');
    writeWav(wav, ambientBed(probeDuration(raw), script.music.seed ?? script.seed));
    inputs.push('-i', wav);
    const vol = script.music.volume ?? 0.2;
    audio = ['-filter_complex',
      `[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit[v][sc];[1:a]volume=${vol}[m];` +
      '[m][sc]sidechaincompress=threshold=0.04:ratio=5:attack=30:release=500[md];' +
      '[v][md]amix=inputs=2:duration=first:normalize=0[a]',
      '-map', '0:v', '-map', '[a]'];
  }
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', ...inputs, ...audio,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', mp4,
  ]);
  fs.rmSync(p.render, {recursive: true, force: true});
  normaliseLoudness(mp4);
  const duration = probeDuration(mp4);
  const thumbAt = Math.min(script.thumbAt ?? duration * 0.5, Math.max(0, duration - 0.1));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(thumbAt), '-i', mp4, '-frames:v', '1', path.join(p.out, `${script.stem}_thumb.png`)]);
  fs.writeFileSync(path.join(p.out, `${script.stem}_post.json`), JSON.stringify(script.post, null, 2) + '\n');
  const meta = {
    tool: 'toon_studio', stem: script.stem, format: script.format, seed: script.seed, provider,
    duration: +duration.toFixed(3), lines: script.lines.length, size: SIZES[script.format], music: script.music ?? null,
  };
  fs.writeFileSync(path.join(p.out, `${script.stem}.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log(`export: ${mp4} (${duration.toFixed(1)} s)`);
}

function frames(videoDir, opts) {
  const script = loadScript(videoDir);
  const p = paths(script);
  const mp4 = path.join(p.out, `${script.stem}.mp4`);
  const times = (opts.at || '1').split(',').map(Number);
  for (const t of times) {
    const png = path.join(p.out, `frame_${t}.png`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', mp4, '-frames:v', '1', png]);
    console.log(png);
  }
}

const COMMANDS = {voice, render, frames};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {cmd, dir, opts} = parseArgs(process.argv.slice(2));
  if (!COMMANDS[cmd] || !dir) {
    console.error('usage: node cli/toon.mjs <voice|render|frames> videos/<slug> [--provider p] [--at t1,t2]');
    process.exit(2);
  }
  try {
    await COMMANDS[cmd](path.resolve(dir), opts);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}
