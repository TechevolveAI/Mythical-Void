# Campaign Level Contracts

Baseline: `c4c6fb77cda0b713e0c7aed965d24cd0bf077bc1`, inspected 2026-09-17 in
`/private/tmp/mythical-gameplay-hardening` on `codex/gameplay-hardening-sep17`.
This is the level-contract slice, not the parent implementation plan. After the
initial inspection, Kevin authorized narrow repairs to three reproduced helper
gaps. Changes are limited to access guidance, installation preconditions, and
non-finite reward-count handling. No balance, story, art, provider, save format,
schema, platform, or infrastructure changes are included.

## Canonical Identity And Order

There are **six playable campaign levels**, including Final Void. The eight-area
hardening scope does not mean eight campaign levels. Five expeditions precede
the final encounter and have Project Beacon debriefs.

| Order | Display route | Hub gate ID | Scene key/file stem | Runtime level ID | Save/achievement level ID |
| --- | --- | --- | --- | --- | --- |
| 1 | Mythical Forest | `mythical_forest` | `MythicalForestLevel` | `mythical_forest_1` | `mythicalForest` |
| 2 | Crystal Caves | `crystal_caves` | `CrystalCavesLevel` | `crystal_caves_1` | `crystalCaves` |
| 3 | Stellar Reef | `stellar_reef` | `ReefLevel` | `reef_1` | `cosmicReef` |
| 4 | Void Peaks | `void_peaks` | `VoidPeaksLevel` | `void_peaks_1` | `voidPeaks` |
| 5 | Aurora Depths | `aurora_depths` | `AuroraDepthsLevel` | `aurora_depths_1` | `auroraDepths` |
| 6 | The Final Void | `final_void` | `FinalVoidLevel` | `final_void_1` | `finalVoid` |

Completion lives at `levels.<save ID>.completed`; raw gate state lives at
`hubWorld.gates.<gate ID>.unlocked`. These namespaces are not interchangeable.
In particular, do not invent `reef` as a gate ID or derive the Reef save ID from
its scene name.

Sources: [CampaignJourneyGuide.js](../../src/systems/CampaignJourneyGuide.js)
(`CAMPAIGN_ROUTE`, lookup/prerequisite/journey helpers),
[GameState.js](../../src/systems/GameState.js) (`CAMPAIGN_ROUTE_SEQUENCE`,
`getCampaignGateAccessFromData`, `syncCanonicalCampaignGates`),
[PlatformerLevelScene.js](../../src/scenes/PlatformerLevelScene.js)
(`CAMPAIGN_LEVEL_BY_SCENE_LEVEL`), the six level constructors, and
[SceneLoader.js](../../src/utils/SceneLoader.js).

## Access And Reports

- Every earlier canonical level must have `completed === true`. A purchased map,
  discovered gate, stale unlocked flag, or later completion does not bypass a
  missing earlier completion in effective GameState access.
- The guide uses GameState's effective gate access for both ready and resume
  guidance. Lightweight states without that API retain a local prerequisite/raw
  flag fallback, including both Final Void ship flags. Only that fallback treats
  Forest as ready without a raw unlock; real GameState access is authoritative.
- Debriefs `beacon_debrief_1` through `beacon_debrief_5` correspond to the first
  five save IDs, not the player's aggregate completion count. Pending/seen
  reports are not queued twice. Final Void has no sixth debrief.
- Forest, Caves, Reef, and Peaks milestones unlock Caves, Reef, Peaks, and Aurora,
  respectively. Aurora's report has **no nextGate**. Neither Aurora's milestone
  nor Final Void's completion directly unlocks another route.
- Final Void additionally requires both `hubWorld.shipParts.finalBossUnlocked`
  and `hubWorld.shipCompletionCutsceneShown`. Hub derives the former from five
  installed systems, then combines installation readiness with the reveal flag.
  GameState's pure helper consumes these flags; it does not independently inspect
  the installation ledger. The guide is not an authoritative entry guard.
- A stale Final Void checkpoint cannot advertise resume while effective access
  is locked. Guidance remains read-only and does not clear checkpoints or change
  gate flags. Ship-blocked guidance points to installation and the route reveal.

