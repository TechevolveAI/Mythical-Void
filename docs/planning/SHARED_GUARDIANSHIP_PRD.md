# PRD: Shared Guardianship
## One Persistent Creature Across Two Sanctuaries

**Version:** 1.0  
**Date:** 31 August 2026  
**Status:** Approved MVP contract; implementation authorized  
**Product name:** Shared Guardianship  
**Related research:** `docs/planning/SHARED_CREATURE_CO_PARENTING_RESEARCH.md`

---

## Executive Summary

Shared Guardianship allows two trusted players to each contribute one eligible
creature to Fusion and become guardians of one newly born creature. The child
is one server-authoritative life, not two copied creatures and not an object
passed between devices.

Both guardians can always see and care for the same creature from their own
Sanctuary. Actions synchronize through a shared record. The MVP focuses on the
birth, shared presence, ordinary care, visible contribution history and safe
cross-device continuity. Story events, synchronous cooperative gameplay,
chat, public discovery and competitive mechanics are explicitly deferred.

The feature should feel like shared responsibility without creating pressure,
punishment or dependence on the other player being online.

---

## Product Opportunity

Most multiplayer creature games use trading, battling or duplicated pets.
Mythical Void can offer a more emotionally distinctive relationship: two
people care for one persistent alien life whose genetics visibly came from
both of their creatures.

The feature can create:

- a meaningful invitation reason rather than a generic referral;
- a memorable two-player Fusion and hatching reveal;
- recurring return behavior based on curiosity and cooperation;
- a visible record of both guardians helping the creature;
- a foundation for later shared expeditions and story moments without making
  those systems part of this MVP.

---

## Product Principles

1. **One life, two windows:** both players see projections of one canonical
   creature record.
2. **Always available:** the creature is never checked out, transferred or
   made unavailable because the other guardian is playing.
3. **Asynchronous first:** either guardian can play normally without arranging
   a simultaneous session.
4. **No guilt mechanics:** absence cannot injure, abandon, remove or permanently
   disadvantage the creature.
5. **Visible contribution:** the interface shows what changed and who helped,
   without exposing personal information.
6. **Consent at irreversible moments:** both players approve Fusion and the
   initial shared name. Routine care does not require dual confirmation.
7. **Private by design:** trusted invitations only, with no chat, public player
   search, social graph or discoverable profiles.
8. **Solo game remains complete:** Shared Guardianship enhances Mythical Void;
   it is never required to finish the game or obtain core progression.

---

## Goals

### MVP Goals

- Let two eligible players privately connect using an expiring invitation.
- Let each player contribute one eligible adult creature with informed consent.
- Generate exactly one deterministic child with truthful inherited genetics.
- Grant both players continuing access to that same child.
- Show the shared creature in both Sanctuaries at all times.
- Synchronize name, genetics, lifecycle, needs, care, bond and history safely.
- Let either guardian complete ordinary care independently.
- Show concise, friendly updates about the other guardian's contributions.
- Recover correctly after retries, offline play, stale clients and device changes.
- Let either guardian leave without deleting or holding the creature hostage.

### Success Definition

An unfamiliar eligible player can invite a trusted second player, understand
that they are creating one shared creature, complete Fusion, see the same child
on both devices, care for it independently and observe the resulting state on
the other device without coaching or contradictory data.

---

## Non-Goals

The MVP does not include:

- story-event integration or shared campaign decisions;
- real-time cooperative levels, combat or simultaneous creature control;
- chat, voice, free-form peer messaging or image sharing;
- public matchmaking, player search, friend lists or profiles;
- creature trading, selling, gifting or custody transfer;
- breeding the shared child again;
- more than two guardians;
- guardian-versus-guardian competition, scoring or care streak comparison;
- location, contacts, social graph or behavioral advertising;
- under-16 access to the connected feature;
- a custom recovery-code identity system;
- generated video as a dependency for Fusion or care.

---

## Target Users

### Primary

- Trusted real-world pairs aged 16 or older: siblings, friends, partners,
  parent and older child, or family members living apart.
- Existing Mythical Void players who have each raised at least one eligible
  adult creature and understand ordinary care and Fusion.

### Excluded From MVP

- Players marked under 16.
- Anonymous-only players who cannot recover a durable account on another
  device.
- Unknown players seeking matchmaking or public social interaction.

---

## Core Player Journey

### 1. Unlock

Shared Guardianship appears in the Fusion Pod only when the player:

- is eligible for connected features;
- has a verified durable identity;
- owns an eligible adult creature;
- has completed the ordinary solo Fusion explanation;
- has no conflicting active shared-Fusion operation.

The locked state explains the next requirement in plain language.

### 2. Create Private Invitation

