# Forest Combat Active Time

Date: 20/10/2026. Private component repair, not release or migration approval.

## Evidence And Scope

Parent: qualified Rootwake source `09b67c0d3004765591cac2c3399508f90e680171`.
Eight native regressions first ran before runtime changes. Seven failed and one
ordinary-duration control passed. The four actual authored attack methods lost
their hazards immediately after a long menu. The 400ms boss-hit interval expired
behind that menu, and direct paused damage could consume a boss opening.
The spore test also failed on its missing post-menu hazard, so the initial red
run does not independently isolate its repeat-hit interval from hazard lifetime.
Those outputs remain in the chat, not a separately sealed red log.

## Implementation

`ForestCombatTime` is a runtime-only native TimerEvent window. It captures the
source Clock, World, Systems, events, scene plugin, tween manager, boss/player
bodies and phase. It does not replace Phaser's timebase or change saved data.

- Hazard lifetime and its 1000ms repeat-hit interval use separate native windows.
- The accepted boss-hit interval retains its existing 400ms active duration.
- Paused, dead, disabled, inactive, returning or completing actors cannot consume
  a boss opening or hazard hit.
- Hazard cleanup retires its own windows and stops its captured tween manager,
  not a replacement manager. Phase/victory/shutdown pacing cleanup retires the
  owned boss cooldown and all hazard windows.
- Actor destruction and shutdown release native windows and their listeners.
  Unrelated timers are left intact.
- Required timer failures remain errors, cannot consume health/hit accounting,
  and release their listeners. A failed lifetime setup destroys the unregistered
  graphic. A failed hit setup can retry without silently spending the hit.

The old `expiresAt`, `nextHitAt` and `forestBossNextHitAt` fields remain diagnostic
only. They are not timing gates. Reduced-motion, Rootwake, terrain, sprites,
controls, health thresholds, damage arithmetic, per-opening cap, attack patterns,
warning/recovery durations, phase/victory methods, story choices, rewards and
the save/transaction implementations are unchanged.

Only five Forest methods change: addForestBossHazard, updateForestBossHazards,
destroyForestBossTelegraph, clearForestBossPacing and damageBoss. All four attack
bodies and executeBossAttack remain byte-identical to the qualified parent.

## Verification

The final focused run passed 7 suites and 253 tests. The new native suite has
38 cases covering four actual attack dispatches, their complete lifetimes,
short/long/repeated menus, three Clock rates, hit spacing, unplayable actors,
eleven replacement bindings, cleanup/destruction and required setup failures.

Existing unit fixtures now provide the timing dependency and source context.
Their old damage, health, phase, restoration, colour and idempotency assertions
remain. Tests that formerly advanced Clock.now now advance the native Clock;
the cooldown rejection fixture opens a native window rather than assigning a
diagnostic deadline. This is not a relaxation of damage or duration contracts.

Checks use synthetic actors, installed Clock/TweenManager/Arcade bodies and
native GameObject destruction without constructing a Phaser Game or renderer.
Graphics drawing, optional services and player-damage delivery are inert ports.
No browser, host audio, provider or real save runs. Full-suite/build results
belong to the external exact-clean-source qualification report.

## Baseline Plan Alignment And Remaining Work

This is a bounded addition to journey/input/level reliability in packages 1-3 of
GAMEPLAY_HARDENING_IMPLEMENTATION_2026-09-17.md. It is not completion of the
eight-package programme. Rootwake, Mountain, Reef and Aurora qualified parents
remain separate source-bound evidence; they do not establish a natural campaign
playthrough or universal pause safety.

Forest windup/unlock/phase callbacks, arbitrary optional presentation failures,
other hazards, camera/weather lifetimes and unrelated modals are not universally
source-bound by this component. Existing callback sequences are not rewritten.
Background-tab suspension, physical iOS/Android input, rendered appearance,
difficulty, full campaign and human acceptance remain unverified.

The media-template inventory/live delivery, agreed aggregate-measurement boundary,
performance measurements/budgets and human creative reviews retain their own
acceptance gates. No infrastructure, credential, hosting, DNS or backend-selection
work is duplicated here. The separate save pack is not redundantly rerun because
there is no save/identity/Fusion/media/backend contract change.

No browser smoke, full Netlify release pipeline, standalone secret scan, hosted
Google qualification or independent Operations adoption is claimed. Nothing is
pushed, merged, deployed or preview-activated. The protected fallback stays
prepared rather than activated by this workstream.
