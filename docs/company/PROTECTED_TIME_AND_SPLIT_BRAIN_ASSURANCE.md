# Protected trusted-time and split-brain assurance

## Outcome

A-050 defines the time and contention boundary required before Mythical can run
more than one scheduler or recovery claimant. It binds current A-042 packet,
A-046 history, A-047 exception, A-048 lease, and A-049 recovery evidence, then
uses real concurrent local processes to race eight acquisition claimants and
four recovery claimants through exclusive-create coordination.

Exactly one claimant must win each race. The rehearsal also proves that fixed
coordinator time overrides positively and negatively skewed worker clocks,
delayed completed work cannot replay, a partitioned duplicate cannot overlap,
a healed partition cannot write behind fence 5, alert delay cannot erase
completion, token exhaustion refuses automatic recovery, and global disable is
checked immediately before a protected effect.

## Run locally

```bash
node scripts/company/rehearse-protected-time-and-split-brain.cjs
node scripts/company/test-protected-time-and-split-brain.cjs
```

A valid rehearsal exits `2`. Race locks, contender decisions, scenario records,
and refusal evidence live only in an operating-system temporary directory,
use exclusive-create files, and are removed afterward. Sixteen cloned decision
records exercise packet and evidence substitution, invalid coordinator time,
worker-time authority, invalid state and fields, stale and unsafe fences,
payload and external authority, and global disable.

## Production boundary

Local filesystem exclusivity does not prove distributed linearizability,
consensus, trusted time, quorum behavior, cross-region replication, provider
identity, or partition safety. Production activation still requires D-017,
confirmed operators, a selected runtime and coordination design, separated
identities, verified trusted time and fencing storage, token exhaustion policy,
backup/restore and regional-loss drills, runtime tracing, open-world evaluation,
four independently reviewed protected cycles, and separate expiring
exact-policy approval. A winning local race never authorizes packet execution.

A-051 continues this chain with the payload-free backup/restore and concurrent
restore boundary; its local rehearsal still does not satisfy these production
durability, failure-domain, identity, or activation requirements.
