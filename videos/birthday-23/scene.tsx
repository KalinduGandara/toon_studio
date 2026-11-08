// Visual Maths #3: the birthday paradox. People land on a 365-day ring; the chance is exact
// (birthdayMatch), the ring is one simulated room (seed 13: first shared day at person 23).
import {Circle, Txt} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {createSignal, easeInOutCubic, linear, waitFor} from '@revideo/core';
import {all, birthdayMatch, NEON, NEON_FONT, neonPulse, PointCloud, Polys, toonProject} from '../../src';
import type {Poly, V} from '../../src';

const R = 320;
const CY = -10;
const MAX = 70;

export default toonProject(function* (s) {
  const kit = neonPulse(s, {hook: '23 people. Same birthday?', series: 'Visual Maths #3', handle: '@neonlemma'});
  const rng = s.rng.fork();
  const days = Array.from({length: MAX}, () => rng.int(0, 364));
  const at = (day: number, r: number): V => {
    const a = (day / 365) * Math.PI * 2 - Math.PI / 2;
    return [r * Math.cos(a), CY + r * Math.sin(a)];
  };

  // 365 day dots + month initials
  const dx = new Float32Array(365), dy = new Float32Array(365);
  for (let d = 0; d < 365; d++) [dx[d], dy[d]] = at(d, R);
  const ring = s.add(new PointCloud({xs: dx, ys: dy, group: new Uint8Array(365), colors: ['#3a3a5c'], size: 6, round: true, glow: 0}));
  ring.count(365);
  const months = 'JFMAMJJASOND';
  const starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const labels = starts.map((d, i) => {
    const [x, y] = at(d + 14, R + 52);
    return s.add(<Txt x={x} y={y} text={months[i]} fontFamily={NEON_FONT} fontSize={30} fontWeight={700} fill={NEON.muted} />) as Txt;
  });

  // people: stack inward when a day is taken; shared days turn magenta
  const k = createSignal(3);
  const pos: V[] = [];
  const shared = new Uint8Array(MAX);
  const count = new Map<number, number>();
  days.forEach((d, i) => {
    const c = count.get(d) ?? 0;
    pos.push(at(d, R - 34 - 30 * c));
    count.set(d, c + 1);
  });
  days.forEach((d, i) => { if (days.indexOf(d) !== i) shared[i] = 1; });
  const firstOf = days.map((d) => days.indexOf(d));
  const you = createSignal(-1);
  const people = s.add(new PointCloud(() => {
    const n = Math.floor(k());
    const xs = new Float32Array(MAX), ys = new Float32Array(MAX), group = new Uint8Array(MAX);
    for (let i = 0; i < MAX; i++) {
      [xs[i], ys[i]] = pos[i];
      // a person is magenta once someone else on screen shares their day
      const partner = shared[i] ? firstOf[i] < n : days.some((d, j) => j !== i && j < n && d === days[i]);
      group[i] = i === you() ? 2 : partner ? 1 : 0;
    }
    return {xs, ys, group, colors: [NEON.primary, NEON.secondary, NEON.highlight], size: 22, round: true, glow: 10};
  }));
  people.count(() => Math.floor(k()));

  // pair lines (all pairs among the people on screen)
  const showPairs = createSignal(0);
  k(MAX);
  const pairs = s.add(new Polys({polys: (): Poly[] => {
    if (!showPairs()) return [{pts: [[-R, CY - R], [R, CY + R]], group: 1}];
    const n = Math.floor(k()), out: Poly[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push({pts: [pos[i], pos[j]], group: 0});
    return out;
  }, open: true, colors: [NEON.primary + '38', '#00000000'], stroke: 1.5, glow: 0}));
  k(3);
  pairs.moveBelow(people);

  const info = s.add(<Txt y={CY + R + 100} fontFamily={NEON_FONT} fontSize={54} fontWeight={700} fill={NEON.text} text="" />, 'ui') as Txt;
  const small = s.add(<Txt y={CY + R + 152} fontFamily={NEON_FONT} fontSize={30} fontWeight={700} fill={NEON.muted} text="" />, 'ui') as Txt;
  const mode = createSignal<'chance' | 'pairs' | 'fixed'>('chance');
  const pct = (n: number) => `${(birthdayMatch(n) * 100).toFixed(1)}%`;
  s.background((function* (): ThreadGenerator {
    for (;;) {
      const n = Math.floor(k());
      if (mode() === 'chance') info.text(`${n} people · ${pct(n)}`);
      if (mode() === 'pairs') info.text(`${n} people · ${((n * (n - 1)) / 2).toLocaleString('en-US')} pairs`);
      yield;
    }
  })());

  void labels;
  yield* all(s.narrate('b1'), k(4, s.duration('b1'), linear));
  yield* all(s.narrate('b2'), k(7, s.duration('b2'), linear));
  yield* all(s.narrate('b3'), k(10, s.duration('b3') * 0.7, linear));
  mode('pairs');
  showPairs(1);
  yield* all(s.narrate('b4'), k(22, s.duration('b4') * 0.85, linear));
  mode('fixed');
  k(23);
  info.text('23 people · 253 pairs · 50.7%');
  small.text('assumes 365 equally likely days');
  yield* all(s.narrate('b5'), info.fill(NEON.highlight, 0.3), info.scale(1.08, 0.3).to(1, 0.3));
  yield* waitFor(0.7); // caption-free beat on the payoff (thumbnail)
  showPairs(0);
  info.fill(NEON.text);
  small.text('');
  mode('chance');
  // "At fifty people it's 97%" then "At seventy, 99.9%"
  const b6 = s.duration('b6');
  yield* all(s.narrate('b6'), (function* () {
    yield* k(50, b6 * 0.4, easeInOutCubic);
    yield* waitFor(b6 * 0.08);
    yield* k(MAX, b6 * 0.42, easeInOutCubic);
  })());
  mode('fixed');
  you(5);
  info.text('your birthday? 253 others');
  const [ux, uy] = pos[5];
  const tag = s.add(<Txt x={ux * 0.78} y={CY + (uy - CY) * 0.78} text="you" fontFamily={NEON_FONT} fontSize={34} fontWeight={700} fill={NEON.highlight} />) as Txt;
  const halo = s.add(<Circle x={ux} y={uy} size={44} stroke={NEON.highlight} lineWidth={4} />) as Circle;
  yield* all(s.narrate('b7'), halo.size(60, 0.5).to(44, 0.5));
  tag.remove();
  halo.remove();
  info.text('');
  yield* all(s.narrate('b8'), kit.end('Have you met your birthday twin? Tell us below.', 0.6));
});
