// Character: a code-drawn puppet (front view) with a joint rig, a face with emotions, blinking,
// breathing and lip sync. Every action is a generator, so actions compose with Revideo's
// all() / chain() / sequence():   yield* all(mia.walkTo(200), leo.wave());
import {Circle, Line, Node, Path, Rect} from '@revideo/2d';
import type {SimpleSignal, ThreadGenerator} from '@revideo/core';
import {
  all, createSignal, easeInOutCubic, easeInOutSine, easeInQuad, easeOutBack, easeOutQuad, loop, tween, waitFor,
} from '@revideo/core';
import {expression, eyePath, mouthPath} from './face';
import {JOINT_NAMES, Joints, limb, resolvePose, walkOffsets} from './rig';
import type {Rng} from './rng';
import {Layout, layout, Style} from './styles';

export interface SayOptions {
  /** Show the line in a speech bubble above the head (default false). */
  bubble?: boolean;
  /** Show the line as on-screen captions (default: the stage's `captions` setting). */
  captions?: boolean;
  /** Emotion while talking; restored afterwards. */
  emotion?: string;
}

/** What a character needs from the stage (implemented by Stage). */
export interface Host {
  rng: Rng;
  background(task: ThreadGenerator): void;
  speak(c: Character, id: string, opts: SayOptions): ThreadGenerator;
}

export interface CharacterOptions {
  name?: string;
  x?: number;
  y?: number;
  scale?: number;
  emotion?: string;
  pose?: string;
}

type V = [number, number];

export class Character {
  readonly root: Node;
  readonly name: string;
  readonly style: Style;
  readonly layout: Layout;
  readonly emotion: SimpleSignal<string>;
  readonly blink = createSignal(0);
  readonly mouthOpen = createSignal(0);
  readonly lookX = createSignal(0); // -1 .. 1
  readonly lookY = createSignal(0);
  readonly bodyY = createSignal(0); // jump / bob offset
  readonly squash = createSignal(1); // y scale of the body; x keeps the volume
  readonly breath = createSignal(1);
  readonly lean = createSignal(0); // degrees
  readonly headTilt = createSignal(0);
  readonly headDY = createSignal(0);
  private readonly joints: Record<keyof Joints, SimpleSignal<number>>;
  private readonly host: Host;

  constructor(host: Host, style: Style, o: CharacterOptions = {}) {
    this.host = host;
    this.style = style;
    this.layout = layout(style);
    this.name = o.name ?? style.kind;
    this.emotion = createSignal(o.emotion ?? 'neutral');
    expression(this.emotion());
    const start = resolvePose(o.pose ?? 'stand');
    this.joints = Object.fromEntries(JOINT_NAMES.map((k) => [k, createSignal(start[k])])) as Record<keyof Joints, SimpleSignal<number>>;
    this.root = this.build(o);
    host.background(this.idle());
  }

  // ---------- building ----------

  private build(o: CharacterOptions): Node {
    const body = (
      <Node
        y={() => this.bodyY()}
        rotation={() => this.lean()}
        scaleY={() => this.squash() * this.breath()}
        scaleX={() => 1 / Math.sqrt(this.squash())}
      />
    ) as Node;
    for (const side of [-1, 1] as const) body.add(this.limbNodes(() => this.legPoints(side), 'leg'));
    body.add(this.torso());
    for (const side of [-1, 1] as const) body.add(this.limbNodes(() => this.armPoints(side), 'arm'));
    body.add(this.head());
    return (
      <Node x={o.x ?? 0} y={o.y ?? 0} scale={o.scale ?? 1}>
        {body}
      </Node>
    ) as Node;
  }

  private armPoints(side: -1 | 1): V[] {
    const s = this.style;
    const L = this.layout;
    const j = this.joints;
    const [a, b] = side < 0 ? [j.la(), j.le()] : [j.ra(), j.re()];
    return limb([side * L.shoulderX, L.shoulderY], side, a, b, s.armUpper, s.armLower);
  }

