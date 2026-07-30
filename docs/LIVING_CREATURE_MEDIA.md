# Living Creature Media

## Product Principle

Mythical Void creatures have two complementary forms:

- **Pixel form** is the canonical gameplay identity. It is immediate, readable, performant, and deterministic.
- **Living form** is an optional AI-generated interpretation used for emotional story moments, profiles, evolution reveals, and sharing.

The living form must not become a random replacement. It is generated from an immutable identity contract derived from the creature's genetics and, when available, the rendered pixel creature as a reference image.

## Current Foundation

`CreaturePortraitSpec` normalizes the following identity anchors:

- creature ID, species, rarity, and evolution stage
- silhouette and wing structure
- exact hex colors for body parts
- eyes, markings, special features, mutations, and shiny traits
- personality and cosmic affinity
- prompt/schema version and a deterministic identity key

Portrait metadata is saved per evolution stage with provider/model provenance and an AI-generated label. Provider output is currently marked temporary because Replicate API files expire; production generation remains behind the separate `ENABLE_AI_PORTRAITS` gate until the storage and usage-control work below is complete.

## Recommended Player Experience

1. The creature hatches and naming completes without waiting on any network service.
2. The pixel creature enters gameplay immediately.
3. The player can opt into creating a living portrait from the profile or creature menu.
4. The generation job runs asynchronously and never freezes movement or scene transitions.
5. The finished portrait is revealed as the same creature "seen more clearly," with an AI-generated label.
6. The player can accept one portrait as the creature's living-form reference.
7. Evolution creates a new stage portrait while preserving the same face, palette, markings, and mutation anchors.

## Provider Direction

### Option 1: Replicate With GPT Image 2

**Recommended first implementation.** The repository already has a Replicate account path and server function. Replicate exposes `openai/gpt-image-2` as an official model with reference-image inputs, so the current integration can improve without introducing another client-side provider.

Use for:

- post-hatch and evolution portraits
- 1:1 medium-quality WebP drafts
- comparing prompt versions and identity preservation

### Option 2: Direct OpenAI Image API

Use direct `gpt-image-2` when tighter OpenAI request control, high-fidelity multi-image editing, or a unified image/video provider is worth adding a second service credential. This path returns base64 image data that still needs persistent storage.

### Option 3: Provider-Agnostic Router

Add after the first portrait evaluation set exists. Route drafts to a cheaper model and accepted final portraits to the quality model. Avoid adding routing before visual consistency can be measured.

## Persistent Storage And Usage Controls

These are required before enabling production generation:

- copy each finished image to owned storage before the provider URL expires
- key objects by user ID, creature ID, stage, identity hash, and portrait revision
- require a Supabase-authenticated player, including anonymous accounts
- permit one automatic draft per creature stage, then apply a small regeneration limit
- enforce server-side idempotency and per-user/IP rate limits
- store provider, model, prompt version, input hash, generation time, and moderation outcome
- provide delete/export controls alongside cloud-save privacy controls
- never send player free-form prompts directly to the media provider

## Personalized Story Video

Video should begin only after a player accepts a living portrait. The accepted image becomes the character reference for short story memories.

### First Three Clips

1. **First Bond**: the newly named creature looks up at the stranded astronaut beside the damaged Beacon craft.
2. **First Rescue**: the creature and astronaut protect another living signal together.
3. **Ending Memory**: the creature stands with the astronaut before the final choice between Earth and the Void world.

Start with 4-8 second clips. Keep dialogue, subtitles, and music in the game layer so clips can be localized and revised without regenerating video.

### Character Consistency

- use the accepted living portrait as `input_reference`
- keep a versioned character bible from `CreaturePortraitSpec`
- use fixed shot templates with controlled camera, action, environment, and duration
- generate one story beat at a time rather than an entire cutscene
- save the resulting MP4, thumbnail, and model metadata to owned storage
- invalidate a clip only when its portrait revision or story-beat version changes

Current video APIs are asynchronous and temporary output URLs expire, so webhooks plus owned storage are required. Reusable character assets can improve consistency later, after the initial portrait-to-video tests demonstrate that the creature survives motion without identity drift.

## Evaluation

Before broad release, build a fixed evaluation set across:

- all seven species
- all body shapes and wing types
- common through legendary rarity
- extra eyes, floating parts, gem bodies, plant growth, and other mutations
- baby and adult stages
- dark, pale, and high-contrast palettes

Score every output for silhouette, palette, eyes, markings, mutations, emotional appeal, age suitability, and false additions. A visually impressive image that loses the creature's identity is a failed output.

## Source Notes

- OpenAI image generation: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI video generation: https://developers.openai.com/api/docs/guides/video-generation
- Replicate official GPT Image 2 model: https://replicate.com/openai/gpt-image-2
- Replicate output-file retention: https://replicate.com/docs/topics/predictions/output-files
