# After the first r/WebGames post is visible

This handoff records a real public post; it never creates or publishes one.
Use it only after Kevin has posted the exact approved link from an existing
adult account and can see the public post.

Keep the passing private receipt from the action-time check outside the
repository. Then record the public link and real publication time:

```sh
npm run community:record-post -- --confirm-posted --receipt /private/tmp/mythical-webgames-ready.json --post-url https://www.reddit.com/r/WebGames/comments/REAL_ID/REAL_SLUG/ --published-at 2026-09-08T12:20:00Z
```

The command refuses a different community, a tracked link, a stale or failed
receipt, an unapproved post, a missing adult reply owner, a broken live journey,
or a second publication. If it passes, it records only the public post URL and
dates the two reviews:

- after two days: public view and comment totals, plus broad anonymous website
  evidence if available;
- after seven days: the same totals, useful themes from public replies, and a
  decision to stop, learn or prepare the already-held Phaser Showcase route.

Do not copy account names, comment text, private messages or personal details
into the studio record. A view is not a player, a website visit is not a play,
and either total may honestly be zero.
