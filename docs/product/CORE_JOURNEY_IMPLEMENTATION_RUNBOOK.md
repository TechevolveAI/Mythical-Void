# Mythical Void Core Journey Implementation Runbook

## Purpose

Improve the game one understandable player journey at a time without replacing
working systems. The production gameplay represented by
`core-journey-baseline-2026-09-09.json` is the rollback boundary.

## Release Shape

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
