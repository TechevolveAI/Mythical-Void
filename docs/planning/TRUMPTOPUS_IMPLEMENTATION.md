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
3. Implemented privately: one real-input grab/dodge/strike exchange, then a three-phase mechanics preview under Kevin's subsequent instruction to continue the finale goal. These use temporary greybox limb geometry. No human character-art/playability approval is implied. The legacy encounter remains available and unchanged.
4. In progress: the separate antagonist outcome, atomic local reward receipt and compact result/ending adapter are connected to the real fight and existing campaign ending in a private harness. Complete the approach route and authored phase presentation, then bind the prepared films to actual story cues.
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

The final Trumptopus body, red cap/slogan, authored three-phase arena, finished banishment, authored audio, completed films, campaign ending and film-cue integration are NOT implemented or proven by this prototype. The red cap and slogan remain required for the later approved character artwork. Current production still uses the existing Empress encounter. This proof must not be used as marketing art or presented as a finished boss.

- Focused logic/input checks: `npm test -- --runTestsByPath src/__tests__/TrumptopusEncounter.test.js src/__tests__/MobileInputLifecycle.test.js src/__tests__/MobileControlPointerRegression.test.js`.
- Silent real-input proof: `npm run smoke:trumptopus-grip`. Runs a temporary local server and headless Chrome with `--mute-audio`; both are closed in cleanup. The canvas recording has no audio track.
- Private evidence: `.visual-review/trumptopus-grip/`. Phone uses real touch joystick, katana and jump. Desktop uses keyboard movement, colliding ranged projectiles and jump. Each intentionally takes one hit, retries, pauses, dodges, counters and crosses the released obstruction. Storage writes throw and the identity is compared before/after.
- Engineering evidence does not establish fun, fairness for a first-time child, finished art quality, physical-device performance or campaign completion. Human review remains required for the later complete encounter. Paid generation remains gated on reference and budget approval.

### Exchange verification, 2026-09-21

- Full Jest: 247 suites / 2,415 tests passed, including 20 new exchange tests.
- Production Vite build passed with the existing browser-data/chunk-size warnings. The private encounter and scene are absent from the shipped JavaScript.
- Both 390x844 touch and 1280x720 keyboard Chrome journeys passed. The same existing juvenile identity appears in both. The recordings capture only the canvas: 390x802 and 1280x678, excluding the 42px private-harness toolbar.
- Verified committed target, one collision hit, retry, frozen pause, successful dodge, existing katana/projectile damage, safe supporting-astronaut position, physically cleared obstruction, ground contact, jump and shutdown. Zero observed browser errors, external service requests or writes to fixture/persistent progress.
- Silent canvas clips and ten-frame review sheets are in the private evidence directory. All automated audio remained disabled; owned browser and server were closed.
- Obvious-fault review: the mechanics are demonstrable, but the greybox is not a finished character, world or finale. No human visual/playability approval, iPhone/Samsung physical-device signoff, final audio or complete campaign/video outcome is claimed.

## Three-phase engineering milestone, 2026-09-21

Kevin's later explicit goal to continue the epic finale authorizes continued private implementation, superseding the earlier discussion-only stop wording in the private draft. It does not approve artwork or deployment.

`TrumptopusFinale` composes the existing tested grab model into three phases: committed grabs, alternating low sweeps/grabs, and a wider two-handed grasp mixed with the learned attacks. It owns deterministic state and bounded phase-start checkpoints, not Phaser, saves, provider calls or rewards. A powerful hit can break one exposed grip, not skip all three phases. The provisional health budget is 6/8/10 with at most 3 damage per broken grip. Timing and difficulty still need child/parent testing; perfect-input proofs take about a minute and do not establish a 3-4 minute human fight.

The final accepted hit sets `completionReady` and emits `final-strike` immediately. Recoil/banishment are subsequent presentation states. This provides the correct future persistence boundary, but DOES NOT yet persist campaign completion. Retry is disallowed after that hit. Before victory, retry/checkpoint restore starts the current phase safely with its full phase-health budget, never at a mid-strike pose.

