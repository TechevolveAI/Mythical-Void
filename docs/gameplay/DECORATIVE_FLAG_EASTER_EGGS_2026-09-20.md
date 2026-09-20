# Decorative Palestinian flag Easter eggs

Kevin approved small recognisable flags as Easter eggs, not a universal interface palette or a new gameplay code.

## Included

- Small fabric flag fixed to the Sanctuary ship.
- Small fabric detail under the repairer's stall canopy.
- Planted welcome flag beside the rescued residents' gathering area, shown when the existing rescue snapshot contains at least one resident.
- Small welcome flag beside the creature in the existing end-of-level rescue reveal, fading in after the neutral grey bars open.

All use black, white and green horizontal bands with a red triangle at the hoist. These are original Phaser-drawn geometry based on the user-provided flag reference, with gentle fabric movement. No generated image, new download or outside service is needed. Reduced-motion preference disables flutter.

## Explicitly unchanged

No changes to danger/safety colours, rarity, buttons, navigation markers, collision, controls, combat, reward amounts, rescue timing, save schemas or progression. No flag on an enemy or prison bar. No extra collection, prompt, quest or explanation. The flags have neither hitboxes nor click actions.

The welcome flag reads existing rescue progress; it adds no saved field. Decorations clean up on owner destruction and scene shutdown. Fabric redraw is capped at ten updates per second per visible flag.

## Review

`CHECK_DECORATIVE_FLAGS=1 node scripts/check-repairer-workshop.cjs` uses the existing muted local fixture and produces private phone/desktop screenshots under `.visual-review/decorative-flags/`. It checks initial placements, non-interactivity, welcome appearance, rescue presentation, unchanged rescue state and browser/network errors. The rescue is staged through the real presentation method; it is not evidence of a complete boss playthrough.

Unit tests cover stripe/triangle arrangement, bounded fabric deformation, reduced motion, listener cleanup and welcome-flag deduplication. Kevin should judge the size and placement from the actual screenshots. No deployment or publication is performed by the check.
