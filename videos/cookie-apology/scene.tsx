import {all, bean, hearts, room, toonProject, waitFor} from '../../src';

export default toonProject(function* (s) {
  room(s);
  const mia = s.character(bean({ears: 'bunny', skin: '#fff0f5', body: '#fff0f5', limb: '#fff0f5', legs: '#fff0f5', accessory: 'bow'}),
    {name: 'Mia', x: 250, emotion: 'angry', pose: 'hips'});
  const leo = s.character(bean({ears: 'bear', skin: '#f3d9b8', body: '#f3d9b8', limb: '#f3d9b8', legs: '#f3d9b8', earInner: '#e8b98f', hair: 'tuft'}),
    {name: 'Leo', x: -800, emotion: 'sad'});
  mia.lookX(0.9);

  yield* s.fadeIn(0.4);
  yield* leo.walkTo(-250, {duration: 1.4});
  yield* leo.lookAt(mia);
  yield* leo.say('l1', {bubble: true});
  yield* all(mia.lookAt(leo), mia.react('angry'));
  yield* mia.say('l2', {bubble: true});
  yield* all(leo.pose('think'), leo.tilt(-8));
  yield* waitFor(0.3);
  yield* all(leo.pose('present'), leo.tilt(0), leo.react('smile'));
  yield* leo.say('l3', {bubble: true});
  yield* all(mia.react('surprised'), mia.pose('stand'));
  yield* waitFor(0.3);
  mia.emote('shy');
  yield* mia.say('l4', {bubble: true});
  yield* all(leo.walkTo(-150, {duration: 0.6}), mia.walkTo(150, {duration: 0.6}));
  leo.emote('love');
  mia.emote('love');
  yield* all(leo.pose('hug'), mia.pose('hug'), hearts(s, [0, s.ground - 760], {count: 8}));
  yield* all(leo.say('l5'), leo.jump(90), mia.jump(70));
  yield* waitFor(0.6);
  yield* s.fadeOut(0.4);
});
