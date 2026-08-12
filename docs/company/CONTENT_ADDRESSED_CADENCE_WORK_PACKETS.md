# Content-Addressed Cadence Work Packets

**Status:** A-042 packet compiler ready; every packet disabled and dispatch
gated

## Outcome

A-042 turns A-041's four calendar entries and four event-trigger plans into
eight deterministic work packets. Each packet binds an exact workflow version,
implementation command, primary agent, independent evaluator, evaluation
script, data zones, resource ceiling, source digests, and idempotency-key
template.

This closes the ambiguity between “run A-012 on Monday” and the exact work a
future protected dispatcher would be allowed to admit. A source, command,
workflow, agent, evaluator, or limit change produces a new content digest and
packet ID.

## Current packet set

| Source | Workflow | Primary | Evaluator | Network declaration | State |
| --- | --- | --- | --- | --- | --- |
| OC-001 | A-012 weekday exception scan | AG-001 | AG-010 | None | Disabled |
| OC-002 | A-012 weekly offline verification | AG-001 | AG-010 | None | Disabled |
| OC-003 | A-015 public-read change snapshot | AG-010 | AG-001 | Nested A-001 public read only | Disabled |
| OC-004 | A-002 Kevin decision digest | AG-001 | AG-010 | None | Disabled |
| OT-001 | A-012 material-change verification | AG-001 | AG-010 | None | Disabled; manual review |
| OT-002 | A-016 exception run-record proposal from protected A-015 output | AG-008 | AG-010 | None | Disabled; manual review; input binding absent |
| OT-003 | A-017 informational baseline proposal from protected A-015 output | AG-010 | AG-001 | None | Disabled; manual review; input binding absent |
| OT-004 | A-030 separately approved shadow cycle | AG-001 | AG-010 | None | Disabled; manual review |

The packet set currently has eight unique packet IDs and eight unique content
digests across three primary agents. Every packet is zero-spend, retry-free,
read-only, credential-free, externally non-authorizing, and bounded by A-041's
120-second envelope.

OT-002 and OT-003 contain an unresolved protected-input placeholder rather
than re-running A-015. A future binding must supply the prior A-015 output by
protected path and verify its digest. Both bindings are currently unconfigured,
so neither packet can run or cause a second public read.

## Non-authority boundary

A compiled packet is not a queue entry, approval token, schedule, trigger,
runtime invocation, or permission grant. A-042 cannot:

- enable a calendar schedule or event listener;
- submit a packet to a queue or invoke its command;
- create or use an identity, credential, lease, store, or alert route;
- enable the declared public-read path;
- persist run output or update company state;
- write, dispatch, spend, contact, publish, deploy, or execute externally.

Protected dispatch remains false until D-017, OCI-001 through OCI-005, A-031,
and all A-041 gates are satisfied; cancellation, expiry, failure, kill, and
recovery behavior is tested; four accurate independently reviewed shadow
cycles complete; and Kevin makes a separate expiring packet-admission decision.

## Commands

```bash
node scripts/company/compile-cadence-work-packets.cjs
node scripts/company/test-cadence-work-packets.cjs
```

The compiler writes only JSON to standard output. It does not persist the
packets or execute their commands.
