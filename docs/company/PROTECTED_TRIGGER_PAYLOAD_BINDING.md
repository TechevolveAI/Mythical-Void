# Protected trigger payload binding and rehearsal

## Outcome

A-044 closes a specific gap between the disabled cadence design and a future
protected runtime: A-016 and A-017 can now be rehearsed against the exact A-015
payload path they are meant to consume. The rehearsal uses two minimized,
synthetic payloads outside the repository, supplies `--input` explicitly, omits
the A-016 `--output-dir` writer, verifies output digests, and compares the
company repository before and after both child processes.

This is branch assurance, not a live binding. There is still no production
payload envelope, protected path, service identity, freshness policy, replay
store, history store, scheduler, listener, queue, network permission, writer,
credential, dispatcher, or external authority.

## Exact rehearsed paths

| Trigger | Consumer | Exact argument form | Expected gated result |
|---|---|---|---|
| OT-002 | A-016 | `build-company-run-record.cjs --input <synthetic-path>` | Valid dry-run record, matching source digest, no record written |
| OT-003 | A-017 | `propose-control-plane-baseline-update.cjs --input <synthetic-path>` | Valid informational proposal, matching candidate digest, no baseline written |

The default consumer invocation is deliberately not permitted by the contract.
In the current scripts, omitting `--input` would invoke A-015 again; the A-041
and A-042 packet definitions and A-044 consumer allowlist therefore require the
protected input argument. A-044 records that its own child commands requested
zero fallbacks. It does not claim kernel-level network or process tracing.

## Binding envelope still required

A future live binder must authenticate the parent packet ID, source A-015 run
ID, consumer packet ID, target workflow, schema, and SHA-256 payload digest as
one envelope. It must enforce a reviewed maximum age, atomically reject replay,
protect path ownership/mode/location and symlink replacement, minimize logs,
and reconcile append-only parent/child history. Missing or invalid bindings must
stop before consumer invocation and must never fall back to another collection.

The placeholder `{protected_trigger_payload_path}` is a design token. It is not
a configured binding and cannot become one through conversation or a passing
local evaluation.

## Run locally

```bash
node scripts/company/rehearse-protected-trigger-binding.cjs
node scripts/company/test-protected-trigger-binding.cjs
```

The first command returns exit `2` for a valid but activation-gated rehearsal.
It creates and removes only an operating-system temporary directory. A valid
result has two passed rehearsals, zero repository mutations, zero requested
consumer fallbacks, and all fourteen activation gates unsatisfied.

## Promotion boundary

The two synthetic runs receive no eligible-cycle credit. Before any production
payload is accepted, Kevin and the named owners must record D-017, select and
attest a protected runtime, satisfy every A-031/A-041/A-043/A-044/A-045/A-046/A-047/A-048/A-049/A-050 gate, complete
four independently reviewed protected shadow cycles, and separately admit the
exact packet, envelope, policy, identity, and effect digests with expiry and
revocation.
