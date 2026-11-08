// Character styles: proportions, colours and accessories. Three families cover the genres:
//   stick()  – stick figures (story/meme explainers)
//   bean()   – round chibi characters for cute-couple shorts
//   person() – simple flat people for explainers
// All characters are original and drawn in code. Sizes are pixels at scale 1 on a 1080x1920 frame.

export type Ears = 'none' | 'bear' | 'bunny' | 'cat';
export type Hair = 'none' | 'short' | 'long' | 'bun' | 'tuft' | 'spiky';
export type Accessory = 'none' | 'bow' | 'tie' | 'glasses' | 'scarf';

export interface Style {
  kind: 'stick' | 'bean' | 'person';
  headR: number;
  torsoW: number;
  torsoH: number;
  armUpper: number;
  armLower: number;
  legUpper: number;
  legLower: number;
  limbWidth: number;
  outlineWidth: number; // 0 = no outline (stick)
  outline: string;
  skin: string; // head / body base colour
  body: string; // torso colour
  limb: string; // arms
  legs: string; // legs (trousers for person)
  eye: string;
  mouth: string;
  blush: string;
  ears: Ears;
  earInner: string;
  hair: Hair;
  hairColor: string;
  accessory: Accessory;
  accessoryColor: string;
  brows: boolean;
  shine: boolean; // white highlight in the eyes (cute)
}

type Opts = Partial<Style>;

export function stick(o: Opts = {}): Style {
  const ink = o.outline ?? '#1d1d24';
  return {
    kind: 'stick', headR: 58, torsoW: 0, torsoH: 175, armUpper: 88, armLower: 80, legUpper: 100, legLower: 95,
    limbWidth: 12, outlineWidth: 0, outline: ink, skin: '#ffffff', body: ink, limb: ink, legs: ink, eye: ink, mouth: '#7a2a35',
    blush: '#ff8fa3', ears: 'none', earInner: '#ffffff', hair: 'none', hairColor: ink, accessory: 'none',
    accessoryColor: '#e63946', brows: true, shine: false, ...o,
  };
}

export function bean(o: Opts = {}): Style {
  return {
    kind: 'bean', headR: 125, torsoW: 165, torsoH: 150, armUpper: 52, armLower: 40, legUpper: 48, legLower: 30,
    limbWidth: 34, outlineWidth: 7, outline: '#3a2e2a', skin: '#fff4ea', body: '#fff4ea', limb: '#fff4ea', legs: '#fff4ea',
    eye: '#2b2220', mouth: '#a8434f', blush: '#ff9eb0', ears: 'bear', earInner: '#ffc9d3', hair: 'none',
    hairColor: '#5b3a29', accessory: 'none', accessoryColor: '#ff5d7a', brows: false, shine: true, ...o,
  };
}

export function person(o: Opts = {}): Style {
  return {
    kind: 'person', headR: 78, torsoW: 175, torsoH: 225, armUpper: 105, armLower: 95, legUpper: 120, legLower: 112,
    limbWidth: 34, outlineWidth: 6, outline: '#22223b', skin: '#f2c29b', body: '#3a86ff', limb: '#f2c29b', legs: '#2b2d42',
    eye: '#22223b', mouth: '#9d3c4b', blush: '#ff8fa3', ears: 'none', earInner: '#f2c29b', hair: 'short',
    hairColor: '#3d2b1f', accessory: 'none', accessoryColor: '#e63946', brows: true, shine: false, ...o,
  };
}

/** Body landmarks in local coordinates: feet at y = 0, up is negative y. */
export interface Layout {
  hipY: number;
  hipX: number;
  shoulderY: number;
  shoulderX: number;
  headY: number;
  top: number; // highest point (for bubbles)
}

export function layout(s: Style): Layout {
  const hipY = -(s.legUpper + s.legLower);
  if (s.kind === 'stick') {
    const shoulderY = hipY - s.torsoH + 50;
    const headY = hipY - s.torsoH - s.headR - 4;
    return {hipY, hipX: 0, shoulderY, shoulderX: 0, headY, top: headY - s.headR};
  }
  if (s.kind === 'bean') {
    const torsoTop = hipY - s.torsoH * 0.8;
    const shoulderY = torsoTop + s.torsoH * 0.32;
    const headY = torsoTop - s.headR * 0.62;
    const extra = s.ears === 'bunny' ? s.headR * 1.0 : s.ears === 'none' ? 0 : s.headR * 0.25;
    return {hipY, hipX: s.torsoW * 0.24, shoulderY, shoulderX: s.torsoW * 0.42, headY, top: headY - s.headR - extra};
  }
  const torsoTop = hipY - s.torsoH;
  const headY = torsoTop - 12 - s.headR;
  return {hipY: hipY + 10, hipX: s.torsoW * 0.24, shoulderY: torsoTop + 22, shoulderX: s.torsoW * 0.5 - 6, headY, top: headY - s.headR - 20};
}
