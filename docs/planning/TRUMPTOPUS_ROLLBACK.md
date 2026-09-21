# Private Finale Rollback Contract

Status: local source/save rehearsal, not permission to deploy. No release or player save has been changed.

## The Rule

**Disable the new encounter, not the compatibility readers. Do not restore the bare old artifact after players have made Trumptopus saves. Do not rewind, clear or downgrade those saves.**

The recorded pre-finale baseline is `fd4f3f18e4390f8e6584732e6626cedc72b431a6` (Sanctuary repairer and decorative flags). This is a pinned source comparison, not a fresh assertion about what is currently live.

The historical save reader accepts new-finale saves and preserves their additive fields, but its Guardian outcome reader infers an Empress rescue from `levels.finalVoid.completed`. A new Trumptopus win therefore looks like an Empress rescue in that artifact. That is a semantic failure even though loading does not crash. Its old reward-inbox collector also contains the separately reproduced duplicate-reward save window.

## Supported Target

Keep the legacy `FinalVoidLevel` encounter, route registration, ship repair and ending. Retain these backward-compatible helpers from the reviewed candidate:

- `GuardianOutcomes.js`: a Trumptopus banishment must not imply an Empress rescue. Explicit and inferred genuine historical Empress records remain intact.
- `InventoryManager.js`: collecting a queued reward must transfer inventory and inbox together.
- `GameState.js`: retain the optional staged snapshot API; normal callers still serialize the current state with the same schema.
- `CurrentEcology.js`: retain the bounded `antagonist_banished` restoration evidence without changing the default Guardian restoration path.

The current private branch's normal build already has this legacy registration: the new scenes are only registered by local proof harnesses. This establishes a compatible fallback composition, not a deployed rollback. When the finale later receives production integration, preserve this composition as its explicit rollback target and re-run the tests against that exact release candidate.

Existing unfinished Trumptopus checkpoints remain stored but the legacy encounter does not interpret or resume the private fight. Re-enabling the new encounter can read those checkpoints. A rollback must not claim to resume a frozen strike, nor silently convert the unfinished fight into a completed Empress encounter. Already won saves retain Nova, Command Module, coins, the reward receipt and the existing repair/ending next step.

## Repeatable Rehearsal

Run `npm run verify:trumptopus-rollback`. It reads the pinned baseline directly from local Git objects and the candidate source from this worktree. The command fails if the baseline source is unavailable; it does not fetch, guess or substitute another revision. A CI job using it must supply that reviewed Git history explicitly.

The script executes the real older GameState reader/writer, retained candidate outcome/inventory helpers and current restore path against an isolated in-memory storage implementation. It tests 11 cases:

1. An unfinished legacy campaign.
2. A new approach checkpoint after one released crossing.
3. Phase two of the new fight, including elapsed time and damage.
4. A new win before ship repair.
5. A full-inventory win and subsequent collection of exactly one queued reward.
6. Genuine inferred historical Empress completion.
7. Genuine explicit historical Empress alliance.
8. Remain and Defend ending state.
9. Prepare Homecoming ending state.
10. Prepare First Contact ending state.
11. A future run schema that must survive storage but be rejected by the current encounter reader without mutation.

Ending-choice fixtures are normalized through the current save reader first. They prove persistence of the canonical ending state, not clicks through three ending UI journeys. The raw-baseline negative control must demonstrate the incorrect Empress inference; the retained reader must not reproduce it. The command also checks that the legacy scene loader, final level, game entry, repair, ending and journey-guide source files remain byte-identical to the baseline.

Private evidence is in `.visual-review/trumptopus-rollback/`. The report records exact baseline/candidate hashes and the result of each case. The normal build must still exclude private scene/presentation identifiers and keep the reviewed-film manifest disabled until actual footage is approved.

## Release Boundary

This is a source/save compatibility rehearsal, not a hosting rollback, cloud-sync rehearsal, physical-phone test or full campaign browser replay. It never reads real player data, calls a provider, changes remote services or runs audio. Existing opt-in cloud behavior remains outside this new adapter until the separate migration decision is resolved. Keep the existing independent backups; unavailable browser storage still cannot promise durable progress.

Before any later release: prepare and retain the exact compatible fallback artifact, verify its digest, test the actual production feature switch and safe return from an active new scene, then obtain release authorization. Never treat a green save test as permission to publish missing artwork or unreviewed films.
