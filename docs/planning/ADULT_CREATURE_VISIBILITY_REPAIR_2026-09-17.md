# Adult Creature Visibility Repair

## Scope

Visibility repair on protected-main baseline `1b581612`, alongside the local
audio recovery commit `9afc89c2`. No creature redesign, DNA reroll, saved-data
migration, generated asset replacement, paid generation, or infrastructure change.

The research reproduced opaque adult discs in MV-0153 and MV-0567. Phaser 3.90
`Graphics.generateTexture` bakes through Canvas, which ignores gradient-fill
commands. Subsequent aura circles inherited the last anatomy/marking fill.
Repeated baking into an existing canvas compounded opacity. DNA bounds also
applied padding twice and cut off adult/elder anatomy.

## Changes

- Replace both unsupported creature aura gradients with explicit translucent fills.
- Paint rarity, lifecycle, elemental and affinity atmosphere before anatomy.
  Keep identifying markings, species signatures, mutations and face details.
- Pass size objects and the actual centre to effects, rather than a scalar size
  or a glow intensity masquerading as a position.
- Use the existing legacy renderer's safe margins for DNA textures, scaled for
  elders, with one centre and no double padding. Anatomy itself is not reduced.
- Reuse identical DNA/stage/genetics textures. If input changes, clear and rebuild
  the canvas in place, preserving live texture references. Explicitly pass the
  active creature's genes into its DNA renderer.
- Centre the Sanctuary's unchanged 40x60 unscaled collision body inside the new
  transparent margins. Platforming's existing visible-contact resolver is unchanged.

## Verification

`npm test`: 235 suites / 2,261 tests passed. `npm run build`: passed, including
normal production bundle checks and isolated-package checks. `git diff --check`:
passed. Build-generated distribution measurement churn is not part of this patch.

`node scripts/check-creature-textures.cjs` uses actual Phaser 3.90 Canvas baking:

- All 12 existing research profiles at baby, juvenile, adult and elder: 48 renders.
- Zero nontransparent edge pixels, nonempty opaque anatomy, unchanged serialized
  identity, exact cached pixel reuse and exact fixed-random rebuilds.
- The same 48 genes-only legacy rebuilds remain pixel-stable.
- A preceding opaque red fill no longer contaminates the low-intensity aura.
- Zero page errors or attempted outside requests.

`node scripts/check-creature-visibility-game.cjs` stages the two reproduced adult
identities in the real Sanctuary at 390x844 and 1280x720, using the regular player
renderer and normal camera. All four cases preserve adult stage, alpha 1, intended
DNA identity, centred hitbox and right/down movement. Zero page errors or outside
requests. These are isolated fixture checks, not full new-player journeys or
physical-device joystick certification.

Private output: `.visual-review/adult-visibility-repair/`. The two JSON evidence
files identify their source and fixture conditions. PNGs include all stage
comparisons and four actual Sanctuary views. Automation establishes engineering
properties, not Kevin's artistic approval. No captures are publication assets.

During harness preparation, its first run incorrectly loaded the stage resolver
as a classic script; this was corrected to a module. A subsequent assertion used
the breathing-scaled physics width rather than the unscaled collision width; it
now verifies source dimensions and centred offsets. Browser-context teardown
stalled once; the harness now closes the owned browser per viewport and has a
120-second cleanup deadline. All successful final runs close their owned resources.

## What Remains Separate

Decorative rings, elder halos and the existing cartoon anatomy still exist. Adults
are visible again, not newly art-directed. Stage-specific proportions, materials,
expressive articulated movement, competing breathing owners and a more deliberate
adulthood reveal need a separate approved design pass. The cute-versus-majestic
direction remains open. Existing generated portraits are not regenerated.

Audio fixes and their limitations are recorded in
`AUDIO_RELIABILITY_REVIEW_2026-09-17.md`. All automated browsers are launched muted,
the game stays muted, and preview servers set `BROWSER=none`. No audible listening
test or new music composition was performed.

## Release Boundary

Local review candidate only at preparation time. No push, merge or deployment is
included in this repair task. Production is not claimed to contain these changes.
