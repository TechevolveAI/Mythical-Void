# Forest Rootwake Active Time

Date: 20/10/2026. Private repair, not release or migration approval.

## Reproduced Fault

The earlier failed probe at `83d051cf` called the real Forest update method
but replaced its completion boundary with a counter. It is not evidence for
the authored reveal, collision changes or persistence.

This repair starts from qualified parent
`12742583357020296104fc9327d3303290fafe1a`. Six new tests first reproduced
the fault using the actual authored reveal and update methods, installed
Phaser Clock, TweenManager, Arcade World and bodies, and the real
PlatformerPauseSession. Drawing, optional services and save ports are inert.
All six failed before runtime changes. A short menu shortened the remaining
reveal; long menus immediately completed it on resume. The native timer and
visual progress had remained frozen. Those failures are recorded in the chat
execution output, not a separate sealed red log.

## Bounded Repair

An independent callback-free native TimerEvent now tracks the existing 1750ms
of active reveal time. The original one-shot completion timer remains separate.
The update fallback reads the independent timer, not the absolute Clock.now
deadline. Cancelling the primary timer or dropping its callback therefore
cannot remove the fallback, while a menu cannot spend its remaining duration.
The old absolute deadline is retained only as diagnostic information.

The timer is runtime-only and removed by existing sequence cleanup. Completion
and platform callbacks require the captured Clock and reveal timer, so callbacks
from an earlier reveal cannot finish a restarted crossing. A paused Clock also
blocks activation and completion. No global Phaser timebase is modified.

The watchdog is created before activation mutates the crossing or destroys its
trigger. A required setup failure stays an error and leaves a retryable dormant
crossing. If primary completion-timer setup fails later, the error is still
visible and the independent active-time fallback can finish the route.

Reduced-motion completion remains immediate, with neither timer nor animation.
Previously awakened saves still restore the same five surfaces without replay
or another write. The saved payload, version, action, phenomenon, world-change
keys, creature-power event and save-call implementation are unchanged.

Only three Forest runtime methods change: updateRootwakeCrossing,
awakenRootwakeCrossing and clearRootwakeSequence. Geometry, authored platform
tops, lower recovery branch, visual design, animation durations, trigger range,
controls, objectives, rewards and media are unchanged.

## Verification

Eleven new native cases cover short/long and repeated menus, three clock rates,
cancelled primary timers, dropped callbacks, cancelled tweens, required setup
failures, restarted-crossing callbacks and replacement Clocks. Existing physical
approach and bidirectional route tests retain all cadence and body-width checks.
The prior mock fallback contract now advances explicit active timer progress,
not wall time; its exact saved-payload and once-only assertions remain.

The focused run passed 3 suites and 136 tests. Full-suite/build results belong
to the exact clean commit's external qualification report, not this source note.
Checks use synthetic data, a stripped environment and the existing network-denial
guard. No Phaser Game, renderer, browser, host audio, provider or real save is run.

## Remaining Limits

This repairs only Rootwake reveal timing. It does not qualify every Forest
hazard, immunity period, AI callback, camera effect, real-time weather or other
modal. Background-tab suspension, physical iOS/Android input, rendered appearance,
full campaign, difficulty and human acceptance remain unverified. Cancelling all
native scene timers, including the independent watchdog, is outside this repair.

No save schema, identity, Fusion, media/provider, backend or migration contract
changes. No full Netlify release pipeline, standalone secret scan, browser smoke
or hosted Google qualification. The separate save pack is not redundantly rerun.
No push, merge, deployment, preview or protected-fallback activation.
