# Transitive Cadence Effect Assurance

**Status:** A-043 effect map valid; runtime tracing and packet execution gated

## Outcome

A-043 verifies what each A-041/A-042 command can cause through nested calls.
It prevents a top-level “read-only” label from hiding a public request,
optional write path, repeated collection, missing input, credential use, or
external action deeper in the process tree.

Seven distinct effect boundaries cover all eight cadence packets:

- five packet paths are offline and require no protected input;
- OC-003 is the only public-network path and is limited to A-015 → A-012
  `--online` → A-001 public reads;
- OT-002 and OT-003 are offline only when bound to the already-produced,
  digest-verified A-015 output;
- no packet may write, use credentials, spend, or cause an external action;
- zero packet sources are uncovered or multiply covered.

## Why the protected handoff matters

Both A-016 and A-017 can invoke A-015 themselves when no `--input` is
provided. In a future event chain that would repeat A-015's online snapshot.
The cadence commands therefore use:

```text
--input {protected_trigger_payload_path}
```

The placeholder is a contract, not a configured value. A future protected
binder must verify the source workflow, output digest, freshness, packet and
parent run IDs, authorization, replay state, and restricted path before
substitution. Both bindings are currently unconfigured, so the packets cannot
execute.

## Evidence checked

The validator compares:

1. all eight live A-042 packets;
2. the seven registered effect boundaries;
3. A-012's conditional `--online` A-001 insertion;
4. A-015's explicit A-012 `--online` invocation;
5. A-016/A-017 input-versus-fallback branches and argument surfaces;
6. A-002's absence of child-process execution;
7. A-030's exact five-step no-write shadow-runtime allowlist.

Any source, command, binding, network, nested workflow, or effect-map drift
invalidates the result. Current static assurance does not replace runtime
system-call/network tracing.

## Promotion boundary

All twelve `TE-G*` gates remain unsatisfied. Before packet admission, Mythical
still needs live tracing, protected replay-safe payload verification, argument
allowlists, egress enforcement, protected parent/child history, complete
process-tree timeout/cancellation/kill tests, four accurate shadow cycles, and
a separate expiring approval bound to both packet and effect digests.

A-043 has no tracer, binder, queue, scheduler, identity, network enabler,
writer, credential, dispatcher, executor, or spend authority.

## Commands

```bash
node scripts/company/validate-cadence-transitive-effects.cjs
node scripts/company/test-cadence-transitive-effects.cjs
```
