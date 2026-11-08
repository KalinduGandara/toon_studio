// Phyllotaxis: seeds turned by a fixed angle. Fractions make spokes; the golden angle packs them.
import {Txt} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {createSignal, easeInOutCubic, easeOutCubic, linear} from '@revideo/core';
import {all, FONT, GOLDEN_ANGLE, phyllotaxis, plain, PointCloud, toonProject} from '../../src';

const N = 1000;
const PALETTE = ['#f94144', '#f3722c', '#f8961e', '#ffd166'];

export default toonProject(function* (s) {
  plain(s, '#0b0a12', '#1f1433');
  const hook = s.add(<Txt y={-s.h * 0.41} text="Which angle makes a sunflower?" fontFamily={FONT} fontSize={76} fontWeight={800}
    fill="#ffffff" width={s.w * 0.9} textWrap textAlign="center" />, 'ui') as Txt;
  const cy = -110;
  const angle = createSignal(90);
  const sizes = new Float32Array(N);
  const group = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    sizes[i] = 8 + 12 * Math.sqrt(i / N);
    group[i] = Math.min(3, Math.floor((4 * i) / N));
  }
  const flower = s.add(new PointCloud(() => {
    const p = phyllotaxis(N, angle(), 13.5);
    return {xs: p.xs, ys: p.ys, group, colors: PALETTE, sizes, round: true, glow: 8};
  }, {y: cy}));
  const label = s.add(<Txt y={cy + 515} fontFamily={FONT} fontSize={110} fontWeight={800} fill="#ffd166" text="90°" />, 'ui') as Txt;
  s.background((function* (): ThreadGenerator {
    for (;;) {
      const a = angle();
      label.text(Math.abs(a - Math.round(a)) < 0.02 ? `${Math.round(a)}°` : `${a.toFixed(1)}°`);
      yield;
    }
  })());

  yield* all(s.narrate('g1'), flower.count(N, s.duration('g1'), easeOutCubic));
  yield* s.narrate('g2');
  yield* all(s.narrate('g3'), angle(120, 1.6, easeInOutCubic));
  yield* all(s.narrate('g4'), angle(137, 2.2, easeInOutCubic));
  hook.text('The golden angle');
  yield* all(s.narrate('g5'), angle(GOLDEN_ANGLE, 2.6, easeInOutCubic));
  yield* all(s.narrate('g6'), flower.rotation(40, s.duration('g6'), linear));
  yield* all(s.narrate('g7'), flower.rotation(70, s.duration('g7'), linear));
  yield* all(s.narrate('g8'), flower.rotation(95, s.duration('g8') + 1.2, linear));
});
