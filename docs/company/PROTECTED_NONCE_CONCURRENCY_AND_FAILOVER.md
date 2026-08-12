# Protected nonce concurrency and failover

## Outcome

A-054 tests whether A-053's nonce rules remain safe when several workers race,
retry, crash, fail over, restore old state, rotate keys, or run out of counter
space. Sixteen real local allocator processes must claim sixteen unique nonce
slots, and eight retry claimants for one request must produce exactly one
commit winner.

The rehearsal performs actual AES-256-GCM round trips only after allocation. A
nonce reserved before crash, cancellation, or global disable is burned rather
than reused. An independent high-watermark anchor rejects rollback, corrupt
ledger state is quarantined, key versions have separate namespaces, and a
simulated regional duplicate, stale fence, or exhausted counter fails before
encryption.

## Run locally

```bash
node scripts/company/rehearse-protected-nonce-concurrency-and-failover.cjs
node scripts/company/test-protected-nonce-concurrency-and-failover.cjs
```

A valid rehearsal exits `2`. Keys, nonce allocations, request claims,
ciphertexts, anchors, mutations, and quarantine records exist only in
permission-restricted operating-system temporary storage and are removed.
Local exclusive files demonstrate the specified fault semantics, not
production linearizability, cross-region durability, or provider capability.

## Production boundary

Production use still requires D-017, named nonce/key custodians and recovery,
kill, compromise, backup, and urgent-response owners; an independently reviewed
provider-native consensus-backed nonce service; durable rollback-resistant
anchors; verified request idempotency; crash, ambiguous-completion, retry,
restore, corruption, split-brain, regional-failover, rotation, rollover,
exhaustion, parser, and denial-of-service exercises; tracing; four independently
reviewed protected cycles; and separate expiring exact-policy approval. A-054
configures or authorizes none of those systems or any restore, admission,
schedule, dispatch, spend, promotion, or external action.
