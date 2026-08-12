# Campaign Package and Content Atomization System

**Status:** Internal package ready; publication gated  
**Date:** 11 August 2026  
**Control:** A-034 campaign-package and content-atomization assurance

## 1. Outcome

A-034 turns one accepted editorial source into a small, inspectable set of
channel-native drafts without letting rewriting create new claims, identities,
links, evidence, targeting, or publication authority. The first bounded case is
CQ-006 / CP-001, the text-only Project Beacon introduction.

The machine-readable package is
[`content/campaigns/project-beacon-foundation.json`](content/campaigns/project-beacon-foundation.json).
It contains the canonical copy, two variants, sentence-level claim provenance,
accessibility and disclosure records, destination controls, approval state, and
publication gates. It is an internal review artifact, not a campaign launch.

## 2. Canonical-to-channel contract

The canonical source remains CP-001. A variant may shorten, reorder, or adapt
tone for its named channel context, but it may not:

- add a claim that is absent from the source and claims register;
- turn qualified language into an absolute, safety, autonomy, uniqueness, or
  future-pricing promise;
- mix the fictional Project Beacon premise with real company or scientific
  claims;
- invent gameplay, customer, testimonial, award, traction, partner, or media
  evidence;
- add a destination outside the exact approved host allowlist;
- add targeting, tracking parameters, generated media, or disclosure claims;
- imply that a social identity, content approval, or publication approval
  exists.

Every public proposition in a variant maps to a registered claim and a literal
excerpt in that variant. The package validator also evaluates blocked wording,
unknown channels, unapproved proofs, link drift, generated-media drift,
accessibility state, measurement drift, and approval/authority escalation.

## 3. First package

The package preserves CP-001 as the canonical draft and provides:

1. **WV-001 — owned-web summary:** the canonical text without mutation;
2. **WV-002 — professional context:** a concise company-voice adaptation using
   the same four claims and official destination.

Both are text-only. Neither uses a visual proof, generated asset, testimonial,
hashtag, tracked link, or child-targeted framing. CH-004 remains an unverified
account type, so its variant is a reviewable draft only. CH-001 is observable as
the official owned domain, but its owner, credential, moderation, measurement,
approval, publisher, and reconciliation gates are not satisfied.

## 4. Readiness semantics

`internalPackageReady=true` means the source, claims, transformations, copy,
links, accessibility record, and fail-closed authority state are internally
coherent. It does not mean content is approved or publishable.

Publication requires, at minimum:

- a fresh deployed-build recheck for CL-004;
- the D-011 channel decision and verified destination identity;
- named owner, backup, recovery, moderation, safeguarding, and incident cover;
- an approved privacy-preserving measure and final tagged destination, if any;
- a complete preview and channel-specific policy review;
- trusted, scoped A-011 approval bound to the exact artifact digest;
- a separated publisher, tested kill switch, idempotency, and reconciliation.

All publishing, scheduling, replying, promotion, account, credential, tracking,
and external-action authority remains false.

## 5. Operation

Run the deterministic package check and its adversarial suite:

```bash
node scripts/company/validate-campaign-package.cjs
node scripts/company/test-campaign-package.cjs
```

A valid result exits gated because no publication is authorized. Any source,
claim, evidence, link, accessibility, approval, or authority drift fails closed.

## 6. Promotion boundary

A-034 may become a recurring internal atomization control after four reviewed
packages show accurate provenance and no unsupported-claim escape. Promotion to
external execution additionally requires the complete A-033 publishing
preflight, a trusted A-011 approval boundary, channel-specific moderation and
measurement controls, a separate least-privilege publisher, and outcome
reconciliation. A-034 itself never grants publication authority.
