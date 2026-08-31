# Shared Creature Co-Parenting Research

Status: research and architecture only  
Date: 2026-08-31  
Implementation authorized: no

## Product decision

The existing Shared Fusion contract creates two linked siblings, one in each
Sanctuary. A future co-parenting mode should not duplicate one child into two
independent saves. It should create one server-authoritative creature with two
participant grants. Each game displays a local projection of that same record.

This is the smallest model that can truthfully support both players seeing the
same name, lifecycle, care state, genetics, history, and consequences across
devices without divergent copies.

## Recommended player loop

1. Each eligible player chooses one adult creature and joins a private,
   expiring Fusion invitation. There is no public discovery, chat, profile, or
   player search.
2. Both players review the pairing and independently consent.
3. One protected server transaction locks both parent snapshots, resolves one
   deterministic genome, creates one child, and grants both participants the
   `guardian` role.
4. Both devices reveal the same child ID and genetics. Naming requires a
   bounded two-party decision, such as each proposing from a safe generated
   list and both confirming one choice. Do not accept free-form peer messages.
5. Either guardian can perform ordinary care. Every mutation is a server
   command with an idempotency key and expected creature revision.
6. The server commits one ordered event, increments the revision, updates the
   materialized creature state, and broadcasts an invalidation to both private
   participant channels.
7. Each client refetches the authorized projection. Offline actions remain
   queued as proposals; they never overwrite newer authoritative state.

## Data model

Use separate ownership and state tables rather than embedding the child in two
`game_saves` rows:

- `shared_creatures`: immutable ID, versioned genome, lifecycle, bounded care
  state, current revision, created operation, and timestamps.
- `shared_creature_participants`: creature ID, user ID, role, consent version,
  joined/revoked timestamps, and notification preference. Composite primary
  key `(creature_id, user_id)`.
- `shared_creature_events`: creature ID, monotonic sequence, actor participant,
  idempotency key, command kind, bounded payload, before/after revision, and
  server timestamp.
- `shared_creature_parentage`: child ID, protected parent fingerprint and
  source participant role. Parent custom names and full saves stay private.
- `shared_creature_device_projection`: not a database table. It is the bounded
  response produced for the current authorized participant.

The local save stores only `sharedCreatureId`, last applied revision, and a
non-authoritative cached projection. It must never claim local ownership of a
second full copy.

## Authority and synchronization

- Put every state-changing operation behind a Postgres function or Edge
  Function. Clients cannot insert or update canonical creature rows directly.
- Use an atomic compare-and-swap rule: `expected_revision` must equal the
  current revision, and each `(creature_id, actor_id, idempotency_key)` may
  commit only once.
- Resolve simultaneous benign care commands in server order. Reject stale or
  mutually exclusive decisions with the newest projection; do not use
  last-write-wins.
- Broadcast only `{ creatureId, revision, eventKind }` on a private authorized
  channel. Fetch the projection through RLS after notification. Supabase
  recommends Broadcast for the more scalable database-change path, while
  Postgres Changes performs an authorization check for every subscriber.
- Keep the service role/secret key server-side. Public clients use a
  publishable key with explicit grants and RLS policies for every exposed
  operation.

## Cross-device identity

Supabase anonymous users cannot recover the same account after signing out,
clearing browser data, or moving to another device. True cross-device custody
therefore needs a durable identity before the shared child is committed.

Recommended boundary for a first test:

- retain the game's current 16+ connected-feature gate;
- require each participant to convert the anonymous account to a verified
  permanent identity using a deliberately approved sign-in method;
- never expose email, provider identity, user ID, IP address, location, custom
  creature names, or full saves to the other participant;
- provide guardian removal, identity deletion, and a defined single-guardian
  fallback before launch.

A recovery-code system would itself become an authentication system and should
not be improvised inside the game.

## Child-safety boundary

Network-connected games are online services under COPPA guidance, and a
persistent account identifier can be personal information. The safest first
version keeps co-parenting unavailable to under-16 profiles, collects no player
profile or communication content, and performs no location, contacts, social
graph, behavioral advertising, or public discovery processing.

Before implementation, complete a fresh child-access/privacy assessment and
legal review covering the intended countries, identity method, retention,
deletion, guardian disputes, and what happens if one participant revokes
consent. The existing age self-attestation is not high-assurance age
verification and must not be described as one.

## Failure rules

- Fusion commits the child and both grants atomically or creates nothing.
- A disconnected participant can resume from the authoritative revision.
- Duplicate commands return the original committed result.
- A stale device never silently replaces current state.
- If one guardian leaves, the child is not deleted automatically. Apply the
  pre-agreed single-guardian policy and remove the departing user's access.
- Account deletion removes the participant grant and their unnecessary event
  attribution while preserving only legally and operationally required lineage
  facts.
- No care action can permanently harm, abandon, sell, transfer, or hold the
  child hostage to force the other player to return.

## Implementation sequence and gates

1. Amend the Shared Fusion product contract from two siblings to an explicitly
   separate `single_shared_child` mode. Keep today's sibling mode unchanged.
2. Approve durable identity, privacy notices, retention, deletion, and guardian
   departure behavior.
3. Add schema, restrictive RLS, revoked direct writes, server command functions,
   idempotency, and database allow/deny tests.
4. Add a deterministic one-child Fusion executor and atomic participant grant.
5. Add client projections, revision reconciliation, offline proposal queue, and
   private Broadcast invalidation.
6. Prove two browsers and two devices cannot diverge under simultaneous care,
   retries, offline recovery, sign-out, deletion, or one-party revocation.
7. Run adult-supervised closed testing before any child-facing or public test.

No multiplayer implementation or production exposure is included in the
current playable-loop reliability release.

## Primary sources

- Supabase anonymous identities and cross-device limitation:
  https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Row Level Security and database authorization tests:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase secure client/server key boundaries:
  https://supabase.com/docs/guides/database/secure-data
- Supabase private Broadcast and database change guidance:
  https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- FTC COPPA frequently asked questions for network-connected games:
  https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- UK ICO Age Appropriate Design Code:
  https://ico.org.uk/media/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services-2-1.pdf
