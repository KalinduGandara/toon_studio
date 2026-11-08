// Pure rig maths: joint angles -> limb points, plus the named poses. No Revideo imports,
// so it is unit-tested in Node (test/rig.test.mjs).
//
// Characters face the camera. Angles are degrees: 0 = limb hanging straight down, positive =
// swung outward (away from the body's midline). The second angle (elbow / knee) bends the lower
// segment further outward (positive) or back inward (negative).

export type Vec = [number, number];

export interface Joints {
  la: number; le: number; // left shoulder, left elbow
  ra: number; re: number; // right shoulder, right elbow
  ll: number; lk: number; // left hip, left knee
  rl: number; rk: number; // right hip, right knee
}

export const JOINT_NAMES: (keyof Joints)[] = ['la', 'le', 'ra', 're', 'll', 'lk', 'rl', 'rk'];

const STAND: Joints = {la: 12, le: 8, ra: 12, re: 8, ll: 5, lk: 0, rl: 5, rk: 0};

/** Named poses. "left"/"right" are the character's own sides as seen on screen (left = x < 0). */
export const POSES: Record<string, Joints> = {
  stand: STAND,
  relaxed: {...STAND, la: 6, le: 2, ra: 6, re: 2},
  cheer: {...STAND, la: 140, le: 10, ra: 140, re: 10},
  waveRight: {...STAND, ra: 140, re: 25},
  waveLeft: {...STAND, la: 140, le: 25},
  pointRight: {...STAND, ra: 92, re: 0},
  pointLeft: {...STAND, la: 92, le: 0},
  pointUp: {...STAND, ra: 165, re: 0},
  think: {...STAND, ra: 25, re: -150},
  shrug: {...STAND, la: 40, le: 95, ra: 40, re: 95},
  hug: {...STAND, la: 70, le: -55, ra: 70, re: -55},
  hips: {...STAND, la: 38, le: -115, ra: 38, re: -115},
  sad: {...STAND, la: 4, le: 0, ra: 4, re: 0},
  facepalm: {...STAND, ra: 30, re: -165},
  present: {...STAND, ra: 60, re: 30, la: 20, le: 10},
  holdHands: {...STAND, ra: 35, re: 5},
  sit: {...STAND, ll: 80, lk: -80, rl: 80, rk: -80},
};

/** Three points of a two-segment limb starting at `origin` on `side` (-1 left, +1 right). */
export function limb(origin: Vec, side: -1 | 1, a: number, b: number, upper: number, lower: number): Vec[] {
  const r1 = (a * Math.PI) / 180;
  const r2 = ((a + b) * Math.PI) / 180;
  const mid: Vec = [origin[0] + side * upper * Math.sin(r1), origin[1] + upper * Math.cos(r1)];
  const end: Vec = [mid[0] + side * lower * Math.sin(r2), mid[1] + lower * Math.cos(r2)];
  return [origin, mid, end];
}

/** Walk cycle offsets at `phase` (radians): legs swing opposite, arms counter-swing. */
export function walkOffsets(phase: number, stride = 18): Partial<Joints> {
  const s = Math.sin(phase);
  return {ll: 5 + stride * s, rl: 5 - stride * s, lk: Math.max(0, -12 * s), rk: Math.max(0, 12 * s), la: 12 - 8 * s, ra: 12 + 8 * s};
}

export function resolvePose(pose: string | Partial<Joints>): Joints {
  if (typeof pose === 'string') {
    const p = POSES[pose];
    if (!p) throw new Error(`unknown pose "${pose}" (known: ${Object.keys(POSES).join(', ')})`);
    return p;
  }
  return {...STAND, ...pose};
}
