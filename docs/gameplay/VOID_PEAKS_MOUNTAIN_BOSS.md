# The Peak of the Mountain

## Scope

Private gameplay candidate based on the user's supplied mountain-boss drawing.
Only Void Peaks' final approach and guardian encounter change. Earlier relays,
optional routes, saved progression, the rescued resident and Hull Plating reward
remain. No backend, migration, account, generation-service or audio changes.

## Player Journey

1. Complete the existing three warning beacons and reach the final mountain.
2. Walk right up 25 connected basalt steps cut across its body. No jump button is
   required; each rise and run is 16 world pixels. These are solid, not drop-through.
3. The shaded mountain wakes as the player reaches its upper body. Its face becomes
   clear before the summit encounter starts automatically.
4. Stand on the solid ledge beside its face. The name appears above the health bar,
   at the summit, and beside the beginning of the staircase.
5. Snowy tips flash and show the intended shot direction for 700ms. Short laser
   bursts leave the central peak and both arm-tip mountains. A paused opening
   follows each burst. Existing melee/ranged controls damage the face.
6. Phases increase the number of firing peaks without moving or scaling the
   climbable mountain. Victory preserves the mountain and existing reward flow.

## Implementation Boundaries

- `MountainBossAscent.js`: fixed geometry, bounded step-up rule and art-relative
  laser emitters. No general movement changes in the shared platformer scene.
- `VoidPeaksLevel.js`: art, ascent collision processing, summit staging and boss
  attack presentation. Arcade body history is synchronized at the staged entry.
- One 1064 x 1000 alpha WebP (238,416 bytes), loaded only with Void Peaks. No live
  generation is required. Existing texture key `cosmicTitan` and save/achievement
  ID `cosmic_titan` remain compatibility identifiers, not the new display name.
- Invisible step colliders are removed from the display list and explicitly
  destroyed on shutdown. Stone decoration is one batched graphics object.
- Boss timers, beams and overlap handlers share encounter-owned cleanup.

## Verification

Run the focused `MountainBossAscent`, `GuardianPacingContract`,
`LateBossPacingContract`, `FourthExpeditionRescueLoop` and
`LevelTraversalQualityContract` Jest tests; then the full Jest suite and Vite build.

`node scripts/check-mountain-boss.cjs` starts its own local production preview,
launches muted headless Chrome, and closes both afterward. It stages a saved
creature and the completed relays at the final approach, then uses actual movement
and physics to climb without jumping. It checks summit contact, incoming laser
damage, an ordinary ranged hit and cleanup at 390x844 and 1280x720. It does not
claim a complete level playthrough, real-device iOS coverage or visual approval.

Private evidence: `.visual-review/mountain-boss/`. Production is not updated by
this script. Review the drawing-to-game result before any release.