  private legPoints(side: -1 | 1): V[] {
    const s = this.style;
    const L = this.layout;
    const j = this.joints;
    const [a, b] = side < 0 ? [j.ll(), j.lk()] : [j.rl(), j.rk()];
    return limb([side * L.hipX, L.hipY], side, a, b, s.legUpper, s.legLower);
  }

  private limbNodes(points: () => V[], kind: 'arm' | 'leg'): Node {
    const s = this.style;
    const g = (<Node />) as Node;
    if (s.outlineWidth > 0) {
      g.add(<Line points={points} stroke={s.outline} lineWidth={s.limbWidth + 2 * s.outlineWidth} lineCap="round" lineJoin="round" />);
    }
    g.add(<Line points={points} stroke={kind === 'leg' ? s.legs : s.limb} lineWidth={s.limbWidth} lineCap="round" lineJoin="round" />);
    if (kind === 'arm' && s.kind === 'person') {
      // sleeves: shirt colour on the upper arm
      g.add(<Line points={() => points().slice(0, 2)} stroke={s.body} lineWidth={s.limbWidth + 2} lineCap="round" />);
    }
    return g;
  }

  private torso(): Node {
    const s = this.style;
    const L = this.layout;
    if (s.kind === 'stick') {
      return (<Line points={[[0, L.hipY], [0, L.headY + s.headR]]} stroke={s.body} lineWidth={s.limbWidth} lineCap="round" />) as Node;
    }
    if (s.kind === 'bean') {
      const top = L.hipY - s.torsoH * 0.8;
      return (
        <Rect y={top + s.torsoH / 2} width={s.torsoW} height={s.torsoH} radius={s.torsoW / 2} fill={s.body}
          stroke={s.outline} lineWidth={s.outlineWidth} />
      ) as Node;
    }
    const top = L.hipY - 10 - s.torsoH;
    const g = (<Node />) as Node;
    g.add(<Rect y={top + s.torsoH / 2 + 6} width={s.torsoW} height={s.torsoH + 12} radius={[48, 48, 18, 18]}
      fill={s.body} stroke={s.outline} lineWidth={s.outlineWidth} />);
    if (s.accessory === 'tie') {
      g.add(<Path y={top + 4} data="M -14 0 L 14 0 L 8 18 L 18 110 L 0 132 L -18 110 L -8 18 Z" fill={s.accessoryColor}
        stroke={s.outline} lineWidth={4} lineJoin="round" />);
    }
    return g;
  }

