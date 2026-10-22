# Guardian Transition Pause Repair

Date: 20/10/2026. Status: private implementation, not a release or migration
acceptance. This extends the approved playable-journey and mobile robustness
packages without changing the encounter design.

## Reproduced Failures

At parent `edbe30e234fd91a89e01355d83fad9858aec9e05`, the shared Guardian
handoff races a Phaser scene timer against an elapsed-time fallback. The
fallback treated every inactive scene as retired, including a temporarily
paused or sleeping scene. It marked the transition settled and cancelled the
remaining timer. Resuming the scene could therefore leave an arrival or
aftermath without its continuation.

The real `PreparedFilmPlayer` pauses its host scene while its dialog is open.
The new regression closes its actual Continue button after the fallback has
expired: the scene resumed but the pending Guardian callback never ran.
Separately, the physics-only pause menu leaves the scene active, so a due
callback could run behind it. A paused Phaser clock had the same problem.

The corrected regression fixture retained the module's supporting functions,
not only its class body. Against the unchanged runtime, six tests failed and
11 controls passed before this repair. These are offline reproductions, not
observations from a real phone.

## Behaviour

- A due transition waits while its original scene is paused or sleeping,
  while the pause menu is open, or while its original clock is paused.
- Resume, wake or the next scene post-update can deliver it once. There is
  no polling interval or additional background timer.
- Ordinary scene-time completion and the elapsed fallback retain their
  previous delays and once-only behaviour.
- Physics pause alone does not block a handoff: boss introductions and
  already-saved aftermath intentionally pause physics while presenting.
- The original scene systems, clock, events and transition map must still
  own the callback. A replacement cannot inherit stale work.
- Completion, cancellation, shutdown and destruction release both timers
  and all owned listeners. A callback can safely schedule a successor under
  the same key.
- Mountain entrance retirement uses that same cancellation operation, so
  cancelling a paused entrance does not retain a resume listener.
- Required callback exceptions remain visible after cleanup. They are not
  converted into a fabricated successful encounter.

## Verification

`GuardianTransitionLifecycle.test.js` executes the installed Phaser Systems
pause/sleep/resume/wake methods and Clock without creating a Phaser Game,
renderer, browser or audio context. It also uses the actual DOM film player
with an assetless film: no preparation, decoding, playback or request occurs.

`MountainEntranceLifecycle.test.js` additionally exercises the existing native
physics, camera pan, tween and attack flow after a long scene pause, and verifies
that retiring the paused entrance releases its listeners without another frame.

The focused run passed eight suites and 226 tests, covering these cases plus
Guardian pacing, Mountain combat, film escape, mobile input, checkpoint input
recovery and Reef controls. Broader exact-source qualification is recorded
separately rather than inferred from the focused run.

## Boundaries

No save format, ID, reward, inventory, Fusion, media record, prompt, provider,
cloud adapter, hosting or production setting changes. Level geometry, artwork,
boss health, attack patterns and difficulty are unchanged. No provider call,
real player record or paid generation is used.

Physical iOS/Android playback and pause behaviour, rendered presentation and
human judgements of fun remain unverified. This repair does not establish a
complete campaign playthrough, native Google migration readiness or release
approval. Normal protected review and separately authorised testing still apply.
