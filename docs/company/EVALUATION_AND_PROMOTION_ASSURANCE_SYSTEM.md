# Workflow Evaluation and Promotion Assurance System

**Status:** Current evaluation coverage complete; production promotion gated  
**Date:** 11 August 2026  
**Control:** A-036 workflow evaluation and promotion assurance

## 1. Outcome

Every registered Mythical company workflow now has a separate, named evaluation
script and an explicit promotion record. The machine-readable source is
[`automation/evaluation-catalog.json`](automation/evaluation-catalog.json).
It binds each workflow version and implementation to its evaluator, documented
case count, input boundary, last local result, mutation/network/credential
limits, and promotion-cycle state.

This closes a material governance gap: a control is not considered evaluated
merely because its happy-path validator returned green once.

## 2. Coverage

The catalog covers all 58 workflows and 921 documented cases. Seven
foundational controls received dedicated suites in the initial coverage cycle:

- A-001 public-footprint inspection now has six offline response fixtures;
- A-002 weekly-review compilation has six malformed-state/queue cases;
- A-003 content packages have seven claim, proof, and media cases;
- A-007 commercial pipeline has five stage/source/contact cases;
- A-008 channel registry has five identity/credential/publication cases;
- A-009 vendor and risk registers have five integrity cases;
- A-010 provider-policy drift has four isolated repository fixtures.

A-041 adds 25 cadence-contract and calendar-simulation cases, including
authority, identity, schedule, trigger, resource, idempotency, history, alert,
collision, protected trigger-input binding, input, and promotion refusals.
A-042 adds 29 packet-compilation cases covering source, command, agent,
evaluator, authority, resource, network, protected input binding, digest, and
dispatch boundaries.
A-043 adds 25 transitive-effect cases covering complete packet coverage,
nested-call evidence, the single public-read path, protected A-015 handoff,
fallback refusal, write/credential/external effects, runtime-tracing gates, and
non-execution.
A-044 adds 25 protected-trigger binding and rehearsal cases covering the exact
A-016/A-017 input branches, synthetic payload minimization, independent digest
checks, fallback/write refusal, repository mutation detection, replay/history
gates, and non-promotion.
A-045 adds 29 envelope-admission cases covering ephemeral Ed25519 signatures,
live parent/consumer packet digests, payload digest and byte length, bounded
time, exclusive-create replay refusal, minimized result logs, repository
mutation detection, and production-trust non-authority.
A-046 adds 25 protected-history cases covering eight-record/two-branch
reconciliation, exclusive-create temporary persistence, exact packet and
evidence binding, hash-chain integrity, twelve tamper modes, payload exclusion,
repository mutation detection, and production-history non-authority.
A-047 adds 29 authenticated exception-delivery cases covering high/critical
eligibility, exact A-015/A-046 digest binding, ephemeral sender and recipient
signatures, acknowledgement, duplicate suppression, bounded failure, backup
failover, sixteen refusal modes, metadata minimization, and production-route
non-authority.
A-048 adds 27 protected execution-lease cases covering live packet/alert
binding, exclusive acquisition, overlap and replay refusal, expiry, renewal,
owner-only release, monotonic fencing, bounded recovery, global disable,
parent/child process-group kill, twelve refusal modes, and production-
coordinator non-authority.
A-049 adds 30 protected failure-recovery cases covering current packet,
history, alert, and lease evidence; nine crash-boundary outcomes; four real
local crash exits; partial/corrupt state quarantine; orphan-tree termination;
completion preservation; stale-fence and global-disable refusal; fifteen
forged recovery records; and production-resilience non-authority.
A-050 adds 32 trusted-time and split-brain cases covering twelve real local
concurrent contenders, exactly one winner per acquisition/recovery race,
opposite worker-clock skews, delayed and partitioned duplicates, healed stale
work, completion preservation, token exhaustion, disable-before-effect,
sixteen forged decisions, and production-consensus non-authority.
A-051 adds 34 protected backup/restore cases covering a six-record digest-only
manifest, exclusive backup and exact restore, readback validation, corruption,
truncation, deletion, reorder, stale generation and wrong failure-domain
detection, four real concurrent restore claimants with exactly one winner,
disable-before-restored-activation, seventeen forged manifests, cleanup, and
production-durability non-authority.
A-052 adds 36 recovery-objective/key-continuity cases covering three fixed
payload-free recovery generations, actual ephemeral AES-256-GCM and Ed25519,
authenticated readback/decrypt, synthetic point/time measurement, primary-key
loss, two-of-three recovery approval, insufficient/untrusted/revoked signer
refusal, wrong-key/corrupt-tag/stale/future/domain/disable refusal, twenty-one
forged attempts, complete key cleanup, and production-objective/key-management
non-authority.
A-053 adds 39 cryptographic-misuse/recovery-poisoning cases covering 32 real
AES-256-GCM probes with unique nonces, exclusive nonce and attempt recording,
nonce replay, downgrade, AAD/ciphertext/tag/key-version substitution, rollback,
future points, compromised/duplicate/unknown/substituted approvals, independent
RPO/RTO origins, oversized input, attempt exhaustion, global disable, complete
temporary-key cleanup, and production-cryptography non-authority.
A-054 adds 40 cases showing that simultaneous workers, duplicate retries,
crashes, restarts, old backups, failover, key changes, cancellation, counter
limits, and shutdown do not cause the same encryption lock code to be reused.
It uses temporary local tests only and does not claim production readiness.

