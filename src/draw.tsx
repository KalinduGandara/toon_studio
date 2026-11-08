// Fast canvas drawing nodes for maths visuals with thousands of elements (point clouds,
// polygon sets). They paint straight to the canvas each frame instead of building one Revideo
// node per element. Create them with `new` and add them with s.add(...).
import {Node, NodeProps} from '@revideo/2d';
import {BBox, createSignal, Vector2} from '@revideo/core';
import type {V} from './fractals';

/** Bounds of points plus padding (for Revideo's offscreen cache, used when opacity < 1). */
function bounds(xs: ArrayLike<number>, ys: ArrayLike<number>, pad: number): BBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i]);
    y0 = Math.min(y0, ys[i]); y1 = Math.max(y1, ys[i]);
  }
  if (!Number.isFinite(x0)) return new BBox();
  return new BBox(new Vector2(x0 - pad, y0 - pad), new Vector2(x1 - x0 + 2 * pad, y1 - y0 + 2 * pad));
}

export interface CloudData {
  xs: Float32Array;
  ys: Float32Array;
  /** Colour group of each point (index into `colors`). */
  group: Uint8Array;
  colors: string[];
  /** Dot size, px (square side, or circle diameter when `round`). */
  size?: number;
  /** Per-point sizes (overrides `size`). */
  sizes?: Float32Array;
  round?: boolean;
  glow?: number;
}

const maxOf = (a: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, a[i]);
  return m;
};

/**
 * Points drawn as dots; `count` (a signal) is how many are visible. Pass a function instead of
 * data to animate the points themselves (it is re-evaluated every frame, e.g. from a signal).
 */
export class PointCloud extends Node {
  readonly count = createSignal(0);
  private readonly src: () => CloudData;

  constructor(data: CloudData | (() => CloudData), props: NodeProps = {}) {
    super(props);
    this.src = typeof data === 'function' ? data : () => data;
    const d = this.src();
    const size = d.sizes ? maxOf(d.sizes) : d.size ?? 2.6;
    this.box = bounds(d.xs, d.ys, size + 3 * (d.glow ?? 8) + 40);
  }

  private readonly box: BBox;

  protected getCacheBBox(): BBox {
    return this.box;
  }

  async draw(ctx: CanvasRenderingContext2D): Promise<void> {
    const d = this.src();
    const {xs, ys, group, colors, sizes, round} = d;
    const n = Math.min(xs.length, Math.floor(this.count()));
    const base = d.size ?? 2.6;
    ctx.save();
    colors.forEach((color, g) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (group[i] !== g) continue;
        const sz = sizes ? sizes[i] : base;
        if (round) {
          ctx.moveTo(xs[i] + sz / 2, ys[i]);
          ctx.arc(xs[i], ys[i], sz / 2, 0, Math.PI * 2);
        } else {
          ctx.rect(xs[i] - sz / 2, ys[i] - sz / 2, sz, sz);
        }
      }
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = d.glow ?? 8;
      ctx.fill();
    });
    ctx.restore();
    await this.drawChildren(ctx);
  }
}

export interface Poly {
  pts: V[];
  group: number;
}

export interface PolySet {
  /** Polygons, or a function returning them (re-evaluated every frame, for animated shapes). */
  polys: Poly[] | (() => Poly[]);
  /** Draw open polylines (segments) instead of closed polygons. */
  open?: boolean;
  colors: string[];
  glow?: number;
  /** Outline instead of fill (line width in px, constant on screen regardless of scale). */
  stroke?: number;
  /** Optional clip polygon in this node's local coordinates, evaluated every frame. */
  clip?: () => V[];
  /**
   * Fill everything with one conic gradient fixed in the parent's space (it does not move or
   * scale with this node). `colors` then lists the gradient stops; groups are ignored.
   */
  conic?: {at: V; angle?: number};
}

/** Many filled (or outlined) polygons, one canvas fill per colour group. */
export class Polys extends Node {
  private readonly d: PolySet;

  constructor(data: PolySet, props: NodeProps = {}) {
    super(props);
    this.d = data;
    const pts = this.polys().flatMap((p) => p.pts);
    this.box = bounds(pts.map((q) => q[0]), pts.map((q) => q[1]), 3 * (data.glow ?? 10) + (data.stroke ?? 0) * 4);
  }

  private readonly box: BBox;

  protected getCacheBBox(): BBox {
    return this.box;
  }

  private polys(): Poly[] {
    return typeof this.d.polys === 'function' ? this.d.polys() : this.d.polys;
  }

  private trace(ctx: CanvasRenderingContext2D, pts: V[]): void {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (!this.d.open) ctx.closePath();
  }

  async draw(ctx: CanvasRenderingContext2D): Promise<void> {
    const {colors, stroke, clip} = this.d;
    const polys = this.polys();
    ctx.save();
    if (clip) {
      const c = clip();
      ctx.beginPath();
      ctx.moveTo(c[0][0], c[0][1]);
      for (let i = 1; i < c.length; i++) ctx.lineTo(c[i][0], c[i][1]);
      ctx.closePath();
      ctx.clip();
    }
    if (this.d.conic) {
      ctx.beginPath();
      for (const p of polys) this.trace(ctx, p.pts);
      // gradient centre: parent-space point -> device pixels
      const m = ctx.getTransform().multiply(this.localToParent().inverse());
      const c = m.transformPoint(new DOMPoint(this.d.conic.at[0], this.d.conic.at[1]));
      ctx.resetTransform();
      const g = ctx.createConicGradient(this.d.conic.angle ?? -Math.PI / 2, c.x, c.y);
      [...colors, colors[0]].forEach((col, i) => g.addColorStop(i / colors.length, col));
      ctx.shadowColor = '#ffffff55';
      ctx.shadowBlur = this.d.glow ?? 10;
      if (stroke) {
        ctx.strokeStyle = g;
        ctx.lineWidth = stroke; // the transform is reset, so this is screen pixels
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else {
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.restore();
      await this.drawChildren(ctx);
      return;
    }
    colors.forEach((color, g) => {
      ctx.beginPath();
      for (const p of polys) if (p.group === g) this.trace(ctx, p.pts);
      ctx.shadowColor = color;
      ctx.shadowBlur = this.d.glow ?? 10;
      if (stroke) {
        ctx.strokeStyle = color;
        ctx.lineWidth = stroke / Math.max(1e-6, this.absoluteScale().x);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    });
    ctx.restore();
    await this.drawChildren(ctx);
  }
}
