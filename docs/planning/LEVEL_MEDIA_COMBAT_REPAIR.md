# Level media and combat repair

Private candidate based on production 39b5274f. No deployment is implied.

## Confirmed faults

- Generated-video delivery selects the newest unwatched film globally, not the current realm. The Phaser notice has no dismissal or expiry and inherits the world camera transform. Watch in Sanctuary opens an archive instead of the film. Playback is forcibly cut off after 4.6 seconds.
- A later still appearance overwrites a generated-video viewing receipt, making a watched film eligible again.
- Route activation requires index === completed count. Later objectives are deliberately faded. Checkpoint restoration assumes all earlier objectives were completed, which must change alongside unordered activation.
- The mountain fight reuses the 650px terrain sprite behind solid staircase artwork. It can take uncapped damage before combat starts. Its short recovery bonus is not a vulnerability rule.
- Forest has four implemented attacks, but repeated recovery hits can remove almost all 18 health in one window.

## Implementation boundary

1. Small viewport-anchored, dismissible, expiring video notices. Watch opens the exact available film; close always restores only the pause it owns. Watched receipts are monotonic. Level labels and delivery are scoped; unsupported realm arrival films are not advertised as available. No new generation, provider, personal-data or spend policy.
2. Any incomplete route objective can be activated. All are visible: gold before activation, mint after, retaining each biome's shape. Save exact completed bits in `routeSignalMask` on checkpoint version 2, accepting old sequential version-1 checkpoints. No global save migration. Older released clients reject version 2 instead of incorrectly granting every earlier objective; a rollback starts that expedition from its entrance while preserving campaign, inventory and creature data.
3. Keep mountain ascent terrain intact. Animate the existing boss artwork breaking free into a separately grounded combat entity. Snow burst, lobbed snow grenade and rolling snowball attacks have warnings, locked aim, recovery and bounded damage per opening. Keep name, reward and progression IDs.
4. Forest uses its existing attacks and art with a longer, bounded exchange cadence. No new topology or Rootwake work.

## Gates

- Focused behavioral tests: watched -> still -> reload, wrong-realm exclusion, duplicate and failed Watch, close during loading, scene shutdown, all six objective orders and save/restore, pre-fight immunity, bounded recovery damage and hazard retirement.
- Silent built-game phone and desktop browser checks: notice dismissal and exact film playback, mountain separation/movement/hazards, Forest attack cycle and no browser errors. Use local media fixtures, never paid generation.
- Full Jest and production Vite build. Human playtesting still decides challenge, readability and appeal. Browser emulation is not an iPhone/Samsung hardware test.

## Film coverage and limitations

| Journey | Current authored capability |
| --- | --- |
| Mythical Forest arrival | Personalised generated arrival film, prepared through the existing portrait/media flow. |
| Crystal Caves, Stellar Reef, Void Peaks, Aurora Depths arrival | No personalised arrival moment is implemented. Do not offer a Forest arrival film here. |
| Guardian rescue in each realm | A generated rescue moment is requested after the rescue. This patch supplies explicit realm setting in the bounded server-authored prompt and identifies the realm in the notice. |
| Sanctuary | Unwatched films from any realm can be offered with their own realm labels. |
| Final Void Trumptopus | Existing prepared shared arrival and ending films remain separate and unchanged. |

The existing two-generation daily limit, provider configuration and network availability still apply. This patch does not spend credits, regenerate cached films, or prove production provider health. Films dismissed or expired remain available in the existing archive; the small notice is offered only once per session. A genuinely played film stays recorded as played even after a later still appearance. Viewing history already overwritten by an older release cannot be reconstructed, so an affected old film could be offered once more.

## Human acceptance before release

- On the actual iPhone and Samsung, reach the summit, see the mountain pull free, read its name/bar, dodge each snow pattern and land attacks during the quiet opening. Judge fairness, fun and arena room, not only whether victory is possible.
- Repeat Forest with roots 3, 1, 2; reload after each. Only helped places should remain complete. Complete the Elder battle through both attack phases.
- Watch a real available realm film, close it during playback and resume immediately. Revisit the realm after a still appearance: no repeat offer for the watched film. Check the close button and auto-expiry during play.
- The silent browser fixture positions actors and heals between combat windows. Its successful normal-input victory validates damage, timers and reward saving; it does not certify difficulty or uninterrupted traversal.