The host selects one eligible creature and creates a short-lived private
invitation. The game displays a code or link and a clear warning to share it
only with someone they know.

The invitation contains no public player profile, creature custom name, email
or other personal information. It expires automatically and can be cancelled.

### 3. Join and Select

The second player opens the invitation, signs in if required, selects one
eligible creature and reviews the proposed pairing. Both players see bounded
creature facts needed for consent: classification, visible genetic traits,
generation, lifecycle stage and compatibility. Private save data remains
hidden.

### 4. Independent Consent

Each player independently confirms:

- the selected parent creature;
- that one shared child will be created;
- that both guardians will always have access;
- that routine actions by either guardian affect the same creature;
- the departure and single-guardian policy.

Fusion creates nothing unless both current consents are valid.

### 5. Shared Fusion and Reveal

One atomic server operation locks the two parent snapshots, generates one
deterministic genome, creates one child and grants access to both guardians.
Both devices receive the same creature ID, genetics and reveal state.

If one player disconnects, the committed child remains safe and the reveal is
resumable. A retry cannot create a second child.

### 6. Shared Naming

Each guardian chooses or proposes from a moderated generated list. A name is
committed when both approve the same option. Until then, the creature uses a
neutral temporary classification. Free-form messages between players are not
part of naming.

### 7. Everyday Shared Care

The shared creature is visible in a dedicated Sanctuary habitat on both
devices. Either guardian can perform bounded actions such as feeding, resting,
playing, grooming or gathering a requested material.

The result is committed once to the canonical creature and appears on both
devices. The other player's presence is not required.

### 8. Contribution History

The habitat shows a small chronological record using guardian labels selected
from safe defaults, for example:

- `Guardian A gathered crystal moss.`
- `Guardian B helped the creature rest.`
- `The creature discovered a new response.`

Do not display email, account name, location, precise activity time or private
save details.

### 9. Departure

Either guardian can leave after a clear confirmation. Their access is removed,
the creature remains with the continuing guardian and no progress is lost.
There is no unilateral delete, transfer, sale or hostage state.

---

## Functional Requirements

### Identity and Eligibility

| ID | Requirement |
|---|---|
| SG-001 | Both participants must pass the current connected-feature age boundary. |
| SG-002 | Both participants must use durable, verified identities before the child is committed. |
| SG-003 | Anonymous progress may begin the invitation explanation but cannot complete shared Fusion. |
| SG-004 | A participant can have a configurable maximum number of active shared creatures; MVP default is one. |
| SG-005 | The system must prevent a player from inviting themselves through a second session. |

### Invitation and Consent

| ID | Requirement |
|---|---|
| SG-010 | Invitations must be private, single-use, revocable and expire within a bounded period. |
| SG-011 | Joining must reveal no direct identifier or unrelated save data. |
| SG-012 | Both players must confirm the exact parent fingerprint and current terms version. |
| SG-013 | Changing either parent after consent invalidates both consents. |
| SG-014 | Fusion must commit the child and both participant grants atomically or create nothing. |
| SG-015 | Repeating the same operation must return the original result, never another child. |

### Shared Creature

| ID | Requirement |
|---|---|
| SG-020 | One immutable shared-creature ID must represent the child on every device. |
| SG-021 | Both guardians must see the same genome, name, lifecycle, care state and history revision. |
| SG-022 | The creature must remain visible and interactable on both devices; it is never passed between them. |
| SG-023 | Genetics must be derived deterministically from the protected parent snapshots using the production Breeding Engine contract. |
| SG-024 | The interface must clearly label the creature as shared without making it look unavailable when the other guardian is active. |
| SG-025 | Generated portrait or video failures must never block reveal, care or synchronization. |

### Care and Synchronization

| ID | Requirement |
|---|---|
| SG-030 | Every mutation must be a bounded server command with actor, idempotency key and expected revision. |
| SG-031 | Successful commands increment one monotonic creature revision. |
| SG-032 | Duplicate commands return the original committed result. |
| SG-033 | Stale commands return the newest projection and never overwrite later state. |
| SG-034 | Simultaneous compatible actions resolve in server order. |
| SG-035 | Mutually exclusive actions reject one command with a friendly refresh state. |
| SG-036 | Offline actions remain proposals until accepted by the server; clients cannot declare them canonical. |
| SG-037 | MVP clients poll the participant-scoped projection every three seconds; a future private invalidation message may contain only creature ID, revision and event kind. |
| SG-038 | Losing connectivity must not freeze the solo game or hide the last safe shared-creature projection. |

### Safety and Control

