# Commercial, Distribution, and Partnership System

**Status:** Foundation; no outreach authorized  
**Date:** 11 August 2026

## 1. Commercial objective

Build repeatable paths that expand meaningful play, product learning, revenue,
and strategic capability without weakening Mythical's control, player trust,
or youth protections.

At the current free-browser stage, commercial work has four jobs:

1. validate distribution channels;
2. build creator, press, platform, and partner relationships;
3. learn which future value customers or partners will pay for;
4. protect optionality for premium releases, expansions, licensing, publishing,
   sponsorship, education/culture, and other aligned models.

Revenue is an outcome to design deliberately, not permission to add advertising
or data collection by default.

## 2. Opportunity types

| Type | Examples | Primary value | Main risk |
| --- | --- | --- | --- |
| Distribution | Browser portals, stores, platform showcases | Qualified reach and platform learning | SDK, ads, data, exclusivity, build forks |
| Creator | Family, creature, cozy, narrative, game-tech creators | Trust transfer and observable play | Audience mismatch, child contact, disclosure |
| Press | Games, technology, animation, responsible-AI media | Credibility and discoverability | Overclaiming AI/novelty or premature story |
| Publisher | Funding, distribution, production support | Scale and capability | Rights/control, recoup, milestones, dependency |
| Brand/IP | Ethical co-promotion or licensed collaboration | Reach, revenue, world expansion | Brand safety, creative dilution, child marketing |
| Education/culture | Museums, science/space, libraries, learning partners | Mission fit and trusted access | Unsupported educational claims, procurement |
| Technology licensing | Creature/agent/animation systems | B2B revenue and validation | IP leakage, support burden, distraction |
| Sponsorship/grant | Innovation, arts, games, R&D programs | Non-dilutive support | Restrictions, reporting, public claims |

## 3. Pipeline stages

```text
Observed -> Researched -> Qualified -> Kevin-approved outreach -> Contacted
   -> Discovery -> Evaluation -> Proposal -> Diligence -> Contract
   -> Launch -> Expand / Close-lost / Archive
```

Stage entry requires evidence:

- **Observed:** public organization/opportunity and canonical source exist.
- **Researched:** current official requirements, audience, model, and risks are
  summarized; no personal enrichment.
- **Qualified:** explicit fit and disqualifier review is complete.
- **Approved outreach:** Kevin approves organization, message, sender, channel,
  purpose, and window.
- **Contacted:** actual external action ID/date and exact approved message are
  recorded.
- **Discovery:** confirmed response and next step; silence is not engagement.
- **Evaluation:** mutual requirements, data, rights, economics, support, and
  success criteria are known.
- **Proposal:** scoped commercial terms approved for presentation.
- **Diligence/contract:** legal, financial, security, privacy, rights, and
  operational review; agents do not accept/sign.
- **Launch:** owners, implementation, support, measurement, incident handling,
  and exit rights are operational.

## 4. Qualification

Rate low/medium/high with written reasoning; do not hide judgment in a single
magic score.

| Dimension | Question |
| --- | --- |
| Audience fit | Does the opportunity reach the intended player, trust gate, buyer, or amplifier? |
| Product fit | Does Mythical's current format and experience genuinely work there? |
| Trust/safety | Are youth, data, ads, communication, moderation, and content protections compatible? |
| Strategic learning | Will it answer a decision Mythical cannot answer cheaply itself? |
| Reach quality | Is reach relevant, observable, and not merely a headline audience count? |
| Economic potential | Is there a credible revenue, funding, or cost-saving path? |
| Control and rights | What licenses, exclusivity, derivative, data, AI-training, and termination rights are required? |
| Integration effort | What build, SDK, identity, payment, analytics, support, localization, or moderation work is needed? |
| Operational load | Can Mythical support updates, incidents, reporting, and partner expectations? |
| Reversibility | Can the relationship be tested and exited without harming players or the core product? |

### Automatic disqualifiers pending explicit review

- behavioral advertising or profiling of children;
- sale, enrichment, or unrelated reuse of player data;
- open child messaging or user-generated content without safeguards;
- undisclosed sponsored content or deceptive acquisition;
- rights to train on Mythical IP, gameplay, or customer data outside an
  explicitly negotiated approved purpose;
- broad IP ownership transfer, perpetual exclusivity, or unclear derivative
  rights;
- an SDK that changes privacy, security, performance, or player experience
  without technical and policy review;
- pressure to misrepresent release state, audience, AI, safety, or traction.

## 5. Outreach system

Agents may research public organizational information and draft a message. They
may not silently enrich individuals, infer personal traits, scrape private
contact data, send outreach, or follow up without approval.

Every outreach package contains:

- opportunity ID and why it is qualified;
- named organization and public source;
- recipient role/source, with no unnecessary personal profile;
- exact final message and subject;
- claim IDs and proof objects;
- sender account and disclosure requirements;
- call to action and value for the recipient;
- allowed send/follow-up window and maximum attempts;
- measurement and stop condition;
- Kevin approval and expiry.

Default sequence: one relevant message and at most one useful follow-up. No
automated chasing, artificial familiarity, or fake personalization.

## 6. Commercial decision gates

