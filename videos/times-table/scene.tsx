// Times tables on a circle: k = 2 draws a cardioid, k = 3 a nephroid, then a morphing sweep.
import {Circle, Node, Txt} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {createSignal, easeInOutCubic, easeInOutSine, easeOutBack, linear} from '@revideo/core';
import {all, delay, FONT, plain, PointCloud, Polys, timesTable, toonProject} from '../../src';

const N = 200;
const R = 420;
const EXAMPLES = [10, 20, 30, 40];

export default toonProject(function* (s) {
  plain(s, '#05060f', '#151436');
  const hook = s.add(<Txt y={-s.h * 0.41} text="Multiply by 2 on a circle..." fontFamily={FONT} fontSize={76} fontWeight={800}
    fill="#ffffff" width={s.w * 0.9} textWrap textAlign="center" />, 'ui') as Txt;
  const cy = -120;
  const k = createSignal(2);
  const shown = createSignal(0);
  const ring = s.add(<Circle y={cy} size={2 * R} stroke="#ffffff44" lineWidth={3} scale={0} />) as Circle;
  const ptsX = new Float32Array(N);
  const ptsY = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N - Math.PI / 2;
    ptsX[i] = R * Math.cos(a);
    ptsY[i] = R * Math.sin(a);
  }
  const dots = s.add(new PointCloud({xs: ptsX, ys: ptsY, group: new Uint8Array(N), colors: ['#ffffff'], size: 7, round: true, glow: 6}, {y: cy}));
  const chords = s.add(new Polys({
    polys: () => timesTable(N, k(), R).slice(0, Math.floor(shown())).map(([a, b]) => ({pts: [a, b], group: 0})),
    colors: ['#ff4d8d', '#ffd166', '#2de2e6', '#9b5de5'], open: true, stroke: 1.8, glow: 6, conic: {at: [0, cy]},
  }, {y: cy}));
  const label = s.add(<Txt y={cy + R + 100} fontFamily={FONT} fontSize={100} fontWeight={800} fill="#ffd166" text="× 2" />, 'ui') as Txt;
  s.background((function* (): ThreadGenerator {
    for (;;) {
      const v = k();
      label.text(Math.abs(v - Math.round(v)) < 0.01 ? `× ${Math.round(v)}` : `× ${v.toFixed(2)}`);
      yield;
    }
  })());
  void chords;

  // worked examples: 10 -> 20, 20 -> 40, ... drawn thick with their numbers
  const exShown = createSignal(0);
  const examples = s.add(new Polys({
    polys: () => EXAMPLES.slice(0, Math.floor(exShown())).map((i) => ({pts: timesTable(N, 2, R)[i], group: 0})),
    colors: ['#ffffff'], open: true, stroke: 5, glow: 12,
  }, {y: cy}));
  const tags = s.add(<Node y={cy} />) as Node;
  for (const n of [...new Set(EXAMPLES.flatMap((i) => [i, 2 * i]))]) {
    const a = (2 * Math.PI * n) / N - Math.PI / 2;
    tags.add(<Txt x={(R + 52) * Math.cos(a)} y={(R + 52) * Math.sin(a)} text={String(n)} fontFamily={FONT} fontSize={40}
      fontWeight={800} fill="#ffd166" opacity={0} />);
  }

  yield* all(s.narrate('t1'), ring.scale(1, 0.6, easeOutBack), dots.count(N, s.duration('t1') * 0.8, linear));
  yield* all(s.narrate('t2'), exShown(EXAMPLES.length, s.duration('t2'), linear),
    ...tags.children().map((t, i) => delay(i * 0.35, t.opacity(1, 0.3))));
  hook.text('A cardioid ♥');
  yield* all(s.narrate('t3'), shown(N, s.duration('t3'), easeInOutSine), examples.opacity(0, 1), tags.opacity(0, 1));
  hook.text('× 3: a nephroid');
  yield* all(s.narrate('t4'), k(3, 2.2, easeInOutCubic));
  hook.text('Keep multiplying...');
  yield* all(s.narrate('t5'), k(7, s.duration('t5') + 0.5, easeInOutSine));
  yield* all(s.narrate('t6'), k(21, s.duration('t6') + 1.5, easeInOutSine));
  yield* all(s.narrate('t7'), k(34, s.duration('t7') + 2.5, easeInOutSine));
});
