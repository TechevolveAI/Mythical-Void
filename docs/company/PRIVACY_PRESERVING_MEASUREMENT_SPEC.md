# Privacy-Preserving Measurement Specification

**Status:** A-006 offline contract pilot; no new collection is authorized  
**Date:** 11 August 2026  
**Decision gate:** Kevin approval plus privacy/DPIA review

## 1. Measurement objective

Answer a small set of business and product questions without creating a
cross-session child profile:

1. Can people find and understand Mythical Void?
2. Does the public page lead to a successful game load?
3. Do players reach the first meaningful companion moment?
4. Where do aggregate first-session attempts stop?
5. Is the experience technically healthy across coarse device classes?
6. Which approved campaign/message produces meaningful play attempts?

The initial system will not answer individual retention, lifetime value,
behavioral segmentation, personalized marketing, or per-player journey
questions. Those are deliberately out of scope.

The machine-readable proposal lives at
[`measurement/event-contract.json`](measurement/event-contract.json). A-006
validates the event/property allowlists, prohibited fields, disabled state,
approval gates, and selected source-code signals. It has no endpoint and cannot
collect an event.

## 2. Measurement modes

### M0 — operational aggregate, current baseline

Use hosting/CDN aggregate totals for uptime, status codes, bytes, and coarse
route demand where available. Do not export or enrich raw IP/request logs for
marketing or player behavior analysis.

Required before use:

- verify exactly what Netlify collects, exposes, retains, and processes;
- document vendor/configuration and access;
- restrict raw log access to operations/security;
- report company metrics only as aggregates.

### M1 — identifier-free first-party event counters, recommended pilot

Each eligible event is a separate first-party request with:

- no account, cookie, persistent identifier, fingerprint, advertising ID, or
  transmitted session ID;
- no name, age band, date of birth, email, location, creature identity,
  genetics, story choice, free text, or raw URL/referrer;
- no third-party tracker or cross-site sharing;
- a controlled event name and schema version;
- coarse client/runtime buckets only where necessary;
- a campaign code accepted only from a server allowlist;
- local tab-level suppression to avoid sending the same milestone repeatedly,
  without transmitting the suppression key.

The server increments aggregate counters and discards request-level payloads.
Infrastructure security logs may still contain IP addresses; they remain
separate, short-lived, access-restricted, and unavailable to growth analysis.

This mode estimates event and funnel ratios, not unique people. Reports must
say `events` or `attempts`, never `users`, unless uniqueness is actually and
lawfully measured.

### M2 — pseudonymous longitudinal measurement, deferred

This would introduce a first-party identifier for return/cohort measurement.
It remains off until:

- the business question cannot reasonably be answered by M0/M1/research;
- a DPIA and legal-basis/consent review is complete;
- age/child protections and withdrawal are technically enforced;
- purpose separation prevents marketing or third-party use;
- retention, deletion, access, and vendor terms are approved;
- the site and in-game explanation is child-appropriate;
- Kevin approves the exact schema and autonomy level.

No session replay, heatmaps recording content, fingerprinting, third-party ad
pixels, cross-site identifiers, lookalike audiences, or behavioral advertising
are permitted in any proposed mode.

### M3 — moderated research

Use consented observation to answer questions that counters cannot: intent,
confusion, emotional response, trust, accessibility, expectation, and why a
player stopped. Research notes follow the Customer Intelligence System and
remain separate from analytics.

## 3. Initial event dictionary

Events describe product milestones, never personal characteristics.

| Event | Fires once per tab attempt when | Decision served |
| --- | --- | --- |
| `storefront_loaded` | Storefront becomes usable | Technical landing health |
| `play_selected` | A player activates a Play link | Storefront-to-play intent |
| `game_boot_ready` | Core game reaches an interactive ready state | Load success |
| `age_settings_applied` | Local privacy mode is applied | Gate completion only; do not transmit band |
| `hatch_started` | First hatch interaction begins | Early interaction |
| `hatch_completed` | Creature reveal completes | Core activation step |
| `first_bond_completed` | Defined first meaningful bond interaction completes | Activation candidate |
| `first_expedition_started` | First expedition becomes active | Journey continuation |
| `first_realm_completed` | First realm success commits | Deeper value |
| `return_session_started` | Reserved for M2 only | Not available in M1 |
| `client_error` | Allowlisted error category blocks or degrades play | Reliability |
| `performance_bucket` | One coarse performance summary after a fixed window | Device/runtime health |

Before implementation, Game Development must confirm the authoritative code
boundary for each milestone and whether the moment is already committed to
local game state. A UI click is not completion.

## 4. Allowed properties

All properties use enums; unknown values become `other` rather than raw text.

