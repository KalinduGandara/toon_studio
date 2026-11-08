// The chaos game: random half-way jumps draw the Sierpinski triangle, then a seamless infinite zoom.
import {Circle, Line, Node, Txt} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {createSignal, easeInCubic, easeInOutCubic, easeOutBack, linear, tween} from '@revideo/core';
import {all, chaosGame, FONT, plain, PointCloud, Polys, sierpinski, toonProject, V, waitFor} from '../../src';

const COLORS = ['#ff4d8d', '#2de2e6', '#ffd166'];

export default toonProject(function* (s) {
  plain(s, '#04040b', '#12122e');
  const L = 940;
  const H = (L * Math.sqrt(3)) / 2;
  const cy = -150;
  const corners: V[] = [[0, cy - (2 * H) / 3], [-L / 2, cy + H / 3], [L / 2, cy + H / 3]];
  const [, B] = corners;

  const hook = s.add(<Txt y={-s.h * 0.41} text="3 dots + 1 rule = ?" fontFamily={FONT} fontSize={84} fontWeight={800}
    fill="#ffffff" />, 'ui') as Txt;

  // ----- the chaos game -----
  const game = chaosGame(corners, 22000, s.rng.fork(), [-140, cy + 90]);
  const cloud = s.add(new PointCloud({xs: game.xs, ys: game.ys, group: game.pick, colors: COLORS, size: 2.6, glow: 6}));
  const counter = s.add(<Txt y={cy + H / 3 + 120} fontFamily={FONT} fontSize={56} fontWeight={700} fill="#c9c9ff" opacity={0}
    text="0 jumps" />, 'ui') as Txt;
  s.background((function* (): ThreadGenerator {
    for (;;) {
      counter.text(`${Math.floor(cloud.count()).toLocaleString('en-US')} jumps`);
      yield;
    }
  })());
  const dots = corners.map((c, i) => s.add(<Circle x={c[0]} y={c[1]} size={40} fill={COLORS[i]} shadowColor={COLORS[i]}
    shadowBlur={40} scale={0} />) as Circle);

  yield* all(
    s.narrate('n1'),
    (function* () {
      for (const d of dots) yield* d.scale(1, 0.35, easeOutBack);
    })(),
  );

  // slow jumps: pen, guide line to the chosen corner, a mark where it lands
  const start: V = [-140, cy + 90];
  const pen = s.add(<Circle x={start[0]} y={start[1]} size={26} fill="#ffffff" shadowColor="#ffffff" shadowBlur={30} scale={0} />) as Circle;
  const guide = s.add(<Line points={[start, start]} stroke="#ffffff" lineWidth={5} lineDash={[14, 12]} opacity={0.8} end={0} />) as Line;
  const marks: Circle[] = [];
  function* jump(i: number, speed: number) {
    const from: V = i === 0 ? start : [game.xs[i - 1], game.ys[i - 1]];
    const k = game.pick[i];
    guide.points([from, corners[k]]);
    guide.stroke(COLORS[k]);
    guide.end(0);
    yield* all(guide.end(1, 0.3 * speed), dots[k].scale(1.5, 0.15 * speed).to(1, 0.15 * speed));
    yield* pen.position([game.xs[i], game.ys[i]], 0.35 * speed, easeInOutCubic);
    const m = s.add(<Circle x={game.xs[i]} y={game.ys[i]} size={18} fill={COLORS[k]} shadowColor={COLORS[k]} shadowBlur={20} scale={0} />) as Circle;
    marks.push(m);
    yield* all(m.scale(1, 0.15, easeOutBack), guide.end(0, 0.2 * speed));
    cloud.count(i + 1);
  }
  yield* all(
    s.narrate('n2'),
    (function* () {
      yield* pen.scale(1, 0.3, easeOutBack);
      yield* waitFor(s.duration('n2') * 0.35);
      yield* jump(0, 1.4);
      yield* jump(1, 1.1);
    })(),
  );
  yield* all(s.narrate('n3'), (function* () {
    for (let i = 2; i < 7; i++) yield* jump(i, 0.55);
  })());
  yield* all(counter.opacity(1, 0.3), pen.scale(0, 0.3), ...marks.map((m) => m.scale(0.5, 0.6)));

  // speed up: noise first, then the pattern
  yield* all(s.narrate('n4'), cloud.count(100, s.duration('n4'), linear));
  yield* all(s.narrate('n5'), cloud.count(22000, s.duration('n5') + 1.2, easeInCubic), ...marks.map((m) => m.opacity(0, 1)));
  yield* waitFor(0.6);

  // ----- the structure: each triangle is three copies of itself -----
  const levels = [1, 2, 3, 4, 5].map((d) => s.add(new Polys({
    polys: sierpinski(corners[0], corners[1], corners[2], d).map((t) => ({pts: t.pts, group: t.digit})),
    colors: COLORS, stroke: 4, glow: 14,
  }, {opacity: 0})));
  hook.text('The Sierpinski triangle');
  yield* all(
    s.narrate('n6'),
    cloud.opacity(0.18, 1),
    ...dots.map((d) => d.scale(0, 0.4)),
    (function* () {
      const step = s.duration('n6') / levels.length;
      for (let i = 0; i < levels.length; i++) {
        yield* all(levels[i].opacity(1, 0.3), i ? levels[i - 1].opacity(0, 0.3) : waitFor(0.3));
        yield* waitFor(step - 0.3);
      }
    })(),
  );

  // ----- infinite zoom: scale x2 about the bottom-left corner, clipped to the triangle -----
  // Depth-7 outlines stay on; depth-8 outlines fade in as the zoom goes 1 -> 2. At x2 the pair
  // looks exactly like depth 7 at x1 (edges of depth 8 contain those of depth 7), so each loop
  // reset is invisible. The conic colours are fixed on screen, so they don't jump either.
  const zoom = createSignal(1);
  const clip = () => corners.map(([x, y]) => [(x - B[0] * (1 - zoom())) / zoom(), (y - B[1] * (1 - zoom())) / zoom()] as V);
  const holder = s.add(<Node opacity={0} scale={() => zoom()} position={() => [B[0] * (1 - zoom()), B[1] * (1 - zoom())]} />) as Node;
  const wire = (depth: number, props = {}) => new Polys({
    polys: sierpinski(corners[0], corners[1], corners[2], depth).map((t) => ({pts: t.pts, group: 0})),
    colors: [COLORS[0], COLORS[2], COLORS[1]], stroke: 2.2, glow: 6, conic: {at: [0, cy]}, clip,
  }, props);
  holder.add(wire(7));
  holder.add(wire(8, {opacity: () => zoom() - 1}));
  yield* all(holder.opacity(1, 0.8), levels[levels.length - 1].opacity(0, 0.8), cloud.opacity(0, 0.8), counter.opacity(0, 0.5));
  function* loops(n: number, each: number) {
    for (let i = 0; i < n; i++) {
      yield* tween(each, (v) => zoom(2 ** v), linear);
      zoom(1);
    }
  }
  hook.text('It never ends');
  yield* all(s.narrate('n7'), loops(2, 2.4));
  yield* all(s.narrate('n8'), loops(2, 2.4));
  yield* s.fadeOut(0.6);
});
