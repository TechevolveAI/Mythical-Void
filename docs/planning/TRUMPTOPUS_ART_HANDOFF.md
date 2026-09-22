# Trumptopus: authored asset handoff

Private production brief, 2026-09-21. No asset or public release approval is implied.

## Required identity

Use Kevin's supplied character reference: the pale swept hair, red cap, formal vest, metallic-organic arms and grounded lower tendrils. The cap retains exactly "Make the Void great again". Do not mirror its lettering. Canonical name is Trumptopus. He is the antagonist, banished non-graphically, never recruited.

Approve one consistent anatomy drawing before animation. The master reference has four arms; retain those, with two active attacking arms and two supporting arms, rather than accidentally simplifying him into a two-armed figure. The supplied scenes vary in anatomy and eye colour; do not combine them into a different character. Keep a readable cap, active hand and reachable joint in the same phone frame. This is an authored game character, not a complete rectangular concept image moving around the screen.

## Delivery

Deliver a cleaned, transparent layered master plus PNG layers and an atlas manifest. Keep the original working file and provenance outside public asset directories until reviewed. No paid tool, provider transfer or new rights acceptance is authorized by this brief.

The initial rig needs these pieces and contact/recoil pose frames:

| Layer | Role | Attachment requirement |
| --- | --- | --- |
| Torso/head/cap | Recognisable identity, breathing/strain | Fixed cap text; shoulder and hip pivots recorded |
| Lower contact body | Weight, planted grip and release | Overlap beneath vest; three readable contact zones |
| Left upper arm | Raised warning and loading | Shoulder/elbow pivots and covered seam |
| Right upper arm | Second committed grasp | Independent drawing, not mirrored lettering/art |
| Left forearm/open hand | Reach and low sweep | Elbow/wrist pivots; continuous overlap |
| Right forearm/open hand | Two-sided grasp | Same scale and material as torso |
| Left rear support arm | Holds surrounding stone, releases under strain | Continuous shoulder attachment behind torso |
| Right rear support arm | Carries weight, visibly lets go at defeat | Distinct from the two active attacking arms |
| Planted hand | Impact and compression | Visible contact edge matches gameplay footprint |
| Exposed/recoiling joint | Vulnerability and hit response | Same anatomy, not an unrelated glowing symbol |

Use pixels in the source master for pivot coordinates and normalized UV rectangles in the packed atlas. Record each frame's untrimmed dimensions, trim offset, pivot, attachment points and contact polygon. Transparent margins must not change collision geometry or contact height. Joint overlap must remain covered through the full warning, plant and recoil motion.

Start with at most one 2048 x 2048 RGBA atlas, 16 MiB decoded before browser copies/mipmaps, and measure rather than assume compressed size. The broader provisional final-level ceiling remains 3 MiB compressed art and 32 MiB additional resident textures. Load after entering the final chapter, not the initial egg. Keep Canvas-compatible sprites as the baseline; mesh effects must not own essential cues.

## Pose review

Show neutral, open-hand warning, committed strike, compression, exposed joint, recoil, two-handed strain and complete banishment. At 390px phone width and ordinary desktop scale, verify continuous joints, stable contact, visible hit response and distinct warning versus safe recovery. The actual player creature and astronaut must remain readable. The current greybox limb is only a geometry/timing reference, not approved art direction.

## Rights and provenance

For every source record author/supplier, original filename and digest, creation tool/model if known, AI assistance, source references, usage rights/license, cleanup artist, date and exact reviewed output digest. Unknown rights remain unknown until Kevin supplies or approves them; possession of a file is not a complete rights record. No imitation of a real person's voice is part of this task.

## Supplied-image implementation, 2026-09-22

Kevin confirmed that the existing full-body image is the source to use, without
requesting another character generation or requiring him to supply layers.
`src/dev/TrumptopusCutoutRig.js` now prepares ten cutouts and articulates the
existing pixels in a private Phaser study. The cap and lettering are not redrawn
or mirrored. Local Apple Vision foreground separation provides alpha; no new
image-model call or alternate generation provider was used. Provenance and
original/foreground hashes are in `src/dev/assets/trumptopus/provenance.json`.

The supported poses are rest, load, extending reach, claw contact and recovery.
Elbow overlap is held at its source size while distal tissue extends; a separate
deformation travels through the lower body. Canvas uses the same sprite and
texture path as WebGL. This is a source-art study, not combat integration or a
claim that hidden anatomy has been reconstructed. Thin trailing tendrils and
joint edges still need comparison against the original at human review.

Earlier proof attempts remain in separate private folders. Colour-key cleanup
was rejected because it removed blue-lit skin. The native Swift entry point
could not compile against this Mac's SDK; the working preparation tool is the
small Objective-C program in `scripts/cinematics/extract-trumptopus-source.m`.

The original PNG is 5,062,822 bytes; the foreground PNG is 3,136,743 bytes.
These are private source assets, not a release atlas. Export, packing, normal
gameplay scale and the final-level asset budget remain integration gates.

## Earlier generation attempt

One built-in image-generation attempt using the supplied master reference was rejected at input with `moderation_blocked`, category `public-figure`, request `53fe0278-eb0e-4b71-b9dc-c0074d254195`. It produced no asset. No retry, disguised reference, alternate generation provider or silent cap/slogan change was made. The subsequent work uses the image Kevin already supplied, not a newly generated substitute. Video generation remains separately subject to provider/content review and a spending limit; no generation is implied by passing mechanics or media-player tests.
