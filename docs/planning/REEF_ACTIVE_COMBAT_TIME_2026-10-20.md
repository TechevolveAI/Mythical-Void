# Reef Active Combat Time

Date: 20/10/2026. Private repair, not release or migration approval.

## Reproduction

At parent `00fd7afca467a57bea8358db6769bb681b38a787`, the Reef recovery bonus
and phase-spacing guard used absolute Clock.now deadlines. A paused native
Clock retains TimerEvent elapsed time but still receives a new frame timestamp.
Consequently a menu could remove an earned bonus or consume the remaining
grace between phase changes.

Seven native-library regressions ran against unchanged runtime source after
correcting a missing synthetic control-restoration callback. Six behaviour
checks failed and one ordinary-duration control passed. The failures covered
200ms/5000ms menus, lost phase grace, a shortened reopened window, and direct
damage behind the menu. The earlier fixture callback error is not counted as
runtime evidence.

## Bounded Repair

The existing ReefGuardianControl now owns two additional native timer slots:
recovery and phase grace. A remaining-time query verifies the same controller,
slot alias, clock, world, events, Systems, physical bodies and phase. Reopening
a recovery keeps the greater of its native remaining time and the new duration.
An expiry from a cancelled timer cannot clear a replacement slot.

The Reef uses these native durations for bonus damage, attack blocking,
phase deferral and phase spacing. The old absolute fields remain diagnostic
only. Phase entry cancels the previous windows; existing controller retirement
cleans their timers on shutdown or encounter retirement. The authored 850ms
default recovery, per-attack 700/750/800ms openings, 950ms phase transition and
1200ms phase spacing are unchanged. Recovery still adds exactly one damage.

Direct paused, inactive, dead or disabled-actor hits cannot spend boss health.
Non-finite and non-positive damage is rejected rather than increasing or
corrupting health. Optional recovery-cue failure cannot cancel the actual
opportunity; required native timer setup failure remains an error.

Only this controller and six Reef scene methods change at runtime. No scenery,
artwork, terrain, attack selection, health, route charge, inventory, save format,
identity, Fusion, media/provider or migration implementation changes are made.
The browser smoke recovery predicate now reads native remaining time; the smoke
script is syntax-checked only and was not run.

## Evidence And Limits

Focused verification passed 10 suites and 337 tests in a stripped environment
with the existing network-denial guard. The new suite has 27 cases and uses the
installed native Clock, World, bodies and TweenManager without creating a
Phaser Game, renderer, browser or host audio. Drawing, optional feedback and save
boundaries are synthetic. Existing joined victory/save-handoff and attack,
summon, rift, lunge and hit-feedback suites also pass.

A later replacement-Systems assertion passed but its synthetic teardown could
not destroy the original Clock through the replaced Systems object. Only the
fixture's original Systems/events are restored during cleanup, after ownership
assertions. This is not a runtime repair or evidence of physical device behaviour.

Complete-suite/build results belong to the exact-source qualification report.
Aurora recovery deadlines still need their own bounded investigation and repair.
Native camera effects, arbitrary wall callbacks and unrelated modals are not
universally frozen. The active finale is Trumptopus, whose separate encounter
clock/menu is not changed; the retained legacy Empress path is not qualified by
this work. One legacy composite smoke still writes absolute diagnostic fields
and is not claimed as proof of the new runtime.

Physical iOS/Android, browser visibility/return, rendered UX, difficulty, human
acceptance, full campaign and hosted migration remain unverified. No push,
merge, deployment, preview, provider call, real record, credential, cloud or
production change was performed. The protected fallback remains inactive.
