// toonProject: wraps a video function into a Revideo project (one scene, 30 fps).
// The CLI passes the size (short 1080x1920 / long 1920x1080), seed and voice manifest.
import {makeScene2D} from '@revideo/2d';
import type {ThreadGenerator} from '@revideo/core';
import {makeProject, waitFor} from '@revideo/core';
import {Stage} from './stage';

export function toonProject(video: (s: Stage) => ThreadGenerator, o: {tail?: number} = {}) {
  const scene = makeScene2D('main', function* (view) {
    const s = new Stage(view);
    yield* video(s);
    yield* waitFor(o.tail ?? 0.3);
  });
  return makeProject({
    scenes: [scene],
    settings: {shared: {size: {x: 1080, y: 1920}, background: '#ffffff'}, rendering: {fps: 30}},
  });
}
