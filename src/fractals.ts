// Pure fractal geometry for fractal explainers (no Revideo imports; tested in test/fractals.test.mjs).

export type V = [number, number];

export interface ChaosGame {
  xs: Float32Array;
  ys: Float32Array;
  /** Index of the corner chosen for each jump. */
  pick: Uint8Array;
}

/** The chaos game: from `start`, repeatedly jump `ratio` of the way to a random corner. */
export function chaosGame(corners: V[], n: number, rng: {next(): number}, start: V, ratio = 0.5): ChaosGame {
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const pick = new Uint8Array(n);
  let [x, y] = start;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rng.next() * corners.length);
    x += (corners[k][0] - x) * ratio;
    y += (corners[k][1] - y) * ratio;
    xs[i] = x;
    ys[i] = y;
    pick[i] = k;
  }
  return {xs, ys, pick};
}

export interface Tri {
  pts: [V, V, V];
  /** Last digit of the triangle's address (which corner copy it is at the finest level). */
  digit: number;
}

/** Sierpinski triangle at `depth`: 3^depth corner triangles of (a, b, c). */
export function sierpinski(a: V, b: V, c: V, depth: number): Tri[] {
  let tris: Tri[] = [{pts: [a, b, c], digit: 0}];
  const mid = (p: V, q: V): V => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  for (let d = 0; d < depth; d++) {
    const next: Tri[] = [];
    for (const {pts: [p, q, r]} of tris) {
      const pq = mid(p, q);
      const qr = mid(q, r);
      const rp = mid(r, p);
      next.push({pts: [p, pq, rp], digit: 0}, {pts: [pq, q, qr], digit: 1}, {pts: [rp, qr, r], digit: 2});
    }
    tris = next;
  }
  return tris;
}

export function triPath(t: Tri): string {
  const [p, q, r] = t.pts;
  const f = (n: number) => n.toFixed(1);
  return `M ${f(p[0])} ${f(p[1])} L ${f(q[0])} ${f(q[1])} L ${f(r[0])} ${f(r[1])} Z`;
}

/**
 * Many sub-paths joined once, so "the first k" is a cheap string slice:
 * prefix(k) returns the path data of parts[0..k).
 */
export function prefixPath(parts: string[]): {text: string; prefix(k: number): string} {
  const ends = new Int32Array(parts.length + 1);
  let text = '';
  parts.forEach((p, i) => {
    text += (i ? ' ' : '') + p;
    ends[i + 1] = text.length;
  });
  return {text, prefix: (k) => text.slice(0, ends[Math.max(0, Math.min(parts.length, Math.floor(k)))])};
}

// ---------- more shapes for maths Shorts ----------

/** The golden angle, 360° × (1 − 1/φ) ≈ 137.508°. */
export const GOLDEN_ANGLE = 360 * (1 - 2 / (1 + Math.sqrt(5)));

/** Vogel's sunflower model: seed i at radius c·√i and angle i·angleDeg. */
export function phyllotaxis(n: number, angleDeg: number, c: number): {xs: Float32Array; ys: Float32Array} {
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const a = (angleDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const r = c * Math.sqrt(i + 0.5);
    xs[i] = r * Math.cos(i * a);
    ys[i] = r * Math.sin(i * a);
  }
  return {xs, ys};
}

/** Times table on a circle: n points, chord from point i to point k·i (k may be fractional). */
export function timesTable(n: number, k: number, radius: number): [V, V][] {
  const at = (t: number): V => {
    const a = (2 * Math.PI * t) / n - Math.PI / 2;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  };
  return Array.from({length: n}, (_, i) => [at(i), at(k * i)]);
}

/** Barnsley fern: the chaos game with 4 affine maps (probabilities 1%, 85%, 7%, 7%). */
export function barnsleyFern(n: number, rng: {next(): number}): {xs: Float32Array; ys: Float32Array; map: Uint8Array} {
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const map = new Uint8Array(n);
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const r = rng.next();
    let k: number;
    let nx: number;
    let ny: number;
    if (r < 0.01) [k, nx, ny] = [0, 0, 0.16 * y];
    else if (r < 0.86) [k, nx, ny] = [1, 0.85 * x + 0.04 * y, -0.04 * x + 0.85 * y + 1.6];
    else if (r < 0.93) [k, nx, ny] = [2, 0.2 * x - 0.26 * y, 0.23 * x + 0.22 * y + 1.6];
    else [k, nx, ny] = [3, -0.15 * x + 0.28 * y, 0.26 * x + 0.24 * y + 0.44];
    x = nx;
    y = ny;
    xs[i] = x;
    ys[i] = y;
    map[i] = k;
  }
  return {xs, ys, map};
}

