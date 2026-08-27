# Company → Game Development Handoffs

This queue proposes evidence, outcome, and constraints. The Game Development
task owns technical design and implementation unless Kevin assigns otherwise.

## GDH-001 — Search discovery foundation

**Status:** Implemented locally; awaiting release coordination  
**Evidence:** live `/robots.txt` and `/sitemap.xml` returned the SPA HTML shell
on 11 August 2026; sampled branded search results did not show the owned site.  
**Change:** real robots/sitemap/llms files and structured `VideoGame` metadata.  
**Success:** deployed files return correct content types/content; sitemap is
accepted by webmaster tools; owned result becomes eligible for branded search.  
**Constraint:** do not deploy from this company task while the shared game
working tree contains active development changes without coordination.

## GDH-002 — Define authoritative activation milestones

**Status:** Proposed; no collection authorized  
**Problem:** the company cannot distinguish a page load from meaningful play,
and UI clicks are not reliable completion events.  
**Request:** identify authoritative committed state boundaries for:

- game ready;
- hatch started/completed;
- first meaningful bond completed;
- first expedition started;
- first realm completed;
- allowlisted blocking client errors.

**Expected outcome:** a stable event contract that can feed identifier-free
aggregate counters if D-003 is approved.  
**Constraints:** no age band, identifier, save, name, creature data, free text,
raw URL/referrer, exact device fingerprint, or story choice leaves the browser.
See [measurement specification](../PRIVACY_PRESERVING_MEASUREMENT_SPEC.md).

## GDH-003 — Parent-mediate community submissions

**Status:** Safety copy implemented locally; awaiting release coordination  
**Problem:** the storefront tells young designers to ask permission before
emailing artwork, allowing direct child-originating submissions with potential
identity, image, and metadata exposure.  
**Request:** require a parent/guardian to send a young designer's submission;
state that surname, face, voice, school, location, and child contact details
must not be included.  
**Longer-term:** create or pause submissions until purpose, permission,
retention, publication, attribution, deletion, attachment scanning, and
safeguarding handling are approved.  
**Success:** no public copy invites a child to contact Mythical directly.

## GDH-004 — Capture authentic product proof

**Status:** A-027 capture specifications ready; awaiting named stable build,
proof owner, capture operator, and independent reviewer  
**Problem:** current public marketing assets are illustrations and cannot prove
gameplay, companion memory, animation, restoration, or choice. Existing
`media/` images inspected by the company task are unrelated editor/demo
screenshots.  
**Request:** capture first-party footage from a named stable build for:

1. hatch through a concrete first bond response;
2. before-and-after realm restoration with player action visible;
3. a Project Beacon discovery/choice without ending spoilers.

**Constraints:** no player/child identity, entered creature name, account data,
debug secrets, notifications, desktop identifiers, or third-party copyrighted
audio. Record build/date, edits, provenance, rights, alt text, and applicable
claim IDs in the proof library.  
**Success:** PF-003 through PF-005 become approved proof objects and can be used
by A-003 without being misrepresented as pre-rendered gameplay.

The exact shot sequence, claim boundary, non-claims, capture settings, privacy
screen, output set, and acceptance record are defined in
[`content/proof-production.json`](../content/proof-production.json). A-027 does
not authorize capture or publication.

## GDH-005 — Portal-build feasibility spike

**Status:** Proposed; do not integrate a platform SDK  
**Evidence:** this original broad feasibility request is now superseded for
Poki by the measured GDH-007 request below. The tested portal package proves
portable ZIP/iframe delivery, but each portal still needs its own runtime,
rights and service review.
**Request:** produce a scoped technical assessment for:

- OP-001 as the portable packaging baseline, with OP-004, OP-002, and OP-003
  used in that order as increasingly demanding requirement cases;
- configurable base paths and portable asset/routing behavior;
- iframe/fullscreen/input/audio compatibility;
- CSP, CORS, Netlify function, Supabase, and optional external API behavior;
- local-only persistence and incognito behavior;
- measured initial transfer and audio loading strategy;
- portal-specific SDK isolation behind adapters and feature flags;
- a desktop/mobile/tablet QA matrix.

**Constraints:** no portal account, upload, SDK, advertising, analytics, identity,
or terms acceptance is authorized. Keep platform code out of the canonical
player experience until company/privacy approval.  
**Success:** effort, risks, shared adapter design, and a recommended first portal
are evidence-backed without committing to distribution. Return separate
findings for packaging, iframe/runtime, network/functions, persistence,
size/performance, device/aspect/input/audio, SDK isolation, and canonical-build
contamination so A-032 can reconcile each opportunity without changing stage.

## GDH-006 — Reconcile AI provider runtime, provenance, and public policy

