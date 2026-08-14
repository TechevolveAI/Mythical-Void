# Authentic gameplay camera

Mythical Void now has a repeatable way to create honest screenshots from the real running game.

The camera follows the same tested journeys used to check the game: the Project Beacon opening, the live egg, a cosmic hatch, all six realms, and the village builder. It uses invented test data and records the exact build behind every image.

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

## Before publishing any image

1. Open it and make sure the game is readable and visually strong.
2. Check that it supports the exact words in the post.
3. Use the description: **Captured from the real Mythical Void browser game; not a generated mockup.**
4. Kevin approves the finished image and post together.
5. If the relevant game area changes, run the camera again rather than reusing an old image.

This system prepares screenshots, not finished trailers. Continuous gameplay video remains the stronger proof for movement, hatching, restoration and player choice.
