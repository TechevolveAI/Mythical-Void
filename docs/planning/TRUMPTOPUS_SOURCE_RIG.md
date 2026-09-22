# Trumptopus supplied-image rig

Private implementation slice, 2026-09-22. The supplied-image rig now also has a
private three-phase encounter adapter. Not integrated into production.
No new character generation or paid video calls.

## Implemented

- Kevin's original PNG preserved byte-for-byte; source and extraction hashes recorded.
- Foreground separated locally with Apple's Vision framework, not a new image generation.
- Ten cutouts: body/head/cap, lower body, two rear arms, two upper arms,
  two forearms and two hands. All use the supplied character's material.
- Rest, load, extending reach, physical claw contact and recovery.
- Fixed elbow overlap, attached wrists, lower-body deformation and visible-foot grounding.
- The same Phaser-native sprite/CanvasTexture renderer in WebGL and Canvas.
- Curved textured forearms follow the encounter's committed hand locations.
  Both active hands participate in the final two-sided grasp; no mirrored art.
- Private fight/campaign adapters use the existing attack timing, collision,
  input, checkpoints and rewards. They do not register a production scene.
- No saves, game boot, production registration or outside services in the art proof.
- Shared first-person film prompts drafted without visible player anatomy.
  Arrival is one proposed film; banishment and recovery are two shots for the other.
  Both Watch assets remain absent and unapproved; no spending is authorized here.

## Verification

```sh
node --test scripts/__tests__/TrumptopusCutoutRig.test.mjs
node --test scripts/__tests__/TrumptopusLimbWarp.test.mjs
TRUMPTOPUS_CUTOUT_PROOF=trumptopus-source-rig-review node scripts/smoke-trumptopus-cutout.cjs
TRUMPTOPUS_ART_PROOF=1 TRUMPTOPUS_RENDERER=webgl TRUMPTOPUS_PROOF_NAME=trumptopus-art-fight-review node scripts/smoke-trumptopus-finale.cjs
node scripts/validate-final-void-films.cjs
```

The isolated proof dependencies live under `.visual-review/trumptopus-rig-runtime`:
Phaser 3.90.0 and Playwright 1.62.1. They were installed without package scripts
or lockfile changes. The proof refuses to overwrite an existing report and
closes its muted headless browser and local server in cleanup.

The browser checks transparent cutout corners, nonempty layers, finite joints,
unclipped anatomy, visible floor contact, zero browser errors, no outside
requests, no storage writes and silent recordings. These are engineering checks,
not adult visual approval. The study is isolated and enlarged for artwork review;
it is not normal-scale gameplay evidence with the astronaut and player creature.

Earlier exact-source evidence: `.visual-review/trumptopus-source-rig-review/`
belongs to `83619196`; it is not evidence for the subsequent combat integration.
New exact-source evidence is recorded in `.visual-review/trumptopus-art-fight-review/`.
Earlier attempts are separate diagnostics, including the rejected colour-key
matte and intermediate joint/framing captures. Do not treat them as final art.

## Next Integration Gate

Compare all four hands and the small trailing tendrils with the original. Assess
whether the curved forearms and travelling lower-body bend feel like living
tissue rather than stretched paper. Refine source-pixel overlap where needed;
do not invent a new character. The private arena adapter now supplies all three
attack poses and aligns visible hand bounds with the existing collision geometry.
This is still a plain mechanics arena. Finished scenery, atlas export/budget,
authored banishment and human difficulty/presentation approval remain open.

Exact test/build results live in the evidence report, not an implied release gate.
The encounter state machine, prior reward/ending implementation and historical
exact-source proofs remain unchanged. No real Trumptopus film exists yet.
No push, merge, deployment or publication is authorized by this document.