  private head(): Node {
    const s = this.style;
    const L = this.layout;
    const R = s.headR;
    const head = (<Node y={() => L.headY + this.headDY()} rotation={() => this.headTilt()} />) as Node;
    const ow = s.outlineWidth || 8;

    // behind the head: ears, long hair, bun
    if (s.ears === 'bear') {
      for (const side of [-1, 1]) {
        head.add(<Circle x={side * R * 0.72} y={-R * 0.7} size={R * 0.7} fill={s.skin} stroke={s.outline} lineWidth={ow} />);
        head.add(<Circle x={side * R * 0.72} y={-R * 0.7} size={R * 0.36} fill={s.earInner} />);
      }
    } else if (s.ears === 'bunny') {
      for (const side of [-1, 1]) {
        head.add(<Rect x={side * R * 0.38} y={-R * 1.25} width={R * 0.42} height={R * 1.2} radius={R * 0.21}
          rotation={side * 10} fill={s.skin} stroke={s.outline} lineWidth={ow} />);
        head.add(<Rect x={side * R * 0.38} y={-R * 1.22} width={R * 0.2} height={R * 0.85} radius={R * 0.1}
          rotation={side * 10} fill={s.earInner} />);
      }
    } else if (s.ears === 'cat') {
      for (const side of [-1, 1]) {
        head.add(<Path data={`M ${side * R * 0.95} ${-R * 0.25} L ${side * R * 0.8} ${-R * 1.15} L ${side * R * 0.2} ${-R * 0.85} Z`}
          fill={s.skin} stroke={s.outline} lineWidth={ow} lineJoin="round" />);
      }
    }
    if (s.hair === 'long') {
      head.add(<Rect y={R * 0.25} width={R * 2.25} height={R * 2.3} radius={[R, R, R * 0.35, R * 0.35]} fill={s.hairColor}
        stroke={s.outline} lineWidth={s.outlineWidth} />);
    }
    if (s.hair === 'bun') head.add(<Circle y={-R * 1.05} size={R * 0.8} fill={s.hairColor} stroke={s.outline} lineWidth={s.outlineWidth} />);

    head.add(<Circle size={R * 2} fill={s.skin} stroke={s.outline} lineWidth={s.kind === 'stick' ? s.limbWidth : s.outlineWidth} />);

    // hair on top of the head
    if (s.hair === 'short' || s.hair === 'long' || s.hair === 'bun') {
      head.add(<Path data={`M ${-R * 1.02} ${R * 0.05} C ${-R * 1.1} ${-R * 1.25} ${R * 1.1} ${-R * 1.25} ${R * 1.02} ${R * 0.05}
        C ${R * 0.7} ${-R * 0.45} ${-R * 0.1} ${-R * 0.55} ${-R * 1.02} ${R * 0.05} Z`} fill={s.hairColor} stroke={s.outline}
        lineWidth={s.outlineWidth} lineJoin="round" />);
    } else if (s.hair === 'tuft') {
      head.add(<Path data={`M ${-R * 0.15} ${-R * 0.98} C ${-R * 0.1} ${-R * 1.35} ${R * 0.35} ${-R * 1.35} ${R * 0.25} ${-R * 1.1}`}
        stroke={s.outline} lineWidth={ow} lineCap="round" />);
    } else if (s.hair === 'spiky') {
      head.add(<Path data={`M ${-R} ${-R * 0.2} L ${-R * 0.8} ${-R * 1.15} L ${-R * 0.4} ${-R * 0.85} L ${-R * 0.1} ${-R * 1.3}
        L ${R * 0.25} ${-R * 0.9} L ${R * 0.65} ${-R * 1.2} L ${R} ${-R * 0.2} C ${R * 0.4} ${-R * 0.6} ${-R * 0.4} ${-R * 0.6} ${-R} ${-R * 0.2} Z`}
        fill={s.hairColor} stroke={s.outline} lineWidth={s.outlineWidth} lineJoin="round" />);
    }

    head.add(this.face());

    if (s.accessory === 'bow') {
      const bx = R * 0.62;
      const by = -R * 0.78;
      head.add(<Path x={bx} y={by} rotation={20} data="M 0 0 L -42 -26 L -42 26 Z M 0 0 L 42 -26 L 42 26 Z" fill={s.accessoryColor}
        stroke={s.outline} lineWidth={5} lineJoin="round" />);
      head.add(<Circle x={bx} y={by} size={22} fill={s.accessoryColor} stroke={s.outline} lineWidth={5} />);
    } else if (s.accessory === 'scarf') {
      head.add(<Rect y={R * 0.98} width={R * 1.5} height={R * 0.32} radius={R * 0.16} fill={s.accessoryColor} stroke={s.outline} lineWidth={5} />);
    }
    return head;
  }

