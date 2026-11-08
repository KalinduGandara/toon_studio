// Barnsley fern: the chaos game with four affine rules grows a fern.
import {Circle, Txt} from '@revideo/2d';
import {createSignal, easeInCubic, easeOutBack, linear} from '@revideo/core';
import {all, barnsleyFern, FONT, label, plain, PointCloud, toonProject, waitFor} from '../../src';

const N = 70000;
const COLORS = ['#c08552', '#80ed99', '#38b000', '#b5e48c']; // stem, upward copy, left leaf, right leaf
const SCALE = 118;
const BASE = 470;
const SHIFT = -40;

export default toonProject(function* (s) {
  plain(s, '#050a07', '#10261a');
  const hook = s.add(<Txt y={-s.h * 0.41} text="Can randomness grow a plant?" fontFamily={FONT} fontSize={76} fontWeight={800}
    fill="#ffffff" width={s.w * 0.9} textWrap textAlign="center" />, 'ui') as Txt;
  const fern = barnsleyFern(N, s.rng.fork());
  const xs = new Float32Array(N);
  const ys = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    xs[i] = fern.xs[i] * SCALE + SHIFT;
    ys[i] = BASE - fern.ys[i] * SCALE;
  }
  const dot = createSignal(12);
  const cloud = s.add(new PointCloud(() => ({xs, ys, group: fern.map, colors: COLORS, size: dot(), glow: 5})));

  yield* s.narrate('f1');
  const chips = [
    label(s, 'Stem 1%', [-300, -s.h * 0.33], {color: COLORS[0], size: 38}),
    label(s, 'Shrink up 85%', [170, -s.h * 0.33], {color: COLORS[1], size: 38}),
    label(s, 'Left leaf 7%', [-230, -s.h * 0.33 + 95], {color: COLORS[2], size: 38}),
    label(s, 'Right leaf 7%', [230, -s.h * 0.33 + 95], {color: COLORS[3], size: 38}),
  ];
  yield* all(s.narrate('f2'), (function* () {
    for (const c of chips) {
      yield* c;
      yield* waitFor(0.35);
    }
  })());
  yield* all(s.narrate('f3'), cloud.count(25, s.duration('f3'), linear));
  yield* all(s.narrate('f4'), cloud.count(1000, s.duration('f4'), linear), dot(3.2, s.duration('f4')));
  yield* all(s.narrate('f5'), cloud.count(N, s.duration('f5') + 1.2, easeInCubic), dot(2.2, 1.5),
    ...chips.map((c) => c.node.opacity(0, 0.8)));
  hook.text('The Barnsley fern');

  // ring the lowest right leaflet: every point made by the "right leaf" rule lies in it
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < N; i++) {
    if (fern.map[i] !== 3) continue;
    x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i]); y0 = Math.min(y0, ys[i]); y1 = Math.max(y1, ys[i]);
  }
  const ring = s.add(<Circle x={(x0 + x1) / 2} y={(y0 + y1) / 2} size={Math.max(x1 - x0, y1 - y0) * 1.15} stroke="#ffd166"
    lineWidth={8} scale={0} />) as Circle;
  const copy = label(s, 'a smaller copy', [(x0 + x1) / 2 + 120, y1 + 60], {color: '#ffd166', size: 40});
  yield* all(s.narrate('f6'), ring.scale(1, 0.4, easeOutBack), copy);
  yield* all(s.narrate('f7'), ring.opacity(0, 0.6), copy.node.opacity(0, 0.6), cloud.scale(1.04, s.duration('f7') + 1));
});
