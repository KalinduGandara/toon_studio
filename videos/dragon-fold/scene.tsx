// Visual Maths #2: paper folding → Heighway dragon. Unfold one fold at a time: the middle crease
// swings a copy of the curve out about the end point (180° flat → 90°).
import {Txt} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {createSignal, easeInOutCubic, linear, waitFor} from '@revideo/core';
import {all, dragon, NEON, NEON_FONT, neonPulse, Polys, toonProject} from '../../src';
import type {Poly, V} from '../../src';

const BOX = 720;
const CHUNKS = 16;

/** Scale and centre points into a BOX-sized square. */
function fit(sets: V[][], box = BOX): V[][] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pts of sets) for (const [x, y] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const k = box / Math.max(x1 - x0, y1 - y0, 1e-9);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return sets.map((pts) => pts.map(([x, y]) => [(x - cx) * k, (y - cy) * k] as V));
}

/** Split a polyline into CHUNKS consecutive pieces (one colour each, cyan → magenta). */
function chunks(pts: V[]): Poly[] {
  const out: Poly[] = [];
  const step = Math.max(1, Math.ceil((pts.length - 1) / CHUNKS));
  for (let i = 0, g = 0; i < pts.length - 1; i += step, g++) out.push({pts: pts.slice(i, i + step + 1), group: Math.min(g, CHUNKS - 1)});
  return out;
}

function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('');
}
const GRADIENT = Array.from({length: CHUNKS}, (_, i) => mix(NEON.primary, NEON.secondary, i / (CHUNKS - 1)));

export default toonProject(function* (s) {
  const kit = neonPulse(s, {hook: '10 folds. What shape?', series: 'Visual Maths #2', handle: '@neonlemma'});
  const cy = 20;

  // faint ghost of the finished dragon behind the folded strip
  const ghost = s.add(new Polys({polys: chunks(fit([dragon(10)])[0]).map((p) => ({...p, group: 0})), open: true,
    colors: ['#33335a'], stroke: 4, glow: 0}, {y: cy, opacity: 0.8}));

  const folds = createSignal(1);
  const angle = createSignal(180); // the newest (middle) crease
  const main = s.add(new Polys({polys: () => chunks(fit([dragon(folds(), 90, angle())])[0]), open: true, colors: GRADIENT, stroke: 5, glow: 10}, {y: cy}));

  // four copies turned 90° about the start point, revealed by growing
  const base = dragon(10);
  const rot = (k: number): V[] => base.map(([x, y]) => {
    const a = (k * Math.PI) / 2;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)] as V;
  });
  const four = fit([0, 1, 2, 3].map(rot), 820);
  const grow = createSignal(base.length);
  const copies = s.add(new Polys({polys: () => four.map((pts, g) => ({pts: pts.slice(0, Math.max(2, Math.floor(grow()))), group: g})), open: true,
    colors: [NEON.primary, NEON.secondary, NEON.tertiary, NEON.positive], stroke: 3, glow: 8}, {y: cy, opacity: 0}));
  grow(2);

  const info = s.add(<Txt y={cy + 470} fontFamily={NEON_FONT} fontSize={56} fontWeight={700} fill={NEON.text} text="folds: 10" />, 'ui') as Txt;

  yield* s.narrate('r1');
  yield* s.narrate('r2');

  // r3: 1, 2, 3, 4 folds opening; segment count doubles
  yield* ghost.opacity(0, 0.4);
  // passes follow the sentences: "One fold makes two" / "Two folds make four" / "Every fold doubles them"
  const r3 = s.duration('r3');
  const share = [0.36, 0.26, 0.19, 0.19];
  function* pass(n: number, t: number): ThreadGenerator {
    folds(n);
    angle(180);
    info.text(`segments: ${(2 ** n).toLocaleString('en-US')}`);
    yield* angle(90, t * 0.75, easeInOutCubic);
    yield* waitFor(t * 0.25);
  }
  yield* all(s.narrate('r3'), (function* () {
    for (let n = 1; n <= 4; n++) yield* pass(n, r3 * share[n - 1]);
  })());

  // r4: folds 5-10 open one after another into the dragon
  const per4 = (s.duration('r4') * 0.92) / 6;
  yield* all(s.narrate('r4'), (function* () {
    for (let n = 5; n <= 10; n++) yield* pass(n, per4);
  })());
  info.text('segments: 1,024');
  yield* all(info.fill(NEON.highlight, 0.3), main.scale(1.04, 0.3).to(1, 0.3));

  // r5: four copies around one point
  info.text('');
  // swap instantly: a function-driven Polys caches its bounds from creation, so it must not fade
  main.remove();
  copies.opacity(1);
  yield* all(s.narrate('r5'), grow(base.length, s.duration('r5') * 0.85, linear));

  // r6: name it
  info.fill(NEON.muted);
  info.fontSize(44);
  info.text('Heighway dragon · 1960s');
  yield* all(s.narrate('r6'), copies.rotation(30, s.duration('r6'), linear));
  yield* all(s.narrate('r7'), copies.rotation(60, s.duration('r7') + 1.9, linear), kit.end('How many folds can you do with real paper?', 0.4));
});
