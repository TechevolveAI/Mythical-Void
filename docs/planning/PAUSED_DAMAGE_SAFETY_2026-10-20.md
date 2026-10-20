# Paused Damage Safety

Date: 20/10/2026. Private follow-up to the Guardian transition repair, not a
release or migration change.

## Evidence

The shared `takeDamage` boundary previously rejected only dead/completed play
and ordinary invincibility. Pausing physics does not pause Phaser tweens, so a
Crystal Guardian ground-slam impact could still remove a heart behind the
pause menu. Guard charges could also be consumed without losing health.

`onPitFall` directly subtracts health rather than using `takeDamage`. A late
fall update could therefore charge a heart behind paused, dead or completed
play. An existing recovery prevented a second fall, but did not reject another
ordinary impact before the respawn finished.

Before runtime edits, the targeted run reported 18 failures and 35 passing
controls. That includes an actual installed TweenManager ground-slam impact
using the shared health method, with a normal unpaused impact as its control.
Drawing, feedback and input remain inert doubles; no Game or browser opens.

## Repair

Both damage boundaries now reject a pause menu, paused physics, paused clock,
inactive scene or existing checkpoint recovery before health, guard charges,
feedback or new recovery work changes. Dead/completed play also rejects direct
pit charges. Invincibility bypass does not bypass a pause.

Ordinary play retains its health costs, guard effects, forced-damage behaviour,
lethal-fall recovery and 300ms non-lethal respawn. No item definition, authored
damage amount, attack speed or saved field changes.

## Limits

This is a damage/cost safety boundary, not a claim that every animation, timer
or absolute-time hazard freezes behind the menu. Existing attack presentation
can still advance; a broader pause-session timing change requires a separate
bounded repair and review. It does not establish physical-phone acceptance,
rendered quality, a complete campaign run or immunity to arbitrary external
mutation of scene fields.

Focused checks and the production compile are recorded against the exact local
commit in a separate private report. Full integration/release checks and adult
review remain required before promotion. Saves, identity, Fusion, media and
backend/migration contracts are unchanged. No provider calls, real records,
game/browser/audio launch, infrastructure action, push, merge or deploy occurs.
