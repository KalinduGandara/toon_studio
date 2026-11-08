// Channel brand kits: one call gives every video of a channel the same backdrop, type, hook,
// series tag, captions and end card. Neon Pulse is the maths channel's approved theme
// (maths/theme/THEME.md); keep the palette in sync with it.
import {Circle, Gradient, Line, Node, Rect, Txt} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {all, easeOutCubic, waitFor} from '@revideo/core';
import {PointCloud} from './draw';
import type {Stage} from './stage';

export const NEON = {
  bg: '#08080D',
  bgAlt: '#14141F',
  grid: '#26263A',
  text: '#F7F7FB',
  muted: '#9C9CB4',
  primary: '#22E1FF',
  secondary: '#FF3D8B',
  tertiary: '#B98CFF',
  highlight: '#FFD23F',
  positive: '#5CFF9D',
  negative: '#FF6B4A',
} as const;

export const NEON_FONT = '"DIN Alternate", "Avenir Next", "Helvetica Neue", Arial, sans-serif';

export interface NeonKit {
  /** The hook line at the top (change its text when the video turns). */
  hook: Txt;
  /** Hook text with the pulse bar redrawn under it. */
  setHook(text: string): ThreadGenerator;
  /** End card: the closing question and the channel handle. */
  end(question: string, hold?: number): ThreadGenerator;
}

function glow(x: number, y: number, r: number, color: string, alpha: string): Circle {
  return (
    <Circle x={x} y={y} size={r * 2}
      fill={new Gradient({type: 'radial', from: [0, 0], to: [0, 0], fromRadius: 0, toRadius: r,
        stops: [{offset: 0, color: color + alpha}, {offset: 1, color: color + '00'}]})} />
  ) as Circle;
}

/**
 * Neon Pulse for a vertical Short: backdrop (two soft glows + dot grid), a series pill
 * ("VISUAL MATHS #3"), the hook with a cyan-to-magenta pulse bar, and branded captions.
 * Keep the visual between y -420 and +420; captions sit at +576.
 */
export function neonPulse(s: Stage, o: {hook: string; series: string; handle: string}): NeonKit {
  const g = (<Node />) as Node;
  g.add(<Rect width={s.w * 1.6} height={s.h * 1.6} fill={NEON.bg} />);
  g.add(glow(-s.w * 0.45, -s.h * 0.4, s.w * 0.9, NEON.primary, '33'));
  g.add(glow(s.w * 0.45, s.h * 0.42, s.w * 0.9, NEON.secondary, '2a'));
  const step = 60;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = -s.w * 0.75; x <= s.w * 0.75; x += step) for (let y = -s.h * 0.75; y <= s.h * 0.75; y += step) {
    xs.push(x);
    ys.push(y);
  }
  const grid = new PointCloud({xs: Float32Array.from(xs), ys: Float32Array.from(ys), group: new Uint8Array(xs.length),
    colors: [NEON.grid], size: 5, round: true, glow: 0});
  grid.count(xs.length);
  g.add(grid);
  s.add(g, 'bg');

  const top = -s.h / 2 + 280;
  const pill = (<Rect x={-s.w / 2 + 70} y={top} offsetX={-1} height={58} radius={29} fill={NEON.bgAlt}
    stroke={NEON.primary} lineWidth={3} padding={[0, 26]} layout>
    <Txt text={o.series.toUpperCase()} fontFamily={NEON_FONT} fontSize={30} fontWeight={700} letterSpacing={3} fill={NEON.primary} />
  </Rect>) as Rect;
  s.add(pill, 'ui');

  const hook = (<Txt y={top + 140} text={o.hook} fontFamily={NEON_FONT} fontSize={78} fontWeight={700} fill={NEON.text}
    width={s.w * 0.88} textWrap textAlign="center" />) as Txt;
  s.add(hook, 'ui');
  const bar = (<Line y={top + 250} points={[[-s.w * 0.22, 0], [s.w * 0.22, 0]]} lineWidth={10} lineCap="round"
    stroke={new Gradient({from: [-s.w * 0.22, 0], to: [s.w * 0.22, 0], stops: [{offset: 0, color: NEON.primary}, {offset: 1, color: NEON.secondary}]})} />) as Line;
  s.add(bar, 'ui');

  s.caption.fontFamily(NEON_FONT);
  s.caption.fontWeight(700);
  s.caption.fill(NEON.text);
  s.caption.stroke(NEON.bg);
  s.caption.letterSpacing(1);

  return {
    hook,
    *setHook(text: string) {
      yield* all(hook.opacity(0, 0.25), bar.end(0, 0.25));
      hook.text(text);
      yield* all(hook.opacity(1, 0.35), bar.end(1, 0.5, easeOutCubic));
    },
    *end(question: string, hold = 1.5) {
      const card = (<Node y={s.h * 0.08} opacity={0}>
        <Rect width={s.w * 0.86} height={300} radius={28} fill={NEON.bgAlt + 'ee'} stroke={NEON.highlight} lineWidth={4} />
        <Txt y={-40} text={question} fontFamily={NEON_FONT} fontSize={56} fontWeight={700} fill={NEON.text} width={s.w * 0.78} textWrap textAlign="center" />
        <Txt y={90} text={o.handle} fontFamily={NEON_FONT} fontSize={40} fontWeight={700} letterSpacing={2} fill={NEON.highlight} />
      </Node>) as Node;
      s.add(card, 'ui');
      yield* card.opacity(1, 0.4);
      yield* waitFor(hold);
    },
  };
}
