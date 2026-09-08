# r/WebGames action-time check

This check makes one careful community launch repeatable. It does not post,
open an account, accept terms or reply to anyone.

Run the public, read-only checks at any time:

```sh
npm run community:preflight
```

The result prints the fingerprint of the exact title, game link and first
comment. When Kevin is ready to post, copy
`COMMUNITY_ACTION_TIME_PREFLIGHT_TEMPLATE.json` to a temporary private file
outside the repository and fill in only the fields shown. Do not add an account
name, email address, password, cookie, private message or comment text.

The two Reddit observations must be made by an adult in a normal browser:

- Read the current r/WebGames rules and confirm the prepared rules still apply.
- Search r/WebGames for “Mythical Void” and record whether a previous post is
  visible.

Then run:

```sh
npm run community:preflight -- --action-time /private/tmp/mythical-webgames-approval.json
```

The action-time command refuses stale approval, stale rules, a duplicate,
changed copy, a broken game, a wrong or missing preview, or a failed fresh
opening journey. Kevin’s exact post approval lasts 30 minutes. The Reddit
checks and owned-site checks last two hours.

Even a passing result does not publish. It means a person may paste the exact
prepared link post into the confirmed adult account. Kevin remains responsible
for replies. A post view is not a player, and a website visit is not a play.
