# OFF-only monitor release preservation

This local Netlify build plugin carries the exact monitor already published on
12/10/2026 into future Git builds. It adds no tracking, collector or consent UI.
It does not enable counting and does not alter provider secrets or website files.

The reviewed ZIP is intentionally vendored. It contains the monitor, its public
database CA and bundled dependencies, including pg 8.22.0. Its SHA-256 is pinned
in the plugin and the independent packaging guard. No dependency installation or
runtime rebuild occurs in this plugin. Source reference files are provided for
review, not as an automatic rebuild command. Rebuilds require a new review.

Netlify runs `onPostBuild` after Functions bundling and before deployment. The
plugin reads the real version-1 Functions manifest, requires the seven existing
function names, copies the reviewed ZIP and adds its reviewed version-2 Node 22
metadata and 15-minute schedule. It then re-reads and validates both the final
manifest and actual ZIP. It refuses unknown functions (including a collector),
duplicates, missing existing functions, changed monitor metadata or bytes. An
already-present monitor is checked, never silently replaced.

The plugin has no network calls. Database credentials and the heartbeat URL
remain production Functions-only secrets. Netlify scheduled functions run only
in production. Direct API/CLI deployments that skip Netlify Build also skip this
plugin and must run the guard explicitly against their final packaging results.
Neither this plugin nor its tests can prevent a maintainer from removing it.

Run from the repository root:

```sh
node plugins/netlify-plugin-off-only-monitor/test-monitor-release.cjs
node --test plugins/netlify-plugin-off-only-monitor/test-plugin.cjs
```

These commands are also in the required opening-journey workflow. A passing
check proves packaging preservation, not live health, human visual approval,
privacy readiness or permission to count players.

After a release, separately verify the website file digests, eight deployed
functions, 15-minute monitor schedule, public route rejection, fresh maintenance
health and automatic heartbeat. Both counting locks must stay off.

Reference: https://docs.netlify.com/extend/develop-and-share/develop-build-plugins/