Sources: [ProjectBeaconStory.js](../../src/systems/ProjectBeaconStory.js),
[project-beacon.json](../../src/config/project-beacon.json), and
[HubWorldScene.js](../../src/scenes/HubWorldScene.js) (`syncFinalVoidAccess`).

## Boss Rewards

These are current configured amounts, not proposed balance changes. `n` is the
non-negative, floored collectible count passed to `calculateVictoryCoins`.
Non-finite numeric counts, including numeric strings converting to Infinity,
contribute zero bonus; finite counts retain their existing calculation.

| Save ID | Boss config key | Victory coins | Usable power-up | Ship part | Additional katana installation | Speedrun threshold |
| --- | --- | --- | --- | --- | --- | --- |
| `mythicalForest` | `elderTreant` | `600 + 100*n` | `energy_crystal` | `forest_core` | none | 240000 ms |
| `crystalCaves` | `crystalGolem` | `500 + 100*n` | `crystal_shield` | `crystal_core` | `crystal_edge` | 180000 ms |
| `cosmicReef` | `voidSerpent` | 750 | `double_coins` | `dimensional_drive` | none | 240000 ms |
| `voidPeaks` | `cosmicTitan` | 1500 | `power_shot` | `hull_plating` | none | 180000 ms |
| `auroraDepths` | `shadowPhoenix` | 1000 | `health_boost` | `aurora_reactor` | `aurora_guard` | 300000 ms |
| `finalVoid` | `voidEmpress` | 2500 | `super_blast` | `command_module` | none | 360000 ms |

The Forest and Caves call sites pass `starFragmentsCollected`; Caves' config
names its bonus `bonusPerRelic`. The Reef reward config retains `voidSerpent`,
while its guardian outcome is `nyxvoral`. Do not substitute guardian ledger IDs
for reward config keys.

`getBossPowerupReward` returns quantity 1, `rewardSource: guardian:<save ID>`,
and a copied effect object. It requires a configured `powerup` type marked
`usableInLevel`. Boss JSON's legacy `rocket_part_*` item names and final
`space_travel` unlock are not the completion helper's ship-installation or
departure authority: the scene supplies the actual ship part ID separately.

`completeLevelProgression` adds resident/village coin support outside the pure
coin calculator, awards the ship part, and uses guaranteed inventory rewards
or a pending-reward fallback. First completion advances the campaign count,
debrief, and gate synchronization; replay still awards configured coins and a
power-up. Its per-scene `_levelProgressionRecorded` guard prevents a duplicate
callback from awarding twice in the same completion flow. Achievement failure
does not own or roll back level completion. The new suite does not reimplement
or claim to exercise that scene orchestration.

Sources: [bosses.json](../../src/config/bosses.json), the six level completion
call sites, and `calculateVictoryCoins`, `getBossPowerupReward`, and
`completeLevelProgression` in the shared platformer scene.

## Installation And Rescue

| Order | Recovered part | Manual reconstruction step | Regional guardian ID | Separate rescued resident | Resident support |
| --- | --- | --- | --- | --- | --- |
| 1 | `forest_core` | `living_power_lattice` | `elder_treant` | `bloom` | +1 expedition energy |
| 2 | `crystal_core` | `propulsion_control` | `crystal_golem` | `pebble` | +3 later victory coins |
| 3 | `dimensional_drive` | `sealed_return_vector` | `nyxvoral` | `zephyr` | movement x1.04 |
| 4 | `hull_plating` | `resonance_hull` | `cosmic_titan` | `wisp` | +1 later guard charge |
| 5 | `aurora_reactor` | `uplink_hold` | `shadow_phoenix` | `luna` | jump x1.04 |
| 6 | `command_module` | `black_box_recovery` | `void_empress` | `nova` | memory record; no numeric modifier |

