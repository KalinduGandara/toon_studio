// Building blocks: backgrounds, effects and explainer pieces. Each takes the Stage first.
// Backgrounds add static nodes; effects and reveals are generators you yield* (or s.background()).
import {Circle, Gradient, Line, Node, Path, Rect, Txt} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {all, easeInOutSine, easeOutBack, easeOutCubic, linear, loop, waitFor} from '@revideo/core';
import {heart} from './face';
import {FONT, Stage} from './stage';

type V = [number, number];
/** An animation you can yield* (alone or inside all()) that also carries the node it created. */
export type Shown<T extends Node> = ThreadGenerator & {node: T};

function shown<T extends Node>(node: T, anim: ThreadGenerator): Shown<T> {
  return Object.assign(anim, {node});
}

// ---------- backgrounds ----------

function fill(s: Stage, top: string, bottom: string): Rect {
  return (
    <Rect width={s.w * 1.6} height={s.h * 1.6}
      fill={new Gradient({from: [0, -s.h / 2], to: [0, s.h / 2], stops: [{offset: 0, color: top}, {offset: 1, color: bottom}]})} />
  ) as Rect;
}

function floor(s: Stage, color: string, line?: string): Node {
  const g = (<Node />) as Node;
  const h = s.h * 0.8;
  g.add(<Rect y={s.ground + h / 2} width={s.w * 1.6} height={h} fill={color} />);
  if (line) g.add(<Line points={[[-s.w, s.ground], [s.w, s.ground]]} stroke={line} lineWidth={6} />);
  return g;
}

function cloud(x: number, y: number, k: number): Node {
  return (
    <Node x={x} y={y} scale={k}>
      <Circle x={-70} y={10} size={110} fill="#ffffff" />
      <Circle x={0} y={-20} size={150} fill="#ffffff" />
      <Circle x={75} y={8} size={115} fill="#ffffff" />
      <Rect y={38} width={230} height={60} radius={30} fill="#ffffff" />
    </Node>
  ) as Node;
}

/** Daytime sky with grass, sun and slowly drifting clouds. */
export function sky(s: Stage, o: {top?: string; bottom?: string; grass?: string; sun?: boolean; clouds?: number} = {}): Node {
  const g = (<Node />) as Node;
  g.add(fill(s, o.top ?? '#7cc8ff', o.bottom ?? '#dff3ff'));
  if (o.sun ?? true) g.add(<Circle x={s.w * 0.3} y={-s.h * 0.36} size={s.w * 0.2} fill="#ffe066" shadowColor="#ffd43b" shadowBlur={60} />);
  const rng = s.rng.fork();
  for (let i = 0; i < (o.clouds ?? 3); i++) {
    const c = cloud(rng.range(-s.w * 0.5, s.w * 0.5), rng.range(-s.h * 0.45, -s.h * 0.15), rng.range(0.6, 1.1));
    g.add(c);
    const speed = rng.range(8, 18);
    s.background(loop(Infinity, () => c.x(c.x() + speed, 1, linear)));
  }
  g.add(floor(s, o.grass ?? '#8fd16a'));
  s.add(g, 'bg');
  return g;
}

/** Indoor room: wall, floor, a window and a picture frame. */
export function room(s: Stage, o: {wall?: string; floor?: string; window?: boolean} = {}): Node {
  const g = (<Node />) as Node;
  g.add(fill(s, o.wall ?? '#ffe8d6', o.wall ?? '#ffd8bd'));
  if (o.window ?? true) {
    const y = s.ground - s.h * 0.32;
    g.add(<Rect x={-s.w * 0.22} y={y} width={s.w * 0.3} height={s.w * 0.34} radius={12} fill="#a5dcff" stroke="#8d6748" lineWidth={16} />);
    g.add(<Line points={[[-s.w * 0.22, y - s.w * 0.17], [-s.w * 0.22, y + s.w * 0.17]]} stroke="#8d6748" lineWidth={10} />);
    g.add(<Rect x={s.w * 0.25} y={y - 30} width={s.w * 0.16} height={s.w * 0.12} radius={6} fill="#ffc8dd" stroke="#8d6748" lineWidth={10} />);
  }
  g.add(floor(s, o.floor ?? '#c8996b', '#a47751'));
  s.add(g, 'bg');
  return g;
}

