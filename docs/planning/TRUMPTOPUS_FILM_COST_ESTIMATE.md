# Trumptopus shared-film cost estimate

Checked 2026-09-22 against private source
`5ab875f35dd495f287a44224e9793d484d58daa7` and public provider price pages.
Estimate only: no spending authorization, generation, account inspection or
production configuration change. All film approvals remain false.

## What the cost buys

Three eight-second generated shots become two shared game videos:

- Arrival: one shot, eight seconds.
- Victory: banishment followed by recovery, two shots, sixteen seconds before editing.

That is 24 generated seconds per complete attempt. The approved files are reused
for every player. Playing or replaying them does not submit another generation
request. Hosting and delivery are separate costs, not estimated here.

## Verified list prices and arithmetic

USD generation charges, before taxes, currency conversion or account-specific
credits. These are estimates, not quotes or guarantees of acceptable results.

| Route, 720p | Per generated second | One 8s shot | All three shots | All three plus one replacement take each |
| --- | ---: | ---: | ---: | ---: |
| Google Gemini API, Veo 3.1 Standard, with audio | $0.40 | $3.20 | $9.60 | $19.20 |
| Google Gemini API, Veo 3.1 Fast, with audio | $0.10 | $0.80 | $2.40 | $4.80 |
| Replicate, Veo 3.1 Fast, with audio | $0.15 | $1.20 | $3.60 | $7.20 |
| Replicate, Veo 3.1 Fast, without audio | $0.10 | $0.80 | $2.40 | $4.80 |

Sources: [Google's Veo pricing](https://ai.google.dev/gemini-api/docs/pricing#veo-3.1)
and [Replicate's Veo 3.1 Fast pricing](https://replicate.com/google/veo-3.1-fast).
Google states it charges for successfully generated videos. A successfully
generated take can still be unusable because of visual faults; budget for that
possibility. Do not assume provider rejection or a lost response means a refunded
or unbilled request. Inspect the existing job before any new submission.

## Which account the existing script would use

The shared-film authoring script is distinct from player-specific video jobs.
In [generate-cinematic-assets.mjs](../../scripts/generate-cinematic-assets.mjs):

- Lines 5, 8 and 69-77 select the Google SDK, Standard default and
  `GEMINI_API_KEY`. This path does not use Replicate credit.
- Line 88 permits a `CINEMATIC_VIDEO_MODEL` override. A price comparison does not
  authorize changing that model or starting a job.
- Lines 96-100 request one video, the shot's duration, 16:9 and 720p.
- Lines 66-68 block the three unapproved finale shots before client creation.
- There is no Replicate adapter or numerical spend ledger in this script.
  The approval boolean is not a monetary cap enforcement mechanism.

The separate [player-video service](../../netlify/lib/generate-companion-video-core.cjs)
has Google/Replicate selection. It must not be used to create player identities,
cloud records or recurring player charges for these shared films. No live
provider setting, credential validity or available account balance was checked.

## Bounded recommendation

For the unchanged Standard route, propose a maximum of **$20 in API generation
charges**, allowing six eight-second takes at today's rate ($19.20). This is a
ceiling, not a target, and does not include taxes. Produce one shot first and
review it before committing the rest. A lower-cost Fast route is available as a
separate choice; it has not been visually evaluated on these exact scenes.

Before any authorized run, explicitly select provider/model and recheck pricing,
record each submitted or unresolved job against the cap, and refuse a new job
whose maximum charge exceeds the remainder. No automatic paid retries, silent
model/provider fallback or fresh request while a prior job is unresolved. A
numeric guard/ledger must be in place before unattended paid execution; it is
not claimed to exist today.

Budget approval does not approve source rights, likeness/content acceptance,
visual quality, generated audio or release. Do not retry or route around an
earlier content refusal. If the required character cannot be generated through
an allowed route, report the blocker and agree a different production approach
with Kevin rather than silently changing the character or spending elsewhere.
Automated media inspection remains silent.

Both actual films are still absent. Their Watch integration and human review
must use the approved final files, not the historical Forest playback fixture.
