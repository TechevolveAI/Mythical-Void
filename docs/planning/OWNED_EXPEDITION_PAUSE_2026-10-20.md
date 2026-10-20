# Owned Expedition Pause

Date: 20/10/2026. Private implementation, not release or migration approval.

## Reproduction

The shared expedition menu paused physics only. Its scene timers and tween
animations continued behind the menu, and Resume unconditionally resumed
physics, including a pause established before the menu opened. The initial
native-library regression had three failures and one passing control at parent
`35347ae79b3afaaf9211ab2831ad1d067daf4476` before runtime edits.

Further focused regressions exposed four optional-audio failures blocking
Resume, Exit, Power-ups or the item result. A tightened replacement-body check
also exposed a missing body-identity guard during component development.

## Component

`PlatformerPauseSession` captures runtime-only physics, clock, tween, scene,
player/body and control-visibility state. It is separate from the drawing code,
with no save, inventory, identity, provider or backend dependency.

- Menu opening freezes native TimerEvent progress and tween elapsed time.
- Tween rate is temporarily zero while its manager keeps its timebase current.
  A public update at zero rate before restoration prevents an unrendered short
  pause from being counted as tween progress after Resume. Native fake-Date
  tests cover both 200ms and 5s intervals without replacing `getDelta`.
- Existing clock and tween rates, manager pauses and hidden controls are
  preserved rather than reset to defaults.
- Native physics pause/resume requests during a menu are retained as intent.
  A camera completion cannot restart physics behind the menu, and its deferred
  resume request is honoured when the menu closes.
- Power-ups, Back and paging retain the same pause session. Captured old
  menu-view callbacks cannot spend an item, close or reroute a newer view.
- Shutdown, destruction and replacement retire old listeners without resuming
  another simulation. A temporary Scene pause/sleep defers owned restoration.
- A drawing or native restoration failure attempts all owned cleanup and
  preserves the required error. Optional button/item sound cannot block exit.
- Shared and six existing level update methods skip gameplay behind the menu,
  retaining the shared film-notice cleanup. No route geometry, artwork,
  authored attack pattern or item definition is changed.

The separate Trumptopus session menu and its encounter clock are not replaced.
Its inherited Power-ups view retains its existing path and gains view-bound
input checks and optional-sound isolation.

## Evidence

The focused run passed 12 suites and 495 tests. The new suite uses installed
Phaser Systems, Clock, World, TweenManager and Pan without constructing a Game
or renderer. Drawing/input/feedback are inert doubles. A synthetic cleanup
error after replacing Systems was corrected by restoring only the fixture's
original teardown context after its ownership assertions.

The combined full-suite/build result belongs to the exact-source private
qualification report, not an inference from the focused run. No browser, game,
host audio, provider call or real player record was used.

## Remaining Gates

This freezes native timer/tween progress and stops the covered gameplay update
paths. It does not replace Phaser's global timebase, freeze native camera
effects, suspend arbitrary wall-clock callbacks, or prove that every legacy
absolute `*Until`/`*At` combat window retains its remaining time after a pause.
Those windows require a separate source-bound audit and regression before
calling overall encounter pause timing complete. A shared pause registry for
every unrelated modal is not introduced here.

Physical iOS/Android input, background/return behaviour, rendered menu quality,
complete campaign playability and human judgement remain unverified. Passing
tests do not approve those outcomes. Do not push, merge, deploy, activate Google
or enable a preview from this document. Existing save formats, player/creature
IDs, Fusion, media, backend and migration contracts remain unchanged.
