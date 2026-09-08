# Creature Media Prompt and Journey Guide

## Product boundary

Mythical Void creates media about a fictional creature. It does not personalise
artwork to the child or adult playing the game.

The image and video models may receive only:

- a synthetic image of the creature;
- bounded creature appearance traits and life stage; and
- developer-authored scene instructions selected by an allowlisted moment ID.

They must never receive a player or creature name, account/user ID, age or age
band, email, location, IP address, device information, voice, player photograph,
free text, save history or friend data. Anonymous authentication is used between
the browser and Mythical Void for private-file ownership and abuse control. It is
not forwarded to a model.

Cloud Save and friend-linking are separate features with separate age rules.

## What happens after hatching

1. Phaser creates the canonical pixel creature from its deterministic DNA.
2. `CreaturePortraitSpec` converts visible genetics into bounded fields. It does
   not include the player-given creature name.
3. `LivingPortraitService` captures a tightly cropped synthetic creature image.
4. The Netlify portrait function validates every field and constructs the prompt
   itself. Browser-supplied prompts are ignored.
5. The provider receives the synthetic image and bounded creature prompt only.
6. Mythical Void copies the result to private storage and keeps only an opaque
   asset reference in the local save.
7. The portrait is shown in the hatch reveal and Creature Archive. Gameplay can
   continue immediately if generation is still running or unavailable.

The portrait prompt is assembled by `buildCreaturePrompt()` in
`netlify/lib/generate-ai-art-core.cjs`. Its main editable sections are:

| Section | Controls | Do not change without testing |
| --- | --- | --- |
| Identity lock | species, body/head plan, palette, eyes, markings, mutations | exact identity and appendage constraints |
| Biological realisation | material, anatomy, physical scale and ecology | deterministic genetics mapping |
| Style separation | removes pixel/block/mascot appearance | reference-image authority |
| Optical realism | camera, surface detail, contact and light | child-safe exclusions |
| Setting | first-contact Sanctuary environment | the Fend continuity |
| Composition | framing and creature scale | full-body visibility |
| Exclusions | prohibited visual failures and unsafe content | never weaken silently |

To request an edit, identify the section and describe the result in ordinary
language. Example: “In Optical realism, make the creature feel warmer and less
like a studio render, but preserve its exact eye placement.”

## Creature Story Scene prompts

All editable video moment copy lives in:

`src/config/companion-video-moments.json`

The shared prompt applies to every scene:

- `identity`: continuity with the approved creature portrait;
- `continuity`: rules for the creature and Wanderer-77;
- `motion`: breathing, weight and coherent anatomy;
- `camera`: one stable, readable shot;
- `world`: the physical rules and feeling of the Fend;
- `style`: live-action science-fantasy tone; and
- `exclusions`: child-safety, continuity and no-text rules.

Each moment then supplies its own `location` and `action`:

| Journey moment | When generation begins | Scene prompt | Where the player sees it |
| --- | --- | --- | --- |
| First Forest arrival | as soon as the first portrait is ready | cautious first steps; creature tests the Current and looks back to Wanderer-77 | Forest arrival if ready, otherwise Creature Archive |
| Beacon reflection | finale reflection begins | creature and Wanderer-77 witness living light at the Project Beacon overlook | finale if ready, otherwise Creature Archive |
| Guardian rescue | rescue is confirmed | creature lets the freed guardian choose, then leads it toward Sanctuary | rescue if ready, otherwise Creature Archive |
| Guardian trust | Sanctuary trust event is recorded | two creatures exchange recognition beside living roots | trust moment if ready, otherwise Creature Archive |
| Guardian debrief | expedition debrief is recorded | creatures inspect the changed region with a visible environmental response | debrief if ready, otherwise Creature Archive |

Generated video is optional enhancement, never a progression dependency. Every
moment has an immediate portrait tableau fallback. When a background clip later
finishes, Sanctuary shows **CREATURE STORY SCENE READY**. Tapping it opens the
Shared Journey chapter where **WATCH NEW** plays the clip.

## How to edit a video prompt

Give feedback using this compact format:

```text
Moment: Guardian rescue
Keep: freed guardian chooses to follow
Change: make the creature physically open the last root-bar
Camera: begin close on the contact, then widen to reveal Sanctuary lights
Tone: relief and cautious trust, not celebration
Avoid: eye contact as the only action
```

Edit the matching `location` or `action` in the JSON. Edit `sharedPrompt` only
when the direction should affect every scene. After an approved prompt change,
increment `shotVersion`; otherwise an existing successful clip can be reused for
the same creature and moment. Also update `promptVersion` for a material creative
change so production evidence identifies which wording created a clip.

## Runtime and failure behaviour

- Replicate is preflighted before a new video reservation, so a rejected token
  cannot consume the daily allowance.
- Failed or cancelled video jobs are excluded from quota.
- The private portrait is copied to a temporary opaque path before video work.
  The provider does not receive a Supabase user/account path.
- Temporary provider input is removed when the video succeeds or fails.
- Provider output is copied to private Mythical Void storage; signed playback
  links expire.
- Provider failure, slow generation, autoplay refusal or offline play always
  falls back to the immediate portrait tableau.

## Release checklist

1. Review the exact JSON prompt diff.
2. Confirm prohibited provider fields remain unchanged.
3. Run portrait, video, Archive, migration and privacy contract tests.
4. Apply the Supabase migration before deploying functions that use the new RPC
   signatures.
5. Verify the active provider credential with a non-player smoke request.
6. Test under-13, 13–15, 16–17 and adult age selections without Cloud Save.
7. Confirm Cloud Save and friend-linking remain restricted independently.
8. Confirm the model request contains no player data and its image URL has no
   user identifier.
9. Confirm gameplay proceeds when portrait and video providers are unavailable.
