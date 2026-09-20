# Void Peaks: the mountain you climb

Status: private implementation; visual approval and production release pending.
Baseline: e558954d25f7832fd8143f8d80356bd7ed3d1d67.

## Player promise

Climb a living, cosmic mountain. Learn to move out of an aimed shot, jump a low
wave, then use both skills beside its face. Defeating **The Peak of the Mountain**
calms it and immediately secures the existing Hull Plating and inventory reward.
Target: ages 9-12, readable without a parent interpreting a screen of instructions.

## Visual and interaction contract

- One rising main route, with foothills, fractured shoulders and a summit staircase.
  Missed jumps land on reachable lower stone, not a long empty void.
- Walkable edges share a pale mineral lip; their visible tops match collision tops.
  Stone extends down into the mountain. No green outlines that imply false safety.
- Existing cosmic boss art, name and silhouette stay. Keep actor and face readable
  above phone controls; warning geometry must show where damage will happen.
- One short objective: reach the summit. The three existing lights sit on the route
  and activate by landing; they remain checkpoints, not a separate scavenger hunt.
- Aim, low wave, alternating attack. First cycle teaches a fixed order; later
  phases combine skills. Never damage during warning or overlap phase transitions.
- Final hit records progress before animation. The result highlights what the
  reward does, with one obvious continuation. No timed text that blocks the exit.

## Bounded phases

1. Separate saved victory from optional presentation; prove interruption and
   repeated defeat callbacks cannot lose or duplicate rewards.
2. Author route geometry in a small data module. Reuse progression/support IDs;
   reproject old saved checkpoints onto their named supports in memory.
3. Implement distinguishable attacks and coherent mineral terrain treatment.
   Keep the shared movement engine and existing staircase collision correction.
4. Simplify guidance and the reward handoff, then verify phone and desktop play.

## Compatibility and review gates

No new economy, save schema, backend, hosted media generation, creature renderer, other
level redesign or marketing publication. Keep the optional guard/free-blast tradeoff,
five fragments, rare egg, rescued resident and final-level unlock.

Focused executable tests cover route reachability, checkpoint reprojection,
attack timing/geometry, immediate completion and cleanup. Full Jest and production
build guard shared contracts. Muted real-browser evidence distinguishes ordinary
traversal from staged boss tests; no physical-device or human-art approval is
inferred from emulation. All owned browsers and servers close after verification.

Stop before production for a concise review of the exact changes and evidence.

## Implemented candidate

- The main route gains 1,250 world pixels before the existing 400-pixel summit
  staircase. Solid lower terraces catch missed jumps; two short updrafts reconnect
  the lower shelves. The high ridge needs an intentional intermediate landing,
  including with the longer existing held-key jump. It still gives one shield;
  the direct route still gives one free blast.
- Landing anywhere on each checkpoint's named shelf advances the climb. Old
  checkpoint IDs are unchanged. Restoring an old position first synchronizes the
  physics body, then measures clearance and places the creature on the current
  shelf. This changes the live position, not the saved schema or identity.
- The boss teaches an aimed burst, a jumpable low wave and alternating arm shots.
  Later phases combine them. Warnings derive from the same shot plan as attacks.
  Recovery clears damage effects, and cleanup is idempotent for expired callbacks.
- The final hit saves completion, Hull Plating and rewards before any animation.
  One result panel explains the actual inventory power-up. Continue leads through
  the first resident welcome to the hub; repeated continuation cannot skip it.
- Phone camera bounds keep the foothills above controls and retain the face during
  combat. Completed route signs and distant reply lines no longer compete with
  the fight. The reward button has at least 44px of height.
- One shared 512px mineral texture (95,932 bytes) gives the climb rock depth.
  Static shading is batched. Its source and AI-assistance record are in
  `docs/art/PEAKS_METEOR_BASALT_V1.md`; it adds no runtime generation request.

## Repeatable verification

1. `npm test` and `npm run build` (the complete existing production build chain).
2. `MOUNTAIN_ASCENT_JOURNEY=1 MOUNTAIN_EVIDENCE_DIR=.visual-review/void-peaks-review/main node scripts/check-mountain-boss.cjs`.
3. Repeat with `MOUNTAIN_ASCENT_ROUTE=optional` and an `optional` output directory.
4. `COMPLETION_EVIDENCE_DIR=.visual-review/void-peaks-review/shared-completion node scripts/run-completion-flow.cjs`.
5. `git diff --check`.

The mountain runner uses real keyboard and touch controls on 390x844 and
1280x720. It asserts the existing mobile 165-item / 10-tween ambient budgets,
the full route, earned route benefit, old-coordinate restart, grounded summit,
real laser damage, a real jump avoiding the low wave, recovery cleanup, immediate
victory persistence, result bounds, resident continuation and hub return. Console
errors and attempted external services fail the check. All browsers are muted
and owned browsers/servers close on success, failure or interruption.

Exact commit, clean/dirty source state and results live in each private output's
`result.json`; images show real runtime play, not generated gameplay. The route
check explicitly retires patrols to isolate input/collision reachability. The boss
check is staged, and the final hit is injected after a real ranged hit. These are
not a claim of a complete combat playthrough, physical iOS/Android certification,
human difficulty approval or approval of the existing creature art.

Next human review: judge pacing with patrols present, the shield/blast tradeoff,
reaction time on a real phone and the final mountain art. No other realm, backend,
save migration, public website or production deployment is part of this candidate.
