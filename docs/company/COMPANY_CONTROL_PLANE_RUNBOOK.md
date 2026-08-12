# Company Control Plane Runbook

**Status:** A-012 internal pilot; no scheduler or external executor connected  
**Date:** 11 August 2026

## Purpose

Run Mythical's bounded company controls as one coherent system and return an
exception-led operating view instead of requiring Kevin to inspect individual
scripts and registers.

The runner:

- executes the foundation validator and every bounded workflow in its
  non-recursive run list;
- treats exit `0` as passed, exit `2` as valid but gated/not ready, and any
  other exit as broken;
- never converts a gated result into success;
- identifies designed workflows with no implementation;
- compiles open risks, Kevin decisions, and Game Development handoffs;
- reports whether any external action was authorized;
- writes nothing and connects to nothing by default.

## Run modes

Default internal control-plane run:

```bash
node scripts/company/run-company-control-plane.cjs
```

Add local evaluation suites:

```bash
node scripts/company/run-company-control-plane.cjs --verify
```

Add the read-only live public-footprint check:

```bash
node scripts/company/run-company-control-plane.cjs --online
```

`--online` makes public HTTP requests through A-001. It still performs no
external write.

## Result semantics

- `controlPlaneHealthy: true` means no validator or workflow crashed or
  returned invalid output.
- `companyReady: false` means one or more legitimate gates remain, such as
  missing evidence, owners, policy reconciliation, or trusted approvals.
- `externalActionAuthorized: false` is expected. A-012 has no publishing,
  outreach, inbox, deployment, data-collection, account, contract, or spend
  credential.
- The runner exits `1` for a broken control, `2` for a healthy but gated company
  state, and `0` only when every included control is ready.

A healthy control plane is not the same thing as a launch-ready company.

## Scheduling and production gates

