# Lazy Scene Registration Ownership

Private successor to `7fd817de2ab0984f425deccd21c09f2accdfeac6`, 20/10/2026.
Not part of the currently hosted Google preview.

## Reproduced Fault

SceneLoader coalesced module downloads, but not scene registration. Concurrent
loadScene requests both checked the registry before awaiting the same download.
Each then called SceneManager.add for the same key. With immediate registration,
the second request reported failure despite the first succeeding. If Phaser
deferred registration, both requests reported success and its next processQueue
threw a duplicate-key exception outside the loader's error handler.

A pending download also used game.scene after awaiting. Replacing that manager
allowed an obsolete request to register into the replacement.

Four of five initial regressions failed against the parent. The separate-manager
control passed. Tests use the installed Phaser 3.90 SceneManager add, queue,
duplicate-key checks and removal, with synthetic scene plugin installation and
teardown. They do not boot a Phaser Game, renderer, browser or audio system.
This is not proof that either race caused a particular phone incident.

## Repair

- Own pending registration by manager and scene key, separately from downloads.
- Publish admission before optional loading UI can reenter; preserve its existing
  synchronous setup timing.
- Recheck the captured manager after optional feedback and the module download.
- Reuse an existing registry entry or already queued add rather than add twice.
- Clear admission after failure or completion so removal and retry still work.
- Keep the original request's loading owner on both success and failure.

The queued-registration check reads Phaser 3.90's private `_pending` array. It
never changes that queue. Native regression coverage is required when upgrading
Phaser. An accepted registration is not evidence that a scene has started or
that its create method succeeded; existing scene controllers own that handoff.

No changes to save formats, identity, progression, fusion, generation prompts,
media contracts, audio defaults, feature flags or cloud resources.

## Verification

The 16 new cases cover concurrent immediate/queued/preboot registration,
registration by another caller, separate managers, manager replacement/destruction,
loading UI reentry/failure, deliberate retry/removal and a timed-out import
finishing after a successful retry. No import-deadline timers remain.

15 focused suites / 201 tests passed. These include the new cases plus loader
recovery, Hub gate admission and re-entry, scene-router ownership, loading UI,
onboarding contracts, inventory hatching, Guardian transitions and native film
pause ownership. Flow validation, function-runtime dependency validation and
git diff --check also passed.

The tests ran with an empty inherited environment, the existing network-denial
guard, one Jest worker and no Jest cache. They did not contact a backend, cloud
API, AI provider or player record. The exact command is:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin LANG=C LC_ALL=C NODE_ENV=test CI=1 \
  /usr/local/bin/node --require ./scripts/review/deny-baseline-network.cjs \
  ./node_modules/jest/bin/jest.js --runInBand --no-cache --silent \
  --runTestsByPath \
  src/__tests__/SceneLoaderRegistrationOwnership.test.js \
  src/__tests__/SceneLoaderRecovery.test.js \
  src/__tests__/HubGateAdmission.test.js \
  src/__tests__/HubLevelTransitionRecovery.test.js \
  src/__tests__/LazyMenuSceneLoading.test.js \
  src/__tests__/LoadingOverlayLifecycle.test.js \
  src/__tests__/OpeningJourneyIntegrationContract.test.js \
  src/__tests__/PreparedFilmSceneOwnership.test.js \
  src/__tests__/GameSceneSceneRouter.test.js \
  src/__tests__/SceneRouterAdmission.test.js \
  src/__tests__/SanctuaryGateReentry.test.js \
  src/__tests__/GameLoadingWelcomeContract.test.js \
  src/__tests__/SceneTransitionHelper.test.js \
  src/__tests__/InventoryHatchTransitionRecovery.test.js \
  src/__tests__/GuardianTransitionLifecycle.test.js
```

The full suite and production build have not been rerun for this successor.
Available disk space is below the existing 35 GiB qualification reserve; that
guard was not lowered and no files were deleted. Only the small focused tests
above ran. No browser/game session or hosted preview refresh ran for this repair.

The earlier 385-suite / 6,345-test result and compiled artifact still identify
the parent, not this successor. They must not be relabelled as its qualification.
Physical-phone controls, gate round trips, audible playback and full campaign
acceptance remain separate. Production and the authorised time-bounded preview
are unchanged. No push, merge, deployment or expiry extension occurred.
