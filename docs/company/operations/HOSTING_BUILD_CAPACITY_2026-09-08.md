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
