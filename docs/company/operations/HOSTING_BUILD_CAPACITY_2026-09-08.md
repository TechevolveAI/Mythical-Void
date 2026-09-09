# Keep website release capacity for website changes

On 8 September 2026, Netlify skipped production deploy
`6aa02b4376fc9b000968ab00` because the account's build-credit allowance was
exhausted. The source was protected-main commit
`cfc35236dc2aeb1d8f5abe7ebf6197e4b4e08d9f`.

That commit repaired private studio checks and decision records. It did not
change the public website or game, so the skipped rebuild did not leave a
public feature waiting. The existing production site passed the complete live
health audit immediately afterwards.

## The prevention rule

Netlify now checks the changed file list before starting a full build. It skips
only when every changed file is one of these private studio records:

- `docs/company/operations/`
- `docs/company/research/`
- `docs/company/reviews/`
- `docs/company/FOUNDER_CONTROL_PAGE.md`
- `docs/company/NOW_NEXT_LATER.md`

Any game file, public page, function, hosting rule, dependency, package file,
build script, company content source, or mixed change continues through the
full build. Missing commit information, an empty comparison, or any comparison
failure also continues through the full build.

This is a capacity guard, not a release shortcut. It does not deploy, change a
hosting plan, spend money, weaken tests, or treat an internal record as public.
When Netlify's allowance becomes available again, real player-facing changes
will still receive the normal production checks.

## What happened later that day

Netlify also skipped production deploy `6aa0732848e62100096cde30` for protected
main commit `f3622d644f14f962e7852d1c033c1ac85510bb1c`, this time after a real public
change. The exact PR build had already passed the required checks as ready
deploy `6aa07296dca6c000088eae8c`. That immutable build was promoted to production,
then the live homepage and `/play/` addresses were checked independently.

This is an emergency capacity path, not the normal release path. Reuse it only
when the production build was skipped solely for exhausted credits, the exact
PR deploy is ready, the PR is merged through protected main with no additional
content, and the live result is checked afterwards. Never promote a failed,
unreviewed, stale or source-mismatched preview. Restoring a previous deploy does
not prove that a later source change is live.

## Guarded fallback tool

The manual emergency checks are now encoded in
`scripts/company/netlify-preview-promotion.cjs`. It is dry-run only unless an
operator adds `--promote`, and it refuses a different source tree, unrelated
commit, stale or failed preview, secret-scan finding, non-credit build failure,
already-published preview, or change with no player-facing files. The plain
runbook is `docs/company/operations/NETLIFY_PREVIEW_PROMOTION_RUNBOOK.md`.

This reduces release mistakes; it does not make publication unattended and it
does not replace the normal protected-main build.