/** Koch snowflake outline at `depth`, starting from the triangle a, b, c (clockwise on screen). */
export function koch(a: V, b: V, c: V, depth: number): V[] {
  let pts: V[] = [a, b, c];
  for (let d = 0; d < depth; d++) {
    const next: V[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      const dx = (q[0] - p[0]) / 3;
      const dy = (q[1] - p[1]) / 3;
      const s: V = [p[0] + dx, p[1] + dy];
      const e: V = [p[0] + 2 * dx, p[1] + 2 * dy];
      // bump points outward: rotate the middle third by -60°
      const cos = 0.5;
      const sin = -Math.sqrt(3) / 2;
      const m: V = [s[0] + dx * cos - dy * sin, s[1] + dx * sin + dy * cos];
      next.push(p, s, m, e);
    }
    pts = next;
  }
  return pts;
}

export function perimeter(pts: V[]): number {
  let L = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    L += Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]);
  }
  return L;
}

export function area(pts: V[]): number {
  let A = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    A += pts[i][0] * q[1] - q[0] * pts[i][1];
  }
  return Math.abs(A) / 2;
}

// ---------- probability and folding visuals ----------

/** Monte Carlo darts in the unit square: `inside[i]` = 1 if x² + y² ≤ 1; `hits[k]` = hits among the first k+1. */
export function darts(n: number, rng: {next(): number}): {xs: Float32Array; ys: Float32Array; inside: Uint8Array; hits: Uint32Array} {
  const xs = new Float32Array(n), ys = new Float32Array(n), inside = new Uint8Array(n), hits = new Uint32Array(n);
  let h = 0;
  for (let i = 0; i < n; i++) {
    xs[i] = rng.next();
    ys[i] = rng.next();
    inside[i] = xs[i] * xs[i] + ys[i] * ys[i] <= 1 ? 1 : 0;
    h += inside[i];
    hits[i] = h;
  }
  return {xs, ys, inside, hits};
}

/**
 * Paper strip folded in half `folds` times, then opened: the Heighway dragon. Returns
 * 2^folds + 1 points, unit-length steps from (0,0) heading +x. `angleDeg` is the turn at each
 * crease: 90 = opened to right angles (the dragon), 180 = still folded flat on itself.
 * `newestDeg` is the angle of the middle crease only (the first one opened when unfolding); the
 * others stay at `angleDeg`. With newestDeg = 180 the second half lies on the first, so the strip
 * traces dragon(folds - 1); animating 180 → 90 swings that copy out about the end point.
 */
export function dragon(folds: number, angleDeg = 90, newestDeg = angleDeg): V[] {
  let turns: number[] = []; // +1 left, -1 right
  for (let f = 0; f < folds; f++) turns = [...turns, 1, ...turns.slice().reverse().map((t) => -t)];
  const a = (angleDeg * Math.PI) / 180, b = (newestDeg * Math.PI) / 180;
  const pts: V[] = [[0, 0], [1, 0]];
  let heading = 0, x = 1, y = 0;
  for (let i = 0; i < turns.length; i++) {
    heading += turns[i] * (i === turns.length >> 1 ? b : a);
    // exact right angles keep integer coordinates (the tests compare segments)
    const dx = Math.round(Math.cos(heading) * 1e9) / 1e9, dy = Math.round(Math.sin(heading) * 1e9) / 1e9;
    x += dx;
    y += dy;
    pts.push([x, y]);
  }
  return pts;
}

/** Chance that at least two of `people` share a birthday (365 equally likely days). */
export function birthdayMatch(people: number, days = 365): number {
  let none = 1;
  for (let i = 0; i < people; i++) none *= (days - i) / days;
  return 1 - none;
}