`TrumptopusAttackPose` returns the visible palm, counterattack target and damaging footprint from one pose. Sweeps use a low physical hand, not the taller exposed-joint attack target. The private preview raises an unoccupied support; its body follows the art. It never appears through a player or disables beneath a rider. A placeholder ground wave starts at the real creature during the final phase introduction. Finished creature performance, material response and world recovery remain art work, not proven by that line.

`TrumptopusFinalePreview` still uses the existing creature, astronaut and real touch/keyboard controls. It is absent from production scene registration. Its phase-boundary health refill is an isolated fixture policy; campaign consumable/retry policy remains unimplemented. Its simple limb fade and barrier release demonstrate outcome timing, NOT the final character's banishment scene. No rewards, Nova rescue, repair screen or Watch action are claimed by this mechanics preview.

### Verification

- `npm run smoke:trumptopus-finale`: 390x844 touch and 1280x720 keyboard passed all nine real attack openings, including sweep jumps, three phases, safe pause, phase-preserving restart, barrier release, ground contact and teardown. No debug damage or teleport was used to win.
- Full Jest: 250 suites / 2,441 tests passed. Includes the 45 encounter/phase/geometry checks and a separate occupied-support/rider regression.
- `npm run build:onboarding-ci`: production Vite build passed. Existing browser-data/chunk-size warnings remain. The private encounter identifiers are absent from shipped JavaScript. This is NOT the full public marketing/platform-release pipeline.
- Earlier one-exchange phone/desktop proof passed again after shared harness changes; prior commit evidence was preserved in its original directory.
- Film manifest validation passes only as a disabled future feature. `npm run gate:final-void-films` deliberately still fails: both reviewed films are missing. No gate was weakened.
- New evidence: `.visual-review/trumptopus-three-phase/`. Phone recording is 390x802 / 54.57 s; desktop is 1280x678 / 59.47 s. Full stills include the private harness's 42px header. Both direct canvas recordings and MP4 review transcodes contain no audio track. Twelve-frame diagnostic sheets are complete.
- Zero observed browser errors, outside service attempts, fixture writes or persistent-storage writes. Browsers and temporary servers were closed. These are local Chrome emulations, not physical iPhone/Samsung signoff.

The first sweep smoke failed honestly because its jump was timed from the creature centre rather than the approaching collision edge. The rerun uses the actual leading-edge geometry; no damage assertion, jump physics or gameplay timing was weakened. The failed image remains a diagnostic, not current review evidence.

### Remaining gates and exact next work

1. Layered character art: one reference-preserving image-tool request was blocked; no output was produced and no alternate-provider workaround was attempted. See [authored asset handoff](TRUMPTOPUS_ART_HANDOFF.md). Keep the red cap/slogan and four-arm identity intact. An approved artist-prepared layer set is needed to proceed with this art route.
2. Shared films: spending limit unanswered; source/provenance/provider-content approval and actual generation still required. No provider charges were initiated. Do not infer media readiness from mechanics tests.
3. Campaign adapter: connected privately in the later campaign milestone below; still not registered in production. Keep `PlatformerLevelScene.completeLevelProgression` unchanged for the other levels. Preserve Nova, `command_module`, existing rewards, and canonical level IDs.
4. The real hit-to-repair/choice connection now has a private browser proof below. The approach, finished performance, all ending priorities and optional current-creature insert still need their own scoped checks. The earlier isolated result proof is not the whole journey.
5. Human phone-scale art, first-time readability, difficulty, sound and ending review remain mandatory. No automated pass means the finale is epic, finished, approved or live.

## Private verification, 2026-09-21

- Focused checks: 29 passing across PreparedFilm, FinalVoidFilms and existing CinematicMediaContract suites.
- Full Jest suite: see `.visual-review/trumptopus-prepared-films/jest-results.json` for the final run.
- Production Vite build passed. Existing stale browser-data and large-chunk warnings remain; no dependency upgrades were mixed into this change.
- Headless Chrome phone viewport 390x844: Watch-to-visible-frame 105 ms; desktop viewport 1280x720: 85 ms. One local sample each, not p95 or physical-device measurements.
- Both journeys showed nonblank progressing video, completed/replayed after going offline, used one film download and zero generation calls, and restored the paused Phaser scene with no browser errors. Screenshots and exact media digest are in the private report directory.
- New-final-film release gate deliberately rejects both missing reviewed films. No final-boss art, campaign integration, personalized insert or real-phone signoff is claimed.
- Owned browser and local proof server were closed. No host audio was used.

