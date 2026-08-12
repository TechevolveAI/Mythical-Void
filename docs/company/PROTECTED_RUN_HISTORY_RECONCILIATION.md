# Protected run-history reconciliation

## Outcome

A-046 connects the previously separate A-015 collection, A-045 admission,
A-044 consumer, and independent-evaluation evidence into one minimal
parent/child history. The rehearsal creates eight payload-free metadata records
for the two protected branches, writes them with exclusive creation in an
operating-system temporary directory, and links their ordered contents with a
SHA-256 hash chain.

The last record reconciles both branches to the same parent. Twelve cloned
chains are then attacked through modification, deletion, reordering,
duplication, broken links, orphaning, packet/evidence substitution, authority
or payload flags, and an unexpected payload field. Every attack must be
detected with its expected reason.

## Record boundary

Each synthetic record contains only sequence and event metadata, synthetic
record/root references, workflow/source and current packet IDs, packet and
evidence digests, outcome, the previous record digest, and explicit false
authority/payload flags. Raw A-015 output, consumer output, signatures, public
keys, credentials, secrets, paths, personal data, and customer content are not
stored or printed.

The chain binds current A-042 packet output and the compact A-044/A-045 results.
It therefore detects source drift when any of those control outputs change.

## Run locally

```bash
node scripts/company/rehearse-protected-run-history.cjs
node scripts/company/test-protected-run-history.cjs
```

A correct rehearsal exits `2`: eight records are written and read back, both
branches reconcile, all twelve tamper cases are detected, the repository is
unchanged, and all eighteen production gates remain unsatisfied.

## Non-production boundary

Temporary exclusive-create files are not an append-only production store and
do not prove independent tamper anchoring, durable sequence allocation,
retention, deletion, backup, restore, failover, region loss, access review,
alert delivery, or recovery. One local identity produces and verifies every
record. The rehearsal receives no eligible-cycle credit.

Production history requires D-017, a selected and reviewed store, separated
writer/reader/reconciler/assurance identities, independently anchored tamper
evidence, retention/privacy/legal review, trusted time, concurrent and partial
failure exercises, A-047 protected alerts, process-tree kill, runtime tracing,
open-world evaluation, four independently reviewed protected cycles, and a
separate expiring exact-policy admission.
