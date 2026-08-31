# Shared Guardianship Governance and Release Contract

**Version:** 1.0  
**Date:** 31 August 2026  
**Owner:** Tech Evolve AI  
**Applies to:** Shared Guardianship MVP

## Authority Boundary

Shared Guardianship creates one canonical server creature used by two verified
guardians. Neither local save is authoritative. Clients may cache a projection,
but every mutation is an authenticated bounded command checked by the server.

The feature is unavailable unless all of these gates are true:

1. the player selected an eligible `16 to 17` or `18 or older` age range;
2. Cloud Save is enabled and its latest save is committed;
3. the Supabase session is permanent, not anonymous;
4. the email identity is verified;
5. both guardians accepted the current consent and privacy versions;
6. production manual identity linking and email delivery were smoke tested;
7. the release feature flag is enabled.

Solo play, local saving and ordinary Fusion remain usable if any gate is false.

## Privacy and Safety Rules

- Collect only the email needed by Supabase Auth. Never copy it into game tables,
  event records, telemetry, invitations or peer-visible payloads.
- Do not add chat, free-form messages, public discovery, searchable profiles,
  contact import, location, online status or behavioural advertising.
- Invitation payloads expose only bounded creature traits and neutral guardian
  labels.
- Under-16 profiles cannot create, join, inspect or receive a shared invitation.
- Age is self-attested and must be described honestly; it is not verified age.
- No absence, missed action or departure can injure or delete the creature.
- Either guardian can leave. One guardian cannot remove the other, transfer the
  creature, expose the other guardian's identity or erase shared history.
- Account deletion revokes participation and removes unnecessary attribution.
  Immutable parentage retains only non-identifying lineage fingerprints.

## Data Retention

| Record | Retention |
|---|---|
| Unjoined invitation | Until expiry, then no more than 30 days for abuse investigation |
| Cancelled invitation | No more than 30 days |
| Join-attempt rate-limit record | No more than 24 hours |
| Canonical shared creature | While at least one guardian retains it |
| Care events | Latest 100 player-visible events; bounded security records follow service policy |
| Revoked participant | User ID removed or one-way pseudonymised when no longer needed |
| Email and credential | Supabase Auth only, until account deletion |

## Threat Model

| Threat | Required control |
|---|---|
| Guessing invitation codes | 48-bit private codes, expiry, single use, per-user rate limits |
| Self-pairing | Reject identical authenticated user IDs |
| Anonymous bypass | Server checks JWT `is_anonymous=false` on every entry and mutation |
| Forged parent | Resolve an eligible parent from the caller's committed cloud save |
| Consent replay | Bind consent to invitation, parent fingerprint and terms version |
| Duplicate child | Unique invitation constraint plus idempotent atomic commit |
| Lost update | Expected revision and one server transaction per command |
| Unauthorized read | Participant-only security-definer projections; direct table access revoked |
| Revoked user replay | Active-participant check inside every command transaction |
| Peer identity exposure | Never return email, provider, user ID or save data |
| Account takeover | Verified email, password policy, reset flow and Supabase session controls |
| Service outage | Last safe cache remains visible; solo game never waits on shared services |

## Change Control

The following changes require a new privacy and safeguarding review before code
is enabled: lowering the age boundary, adding communication, public discovery,
more guardians, custody transfer, synchronous multiplayer, monetisation tied to
care, precise presence, user-written names visible to a peer, or story decisions
that affect another guardian.

Database migrations are additive. Existing sibling Fusion records are not
rewritten. The release flag may hide new entry points without deleting canonical
data. Rollback restores the previous client while server records remain intact.

## Release Evidence

Production activation requires all of the following, bound to one source commit:

- migration and RLS allow/deny tests;
- anonymous-user denial tests;
- two permanent-account invitation, consent and one-child proof;
- identical child ID/genome/revision on two sessions;
- action A to B and action B to offline/reconnected A convergence;
- duplicate, stale and simultaneous command tests;
- non-participant and revoked-participant denial;
- departure and account-deletion cleanup;
- 390x844 and desktop invitation/consent/habitat UI review;
- zero direct identifiers in peer payloads or observability;
- manual-linking and production email delivery smoke;
- normal build, full tests and protected release workflow.

No test account credentials, email addresses or invitation codes are committed
to source control or retained in screenshots.
