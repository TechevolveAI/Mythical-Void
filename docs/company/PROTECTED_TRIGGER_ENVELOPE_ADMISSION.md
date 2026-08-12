# Protected trigger envelope admission

## Outcome

A-045 adds the admission decision that must sit between an A-015 output and the
A-016/A-017 consumer branches rehearsed by A-044. Each synthetic envelope is
signed with a new ephemeral Ed25519 keypair and binds the payload digest and
byte length to the live A-042 OC-003 parent packet, exact OT-002 or OT-003
consumer packet, target workflow/version, source run, issue/expiry window, and
replay key.

The rehearsal admits two valid synthetic envelopes, writes only two
exclusive-create replay markers in an operating-system temporary directory,
then rejects twelve expected attacks including both exact replays. It snapshots
the company repository before and after and never invokes either consumer.

## What this proves

The local rehearsal proves that the current admission implementation can:

- verify an Ed25519 signature before trusting envelope metadata;
- derive current parent and consumer packet IDs/digests from A-042 rather than
  accepting stale hard-coded packet identifiers;
- verify source workflow, target workflow, payload digest, byte length,
  bounded issue/expiry time, and a canonical replay key;
- reject invalid signature, digest, size, time, workflow, packet, target,
  replay-key, and duplicate-envelope cases before consumer invocation;
- create replay markers exclusively and leave the repository unchanged; and
- keep results free of payloads, signatures, public keys, run IDs, and paths.

## What this does not prove

The Ed25519 keypair is generated solely for each local rehearsal. It is not a
production identity or credential, and no persistent public key is trusted.
The temporary exclusive-create markers are useful concurrency primitives for
the fixture but are not durable, replicated, recoverable, or independently
protected history. The fixed rehearsal clock is not trusted production time.

A-045 therefore does not configure or authorize a production identity, trust
store, key rotation/revocation, payload binding, protected path, replay store,
history, alert, scheduler, queue, dispatcher, consumer invocation, network,
credential, spend, or external action.

## Run locally

```bash
node scripts/company/rehearse-protected-trigger-envelope-admission.cjs
node scripts/company/test-protected-trigger-envelope-admission.cjs
```

A valid rehearsal exits `2`: the contract and all fourteen attempts behave as
expected, but all sixteen live activation gates remain unsatisfied. The output
contains only allowlisted result metadata.

## Production boundary

Before a production envelope may be accepted, D-017 must establish the cell
and people; separated issuer/verifier identities and a protected trust store
must be attested; trusted time and maximum age must be approved; a durable
atomic replay/history system and protected path must pass concurrency, failure,
restore, permission, and recovery tests; complete A-015 schema and logging
controls must be enforced; process-tree kill and runtime tracing must pass; and
four independently reviewed protected cycles plus a separate expiring
exact-policy admission must be recorded.

A-051 now provides a local payload-free backup/restore rehearsal for this
history chain, but no A-045 production gate is satisfied by temporary local
copies or restore races.
