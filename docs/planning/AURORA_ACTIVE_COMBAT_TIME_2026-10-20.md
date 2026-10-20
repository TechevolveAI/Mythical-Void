# Aurora Active Combat Time

Date: 20/10/2026. Private repair, not release or migration approval.

## Evidence

The clean-parent probe at `c3e461b09fd00993a6ed064c332478475c098212` used the
actual Aurora damage calculation, installed native Clock and real pause
component. A native timer retained 650ms after a 5000ms menu, but damage fell
from two to one because the absolute recovery deadline had expired. Its report
remains acceptance:false and is not counted as a passing regression.

New source-bound tests then exercised the actual attack and phase methods.
After correcting a missing inert level-entry cleanup callback, the pre-runtime
run had five genuine failures and one passing ordinary-duration control.
Failures covered short/long menus, both phase recoveries and spending a route
charge behind a menu. Later tests on uncommitted component code exposed
optional phase-presentation failures and a required phase-timer failure leaving
an attack lock. These are not misattributed as a second clean-parent red run.

## Bounded Repair

`PhoenixCombatTime` owns a runtime-only native recovery timer and captures its
source scene, engine objects, actors/bodies, phase and attack lifetime. It does
not modify Phaser's timebase, save formats or any provider contract.

- Attack and phase recovery retain native remaining time through menus.
- Windup, resolution, unlock and phase callbacks reject a replaced source,
  actor, body, engine context, phase or attack rather than controlling a successor.
- Shutdown, reinitialisation, phase cleanup and destruction retire the owned
  window. Cancelled expiries cannot clear a newer window or unrelated timers.
- Paused, dead, inactive or disabled actors cannot spend boss health or a route
  charge. Non-positive and non-finite damage is rejected.
- The real route-charge method still adds two damage once and requests its
  existing route-state refresh. No storage writer or format is replaced.
- Required native timer failures remain errors and clean up owned attack or
  phase locks. Optional text, camera, graphics, hit feedback or sound failures
  cannot prevent the mandatory recovery sequence.
- The existing 100ms hit tint clears on the same boss's next attack, but cannot
  clear the colour of a newer phase or replacement actor.

The authored five attacks, 700ms windup, per-attack active durations, 650ms
recovery, 1300ms phase transition, health thresholds, AI cadence values, damage
and route rewards are unchanged. Scenery, artwork, terrain, level layout and
the victory/save-handoff implementation are unchanged.

The smoke recovery predicate now reads native remaining time. Its isolated
route-charge fixture uses native physical actors instead of a body-less object;
the original three-then-one damage and consumed-charge assertions remain.
An offline extraction executes that body with native actors and an inert
checkpoint port. This does not prove browser behaviour or real checkpoint writes.

## Verification

The final focused run passed six suites and 268 tests. The new Aurora suite has
55 cases covering all five actual dispatch paths, both phases, short/long and
repeated menus, a non-default clock rate, charge consumption, stale callbacks,
replacement contexts, destruction, shutdown, failure cleanup and hit tint.
Separate focused completion transaction and draft suites also passed; the
combined earlier eight-suite run still had one new fixture-shape failure and
is not relabelled as entirely green. Full-suite/build results belong to the
exact-source qualification report.

Fixture-only corrections retained the original assertions: the missing inert
entry-cleanup callback, a checkpoint getter returning its proper object shape,
and fault injection targeting the required 700ms/3250ms timers instead of the
optional instruction-expiry timer. Original Systems/events are restored only
for native teardown after replacement-context assertions.

All checks use synthetic data, a stripped environment and the network-denial
guard. Installed Clock, World, bodies, timers, tweens and GameObject destruction
run without constructing a Phaser Game, renderer, browser or host audio.
Drawing, optional services and persistence boundaries are inert.

## Remaining Gates

Forest hazard lifetimes, hit spacing and the Rootwake absolute completion
fallback remain separate source-audit leads, not qualified repairs. This is not
a universal pause registry or a rewrite of all Aurora hazard/tween lifetimes.
Native camera effects, unrelated wall-clock callbacks and legacy composite
smokes that assign diagnostic deadlines remain outside the qualified scope.
Trumptopus and the retained legacy Empress route are not changed here.

Physical iOS/Android controls, background/return, rendered UX, difficulty, full
campaign and human acceptance remain unverified. No browser smoke, provider,
real player, full Netlify release pipeline, standalone secret scan or hosted
migration qualification is claimed. Saves, identity, Fusion, media and backend
implementations/contracts remain unchanged; the separate save pack is not
redundantly rerun. Nothing is pushed, merged, deployed or preview-activated.
The protected fallback and Google migration remain inactive in this workstream.
