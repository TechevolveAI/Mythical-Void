# When Netlify skips a real release

Netlify can skip the protected-main build when the account's build allowance is
exhausted. A passing pull-request preview can be used as an emergency production
copy, but only when the reviewed files and protected main are exactly the same.

The guarded helper is:

```text
npm run plan:netlify-promotion -- \
  --source-commit <reviewed 40-character commit> \
  --merge-commit <protected-main 40-character commit> \
  --preview-deploy <ready 24-character preview ID> \
  --main-deploy <skipped 24-character main ID>
```

This command is a dry run. It does not publish anything. It refuses unless all
of these facts are true:

- the source commit belongs to the protected-main merge;
- both commits contain exactly the same files;
- the merge includes a player-facing or hosting change;
- the preview is ready, tied to a pull request and built from that source;
- Netlify's secret checks are present and clean;
- the protected-main attempt is for the exact merge; and
- Netlify says that attempt was skipped solely because account credits were
  exhausted;
- the public site itself is not disabled; and
- fewer than two production publications have happened in the previous 24
  hours.

The two-per-day limit is a release budget, not a target. Bundle related game
changes into one reviewed release. A ready preview is not a reason to publish
again. If the site is disabled for account usage, adding another deployment
cannot restore it; the account owner must resolve the usage limit first.

Netlify pull-request builds are also reserved for branches named
`codex/release-*`. Ordinary feature and level branches must pass their local
tests and wait for a batched release branch instead of each consuming another
hosted preview. Protected-main production builds remain enabled. A release
branch should contain a small coherent group of reviewed changes, not every
unfinished branch in the repository.

If the dry run passes and publication is authorised, rerun the same command
with `--promote`. That is the only mode that changes production.

After promotion, independently open the live page on phone and desktop, check
the changed behaviour, record the source commit, merge commit, deploy ID and
publication time, and keep a working rollback address. A successful promotion
does not prove that the experience is good, that anybody saw it, or that anyone
played.

Never schedule `--promote`, infer approval from a green check, promote an older
preview, or use this path for an internal-record-only change. When Netlify's
normal production build is available, use it instead.

Production creature-picture and creature-film probes can spend hosting or AI
provider credits when their identity is not already cached. Their scripts now
refuse by default. Run one only when the release genuinely changes that service
and Kevin has approved the possible spend, using the explicit
`--allow-provider-spend` flag. Ordinary level releases do not need a new paid
portrait or film probe.
