# Mythical Forest Living World Implementation Spec

Status: implementation contract

## Player promise

Mythical Forest is one ancient living organism that is already sick when
Wanderer-77 arrives. The player controls their creature. Wanderer-77 follows,
brings tools and protection, and learns that his scanner cannot understand this
world without the creature.

The player should understand the first expedition in one sentence:

> The forest is hurting. Help it in three places, then free its Guardian.

## Scope and compatibility

- Preserve the existing platforms, movement, combat, Rootwake crossing,
  Guardian fight, rewards, rescued creature, birthday event and return flow.
- Preserve `forest_anchor_1` through `forest_anchor_3`,
  `beaconAnchorsActivated` and existing checkpoint data internally so old saves
  remain valid.
- Remove Root Beacon language and beacon-like symbols from the player-facing
  Mythical Forest experience.
- Use authored dialogue and known story-beat identifiers only. No LLM, player
  profile, free-text memory or external request is part of this feature.
- The guaranteed ending is rendered locally in Phaser. Optional generated
  media may remain additive elsewhere but can never block this sequence.

## Playable route

The existing three ordered checkpoints become three visibly different places
where the Forest needs help:

1. **Tangled Roots** - corruption is stopping a tree from breathing.
2. **Dark Hollow** - life is present even though Wanderer-77's scanner cannot
   detect it.
3. **Hidden Lives** - small alien organisms are sheltering because the damaged
   Guardian is waking.

The compact objective is `HELP THE FOREST // n OF 3`. The next place is warmer
and brighter than later places. Walking the player creature into it starts the
help moment. There is no extra interact button or abstract puzzle.

## Contact moment

Each help moment is a short non-modal sequence:

1. The creature reaches the wounded tissue and movement settles briefly.
2. Its body makes visible contact with the root or hollow.
3. A light impulse begins at that exact contact point and travels into the
   Forest.
4. The wounded place changes shape, colour and movement in the same view.
5. One creature line and one Wanderer-77 line communicate the discovery.
6. The route continues automatically.

The sequence does not pause the Phaser world, cover the controls or require a
network response. Speech bubbles dismiss themselves and can be tapped away.

## Forest memory

The game stores only bounded story identifiers:

- `tangled_roots`
- `dark_hollow`
- `hidden_lives`
- `forest_restored`

The identifiers allow later Sanctuary conversations to remember what happened
without storing generated dialogue, transcripts or personal information. The
displayed wording remains authored and can be changed without migrating saves.

## Guardian restoration ending

Clearing the Elder Treant's corruption starts a guaranteed 8-10 second Phaser
sequence before rewards or the birthday event:

1. Combat UI and mobile controls clear away.
2. The Guardian remains visible and calm.
3. The creature touches the Guardian's oldest root while Wanderer-77 watches
   from a separate position.
4. A wave travels from the creature through the ground and across the frame.
5. The Forest brightens, breathes and reveals alien life: upward-falling rain,
   opening shadow blooms and shared light moving through connected tissue.
6. Authored speech establishes the partnership between life-sense and human
   technology.
7. The established birthday/reward/return flow continues unchanged.

A visible Skip control must always complete the same state transition.

## UX and failure rules

- One objective and one speech bubble at a time.
- No modal during traversal help moments.
- Important action remains in the central phone-safe area.
- Any missing decorative object degrades to dialogue and progression, never a
  blocked level.
- Re-entry restores completed help moments from the existing ordered route.
- Scene shutdown removes every timer, bubble and restoration element.
- The Guardian still awakens automatically after the third help moment.

## Acceptance

- A child can say what is wrong and what their creature did without reading a
  lore panel.
- No player-visible `Root Beacon` wording remains in Mythical Forest.
- The creature visibly causes a change at all three places.
- Wanderer-77 and the creature remain separate and readable.
- The restored Forest changes most of the frame before the reward panel.
- Old route saves still restore correctly.
- Skipping or interrupting the ending cannot block completion.

