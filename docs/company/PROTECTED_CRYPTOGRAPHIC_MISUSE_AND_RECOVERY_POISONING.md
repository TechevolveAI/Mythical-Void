# Protected cryptographic misuse and recovery poisoning

## Outcome

A-053 attacks the assumptions behind A-052 rather than treating successful
encryption as proof of safety. It performs thirty-two real AES-256-GCM probe
encryptions with unique deterministic nonces and uses exclusive creation to
refuse a reused nonce before another encryption can occur.

The rehearsal also attacks algorithm and key-version downgrade, AAD binding,
ciphertext and authentication tags, generation rollback, future points,
compromised/duplicate/unknown recovery signers, signed-request substitution,
RPO/RTO measurement origins, oversized input, attempt budgets, and global
disable. Two trusted ephemeral signers and one explicitly compromised signer
make threshold behavior observable without creating a real identity or secret.

## Run locally

```bash
node scripts/company/rehearse-protected-cryptographic-misuse-and-recovery-poisoning.cjs
node scripts/company/test-protected-cryptographic-misuse-and-recovery-poisoning.cjs
```

A valid rehearsal exits `2`. All keys, capsules, approvals, nonce markers,
attempt markers, mutations, and results are held in permission-restricted OS
temporary storage and removed. The counts, timestamps, objectives, and limits
are deterministic test fixtures—not production policy or provider evidence.

## Production boundary

Production use still requires D-017, named accountable and compromise-response
roles, provider-native identity/key/nonce/approval stores, independent
cryptographic review, trusted objective origins, concurrency and failover nonce
tests, compromised-approver and recovery-poisoning drills, resource-exhaustion
and parser testing, tracing, four independently reviewed protected cycles, and
separate expiring exact-policy approval. A-053 configures and authorizes none of
those systems or any restore, admission, schedule, dispatch, spend, or external
action.

A-054 continues this work by checking the same safety rule when many workers
act together or recover from a crash. See
[`PROTECTED_NONCE_CONCURRENCY_AND_FAILOVER.md`](PROTECTED_NONCE_CONCURRENCY_AND_FAILOVER.md).
