# Held joystick and missing music incident

Baseline investigated: production/main `d6a8c168f9b2ae869731cdd24fc885b6fc6beb4c`.
Scope: three reproduced input/audio/animation defects; no save, backend, level, artwork,
economy, generation or broader unfinished feature changes.

## What is established

`MobileControls.handleResize()` rebuilt the entire control dock for every Phaser
resize notification. `hide()` called `cleanupEventHandlers()`, which called
`resetJoystick(true)`. That released ownership and sent a zero movement vector
while the player was still holding their finger down. Subsequent moves correctly
do not acquire a new finger, so motion could not restart until another touch.

Phaser 3.90 `ScaleManager.refresh()` emits its resize event even when width and
height have not changed. In the built game, a held native touch followed by one
refresh reproduced snap-back in all four directions on both the iOS-specific
Touch Events path and the Android Pointer Events path. Changing the viewport
height also reproduced it. Stable holds without either event worked.

The unconditional control rebuild predates the last gate/audio release. The
previous gate smoke used touch taps without an iPhone user agent or a held drag
crossing a viewport event. It therefore could not establish uninterrupted iPhone
movement. Passing those checks was insufficient release coverage.

This proves a failure mechanism, NOT the exact event that occurred on Kevin's
physical phone. An attempted page-offset-only reproduction did not fail and is
not claimed as a cause. Chromium with an iPhone user agent exercises our iOS
handler but is not WebKit or a physical iPhone test.

Separately, `AudioManager.playAreaMusic()` remembers the requested area but does
not create music nodes while the page is hidden. `resume()` restarted audio
contexts without starting that deferred soundtrack. A deterministic regression
failed before repair: the audio context was running, but music was not playing.
The sound preference being on is not evidence that a soundtrack is playing.
This does not yet establish the physical phone's entire no-sound cause.

The extended repeated-gate journey also exposed a separate movement conflict.
`GameScene` attaches `CreatureAnimationController` to the physics-controlled
player. Its idle bounce/wiggle/sniff tweens wrote absolute world coordinates
captured before the player moved. Instrumenting the built player's position
recorded a Phaser tween moving it from y=1645 back to y=880, away from Explore.
This was not residual joystick input: its vector and body velocity were zero.
The existing controller tests used a hand-copied subset rather than its actual
animation implementation and did not cover this conflict.

## Narrow repair

- Ignore duplicate layout notifications, including unchanged safe-area insets.
- Keep an active drag through same-width, same-orientation height changes; reflow
  after release. Width/orientation changes, cancel, blur, hide and scene teardown
  still release input, preventing an involuntary stuck direction.
- After audio recovery, start a current deferred soundtrack exactly once. Do not
  restart a playing track, resurrect a departed scene, or override mute.
- Express cosmetic positional motion as small scale changes on physics-backed
  creatures. Keep world movement for non-physics display sprites. Test the real
  controller's 17 behaviors and completion callbacks against position ownership.
- Add a separate CI job for held touch, audio recovery and repeated Explore
  journeys. Existing release checks remain unchanged.

## Evidence and limits

Private before-repair traces: `.visual-review/held-touch-refresh.json` and
`.visual-review/held-touch-height.json`. Focused red tests:
`/private/tmp/mythical-held-touch-red.log`.

The expanded smoke uses real browser touch/pointer input, tests refresh and
height changes in four directions, verifies actual player displacement and zero
movement on release, and repeats Explore/return four times for each mobile path
and desktop. Actor positions and prior progress are explicit local fixtures.
It checks two real audio clocks, decoded intro music with zero-output playback,
and deferred music after simulated hidden state. No generation providers or
production saves are contacted.

An initial combined run encountered the saved Forest victory's normal resident
arrival cinematic. Its trace showed `playRescuedResidentArrival -> suspend`, an
intentional input pause. The harness now waits for that real scene to finish;
the production cinematic was not disabled or changed.

The first CI run also demonstrated that the daily greeting can arrive later than
the smoke's one-off check. The harness now observes the onboarding queue, taps
the real greeting button when present, and awaits normal gameplay. It does not
suppress or skip production state. Every gate visit explicitly runs a real
creature reaction before moving the actor, then checks that it remains nearby.

Animation pre-fix evidence: `.visual-review/gate-physics-axes/result.json` and
`/private/tmp/mythical-animation-ownership-red.log` (nine failing behaviors).

Repeat from the exact candidate checkout:

```sh
npx jest --runInBand --silent
npx vite build
MYTHICAL_VOID_AUTOMATION_AUDIO=0 SMOKE_HARDWARE_ACCELERATED_CAPTURE=1 HOTFIX_EVIDENCE=.visual-review/held-touch-final node scripts/smoke-explore-audio-hotfix.cjs
```

All automation is host-muted and closes its owned browser/server in `finally`.
Release must retain exact source/build evidence and passing existing gates.
Do not call physical iPhone audio or the reported incident resolved solely from
these checks. On-device acceptance: hold each direction, move while browser bars
change, release, open Explore and return three times, then background/return and
verify both music and an effect with Sound enabled. Keep the existing save.
