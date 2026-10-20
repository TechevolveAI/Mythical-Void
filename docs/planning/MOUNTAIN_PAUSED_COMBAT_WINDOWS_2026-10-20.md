# Mountain Combat Time

Date: 20/10/2026. Private repair, not release or migration acceptance.

## Evidence

At `3fa6aaaf0ea966d3a2d135ccac89dc30db2c1a1e`, the installed native Clock
retained 2000ms on a paused TimerEvent while Clock.now advanced to 7000.
The actual Mountain damage method accepted a hit before the pause and rejected
it afterwards because its absolute recovery deadline was 4000. The external
counter-window report records acceptance:false, not a passing regression.

Seven new native-library regressions initially produced six failures and one
passing duration control before the boss implementation changed. They showed
lost counter time, a prematurely spent hit cooldown, a direct hit behind the
menu and a new attack starting during the retained counter opportunity.

The earlier combined run at `3fa6aaaf` stopped with 377 passing suites and one
failing suite, totalling 6112 passing tests and one failing test. Its failed
assertion expected control restoration text inside the old scene method.
Private test-only commit `4aa19b5f` replaces that assertion with execution of
the actual menu close and pause component, testing both previously visible
and previously hidden touch controls. Other input checks remain intact.

## Repair

- The existing source-bound Mountain timer owner now exposes its own current
  context check for pending native TimerEvents.
- The counter opportunity and hit cooldown use remaining native timer time,
  not Clock.now subtraction. Diagnostic Until/At fields remain available but
  no longer decide whether a Mountain hit or new attack is allowed.
- Pause, death, completion and inactive scenes reject direct damage calls.
- Phase, death, encounter cleanup and shutdown retire the two owned timers.
  Replaced actors, bodies, clock, events, world or encounter cannot inherit a
  previous counter. A required cooldown setup failure leaves health unchanged.
- Offline smoke predicates now inspect the same native opportunity, retaining
  the existing 250ms handoff margin and rejecting cooldown or paused play.
  Browser smoke scripts were edited and syntax-checked, not executed.

The authored 700ms windup, 1800ms recovery, 350ms hit spacing, four-damage
opening cap, 24 health, six-opening victory requirement, phase transition and
attack selection remain unchanged. Native joined combat/entrance tests still
exercise the real attack, phase and saved-victory handoff paths. No terrain,
artwork, controls layout, save format, identity, Fusion, media or backend
implementation changes are included.

## Verification And Limits

The focused run passed 11 suites and 243 tests with the network-denial guard
and a stripped environment. Installed native Clock, World, bodies, timers and
tweens run without constructing a Phaser Game or renderer. Drawing, optional
feedback and save boundaries are synthetic. The new window suite has 19
cases, including the unchanged duration, repeated pauses, ownership changes,
death/retry and required timer-setup failure.

Complete-suite and direct production-build outcomes belong to the exact-source
qualification report, not this focused count. The failed earlier full run and
failed counter probe remain preserved separately.

Other levels' absolute combat deadlines, native camera effects and unrelated
wall-clock callbacks still need their own bounded review. This is not a
universal pause registry or engine timebase replacement. Physical phones,
background/return, human visual/difficulty judgement, full campaign play and
hosted migration acceptance remain unverified. No browser, game, host audio,
provider call, real record, push, merge, preview, deployment or cloud change
was made for this repair. The protected fallback remains inactive.