/** Night sky with a moon and twinkling stars. */
export function night(s: Stage, o: {stars?: number; ground?: string} = {}): Node {
  const g = (<Node />) as Node;
  g.add(fill(s, '#0b1026', '#2b2f6b'));
  g.add(<Circle x={-s.w * 0.28} y={-s.h * 0.34} size={s.w * 0.17} fill="#fff7d6" shadowColor="#fff3b0" shadowBlur={50} />);
  const rng = s.rng.fork();
  for (let i = 0; i < (o.stars ?? 50); i++) {
    const st = (<Circle x={rng.range(-s.w * 0.55, s.w * 0.55)} y={rng.range(-s.h * 0.5, s.ground - 40)} size={rng.range(3, 8)} fill="#ffffff" />) as Circle;
    g.add(st);
    const p = rng.range(1.2, 3);
    s.background(loop(Infinity, () => st.opacity(0.3, p, easeInOutSine).to(1, p, easeInOutSine)));
  }
  g.add(floor(s, o.ground ?? '#1b2a3a'));
  s.add(g, 'bg');
  return g;
}

/** Off-white paper with a faint grid: stick figures, explainers. */
export function paper(s: Stage, o: {color?: string; grid?: boolean; floorLine?: boolean} = {}): Node {
  const g = (<Node />) as Node;
  g.add(<Rect width={s.w * 1.6} height={s.h * 1.6} fill={o.color ?? '#fbf8f1'} />);
  if (o.grid ?? true) {
    for (let x = -s.w; x <= s.w; x += 60) g.add(<Line points={[[x, -s.h], [x, s.h]]} stroke="#e9e3d6" lineWidth={2} />);
    for (let y = -s.h; y <= s.h; y += 60) g.add(<Line points={[[-s.w, y], [s.w, y]]} stroke="#e9e3d6" lineWidth={2} />);
  }
  if (o.floorLine ?? true) g.add(<Line points={[[-s.w, s.ground + 4], [s.w, s.ground + 4]]} stroke="#1d1d24" lineWidth={8} lineCap="round" />);
  s.add(g, 'bg');
  return g;
}

/** Plain colour or two-colour gradient. */
export function plain(s: Stage, top: string, bottom = top): Node {
  return s.add(fill(s, top, bottom), 'bg');
}

// ---------- effects ----------

/** Hearts float up from `at` and fade out. */
export function* hearts(s: Stage, at: V, o: {count?: number; color?: string; spread?: number; dur?: number} = {}): ThreadGenerator {
  const rng = s.rng.fork();
  const dur = o.dur ?? 1.6;
  const tasks: ThreadGenerator[] = [];
  for (let i = 0; i < (o.count ?? 6); i++) {
    const h = (<Path x={at[0] + rng.range(-40, 40)} y={at[1]} data={heart(rng.range(16, 30))} fill={o.color ?? '#ff4d6d'} scale={0} />) as Path;
    s.add(h, 'fx');
    const dx = rng.range(-(o.spread ?? 160), o.spread ?? 160);
    const delay = i * 0.12;
    tasks.push((function* () {
      yield* waitFor(delay);
      yield* all(h.scale(1, 0.25, easeOutBack), h.y(at[1] - rng.range(180, 320), dur, easeOutCubic), h.x(h.x() + dx, dur, easeInOutSine),
        h.opacity(0, dur, (t) => Math.max(0, (t - 0.55) / 0.45)));
      h.remove();
    })());
  }
  yield* all(...tasks);
}

