import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {buildVoice, PROVIDERS, resolveJobs} from '../cli/voice/index.mjs';
import {mouthTrack, readWav} from '../cli/voice/lipsync.mjs';
import {loadScript} from '../cli/toon.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'toon-test-'));

const script = {
  cast: {a: {voice: 'v1'}, b: {voice: 'v2'}},
  lines: [{id: 'l1', who: 'a', text: 'Hello there.'}, {id: 'l2', who: 'b', text: 'Hi!'}],
};
const voices = {voices: {v1: {fake: {hz: 330}}, v2: {fake: {hz: 550}}}};

// A stand-in TTS engine: proves the provider contract (write a WAV per job) is all a new engine needs.
let calls = 0;
PROVIDERS.fake = async () => ({
  async synthesize(jobs) {
    calls += jobs.length;
    for (const j of jobs) {
      const dur = 0.2 + j.text.length * 0.03;
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${j.settings.hz}:duration=${dur}`, '-ar', '22050', j.out]);
    }
  },
});

test('mouth track: silence is closed, loud is wide open', () => {
  const sr = 3000;
  const s = new Float32Array(sr); // 1 s: first half silent, second half loud
  for (let i = sr / 2; i < sr; i++) s[i] = Math.sin(i) * 0.8;
  const t = mouthTrack(s, sr, 10);
  assert.equal(t.length, 10);
  assert.equal(t.slice(0, 5), '00000');
  assert.equal(t.slice(5), '33333');
});

test('resolveJobs reports missing cast, voices and provider settings', () => {
  assert.throws(() => resolveJobs({...script, lines: [{id: 'x', who: 'zed', text: 'hi'}]}, voices, 'fake'), /not in cast/);
  assert.throws(() => resolveJobs(script, {voices: {v1: {fake: {}}}}, 'fake'), /voice "v2" is not in voices.json/);
  assert.throws(() => resolveJobs(script, voices, 'kokoro'), /no settings for provider "kokoro"/);
  assert.throws(() => resolveJobs({...script, lines: [script.lines[0], script.lines[0]]}, voices, 'fake'), /unique/);
});

test('buildVoice normalises clips, writes a manifest and caches by provider+settings+text', async () => {
  const dir = tmp();
  calls = 0;
  const args = {script, voices, provider: 'fake', outDir: path.join(dir, 'public'), cacheDir: path.join(dir, 'cache')};
  const m = await buildVoice(args);
  assert.equal(calls, 2);
  assert.deepEqual(Object.keys(m.lines), ['l1', 'l2']);
  const l1 = m.lines.l1;
  assert.equal(l1.file, 'l1.wav');
  assert.ok(l1.duration > 0.5 && l1.duration < 0.8, `duration ${l1.duration}`);
  assert.equal(l1.mouth.length, Math.ceil(l1.duration * 30));
  const wav = readWav(path.join(args.outDir, 'l1.wav'));
  assert.equal(wav.sampleRate, 48000);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(args.outDir, 'manifest.json'), 'utf8')), m);

  await buildVoice(args); // unchanged: all cached
  assert.equal(calls, 2);
  await buildVoice({...args, voices: {voices: {...voices.voices, v2: {fake: {hz: 440}}}}}); // v2 settings changed
  assert.equal(calls, 3);
});

test('unknown providers fail clearly', async () => {
  const dir = tmp();
  const v = {voices: {v1: {nope: {}}, v2: {nope: {}}}};
  await assert.rejects(buildVoice({script, voices: v, provider: 'nope', outDir: dir, cacheDir: dir}), /unknown TTS provider "nope"/);
});

test('loadScript fills defaults and requires a title', () => {
  const dir = tmp();
  const vdir = path.join(dir, 'my-video');
  fs.mkdirSync(vdir);
  fs.writeFileSync(path.join(vdir, 'script.json'), JSON.stringify({cast: {}, lines: [], post: {title: 'T'}}));
  const s = loadScript(vdir);
  assert.equal(s.stem, 'my-video');
  assert.equal(s.format, 'short');
  fs.writeFileSync(path.join(vdir, 'script.json'), JSON.stringify({lines: [], post: {}}));
  assert.throws(() => loadScript(vdir), /post.title is required/);
});

test('an optional caption reaches the manifest; the spoken text stays the TTS input', async () => {
  const s = {cast: {a: {voice: 'v1'}}, lines: [{id: 'c1', who: 'a', text: 'pi is about three point one four', caption: 'π ≈ 3.14'}, {id: 'c2', who: 'a', text: 'Plain.'}]};
  const dir = tmp();
  const m = await buildVoice({script: s, voices, provider: 'fake', outDir: path.join(dir, 'out'), cacheDir: path.join(dir, 'cache')});
  assert.equal(m.lines.c1.caption, 'π ≈ 3.14');
  assert.equal(m.lines.c1.text, 'pi is about three point one four');
  assert.equal('caption' in m.lines.c2, false);
});
