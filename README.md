# toon_studio

2D character animation videos written as code: stick-figure stories, cute-couple shorts with
original characters, and explainers. Characters are puppets drawn in code (no image assets),
animated with [Revideo](https://re.video), voiced by a local TTS engine (Kokoro by default) with
automatic lip sync and captions. Output is the workspace export pack (`docs/export-pack.md`).

## Quick start

```bash
npm install                                   # PUPPETEER_SKIP_DOWNLOAD=1 reuses a cached Chrome
node cli/toon.mjs render videos/cookie-apology  # voice (cached) + render + export pack
node cli/toon.mjs frames videos/cookie-apology --at 2,6,10   # stills to review
npm test && npm run typecheck
```

Output: `out/<stem>/<stem>.mp4` (H.264 + AAC 48 kHz stereo), `<stem>_thumb.png`,
`<stem>_post.json`, `<stem>.json` (seed, provider, duration). Rendering a 20 s Short takes about
12 s on an M1 Pro. The same script and seed give a byte-identical file.

## A video = two files

`videos/<slug>/script.json`: what is said and posted.

```jsonc
{
  "format": "short",            // "short" 1080x1920 or "long" 1920x1080
  "seed": 7,                    // drives clouds, stars, effect scatter, blink timing
  "cast": {"mia": {"voice": "girl_sweet"}, "leo": {"voice": "boy_warm"}},
  "lines": [{"id": "l1", "who": "leo", "text": "Mia... are you still mad at me?"}],
  "thumbAt": 11.5,              // thumbnail time in seconds
  "post": {"title": "...", "description": "...", "hashtags": ["..."]}   // becomes <stem>_post.json
}
```

`videos/<slug>/scene.tsx`: what happens, as a Revideo generator.

```tsx
import {all, bean, hearts, room, toonProject} from '../../src';

export default toonProject(function* (s) {
  room(s);
  const mia = s.character(bean({ears: 'bunny', accessory: 'bow'}), {x: 250, emotion: 'angry', pose: 'hips'});
  const leo = s.character(bean({ears: 'bear', hair: 'tuft'}), {x: -800, emotion: 'sad'});
  yield* leo.walkTo(-250);
  yield* leo.say('l1', {bubble: true});           // audio + lip sync + speech bubble
  yield* all(mia.react('love'), hearts(s, [0, s.ground - 760]));
});
```

Actions are generators: run them one after another with `yield*`, together with `all(...)`,
staggered with `sequence(...)`, or for the rest of the video with `s.background(...)`.

## Building blocks

**Stage** (`s`): `s.w`, `s.h`, `s.ground` (floor y), `s.unit` (default character scale), `s.rng`
(seeded), `s.character(style, {x, name, emotion, pose, scale})`, `s.add(node, layer)`,
`s.narrate(id)` (voice-over), `s.duration(id)`, `s.sound(file)`, `s.zoom(scale, [x, y], dur)`,
`s.shake()`, `s.fadeIn()`, `s.fadeOut()`, `s.wait(t)`, `s.captions = false` to turn captions off.
Layers: `bg`, `world`, `fx` (move with the camera) and `ui` (screen-fixed).

**Character styles** (`src/styles.ts`; every field can be overridden):
- `stick({outline})`: stick figure
- `bean({ears: 'bear' | 'bunny' | 'cat' | 'none', hair, accessory, skin, body, ...})`: round chibi for couples
- `person({hair: 'short' | 'long' | 'bun' | 'spiky' | 'tuft' | 'none', body, legs, skin, accessory: 'tie' | 'glasses' | 'scarf' | 'bow'})`: flat explainer person

**Character actions:**

| Action | Does |
|---|---|
| `say(id, {bubble, captions, emotion})` | Plays the voice line with lip sync, captions (or a bubble) |
| `pose(name \| joints, dur)`, `setPose()` | Poses: `stand relaxed cheer waveRight waveLeft pointRight pointLeft pointUp think shrug hug hips sad facepalm present holdHands sit` |
| `emote(e)`, `react(e)` | Emotions: `neutral smile happy laugh sad cry angry surprised scared love shy sleepy smug confused` (`react` adds a pop) |
| `walkTo(x, {speed, duration})`, `moveTo(x, y, dur)` | Walk with a leg cycle and bob, or slide |
| `wave()`, `jump(h)`, `nod()`, `shakeHead()`, `tilt(deg)`, `lookAt(char \| x \| 'camera')` | Gestures |
| `appear()`, `disappear()`, `grow(scale)` | Entrances and exits |

Characters blink and breathe on their own (seeded timing).

**Backgrounds:** `sky(s)`, `room(s)`, `night(s)`, `paper(s)`, `plain(s, top, bottom)`.
**Effects:** `hearts(s, at)`, `sparkles(s, at)`, `pop(s, '?!', at)`.
**Explainer:** `title(s, text, {sub})`, `heading(s, text)`, `bullets(s, items).reveal(i)`,
`label(s, text, at)`, `arrow(s, from, to)`, `card(s, {width, height})`, `counter(s, 0, 100, at)`.
`label`, `arrow`, `card` and `counter` return an animation that also carries `.node`, so they
work inside `all(...)` and you can change the node afterwards.

**Maths visuals:** `src/fractals.ts` has `chaosGame`, `sierpinski` and `prefixPath`. The nodes
`new PointCloud(...)` (tens of thousands of dots; animate `.count`) and `new Polys(...)` (thousands
of polygons, filled or neon outlines, optional clip and a screen-fixed conic gradient) paint
straight to the canvas. Example: `videos/three-dots` (chaos game → Sierpinski, seamless infinite
zoom).

**Music:** add `"music": {"volume": 0.2}` to `script.json` for a procedural ambient bed (original,
seeded). It is mixed under the voice and ducked while someone speaks. Every export is then
normalised to −14 LUFS.

Anything Revideo can draw (`@revideo/2d`: `Rect`, `Circle`, `Path`, `Txt`, `Img`, `Latex`, ...)
can be added with `s.add(<Rect .../>)` for one-off props.

## Voice: swappable TTS

`voices.json` maps **logical voices** (`narrator`, `girl_sweet`, `boy_warm`, ...) to settings per
provider. Scripts only use logical names. The pipeline:

1. `cli/voice/index.mjs` looks up each line's provider settings and synthesises only the lines
   not in the cache (`out/.voice-cache/`, keyed by provider + settings + text).
2. The provider writes raw WAVs.
3. Every clip is normalised the same way (48 kHz mono, −16 LUFS).
4. A mouth track (0-3 per 1/30 s) is computed from the audio itself, so lip sync needs nothing
   from the engine.
5. `manifest.json` is passed to the scene.

**Kokoro** (`cli/voice/kokoro.mjs` + `kokoro_worker.py`) runs with the maths venv's Python, which
already has Kokoro and its weights. Use `TOON_KOKORO_PYTHON` to point elsewhere.

**Adding Chatterbox (or any engine):**
1. Write `cli/voice/chatterbox.mjs` exporting `async synthesize(jobs)`. Each job is
   `{text, settings, out}`; write a WAV to `out` (any sample rate).
2. Register it in `PROVIDERS` in `cli/voice/index.mjs`.
3. Add a `"chatterbox": {...}` block to each voice in `voices.json`.
4. Set `"default_provider": "chatterbox"`, or pass `--provider chatterbox`.

Scenes and scripts don't change. `test/voice.test.mjs` shows a complete fake provider.

## Requirements

Node 20+, ffmpeg/ffprobe on PATH, Chrome for Puppeteer. The CLI uses `$TOON_CHROME` or the
newest cached `chrome-headless-shell` in `~/.cache/puppeteer`. Revideo telemetry is disabled
by the CLI.

## Layout

| Path | What |
|---|---|
| `src/` | Framework: `stage.tsx`, `character.tsx`, `styles.ts`, `rig.ts` (poses), `face.ts` (emotions), `blocks.tsx`, `project.tsx` |
| `cli/toon.mjs` | `voice`, `render`, `frames` |
| `cli/voice/` | Provider registry, Kokoro provider, lip sync |
| `cli/music.mjs` | Procedural ambient music bed |
| `voices.json` | Logical voices → provider settings |
| `videos/<slug>/` | `script.json` + `scene.tsx` per video. Demos: `cookie-apology` (couple), `first-try` (stick), `lightning-thunder` (16:9 explainer), `three-dots` (narrated fractal) |
| `out/` | Renders and voice cache (gitignored) |