/** Star sparkles burst around `at`. */
export function* sparkles(s: Stage, at: V, o: {count?: number; color?: string; radius?: number} = {}): ThreadGenerator {
  const rng = s.rng.fork();
  const tasks: ThreadGenerator[] = [];
  for (let i = 0; i < (o.count ?? 8); i++) {
    const a = (i / (o.count ?? 8)) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const r = (o.radius ?? 150) * rng.range(0.7, 1.2);
    const st = (<Path x={at[0]} y={at[1]} data="M 0 -20 L 5 -5 L 20 0 L 5 5 L 0 20 L -5 5 L -20 0 L -5 -5 Z" fill={o.color ?? '#ffd43b'} scale={0} />) as Path;
    s.add(st, 'fx');
    tasks.push((function* () {
      yield* all(st.position([at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r], 0.5, easeOutCubic), st.scale(1.3, 0.25).to(0, 0.25), st.rotation(90, 0.5));
      st.remove();
    })());
  }
  yield* all(...tasks);
}

/** Pop a big emoji or word at `at` (e.g. "❤️", "?!", "💡"), hold, then fade. */
export function* pop(s: Stage, text: string, at: V, o: {size?: number; hold?: number; color?: string} = {}): ThreadGenerator {
  const t = (<Txt x={at[0]} y={at[1]} text={text} fontFamily={FONT} fontSize={o.size ?? 120} fontWeight={800} fill={o.color ?? '#1d1d24'} scale={0} />) as Txt;
  s.add(t, 'fx');
  yield* t.scale(1, 0.3, easeOutBack);
  yield* waitFor(o.hold ?? 0.8);
  yield* all(t.opacity(0, 0.25), t.y(at[1] - 40, 0.25));
  t.remove();
}

// ---------- explainer pieces ----------

/** Full-screen title card that shows for `hold` seconds, then clears. */
export function* title(s: Stage, text: string, o: {sub?: string; hold?: number; color?: string} = {}): ThreadGenerator {
  const short = s.format === 'short';
  const g = (<Node opacity={0} />) as Node;
  const main = (<Txt text={text} fontFamily={FONT} fontSize={short ? 96 : 84} fontWeight={800} fill={o.color ?? '#1d1d24'}
    width={s.w * 0.84} textWrap textAlign="center" />) as Txt;
  g.add(main);
  const bar = (<Line points={[[-s.w * 0.2, 0], [s.w * 0.2, 0]]} y={short ? 130 : 90} stroke="#ff5d7a" lineWidth={14} lineCap="round" end={0} />) as Line;
  g.add(bar);
  if (o.sub) g.add(<Txt y={short ? 220 : 160} text={o.sub} fontFamily={FONT} fontSize={short ? 52 : 42} fill="#555" width={s.w * 0.8} textWrap textAlign="center" />);
  s.add(g, 'ui');
  yield* all(g.opacity(1, 0.3), bar.end(1, 0.5, easeOutCubic));
  yield* waitFor(o.hold ?? 1.5);
  yield* g.opacity(0, 0.3);
  g.remove();
}

/** Persistent heading at the top of the frame. Returns the text node (change or remove it later). */
export function heading(s: Stage, text: string, o: {color?: string} = {}): Txt {
  const short = s.format === 'short';
  const t = (<Txt y={-s.h * (short ? 0.38 : 0.4)} text={text} fontFamily={FONT} fontSize={short ? 80 : 64} fontWeight={800}
    fill={o.color ?? '#1d1d24'} width={s.w * 0.9} textWrap textAlign="center" />) as Txt;
  return s.add(t, 'ui');
}

export interface Bullets {
  node: Node;
  reveal(i: number): ThreadGenerator;
}

