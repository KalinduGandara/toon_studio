# toon_studio: rules for Claude Code

2D character videos (stick figures, cute couples, explainers) as code: Revideo + a swappable TTS
provider. Read `README.md` for the API. The workspace rules in `../CLAUDE.md` apply (manual upload
only, no copyrighted material, determinism, look at frames before calling a video done).

## Making a video

1. Create `videos/<slug>/script.json` (cast with logical voices from `voices.json`, lines with
   unique ids, `post`, `thumbAt`) and `videos/<slug>/scene.tsx` (`toonProject(function* (s) {...})`).
2. `npm run typecheck`, then `node cli/toon.mjs render videos/<slug>`.
3. Review: `node cli/toon.mjs frames videos/<slug> --at ...`, Read the PNGs (layout, nothing
   clipped, bubbles readable, faces match the line). Then check the audio level and a mouth
   close-up while a line plays.
4. `uv run --project release release check out/<stem>/<stem>.mp4` from the workspace root.

## Rules

- **Original characters only.** No look-alikes of existing IP (Bubu/Dudu, Milk & Mocha, Sanrio,
  anime or cartoon characters): change the species, proportions, colours and names. Never draw real people.
- **Voices** come from `voices.json` logical names; never put engine voice ids in scripts. No
  cloned voices of real people. Keep each TTS model's licence commercial-safe
  (`docs/animation-research.md`): Kokoro is Apache-2.0; XTTS, F5, Fish and Higgs are not allowed.
- **TTS stays behind the provider interface.** Engine-specific code lives only in
  `cli/voice/<provider>.mjs` (+ worker). Loudness, caching and lip sync stay in `cli/voice/index.mjs`
  and `lipsync.mjs` so every provider behaves the same.
- **Determinism:** randomness only through `s.rng` (seeded from `script.seed`). Vary the seed and
  the story between posts; templated, near-identical episodes break the inauthentic-content rule.
- **Write for adults** in couple and story videos (made-for-kids risk; see `docs/roadmap.md` 5).
- **Captions:** keep them on for Shorts (on by default; off when a bubble shows the words).
- `post.title` never contains `#shorts`: `release` adds it for YouTube only.
- Framework changes (new poses, emotions, blocks) go in `src/`, with a test for any pure logic in
  `test/`. Keep `rig.ts`, `face.ts` and `text.ts` free of Revideo imports so they stay testable in Node.

## Commands

```bash
npm test                     # node --test (rig, face, captions, lip sync, voice pipeline with a fake provider)
npm run typecheck            # tsc --noEmit
node cli/toon.mjs voice  videos/<slug> [--provider kokoro]
node cli/toon.mjs render videos/<slug> [--provider kokoro]
node cli/toon.mjs frames videos/<slug> --at 1,5,9
```

Commit conventions: conventional commits (`feat(character): ...`, `fix(voice): ...`).
