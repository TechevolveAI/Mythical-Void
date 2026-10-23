# Mythical Void Core Journey Implementation Runbook

## Purpose

Improve the game one understandable player journey at a time without replacing
working systems. The production gameplay represented by
`core-journey-baseline-2026-09-09.json` is the rollback boundary.

## Release Shape

### Save and restart iteration, 23/10/2026

The current private candidate starts from protected main `43d9281b`. The older
phase baseline and rollback deploy below describe the September work, not this
candidate's release target.

The default journey is: first visit → new egg; return → Continue or Start a new
adventure. New adventures keep separate browser saves, recovery records and
anonymous online identities. Existing adventures remain selectable. Starting a
new adventure does not erase, restore or acknowledge an uncertain older save.
Sound, accessibility and readable safety preferences carry forward. The same
browser tab lock still applies before choosing or loading an adventure.

Player copy should say “saved in this browser”, with one short explanation under
About saving. Online backup remains optional and off for each new adventure.
Do not describe a browser-bound anonymous backup as an account or promise that
it can recover progress after browser data is cleared. Storage being full still
prevents a durable new game; do not silently pretend an unsaved hatch is saved.

Rollback must retain the new save namespaces. A build predating this chooser
does not know how to find them, so simply serving the old bundle is not a complete
player-facing rollback. Keep a chooser-compatible patch or provide an explicit,
verified selection/import path without replacing any older save automatically.

#### Optional adult accounts: agreed product flow, not enabled in this candidate

Kevin confirmed that email accounts are optional and only for adults aged 18+.
The purpose is to bring an adventure back on another device. The proposed entry
is **Your adventures → Save across devices → I'm 18 or over → Email sign-in**.
Normal play, starting again and continuing in the same browser need no account.
An unavailable email service must leave these local actions usable.

- Offer a passwordless email link, with “Keep playing” while waiting, a clear
  expiry/retry state and a separate “Already have an account?” route.
- Verify the address before claiming the adventure is attached to an account.
  Display a masked address and “Sign out” after connection. Do not put the address
  into game saves, analytics, generated-media prompts or application logs.
- Linking a new adult identity must preserve the current anonymous owner's save
  and private creature media. Signing into an existing account must preserve the
  current browser adventure and ask which adventure to continue. Never silently
  replace it with the newest remote timestamp.
- Keep age selection neutral. Do not show the email field on an under-18 path or
  collect a full birth date. An 18+ declaration is not proof of verified age.
- Before implementation is enabled, qualify ownership transfer, multiple
  adventures, remote deletion, sign-out and reconnect. Several current Fusion
  and save functions address the `primary` slot; changing only the client slot
  would not implement accounts correctly.
- Verify the actual mail sender, redirect URLs and email template in a private
  environment. Update the privacy explanation for the new email processing, then
  test a permitted adult sign-in and a second device before public activation.
  No account service or real email has been enabled by this local UX iteration.

Provider reference: [Supabase anonymous account linking](https://supabase.com/docs/guides/auth/auth-anonymous)
and [passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless).
These document available mechanisms, not the configuration of this project.

Each phase uses its own branch and pull request. A phase may change only its
listed feature owners, focused tests, and directly required shared code. Any
unexpected cross-level or save-format change stops the phase for review.

Do not combine gameplay changes with website, growth, distribution, generated
marketing media, or experimental creature-art work.

## Phases

### 0. Baseline protection

- Keep the production deploy and source references in the baseline manifest.
- Keep the protected journey owners and focused tests explicit.
- Confirm the Forest already awakens the Guardian after the third ordered light.
- Make no runtime or save changes.

### 1. Forest clarity

- Preserve the existing terrain, collision, enemies, Rootwake, combat, and saves.
- Present one required objective at a time.
- Make each Forest light visually readable on the route.
- Keep automatic Guardian awakening as the only successful three-light outcome.
- Change no other level.

### 2. Forest payoff

- Keep the current Elder Treant combat model unless a reproduced blocker requires
  a local correction.
- Make victory reveal one rescued resident and one clear return action.
- On return, show one persistent Sanctuary consequence.

### 3. Progressive Sanctuary

- Retain all existing buildings and resources.
- Hide systems that have not been introduced instead of deleting them.
- Introduce Village Heart, gathering, first building, and rescued resident in
  that order.

### 4. Creature continuity

- Preserve DNA, save identity, rarity, and the runtime creature renderer.
- Keep portrait and video generation optional and non-blocking.
- Ensure the same creature identity is used by hatch, profile, Sanctuary,
  rescues, and authored story moments.

### 5 onward. One level per phase

Work through Crystal Caves, Stellar Reef, Void Peaks, and Aurora Depths in
separate releases. Each level must have one visible objective, one distinctive
world rule, one creature-assisted consequence, one readable Guardian route,
and one persistent return consequence.

## Proportionate Verification

For a local feature change, run its focused tests and one representative browser
journey. Add a regression test only for behavior the change introduces or a bug
it prevents. Do not run paid generation or unrelated level captures.

Run broader checks only when the change crosses a shared boundary:

- Shared input or responsive layout: core mobile tests and phone browser journey.
- Persisted state: save compatibility and reload/resume journey.
- Shared scene or campaign routing: affected level contracts plus opening route.
- Production release: full suite, production build, and protected opening smoke.

## Stop And Roll Back

Stop before merge when a change modifies an unrelated level, changes save shape
without a migration plan, makes optional media required, or cannot demonstrate
its child-readable outcome. Revert the isolated feature commit or disable its
feature flag; do not repair a narrow regression through a broad rewrite.

If production regresses, restore Netlify deploy
`6aa0ebef4a529800083091bf` while diagnosing from the failed release branch.

## Child-And-Adult Review

For each phase, ask only:

1. Can the child point to what they need to do next?
2. Can they explain what their creature did?
3. Can the adult and child both see what changed afterward?

Record confusion as evidence for the current feature. Do not convert every
observation into unrelated scope.
