# Record what happened after the r/WebGames post

This handoff records the two-day and seven-day checks after a real post. It
does not visit Reddit, fetch reports, post, reply, open an account or collect a
person's details.

At the due time, an adult reads the public post and the approved anonymous
aggregate reports. Record each available number exactly. Use `unavailable`
when a source does not show a number. Zero is valid only when the source
actually shows zero.

```sh
npm run community:record-observation -- \
  --confirm-observed \
  --period day2 \
  --post-url https://www.reddit.com/r/WebGames/comments/REAL_ID/REAL_SLUG/ \
  --observed-at 2026-09-10T12:20:00Z \
  --platform-views 0 \
  --public-comments 0 \
  --social-or-creator-arrivals unavailable \
  --adult-forum-feedback 0
```

Repeat with `--period day7` only after the two-day record exists and the
seven-day time has arrived. The command refuses an unpublished or different
post, an early or future check, a second record, missing totals, negative or
fractional numbers, and unexpected fields. It writes only:

- public post views when Reddit shows them;
- public comment count;
- consented website arrivals in the broad social-or-creator group;
- anonymous adult feedback count for the forum route;
- which of those four totals were unavailable.

Do not store account names, handles, comment text, private messages, browser
cookies, email addresses or personal details. A post view is not a player. A
website arrival is not a play. A comment does not prove enjoyment or return.
The seven-day record closes this one experiment; it does not automatically
authorize the Phaser Showcase or any other post.