| Action | Authority |
| --- | --- |
| Public-source research and internal qualification | A0/A1 |
| Draft tailored outreach | A1 |
| Send first outreach or follow-up | A3 Kevin approval |
| Share non-public build/material | A3 plus access/rights check |
| Offer pricing or commercial terms | A3 Kevin approval |
| Accept platform SDK/data/advertising changes | A4 Kevin plus technical/privacy review |
| Sign contract, grant rights, commit spend, or accept exclusivity | A4 Kevin plus professional review |
| Launch partner integration | Approved release and incident process |

## 7. Initial web-distribution assessment

All entries are public candidates, not contacted leads or endorsements.

### itch.io — exploration candidate

Official documentation supports browser-playable HTML/CSS/JavaScript ZIPs,
with `index.html` at the ZIP root. It warns that root-absolute paths fail in its
subdirectory hosting model; browser HTML games currently accept payments as
donations rather than paid access.

Mythical implications:

- strong low-risk page/listing and early-access learning candidate;
- requires a portable base-path build because Mythical currently uses many
  root-absolute paths;
- optional cloud/API calls need iframe/CSP/CORS verification;
- donations or pricing require Kevin's commercial decision and appropriate
  account/tax setup;
- platform comments/community require moderation ownership.

Source: [itch.io HTML5 upload documentation](https://itch.io/docs/creators/html5).

### CrazyGames — conditional evaluation candidate

CrazyGames offers a reviewed Basic/Full Launch path, developer metrics and
feedback, and SDK-based platform features. Its documentation emphasizes rapid
onboarding, clear controls, consistent quality, mobile/desktop behavior, and an
audience aged 13+. Additional SDK analytics, advertising, consent, identity,
and platform-policy effects require review.

Mythical implications:

- potentially useful distribution and product evidence;
- current first-session, text density, controls, load, and mobile fit need a
  portal-specific readiness test;
- no SDK, advertising, analytics, or account integration is approved;
- age/audience and platform data flows need privacy/safeguarding review;
- an isolated adapter should prevent platform requirements contaminating the
  canonical build.

Sources: [CrazyGames launch documentation](https://docs.crazygames.com/),
[quality guidelines](https://docs.crazygames.com/requirements/quality/), and
[gameplay requirements](https://docs.crazygames.com/requirements/gameplay/).

### Poki — high-reach, high-integration evaluation candidate

Poki's current official requirements include desktop/mobile/tablet support,
16:9 scaling, incognito/local-storage resilience, SDK events, no non-Poki ads,
static and animated thumbnails, and a target initial download below 8 MB.

Mythical implications:

- the current production directory is approximately 16 MB, including about
  9 MB across MP3/OGG theme variants; measure actual initial transfer before
  concluding fit, then optimize/stream as required;
- local-storage error handling already exists, but portal runtime must be
  tested independently;
- the SDK's advertising/data behavior needs explicit youth/privacy and player-
  experience review;
- 16:9 and cross-device requirements need a dedicated QA matrix;
- do not submit before authentic thumbnails/footage and portal readiness exist.

Source: [Poki game requirements](https://sdk.poki.com/new-requirements).

### Newgrounds — community-feedback candidate

Newgrounds accepts HTML5 ZIP games with a root `index.html`, loads them in an
iframe, and has community review/API systems. API identity, save, scoreboard,
and social features are not required for an initial compatibility assessment
and would add privacy/social complexity.

Mythical implications:

- requires the same portable path/iframe build work as other ZIP portals;
- potentially useful for adult/general indie feedback rather than as a primary
  child acquisition channel;
- asset/music ownership and original-content rules must be documented;
- comments/community need monitoring and moderation decisions;
- do not connect Newgrounds identity or social systems in the first pilot.

Sources: [Newgrounds HTML5 guidance](https://www.newgrounds.com/wiki/creator-resources/game-dev-resources)
and [submission rules](https://www.newgrounds.com/wiki/help-information/content-submission).

## 8. Recommended sequence

1. Complete owned-site deployment, search verification, adult research, and
   authentic proof capture.
2. Ask Game Development for one portal-build feasibility spike covering base
   paths, iframe behavior, CSP/CORS, function/API dependencies, persistence,
   and initial transfer.
3. Use itch.io only as the technical packaging baseline because it can test
   portable delivery with limited SDK coupling; do not create a draft listing.
4. Consider Newgrounds next as an adult/general community-feedback case only
   after portable packaging and a named moderation/support owner exist; keep
   identity and social APIs off.
5. Evaluate CrazyGames after first-session, audience, SDK, advertising, data,
   privacy/safeguarding, finance, and support evidence exists.
6. Evaluate Poki last, after its harder size, device, aspect, persistence, SDK,
   advertising, asset, and operational dependencies are understood.

This is a hypothesis sequence, not authorization to create accounts, upload,
accept terms, integrate SDKs, or publish.

The detailed evidence and disqualifier review is maintained by A-032 in
[`commercial/qualification.json`](commercial/qualification.json). All four
opportunities remain researched rather than qualified.

## 9. Commercial scorecard

- sourced candidates by stage and type;
- qualified-to-approved-outreach rate;
- response and discovery rate, with small-sample context;
- time from discovery to decision;
- expected and realized reach quality;
- integration/support cost;
- revenue/funding and gross margin where applicable;
- rights/privacy/security exceptions;
- concentration by platform/partner;
- closed-lost reasons and learning;
- partner/player outcome after launch.

Pipeline counts never imply revenue. Forecasts must state probability method,
currency, time window, assumptions, and owner.
