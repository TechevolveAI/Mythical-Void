# Forest Guardian Encounter Repair

Scope: the existing Elder Treant encounter, its entrance, combat feedback and
result. Preserve the Forest route, three-place awakening, creature identity,
saved progress, Forest Core, power-up, resident rescue and optional celebration.
The separate audio and adult-texture repairs remain in this local branch.

## What Was Actually Wrong

- The previous boss appeared only 120-180 world pixels ahead of the player.
  Its 310px artwork overlapped the player and was cropped on phone.
- A health/corruption bar and four attacks already existed. The initial real
  browser probe showed the bar; it was not universally absent. Its instruction
  sat against the bar, lacked resize handling and could compete with coaching.
- The vine travelled at the boss's centre, above grounded players, and checked
  damage only at its endpoint. Falling leaves started at world Y=-20, not above
  the visible arena, and checked horizontal distance only upon landing.
- Root damage used sprite-centre height rather than the player's collision body.
  Several warnings and attacks used different ground heights/target positions.
  Spores retargeted after showing a warning.
- Melee measured distance to the centre of tall artwork, making the desktop
  guardian unreachable from the ground with the basic sword. The sprite is now
  anchored at its roots without changing its visible ground position or art.
- Boss health was 12, damage was accepted during the entrance and attacks, and
  there was no boss hit interval. Repeated powerful attacks could skip the fight.
- The intermittent floor fall did not occur in the initial idle probe. Inspection
  and fault injection did expose unsafe teleport/history assumptions. In Phaser
  3.90, Body.reset uses the texture top-left before applying a custom hitbox
  offset. Position, offset and previous physics positions must agree.

## Chosen Fight

Target: a first boss for ages 9-12, with readable rules rather than extra tasks.
Defeating its corruption frees the Elder Treant; this does not introduce a new
"stabilize" minigame.

1. Arrive on the measured solid arena floor. Clear held touch/drop input and old
   coaching. The boss appears ahead, not on top of the creature. Its entrance is
   protected from hits. The astronaut uses the existing contextual-follow API.
2. Phase one alternates rising roots and a low travelling vine. Both show a
   900ms warning. Jump over the dangerous ground area or the low vine. The tree
   leans back to prepare, strikes, then settles. Roots use a brief 350ms impact
   rather than a lingering trap. This is a tuning choice, not a measured optimal
   difficulty. Browser keyboard checks hold keys for 90ms; zero-duration synthetic
   down/up taps can occur between frames and were not valid jump evidence.
3. After each attack, a 1.8-second opening says "YOUR TURN!" The boss can be hit
   during that opening. Ordinary hits gain one bonus damage; upgrades still help.
4. At half corruption, pause for the existing phase-change beat. Phase two starts
   with spores, then returns to the vine, marked falling leaves and roots. Spore
   and leaf warnings lock their positions before impact so moving actually works.
5. At zero, cancel every active attack shape/tween and retain the existing
   restoration, optional media, rescue, celebration and return flow.

Tuning: 18 corruption, at most 3 base damage plus the opening bonus per accepted
hit, 400ms between accepted hits, 1.8-2 seconds per opening. A phase cannot be
damaged before its first attack. These are initial tunings, not a claim that
automated tests have established the ideal difficulty for children.

## Safety And Presentation

- Arena entry uses the real floor body and synchronizes hitbox offsets plus
  prev/prevFrame/autoFrame after a teleport. A scoped arena guard repairs a body
  below the solid floor or crossing the arena edge. Ordinary Forest void gaps and
  legitimate jumps are unchanged; the guard is inactive outside this fight.
- Hazard collision uses body bounds throughout movement and checks the active
  encounter/physics state. Victory, phase changes and shutdown remove hazards.
- Desktop keeps 310px boss art; narrow phones use 220px. Camera lead looks into
  the arena without changing gameplay zoom or shrinking the controls.
