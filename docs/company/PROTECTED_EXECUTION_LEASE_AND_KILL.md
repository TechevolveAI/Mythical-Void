# Protected execution lease, fencing, and kill

## Outcome

A-048 defines the coordination boundary required before Mythical can admit a
scheduled or event-triggered company packet. It binds two current A-042 packet
IDs and digests to current A-047 exception evidence, then rehearses exclusive
lease acquisition, overlap refusal, renewal, owner-only release, completed
replay suppression, expiry refusal, bounded recovery with a higher fencing
token, and stale-worker refusal.

The rehearsal also starts a real local detached parent/child process group,
terminates the complete group with `SIGTERM`, verifies both processes stop, and
proves global disable blocks new acquisition. No underlying company workflow is
invoked.

A-049 carries the current lease evidence into a separate crash-boundary and
recovery-reconciliation rehearsal. It does not turn this local lease into a
production coordinator or make either rehearsal promotion eligible.

## Run locally

```bash
node scripts/company/rehearse-protected-execution-lease.cjs
node scripts/company/test-protected-execution-lease.cjs
```

A valid run exits `2`. Lease, event, completion, and child-process evidence is
created only in an operating-system temporary directory with exclusive-create
files and removed afterward. Twelve cloned leases exercise packet,
configuration, holder, expiry, fencing, authority, payload, field, retry, and
global-disable refusals.

## Production boundary

Local exclusive files do not prove distributed atomicity, trusted time,
linearizable fencing, provider identity, network-partition behavior, durable
recovery, or production process control. Production activation requires D-017,
confirmed operators, a selected coordinator/runtime, separated identities,
trusted time, atomic lease and fence allocation, split-brain and recovery tests,
protected A-046/A-047 evidence, resource and retry limits, backup/restore,
complete kill and tracing exercises, open-world evaluation, four independently
reviewed protected cycles, and a separate expiring exact-policy approval.