/** A list whose items appear one at a time with reveal(i). Position is the list's top-left. */
export function bullets(s: Stage, items: string[], o: {x?: number; y?: number; width?: number; size?: number; color?: string} = {}): Bullets {
  const size = o.size ?? (s.format === 'short' ? 58 : 46);
  const g = (<Node x={o.x ?? -s.w * 0.38} y={o.y ?? -s.h * 0.25} />) as Node;
  const rows = items.map((text, i) => {
    const row = (
      <Node y={i * size * 1.9} opacity={0} x={-30}>
        <Circle x={size * 0.3} y={0} size={size * 0.45} fill={o.color ?? '#ff5d7a'} />
        <Txt x={size * 0.85} offset={[-1, 0]} text={text} fontFamily={FONT} fontSize={size} fontWeight={700} fill="#1d1d24"
          width={o.width ?? s.w * 0.7} textWrap />
      </Node>
    ) as Node;
    g.add(row);
    return row;
  });
  s.add(g, 'ui');
  return {
    node: g,
    *reveal(i: number) {
      yield* all(rows[i].opacity(1, 0.3), rows[i].x(0, 0.3, easeOutCubic));
    },
  };
}

/** A rounded label chip that pops in at `at`. `.node` is the chip. */
export function label(s: Stage, text: string, at: V, o: {color?: string; textColor?: string; size?: number} = {}): Shown<Rect> {
  const n = (
    <Rect layout x={at[0]} y={at[1]} padding={[16, 30]} radius={999} fill={o.color ?? '#ffd43b'} stroke="#1d1d24" lineWidth={5} scale={0}>
      <Txt text={text} fontFamily={FONT} fontSize={o.size ?? 44} fontWeight={800} fill={o.textColor ?? '#1d1d24'} />
    </Rect>
  ) as Rect;
  s.add(n, 'fx');
  return shown(n, n.scale(1, 0.3, easeOutBack));
}

/** An arrow that draws itself from `from` to `to`. `.node` is the line. */
export function arrow(s: Stage, from: V, to: V, o: {color?: string; width?: number; dur?: number} = {}): Shown<Line> {
  const l = (<Line points={[from, to]} stroke={o.color ?? '#1d1d24'} lineWidth={o.width ?? 10} lineCap="round" endArrow arrowSize={28} end={0} />) as Line;
  s.add(l, 'fx');
  return shown(l, l.end(1, o.dur ?? 0.5, easeOutCubic));
}

/** A card (rounded panel) that pops in. Add children to `.node`. */
export function card(s: Stage, o: {x?: number; y?: number; width: number; height: number; fill?: string}): Shown<Rect> {
  const r = (<Rect x={o.x ?? 0} y={o.y ?? 0} width={o.width} height={o.height} radius={36} fill={o.fill ?? '#ffffff'} stroke="#1d1d24"
    lineWidth={6} shadowColor="#00000033" shadowBlur={30} shadowOffset={[0, 12]} scale={0} />) as Rect;
  s.add(r, 'ui');
  return shown(r, r.scale(1, 0.35, easeOutBack));
}

/** Count a number up from `from` to `to` at `at`. `.node` is the text. */
export function counter(s: Stage, from: number, to: number, at: V, o: {dur?: number; prefix?: string; suffix?: string; size?: number; color?: string} = {}): Shown<Txt> {
  const t = (<Txt x={at[0]} y={at[1]} fontFamily={FONT} fontSize={o.size ?? 140} fontWeight={800} fill={o.color ?? '#1d1d24'} />) as Txt;
  const fmt = (v: number) => `${o.prefix ?? ''}${Math.round(v).toLocaleString('en-US')}${o.suffix ?? ''}`;
  t.text(fmt(from));
  s.add(t, 'ui');
  return shown(t, (function* () {
    const dur = o.dur ?? 1.2;
    const steps = Math.max(1, Math.round(dur * 30));
    for (let i = 1; i <= steps; i++) {
      t.text(fmt(from + ((to - from) * easeOutCubic(i / steps))));
      yield* waitFor(dur / steps);
    }
  })());
}
