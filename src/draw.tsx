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
  /** Side of each square dot, px. */
  size?: number;
  glow?: number;
}

/** Points drawn as tiny squares; `count` (a signal) is how many are visible. */
export class PointCloud extends Node {
  readonly count = createSignal(0);
  private readonly d: CloudData;

  constructor(data: CloudData, props: NodeProps = {}) {
    super(props);
    this.d = data;
    this.box = bounds(data.xs, data.ys, (data.size ?? 2.6) + 3 * (data.glow ?? 8));
  }

  private readonly box: BBox;

  protected getCacheBBox(): BBox {
    return this.box;
  }

  async draw(ctx: CanvasRenderingContext2D): Promise<void> {
    const {xs, ys, group, colors} = this.d;
    const n = Math.min(xs.length, Math.floor(this.count()));
    const sz = this.d.size ?? 2.6;
    ctx.save();
    colors.forEach((color, g) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) if (group[i] === g) ctx.rect(xs[i] - sz / 2, ys[i] - sz / 2, sz, sz);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = this.d.glow ?? 8;
      ctx.fill();
    });
    ctx.restore();
    await this.drawChildren(ctx);
  }
}

export interface PolySet {
  polys: {pts: V[]; group: number}[];
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
    const pts = data.polys.flatMap((p) => p.pts);
    this.box = bounds(pts.map((q) => q[0]), pts.map((q) => q[1]), 3 * (data.glow ?? 10) + (data.stroke ?? 0) * 4);
  }

  private readonly box: BBox;

  protected getCacheBBox(): BBox {
    return this.box;
  }

  private trace(ctx: CanvasRenderingContext2D, pts: V[]): void {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  async draw(ctx: CanvasRenderingContext2D): Promise<void> {
    const {polys, colors, stroke, clip} = this.d;
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
      for (const p of polys) {
        if (p.group !== g) continue;
        ctx.moveTo(p.pts[0][0], p.pts[0][1]);
        for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i][0], p.pts[i][1]);
        ctx.closePath();
      }
      ctx.shadowColor = color;
      ctx.shadowBlur = this.d.glow ?? 10;
      if (stroke) {
        ctx.strokeStyle = color;
        ctx.lineWidth = stroke / Math.max(1e-6, this.absoluteScale().x);
        ctx.lineJoin = 'round';
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
