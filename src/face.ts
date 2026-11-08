// Pure face drawing: emotion + blink + mouth openness -> SVG path data. No Revideo imports
// (unit-tested in test/face.test.mjs). Sizes are relative to `r` (eye radius) or `w` (half mouth width).

export type Emotion =
  | 'neutral' | 'smile' | 'happy' | 'laugh' | 'sad' | 'cry' | 'angry'
  | 'surprised' | 'scared' | 'love' | 'shy' | 'sleepy' | 'smug' | 'confused';

export interface Expression {
  eye: 'dot' | 'arc' | 'big' | 'heart' | 'line' | 'half';
  curve: number; // mouth curvature: + smile, - frown
  o?: boolean; // round "o" mouth
  brow: number; // brow tilt in degrees: + inner end up (worried/sad), - inner end down (angry)
  browLift: number; // brow raise, in eye radii
  blush: number; // 0..1
  tears?: boolean;
}

export const EXPRESSIONS: Record<Emotion, Expression> = {
  neutral: {eye: 'dot', curve: 0.12, brow: 0, browLift: 0, blush: 0},
  smile: {eye: 'dot', curve: 0.5, brow: 0, browLift: 0.1, blush: 0.25},
  happy: {eye: 'arc', curve: 0.65, brow: 0, browLift: 0.2, blush: 0.5},
  laugh: {eye: 'arc', curve: 0.8, brow: 0, browLift: 0.3, blush: 0.6},
  sad: {eye: 'dot', curve: -0.45, brow: 18, browLift: 0.1, blush: 0},
  cry: {eye: 'arc', curve: -0.55, brow: 22, browLift: 0.1, blush: 0.2, tears: true},
  angry: {eye: 'half', curve: -0.35, brow: -24, browLift: -0.2, blush: 0},
  surprised: {eye: 'big', curve: 0, o: true, brow: 0, browLift: 0.6, blush: 0},
  scared: {eye: 'big', curve: -0.3, brow: 20, browLift: 0.5, blush: 0},
  love: {eye: 'heart', curve: 0.6, brow: 0, browLift: 0.2, blush: 1},
  shy: {eye: 'dot', curve: 0.25, brow: 10, browLift: 0, blush: 1},
  sleepy: {eye: 'line', curve: 0.05, brow: 0, browLift: -0.1, blush: 0},
  smug: {eye: 'half', curve: 0.4, brow: -8, browLift: 0, blush: 0.2},
  confused: {eye: 'dot', curve: -0.1, brow: 14, browLift: 0.3, blush: 0},
};

export function expression(e: string): Expression {
  const x = EXPRESSIONS[e as Emotion];
  if (!x) throw new Error(`unknown emotion "${e}" (known: ${Object.keys(EXPRESSIONS).join(', ')})`);
  return x;
}

const f = (n: number) => +n.toFixed(2);

function ellipse(rx: number, ry: number): string {
  return `M ${f(-rx)} 0 A ${f(rx)} ${f(ry)} 0 1 0 ${f(rx)} 0 A ${f(rx)} ${f(ry)} 0 1 0 ${f(-rx)} 0 Z`;
}

export function heart(s: number): string {
  return `M 0 ${f(s * 0.9)} C ${f(-s * 1.4)} ${f(s * 0.1)} ${f(-s * 0.9)} ${f(-s * 1.1)} 0 ${f(-s * 0.35)} ` +
    `C ${f(s * 0.9)} ${f(-s * 1.1)} ${f(s * 1.4)} ${f(s * 0.1)} 0 ${f(s * 0.9)} Z`;
}

/** Eye shape. `blink` 0 = open, 1 = shut. Returns path and whether it is filled (else stroked). */
export function eyePath(e: string, blink: number, r: number): {d: string; filled: boolean} {
  const x = expression(e);
  const open = Math.max(0, 1 - blink);
  if (x.eye === 'arc') return {d: `M ${f(-r)} ${f(r * 0.35)} Q 0 ${f(-r * 1.1)} ${f(r)} ${f(r * 0.35)}`, filled: false};
  if (x.eye === 'line' || open < 0.15) return {d: `M ${f(-r)} 0 L ${f(r)} 0`, filled: false};
  if (x.eye === 'heart') return {d: heart(r * 1.1), filled: true};
  if (x.eye === 'half') {
    const ry = r * 0.6 * open;
    return {d: `M ${f(-r)} ${f(-ry * 0.2)} L ${f(r)} ${f(-ry * 0.2)} A ${f(r)} ${f(ry)} 0 0 1 ${f(-r)} ${f(-ry * 0.2)} Z`, filled: true};
  }
  const scale = x.eye === 'big' ? 1.3 : 1;
  return {d: ellipse(r * 0.8 * scale, r * 1.05 * scale * open), filled: true};
}

/** Mouth. `open` 0..3 from the lip-sync track. Returns path and whether it is filled. */
export function mouthPath(e: string, open: number, w: number): {d: string; filled: boolean} {
  const x = expression(e);
  const o = Math.max(0, Math.min(3, open));
  if (x.o) return {d: ellipse(w * (0.35 + 0.08 * o), w * (0.4 + 0.15 * o)), filled: true};
  const c = x.curve * w; // smile lifts the corners: control point below them
  if (o < 0.5) return {d: `M ${f(-w)} 0 Q 0 ${f(c)} ${f(w)} 0`, filled: false};
  const h = w * 0.5 * o;
  const top = c * 0.6;
  return {d: `M ${f(-w)} 0 Q 0 ${f(top)} ${f(w)} 0 Q 0 ${f(Math.max(top, c) + h)} ${f(-w)} 0 Z`, filled: true};
}