- A compact corruption bar retains one short action cue below it. Width changes
  rebuild the bar; old coaching cannot cover the encounter.
- The result replaces the ecological percentage line with actual encounter time
  and successful strikes. Existing earned coins, Forest Core, usable power-up,
  rescued resident and next destination remain. No invented score, rating,
  currency, leaderboard or save schema is introduced.
- Screenshot inspection caught overlapping reward text despite the original
  button-only checks passing. The result now uses measured wrapped text heights
  in the existing stack-layout helper, with a taller responsive panel. Power-up
  instructions and active village-support credit remain visible. The completion
  check now rejects overlap or off-screen bounds for every summary block and
  both actions, not just the two buttons.

## Research Basis

The warning -> attack -> recovery sequence follows the explicit combat structure
in Double Fine's [Crafting Epic Boss Battles in Psychonauts 2, GDC 2023,
pages 25-29](https://media.gdcvault.com/gdc2023/Slides/CraftingEpicBoss_Vessal_Beca.pdf).
This is a small adaptation using the game's existing mechanics, not an attempt
to transplant another game's systems or difficulty.

## Verification And Release Boundary

- Behavioral tests: entrance protection, hit intervals, upgraded damage, phase
  order, warning target lock, in-flight collision, jumping, floor recovery,
  hitbox history, and hazard cleanup.
- `node scripts/check-forest-guardian.cjs`: production-bundle phone 390x844 and
  desktop 1280x720 checks. Real entrance and first root hit; explicit fault
  injection; isolated patterns with real clocks, input, projectiles and victory.
  Positions/health are reset between cases. This is not a full playthrough or an
  adult approval of difficulty. Evidence goes under `.visual-review/` only.
- `SMOKE_HARDWARE_ACCELERATED_CAPTURE=1 COMPLETION_CASES=forest-phone,forest-desktop node scripts/run-completion-flow.cjs`:
  the existing focused restoration/rescue/reward/return proof. Its staged final
  hit now waits for a real opening rather than overriding boss protection.
- The older harness's forced software renderer ran the desktop fixture at about
  7 FPS and timed out before an attack opening. Normal GPU browser checks pass.
  During release CI this reproduced on desktop. Phaser's Clock.now uses frame
  time, while TimerEvent.elapsed consumes smoothed frame delta, so a wall-only
  12-second timeout was not a valid attack-sequence deadline on that renderer.
  The completion fixture now uses an independent 12-second Phaser TimerEvent
  budget plus a 60-second wall stall limit, logs both elapsed values and FPS,
  and fails on a dead player, stopped encounter or missing real opening. The
  probe timer is always removed. Boss state, speed and attacks are not altered.
  This is a functional completion test, not a performance pass: the software
  renderer remains slow. Original failed evidence is retained privately.
- Full Jest suite, production build and diff check. Browser processes are muted,
  optional services disabled in disposable fixtures, and owned processes closed.
- Exact source and result status are recorded in the private evidence JSON.
  No push or deployment is part of this repair. Child playtesting must still
  judge pace, difficulty and readability before calling it polished.

Final candidate validation: 236 suites / 2,294 tests pass. The tests cover long
wrapped rewards, replay idempotence and singular/plural strike counts. Actual
phone/desktop completion evidence is under
`.visual-review/forest-encounter/final-completion/`; its result JSON records the
exact source commit and browser outcome. Combat evidence remains under
`.visual-review/forest-encounter/0ed8fa08/` (the unchanged combat implementation).
These are local desktop Chrome touch/viewport simulations, not physical iPhone
or Android device tests. Hosted video and portrait providers are disabled in
the fixtures; their production availability has not been re-certified here.
The release-only clock follow-up also passes the original forced-software
desktop completion case: a real opening after 2,555ms of timer delta / 20,412ms
wall time at about 6 FPS, followed by the complete reward/return/install flow.
Evidence: `.visual-review/release-sep17-software-clock/`. No shipped gameplay
files changed in that follow-up.