| Property | Allowed example | Prohibited detail |
| --- | --- | --- |
| `schema_version` | `1` | Build secrets or arbitrary client data |
| `release_channel` | `production`, `preview` | Branch/user identifiers |
| `build_bucket` | Approved public build ID | Git author or local paths |
| `route` | `storefront`, `play` | Full URL, query string, fragment |
| `viewport_class` | `small`, `medium`, `large` | Exact dimensions |
| `input_class` | `touch`, `keyboard`, `mixed`, `unknown` | Device fingerprint fields |
| `runtime_class` | `mobile_web`, `desktop_web`, `unknown` | User agent string |
| `campaign_code` | Server-approved opaque campaign | Raw UTM/referrer/search query |
| `error_code` | Approved stable taxonomy | Stack trace, message, save state |
| `performance_class` | `good`, `degraded`, `poor` | High-entropy timing vector |

Never include the locally selected age band. Apply the strongest collection
policy to all M1 traffic.

## 5. Processing and storage contract

```text
Browser milestone
  -> local schema validation
  -> first-party HTTPS endpoint
  -> server allowlist + size/rate validation
  -> aggregate counter by day/event/coarse properties
  -> discard event payload
  -> company dashboard reads aggregates only
```

Proposed limits:

- payload at most 1 KB;
- reject unknown events/properties rather than storing them;
- no request body logging at the application layer;
- security rate limiting separated from analytics data;
- daily aggregate dimensions reviewed for re-identification risk;
- suppress cells with very small counts in company reports;
- aggregate retention initially 13 months, subject to privacy review;
- infrastructure raw-log retention minimized to the vendor/configuration
  minimum compatible with security and incident response;
- no data export to ad, enrichment, or model-training systems.

## 6. Metric definitions

During M1, use attempt/event language:

| Metric | Definition | Important limitation |
| --- | --- | --- |
| Play-selection rate | `play_selected / storefront_loaded` | Tab attempts, not unique people |
| Game-ready rate | `game_boot_ready / play_selected` | Direct `/play/` visits distort denominator |
| Hatch completion | `hatch_completed / hatch_started` | Retries across tabs may duplicate |
| Activation proxy | `first_bond_completed / game_boot_ready` | Definition needs observed validation |
| First-realm depth | `first_realm_completed / game_boot_ready` | Not same-session attributable without ID |
| Error event rate | `client_error / game_boot_ready` | Multiple errors may occur in one attempt |
| Campaign activation proxy | Approved campaign counter ratios | No cross-session attribution |

Do not calculate M1 step-to-step funnels as if events were joined into an
individual path. Ratios are directional aggregate indicators.

The interim company outcome is **Meaningful Play Completions per 100 Game-Ready
Events**, paired with moderated research. `Meaningful Player Weeks` stays a
future candidate because it requires defensible uniqueness and return logic.

## 7. Validation gates

Before production:

- threat model and DPIA/privacy review;
- vendor and network data-flow verification;
- schema unit tests and unknown-field rejection tests;
- proof that no age band, save data, creature data, names, free text, URLs,
  identifiers, or stack traces can leave the browser through the client;
- proof that endpoint/application logs do not store request bodies;
- synthetic-event reconciliation within an agreed tolerance;
- small-cell suppression and dashboard wording review;
- opt-out/disable mechanism and kill-switch exercise;
- privacy notice and child-appropriate explanation updated to actual behavior;
- incident owner and deletion process named;
- Kevin approval recorded in D-003.

## 8. Build/buy recommendation

Start with the small first-party M1 counter, not a general-purpose analytics
SDK. A broader analytics product may be evaluated later only if it can be
configured and contractually limited to this data model without hidden
collection, autocapture, replay, fingerprinting, cross-product identity, or
vendor reuse.

The implementation should remain portable: event vocabulary and aggregate
tables belong to Mythical, while transport/dashboard tooling can change.

## 9. Legal and governance note

This is a privacy-engineering proposal, not a legal determination. Persistent
identifiers can be personal information under COPPA, and analytics exemptions
are limited by purpose and use. Irish and UK child-data guidance emphasizes a
high default, transparency, minimization, and DPIA/risk assessment. Obtain
professional review against actual deployment, vendor contracts, and target
markets before activation.

Primary references:

- [FTC COPPA FAQs](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [FTC 2025 COPPA amendments summary](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data)
- [Irish DPC child-oriented processing fundamentals](https://www.dataprotection.ie/en/dpc-guidance/fundamentals-child-oriented-approach-data-processing)
- [ICO mobile gaming DPIA example](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/dpia-tools/mobile-gaming-app/step-2-describe-the-processing/)
