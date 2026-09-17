# Audio Reliability And Direction

Baseline inspected: production `1b581612a7c45d408d46c554d9312b3affa0727f`.
This branch is a local repair candidate, not a deployed audio update.

## What Happened To The Intro

The music was not deleted. Production serves both existing files successfully:
`/audio/theme-music.mp3` (5,695,783 bytes) and
`/audio/theme-music.ogg` (3,679,592 bytes), with appropriate audio content types.
Both local files decode successfully without playback. MP3 sample analysis
reports mean level -14.6 dB and peak -0.7 dB; this confirms audible content, not
perceived loudness or mix quality in the game.

In `HatchingScene.loadThemeMusicInBackground`, the full soundtrack downloads
after the home screen becomes usable. The old load-complete callback rejects
the result once `isStartingGame` is true. `handleStartGame` also stops any music
already playing. A quick player can therefore leave before hearing a note.
This is a reproduced logic defect, not evidence that Kevin's particular device
had a network, billing or provider problem. Returning saved games also bypass
the home screen by design; they are not supposed to replay the opening theme.

The root checkout contains a separate uncommitted change making audio muted by
default. That is not in the inspected production release, and it was not copied
or reverted by this task. Local and live behavior must not be conflated.

## Bounded Repairs

- Keep the existing theme through the first egg opening; fade it at the hatch
  celebration. Loading remains optional and does not delay the Start button.
- Use explicit intro ownership instead of the Start-button flag, so a late load
  cannot resurrect music after the reveal or a scene shutdown.
- Connect the recorded theme to the existing saved mute/master/music controls.
  Unmuting after loading can now start it; no preference is silently reset.
- Dispose paused/queued theme sounds synchronously on shutdown. Do not leave
  cleanup waiting on a tween belonging to a stopped scene.
- An outgoing procedural music fade disposes its own audio nodes, not whichever
  track is current 1.1 seconds later.
- Remember the current area's music request while muted, but clear it on exit.
- Suspend the procedural audio context when hidden, reject background sound
  requests and contain failed/interrupted mobile resume promises. Returning to
  the page rearms gesture recovery rather than forcing unsolicited sound.

No new music, creature voice, model call, data schema or backend change.
Automation remains muted and does not use the in-game Sound control.

## What Is Not Yet A Finished Audio Experience

1. **Opening weight.** The existing track is 284.72 seconds, stereo at 44.1 kHz.
   Float PCM alone is about 95.8 MiB, or 104.3 MiB when resampled to 48 kHz.
   This is an estimate, not a measured browser heap. Prepare a human-approved
   15-25 second opening edit, then defer any longer theme. Aim below 500 KiB
   transfer and 10 MiB decoded audio for the opening cue.
2. **Level identity.** Area music is wired to Sanctuary, gathering and fusion;
   the platforming levels do not yet have a comparable continuous score.
   Give each realm a restrained ambience and a related short musical motif,
   not another large song on every level load. Forest could breathe and pulse;
   caves could resonate through stone; Reef could carry slow tidal rhythms.
3. **Readable action.** Distinguish successful hits, blocked hits, damage, ready
   abilities and collected ship parts. Repeated pickups should have a short
   cooldown/polyphony limit so a burst cannot overwhelm the important cue.
4. **The creature's identity.** Build a small, nonverbal call motif that survives
   evolution, gaining texture and range with age. This needs authored sounds
   and human listening, not an LLM or live generation service.
5. **One mix.** Procedural effects currently connect directly to the custom
   audio destination; the theme uses Phaser, and cinematic video has its own
   media controls. A later mixer pass should provide explicit music/effects/
   cinematic buses, immediate mute for active notes, restrained limiting and
   music ducking during important creature/reward moments. Audit direct sound
   paths such as `CreatureProfileScene.playSadFarewellSound` in that pass.

## Acceptance

Behavior tests cover late loading after Start, muted loading/unmute, live volume
changes, ending the intro before a late file arrives, paused-theme cleanup,
old/new track ownership, requested-area unmute, hidden-tab suspension and
rejected/interrupted resume. The existing file-format contract stays enforced.
Verification: 234 suites / 2,253 tests passed; full production build passed.
No browser was unmuted, no audible media was played and production was unchanged.

Silent automated checks cannot approve loudness, musical quality, speaker
balance, Bluetooth interruptions or physical iPhone/Android behavior. Kevin's
listening pass should check a fresh opening, saved return, mute/unmute, music
volume zero, leaving/returning to the browser, a level transition and a cutscene.
Do not certify all audio as perfect based on unit tests or file availability.

Browser behavior references: [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
and [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
Audio playback may require a genuine user gesture; do not remove that browser
safeguard or block gameplay while waiting for sound.
