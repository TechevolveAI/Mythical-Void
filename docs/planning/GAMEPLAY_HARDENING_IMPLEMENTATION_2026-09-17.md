# Gameplay Hardening Implementation

Status: first hardening slice released; the eight-package programme is incomplete.

Original baseline: `c4c6fb77cda0b713e0c7aed965d24cd0bf077bc1`.
Released baseline: protected `main`, `d8f9d25104eede9abc3094411d9cd83a71a03948`
(PR #315; source `36b3789cd8d2fe8e845107a04dda4cb806bfe221`).
Netlify production deploy: `6aabc2ae86f7140008761df0`, published
2026-09-17 at 10:37:58 UTC. Live play entry and released assets were verified.
Production still uses Netlify/Supabase; this is not a Google cutover.

## What We Are Protecting

A child can hatch a creature, enter the Sanctuary, start an expedition, defeat
its Guardian, keep the reward, and leave the result screen. No account, cloud
save, generated portrait/video, analytics request or animation completion may
become a condition of continuing that journey. Existing player identity, saves,
level order, combat balance and approved artwork stay intact.

Mythical Forest is the creative reference, not a template that every level must
copy. Sanctuary movement/building and expedition platforming remain distinct.
Engineering checks cannot approve visual quality or replace children testing
on actual phones. No claim of perfect iOS support based on Chromium emulation.

## Work Packages And Acceptance

| Order | Package | Concrete implementation and acceptance | Status |
| --- | --- | --- | --- |
| 1 | Playable journeys | Fix completion/debrief blocking UI as a separate component. A native action stays visible; optional story scrolls. Exercise all five pre-final rewards, rapid repeat taps, keyboard, resize, shutdown and queued results. Never wait on a tween to leave. Opening success/pending/failure continues to Sanctuary. | Debrief repair released; full completion-chain acceptance outstanding |
| 2 | Mobile input | Behavior-level regression coverage for downward/left hold, second finger, cancel, blur, visibility and layout changes. Repair only reproduced faults. Verify actual input rather than setting movement state directly. Physical iPhone/Android acceptance remains explicit. | Reproduced lifecycle fixes released; physical-phone signoff outstanding |
| 3 | Level contracts | Record six canonical level IDs, prerequisites, boss/reward, installation, exit and recovery. Exercise existing pure campaign/reward code across all levels; preserve reward idempotency and replay. Do not redesign levels while certifying them. | Contracts and targeted fixes released; whole-campaign acceptance outstanding |
| 4 | Creature continuity | Trace one immutable identity through hatch, active collection changes, Sanctuary, rescue and story media. Add targeted tests for stale asynchronous results, unavailable portraits, queued reveals, reload and scene teardown; never substitute another creature's portrait. | Async identity/media fixes released; remaining journeys and live media proof outstanding |
| 5 | Media contracts | Inventory versioned portrait/video templates, bounded fictional traits, provider boundaries, limits and fallback. Make prompt changes reviewable separately from UI. Verify no player free text/identity enters provider payloads. Video is optional, skippable and cannot block play. No paid generation just to exercise a fallback. | Queued |
| 6 | Aggregate measurement | Reuse the existing first-party event boundary. Allowlist event names and enum values, strip unknown fields, and prove failures are nonblocking. No new stable identifier, tracker or transport. Agree the Google ObservabilitySink integration with Ops first. | Queued; adapter integration held |
| 7 | Saves and performance | Recover and evaluate unmerged enterprise-hardening work, not blindly cherry-pick it. Verify write/read-back, recovery, version-bump fixtures and optional cloud startup isolation. Measure production transfer and cold playable time before budgets. Browser eviction cannot be promised away. | Queued |
| 8 | Creative approval | Short, source-bound per-level briefs: one central idea, safe introduction, practice, complication and boss test. Record human decisions separately from automated results. No new creature topology, ending rewrite or building art without a specific creative review. | Queued |

Dependencies: 1-3 establish safe journeys; 4-5 protect optional presentation;
6-7 agree the provider-neutral integration boundary; 8 feeds small later feature
branches rather than a wholesale rewrite. Newly found defects enter the nearest
package only when reproduced, materially relevant and covered by a regression.

## Migration Agreement

Ops owns `cloudrun/media-gateway/**`, `infra/**`, Firebase config/rules,
`scripts/platform/**`, `docs/operations/**`, platform CI, `src/platform/**` and
adapter contract tests. This work does not edit those paths or wire Google
providers into the game. Existing CloudSaveManager integration also requires a
coordinated handoff.

Ops reports SaveRepository revision/CAS operations, IdentityRepository,
FusionRepository, MediaJobService, MediaObjectStore, ObservabilitySink and
RuntimeConfigProvider as the migration boundary. Gameplay must consume those
contracts, not import a new cloud SDK into scenes. Both legacy and future
providers must preserve local-first, failure-tolerant behavior.

Netlify/Supabase remain the production authority. Google staging is private;
Ops has verified authenticated JSON health, not a playable frontend. A healthy container or an IAP redirect is
not proof of a playable release. No Google flags, production data migration,
DNS cutover, secrets, schemas or backend writes are authorized by this plan.

## Verification And Release

For each feature: focused behavior tests, one relevant muted browser journey
when UI changes, a reviewed diff, and a recorded result. Run the full Jest suite
and production build at integration boundaries, not after every line edit.
Do not relax failing checks to manufacture a pass. Report pre-existing gates
separately from introduced failures. No user data or provider spend in tests.

Browser proof must assert real button hit targets and scroll/viewport bounds,
console errors, optional-service isolation and cleanup. Every Chromium launch
uses `--mute-audio`; game audio stays disabled. Browser and preview processes
are terminated in cleanup even on failure. Evidence is private, not marketing.

Release candidates contain source SHA, changes, exact tests, build result,
known gaps and rollback commit. Normal protected PR review remains required.
No bypass of branch checks and no claim that this is the Google release until
Ops' separate cutover acceptance is complete. Keep each package revertible;
no save-schema change is needed for the first three packages.

## Human Decisions Reserved

- Kevin and the children judge fun, clarity, creature appeal and difficulty.
- A physical iPhone Chrome run must validate downward movement, repeated taps,
  orientation change and returning from a backgrounded tab before mobile signoff.
- Ops owns when the same accepted candidate can run against Google staging and
  when production may switch providers.
- First-party aggregate counts cannot honestly report unique-player retention.
  Future chat, account or tracking changes require separate approval.

## First Integration Slice

Released through PR #315 after 227 Jest suites / 2,135 tests, production builds,
required opening-journey CI, and the gameplay-contracts check passed. Private
exact-source browser evidence is `/private/tmp/mythical-debrief-evidence/result.json`:
20 debrief cases across four viewports, four underlying-Hub input isolation
checks, and zero recorded browser/network faults. These are engineering checks,
not human visual approval, physical-device acceptance or a complete campaign run.
All automated browsers were muted and closed with their preview servers.

- Package 1: responsive debrief component for the five recovered ship systems.
  The action stays visible while optional story scrolls. Leaving no longer waits
  for a tween. Native dialog touches cannot activate hidden Hub buttons; the
  prior Hub input state is restored on dismissal and scene cleanup. The five
  debrief previews have phone/landscape/desktop coverage;
  that is not an end-to-end boss, installation or final-ending playthrough.
- Package 2: reproduced cancellation, resize, pointer capture and native-pointer
  identity faults repaired with behavior tests. Physical iOS/Android acceptance
  is still outstanding.
- Package 3: six-level contracts plus repairs for locked final-route guidance,
  missing field-kit installation permission and invalid reward counts. No new
  level layout, balance or ending structure.
- Package 4: stale portrait results cannot save onto another creature. Failed or
  outdated cinematic preparation can retry. Video startup has a real deadline,
  shutdown cleanup and a still-image fallback. Live provider and physical-device
  media playback are not certified by mocked tests.
- Incident: failed optional scene downloads settle quietly and back off; required
  entry still reports failure. The touch bridge cancels only its own non-passive
  DOM event, not Phaser's passive callback.

The supplied Forest failure log was from `127.0.0.1:8137`, the temporary debrief
verification server after cleanup, not the deployed game. Already-loaded screens
remained visible while new assets and level modules could no longer download.
Temporary verification URLs are not human-testing deployments. Verification
servers use a per-process port and always close with their muted browser.
Do not promise that retry can download a missing module while its host is down;
restart an intentional preview and reload, or use a separately published preview.

Reproduce the focused UI proof with `node scripts/smoke-expedition-debrief.cjs`
after building. It records source revision, dirty state, shipped entry digest,
20 debrief cases and browser/network faults in a private temporary directory.
The new gameplay-contracts workflow runs this with the full Jest suite and Vite
build on PRs. This adds a workflow; it does not silently change protected-branch
requirements or replace the existing opening-journey checks.

Packages 5-8 have not started in this programme. The Google migration and human
creative approvals remain separate boundaries. Preserve the current playable
release until the next candidate completes its normal review and release gates.

## Next Bounded Batch

Complete package 1 acceptance using the actual boss/reward/install transition,
not just a result-screen fixture. Check reward persistence, a clear next
destination, replay/duplicate safety and the existing final-ending choices and
return path. Begin with one representative pre-final journey and the finale;
expand only where shared behavior or a reproduced defect warrants it. Keep
existing level art, layouts, balance, story choices and provider wiring unchanged.
This batch is implemented locally, pending the normal release gates:

- Forest restoration now enters the shared completion freeze. The final-hit
  feedback timer cannot resume physics underneath the reward/rescue screens.
- Final repair and unfinished ending recovery derive from existing saved
  campaign/repair/choice state, not a transient scene handoff flag. Completed
  legacy endings remain complete without inventing a repair ledger.
- Ship interactions and the Sanctuary waypoint prioritize the unfinished final
  repair or ending. Refresh after the celebration resumes the existing choice
  or epilogue instead of replaying the full celebration.
- Duplicate final transitions are ignored. An optional achievement failure or
  late shop/inventory load cannot block or cover the final transition.
- The repair board converts pointer coordinates through the same camera
  transform as its visible controls. At mobile Sanctuary zoom, tapping the
  drawn installation button no longer misses an unzoomed invisible hit region.
- Browser checks use the viewport's native input, wait for Phaser hit-test
  registration, and project canvas controls through camera/CSS transforms.
- No save-schema, backend, level layout, art, balance or story-choice changes.

`npm run smoke:completion-flow` checks staged real Guardian final attacks,
native reward/install buttons, Forest-to-Crystal-Caves recommendation and final
repair/choice/epilogue/reload on 390x844 and 1280x720. It does not claim a natural
six-level playthrough or physical iOS acceptance. Optional services are disabled,
outside requests blocked and counted, all audio muted, and processes cleaned up.
Source revision/dirty state and shipped entry digest are recorded privately in
`/private/tmp/mythical-completion-evidence/result.json` (override with
`COMPLETION_EVIDENCE_DIR`). The gameplay-contracts PR check runs the same cases.

Remaining: physical-phone acceptance, the other four level handoffs, live media
proof and the rest of package 4, then packages 5-8 in order. Engineering passage
is not adult visual approval. The released baseline above stays authoritative
until this separate candidate is actually published and verified.
