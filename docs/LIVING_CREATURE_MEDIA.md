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

`LivingPortraitService` now owns one deduplicated background job per creature identity and evolution stage. The hatch reveal, reload recovery, and later portrait modal reuse the same private server job instead of spending twice or producing competing versions. Completed identities are re-signed from private storage; failed attempts may create a replacement job without consuming new-identity quota.

## Recommended Player Experience

1. The pixel creature hatches immediately.
2. For an eligible 16+ profile in an enabled build, portrait generation begins in the background as soon as the pixel sprite and genetics are available.
3. The existing first-contact readings and naming interaction hide the first several seconds of provider latency.
4. After naming, a non-blocking Living Form handoff shows the finished portrait when ready and always offers an immediate route into the Sanctuary.
5. If generation takes longer, play continues and the finished portrait is saved to the creature profile.
6. The profile and portrait modal reuse the hatch job and stored result.
7. Evolution creates one new stage portrait while preserving the same face, palette, markings, and mutation anchors.
8. When new-identity capacity is exhausted, the UI reports the estimated retry window while Sanctuary entry remains immediately available.

Generation cannot be guaranteed to finish instantaneously. The product target is **instant perceived response**: prewarm early, never show an empty loader, never block gameplay indefinitely, and reveal the result at the first emotionally appropriate moment.

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
- enforce server-side identity idempotency before quota checks
- count only the first reservation for an immutable user/identity pair toward the rolling new-identity quota; failed retries and style changes are exempt
- return `retryAt` and `retryAfterSeconds` for deferred new identities so clients can explain when generation will resume
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

The production path uses a protected, provider-agnostic asynchronous job with the accepted Living Portrait as the exact image-to-video reference. Google Veo Fast through a server-only paid Gemini API key is preferred, with Replicate available as a server-side fallback. Netlify's managed Gemini gateway remains suitable for the Living Portrait image, but its current model list does not include Veo. The browser receives only an opaque application reference; provider job IDs, credentials, source storage paths, and provider output URLs remain server-only. Finished MP4 files are copied into the private `companion-videos` bucket before temporary provider output expires. The first Forest clip starts as soon as the protected Living Portrait job succeeds, is checked again at the Forest invitation and gate, and falls back immediately to the in-engine motion tableau if it is not ready.

Reusable character assets can improve consistency later, after the initial portrait-to-video evaluation demonstrates that the creature survives motion without identity drift.

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
