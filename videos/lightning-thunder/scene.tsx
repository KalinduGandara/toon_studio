import {all, arrow, bullets, counter, heading, label, paper, person, title, toonProject, waitFor} from '../../src';

export default toonProject(function* (s) {
  paper(s, {floorLine: false});
  yield* title(s, 'Lightning vs thunder', {sub: 'Why the flash comes first', hold: 1.0});
  const ana = s.character(person({hair: 'long', hairColor: '#4a2c2a', body: '#ff7a59', accessory: 'glasses'}), {x: -s.w * 0.33, emotion: 'smile'});
  yield* ana.appear();
  yield* all(ana.say('e1'), ana.pose('waveRight'));
  yield* ana.pose('present');
  heading(s, 'Speed of...');
  const list = bullets(s, ['Light: 300,000 km per second', 'Sound: 340 m per second'], {x: -s.w * 0.1, y: -s.h * 0.16});
  yield* all(ana.say('e2'), list.reveal(0));
  yield* all(ana.say('e3'), list.reveal(1));
  yield* all(ana.pose('pointRight'), ana.react('happy'));
  const n = counter(s, 0, 3, [s.w * 0.06, s.h * 0.12], {dur: 0.9, suffix: ' s'});
  yield* n;
  yield* arrow(s, [s.w * 0.13, s.h * 0.12], [s.w * 0.24, s.h * 0.12]);
  yield* all(ana.say('e4'), label(s, '≈ 1 km away', [s.w * 0.35, s.h * 0.12]));
  n.node.fill('#ff5d7a');
  yield* waitFor(0.6);
});