The proposed rhythm and its disabled activation contract are specified in
[`BOUNDED_COMPANY_OPERATING_CADENCE.md`](BOUNDED_COMPANY_OPERATING_CADENCE.md).
A-041 simulates calendar load and collisions but cannot configure or enable a
scheduler.
[`CONTENT_ADDRESSED_CADENCE_WORK_PACKETS.md`](CONTENT_ADDRESSED_CADENCE_WORK_PACKETS.md)
defines A-042's derived implementation, agent, evaluator, digest, and resource
bindings. Compiling those packets does not enqueue or run them.
[`TRANSITIVE_CADENCE_EFFECT_ASSURANCE.md`](TRANSITIVE_CADENCE_EFFECT_ASSURANCE.md)
adds A-043's nested-call and protected-input checks so a safe top-level command
cannot conceal or repeat a network or write effect.
[`PROTECTED_TRIGGER_PAYLOAD_BINDING.md`](PROTECTED_TRIGGER_PAYLOAD_BINDING.md)
adds A-044's offline synthetic handoff rehearsal for the exact A-016/A-017
`--input` branches. Its successful local result does not configure a binding,
accept a production payload, or provide runtime tracing or promotion evidence.
[`PROTECTED_TRIGGER_ENVELOPE_ADMISSION.md`](PROTECTED_TRIGGER_ENVELOPE_ADMISSION.md)
adds A-045's signed envelope and replay-admission rehearsal. It uses ephemeral
synthetic keys and temporary markers, invokes no consumer, and establishes no
production identity, trust store, trusted time, replay history, or authority.
[`PROTECTED_RUN_HISTORY_RECONCILIATION.md`](PROTECTED_RUN_HISTORY_RECONCILIATION.md)
adds A-046's eight-record, two-branch payload-free hash-chain rehearsal and
twelve tamper tests. Temporary local evidence does not establish an append-only
production store, independent identity, retention, backup, alerts, or eligible
cycle history.
[`AUTHENTICATED_EXCEPTION_DELIVERY.md`](AUTHENTICATED_EXCEPTION_DELIVERY.md)
adds A-047's metadata-only signed delivery and acknowledgement protocol,
duplicate suppression, bounded primary failure, backup failover, and sixteen
refusal scenarios. Synthetic routes and ephemeral identities establish no real
recipient, external delivery, provider configuration, credential, or authority.
[`PROTECTED_EXECUTION_LEASE_AND_KILL.md`](PROTECTED_EXECUTION_LEASE_AND_KILL.md)
adds A-048's packet-bound exclusive lease, monotonic fencing, bounded recovery,
global-disable and real local process-group kill rehearsal. Temporary local
coordination does not establish a distributed scheduler, trusted time,
production identity, packet admission, or eligible cycle.
[`PROTECTED_FAILURE_RECOVERY_RECONCILIATION.md`](PROTECTED_FAILURE_RECOVERY_RECONCILIATION.md)
adds A-049's nine crash-boundary scenarios, four real local crash exits,
partial/corrupt state quarantine, completion preservation, stale-fence and
global-disable refusal, and orphan process-tree termination before recovery.
Local fault injection does not establish production durability, distributed
recovery, provider failure behavior, or eligible-cycle evidence.
[`PROTECTED_TIME_AND_SPLIT_BRAIN_ASSURANCE.md`](PROTECTED_TIME_AND_SPLIT_BRAIN_ASSURANCE.md)
adds A-050's real concurrent acquisition/recovery races, coordinator-time
authority, worker-clock skew refusal, delayed/partitioned duplicate handling,
healed-partition fencing, token exhaustion, and disable-before-effect checks.
Local exclusive files do not establish production consensus, trusted time,
distributed linearizability, or partition safety.
[`PROTECTED_BACKUP_RESTORE_AND_DISASTER_RECOVERY.md`](PROTECTED_BACKUP_RESTORE_AND_DISASTER_RECOVERY.md)
adds A-051's digest-only backup, readback, exact restore, corruption/loss/order,
generation and failure-domain checks, real concurrent restore exclusion, and
disable-before-restored-activation rehearsal. Temporary local copies do not
establish production durability, encryption-key management, independent
failure domains, recovery objectives, or disaster-recovery readiness.
[`PROTECTED_RECOVERY_OBJECTIVES_AND_KEY_CONTINUITY.md`](PROTECTED_RECOVERY_OBJECTIVES_AND_KEY_CONTINUITY.md)
adds A-052's authenticated encryption, fixed synthetic point/time measurement,
primary-key loss, threshold-signed recovery, revoked/untrusted/insufficient
approver refusal, key/storage-domain separation, and disable-after-decrypt
checks. Ephemeral local keys and timings do not establish production RPO/RTO,
cryptographic review, provider-native key management, escrow, or key recovery.
[`PROTECTED_CRYPTOGRAPHIC_MISUSE_AND_RECOVERY_POISONING.md`](PROTECTED_CRYPTOGRAPHIC_MISUSE_AND_RECOVERY_POISONING.md)
adds A-053's 32 unique-nonce encryption probes and refusal of nonce replay,
downgrade, AAD/key-version substitution, rollback, compromised approvals,
objective-origin gaming, oversized input, attempt exhaustion, and disabled
effects. Local deterministic probes do not establish production cryptographic
controls, compromise response, or recovery-poisoning resistance.
[`PROTECTED_NONCE_CONCURRENCY_AND_FAILOVER.md`](PROTECTED_NONCE_CONCURRENCY_AND_FAILOVER.md)
adds A-054's real multi-worker test. Sixteen workers receive different
encryption lock codes, eight duplicate retries accept only one result, and
crash, rollback, failover, key change, cancellation, exhaustion, and shutdown
cannot reuse a code. This local test does not establish production readiness.

Before scheduling A-012:

- select a protected append-only run-history destination;
- define alert routing for changed critical/high findings and broken controls;
- suppress unchanged status noise while retaining auditable run metadata;
- set maximum run frequency and cost;
- assign an operational owner and backup;
- test partial failure, stale inputs, timeout, log retention, and kill switch;
- ensure sensitive outputs never enter shared logs;
- coordinate any online checks with rate and availability limits.
- satisfy A-041's trusted-time, lease, history, alert, failure, kill, and
  separate activation gates.

Scheduling this read-only runner does not authorize any downstream external
action.

## Change detection

A-015 wraps A-012 with the online public read, normalizes the result, and
compares it to an explicit reviewed baseline:

```bash
node scripts/company/detect-company-control-plane-changes.cjs
node scripts/company/test-control-plane-change-detection.cjs
```

It flags broken controls, public-footprint regressions, new or worsened risks,
provider-policy finding changes, evidence/readiness changes, and unexpected
external authorization. It suppresses unchanged status and does not deliver an
alert. A-015 is deliberately not invoked inside A-012 because that would
recurse; both workflows are named in A-012's `metaWorkflowsNotInvoked` output.
