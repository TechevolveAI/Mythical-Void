# Trumptopus: private implementation

Status: implementation started, not release-ready. Production retains the existing Final Void encounter. No push or deployment is part of this work.

## Confirmed creative direction

- Name: Trumptopus. Keep the red cap and "Make the Void great again" slogan.
- He is a villain. Defeat banishes him into the Void; he is not healed or recruited.
- Distinct combat idea: his limbs hold the world apart. Dodge a committed grab, strike the exposed joint, and cross the route it releases. Three escalating phases, normal game controls, fair checkpoints and visible consequence.
- The astronaut and the player's own creature remain the heroes. Recover Nova and the Command Module, show one useful reward summary, then offer Repair the ship into the existing ending. No surprise second boss or erased prior progress.
- Main films are generated and reviewed before release, downloaded before their cues and played through Watch. Optional current-creature recovery insert must not become a dependency.

## Implementation sequence

1. Implemented privately: bounded shared-film download/player, exact media manifest, human-review release gate, isolated real-video proof. No art substituted for the new boss.
2. Pending: approve references and generation spend; produce arrival, banishment and world-recovery shots; edit two coherent films and review on phone/desktop. Add exact hashes and provenance, not placeholder URLs.
3. Implemented privately: one real-input grab/dodge/strike exchange with temporary greybox limb geometry. Phone-sized character identity/art review and human playability review remain pending before expanding the encounter. Keep the legacy encounter available.
4. Pending: complete the route and phases, preserve historical Empress records, connect the new outcome to existing campaign/reward/ship-repair flow, then bind the prepared films to actual story cues.
5. Pending: one optional generated shot of the current creature, identity/stage match, server-enforced cost/deduplication controls and owned-media delivery. No personal information in provider inputs.
6. Pending: real campaign Watch/skip/replay/ending checks, save compatibility, human creative/playability review and separate protected release approval.

## First slice boundaries

`PreparedFilm` accepts only explicit game-hosted MP4 assets with exact bytes/digest/duration. It verifies the bounded response and decodes before reporting prepared; Watch waits for progressing frames rather than only a resolved play promise. Preparation never plays media. It owns no save/account/generation logic and uses session-only data, so denied persistent storage is not a dependency.

`PreparedFilmPlayer` provides Watch, pause/resume, replay and Continue. It pauses only its owned Phaser scene, clears held platformer actions and avoids resuming a destroyed or previously paused scene. Current proof playback is muted; authored sound mixing is still pending, not claimed complete.

`FinaleFilms` is the future encounter's scene-owned adapter, not yet wired into legacy gameplay. Its manifest is disabled, with both new films explicitly unapproved and absent. The legacy Empress cannot receive a Trumptopus film accidentally. Normal builds reject an enabled incomplete manifest; the stricter final-film gate requires both actual approved films even while disabled.

The private playback smoke uses the existing Forest MP4 as an engineering fixture. It is NOT the new final-boss footage, a generated Trumptopus result or proof of the finished campaign journey. It exercises the real player modules beside a real Phaser scene at 390x844 and 1280x720, verifies visible frames and layout, pauses/resumes, finishes and replays offline after preparation, and checks that Continue restores the scene. It uses a headless browser with --mute-audio, noAudio Phaser and cleanup in finally.

Editable production shot prompts are in `scripts/cinematics/final-void-shots.json`. The existing studio generation command recognizes `finalVoidArrival`, `finalVoidBanishment` and `finalVoidRecovery`; it refuses them before any provider call while source/budget approval is pending. These are shared editorial films, not additions to the restricted player-creature provider contract. Shot output still needs editing and human review before it can become a playable-film manifest entry.

## Commands and review boundary

- Focused module checks: `npm test -- --runTestsByPath src/__tests__/PreparedFilm.test.js scripts/__tests__/FinalVoidFilms.test.js`.
- Private silent browser proof: `npm run smoke:prepared-film`. Evidence: `.visual-review/trumptopus-prepared-films/`.
- Normal build safety: `npm run validate:final-void-films`.
- Final media release gate: `npm run gate:final-void-films`. This deliberately fails until the approved films exist. A passing unit test or fallback never overrides it.

No user saves, creature genetics, Rootwake, previous level routes, cloud infrastructure, production assets or provider settings have been changed in this slice. Broader design discussion and editable shot prose remain in the private review workspace pending production reference approval.

## One-exchange mechanics prototype

