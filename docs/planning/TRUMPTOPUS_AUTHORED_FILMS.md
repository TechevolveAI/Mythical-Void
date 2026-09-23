# Private authored finale films

Kevin approved non-generative animation of his supplied artwork on 2026-09-23.
This supersedes the pending production-method decision, not the human review or
release gates. No image/video model, paid generation or provider transfer is used.

## Scope

- Arrival: eight seconds, slow approach and a tightening two-handed grip opening
  the stone road. The final frame matches the start of the victory sequence.
- Victory: sixteen seconds, sequential release of the two attacking hands,
  intact non-graphic banishment, sealed rift and reconnecting stone.
- Existing ten-layer source rig, unchanged red cap/slogan, four arms. The camera
  has no visible viewer body, so the same film can serve every player identity.
- Silent review masters, 1280x720 H.264 at 24fps. No soundtrack approval implied.
- All files stay under `.visual-review`; a loopback-only harness serves private
  `/game/cinematics/` URLs to the real `PreparedFilm`/`FinaleFilms` components.
  Nothing is copied to `public`, and the production film manifest stays disabled.

The authoring timeline is pure absolute-time state. Its camera and stone movement
do not alter gameplay physics or timing. The existing pixel rig and world-source
hashes are recorded alongside every export. Unknown upstream rights remain
unknown; this work does not certify licensing or public approval.

## Repeatable Commands

Use a fresh output directory each time; scripts refuse to overwrite a report.

```sh
TRUMPTOPUS_FILM_OUTPUT=.visual-review/trumptopus-authored-films node scripts/render-trumptopus-films.cjs
TRUMPTOPUS_FILM_OUTPUT=.visual-review/trumptopus-authored-films node scripts/smoke-trumptopus-authored-films.cjs
```

`--stills` exports a storyboard without encoding. The full exporter samples 576
frames into ffmpeg without writing a large frame sequence, verifies duration,
size below the existing 8 MiB per-film limit, and absence of any audio stream.
Owned Chrome launches include `--mute-audio`; Phaser uses NoAudioSoundManager.
External requests are blocked. Browser, encoder and server cleanup runs on exit.

The playback smoke uses real arrival/result UI and actual exported films at
390x844 and 1280x720. It seeds the approach boundary or earned-result state: it
does **not** claim a new full campaign playthrough. It verifies prepared Watch,
frame progression, pause/resume, natural end, replay without a new fetch, skip,
restored route controls, unchanged rewards, and delayed/failed arrival handling.
Private harness `approved:true` means test permission, not human visual approval.

## Review Boundary

These are authored 2D cutscene candidates, not photorealistic AI video or an
approved cinematic finish. Judge the source-art joint stretches, foreground
depth, visible grip consequence, banishment readability, pacing and silent sound
gap. Engineering cannot establish that the result feels epic or age-appropriate.

The first compositing storyboard was rejected privately for including distant
objects inside foreground stone crops. It remains in the diagnostic directory;
the revised stage uses the existing stone-only source region. No new character
or topology was introduced. Do not treat either draft as marketing footage.

Human film review, sound design/review, physical phone playback and separately
authorized production integration remain open. Do not enable Watch publicly
until approved files have an exact digest/size/duration in the production
manifest and pass the existing release gate.
