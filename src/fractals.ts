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
