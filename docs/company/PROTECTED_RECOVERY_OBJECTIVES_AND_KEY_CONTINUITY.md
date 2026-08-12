# Protected recovery objectives and key continuity

## Outcome

A-052 defines what must be true before Mythical may describe a protected backup
as recoverable within an objective. It consumes the current A-051 result, binds
that result and its contract into three ordered payload-free recovery points,
encrypts the current capsule with ephemeral AES-256-GCM, and measures a fixed
synthetic incident against explicit local RPO and RTO bounds.

The rehearsal also decrypts the predecessor generation with its predecessor key
after rotation. It removes the primary active key, then requires two valid
signatures from three independent ephemeral recovery approvers before a separate temporary
recovery-key copy may be used. One approval, an untrusted or revoked signer, a
wrong key, corrupt ciphertext or tag, stale or future recovery point, co-located
storage and key domains, and global disable all fail closed. Decryption never
means activation.

## Run locally

```bash
node scripts/company/rehearse-protected-recovery-objectives-and-key-continuity.cjs
node scripts/company/test-protected-recovery-objectives-and-key-continuity.cjs
```

A valid rehearsal exits `2`. Capsules, AES keys, ephemeral signing keys,
approvals, mutations, and results exist only in permission-restricted operating-
system temporary directories and are removed afterward. The reported 120-second
recovery-point loss and sub-3000-millisecond recovery time are deterministic
local observations, not production objectives or provider evidence.

## Production boundary

Production readiness still requires D-017, accountable owners and independent
approvers, selected and reviewed storage/key/identity failure domains, approved
RPO/RTO definitions, provider-native key protection, rotation, revocation,
recovery, escrow and deletion, measured monitoring and alerting, key and account
loss exercises, cryptographic and open-world review, four independently reviewed
protected cycles including isolated key-loss recovery, and separate expiring
exact-policy approval. No provider, account, identity, key, objective, schedule,
network path, restore, admission, dispatch, spend, or external action is
configured or authorized by A-052.

A-053 continues this chain by adversarially testing nonce uniqueness,
algorithm/AAD/key-version binding, rollback, compromised recovery approvals,
objective-origin poisoning, resource bounds, and global disable. See
[`PROTECTED_CRYPTOGRAPHIC_MISUSE_AND_RECOVERY_POISONING.md`](PROTECTED_CRYPTOGRAPHIC_MISUSE_AND_RECOVERY_POISONING.md).
