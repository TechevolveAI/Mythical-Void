# Mythical Void visual media audit — 26 August 2026

## Decision

The previous gameplay social-video pack is withdrawn and must not be published. Its files were technically genuine, but that was not enough: the creature appeared as a missing-texture square, the framing made the game difficult to understand, and the selected moments had no useful beginning, event or payoff.

The new public lead is a 3.17-second landscape capture of the Mythical Forest arrival. It is labelled as an in-game story moment, not as platforming or combat footage. Platforming footage remains off the marketing pages until its art direction is good enough to represent the game.

## Human visual gate

Every public image, poster and video must now pass all of these questions:

1. Is there one immediate focal point?
2. Can a person understand the moment without an internal test name or technical explanation?
3. Is the creature or main subject visibly rendered—not a placeholder, missing texture, tiny mark or confusing silhouette?
4. Does the crop feel deliberately composed on the screen where it will appear?
5. Is important text readable and free from overlap, clipping and debug-like clutter?
6. Does a video have a beginning, a visible event and a useful end frame?
7. Is the public label exact about what is shown: gameplay, an in-game story moment, renderer proof, world artwork or imagined marketing art?
8. Would a human deliberately choose this moment to introduce the game?

A file loading, matching its fingerprint and coming from the running build does not count as visual approval.

## Reviewed media

| Asset | Decision | Reason |
| --- | --- | --- |
| Old 19.58-second Mythical Forest platforming clip | Withdraw | Missing-texture square; weak composition; unclear player action. |
| Old vertical, square and wide social-video edits | Withdraw | Enlarged the source clip’s problems and did not create a coherent story. |
| Old creator-kit archive | Withdraw | Contains the failed social-video set. |
| `project-beacon-start.png` | Keep | Clear mission, readable hierarchy and useful opening context. |
| `creature-cosmic-egg-reveal.png` | Withdraw from public promotion | Technically correct, but the creature sprite and surrounding composition are not strong enough to represent the game. Retained only as an internal build record. |
| Twelve-creature renderer display | Promote as renderer proof | A much clearer view of the system’s current range; every sprite is a renderer export and the branded layout is plainly labelled as not being a playable scene. |
| `nasa-apollo11-real-space-discovery.png` | Keep | Clear real-space question, visible NASA credit and useful science/fiction boundary. |
| `mythical-forest-arrival-wide.png` | Promote | Strong landscape composition, clear place, question and direction. |
| New 3.17-second Forest arrival video | Promote as story moment | Coherent from first frame to last and accurately labelled. |
| Realm phone captures and Village builder capture | Remove from lead galleries | Dark, cluttered, empty or difficult to understand without explanation. Retained only as internal build evidence. |
| Creature-universe illustration | Keep with label | Visually strong imagined-universe art, but never described as gameplay. |

## Rendering fault fixed

The game’s creature-animation path expected a texture object while the renderer returned a texture-name string. The code then requested a texture that did not exist, so Phaser displayed its missing-texture square. The renderer now accepts the real return shape, verifies the texture exists and uses a visible creature fallback if verification fails. The platforming scene also refuses to use Phaser’s missing texture.

## Publication rule

No future gameplay media pack moves from “captured” to “publishable” until a person has reviewed a contact sheet or timed video frames at desktop and phone sizes. Kevin remains the approval point for external channels; routine owned-site corrections may be released once this gate and the normal production checks pass.