## Durable victory and compact result milestone, 2026-09-21

`TrumptopusProgress` stages the run, phase checkpoints and final reward against the existing GameState snapshot/backup/commit boundary. A won receipt is keyed to its expedition sequence. The final local write contains the banishment, 2,500 base coins plus existing support bonuses, Command Module, Nova rescue, Super Blast, current restoration, level/combat stats and existing bond progress together. Refreshing or repeating the final callback cannot award them twice. A deliberate new expedition can earn a new consumable/coin reward without duplicating the ship part or clearing previous ending choices.

`GameState.createSaveSnapshot` accepts an optional detached state; ordinary callers retain the existing default. This avoids publishing a half-applied inventory/reward state. Existing save validation, backup and migration remain in use. Denied/full storage retains the complete win in-session and reports that it is not durable, including when the same-session result adapter is recreated. It does not promise progress across a closed private tab.

The new outcome lives at `world.antagonistOutcomes.trumptopus`; the run/receipt lives at `story.projectBeacon.trumptopus`, not inside the existing ending-choice object. Historical inferred or explicit Empress records are materialized before marking the new level completion. A new Trumptopus win therefore does not invent an Empress rescue, and old completed saves keep their history. Creature genes, DNA, stage and existing ending priority remain unchanged.

`TrumptopusCompletion` and `TrumptopusResult` own only the new outcome-to-next-step boundary. They do not instantiate the legacy level or replace its flow. Winning persistence occurs before presentation; the future scene must wait for grounded recovery before calling `present()`. The result gives one readable reward summary and the canonical next step: Repair the ship, Finish the story, or Return to Sanctuary for an already completed ending. Continue goes to existing GameScene with its existing `continueFinaleAfterRepair` flag, not a new ending implementation.

Watch is absent without an approved film, enabled only after verified preparation, and changes to Retry film after a preparation failure. Failure never disables the next step. A Watch click uses prepared local media immediately. Closing the player restores the result and its focus. Scene shutdown closes both. Film generation is never started by the result screen.

### Proof and limitations

- Full Jest: 252 suites / 2,463 tests passed. Covers canonical save/restore, old Empress history, full inventory, denied storage, intentional replay, unsupported run schema, existing final repair/ending choices, adapter lifecycle, focus and film retry. The old static save guard was updated to require the staged-state binding and the same durable resume marker; runtime tests verify both default and staged snapshots.
- Production Vite build passed with existing browser-data and large-chunk warnings. No final-fight scene or result screen is registered in the production game. The small backward-compatible snapshot and outcome helpers do compile into the normal codebase; the new encounter/presentation does not.
- `npm run smoke:trumptopus-ending`: six local Chrome journeys passed: 390x844 phone, 1280x720 desktop, 844x390 landscape, denied storage, injected film failure/retry, and absent/unapproved film. Buttons remain within the viewport; the body can scroll independently. One phone refresh reopens the won result with unchanged coins/items and no new primary save write.
- Evidence: `.visual-review/trumptopus-ending-handoff/`. Screenshots deliberately say seeded victory. The proof uses the actual GameState/outcome/result/media modules beside Phaser, but seeds the final outcome and substitutes a destination scene to verify the exact handoff parameters. It does NOT complete the boss, run the production Sanctuary repair UI or choose the actual epilogue. The playback fixture is the existing Forest film, never claimed as Trumptopus footage.
- The initial smoke expected three save writes; source evidence showed four legitimate boundaries (start, phase two, phase three, complete win). The corrected assertion checks exactly four. The final win itself is separately verified as one primary write. No gameplay/save guard was relaxed.
- Zero observed page/console errors or outside service requests in the six passing journeys. Chrome used `--mute-audio`, Phaser noAudio and muted film playback. Owned browser/server were closed. No physical-device or sound-mix approval is claimed.
- Optional cloud-sync connection is NOT added. Automation review blocked emitting the normal `saved` event because that can upload the complete save via the current opt-in Supabase adapter. Kevin was asked whether to preserve that connection or leave it for migration review. The private proof makes no cloud calls. Existing unrelated autosave/cloud code is unchanged; this is not a claim that future production saves would never include the new progress.
- Full-inventory rewards are safely queued in the atomic receipt. The pre-existing generic `InventoryManager.claimPendingBossRewards` saves added items before removing their queue entries; its refresh window must be resolved/proven before calling the entire queued-reward journey durable. This slice does not change inventory behavior across other levels.
- Integration still needs run-duration/retry accounting, normal achievement/manager refresh, real battle-to-ending smoke and rollback rehearsal. Film release gate remains intentionally closed; artwork, budget/content approval and adult review remain outstanding.

