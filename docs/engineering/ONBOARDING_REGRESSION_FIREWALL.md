# Onboarding Regression Firewall

The opening journey is a protected release contract, not a collection of
independent scene flags.

## Invariants

- Journey milestones only move forward.
- Old saves are reconciled from their existing creature and tutorial facts.
- A named creature with `livingFormPending` resumes the reveal after reload.
- Portrait and video generation are optional enrichment. They never gate entry
  to the Sanctuary or player movement.
- Completing a later milestone implies every earlier milestone is complete.

## Required Gate

Run `npm run gate:onboarding` before releasing changes that affect the opening,
save state, creature media, or Netlify functions. The gate covers:

- compact unit and integration contracts;
- server dependency packaging;
- phone and landscape Start controls;
- portrait success, delayed portrait, and portrait failure;
- reload during the living-form handoff;
- story completion, controls handoff, and playable Sanctuary entry.

The GitHub check named `Onboarding regression firewall / opening-journey` must
pass before merging an affected pull request.
