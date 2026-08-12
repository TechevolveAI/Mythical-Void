# Protected failure injection and recovery reconciliation

## Outcome

A-049 defines the crash boundary that must exist before Mythical can call a
scheduled or event-triggered company packet recoverable. It binds current
A-042 packet identities to current A-046 history, A-047 exception, and A-048
lease evidence. It then exercises nine scheduler, worker, lease, history,
completion, alert, process-tree, stale-worker, coordinator-corruption, and
global-disable failure scenarios.

Four scenarios use real short-lived local processes that exit at exact injected
crash boundaries. A fifth starts a detached parent/child process group and
proves the complete orphan tree stops before recovery. Partial state is
quarantined, ambiguous work is never re-executed automatically, completion is
preserved when only alert delivery is missing, and a stale worker cannot act
after a higher fencing token is issued.

## Run locally

```bash
node scripts/company/rehearse-protected-failure-recovery.cjs
node scripts/company/test-protected-failure-recovery.cjs
```

A valid rehearsal exits `2`. All crash, quarantine, scenario, and refusal
records live in an operating-system temporary directory, use exclusive-create
files, and are removed after the run. Fifteen cloned recovery records exercise
packet and source-evidence substitution, malformed time and state, missing or
extra fields, stale or invalid fences, authority and payload flags, retry
overflow, and global disable.

## Production boundary

Local files and processes do not prove distributed atomicity, trusted time,
coordinator consistency, cross-service completion durability, provider
identity, network-partition behavior, regional recovery, or production kill.
Production activation still requires D-017, confirmed operators, a selected
runtime and failure-domain design, separated identities, durable stores,
trusted time, authenticated alerts, backup/restore and regional-loss drills,
complete crash and kill exercises, runtime tracing, open-world evaluation, four
independently reviewed protected cycles, and separate expiring exact-policy
approval. A recovery record never authorizes re-execution or an external act.

A-050 carries this current recovery evidence into a separate trusted-time and
simultaneous-claimant race rehearsal. It does not convert local recovery into a
production consensus service or make either rehearsal promotion eligible.
