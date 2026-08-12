# Mythical Protected Internal Runtime System

**Status:** Architecture package ready; selection and provisioning gated  
**Date:** 11 August 2026  
**Control:** A-031 protected-runtime architecture assurance

## Purpose

A-031 defines the infrastructure boundary required to turn A-030's local
single-process rehearsal into an independently operated internal company cell.
It is vendor-neutral and permits no account creation, credentials, provisioning,
scheduling, persistence, alert delivery, dispatch, external action, or spend.

The machine-readable source is
[`automation/protected-runtime.json`](automation/protected-runtime.json).

## Recommended architecture class

The recommended starting class is a **managed isolated job runtime**:

- an ephemeral job runs only the registered A-030 entry point;
- AG-001 orchestration and AG-010 assurance use separate workload identities;
- source is mounted read-only and scratch space is destroyed after each run;
- outbound network access is denied by default;
- compact content-addressed run metadata goes to a protected append-only or
  tamper-evident store;
- only changed high/critical exceptions go to an authenticated human route;
- no raw step output, customer content, financial values, prompts, secrets, or
  credentials enter general logs;
- concurrency is one, retries are zero, and every limit fails closed.

This class reduces infrastructure administration while preserving a path to
identity separation and bounded scheduling. It is not a vendor selection. A
provider's security, privacy, retention, identity, logging, network, billing,
exit, and incident controls must be reviewed before use.

## Alternatives

Self-hosting gives Mythical more infrastructure control but creates a larger
patching, availability, backup, access, monitoring, and incident-response
burden. Continuing local manual rehearsal creates no new operational risk but
does not prove autonomy or reduce Kevin's routing load.

No option has been selected and no cost estimate is asserted.

## Required trust domains

The protected cell must separate:

1. **AG-001 orchestrator identity** — may start only the approved internal
   cycle and read its bounded configuration.
2. **AG-010 assurance identity** — may evaluate compact results but may not
   alter producer output or approve itself.
3. **Scheduler identity** — may trigger only the content-addressed entry point
   within cadence, concurrency, timeout, and kill-switch limits.
4. **History writer** — append-only; readers cannot rewrite prior records.
5. **Alert route** — authenticated to the named urgent recipient and carries
   only bounded exception metadata.
6. **Approval verifier** — separate from editable repository files,
   conversation, and the future executor.

Human personal credentials and long-lived static keys are prohibited for the
runtime. Credential references—not secret values—may appear in the contract
only after review.

## Bounded execution

The initial design allows A0/A1 work using Z0/Z1 data only. It permits one run
at a time, at most four runs per day, 120 seconds per run, five MiB of output,
no retries, read-only repository access, ephemeral scratch, and no network
egress. Agent spend authority remains zero.

Those are hard safety ceilings, not target usage. Any increase requires a new
reviewed contract and decision.

## Failure and recovery proof

Before the first eligible shadow cycle, tests must cover unknown commands,
timeouts, concurrent invocation, unavailable history, partial writes, failed
alerts, revoked identities, stale configuration, clock drift, kill during run,
backup/restore, and replay. The kill switch must stop new work, terminate the
active run, revoke the runtime identity, and preserve only minimum audit
evidence.

## Decision boundary

Kevin's D-017 decision confirms the AG-001/AG-010 cell, accountable owner,
backup, urgent exception recipient, and preferred architecture class. That
decision is recorded before any separate provider or access approval.

D-014 separately governs the trusted approval boundary. Neither a conversation
nor this architecture package authorizes provisioning or action.

A-035 separately governs the access lifecycle in
[`automation/integration-activation.json`](automation/integration-activation.json).
Observed GitHub, Netlify, or other human access cannot be reused for the cell.
Provider selection, provider-native identities, credential references, read
verification, revocation, and activation remain distinct gates.

A-036 separately governs evaluation coverage and promotion assurance in
[`automation/evaluation-catalog.json`](automation/evaluation-catalog.json).
Local tests establish a pre-production baseline only. They do not count as an
eligible operating cycle, verify runtime identity separation, or authorize
promotion; protected history and independent review must evidence those gates.

A-037 records the current provider feasibility evidence in
[`automation/protected-runtime-provider-evaluation.json`](automation/protected-runtime-provider-evaluation.json).
It recommends Google Cloud Run Jobs only as the first candidate for a bounded
security, privacy, terms, region, cost, exit, and failure review. No provider is
selected, and the recommendation creates no account, access, provisioning,
credential, scheduler, store, alert, billing, spend, or execution authority.

A-038 records the public PE-001 diligence in
[`automation/pe001-public-due-diligence.json`](automation/pe001-public-due-diligence.json).
It finds a conditional path to account-scoped review, not deployment: no Irish
Cloud Run region is listed, exact all-in cost is unavailable, spend caps are
preview and incomplete, no requirement is configured, and all fourteen
account/human gates remain unsatisfied.