  private face(): Node {
    const s = this.style;
    const R = s.headR;
    const bean = s.kind === 'bean';
    const er = R * (bean ? 0.11 : 0.1);
    const eyeX = R * (bean ? 0.36 : 0.34);
    const eyeY = R * (bean ? 0.08 : -0.05);
    const mouthW = R * (bean ? 0.16 : 0.24);
    const mouthY = R * (bean ? 0.34 : 0.42);
    const face = (<Node x={() => this.lookX() * R * 0.16} y={() => this.lookY() * R * 0.1} />) as Node;
    const x = () => expression(this.emotion());

    for (const side of [-1, 1]) {
      face.add(<Circle x={side * R * 0.6} y={R * 0.3} size={[R * 0.3, R * 0.18]} fill={s.blush} opacity={() => x().blush * 0.75} />);
      const eye = () => eyePath(this.emotion(), this.blink(), er);
      face.add(<Path x={side * eyeX} y={eyeY} data={() => eye().d} fill={() => (eye().filled ? s.eye : null)} stroke={s.eye}
        lineWidth={() => (eye().filled ? er * 0.2 : er * 0.5)} lineCap="round" lineJoin="round" />);
      if (s.shine) {
        face.add(<Circle x={side * eyeX + er * 0.3} y={eyeY - er * 0.4} size={er * 0.55} fill="#ffffff"
          opacity={() => (['dot', 'big'].includes(x().eye) && this.blink() < 0.3 ? 1 : 0)} />);
      }
      face.add(<Path x={side * eyeX} y={eyeY + er * 1.6} data={`M 0 0 C ${-er * 0.5} ${er * 0.8} ${er * 0.5} ${er * 0.8} 0 0 Z`}
        scale={1.6} fill="#6ec6ff" opacity={() => (x().tears ? 1 : 0)} />);
      if (s.brows) {
        face.add(<Line x={side * eyeX} y={() => eyeY - er * 2.2 - x().browLift * er} rotation={() => side * x().brow}
          points={[[-er * 1.1, 0], [er * 1.1, 0]]} stroke={s.eye} lineWidth={er * 0.45} lineCap="round" />);
      }
    }
    const mouth = () => mouthPath(this.emotion(), this.mouthOpen(), mouthW);
    face.add(<Path y={mouthY} data={() => mouth().d} fill={() => (mouth().filled ? s.mouth : null)} stroke={s.outline}
      lineWidth={mouthW * (bean ? 0.26 : 0.16)} lineCap="round" lineJoin="round" />);
    if (s.accessory === 'glasses') {
      for (const side of [-1, 1]) {
        face.add(<Circle x={side * eyeX} y={eyeY} size={er * 4.2} stroke={s.outline} lineWidth={5} />);
      }
      face.add(<Line points={[[-eyeX + er * 2.1, eyeY], [eyeX - er * 2.1, eyeY]]} stroke={s.outline} lineWidth={5} />);
    }
    return face;
  }

  // ---------- idle ----------

  private *idle(): ThreadGenerator {
    const rng = this.host.rng.fork();
    const breathe = loop(Infinity, () => all(
      this.breath(1.012, 1.6, easeInOutSine).to(1, 1.6, easeInOutSine),
    ));
    const blink = loop(Infinity, function* (this: Character) {
      yield* waitFor(rng.range(1.8, 4.5));
      yield* this.blinkOnce();
    }.bind(this));
    yield* all(breathe, blink);
  }

  // ---------- state ----------

  get x(): number {
    return this.root.x();
  }

  /** Top of the head in stage coordinates (for bubbles and effects). */
  headTop(): V {
    return [this.root.x(), this.root.y() + this.layout.top * this.root.scale().y];
  }

  /** Centre of the face in stage coordinates. */
  faceAt(): V {
    return [this.root.x(), this.root.y() + this.layout.headY * this.root.scale().y];
  }

  /** Set the emotion immediately ("happy", "sad", "love", ...; see face.ts). */
  emote(e: string): void {
    expression(e);
    this.emotion(e);
  }

  setPose(p: string | Partial<Joints>): void {
    const t = resolvePose(p);
    for (const k of JOINT_NAMES) this.joints[k](t[k]);
  }

  private snapshot(): Joints {
    return Object.fromEntries(JOINT_NAMES.map((k) => [k, this.joints[k]()])) as unknown as Joints;
  }

  // ---------- actions (generators) ----------

  *pose(p: string | Partial<Joints>, dur = 0.35): ThreadGenerator {
    const t = resolvePose(p);
    yield* all(...JOINT_NAMES.map((k) => this.joints[k](t[k], dur, easeInOutCubic)));
  }

  /** Emotion change with a small squash "pop". */
  *react(e: string, dur = 0.25): ThreadGenerator {
    this.emote(e);
    yield* this.squash(1.08, dur * 0.4, easeOutQuad).to(1, dur * 0.6, easeOutBack);
  }