`TrumptopusEncounter` owns a deterministic warning, committed strike, ground contact, exposed joint, recoil and route-release sequence. The warning lasts 1.2 seconds and locks the target instead of chasing the player. Only physical contact during the strike's contact beat causes damage, once per grab. The joint accepts normal attacks only while exposed for 2.6 seconds. Two ordinary shots, or one katana strike, break this single grip. Those are prototype tuning values, not final boss difficulty or total health. Missed opportunities recover and repeat without resetting damage already earned.

`src/dev/TrumptopusPrototypeLevel.js` is a standalone private adapter, deliberately absent from the production scene loader. It reuses the real platformer movement, touch controls, projectiles, katana action, existing creature renderer and ExpeditionAstronaut. It does not run the campaign boot, checkpoint/reward/completion flows, generation service or cloud code. A read-only existing identity fixture is used at the same stage on phone and desktop. It is not a new creature design.

The current limb and blocking stone are mechanics greyboxes. The stone's visible position and collision body move together when released. The floor stays solid. The supporting astronaut holds the safe side during the grab and rejoins after it. Pause/blur freezes the attack, physics, animation and timers; retry resets the exchange. The model cannot attack after teardown. No persistent progress is written.

The final Trumptopus body, red cap/slogan, three-phase arena, banishment, authored audio, completed films, campaign ending and film-cue integration are NOT implemented or proven by this prototype. The red cap and slogan remain required for the later approved character artwork. Current production still uses the existing Empress encounter. This proof must not be used as marketing art or presented as a finished boss.

- Focused logic/input checks: `npm test -- --runTestsByPath src/__tests__/TrumptopusEncounter.test.js src/__tests__/MobileInputLifecycle.test.js src/__tests__/MobileControlPointerRegression.test.js`.
- Silent real-input proof: `npm run smoke:trumptopus-grip`. Runs a temporary local server and headless Chrome with `--mute-audio`; both are closed in cleanup. The canvas recording has no audio track.
- Private evidence: `.visual-review/trumptopus-grip/`. Phone uses real touch joystick, katana and jump. Desktop uses keyboard movement, colliding ranged projectiles and jump. Each intentionally takes one hit, retries, pauses, dodges, counters and crosses the released obstruction. Storage writes throw and the identity is compared before/after.
- Engineering evidence does not establish fun, fairness for a first-time child, finished art quality, physical-device performance or campaign completion. Review this one exchange before authoring more phases. Paid generation remains gated on reference and budget approval.

### Exchange verification, 2026-09-21

- Full Jest: 247 suites / 2,415 tests passed, including 20 new exchange tests.
- Production Vite build passed with the existing browser-data/chunk-size warnings. The private encounter and scene are absent from the shipped JavaScript.
- Both 390x844 touch and 1280x720 keyboard Chrome journeys passed. The same existing juvenile identity appears in both. The recordings capture only the canvas: 390x802 and 1280x678, excluding the 42px private-harness toolbar.
- Verified committed target, one collision hit, retry, frozen pause, successful dodge, existing katana/projectile damage, safe supporting-astronaut position, physically cleared obstruction, ground contact, jump and shutdown. Zero observed browser errors, external service requests or writes to fixture/persistent progress.
- Silent canvas clips and ten-frame review sheets are in the private evidence directory. All automated audio remained disabled; owned browser and server were closed.
- Obvious-fault review: the mechanics are demonstrable, but the greybox is not a finished character, world or finale. No human visual/playability approval, iPhone/Samsung physical-device signoff, final audio or complete campaign/video outcome is claimed.

## Private verification, 2026-09-21

- Focused checks: 29 passing across PreparedFilm, FinalVoidFilms and existing CinematicMediaContract suites.
- Full Jest suite: see `.visual-review/trumptopus-prepared-films/jest-results.json` for the final run.
- Production Vite build passed. Existing stale browser-data and large-chunk warnings remain; no dependency upgrades were mixed into this change.
- Headless Chrome phone viewport 390x844: Watch-to-visible-frame 105 ms; desktop viewport 1280x720: 85 ms. One local sample each, not p95 or physical-device measurements.
- Both journeys showed nonblank progressing video, completed/replayed after going offline, used one film download and zero generation calls, and restored the paused Phaser scene with no browser errors. Screenshots and exact media digest are in the private report directory.
- New-final-film release gate deliberately rejects both missing reviewed films. No final-boss art, campaign integration, personalized insert or real-phone signoff is claimed.
- Owned browser and local proof server were closed. No host audio was used.