## Real fight-to-ending milestone, 2026-09-21

`TrumptopusCampaignPreview` now joins the actual private fight to the existing campaign ending. It uses real touch/keyboard movement and attacks, then `TrumptopusCompletion` at the accepted winning hit, the actual Sanctuary repair board, `VictoryScene` and `HubWorldScene`. It is registered only by an isolated local harness, never by the production scene loader. Earlier levels and five installed ship parts are fixtures, not a claim that the whole campaign was played.

The adapter saves the win before the next animation frame. It clears held input but preserves the fall velocity until the player lands. Only grounded aftermath opens the result; a win during a jump cannot freeze the player above the floor. A committed win reloads directly into terminal aftermath without new attacks, another banishment event or repeated coins/items.

Phase-start checkpoints now include monotonic active-play time and accumulated damage. Pause, shutdown/retry and page hide save those counters. The counters survive scene recreation; retry cannot reset a damaged run into a no-damage award or shorten its recorded time. Old version-1 run records without counters remain readable. This is phase-start recovery, not a mid-strike restore; abrupt process termination may lose unsaved activity since the last checkpoint. The private arena still refills health between phases as a fixture policy, not final difficulty approval.

### Verification and limits

- Full Jest: 253 suites / 2,471 tests passed. Includes immediate-hit persistence, terminal restore, prior damage/time, rewind rejection, pause, grounded result timing and preservation of fall velocity. Production Vite build passed with the existing large-chunk/browser-data warnings.
- `npm run smoke:trumptopus-campaign`: real nine-opening fight on 390x844 touch and 1280x720 keyboard, phase-two retry, pause, actual page reload at the won result, same reward inventory, actual Command Module installation, existing prepare-homecoming choice, three existing epilogue pages and Sanctuary return.
- Both journeys keep the same creature genes/DNA, record one Trumptopus banishment, retain one Super Blast and do not invent an Empress rescue. Existing history has separate save regression coverage; the browser journey starts a new fixture history.
- The private save has its own key and backup prefix in a fresh isolated browser context. No player save, account or provider connection is used. Zero observed browser/console errors or outside service requests. No sound reaches the host; all owned browsers and the temporary server are closed.
- Evidence: `.visual-review/trumptopus-campaign/`. Fight recordings are silent canvas captures, excluding the 42px harness header; ending screenshots include the full viewport. They are engineering review material, not marketing or evidence of final artwork. The preserved failed-attempt image records an earlier harness boot failure and is not part of the successful run.
- Obvious-fault review: reward and choice controls are readable and operable at phone size. The result covers the actors, the arena/limbs are still bare mechanics geometry and the inherited epilogue is text-heavy. The real repair/ending works, but that does not make the finished finale epic or visually approved. Ending copy, other priorities, physical phones, final audio, approach staging and human first-time play still need review.
- No new film has been generated. With the unapproved manifest, Watch is correctly absent. Earlier fixture-film proof establishes playback plumbing only. Source/budget/content approval, actual reviewed films and the artist-prepared character layers remain open gates. The blocked cloud-sync event and pre-existing queued-reward refresh window remain unresolved release items described above.

Next bounded work is the playable approach and arena choreography, followed by authored layers and prepared film cues when their approvals/assets exist. Do not change other levels, historical Empress data or the existing ending priorities to conceal a missing asset or a failed review. Production, public assets and release authority remain unchanged.
