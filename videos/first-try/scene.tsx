import {all, paper, pop, stick, toonProject, waitFor} from '../../src';

export default toonProject(function* (s) {
  paper(s);
  const dev = s.character(stick(), {name: 'Dev', x: -220, emotion: 'neutral', pose: 'relaxed'});
  const pal = s.character(stick({outline: '#2b59c3'}), {name: 'Pal', x: 260, emotion: 'neutral'});
  yield* all(dev.react('happy'), dev.pose('cheer'));
  yield* all(dev.say('s1'), dev.jump(80));
  yield* all(pal.lookAt(dev), pal.pose('think'), pal.react('confused'));
  yield* all(pal.say('s2'), pal.tilt(10), pop(s, '?!', [260, s.ground - 820], {size: 140, color: '#2b59c3'}));
  yield* all(dev.react('scared'), dev.pose('shrug'), s.shake(14, 0.3));
  yield* dev.say('s3', {emotion: 'scared'});
  yield* waitFor(0.5);
});