  *blinkOnce(): ThreadGenerator {
    yield* this.blink(1, 0.06).to(0, 0.09);
  }

  *say(id: string, opts: SayOptions = {}): ThreadGenerator {
    yield* this.host.speak(this, id, opts);
  }

  *wave(times = 2, side: 'right' | 'left' = 'right'): ThreadGenerator {
    const before = this.snapshot();
    const elbow = side === 'right' ? this.joints.re : this.joints.le;
    yield* this.pose(side === 'right' ? 'waveRight' : 'waveLeft', 0.25);
    for (let i = 0; i < times; i++) yield* elbow(-25, 0.17, easeInOutSine).to(30, 0.17, easeInOutSine);
    yield* this.pose(before, 0.25);
  }

  *walkTo(x: number, opts: {speed?: number; duration?: number} = {}): ThreadGenerator {
    const from = this.root.x();
    const dist = Math.abs(x - from);
    if (dist < 1) return;
    const dur = opts.duration ?? dist / (opts.speed ?? 300);
    const steps = Math.max(2, Math.round(dist / (75 * this.root.scale().x)));
    this.lookX(Math.sign(x - from) * 0.8);
    const start = this.snapshot();
    yield* all(
      this.root.x(x, dur, easeInOutSine),
      tween(dur, (v) => {
        const phase = v * steps * Math.PI;
        const w = walkOffsets(phase);
        for (const k of Object.keys(w) as (keyof Joints)[]) this.joints[k](w[k]);
        this.bodyY(-Math.abs(Math.sin(phase)) * 10);
      }),
    );
    this.bodyY(0);
    yield* all(this.pose({...start, ll: 5, lk: 0, rl: 5, rk: 0}, 0.15), this.lookX(0, 0.3));
  }

  /** Slide without walking (e.g. floating, being pushed). */
  *moveTo(x: number, y?: number, dur = 0.6): ThreadGenerator {
    yield* all(this.root.x(x, dur, easeInOutCubic), this.root.y(y ?? this.root.y(), dur, easeInOutCubic));
  }

  *jump(height = 120): ThreadGenerator {
    yield* this.squash(0.85, 0.1);
    yield* all(this.bodyY(-height, 0.3, easeOutQuad), this.squash(1.1, 0.15).to(1, 0.15));
    yield* this.bodyY(0, 0.26, easeInQuad);
    yield* this.squash(0.86, 0.07).to(1, 0.14, easeOutBack);
  }

  *nod(times = 2): ThreadGenerator {
    for (let i = 0; i < times; i++) yield* this.headDY(10, 0.12).to(0, 0.14);
  }

  *shakeHead(times = 2): ThreadGenerator {
    for (let i = 0; i < times; i++) yield* this.headTilt(-9, 0.1).to(9, 0.16).to(0, 0.1);
  }

  *tilt(deg: number, dur = 0.3): ThreadGenerator {
    yield* this.headTilt(deg, dur, easeInOutSine);
  }

  /** Look toward another character, a stage x, or back to the camera ("camera"). */
  *lookAt(target: Character | number | 'camera', dur = 0.2): ThreadGenerator {
    if (target === 'camera') {
      yield* all(this.lookX(0, dur), this.lookY(0, dur));
      return;
    }
    const tx = typeof target === 'number' ? target : target.x;
    yield* this.lookX(Math.sign(tx - this.x) * 0.9, dur);
  }

  *grow(scale: number, dur = 0.4): ThreadGenerator {
    yield* this.root.scale(scale, dur, easeOutBack);
  }

  /** Pop in from nothing. */
  *appear(dur = 0.4): ThreadGenerator {
    const target = this.root.scale().x || 1;
    this.root.scale(0);
    yield* this.root.scale(target, dur, easeOutBack);
  }

  *disappear(dur = 0.3): ThreadGenerator {
    yield* this.root.scale(0, dur, easeInQuad);
  }
}

