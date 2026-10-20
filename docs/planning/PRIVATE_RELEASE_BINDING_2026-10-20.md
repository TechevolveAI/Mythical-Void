# Private release binding

Private repair, 20/10/2026. Parent: `4853cef8e7a19371f61e9b45f7e153a8ba58fb40`.

## Reproduced gap

The packaging CLI wrote the service worker before validating the document and
direct-play metadata. Failed packaging could therefore leave inconsistent
release files. A missing worker incorrectly returned success, and a previously
bound worker could retain an old version while the document received a new one.
Retrying packaging also changed the worker's fallback comparison before failing.

Eight native Node CLI tests, using only synthetic temporary directories and
copies of the existing templates, reproduced seven failures and one successful
control before the repair. This is build-tool evidence, not seven observed
production incidents.

## Repair

`prepareReleaseFiles` retains the existing CLI default directory, homepage
metadata builder and worker format. It also accepts an isolated artifact
directory for offline qualification.

- Require both files and unambiguous unbound release markers.
- Require a positive safe-integer release version.
- Generate and validate direct-play HTML before writing any release content.
- Bind the worker initializer, homepage and `/play/` document to the same version.
- Keep the worker's literal fallback comparison intact.
- Refuse stale/repeated inputs without changing existing successful output.
- Report required read/write errors as failures, never successful skips.

The 14 repair cases and existing direct-play, production-bundle, installation,
worker-update and client-update checks passed: six suites / 38 tests.
The existing installation source check changes only its directory parameter
name; native CLI and VM assertions now additionally prove the binding behaviour.

This is preflight-before-write, not an atomic multi-file filesystem transaction.
A disk/write failure can still leave an incomplete artifact; the caller must
discard it from promotion and build into a fresh directory. The private
qualification writes its successful manifest only after all artifact checks.

## Private artifact qualification

The external `qualify-private-release-binding.cjs` driver in this chat's
`review-evidence-2026-10-20` directory builds the exact clean source into a new
private directory. It uses a stripped environment, the existing Node network
guard, an empty environment-file directory and the current commit as release ID.
It does not inherit production credentials or active backend choices.

Existing public files are copied without the withdrawn-media paths in the
publication register. No originals are removed or rewritten, and no website or
distribution generators run. Existing direct-play and production-bundle
validators remain authoritative. The driver also checks compiled module inputs
against the existing held-feature policy, file hashes, local entry references
and worker/document version agreement.

No game, browser, server, audio, hosted preview, provider or player-record session
is started. No game runtime, saves, identity, Fusion, media contracts, assets,
website source, dependency, hosting, workflow or migration implementation changes.

## Remaining release gates

This offline artifact is not a production-configured release or permission to
publish. The complete protected release pipeline, aggregate source review,
secret/security checks, hosted configuration and delivery checks, browser/phone
acceptance, actual film decoding and adult visual approval remain separate.
Inherited full-game evidence must not be described as a new full-suite run.
The protected fallback remains inactive and Google migration adoption is held.