Recovery is not installation. `hubWorld.shipParts.collected` supplies parts;
`story.projectBeacon.shipReconstruction.completedStepIds` records ordered manual
work. A missing part returns `ship_part_required`; an out-of-order step returns
`prior_step_required`; repeat installation returns `already_installed`.
After those checks, a new installation requires snapshot availability, including
the recovered field kit; otherwise it returns `field_kit_required` without
writing state or saving. Already-installed legacy steps are returned unchanged
even without field-kit/part records. The guard does not alter their capabilities,
installation history, final readiness, or saved gate flags.
Normalization retains only a contiguous installation prefix. Five installed
steps set snapshot `finalVoidReady`; all six set `complete`. Installing systems
does not itself write the Hub reveal/access flags.

Regional guardians and Sanctuary residents are distinct ledgers. Default
guardian outcomes are `restored`; only the Elder Treant has a `heart_projection`
Sanctuary presence. The others remain regional guardians, not resident captives.
The shared completion flow records outcomes and rescued residents **before**
setting the level completion flag. Both snapshot systems can infer legacy
rescues from completed levels, so checking only a post-completion rescue count
would miss absent first-rescue history. The new tests assert that history before
checking replay idempotence. Sanctuary arrival acknowledgement is a separate
interaction and is covered in the existing resident suite.

Sources: [ShipReconstruction.js](../../src/systems/ShipReconstruction.js),
[GuardianOutcomes.js](../../src/systems/GuardianOutcomes.js),
[RescuedResidents.js](../../src/systems/RescuedResidents.js).

## Final Rescue And Ending Boundary

Scene inspection establishes the following wiring; this slice does not execute
the scene, cinematic, input, or renderer:

1. Final Void requires three bond marks before the Empress encounter. Phase four
   provides bounded network recovery. Phase five requests the companion's
   autonomous high-power rescue for `five_system_collapse`, with
   `commit: !testMode`; if unavailable, the scene supplies bounded recovery.
   This is separate from recording Nova's rescue at victory.
2. Victory completes `finalVoid` and recovers `command_module`; it does not
   install the module. The return route starts `GameScene` with
   `continueFinaleAfterRepair: true` so the player can install at Wanderer-77.
3. GameScene checks reconstruction completion before its normal continuation
   calls `finishFinaleAfterCommandRepair`, records `game_complete`, and starts
   `VictoryScene`. All six level flags can therefore be complete while the final
   manual repair and ending selection remain unfinished.
4. Ending priorities are `remain_and_defend`, `prepare_homecoming`, and
   `prepare_first_contact`. `recordCampaignPriority` writes the finale and legacy
   capsule as preparation, not immediate travel: coordinates remain protected,
   uplink held, departure deferred, and current commitment `remain_and_defend`.
   Ship completion must not imply companion travel consent. At full repair,
   life support is still `prototype_required` and uplink `held_exposure_risk`.

Sources: [FinalVoidLevel.js](../../src/scenes/levels/FinalVoidLevel.js),
[GameScene.js](../../src/scenes/GameScene.js),
[VictoryScene.js](../../src/scenes/VictoryScene.js), and
[CampaignLegacy.js](../../src/systems/CampaignLegacy.js).

## Repairs And Limits

The following gaps were reproduced at the baseline and repaired within the
expanded authorization. Characterizations are now rejection/consistency
regressions in `campaign helper hardening regressions`.

| Baseline gap | Narrow repair | Regression evidence |
| --- | --- | --- |
| Final guide advertised ready/resume despite blocked effective access. | `getCampaignRouteAccess` delegates to the effective API, or calculates prerequisites and ship requirements locally when absent. Both guidance paths use its result. | Both API/fallback paths cover every raw-unlock/installation-flag/reveal-flag/checkpoint combination; effective access overrides contradictory raw flags for every level. First-Forest lightweight fallback remains available. |
| Installer accepted a recovered part when field-kit availability was false. | Require `snapshot.available` before a new installation, after existing installed/part/order checks. | All six steps reject absent/false field-kit recovery with no state/save effects, then install once it is true. Legacy prefixes of 1, 5, and 6 installed steps retain capabilities, readiness, and flags without field-kit or part records. |
| Infinity bonus counts produced Infinity or NaN coins. | `calculateVictoryCoins` checks `Number.isFinite` after numeric conversion and normalizes non-finite counts to zero. No other platformer code changes. | Each level awards its configured base for Infinity, negative Infinity, NaN, and non-finite numeric strings. Existing finite fractional, negative, and default-count assertions still pass. |