| ID | Requirement |
|---|---|
| SG-040 | No action can permanently harm, abandon, sell, transfer or delete the shared creature. |
| SG-041 | One guardian cannot rename, evolve or make another irreversible decision alone. |
| SG-042 | Absence and missed care cannot punish either guardian or permanently reduce the creature. |
| SG-043 | Each guardian can mute shared-creature notifications without leaving. |
| SG-044 | Each guardian can revoke their own participation. |
| SG-045 | Revocation removes access and applies the documented single-guardian fallback. |
| SG-046 | Account deletion removes unnecessary participant attribution while retaining only required lineage integrity. |

---

## Experience and Interface Requirements

### Sanctuary Presence

- Use one clearly authored habitat or landmark for the shared creature.
- Show the same creature renderer and genetics as its canonical record.
- Use a restrained shared symbol beside the name, not a large multiplayer HUD.
- Keep normal movement and solo interactions available when synchronization is
  unavailable.
- Show `Last synced recently` only when useful; avoid technical revision text.

### Status Language

Use plain player-facing states:

- `Together` - current shared state is available.
- `Saving this moment` - a care action is being committed.
- `Connection paused` - the cached creature remains visible.
- `Updating your Sanctuary` - a newer revision is being fetched.
- `This action already happened` - a duplicate safely replayed.

Do not show database, account, RPC, revision-conflict or synchronization jargon.

### Notification Rules

- Batch routine updates rather than notifying every care action.
- Never use guilt language such as `Your creature missed you` or `Guardian B
  has not returned`.
- Allow a digest such as `Two new moments with Aster`.
- Do not expose the other guardian's online status in the MVP.

---

## Canonical Data and Service Boundary

The shared child must not be embedded as two writable copies in separate
`game_saves` rows.

### Required Records

- `shared_creatures`: canonical genome, lifecycle, bounded care state and
  current revision.
- `shared_creature_participants`: creature, guardian, role, consent version,
  notification settings and revocation state.
- `shared_creature_events`: ordered idempotent commands and before/after
  revisions.
- `shared_creature_parentage`: protected parent fingerprints and source roles.

The local save stores only the shared creature ID, last applied revision and a
non-authoritative cached projection.

### Authority Rules

- Direct client writes to canonical records are revoked.
- State changes run through Postgres or Edge Functions with RLS and explicit
  authorization.
- Service-role credentials remain server-side.
- Three-second participant-scoped polling is the MVP synchronization transport;
  the polled projection is never writable client state.
- A future Realtime Broadcast may be added only as an invalidation signal. Every
  client must still refetch its authorized projection after an invalidation.

---

## Privacy and Safeguarding

Before implementation, complete and approve a fresh privacy and child-access
assessment for the intended launch countries.

Minimum boundary:

- connected feature restricted to eligible 16+ profiles in the MVP;
- verified durable identity for both guardians;
- no chat, public discovery, profile search, contacts or location;
- no behavioral advertising or sale of shared activity data;
- no disclosure of email, provider ID, user ID, IP address or private save;
- documented retention, deletion, revocation and dispute behavior;
- rate limits and abuse monitoring on invitations and commands;
- clear language that age self-attestation is not high-assurance verification.

---

## Non-Functional Requirements

| Area | Requirement |
|---|---|
| Consistency | No accepted test may produce divergent canonical state between two clients. |
| Availability | Temporary network failure must retain the last safe cache and resume polling without blocking solo play. |
| Latency | A committed care action should appear on the other online device within 3 seconds at p95 under normal service conditions. |
| Recovery | Reconnect must converge from any stale cached revision without manual reset. |
| Security | RLS deny tests must cover non-participants, revoked guardians and forged creature IDs. |
| Idempotency | Network retries must not duplicate care, rewards, naming or Fusion. |
| Accessibility | All shared states and actions need readable text, focus order and non-color status cues. |
| Mobile | Primary invitation, consent, reveal and care actions must fit 390x844 without overlap. |
| Observability | Record bounded operational events without creature names, messages or direct identifiers. |

---

## Measurement Plan

Measurement begins only after privacy approval and must use bounded event names.

### Product Signals

- eligible players who open the Shared Guardianship explanation;
- invitations created, joined, expired and cancelled;
- pairings reaching two valid consents;
- shared Fusions committed successfully;
- first shared care action completed by each guardian;
- both guardians active in the same seven-day period;
- synchronization failures and successful recoveries;
- participant revocation and single-guardian fallback completion.

### MVP Success Thresholds for Closed Testing

- 90% of supervised pairs understand that there is one creature visible on
  both devices before consenting.
- 95% of completed Fusions reveal the same child identity on both devices.
- 100% convergence after the planned offline, retry and simultaneous-action
  test matrix.
- No test produces duplicate children or irrecoverable divergent state.
- At least 80% of pairs complete one care action from each device without
  coaching.