A-001's evaluator performs no network request. A-010's evaluator uses a
temporary synthetic repository and no production account, environment value,
or secret. A-012's evaluator is the system-level integration suite and keeps
online public reads disabled. All other suites use temporary JSON or synthetic
fixtures where applicable.

## 3. What a passing evaluation proves

A pass proves only the assertions in the named evaluator against the recorded
implementation and current fixture boundary. It does not prove:

- open-world correctness or absence of unknown failure modes;
- independent runtime identity or organizational independence;
- production data, provider, policy, latency, cost, or reliability behavior;
- four accurate shadow or activation cycles;
- a human owner, backup, incident route, or operational service level;
- permission to schedule, connect a credential, write externally, spend, or
  promote autonomy.

The catalog deliberately records zero eligible promotion cycles for every
workflow. Local tests and one local rehearsal cannot be relabelled as production
operating history.

## 4. Evaluation contract

Every workflow must have:

1. an exact registry version and implementation path;
2. a separate evaluator script under `scripts/company/`;
3. at least one documented case and a parseable declared count;
4. an explicit input boundary;
5. network, credential, mutation, and external-action limits;
6. a dated result that never self-authorizes promotion;
7. four independently reviewed eligible cycles before any target-level
   promotion, plus the workflow's own stricter conditions;
8. re-evaluation after implementation, policy, model, tool, data, identity,
   permission, target, cost, or incident changes.

An evaluator may block or recommend. It may not edit the artifact under test,
approve its own result, change the baseline, grant permission, or execute the
workflow's consequential action.

## 5. Operation

```bash
node scripts/company/validate-evaluation-catalog.cjs
node scripts/company/test-evaluation-catalog.cjs
```

The validator compares the catalog with the live automation registry and
filesystem. It fails on missing, duplicate, unknown, or version-drifted
workflows; mismatched implementation paths; missing/out-of-scope evaluators;
unparseable case counts; credential/network/mutation expansion; fabricated
promotion cycles; or any promotion/external authority.

The A-012 `--verify` run executes every evaluator individually. A-036 validates
the bindings; it does not recursively execute the system-level A-012 suite.

## 6. Promotion boundary

No workflow is production-promotion eligible. Promotion requires its registered
conditions, protected run history, separate identities where consequential,
named owners/backups, change and incident handling, resource/cost evidence,
kill-switch and recovery tests, and four accurate reviewed eligible cycles.
External execution additionally requires A-011 trusted approval and A-035
least-privilege activation. A catalog edit cannot grant any of those states.