These repairs do not establish that normal gameplay could previously bypass a
gate or produce Infinity. They harden helper boundaries and stale-state guidance.

The registries remain duplicated across guide, GameState, scene runtime IDs,
scene loader, debrief config, and reconstruction. This suite detects cross-table
drift but does not consolidate them. `getCampaignJourneyStep().status ===
'complete'` means six route flags, **not** installed Command Module, selected
priority, viewed epilogue, or consent. Callers must retain those distinctions.

## Executable Evidence

[CampaignLevelContracts.test.js](../../src/__tests__/CampaignLevelContracts.test.js)
uses the existing Jest toolchain and its installed `@babel/parser` to select
production function/constant declarations into a Node VM. It supplies real JSON
configuration and a small in-memory state adapter. No progression/reward
algorithm is copied, and no assertion checks source-string presence. This
deliberately avoids full-module imports and their browser/provider side effects;
it is not an import-graph, persistence, Phaser, or scene-transition test.

New coverage: cross-registry identity joins; a composed completion/report/rescue/
manual-install contract for each of six levels; bonus normalization and fresh
power-up effect objects for each level; every missing-earlier-level combination;
the final gate's two-flag truth table and outstanding final repair; effective
guide access and stale checkpoints; field-kit enforcement and legacy repair
preservation; non-finite reward-count regression cases.

Existing complementary suites are retained, not copied wholesale:
`LevelRegistry` covers static scene wiring; `LevelCompletionProgression` exercises
shared scene completion with mocked optional managers; `CampaignJourneyGuide`,
`ProjectBeaconCampaign`, `ShipReconstruction`, and `RescuedResidents` cover their
individual APIs; `FinalExpeditionCulmination` inspects final scene wiring;
`CampaignLegacy` exercises the ending capsule and priority contract.

Focused command (no browser, server, or audio):

```sh
npm test -- --runTestsByPath src/__tests__/CampaignLevelContracts.test.js
```

Initial characterization result on 2026-09-17: **1 suite passed, 18 tests passed,
0 snapshots**. Before repairing production helpers, the converted/expanded
regressions produced **10 failures and 19 passes**, confirming the tests detected
the existing gaps. After repair, the four directly affected suites passed
**56 tests**. Jest emitted an existing stale `baseline-browser-mapping` data
warning; no dependency update was made.

Related regression command:

```sh
npm test -- --runTestsByPath \
  src/__tests__/CampaignLevelContracts.test.js \
  src/__tests__/LevelRegistry.test.js \
  src/__tests__/LevelCompletionProgression.test.js \
  src/__tests__/CampaignJourneyGuide.test.js \
  src/__tests__/ProjectBeaconCampaign.test.js \
  src/__tests__/ShipReconstruction.test.js \
  src/__tests__/RescuedResidents.test.js \
  src/__tests__/GuardianOutcomes.test.js \
  src/__tests__/FinalExpeditionCulmination.test.js \
  src/__tests__/CampaignLegacy.test.js \
  src/__tests__/ExpeditionDiagnostics.test.js \
  src/__tests__/ProjectBeaconLog.test.js \
  src/__tests__/ShipReconstructionGameplayContract.test.js \
  src/__tests__/PlainLanguageContract.test.js \
  src/__tests__/HubGateLayout.test.js
```

Initial characterization regression result on 2026-09-17: **10 suites passed,
96 tests passed, 0 snapshots**. Post-repair result for the expanded command above:
**15 suites passed, 163 tests passed, 0 snapshots**, including all **29** tests in
`CampaignLevelContracts.test.js`. Verification uses the live shared checkout,
including concurrent agents' unrelated edits; HEAD remains `c4c6fb77`.

Write ownership after repair: this document, `CampaignLevelContracts.test.js`,
`CampaignJourneyGuide.js`, `ShipReconstruction.js`, and **only**
`calculateVictoryCoins` in `PlatformerLevelScene.js`. Existing helper tests did
not need edits. No browser, preview server, audio, commit, push, or deployment
was run. The parent continues to own Hub completion UI and its script/CSS.
