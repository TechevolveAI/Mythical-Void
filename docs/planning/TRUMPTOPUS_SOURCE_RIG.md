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
- The supplied landscape now supplies private arena materials. The boss stands
  on a raised rear dais rather than sharing the player's ground lane. The
  astronaut visibly leaps over the sweep and grounds on the same floor line.
- The winning hit now pulls the intact boss into a closing Void tear and changes
  the floor edge as his hold releases. This is real Phaser presentation, not a
  generated film. The tear and remaining greybox obstacles still need art review.
- No saves, game boot, production registration or outside services in the art proof.
- Shared first-person film prompts drafted without visible player anatomy.
  Arrival is one proposed film; banishment and recovery are two shots for the other.
  Both Watch assets remain absent and unapproved; no spending is authorized here.

## Verification

```sh
node --test scripts/__tests__/TrumptopusCutoutRig.test.mjs
node --test scripts/__tests__/TrumptopusLimbWarp.test.mjs
node --test scripts/__tests__/TrumptopusPresentation.test.mjs
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
The supplied scene crops now establish the private arena, and an authored
banishment is present. Finished scenery, atlas export/budget and human
difficulty/presentation approval remain open. The `df3275be` spacing proof
showed clear contact moments but overlapping actor bounds during movement.
That source remains a failed spacing gate, not a visual approval. The desktop
forearms also read as stretched material, and the Void tear is still too
geometric beside the supplied art. Do not label this finished artwork.

The current staging proof is recorded separately under
`.visual-review/trumptopus-arena-review/`; its manifest binds exact source,
focused tests, build and recorded journeys. The earlier two diagnostic runs
remain private: the first exposed a retry-readiness race in the test harness,
the second completed both viewports and exposed the movement-spacing fault.

## Movement-spacing correction

The private ally now anticipates the player's position 350ms ahead, retreats
promptly on the same flank, and rises before moving across to the other flank.
It can start the sweep dodge early when the creature approaches and adjusts
its landing while airborne. The sweep vault is above the player's ordinary
jump while its peak stays below the HUD. The private adapter caps the cosmetic
katana lunge at the creature/screen clearance boundary; it preserves the slash,
attack timing and damage. This changes only private ally staging, not player
movement, saves, or the shared astronaut implementation.

The proof now includes sprite rotation/scale/flip in conservative alpha-bound
envelopes and fails below 24px anywhere in the recorded fight, not only at
selected screenshots. It also rejects either actor leaving the canvas. This
is still one scripted input journey, not proof of every possible player input
or human approval of the motion. Exact-source results are kept separately in
`.visual-review/trumptopus-spacing-verified/`. The earlier
`trumptopus-spacing-review` is a failed exact-source gate at `89d6790a`, not a
passing proof. Iterative diagnostics retained the 24px threshold and exposed
the delayed sweep dodge, crowded landing and uncapped sword-lunge faults.
The intermediate `64f936fb` proof passed phone at 26.55px but failed desktop at
23.38px during descent. The final sideways vault timing addresses that case;
the threshold remains 24px. That earlier folder remains a failed source gate.

Exact test/build results live in the evidence report, not an implied release gate.
The encounter state machine, prior reward/ending implementation and historical
exact-source proofs remain unchanged. No real Trumptopus film exists yet.
No push, merge, deployment or publication is authorized by this document.

## Bounded limb-articulation pass, 2026-09-22

The long attack originally stretched the forearm over a near-straight span with
short fixed end tangents. This private pass increases curvature with extension,
tapers the middle while preserving both joint widths, and moves a stored bend
from the elbow towards the claw during the strike. Recoil sends a smaller bend
back. Strip orientation follows the deformed centreline so stronger bends do
not use the old straight texture orientation. Rest art and the cap are unchanged.

The committed claw, contact box, vulnerable window, timing, damage and other
fight rules are unchanged. Only the source-art forearm deformation is affected;
there are no generated assets, saves, provider requests or production registration.
Tests cover endpoints, tangents, deterministic bounded motion and state-boundary
continuity. These establish geometry, not a convincing tentacle or final art.
Source-bound browser evidence and the visual conclusion are recorded separately
under `.visual-review/trumptopus-limb-articulation-verified/`; existence of this
section does not imply that capture or human review passed.

The first browser attempt at `a79c7e8e` completed phone and the desktop fight,
but desktop screenshot round-trips missed the final banishment frame. It remains
failed evidence in `trumptopus-limb-articulation-review`. The proof now records
those four instants directly at Phaser postrender, without pausing or extending
the animation. These PNGs are gameplay-canvas size, excluding the private 42px
toolbar. A skipped interval still fails; later frames cannot substitute for it.

## Source-stone arena props, 2026-09-22

The remaining flat grey exit obstruction and rising foothold now use a small
atlas derived from the same character-free foreground as the arena floor.
Their artwork reads actual body position and dimensions after the parent
updates physics. The solid floor renders in front of buried sections, so the
foothold emerges from the ground and the exit stone disappears into it. Collision
activation, lift timing and clearance rules are unchanged. No new art is generated.

The prop atlas adds 26,880 raw RGBA bytes. The stage now owns four textures
(sky, floor, dais, props), explicitly checked through retry and teardown. It
retains the existing 4 MiB scenery limit rather than increasing it. Unit checks
cover burial, lift, settlement, exit retraction and cleanup; the private fight
proof samples rendered-object and collision bounds throughout both movements.

Evidence belongs to `.visual-review/trumptopus-arena-props-verified/`. This bounded
pass repeats the arena and ending, not the unchanged approach. The previous
full route/fight proof at `fdc87a8b` remains separate. Textured rectangular props
are not human-approved terrain art, and the stretched limbs, geometric Void
tear, missing Watch films and physical-device review remain open.

The first `f82db65a` proof passed both journeys but the small phone props were
too dark against the painted backdrop. It remains diagnostic evidence under
`trumptopus-arena-props-review`. The revised prop-only material uses directional
face lighting and a pale top edge, preserving underlying source pixels and
the same body bounds. Floor and approach materials keep their previous treatment.

## Source-textured banishment opening, 2026-09-22

The private banishment replaces its repeated twenty-point luminous outline with
an asymmetric split, textured from a character-free crop of the supplied
landscape. A baked inner shadow and unlit recess replace the closed bright
stroke. The texture is created once, then follows the existing opening curve;
the boss's pull, rotation, disappearance, timing and reward sequence do not
change. This is authored runtime scenery, not a generated video or Watch asset.

The stage owns the extra 192 x 320 texture (245,760 RGBA bytes), keeping the
same 4 MiB scenery ceiling. Retry and shutdown now account for five stage
textures. Banishment frames record actual tear visibility; the opening must be
visible during the four captured instants and absent at the result. Geometry,
crop boundaries, texture size and late teardown calls have focused tests.

Exact-source evidence is separate under `.visual-review/trumptopus-tear-review/`.
This paragraph does not pre-approve its visual result. The long-arm staging
decision, physical-device review, final films and human approval remain open.
