# Creature Media Readiness

Date: 20/10/2026. Private source reconciliation and film-exit repair.
Not a provider smoke, phone signoff, creative approval, migration or release.

## What Exists

Three different experiences must not be confused:

| Experience | What it contains | Source |
| --- | --- | --- |
| Creature portrait | Generated still artwork of the actual fictional creature; not a video | CreaturePortraitSpec, LivingPortraitService and generate-ai-art-core |
| Creature story video | Optional generated movement based on that saved portrait and a bounded authored moment | CompanionMediaService, companion-video-moments.json and generate-companion-video-core |
| Shared film | An already-created local MP4, identical for all players | cinematic-media.js or final-void-films.json |

The existing prompt contract is not an unstarted design: it already records
versions, closed fictional trait projection, ownership, verified publication,
retry custody and privacy limits. The 96-case frozen portrait prompt matrix and
source-derived genetics-domain tests already exist. They verify prompt handling,
not generated visual quality or live provider availability.

## Actual Journeys

| Journey | Generated-creature video | What is available immediately |
| --- | --- | --- |
| Hatch/reveal | Saved portrait can prepare first_forest_arrival after local publication succeeds | Phaser hatch/reveal and portrait loading/failure paths |
| First Mythical Forest entry | first_forest_arrival, if that creature's clip is ready and unseen; late delivery through Archive/Watch | Authored arrival and moving-portrait fallback; separate shared Forest establishing loop |
| Crystal Caves entry | No distinct generated entry template in the current five-moment configuration | Existing authored level entry/gameplay |
| Stellar Reef entry | No distinct generated entry template | Existing authored level entry/gameplay |
| Void Peaks entry | No distinct generated entry template | Existing authored level entry/gameplay |
| Aurora Depths entry | No distinct generated entry template | Existing authored level entry/gameplay |
| Guardian rescue | guardian_rescue_ followed by the existing guardian compatibility key; known regions have authored location text | Existing resident-release/reward sequence, never waiting for generation |
| Sanctuary trust/debrief | guardian_trust_ or guardian_debrief_ when the corresponding resident event occurs | Existing Sanctuary interaction and moving-portrait fallback |
| Final Void arrival/victory | Shared Trumptopus films, not per-player generation | Authored playable approach, encounter and result; optional Watch when the local film is prepared |
| Finale reflection after repair | beacon_reflection in VictoryScene's reflection phase | Existing ending, choices and immediate tableau fallback |

The active Trumptopus completion returns through the existing GameScene repair
and VictoryScene handoff. Reflection is not an unconditional video immediately
after the final hit. Source wiring is not a natural full-campaign playthrough.
The internal void_empress rescue key remains compatibility data; it is not
renamed to change the active finale.

Late ready notices are realm-specific in expeditions, dismissible and expire
after seven seconds. Watched filtering belongs to CompanionMediaService; the
notice also suppresses repeated offers in its tab. Watch resolves an existing
asset and does not start another generation. Continue is available during
loading, failure, pause and replay. Signed URLs, feature flags, admission,
quotas and actual provider availability still determine whether a clip exists.

Only the active creature's saved portrait is the generated-video identity
reference. A second resident/guardian described in an action is not supplied as
a separately identity-locked portrait. Do not promise both actors match their
in-game forms. Extending references or adding new realm templates needs its own
creative review and media-contract coordination, not an incidental prompt edit.

## Where To Edit

- Still-image wording: netlify/lib/generate-ai-art-core.cjs, buildCreaturePrompt.
- Shared creature-art direction: the existing versioned portrait interpretation.
- Generated scene actions/locations/shared wording: src/config/companion-video-moments.json.
- Region/notice labels: src/systems/StoryVideoContext.js.
- Shared establishing-film generation instructions: src/config/cinematic-media.js.
- Shared final-film files/approval/digests: src/config/final-void-films.json;
  authored finale prompts/provenance remain in the Trumptopus planning documents.

Changing generation instructions does not update an existing shared MP4.
Changing a generated scene materially requires reviewed prompt/shot versioning,
not silently reusing successful cached results. No prompt, version, model,
provider request, feature switch, asset or media record changes in this repair.
Both film-player classes currently initialise playback muted. Replicate video
submission explicitly requests no generated audio. Game music is a separate
system; this is not verification of production sound or a change to its defaults.

## Reproduced Exit Fault And Repair

PreparedFilmPlayer previously used ScenePlugin.pause, which queues by scene key.
Continue before the next SceneManager update could close the dialog before the
pause ran, leaving a later pause with no dialog. Replacing Systems, ScenePlugin
or event streams could also let an old close resume the successor.

The private repair uses the captured Systems instance's synchronous public
pause/resume methods. Shutdown handlers are installed before input reset, all
subsequent control mutation is source-bound, and mount failure rolls back its
own resources/pause without invoking the host continuation. An external resume
revokes its permission to resume a later pause. Stale buttons and callbacks
cannot operate a replacement source. Existing media cleanup remains best-effort;
required setup/host continuation errors remain visible.

The initial native regression run had nine failures and one passing queue
control. This includes one assertion for the required synchronous setup-error
path; it is not nine distinct production incidents. Older mocks treated pause
as immediate and were updated to expose the actual Systems API. The native
tests use installed Systems, ScenePlugin and SceneManager operations without
booting a Phaser Game, renderer, media decode, browser or host audio.

## Acceptance Boundary

The existing final-film validator passed with both source MP4 files present,
matching declared sizes/digests and provenance: 2,835,153 bytes combined. This
is file/manifest proof, not playback, cinematic quality or public launch approval.

CreatureMediaJourneyInventory tests tie the documented versions/source paths to
actual builders and check all six rescue-region prompt/notice mappings. Existing
privacy, publication, delivery and film-exit tests remain the separate safeguards.
Run the focused files with the isolated network-denied Jest workflow; exact
full-suite/build results belong to this candidate's external qualification report.

Still open: real providers/credentials/quotas, signed delivery, phone decode,
background/return, rendering, real audio and human creative acceptance. This is
not a universal nested-modal pause coordinator, nor proof against another owner
calling pause while Systems is already paused without emitting an observable
transition. No new schema, saves, identity, Fusion, backend or migration changes.
No push, merge, deployment, preview, paid generation or fallback activation.
