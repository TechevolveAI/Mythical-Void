# Release flow guard repair

Private qualification, 20/10/2026. No gameplay, save, provider, migration,
hosting, dependency or production changes.

## Finding

`scripts/validate-game-flow.js` invokes `validateFile` with absolute paths, but
looked up protected review markers using relative dictionary keys. Absolute,
dot-relative and normalised absolute paths could therefore bypass the marker
check. A missing marker was rejected only when the input matched the dictionary
key exactly.

The CLI also required obsolete global `GameState.set` / `GameState.save` calls
and an old timer-based opening sequence. The active opening instead creates a
detached draft, verifies `commitHatchSaveDraft`, and checks scene/campaign
ownership before continuing. The guard now follows that implementation, rather
than requiring the discarded save path to be reintroduced.

## Repair and regression coverage

- Apply review-marker policies to both the declared repository path and the
  canonical target. An alias cannot remove either applicable policy.
- Retain unreadable-file failure and all seven declared source contracts.
- Check the verified draft publication and ownership fences in the current
  Start path. Runtime behaviour remains covered by `HatchingFirstStartSafety`
  and `HatchingPersistenceContract`.
- Exercise every declared source contract in `GameFlowValidator.test.js`, which
  is included in the existing full Jest CI job. No workflow or branch protection
  was changed.

The clean marker reproduction failed six cases before the repair, while the two
relative-path controls and original save-contract test passed. An earlier probe
was confounded by the three stale Hatching patterns and is not counted as clean
marker evidence. The repaired validator suite has 20 cases.

## Verification and limits

- Validator plus Hatching safety/persistence: 3 suites, 88 tests passed.
- Existing static onboarding gate tests: 4 suites, 36 tests passed.
- Flow CLI: all seven declared files passed.
- Function runtime dependency guard: three server dependencies passed.
- Prepared emergency fallback: seven offline static/VM checks passed; inactive.
- Diff whitespace check passed.

Checks used a stripped environment and the existing Node network-denial guard.
That guard is not an operating-system sandbox. Source patterns and review
markers are supplementary safeguards, not semantic correctness proofs.

The game runtime is byte-identical to parent
`90e81b54b9ab0cd21130a6f131cc2e32fcade18c`. Its separately recorded full result
was 384 suites / 6,298 tests and a direct production Vite compile. Those are
inherited runtime evidence, not a newly executed full suite or complete release
pipeline for this scripts-only successor.

No browser, game, server, audio, provider or player-record session was opened.
No fallback activation, push, merge or deployment was performed. The fallback
is an emergency whole-site pause, not a playable rollback or server write lock;
offline/unupdated tabs and already-sent requests remain outside its control.
Hosted takeover, physical-device acceptance and normal protected release gates
remain separate requirements.
