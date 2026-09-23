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

## Exact Review Candidate

Source: `7dc6e48d3558ee909a54a201278bdd46e32fd8bc`, clean during export, playback
proof, focused verification and the normal production Vite build.

- [Arrival, 8s, silent](../../.visual-review/trumptopus-authored-films-review/arrival.mp4)
  (1,404,253 bytes; SHA-256 `620577b821d99ee3e16fca4a68ab580e2de7e218258264d43abd7b10ead39ad7`).
- [Victory, 16s, silent](../../.visual-review/trumptopus-authored-films-review/victory.mp4)
  (1,430,900 bytes; SHA-256 `65a4233ff1c074bcc2f0cec52ad6cddb2151068ca4068237f8c94baa2d909514`).
- Complete [arrival sheet](../../.visual-review/trumptopus-authored-films-review/arrival-sheet.png)
  and [victory sheet](../../.visual-review/trumptopus-authored-films-review/victory-sheet.png),
  six and eight sampled frames respectively, with no empty sheet cells.
- [Phone Watch](../../.visual-review/trumptopus-authored-films-review/playback/phone-arrival-playing.png)
  and [desktop Watch](../../.visual-review/trumptopus-authored-films-review/playback/desktop-victory-playing.png).
- [Export report](../../.visual-review/trumptopus-authored-films-review/report.json),
  [six playback journeys](../../.visual-review/trumptopus-authored-films-review/playback/report.json)
  and [41-artifact digest manifest](../../.visual-review/trumptopus-authored-films-review/source-evidence.json).

Verification: 18 Node tests and 43 Jest tests in four suites pass. The six browser
journeys pass with zero console/page errors and outside requests. Watch, replay,
skip, pause/resume, actual natural-end playback and failure/delay recovery use
these exact films, not the old Forest fixture. Rewards and result status do not
change on playback. The normal Vite build passes; it excludes the private film
stage/files, and the production film manifest remains disabled. Existing large
chunk and browser-data age warnings remain. This is not a full release pipeline,
new earned boss playthrough, mobile-device test or human approval.

All owned browser, server and encoding processes closed. MP4 probes confirm one
video stream each and no audio. No generation credits were consumed.

Own visual assessment: the supplied identity remains recognizable and the two
hands release in sequence, but the foreground still reads as a relatively flat
composite, some source-art limb stretching is visible, and world recovery is
restrained. The phone player preserves the whole landscape frame, so portrait
view has substantial letterboxing. These are honest review drafts, not yet an
"epic finale" art approval. Do not iterate indefinitely without Kevin's response.
