# Protected backup, restore, and disaster recovery

## Outcome

A-051 defines the durability boundary required before Mythical can trust its
autonomous-company evidence after storage, account, coordinator, or
failure-domain loss. It binds current A-042 and A-046 through A-050 results into
one ordered, payload-free, six-record digest manifest and exercises real local
backup, full read-back, and isolated restore across separate temporary primary,
backup, restore, and quarantine directories.

The rehearsal detects corruption, truncation, record deletion and reordering,
stale generations, and unapproved failure domains. Four real simultaneous
restore contenders must yield exactly one winner, and global disable prevents
the restored state from becoming active. No raw evidence, payload, credential,
contact detail, or command is stored.

## Run locally

```bash
node scripts/company/rehearse-protected-backup-and-restore.cjs
node scripts/company/test-protected-backup-and-restore.cjs
```

A valid rehearsal exits `2`. All manifests, corruption clones, race records,
and refusal evidence live only in an operating-system temporary directory with
exclusive-create files and are removed afterward. Seventeen cloned manifests
exercise source substitution, invalid and stale generation, time and
failure-domain errors, missing/extra fields, payload or credential inclusion,
external authority, and global disable.

## Production boundary

Separate local directories do not prove provider, account, region, or key
independence; encryption; immutability; retention; distributed consistency;
RPO/RTO; or production restore. Production activation still requires D-017,
confirmed operators, selected independently reviewed failure domains,
separated identities and keys, approved retention/deletion and objectives,
complete backup/restore/region/account/key-loss exercises, runtime tracing,
open-world evaluation, four independently reviewed protected cycles including
an isolated restore, and separate expiring exact-policy approval. A restored
manifest never authorizes packet execution or an external action.

A-052 continues this chain with authenticated encryption, explicit synthetic
recovery-point/time measurement, primary-key-loss recovery, and threshold-
signed key release. Its ephemeral keys and local timings satisfy none of the
A-051 production durability gates.
