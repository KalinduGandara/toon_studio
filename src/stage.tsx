// Stage: the frame a video is built on. Layers (background, world, fx, ui), a camera, the voice
// manifest, captions, speech and fades. One Stage per video; see project.tsx.
import {Audio, Node, Path, Rect, Txt, View2D} from '@revideo/2d';
import type {Thread, ThreadGenerator} from '@revideo/core';
import {all, easeInOutCubic, easeOutBack, tween, useScene, useThread, waitFor} from '@revideo/core';
import {Character, CharacterOptions, Host, SayOptions} from './character';
import {Rng} from './rng';
import {captionChunks} from './text';
import type {Style} from './styles';

export interface VoiceLine {
  who: string;
  text: string;
  /** On-screen caption when it differs from the spoken text ("π ≈ 3.14" vs "pi is about three point one four"). */
  caption?: string;
  file: string;
  duration: number;
  mouth: string;
}

export interface VoiceManifest {
  provider: string;
  mouthFps: number;
  lines: Record<string, VoiceLine>;
}

export const FONT = '"Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';

export class Stage implements Host {
  readonly view: View2D;
  readonly w: number;
  readonly h: number;
  readonly format: 'short' | 'long';
  readonly rng: Rng;
  readonly voice: VoiceManifest;
  /** Camera group: background + world + fx move and zoom together. */
  readonly camera: Node;
  readonly bg: Node;
  readonly world: Node;
  readonly fx: Node;
  /** Screen-space layer (captions, titles, fades) unaffected by the camera. */
  readonly ui: Node;
  /** y of the floor line where characters stand. */
  readonly ground: number;
  /** Default character scale for this format. */
  readonly unit: number;
  /** Captions for spoken lines (default on: most viewers watch muted at first). */
  captions = true;
  private readonly thread: Thread;
  /** Caption text node (brands restyle it: font, colours). */
  readonly caption: Txt;
  private readonly curtain: Rect;

  constructor(view: View2D) {
    const scene = useScene();
    this.view = view;
    this.thread = useThread();
    const size = scene.getSize();
    this.w = size.x;
    this.h = size.y;
    this.format = scene.variables.get('format', this.h > this.w ? 'short' : 'long')() as 'short' | 'long';
    this.rng = new Rng(Number(scene.variables.get('seed', 1)()));
    this.voice = scene.variables.get<VoiceManifest>('voice', {provider: 'none', mouthFps: 30, lines: {}})();
    const short = this.format === 'short';
    this.ground = short ? this.h * 0.2 : this.h * 0.3;
    this.unit = short ? 1.45 : 0.85;

    this.camera = (<Node />) as Node;
    this.bg = (<Node />) as Node;
    this.world = (<Node />) as Node;
    this.fx = (<Node />) as Node;
    this.ui = (<Node />) as Node;
    this.camera.add([this.bg, this.world, this.fx]);
    this.caption = (
      <Txt y={short ? this.h * 0.3 : this.h * 0.42} width={this.w * 0.86} textAlign="center" textWrap fontFamily={FONT}
        fontSize={short ? 74 : 54} fontWeight={800} letterSpacing={short ? 3 : 2} fill="#ffffff" stroke="#14141c" lineWidth={short ? 11 : 8}
        lineJoin="round" strokeFirst text="" opacity={0} />
    ) as Txt;
    this.curtain = (<Rect width={this.w + 4} height={this.h + 4} fill="#000000" opacity={0} />) as Rect;
    this.ui.add([this.caption, this.curtain]);
    view.add([this.camera, this.ui]);
  }

  // ---------- building ----------

  /** Add a node to the world (moves with the camera). */
  add<T extends Node>(node: T, layer: 'world' | 'bg' | 'fx' | 'ui' = 'world'): T {
    this[layer].add(node);
    return node;
  }

  /** Create a character standing on the ground at `x`. */
  character(style: Style, o: CharacterOptions = {}): Character {
    const c = new Character(this, style, {y: this.ground, scale: this.unit, ...o});
    this.world.add(c.root);
    return c;
  }

  /** Run a task for the rest of the video (idle loops, drifting clouds). */
  background(task: ThreadGenerator): void {
    this.thread.spawn(task);
  }

  // ---------- voice ----------

  line(id: string): VoiceLine {
    const l = this.voice.lines[id];
    if (!l) {
      const known = Object.keys(this.voice.lines);
      throw new Error(`voice line "${id}" not found (run "toon voice"; known: ${known.join(', ') || 'none'})`);
    }
    return l;
  }

