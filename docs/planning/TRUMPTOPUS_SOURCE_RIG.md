# Trumptopus supplied-image rig

Private implementation slice, 2026-09-22. Not integrated into production or the
three-phase encounter. No new character generation or paid video calls.

## Implemented

- Kevin's original PNG preserved byte-for-byte; source and extraction hashes recorded.
- Foreground separated locally with Apple's Vision framework, not a new image generation.
- Ten cutouts: body/head/cap, lower body, two rear arms, two upper arms,
  two forearms and two hands. All use the supplied character's material.
- Rest, load, extending reach, physical claw contact and recovery.
- Fixed elbow overlap, attached wrists, lower-body deformation and visible-foot grounding.
- The same Phaser-native sprite/CanvasTexture renderer in WebGL and Canvas.
- No saves, game boot, production registration or outside services in the art proof.
- Shared first-person film prompts drafted without visible player anatomy.
  Arrival is one proposed film; banishment and recovery are two shots for the other.
  Both Watch assets remain absent and unapproved; no spending is authorized here.

## Verification

```sh
node --test scripts/__tests__/TrumptopusCutoutRig.test.mjs
TRUMPTOPUS_CUTOUT_PROOF=trumptopus-source-rig-review node scripts/smoke-trumptopus-cutout.cjs
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

Final exact-source evidence: `.visual-review/trumptopus-source-rig-review/`.
Earlier attempts are separate diagnostics, including the rejected colour-key
matte and intermediate joint/framing captures. Do not treat them as final art.

## Next Integration Gate

Compare all four hands and the small trailing tendrils with the original. Assess
whether the elongated forearm and travelling lower-body bend feel like living
tissue rather than stretched paper. Refine source-pixel overlap where needed;
do not invent a new character. Then pack the atlas, place it at ordinary arena
scale, and match visible contact to the existing collision geometry. The current
study does not yet supply all three combat attack poses or authored banishment.

No full-suite or production-build claim is made for this isolated art-only slice.
The existing finale mechanics and their exact-source proof remain unchanged.
No push, merge, deployment or publication is authorized by this document.
