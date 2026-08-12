# Bounded Company Operating Cadence

**Status:** A-041 cadence contract and simulation ready; every scheduler,
trigger, history, alert, network, and execution path disabled

## Outcome

A-041 converts Mythical's manually invoked controls into a precise first
operating rhythm without activating infrastructure. It defines four calendar
cycles and four event-trigger plans, all content-bounded, zero-spend,
read-only, credential-free, and disabled.

The initial calendar is intentionally small:

| Cycle | Local cadence | Purpose |
| --- | --- | --- |
| OC-001 | Weekdays 09:00 | Internal exception scan through A-012 |
| OC-002 | Monday 08:00 | Complete offline evaluator run |
| OC-003 | Friday 08:00 | Public-read change snapshot through A-015 |
| OC-004 | Friday 10:00 | Internal Kevin decision digest |

In the 1–30 September 2026 reference window this produces 34 planned starts,
at most three in one day, no same-time collision, and at least 60 minutes
between starts on the same day. The worst-case calendar-month ceiling is 38.
Simulation does not activate a schedule.

## Why this remains disabled

No scheduler owner, backup, urgent recipient, kill operator, provider, account,
workload identity, protected lease, history store, authenticated alert route,
time source, retention, or schedule approval exists. The current protected
runtime also permits at most four runs per day, one concurrent run, 120 seconds
per run, no retries, and zero spend.

All eighteen `OC-G*` gates must pass before a separate schedule activation
decision. Four accurate scheduled shadow cycles are required before runtime
promotion.

## Failure semantics

- missed runs do not backfill automatically;
- a DST spring gap skips and alerts only after an approved route exists;
- a repeated autumn wall-clock window runs once through an idempotency key;
- duplicates suppress and retain bounded metadata;
- overlap, timeout, stale configuration, unknown command, unavailable history,
  and unexpected exit fail closed;
- online failure gates only the online step and never becomes a pass;
- event triggers require manual review and cannot recursively invoke controls;
- A-016 and A-017 event packets must consume the already-produced,
  digest-verified A-015 result through a future protected payload binding and
  may not silently repeat the public read;
- scheduling a control never authorizes its downstream action.

## Kevin input brief

OCI-001 through OCI-005 ask Kevin to confirm the cell and operators, timezone
and run window, initial rhythm, protected history/alert route classes, and
resource/expiry/kill/backfill ceilings. No credentials or route values belong
in the response or repository.

## Commands

```bash
node scripts/company/simulate-company-operating-cadence.cjs
node scripts/company/validate-company-operating-cadence.cjs
node scripts/company/test-company-operating-cadence.cjs
```