  /** A character speaks line `id`: audio, lip sync, optional bubble and captions. */
  *speak(c: Character, id: string, opts: SayOptions = {}): ThreadGenerator {
    const l = this.line(id);
    const before = c.emotion();
    if (opts.emotion) c.emote(opts.emotion);
    const tasks: ThreadGenerator[] = [this.play(l), this.lipSync(c, l)];
    // a bubble already shows the words, so captions default off when there is one
    if (opts.captions ?? (this.captions && !opts.bubble)) tasks.push(this.showCaption(l.caption ?? l.text, l.duration));
    if (opts.bubble) tasks.push(this.bubble(c, l.text, l.duration));
    yield* all(...tasks);
    if (opts.emotion) c.emote(before);
  }

  /** Voice-over line with no character on screen (narrator). */
  *narrate(id: string, opts: {captions?: boolean} = {}): ThreadGenerator {
    const l = this.line(id);
    const tasks = [this.play(l)];
    if (opts.captions ?? this.captions) tasks.push(this.showCaption(l.caption ?? l.text, l.duration));
    yield* all(...tasks);
  }

  /** Duration of a voice line, e.g. to time an animation to it. */
  duration(id: string): number {
    return this.line(id).duration;
  }

  private *play(l: VoiceLine): ThreadGenerator {
    this.sound(l.file);
    yield* waitFor(l.duration);
  }

  /** Start an audio file at the current time (path relative to the voice folder, or a /public path). */
  sound(src: string, volume = 1): void {
    this.ui.add(<Audio src={'/' + src.replace(/^\//, '')} play volume={volume} />);
  }

  private *lipSync(c: Character, l: VoiceLine): ThreadGenerator {
    const fps = this.voice.mouthFps;
    yield* tween(l.duration, (v) => {
      const i = Math.min(l.mouth.length - 1, Math.floor(v * l.duration * fps));
      c.mouthOpen(+l.mouth[i] || 0);
    });
    c.mouthOpen(0);
  }

  /** Captions in short chunks, timed by character count. */
  *showCaption(text: string, duration: number): ThreadGenerator {
    const chunks = captionChunks(text, this.format === 'short' ? 4 : 7);
    const total = chunks.reduce((n, ch) => n + ch.length, 0);
    for (const ch of chunks) {
      this.caption.text(ch);
      this.caption.opacity(1);
      this.caption.scale(0.92);
      yield* all(this.caption.scale(1, 0.12, easeOutBack), waitFor((duration * ch.length) / total));
    }
    this.caption.opacity(0);
  }

  private *bubble(c: Character, text: string, duration: number): ThreadGenerator {
    const [hx, y] = c.headTop();
    const short = this.format === 'short';
    const maxW = short ? 700 : 780;
    // keep the bubble on screen; the tail still points at the speaker
    const x = Math.max(-this.w / 2 + maxW / 2 + 24, Math.min(this.w / 2 - maxW / 2 - 24, hx));
    const b = (
      <Node x={x} y={y - 30} scale={0}>
        <Rect layout offset={[0, 1]} y={-26} padding={[24, 36]} radius={40} fill="#ffffff" stroke="#1d1d24" lineWidth={6}
          maxWidth={maxW}>
          <Txt text={text} fontFamily={FONT} fontSize={short ? 50 : 38} fill="#1d1d24" textWrap textAlign="center" />
        </Rect>
        <Path x={Math.max(-maxW / 2 + 60, Math.min(maxW / 2 - 60, hx - x))} y={-26} data="M -20 -4 L 0 26 L 20 -4"
          fill="#ffffff" stroke="#1d1d24" lineWidth={6} lineJoin="round" />
      </Node>
    ) as Node;
    this.fx.add(b);
    yield* b.scale(1, 0.18, easeOutBack);
    yield* waitFor(Math.max(0, duration - 0.36));
    yield* b.scale(0, 0.18);
    b.remove();
  }

  // ---------- camera & transitions ----------

  /** Zoom the camera to `scale` centred on stage point `at`. */
  *zoom(scale: number, at: [number, number] = [0, 0], dur = 0.8): ThreadGenerator {
    yield* all(
      this.camera.scale(scale, dur, easeInOutCubic),
      this.camera.position([-at[0] * scale, -at[1] * scale], dur, easeInOutCubic),
    );
  }

  *shake(amp = 16, dur = 0.4): ThreadGenerator {
    const base = this.camera.position();
    const n = Math.max(2, Math.round(dur / 0.05));
    for (let i = 0; i < n; i++) {
      const k = 1 - i / n;
      yield* this.camera.position([base.x + this.rng.range(-amp, amp) * k, base.y + this.rng.range(-amp, amp) * k], dur / n);
    }
    this.camera.position(base);
  }

  *fadeIn(dur = 0.5): ThreadGenerator {
    this.curtain.opacity(1);
    yield* this.curtain.opacity(0, dur);
  }

  *fadeOut(dur = 0.5): ThreadGenerator {
    yield* this.curtain.opacity(1, dur);
  }

  *wait(seconds: number): ThreadGenerator {
    yield* waitFor(seconds);
  }
}
