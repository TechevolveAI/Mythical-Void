# Immutable Regression Sources

These files are historical test inputs, not game modules or player records.
`manifest.json` records each original commit, repository path, byte count and
SHA-256. Identical bytes retain their original reference even when the current
implementation changes. Do not regenerate a control from current source to make
a regression pass.

`support/pinnedSourceFixture.cjs` verifies the bytes before returning source.
Missing, unknown or changed inputs fail instead of consulting Git history,
fetching a commit or using today's implementation. This supports a fresh or
shallow checkout without the development branch's private commits.

The synthetic save inputs retain the original 19-fixture manifest and its
checksums. Unsupported valid saves are still reported as protected HOLDs, not
reset, discarded or counted as successful round trips.

Run the offline development checks, with the locked dependencies installed:

```sh
npm run test:baseline:isolated
```

For exact committed-save evidence, start from a clean checkout:

```sh
node --require ./scripts/review/deny-baseline-network.cjs scripts/review/verify-candidate-saves.cjs
```

The second command reads the candidate from its own local HEAD. Historical
baseline modules and save fixtures come from this directory, not other commits.
Neither command changes the active backend, opens the game, calls AI providers
or uses real player data. Passing tests do not establish phone usability,
browser-storage eviction recovery, hosted migration acceptance or visual quality.
