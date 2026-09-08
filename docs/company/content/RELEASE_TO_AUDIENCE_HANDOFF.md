# From a live release to the next audience

The old draft builder did one useful job: it turned every checked Latest News
entry into three reusable pieces of writing. It did not choose what should
happen next. By 8 September 2026 that meant 16 old entries and 48 drafts could
sit in a file while the public Latest News had already moved to 17 entries.

The release-to-audience hand-off fixes both problems.

Run:

```sh
npm run build:release-to-audience
npm run validate:release-to-audience
npm run test:release-to-audience
```

The first command refreshes the full draft pack from the live news source and
then creates one short queue at
`docs/company/content/generated/release-to-audience-queue.json`.

The queue answers four plain questions:

1. What is the one best audience move now?
2. What exact wording and link are prepared?
3. What still needs Kevin?
4. Why is everything else waiting?

At present, the answer is one text-only r/WebGames post leading straight to the
live game. It still needs Kevin to confirm the adult Reddit account, approve
the exact post at the time it is made and handle replies. The tool does not
publish, open an account, accept terms, reply, spend money or manufacture
activity.

The normal production build now refreshes and checks this hand-off. That means
a new checked Latest News entry cannot quietly leave the audience drafts one
release behind again.

Passing these checks means the records agree and the claims stay honest. It
does not mean a post is approved, an image looks good or somebody played the
game.
