# Shared Fusion Invitation Contract

Status: implementation contract  
Owner: Mythical Void game and platform  
Version: 2  
Date: 2026-07-31

## Purpose

Shared Fusion lets two known keepers create a protected, temporary Current
link between one willing adult companion in each sanctuary. It is a private
cooperative ritual, not matchmaking, trading, chat, or a public social graph.

This contract is the boundary for the first cross-owner feature. The local
Fusion Pod remains fully available without cloud storage or social features.

## Player Promise

- Both keepers choose one mature companion and confirm the final pairing.
- Both companions must be present, well, and willing at confirmation time.
- Neither parent leaves its sanctuary, changes owner, or is consumed.
- A successful Shared Fusion stabilizes two linked siblings.
- Each sanctuary receives one distinct sibling with a globally unique ID.
- Both sibling lineage records reference the same protected operation and
  identify the other sibling without exposing either keeper's account.
- Either keeper may cancel before the server commits the result.
- Once committed, replaying the invitation returns the same result.

## Eligibility

Shared Fusion is available only when all of the following are true:

- the local profile is confirmed as 16+;
- optional cloud saving is enabled with explicit consent;
- a valid anonymous cloud identity and current primary save exist;
- the Fusion Pod is unlocked;
- the selected companion is an adult or elder, has not departed, is not stuck,
  has at least 50 happiness, and is not sad or abandoned;
- the sanctuary has room for its one linked sibling;
- there is no unresolved local or shared Fusion operation.

Profiles marked under 16 do not create a cloud identity for Shared Fusion,
cannot create or join an invitation, and do not see a social-feature teaser.

Age selection is a privacy-minimized self-attestation, not legal identity or
high-assurance age verification. The feature must not be described as legally
verified. Its safety comes from removing communication, discovery, and
personal-data surfaces rather than inferring identity.

## Invitation Lifecycle

1. **Create:** Keeper A selects a willing companion. The server verifies the
   current private save and returns a random 48-bit code displayed as
   `XXXX-XXXX-XXXX`.
2. **Join:** Keeper B receives that code outside Mythical Void, enters it, and
   selects a willing companion. The server verifies B's private save.
3. **Review:** Each keeper sees their own companion's name and a bounded,
   name-free field summary of the other signal.
4. **Confirm:** Each keeper separately confirms. Confirmation rechecks the
   selected companion and collection capacity.
5. **Ready:** The server locks both parent proofs and reserves two offspring
   IDs, one for each sanctuary.
6. **Synthesis:** A protected server executor generates one deterministic
   sibling pair from the locked parent records.
7. **Commit:** One database transaction commits one sibling into each current
   save or commits neither. It also records matching lineage receipts.
8. **Reveal:** Each keeper resumes a native hatch and naming flow for their
   own sibling. The other sibling is represented only by its lineage ID and
   bounded field signature.
9. **Consequence:** The committed save lights the Kinship Beacon, records one
   Shared lineage, and marks the local child as having a protected sibling in
   another Sanctuary.

Invitations expire 15 minutes after creation. Expired, declined, cancelled,
or committed invitations cannot be reused. A keeper may have at most three
live invitations and may make at most ten join attempts in ten minutes.

## Data Boundary

The server stores:

- opaque cloud user IDs, visible only to protected server code;
- invitation and operation UUIDs;
- a one-way hash of the invitation code;
- selected companion IDs and bounded server-extracted parent records;
- parent fingerprints, save revisions, consent timestamps, status, and expiry;
- deterministic result and commit receipts.

The other keeper may see:

- rarity;
- affinity;
- generation;
- lifecycle stage;
- willingness and confirmation state.

The other keeper must never receive:

- cloud user ID;
- companion ID or custom companion name;
- keeper name, username, email, age band, location, IP address, or device data;
- free-form text, chat, links, images, voice, or generated media;
- full save state, inventory, progress, portraits, or provider references.

## Post-Commit Player Record

The consequence must remain understandable after the invitation expires:

- the Sanctuary Kinship Beacon shows that a Shared lineage exists;
- the Beacon may show a bounded Shared-lineage count;
- the local Companion Archive identifies `SHARED FUSION` as the origin;
- the Archive states that a linked sibling is safe in another Sanctuary;
- parent continuity and lack of ownership transfer remain explicit.

The portable Companion Archive may carry:

- the local child identity and player-given name;
- generation, affinity, rarity, powers, and local lineage;
- the local parent ID;
- a protected-parent count, never the remote parent fingerprint;
- a boolean that a linked sibling exists;
- a bounded Sanctuary Shared-lineage count;
- the shared operation ID already present in authoritative lineage.

It must not carry or display the remote sibling ID, remote custom name,
keeper identity, account ID, location, portrait, invitation ID, or message.

The code is never stored in plaintext. Direct table writes and reads are
revoked. Participant-scoped security-definer functions return bounded views.
Deletion of either anonymous cloud identity cancels or removes its pending
invitations through foreign-key cascade.

## Safety Rationale

Mythical Void is likely to be accessed by children. The feature therefore uses
high privacy by default, data minimization, short retention, no geolocation,
no profiling, no recommender system, no public discovery, and no channel for
user-generated communication. This reflects current FTC COPPA guidance, the
ICO Children's Code, EU Digital Services Act guidance for minors, and Ofcom's
child-access and risk-assessment expectations.

The studio must maintain a written child-access and feature risk assessment
before widening the boundary. Enabling usernames, chat, profiles, public
lobbies, player search, media sharing, location, open trading, or under-16
access is a significant product change and requires a new assessment,
moderation design, reporting tools, and explicit approval.

## Failure And Recovery

- Invalid or expired codes return the same generic response.
- A joiner cannot distinguish a nonexistent code from a cancelled or full one.
- Parent changes invalidate confirmation without exposing what changed.
- A save-revision conflict pauses the operation and asks the keeper to sync.
- Network loss after confirmation is recoverable by invitation UUID.
- Network loss after result generation replays the same server result.
- Partial cross-save commit is prohibited.
- Local Fusion remains available if Shared Fusion is unavailable, provided no
  unresolved shared operation can conflict with the selected companion.

## Explicitly Out Of Scope

- public matchmaking or suggested partners;
- usernames, friend lists, direct messaging, chat, reactions, or custom notes;
- creature trading, swapping, lending, sale, or transfer;
- shared custody or duplicated ownership;
- location sharing or proximity discovery;
- under-16 cloud invitations;
- generated portraits or story media shared between keepers;
- leaderboards, competitive rankings, or engagement streaks tied to invites.

## Release Gates

Shared Fusion may be exposed in production only when tests prove:

- age and cloud eligibility at client and server boundaries;
- no participant identifiers in peer-visible responses;
- code hashing, expiry, attempt limits, cancellation, and replay protection;
- dual keeper and dual companion consent;
- server extraction and fingerprinting of both parents;
- deterministic two-sibling generation;
- atomic two-save commit with capacity and revision checks;
- interruption recovery before and after generation;
- identity deletion cleanup;
- accessible phone and desktop UI without canvas-control overlap;
- save-backed Kinship Beacon and Companion Archive consequence without remote
  identifiers;
- local Fusion remains unchanged.
