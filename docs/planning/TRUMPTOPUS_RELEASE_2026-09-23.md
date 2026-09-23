# Trumptopus Finale Release

Kevin reviewed the silent authored film drafts and said they looked cool, then
explicitly requested: "Yes okay, do the release and then deploy" on 2026-09-23.
This authorizes the finale integration and production release, not infrastructure
migration, new AI generation or a claim of completed physical-device review.

## Scope

- Normal Final Void gate uses the reviewed approach and three-phase Trumptopus fight.
- Production shell adds pause, checkpoint retry, inventory power-ups and exit.
- Real saved creature and earned katana upgrades, not a fixture identity/loadout.
- Shared 8-second arrival and 16-second banishment films, optional Watch/replay/skip.
- Films are silent authored animation of supplied artwork, not fresh model output.
- Durable banishment, Nova/Command Module rewards and existing ending choices.
- Other levels, infrastructure, credentials, backend and website copy unchanged.

## Provenance

The two MP4 files are byte-for-byte copies of the private authored export at
`7dc6e48d3558ee909a54a201278bdd46e32fd8bc`. The exact digests, byte lengths and
duration are in `src/config/final-void-films.json`. Their production use is now
approved by Kevin; earlier private-only review documents are historical.
The supplied boss and landscape source/provenance remain in
`src/dev/assets/trumptopus/`. Runtime WebP files preserve their dimensions and
alpha, using cwebp quality 92 (body) and 90 (landscape); no replacement imagery.
No generation API or player data was used. Upstream image rights are supplied
by the owner; this is provenance, not an independent license certification.

## Release and Rollback

Start from protected main `fd4f3f18e4390f8e6584732e6626cedc72b431a6`.
Use the existing production hosting pipeline, independently of Google migration.
The source release switch is `src/config/final-void-release.json`.
To roll back only the encounter set `encounter` to `legacy-empress` and disable
`src/config/final-void-films.json`. Retain the new save, receipt, inventory and
guardian-history compatibility code. Do not roll back to a bare older artifact:
it misinterprets a new finale win as an Empress rescue. Never clear player saves.

Release verification and exact deployed source will be recorded with the candidate.
Silent automation is not physical iPhone/Samsung, audio or subjective difficulty approval.

## Repeatable Verification

- `npm run gate:onboarding:static`
- `npm run test:deploy` (258 suites / 2,530 tests at preparation)
- `node --test scripts/__tests__/Trumptopus*.test.mjs` (50 geometry/art tests)
- `npm run build` (full existing production and portal-package gates)
- `node scripts/smoke-trumptopus-release.cjs` (muted built-game browser journey;
  synthetic prior-level completion; real joystick, jump and attack inputs)
- `node scripts/verify-trumptopus-rollback.cjs` (11 save compatibility cases)
- `node scripts/build-trumptopus-rollback.cjs` (compatible fallback archive)

The release browser journey covers both packaged Watch films, all three combat
phases, inventory menu, pause/retry, injected death recovery, phone rotation,
reward persistence, ship installation, choice/back, interrupted epilogue,
cancelled New Game+ and return to Sanctuary. It does not pretend to replay the
five prior levels or validate live cloud/media-provider requests. Browser errors,
failed asset responses and outside requests fail this isolated journey.
Existing completion CI runs this journey for the selected new finale and retains
the older staged Guardian check for the legacy fallback. The new full-fight
journey has a five-minute timeout; existing staged journeys remain at three.

The shared runtime retains the private source module names to avoid duplicating
the tested encounter. Only the campaign shell is registered in production.

## Opening Package Measurement

The release build's portal-package measurement has 19 opening dependencies,
instead of the historical 18: shared film/result UI is a separate 3,555-byte CSS
resource (1,091-byte gzip estimate). The measured opening is 3,982,947 bytes gzip,
still under the existing 5 MiB advisory. Neither film nor boss art is in this
opening closure. The exact count gate is updated to 19 with a new rejection test
for accidentally eager finale media; no size ceiling or distribution authority
is relaxed. The historical August assessment remains historical, not a fresh
worldwide load-time or portal-approval claim.
