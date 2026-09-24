# Explore gate and iOS audio emergency repair

Status: private candidate, isolated from unfinished development. No backend,
provider, migration, save-schema, creature-art or reward changes.

## Confirmed failures

1. `GameScene.enterHubWorld()` set a one-second scene-clock cooldown, then left
   the scene after a 500ms camera fade. Scene shutdown removed that timer. Phaser
   reuses the scene instance, and `init()` never cleared the flag. The gate could
   remain blocked on the second and third visits. The regression test reproduced
   one successful entry out of three before this repair.
2. `AudioManager` used one-shot unlock listeners and treated a resolved resume
   promise as success without checking the context state. Muted gestures consumed
   listeners; a still-interrupted context could be incorrectly marked unlocked.
   Recovery covered the procedural context but not Phaser's separate recorded
   music context. The added tests reproduced these gaps before repair.
3. Protected main still lacked the earlier private loading-overlay lifecycle
   repair. `showLoading()` dereferenced a potentially missing overlay. The
   `beforeunload` handler also destroyed UI on cancelled navigation or before a
   back/forward-cache return. Only this loading/page-lifecycle portion of private
   commit `3f0a496a` was retained; its final-boss changes were NOT included.

Public read-only verification on 24 September found these old implementations in
`/assets/gameplay-Cg5wdlmV.js` and `/assets/core-BDTYa9MM.js`, referenced by the live
`/play/` entry `/assets/index-CUGK000k.js`. Branch base:
`e802c7b4b758fa904f6085fdf0de733a08c537ff`.

## Changes

- Own each Sanctuary-to-Hub transition explicitly. Reset on scene initialization
  and shutdown, deduplicate taps, cancel stale callbacks, and use an independent
  fade watchdog. A failed load restores the view and allows retry.
- Restore missing loading UI idempotently, do not accumulate empty focus traps,
  ignore stale Hub loading callbacks, and preserve UI on cancelled/cached exits.
- Keep trusted-gesture recovery available across interruptions. Resume both audio
  contexts inside that gesture, inspect their actual states, contain rejections,
  and synchronize Phaser mute with the player's existing preference.
- Suspend both contexts when hidden/page-hidden. Returning does not force a new
  unmute; muted players stay muted. Remove owned listeners during destruction.
- No microphone permission, recording, new sound asset or audio provider added.

## Verification

- Focused initial repair: 5 suites / 64 tests passed.
- Final complete Jest run: 265 suites / 2,580 tests passed.
- Direct production Vite build passed. Existing large-chunk advisory remains.
- `git diff --check` passed.
- Built-game browser candidate passed at 390x844 and 1280x720. Each performs four
  real Explore entries: Hub/back, Forest/return, Forest/return, Caves/return.
  The final entry deliberately removes the loading overlay to verify recovery.
- Real pointer/keyboard controls are used, with correct camera projection and a
  100ms keyboard press. Prior-progress and player positioning are explicit local
  fixtures, not claims of full campaign completion or new-player usability.
- Both real Web Audio contexts recover from separate and simultaneous suspensions;
  both clocks advance. The actual intro soundtrack decodes (284.72s at 48kHz) and
  its silent playback advances. This does not certify physical iPhone audibility.
- Passing phone/desktop cases have zero console/page errors, HTTP errors and
  outside requests. No hosted generation or production data writes.

All Chromium launches use `--mute-audio`. Game journeys remain muted; the audio
probe additionally sets all procedural volumes to zero and keeps Phaser muted.
Every run closes its browser and preview server in `finally`, including failures.

Before logs: `/private/tmp/mythical-hotfix-before.log` (includes the initial test
fixture correction) and `/private/tmp/mythical-hotfix-gate-before.log`.
Final tests/build: `/private/tmp/mythical-hotfix-final-tests.log` and
`/private/tmp/mythical-hotfix-final-build.log`.

Browser diagnostics remain under `.visual-review/explore-audio*` in this worktree.
The first failed browser run used unprojected coordinates; the next desktop input
was too short for frame-polled Space; a later film probe mistakenly used the local
preview route that intentionally skips the home screen. These harness failures
were corrected, not hidden or treated as product approval.

Repeatable commands (from this worktree):

```sh
npx jest --runInBand --silent
npx vite build
MYTHICAL_VOID_AUTOMATION_AUDIO=0 SMOKE_HARDWARE_ACCELERATED_CAPTURE=1 HOTFIX_EVIDENCE=.visual-review/explore-audio-final node scripts/smoke-explore-audio-hotfix.cjs
```

## Device and release boundary

After an authorized deployment, Kevin should test the actual iPhone browser or
Home Screen app: enter Explore, return, repeat three times, enter an unlocked
later level, then background/lock and return. With Sound enabled and volume above
zero, tap once and check both music and effects. Also check Sound off remains off.
Do not clear his save or request a new game to test the repair.

iOS can interrupt Web Audio and require a resume. This is documented by
[MDN](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state).
The implementation uses the installed Phaser 3.90 sound manager's context and
unlock lifecycle, not a new audio engine. Chromium emulation cannot prove iOS
hardware routing, silent mode/Bluetooth behavior, or subjective sound quality.

The broader private closeout and pending story-film changes stay on
`codex/regional-victory-summary`; they are not part of this emergency candidate.
