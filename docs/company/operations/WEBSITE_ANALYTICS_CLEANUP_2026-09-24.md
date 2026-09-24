# Website-only analytics cleanup — 24 September 2026

Kevin approved this phase explicitly: “Approved website-only analytics cleanup.”

## Scope and boundary

This phase measures the public website only: visits, broad arrival source, website Play/share buttons, and native trailer viewing. It does **not** measure a game start, hatch, level completion or ending. A Play click is not proof of playing. No game implementation, gameplay test journey, retention setting, reporting identity, active filter, account permission, product link or external post is changed by this phase.

This is a new change record, not a rewrite of the historical August/September evidence in `docs/company/automation/website-analytics-tag.json`.

## Website implementation

- Basic consent gate: no Google script or request is initiated until consent is granted. Stored allow/deny and the existing owner exclusion are respected. Storage failure uses a current-page choice rather than silently granting consent.
- One explicit `page_view` per permitted document; automatic page views disabled in tag configuration. Only fixed public path categories, a fixed page title, blank referrer and allowlisted campaign values are sent. No arbitrary URL query, fragment, custom title or unknown path is passed through.
- The footer has “Analytics choices”. Withdrawal disables collection, clears first-party GA cookies and reloads the page to remove Google's listeners. The owner exclusion overrides consent, including a cross-tab opt-out.
- `entry_source`: direct_or_private, owned_site, search, game_shelf, youtube, linkedin, social_or_creator, other_site. Missing referrers remain unknown/direct; do not invent attribution.
- `source_area`: fixed website button/section categories. `source_page`: fixed public route categories, otherwise `/other/`.
- Native film events: `trailer_start` only after actual advancing playback, `trailer_progress` at unique watched coverage 25/50/75/90 percent, `trailer_complete` only at the end after at least 90 percent actual coverage. Parameter `watch_bucket` is one of `25`, `50`, `75`, `90`. Hidden, paused, seeking and pre-consent time are not counted; replay does not add duplicate coverage.
- One source template is embedded synchronously in the homepage and discovery script. Run `node scripts/company/sync-website-analytics-core.cjs` after changing it; `npm run test:website-analytics` checks parity and consent behaviour without sending requests.

## Approved property changes

Account 404372787 / property 549579406 / stream 15420950256 / measurement G-FTM4W73ECQ.

Verified in the signed-in Google interface on 24 September:

- Enhanced measurement: scrolls, outbound clicks, site search, forms, video engagement and file downloads OFF; browser-history page views OFF. The mandatory page-load category remains shown, while website configuration suppresses its automatic page view and sends the explicit event.
- Granular location and device data collection OFF.
- Ads personalisation allowed in **0 of 307 regions** (previously 307 of 307).
- Google signals and user-provided data remain OFF.

The following four Event-scoped custom dimensions were saved and verified in the table (4 of 4): Website entry source (`entry_source`), Website button area (`source_area`), Website page category (`source_page`), Trailer watched coverage (`watch_bucket`). Retention, internal-traffic filter state, reporting identity and historical data are unchanged.

## Verification before release

- Full `npm run build` completed successfully; the final Vite build also passed after the last source adjustment.
- Website consent runtime: 29 offline cases; legacy analytics contract: 33; owner opt-out: 28; owned discovery: 26; Play-intent website checks: 32; website Jest suites: 19 tests. No gameplay browser journey was run locally.
- Browser review used a temporary localhost server with third-party scripts/connections blocked by CSP and game routes disabled. Verified fresh refusal, remembered refusal, reopening choices, one page-view/arrival queue after allowing, and withdrawal returning to zero Google scripts/events after reload. Discovery pages also retain refusal and expose the choice control. This checks browser behaviour without sending synthetic events into the live property; it does not prove Google receipt.
- Release through protected-main PR #331; deployment and organic event receipt must be verified separately. Existing build-generated external-platform measurement files are not included in the website change.

## Clean campaign links (prepared, not posted)

YouTube description:
`https://mythicalvoid.com/?utm_source=youtube&utm_medium=organic_video&utm_campaign=through_the_void_launch&utm_content=trailer_description`

LinkedIn founder post:
`https://mythicalvoid.com/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=through_the_void_launch&utm_content=founder_post`

The site accepts only these complete known conventions; arbitrary values are ignored. Referrer-only YouTube/LinkedIn arrivals also receive their broad source classification. No internal link gets campaign tags. No previously published YouTube/LinkedIn link has been edited by this cleanup.

## Interpretation and remaining work

Reports cover only visitors who consent and whose browsers deliver analytics. They are not a census of people. Historical missing page views and missing attribution cannot be reconstructed. New custom dimensions are prospective and can take 24–48 hours to appear. Automated checks prove implementation behaviour, not human engagement or business growth.

Gameplay milestones remain a separate privacy/design decision because the game intentionally includes a young audience. Do not turn on game Google tracking under this website-only approval. A durable reporting connector is also not established merely because the signed-in Analytics interface is available.

Reference: [Google tag configuration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [enhanced measurement](https://support.google.com/analytics/answer/9216061), [custom dimensions](https://support.google.com/analytics/answer/14240153).
