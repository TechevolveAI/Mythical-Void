# Authenticated exception delivery

## Outcome

A-047 defines the protected route between a material control-plane exception
and an accountable human without connecting a real sender or storing a route
value. Only changed high or critical A-015 findings are eligible. Each alert is
bound to the exact A-015 result and current A-046 history evidence, signed by an
ephemeral synthetic sender, addressed to one exact synthetic recipient role,
deduplicated, and acknowledged with a separate ephemeral recipient signature.

The rehearsal covers a successful primary delivery and acknowledgement, exact
duplicate suppression, two bounded primary-route failures, backup failover, and
a successful backup acknowledgement. Sixteen cloned attacks exercise signature,
source/history binding, time, severity, fields, authority, payload, recipient,
revocation, retry, size, and acknowledgement failures.

## Metadata boundary

An alert includes only identifiers, timestamps, severity/category, A-015 and
A-046 digests, high/critical change IDs, route and synthetic recipient-role
references, attempt number, an idempotency key, and explicit false authority
and payload flags. It excludes raw change/history output, before/after values,
messages, contact details, customer or personal data, credentials, commands,
and approval content.

## Run locally

```bash
node scripts/company/rehearse-authenticated-exception-delivery.cjs
node scripts/company/test-authenticated-exception-delivery.cjs
```

A valid rehearsal exits `2`. All ledgers live in an operating-system temporary
directory, use exclusive creation, are removed after the run, and do not count
as external delivery or an eligible protected cycle.

A-048 binds this current exception evidence into its offline execution-lease
rehearsal. That local binding does not configure a production alert route or
make either rehearsal promotion eligible.

## Production boundary

Ephemeral keys and synthetic route identifiers do not authenticate Kevin, a
backup, a provider, or a delivery channel. Production activation requires
D-017, accountable people, independent primary/backup failure domains,
provider/account/region/cost review, protected identities and receipts,
retention, acknowledgement objectives, quiet hours, storm controls,
revocation, minimization, failure/recovery and kill exercises, runtime tracing,
open-world evaluation, four independently reviewed protected cycles, and a
separate expiring exact-policy approval. An alert or acknowledgement can never
authorize or execute the action it describes.
