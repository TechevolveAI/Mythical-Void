# Authentic gameplay camera

Mythical Void now has a repeatable way to create honest screenshots from the real running game.

The camera follows the same tested journeys used to check the game: the Project Beacon opening, the live egg, a cosmic hatch, the real creature reveal and Confirm contact state, all six realms, the village builder, and a credited NASA learning moment. It uses invented test data and records the exact build behind every image.

## Why this matters

- A press or social post can prove what players actually see.
- Generated paintings can still show the wider creature imagination, but they cannot be confused with gameplay.
- Old screenshots can be retired when the relevant part of the game changes.
- No child, player account, private message or personal save is used.

## Create a fresh proof set

```bash
npm run build
node scripts/company/capture-authentic-gameplay-stills.cjs
```

The finished images and their proof record are written to `public/press/gameplay/`. The proof record contains the source build, dimensions, file fingerprints, privacy boundary and required disclosure.

To refresh only the NASA learning moment:

```bash
MYTHICAL_CAPTURE_GROUP=nasa node scripts/company/capture-authentic-gameplay-stills.cjs
```

The NASA card must keep three things visibly separate:

- the real NASA image and date;
- its exact source and image credit;
- the creature’s imagined reaction inside the Mythical Void story.

It also includes a short “space scientist’s log” so the feature asks players to observe, infer and look for evidence instead of simply showing a pretty picture.

## Create a genuine gameplay clip

```bash
node scripts/company/capture-authentic-gameplay-video.cjs
```

This records a short vertical journey directly from the running Mythical Forest level. The journey performs real movement and jumping, verifies that the level is live, creates an MP4 and poster image, and records their fingerprints and dimensions in `public/press/gameplay-video/manifest.json`.

The recording contains no voice, player name, account, message or personal save. It must be described as real gameplay. It must never be mixed with generated frames or replacement scenery.

## Before publishing any image

1. Open it and make sure the game is readable and visually strong.
2. Check that it supports the exact words in the post.
3. Use the description: **Captured from the real Mythical Void browser game; not a generated mockup.**
4. Kevin approves the finished image and post together.
5. If the relevant game area changes, run the camera again rather than reusing an old image.
6. For video, inspect the beginning, middle and end rather than approving it from the poster image alone.

The capture system prepares verified proof assets. A trailer still needs a deliberate edit, a checked soundtrack and a final audience decision before upload; the first such edit is now reproducible below.

## The hatch reveal has its own quality gate

The camera now proves that the running build can move from a purchased cosmic egg to a visible creature and a working Confirm contact decision. That does not make the resulting frame good marketing automatically.

The current review is recorded in `docs/company/content/HATCH_REVEAL_PROOF_REVIEW.json`. GP-013 is authentic internal evidence, but it is withheld from public promotion because the creature is too small, text collides, an egg instruction remains after the egg disappears, and the lower interface has no clear reading order. Game Development should improve the reveal composition and then the company camera should capture and review it again.

## Build the launch trailer

The first 64-second launch trailer is now reproducible from the proof assets:

```bash
npm run build:launch-trailer
npm run validate:launch-trailer
```

It uses the genuine moving gameplay clip, verified running-build screenshots, clear title cards and the first-party game theme. Its captions, poster and detailed edit record are written to `public/press/trailer/`.

This does not authorize publication. Kevin still reviews the complete film with sound, the final title, description, thumbnail and audience setting together before upload.
