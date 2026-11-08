// Koch snowflake: the edge grows by 4/3 each step (to infinity), the area tends to 8/5.
import {Txt} from '@revideo/2d';
import {easeInOutSine, linear} from '@revideo/core';
import {all, area, FONT, koch, perimeter, plain, Polys, toonProject, V, waitFor} from '../../src';

const COLORS = ['#7bdff2', '#b2f7ef', '#c77dff', '#5390d9'];

export default toonProject(function* (s) {
  plain(s, '#04060e', '#0f1a36');
  const hook = s.add(<Txt y={-s.h * 0.41} text="Infinite edge. Finite area?" fontFamily={FONT} fontSize={76} fontWeight={800}
    fill="#ffffff" width={s.w * 0.9} textWrap textAlign="center" />, 'ui') as Txt;
  const cy = -120;
  const R = 400;
  const tri = [-90, 30, 150].map((d) => [R * Math.cos((d * Math.PI) / 180), R * Math.sin((d * Math.PI) / 180)] as V);
  const shapes = [0, 1, 2, 3, 4, 5, 6].map((d) => koch(tri[0], tri[1], tri[2], d));
  const base = {per: perimeter(shapes[0]), area: area(shapes[0])};
  const layers = shapes.map((pts) => {
    const fill = new Polys({polys: [{pts, group: 0}], colors: COLORS, glow: 0, conic: {at: [0, cy]}}, {y: cy, opacity: 0});
    const line = new Polys({polys: [{pts, group: 0}], colors: COLORS, stroke: 4, glow: 14, conic: {at: [0, cy]}}, {y: cy, opacity: 0});
    s.add(fill);
    s.add(line);
    return {fill, line};
  });
  const stats = s.add(<Txt y={cy + 515} fontFamily={FONT} fontSize={54} fontWeight={700} fill="#dbe7ff" textAlign="center"
    text="" lineHeight={84} />, 'ui') as Txt;
  let current = -1;
  function* show(d: number, dur = 0.5) {
    const tasks = [layers[d].line.opacity(1, dur), layers[d].fill.opacity(0.18, dur)];
    if (current >= 0) tasks.push(layers[current].line.opacity(0, dur), layers[current].fill.opacity(0, dur));
    current = d;
    stats.text(`edge × ${(perimeter(shapes[d]) / base.per).toFixed(2)}\narea × ${(area(shapes[d]) / base.area).toFixed(3)}`);
    yield* all(...tasks);
  }

  yield* all(s.narrate('k1'), show(0, 0.6));
  yield* all(s.narrate('k2'), (function* () {
    yield* waitFor(s.duration('k2') * 0.55);
    yield* show(1);
  })());
  yield* all(s.narrate('k3'), (function* () {
    for (const d of [2, 3, 4]) {
      yield* show(d, 0.35);
      yield* waitFor(Math.max(0, s.duration('k3') / 3 - 0.35));
    }
  })());
  yield* all(s.narrate('k4'), (function* () {
    yield* show(5, 0.4);
    yield* waitFor(0.6);
    yield* show(6, 0.4);
    // keep multiplying the edge by 4/3 past what we can draw
    for (let n = 7; n <= 40; n++) {
      stats.text(`edge × ${Math.round((4 / 3) ** n).toLocaleString('en-US')}\narea × ${(1.6 - 0.6 * (4 / 9) ** n).toFixed(3)}`);
      yield* waitFor(Math.max(0.03, (s.duration('k4') - 1.8) / 34));
    }
    stats.text('edge → ∞\narea × 1.600');
  })());
  hook.text('Area → 8/5 of the triangle');
  yield* all(s.narrate('k5'), layers[6].fill.opacity(0.45, 1));
  hook.text('The Koch snowflake');
  yield* all(s.narrate('k6'), layers[6].line.rotation(30, s.duration('k6'), linear), layers[6].fill.rotation(30, s.duration('k6'), linear));
  yield* all(s.narrate('k7'), layers[6].line.rotation(60, s.duration('k7') + 1.2, easeInOutSine),
    layers[6].fill.rotation(60, s.duration('k7') + 1.2, easeInOutSine));
});
