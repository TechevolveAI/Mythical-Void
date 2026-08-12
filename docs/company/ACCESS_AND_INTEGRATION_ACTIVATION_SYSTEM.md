# Access and Integration Activation System

**Status:** Inventory complete; all new activation gated  
**Date:** 11 August 2026  
**Control:** A-035 least-privilege integration activation assurance

## 1. Outcome

Mythical now has one machine-readable boundary between knowing that a system
exists and authorizing an agent to use it. The source of truth is
[`automation/integration-activation.json`](automation/integration-activation.json).
It covers public web access, source and deployment systems, DNS and webmaster
tools, social identity, inboxes, research, the protected runtime, approval and
alert infrastructure, finance, provider cost reports, analytics, CRM,
publishing, outreach, and payment execution.

For safeguarding inboxes and adult research systems, A-039 is now a mandatory
precondition: SGI-001 through SGI-005, all sixteen activation gates, all ten
exercises, protected route and restricted-record controls, and professional
review must be satisfied before A-035 can prepare even a metadata-read request.

A-035 exists because these statements are materially different:

- a public page can be fetched;
- Kevin has been observed using a human account;
- an owner and backup are confirmed;
- a provider-native identity has been invited;
- a connector is configured;
- a secret reference exists in a protected store;
- a read scope has been tested;
- a write operation is approved for one exact artifact;
- a workflow may execute that operation.

No agent may collapse those states into “access available.”

## 2. Current determination

Eighteen integration classes are inventoried. One anonymous public-read surface
is operational. Existing human GitHub and Netlify access has been observed, but
neither is an agent connector and neither grants company-task write or deploy
authority. The remaining fifteen classes are unknown, design-only, or deferred.

There are zero connected agent credentials, zero credential references, zero
new activation-ready integrations, and zero requested scopes. The register
contains no secret values, recovery codes, personal contacts, financial
actuals, or private account identifiers.

## 3. Activation lifecycle

Every new integration progresses independently through:

1. **Identify** — canonical provider/property and business purpose;
2. **Own** — accountable human, backup, recovery administrator, and expiry;
3. **Review** — data zones, safeguarding, privacy, security, terms, cost, and
   separation of duties;
4. **Approve** — exact minimum role and prohibited scopes, without credentials;
5. **Provision** — provider-native named or workload identity, MFA/recovery,
   and protected secret reference where unavoidable;
6. **Verify read** — correct tenant/property, least privilege, logging, rate
   limits, and no unintended writes;
7. **Exercise stop** — revocation, kill switch, connector failure, and recovery;
8. **Activate bounded use** — only the registered workflow and data purpose;
9. **Reconcile and remove** — usage review, outcome evidence, expiry, and
   access removal.

Provider-native invitations or workload identities are preferred. Credentials,
tokens, passwords, keys, recovery codes, personal data, and financial actuals
must never be pasted into chat, committed to the repository, or embedded in an
approval envelope.

## 4. Sequencing

The roadmap deliberately separates foundations from execution:

- **S0:** preserve anonymous public read and observed human contexts without
  converting them into connectors;
- **S1:** resolve safeguarding, finance, operating-cell, approval, and alert
  ownership before tool connection;
- **S2:** add separately reviewed read-only company intelligence such as DNS,
  webmaster, channel identity, provider usage, or existing aggregate reports;
- **S3:** add restricted research, inbox, CRM, or outreach systems only after
  purpose, consent, suppression, retention, and safeguarding controls;
- **S4:** external publishers, senders, banking, payments, or spend remain last
  and require trusted artifact-bound approval plus a separate executor.

Write access is never inferred from a successful read connection. An existing
broad human role is not reused as an agent role.

## 5. Kevin access brief

The register compiles five input-only questions from existing decisions:

1. KDP-001 / D-012 — safeguarding primary, backup, urgent route, and coverage;
2. KDP-002 / D-016 — finance owner and restricted source/process;
3. KDP-003 / D-017 — AG-001/AG-010 cell and runtime architecture class;
4. D-011 — exact existing social URLs or explicit confirmation none exist;
5. D-006 — master company/legal identity, business-email provider/admin, domain
   provider, and recovery ownership.

Answers are inputs to later review. They are not access grants, approval tokens,
or permission to create accounts, request credentials, invite identities, or
connect tools. No automated delivery route exists.

## 6. Operation

```bash
node scripts/company/validate-integration-activation.cjs
node scripts/company/test-integration-activation.cjs
```

A valid inventory exits gated. It fails if authority expands, a secret-like
field appears, a credential reference is added, a broad role is requested, a
connector is marked active without its gates, a write-capable integration is
advanced prematurely, a sensitive system lacks its data zone, or the access
brief implies that Kevin's response authorizes activation.

## 7. Promotion boundary

A-035 may eventually prepare scoped provider-native access requests after the
relevant owner, backup, provider, purpose, data, policy, role, recovery,
revocation, cost, and approval evidence exists. It may not send an invitation,
create an account or identity, connect a credential, expand a role, enable a
scheduler, activate a connector, or perform an external action. Those steps
remain separately approved and independently reconciled.
