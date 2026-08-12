# Approval and External Action Control

**Status:** A-011 repository pilot; no production authorization verifier exists  
**Date:** 11 August 2026

## Purpose

Let agents prepare consequential work while ensuring that Kevin approves one
specific, inspectable action—not a broad capability.

An approval envelope binds:

- one registered workflow and version;
- an exact artifact digest;
- named systems, accounts, destinations, and allowed operations;
- an execution window and maximum action count;
- spend and data-zone limits;
- dry-run evidence, rollback, idempotency, and audit destination;
- the decision and protected approval evidence.

Changing the artifact, destination, operation, limits, or window invalidates
the approval. Approval never allows an executor to expand its own permissions.

## Critical boundary

A JSON file in this repository is editable and therefore cannot prove Kevin's
identity or approval. A-011 validates scope and completeness only. It always
returns `externalActionAuthorized: false` until a future executor verifies the
approval through a protected, authenticated, tamper-evident system and also
checks its own least-privilege credential, current policy, budget, and kill
switch.

Natural-language conversation, a checkbox in a draft, an agent assertion, or
a copied name is not an authorization credential.

A-035 applies the same separation to access: a known account, observed human
session, provider invitation, credential reference, connected read scope, and
approved write executor are different states. None may be inferred from the
other, and no access secret belongs in this repository or conversation.

## Lifecycle

1. An agent produces the complete final artifact and dry-run evidence.
2. A-011 validates a `draft` envelope and hashes the referenced artifact.
3. Kevin reviews the exact artifact, destinations, window, limits, uncertainty,
   and rollback.
4. The protected approval system records Kevin's authenticated decision.
5. A production governor verifies that record and issues a single-use or
   tightly bounded execution grant.
6. The executor re-hashes the artifact, checks time/budget/idempotency, acts
   once, and records the external action ID.
7. Any mismatch, expiry, revocation, policy drift, or missing owner fails closed.

Steps 4–7 are not implemented. No current company workflow may infer that an
approved-looking repository envelope permits publication, outreach, spend,
data collection, account changes, contracts, or customer responses.

## Approval rules

- A2 workflows may execute only an already approved reversible playbook.
- A3 workflows require an authenticated envelope for each bounded action or
  batch.
- A4 actions are never agent-executed. An envelope may organize the review but
  cannot delegate the legal, financial, safeguarding, security, or crisis act.
- Approval expires in at most 24 hours for this initial design.
- The final payload is content-addressed with SHA-256.
- A separate idempotency key prevents duplicate execution.
- `maxActions` and spend are ceilings, not targets.
- Revocation and kill-switch state are checked immediately before execution.

## Promotion gates

Before A-011 can become part of a real external executor:

- Kevin approves the A0–A4 model and exact approval UX;
- a protected identity-aware approval store is selected;
- approval records are tamper-evident and independently auditable;
- service identities are separated by read/draft/publish/spend/admin scope;
- revocation, expiry, digest mismatch, replay, duplicate, wrong-target,
  over-budget, and partial-failure tests all fail closed;
- the executor records external IDs and reconciles outcomes;
- rollback and kill switch are exercised;
- security/privacy review approves the complete design.

The schema is at
[`automation/approval-envelope.schema.json`](automation/approval-envelope.schema.json)
and the non-authorizing example is at
[`automation/approval-requests/EXAMPLE_DRAFT.json`](automation/approval-requests/EXAMPLE_DRAFT.json).
