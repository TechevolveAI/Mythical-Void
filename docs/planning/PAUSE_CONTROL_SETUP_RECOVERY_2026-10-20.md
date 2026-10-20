# Pause control setup recovery

Private repair, 20/10/2026. Parent:
`39546c74da3e1f112daf5d68c2addce99cdfa40a`.

## Finding and reproduction

`PlatformerLevelScene.showPauseMenu` paused the world, clock and tween progress,
then called `hidePlatformerMobileControls` outside its recovery handler. A
control visibility/reset exception could leave `pauseMenuActive` true and the
simulation frozen before a usable menu existed.

An isolated review also found that a control-hide callback replacing the pause
owner could allow the old opener to draw over the replacement or retain its
listeners. These are fault-injection reproductions, not confirmation that this
was the cause of a particular production joystick report.

Ten added cases failed before the repair while the existing 51 pause cases
passed. Eight cases use the actual mobile hide/show methods and native Phaser
Clock, World, TweenManager and Systems, with a synthetic one-shot display error.
They cover all eight prior paused-state combinations and a non-default tween
rate. Two cases use an explicit synthetic replacement menu, with and without an
exception, to exercise ownership and listener cleanup.

## Bounded repair

Only `showPauseMenu` changes at runtime:

- Include mobile-control hiding in the existing setup recovery handler.
- Stop drawing if hiding retired or replaced the opening pause owner.
- Clear UI and restore simulation only while that original owner remains current.
- Retire stale listeners without clearing, resuming or redrawing the successor.
- Keep the original required setup error visible.

Existing pause ownership, combat, damage, rewards, controls, timers and save
formats are unchanged. No new gameplay or presentation design is introduced.

## Verification

Six focused suites / 165 tests passed, covering the shared pause, paused damage,
control lifecycle, Guardian transitions, power-ups and film scene ownership.
A complete candidate suite and fresh private frontend packaging are recorded
separately in this chat's `review-evidence-2026-10-20` directory after the commit.
Earlier frontend artifacts identify their own source and are not the repaired
runtime. The function-packaging evidence remains applicable only because the
server sources and backend contracts are byte-identical to the parent.

No game, browser, audio, provider, player-record, hosting or migration session
was started. No push, merge, deployment or fallback activation is authorised here.
This scoped code review is not independent acceptance of the whole aggregate
candidate. Physical-phone interaction, film decoding, adult visual review,
security scanning and the protected release process remain separate gates.

For eventual approved phone review: open and close the menu while moving and
holding an action, use Power-ups and Back, resume after a film, and repeat after
death and level re-entry. Check that movement continues, controls return, no
attack happens behind the menu, and Return to Sanctuary still works.
