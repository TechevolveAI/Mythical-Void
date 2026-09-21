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
3. Pending: private real-input grab/dodge/strike prototype and phone-sized identity review before expanding the encounter. Keep the legacy encounter available.
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

## Private verification, 2026-09-21

- Focused checks: 29 passing across PreparedFilm, FinalVoidFilms and existing CinematicMediaContract suites.
- Full Jest suite: see `.visual-review/trumptopus-prepared-films/jest-results.json` for the final run.
- Production Vite build passed. Existing stale browser-data and large-chunk warnings remain; no dependency upgrades were mixed into this change.
- Headless Chrome phone viewport 390x844: Watch-to-visible-frame 105 ms; desktop viewport 1280x720: 85 ms. One local sample each, not p95 or physical-device measurements.
- Both journeys showed nonblank progressing video, completed/replayed after going offline, used one film download and zero generation calls, and restored the paused Phaser scene with no browser errors. Screenshots and exact media digest are in the private report directory.
- New-final-film release gate deliberately rejects both missing reviewed films. No final-boss art, campaign integration, personalized insert or real-phone signoff is claimed.
- Owned browser and local proof server were closed. No host audio was used.
