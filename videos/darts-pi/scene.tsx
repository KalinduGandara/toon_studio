// Visual Maths #1: Monte Carlo darts. 4 × (share inside the quarter circle) → π.
import {Circle, Rect, Txt} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {createSignal, easeInCubic, easeInOutCubic, linear} from '@revideo/core';
import {all, darts, NEON, NEON_FONT, neonPulse, PointCloud, toonProject} from '../../src';

const N = 150000;
const SIDE = 680;
const CY = -40;

export default toonProject(function* (s) {
  const kit = neonPulse(s, {hook: 'Random darts find π', series: 'Visual Maths #1', handle: '@neonlemma'});
  const d = darts(N, s.rng.fork()); // seed 14: 10 → 3.6, 100 → 3.36, 1,000 → 3.16, 100,000 → 3.1425
  const x0 = -SIDE / 2, y1 = CY + SIDE / 2;
  const xs = new Float32Array(N), ys = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    xs[i] = x0 + d.xs[i] * SIDE;
    ys[i] = y1 - d.ys[i] * SIDE;
  }
  const group = d.inside.map((v) => (v ? 0 : 1));

  // square, quarter-circle tint, darts, then the arc on top
  s.add(<Rect y={CY} width={SIDE} height={SIDE} fill={NEON.bgAlt + 'aa'} stroke={NEON.grid} lineWidth={4} />);
  const tint = s.add<Circle>(<Circle x={x0} y={y1} size={SIDE * 2} startAngle={-90} endAngle={0} closed fill={NEON.primary} opacity={0.06} /> as Circle);
  const cloud = s.add(new PointCloud({xs, ys, group, colors: [NEON.primary, NEON.secondary], size: 3, round: false, glow: 0}));
  const arc = s.add<Circle>(<Circle x={x0} y={y1} size={SIDE * 2} startAngle={-90} endAngle={0} stroke={NEON.primary} lineWidth={6}
    shadowColor={NEON.primary} shadowBlur={18} /> as Circle);

  const info = s.add(<Txt y={y1 + 55} fontFamily={NEON_FONT} fontSize={40} fontWeight={700} fill={NEON.muted} text="" />, 'ui') as Txt;
  const est = s.add(<Txt y={y1 + 118} fontFamily={NEON_FONT} fontSize={68} fontWeight={700} fill={NEON.text} text="" />, 'ui') as Txt;
  const note = createSignal('');
  s.background((function* (): ThreadGenerator {
    for (;;) {
      const k = Math.floor(cloud.count());
      info.text(note() || `darts ${k.toLocaleString('en-US')}`);
      est.text(k ? `π ≈ ${((4 * d.hits[k - 1]) / k).toFixed(3)}` : 'π ≈ ?');
      yield;
    }
  })());

  yield* all(s.narrate('d1'), cloud.count(10, 1.6, linear));
  note('inside ÷ all → π/4');
  yield* all(s.narrate('d2'), tint.opacity(0.22, 1, easeInOutCubic).to(0.06, 1.2), arc.lineWidth(11, 0.6).to(6, 0.8));
  note('');
  yield* all(s.narrate('d3'), cloud.count(100, s.duration('d3') * 0.8, linear));
  yield* all(s.narrate('d4'), cloud.count(1000, s.duration('d4') * 0.8, easeInOutCubic));
  yield* all(s.narrate('d5'), cloud.count(100000, s.duration('d5') * 0.85, easeInCubic));
  yield* all(est.fill(NEON.highlight, 0.3), est.scale(1.15, 0.3).to(1, 0.3));
  note('10× precision = 100× darts');
  yield* all(s.narrate('d6'), cloud.count(130000, s.duration('d6'), linear));
  note('');
  yield* all(s.narrate('d7'), cloud.count(N, s.duration('d7') + 1.9, linear), kit.end('How many darts for 3.14159? Guess below.', 0.4));
});
