# Run History and Alerting

**Status:** A-016 local record pilot, A-046 payload-free hash-chain, and A-047
authenticated exception-delivery rehearsal; no production store, scheduler, or
real alert delivery  
**Date:** 11 August 2026

## Purpose

Preserve enough operational history to prove what the company control plane
checked and whether anything materially changed, without copying customer
content, support messages, secrets, raw provider data, or full internal reports
into a general log.

An A-016 record contains only:

- a deterministic run-record ID and creation time;
- workflow/version and read-only mode;
- baseline/current comparison timestamps;
- result counts and alert booleans;
- a SHA-256 digest binding the record to the complete A-015 output;
- explicit statements that no external action was authorized and no sensitive
  payload was included;
- retention class and writer mode.

The digest detects accidental substitution only when the referenced source is
also retained. It is not a signature and does not create tamper evidence by
itself.

A-046 closes that rehearsal gap without pretending to create production
history. It links one collection parent, two admission decisions, two consumer
outcomes, two evaluator outcomes, and one reconciliation event as eight
payload-free metadata records over two branches. Each record binds the previous
record digest plus current packet/evidence digests. Twelve cloned attacks test
mutation, deletion, reorder, duplication, broken links, orphaning, binding
substitution, false authority/payload flags, and unexpected payload fields.

## Safe modes

Default dry-run builds and validates a record but writes nothing:

```bash
node scripts/company/build-company-run-record.cjs
```

An explicit existing output directory may be provided for a bounded local
pilot:

```bash
node scripts/company/build-company-run-record.cjs --output-dir /approved/path
```

The writer uses exclusive create-only mode and refuses to overwrite an existing
record. It will not use a filesystem root or repository root as the output
directory. The current company task does not write run records into the shared
repository.

The A-046 rehearsal uses its own operating-system temporary directory, enforces
exclusive creation and restrictive modes, reads all eight records back,
reconciles both branches, detects all twelve attacks, checks for company-file
mutation, and removes the directory afterward:

```bash
node scripts/company/rehearse-protected-run-history.cjs
node scripts/company/test-protected-run-history.cjs
```

This remains one local identity and earns no protected-cycle credit.

A-047 consumes a local A-015 comparison with one eligible high-risk change and
the current A-046 result. It signs two logical metadata-only alerts, verifies
primary and backup recipient acknowledgements with separate ephemeral keys,
records four bounded attempts, exposes two failures, suppresses one exact
duplicate, completes one backup failover, and rejects sixteen authentication,
binding, time, severity, payload, recipient, revocation, retry, size, and
acknowledgement attacks:

```bash
node scripts/company/rehearse-authenticated-exception-delivery.cjs
node scripts/company/test-authenticated-exception-delivery.cjs
```

Its route IDs and identities are synthetic; it stores no contact details and
makes no network request or external delivery.

A-048 then binds coordination to current A-042 packet and A-047 exception
evidence. Its temporary local lease files block overlap and completed replay,
advance recovery fencing monotonically, reject stale holders, and exercise
global disable plus complete parent/child process-group termination. No company
workflow is invoked and no local result counts as distributed coordination or
an eligible cycle.

A-049 carries the same current packet, history, exception, and lease evidence
through nine offline crash boundaries. It quarantines partial/corrupt state,
preserves completed replay suppression when alerting is missing, refuses
ambiguous or stale recovery, and terminates a live orphan process tree before
issuing a higher fence. Its temporary records are removed and do not become
production history or eligible-cycle evidence.

A-050 then races real local acquisition and recovery claimants against the
current recovery evidence while fixed coordinator time overrides skewed worker
clocks. Delayed alerts preserve completion, delayed/partitioned duplicates and
healed stale work remain fenced, and none of the temporary race evidence
becomes production consensus, trusted time, or eligible-cycle history.

A-051 then binds six current protected evidence records into one digest-only
backup manifest, exclusive-writes and reads it back, performs an exact restore,
detects corruption, truncation, deletion, reorder, stale generation and wrong
failure domain, and permits exactly one of four concurrent restore claimants.
Its temporary files are removed; it establishes no production durability,
encryption key, cross-domain store, activation authority, or eligible cycle.

A-052 then encrypts payload-free current and predecessor recovery capsules with
ephemeral AES-256-GCM, verifies predecessor decryption after rotation, measures
fixed synthetic recovery-point and local recovery-time bounds, removes the
primary active key, and requires two independently valid
ephemeral signatures before a separate recovery-key copy can decrypt it. All
key material is removed afterward; no synthetic measurement is a production
objective and no decryption authorizes activation.

A-053 then attacks those recovery assumptions with 32 real unique-nonce
AES-256-GCM probes, exclusive nonce and attempt ledgers, downgrade and AAD/key-
version substitution, rollback and future-point tests, a compromised recovery
approver, independently anchored objective measurements, input/attempt limits,
and global disable. All temporary artifacts are removed; passing this local
rehearsal creates neither production cryptographic controls nor recovery
authority.

A-054 then checks the same rule under pressure: sixteen workers act together,
eight retry the same request, and crash, restart, rollback, failover, key
change, cancellation and shutdown are introduced. Every temporary key and
record is removed. The local result does not create a production service or
permission to act.

## Production gates

Before scheduling or treating the history as authoritative:

- choose a protected append-only or tamper-evident store;
- authenticate the writer independently from readers and alert recipients;
- define retention, deletion, backup, restore, access review, and export;
- bind source artifacts or signed digests so records can be verified later;
- deduplicate unchanged runs and preserve only bounded metadata;
- send only changed high/critical alerts through an approved route;
- assign primary/backup ownership and response expectations;
- test replay, overwrite, truncation, clock drift, storage failure, partial
  write, alert failure, and recovery;
- exercise the schedule and kill switch.

No run-history record authorizes the action it describes.

## Baseline governance

A-017 consumes the A-015 comparison and produces a proposal only:

```bash
node scripts/company/propose-control-plane-baseline-update.cjs
node scripts/company/test-baseline-update-proposal.cjs
```

No change produces no proposal. Informational-only improvements may produce a
content-addressed candidate for explicit review. Medium changes require a human
disposition. High, critical, or authorization changes are ineligible and must
be investigated rather than absorbed into the baseline. A-017 cannot write the
baseline.