- Zero exposure of direct participant identifiers to the other guardian.

These are validation thresholds, not launch claims.

---

## Acceptance Test Matrix

The MVP is not complete until all cases pass with two independent accounts and
two independent browser/device sessions.

1. Create, join, consent and commit one child.
2. Verify identical child ID, genome, name state and revision on both devices.
3. Perform care on device A and observe the committed result on device B.
4. Perform care on device B while device A is offline; reconnect A and converge.
5. Submit the same command repeatedly and verify one event/reward.
6. Submit simultaneous compatible commands and verify ordered convergence.
7. Submit simultaneous conflicting commands and verify friendly rejection plus
   refresh.
8. Disconnect during Fusion and resume the same reveal without a duplicate.
9. Clear one device and recover through the verified identity.
10. Attempt access from a non-participant and verify denial.
11. Revoke one guardian and verify immediate access removal plus safe continuity.
12. Delete a smoke identity and verify participant-data cleanup.
13. Interrupt projection polling and verify cached display plus reconnect recovery.
14. Confirm that portrait/video failure does not delay gameplay.
15. Confirm no chat, public discovery or personal identifier is exposed.

---

## Rollout Plan

### Phase 0: Decisions and Safety

- Approve final feature name and player-facing promise.
- Approve durable identity method.
- Approve age boundary, privacy notice, retention and deletion policy.
- Approve single-guardian fallback and dispute behavior.

**Stop gate:** no implementation until all four decisions have named owners.

### Phase 1: Server Foundation

- Add canonical tables, restrictive RLS and revoked direct writes.
- Add atomic invitation, consent, Fusion and command functions.
- Add idempotency, expected-revision and deterministic outcome tests.

**Stop gate:** full allow/deny and concurrency suite passes before client UI.

### Phase 2: Two-Device Internal Prototype

- Add private invitation and consent UI.
- Add one shared-child reveal and cached device projection.
- Add one ordinary care action and contribution history.
- Add reconnect and stale-client recovery.

**Stop gate:** complete acceptance matrix passes with synthetic accounts.

### Phase 3: Adult-Supervised Closed Test

- Test with a small number of known adult pairs.
- Measure comprehension, emotional response, synchronization and departure.
- Review support burden and privacy evidence.

**Stop gate:** no child-facing or public test without explicit review.

### Phase 4: Limited Release Decision

- Decide whether to retain, revise or stop the feature.
- Only then consider additional care actions, shared expeditions or story use.

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Players believe the creature is copied | Use one-child language, shared ID and identical history; test comprehension before consent. |
| One guardian dominates decisions | Require dual consent for naming and future irreversible actions. |
| Absence creates guilt | No decay, injury or punishment from inactivity; use neutral notification language. |
| State diverges across devices | Canonical server state, expected revisions, idempotency and refetch after invalidation. |
| Anonymous account is lost | Require durable verified identity before commitment. |
| Invitation reaches a stranger | Private expiring single-use invitation, rate limits and no discovery. |
| Child-safety scope expands accidentally | Preserve 16+ boundary, no communication features and formal privacy gate. |
| Feature blocks solo progression | Keep shared care optional and isolate service failures from the main game. |
| Guardian leaves or deletes account | Defined single-guardian fallback and participant-grant removal. |
| Operating costs grow | Use bounded events and compact three-second projections; evaluate private invalidations only if measured load requires them. |

---

## Approved Product Decisions

1. The player-facing name is `Shared Guardianship`.
2. The first durable identity is a verified email identity with a password.
   An existing anonymous Supabase identity is converted in place so its user ID
   and current save ownership do not change. Solo play never requires an
   account.
3. The initial name is selected from a moderated generated list and requires
   exact approval from both guardians. No free-form peer messaging is created.
4. Each player may participate in one active shared creature in the MVP.
5. If one guardian leaves, access is revoked immediately and the creature
   remains safely with the continuing guardian. The departing guardian cannot
   delete, transfer or rename it.
6. Contribution history uses `Guardian A` and `Guardian B`; it never displays
   email addresses, account names or online presence.
7. The shared creature remains in a dedicated Sanctuary habitat in the MVP.
   Story and ordinary-level integration are deferred.
8. Existing two-sibling Shared Fusion remains available only as a rollback
   implementation boundary. It is not silently converted into one shared
   creature.

---

## Recommendation

Proceed only after the current solo hatching, care and Fusion experiences are
consistently strong for ordinary players. Then build the smallest asynchronous
prototype: one invitation, one child, one habitat, one care action and two
devices converging on one state.

Do not begin with synchronous gameplay or story integration. The product value
can be proven by one simple question: **Do two people feel that this is one
living creature they genuinely share, without either person's play being held
back by the other?**
