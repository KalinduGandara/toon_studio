import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chaosGame, prefixPath, sierpinski} from '../src/fractals.ts';
import {Rng} from '../src/rng.ts';
import {ambientBed} from '../cli/music.mjs';

const A = [0, -100], B = [-100, 73], C = [100, 73];

test('sierpinski depth d has 3^d triangles, each corner copy labelled 0/1/2', () => {
  assert.equal(sierpinski(A, B, C, 0).length, 1);
  const t = sierpinski(A, B, C, 4);
  assert.equal(t.length, 81);
  assert.deepEqual([...new Set(t.map((x) => x.digit))].sort(), [0, 1, 2]);
  assert.deepEqual(sierpinski(A, B, C, 1)[0].pts[0], A); // first copy keeps the first corner
});

test('chaos game stays inside the triangle and is reproducible by seed', () => {
  const g1 = chaosGame([A, B, C], 2000, new Rng(5), [0, 0]);
  const g2 = chaosGame([A, B, C], 2000, new Rng(5), [0, 0]);
  assert.deepEqual(g1.xs, g2.xs);
  for (let i = 0; i < 2000; i++) {
    assert.ok(g1.ys[i] >= -100.001 && g1.ys[i] <= 73.001, `y ${g1.ys[i]}`);
    assert.ok(g1.pick[i] <= 2);
  }
  // each point is halfway between the previous one and its chosen corner
  const c = [A, B, C][g1.pick[1]];
  assert.ok(Math.abs(g1.xs[1] - (g1.xs[0] + c[0]) / 2) < 1e-3);
});

test('prefixPath slices the first k sub-paths', () => {
  const p = prefixPath(['M 0 0 Z', 'M 1 1 Z', 'M 2 2 Z']);
  assert.equal(p.prefix(0), '');
  assert.equal(p.prefix(2), 'M 0 0 Z M 1 1 Z');
  assert.equal(p.prefix(99), p.text);
});

test('ambient bed: right length, deterministic, peak 0.5, fades in and out', () => {
  const a = ambientBed(3, 7);
  const b = ambientBed(3, 7);
  assert.equal(a.left.length, 3 * 48000);
  assert.deepEqual(a.left.slice(0, 5000), b.left.slice(0, 5000));
  let peak = 0;
  for (let i = 0; i < a.left.length; i++) peak = Math.max(peak, Math.abs(a.left[i]), Math.abs(a.right[i]));
  assert.ok(Math.abs(peak - 0.5) < 1e-3);
  assert.equal(a.left[0], 0);
  assert.ok(Math.abs(a.left[a.left.length - 1]) < 1e-3);
});

test('golden angle, phyllotaxis and times table', async () => {
  const {GOLDEN_ANGLE, phyllotaxis, timesTable} = await import('../src/fractals.ts');
  assert.ok(Math.abs(GOLDEN_ANGLE - 137.5078) < 1e-3);
  const p = phyllotaxis(100, GOLDEN_ANGLE, 10);
  assert.ok(Math.abs(Math.hypot(p.xs[99], p.ys[99]) - 10 * Math.sqrt(99.5)) < 1e-3);
  const t = timesTable(10, 2, 100);
  assert.equal(t.length, 10);
  assert.deepEqual(t[3][1].map(Math.round), t[6][0].map(Math.round)); // 3 x 2 = 6
});

test('Barnsley fern stays in its known box; Koch: perimeter x4/3, area -> 8/5 of the triangle', async () => {
  const {barnsleyFern, koch, perimeter, area} = await import('../src/fractals.ts');
  const f = barnsleyFern(5000, new Rng(2));
  for (let i = 0; i < 5000; i++) assert.ok(f.xs[i] > -2.2 && f.xs[i] < 2.8 && f.ys[i] >= 0 && f.ys[i] < 10.1);
  const a = [0, -100], b = [86.6, 50], c = [-86.6, 50];
  const k0 = koch(a, b, c, 0), k1 = koch(a, b, c, 1), k5 = koch(a, b, c, 5);
  assert.equal(k1.length, 12);
  assert.ok(Math.abs(perimeter(k1) / perimeter(k0) - 4 / 3) < 1e-9);
  assert.ok(area(k1) > area(k0)); // bumps point outward
  assert.ok(Math.abs(area(k5) / area(k0) - 1.6) < 0.015); // 1.5896 at depth 5, limit 8/5
});