**Status:** P0 verification request; do not edit legal copy from assumptions  
**Evidence:** portrait code defaults to Gemini image generation with Replicate
fallback; video `auto` prefers Gemini/Veo with Replicate fallback. Recent
production deploy titles indicate Gemini activation. Several product documents,
`api-config` labels, AI compliance references, deployment guidance, and public
privacy descriptions remain Replicate-first, generic, stale, or reference the
removed `.js` function.  
**Request:** provide a sanitized, test-backed matrix for production and preview:

- feature flags and provider preference;
- provider/model selected for portrait and video;
- exact bounded fields/reference assets sent;
- authentication, age enforcement, rate/idempotency, moderation, and failure;
- provider logs/retention/region/training or reuse terms;
- output copy to private storage and provider-file deletion/expiry;
- deletion/export and fallback behavior;
- quota, cost, alert, and kill switch;
- one successful and one denied/ineligible provenance trace without secrets or
  player identity.

**Constraints:** no secrets or raw player data in the handoff. Legal/privacy
conclusions require professional review.  
**Success:** V-003/V-004 and R-002/R-008 have evidence-backed status; all public
and internal provider descriptions match actual behavior in one coordinated
release.

## GDH-007 — Produce a lean, isolated Poki candidate

**Status:** P0 readiness request; no SDK, advertising, upload or platform request is authorized

**Evidence:** the direct portal build now reaches one clear egg interaction on
desktop and phone. Its reconstructed opening download is about 3.75 MB, but the
full delivery is about 41 MB compressed: roughly 24.5 MB of cinematics and 9.3
MB of audio. The built game still contains outside NASA, Open Notify and
Mythical-hosted function routes. The authentic visual gate is 0/4, incognito
saving and real tablet touch switching are unverified, and no Poki SDK is
present or approved.

**Request:** return a separate portal candidate that:

- keeps the core adventure complete with live NASA, Open Notify, hosted AI,
  cloud saving and Mythical-hosted functions off by default;
- progressively loads later films, music and realm art after the first playable
  action, with measured first-load and complete-delivery evidence;
- survives denied storage, private browsing and ad blocking without a crash;
- forces the correct touch controls on real or touch-emulated tablets;
- preserves the immediate egg interaction, makes early films skippable and
  teaches the first actions visually and gradually;
- defines a Poki-only SDK adapter boundary without installing or activating the
  SDK, game events, advertising or external links.

**Constraints:** do not weaken the canonical browser game, call imagined art
gameplay, add tracking, contact a platform, accept terms, create an account or
publish a package. The external-service-free mode must fail closed without
removing the NASA/STEM layer from the owned game.

**Success:** the candidate passes desktop, phone, real tablet, denied-storage,
ad-block and slow-load reviews; the first action remains clear; delivery weight
is materially reduced; every outside request is absent or separately approved;
and the operating thread receives exact evidence without any platform action.

## GDH-008 — Prepare a separate YouTube Playables candidate boundary

**Status:** high-upside preparation request; no SDK connection, audience
classification, channel creation, interest form, upload, advertising or terms
are authorized

**Evidence:** YouTube currently supports Phaser games and allows a first bundle
below 30 MB, a total below 250 MB, individual files below 30 MB and no more
than 8,000 files. The current structural proxy fits those hard limits: about
3.8 MB reconstructed first load, about 47 MB raw total, an 11 MB largest file
and 85 files. It is still incompatible because it has no YouTube integration,
uses browser saving, contains native sharing and clipboard actions, and retains
NASA, Open Notify and Mythical-hosted network routes. YouTube also requires
Playables to be general-audience 13+ and not specifically made for children.

**Request:** design an isolated `youtube-playables` mode that:

- makes no outside calls and keeps the complete core adventure playable with
  bundled assets;
- keeps rights-checked NASA/STEM material bundled and credited without a live
  call or endorsement implication;
- removes in-game sharing, clipboard writing, external links, login-like
  screens and separate agreements;
- defines one adapter for YouTube ready, cloud-save, pause, resume and audio
  controls without connecting it before access and approval;
- preserves state across resize and supports touch and mouse across narrow,
  square and wide viewports;
- returns an exact list of content, rights and audience changes required for an
  honest general-audience 13+ edition.

**Constraints:** do not relabel or weaken the owned family game, remove its
NASA/STEM layer, install or activate advertising, create a channel, submit an
interest form or accept terms. Do not claim a Playables package exists or that
the interest form is authorized.

**Success:** the separate candidate contains no non-YouTube network or share
path, passes local SDK test-suite checks after access, uses platform saving and
lifecycle controls, works across required shapes and input methods, starts
within the platform limit, has complete rights evidence and reaches the 4/4
human visual gate.
