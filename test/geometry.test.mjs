import assert from 'node:assert/strict';
import {test} from 'node:test';
import {limb, POSES, resolvePose, walkOffsets} from '../src/rig.ts';
import {EXPRESSIONS, eyePath, mouthPath} from '../src/face.ts';
import {captionChunks} from '../src/text.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('limb hangs straight down at 0 degrees and swings outward per side', () => {
  const [o, mid, end] = limb([10, 0], 1, 0, 0, 50, 40);
  assert.deepEqual(o, [10, 0]);
  close(mid[0], 10); close(mid[1], 50); close(end[0], 10); close(end[1], 90);
  const left = limb([0, 0], -1, 90, 0, 50, 40);
  const right = limb([0, 0], 1, 90, 0, 50, 40);
  close(left[2][0], -90); close(right[2][0], 90);
});

test('every pose has all joints; unknown poses throw', () => {
  for (const [name, p] of Object.entries(POSES)) {
    for (const k of ['la', 'le', 'ra', 're', 'll', 'lk', 'rl', 'rk']) assert.equal(typeof p[k], 'number', `${name}.${k}`);
  }
  assert.equal(resolvePose({ra: 90}).ra, 90);
  assert.equal(resolvePose({ra: 90}).la, POSES.stand.la);
  assert.throws(() => resolvePose('moonwalk'), /unknown pose/);
});

test('walk cycle swings the legs in opposite directions', () => {
  const w = walkOffsets(Math.PI / 2);
  assert.ok(w.ll > 5 && w.rl < 5);
});

test('every emotion draws an eye and a mouth', () => {
  for (const e of Object.keys(EXPRESSIONS)) {
    for (const open of [0, 1, 3]) assert.match(mouthPath(e, open, 20).d, /^M /);
    assert.match(eyePath(e, 0, 10).d, /^M /);
  }
  assert.throws(() => eyePath('grumpy', 0, 10), /unknown emotion/);
});

test('closed mouth is a stroke, open mouth is filled and taller when wider open', () => {
  assert.equal(mouthPath('smile', 0, 20).filled, false);
  assert.equal(mouthPath('smile', 2, 20).filled, true);
  const depth = (d) => Math.max(...d.match(/-?[\d.]+/g).map(Number));
  assert.ok(depth(mouthPath('neutral', 3, 20).d) > depth(mouthPath('neutral', 1, 20).d));
});

test('a blink closes dot eyes into a line', () => {
  assert.equal(eyePath('neutral', 0, 10).filled, true);
  assert.deepEqual(eyePath('neutral', 1, 10), {d: 'M -10 0 L 10 0', filled: false});
});

test('captions split on punctuation and word count', () => {
  assert.deepEqual(captionChunks('Hmph. You ate the last cookie.', 4), ['Hmph.', 'You ate the last', 'cookie.']);
  assert.deepEqual(captionChunks('  one  ', 4), ['one']);
});
