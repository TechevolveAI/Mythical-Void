# Player Direction, Rewards, and Return Specification

## Purpose

Make every expedition understandable to a child without turning the game into a wall of arrows or instructions. The creature and the world should provide the first layer of help. Compact UI guidance appears only when the player needs it.

This work extends existing level, inventory, shop, save, and Sanctuary systems. It does not replace level layouts or rewrite the campaign.

## Player contracts

### Traversal

- A platform's appearance must match its collision behavior.
- Solid ground uses a complete edge. A branch that can be passed through uses a bright top surface and a broken or tapered underside.
- One-way supports retain a deeper collision body below the authored top edge so a low-frame-rate device cannot skip through a visually safe landing.
- Holding Down or pulling the Forest joystick downward while standing on a pass-through branch drops the player through it.
- The first required descent teaches that action once, in context, while the destination is visible.
- Every required destination has at least one clear route from the player's current height.

### Mythical Forest guidance

- The three ordered objectives are called Root Beacons.
- The next Root Beacon is materially brighter than later beacons.
- When the next beacon is below, the creature senses it with a short trail of world-space light and one concise line.
- On mobile, the joystick receives a brief downward control cue. On keyboard, the line names Down or S.
- If route progress stalls, the creature repeats a small directional pulse. A permanent compass or large arrow is not required.
- Each activated Root Beacon sends visible light toward the next objective.
- The Elder Treant awakens automatically after all three Root Beacons are found.

### Guardian rewards

- Every completed Guardian encounter awards coins, campaign progress, and one usable expedition power-up.
- A replayed Guardian can award another copy, but one encounter can never pay twice.
- The power-up is placed in the normal inventory and can be activated from the expedition pause menu.
- The victory screen names what was awarded, what it does, where to use it, and that the Sanctuary shop can restock it.
- The shop and boss reward use one canonical item definition so names, prices, descriptions, effects, and icons cannot drift.
- Reward pairing:
  - Elder Treant: Energy Crystal
  - Crystal Golem: Crystal Shield
  - Void Serpent: Coin Magnet
  - Cosmic Titan: Power Shot
  - Shadow Phoenix: Health Boost
  - Void Empress: Super Blast

## Follow-on phases

### Phase 1: Forest direction and Guardian power-ups

Implement the traversal, Root Beacon, collision, creature guidance, inventory reward, shop, and victory-copy contracts above. This is the current release-sized change.

### Phase 2: Returning-player doorway

On Sanctuary return, show one primary next story action and one available Sanctuary task. Provide Continue Story, Help the Sanctuary, and Replay a Realm. Start New Journey lives behind a separate-save confirmation and cannot overwrite the current journey accidentally.

### Phase 3: Visible Sanctuary economy

Use the loop Explore -> earn -> build -> see an effect. Cosmic Coins buy shop stock. Wood, stone, and food build the Sanctuary. Energy remains an ability meter. Hide currencies that do not yet have a player-facing use.

Connect buildings one at a time:

- Forager Hut places one visible recovery cache in an expedition.
- Living Sawmill creates a visible route aid or reinforced checkpoint.
- Current Masonry grants one visibly breaking guard charge.
- Shared Habitat allows a rescued resident to be selected for support.
- Discovery Workshop unlocks a visible equipment or creature-energy improvement.

### Phase 4: Creature assistance and combat language

The creature may guide, react, and occasionally stun or finish an ordinary enemy. It does not solve bosses automatically. Enemy art and behavior vary by realm, while hit confirmation, danger, invulnerability, defeat, and Guardian phase language remain consistent and are never communicated by color alone.

### Phase 5: Ending and postgame

Final Guardian completion must always reach a stable aftermath, an astronaut-and-creature scene, an approved choice, a visible consequence, credits, and postgame options. Save before and after the decision. Optional generated media can enrich the scene but can never block it.

## Child-facing creature intelligence

Core guidance uses deterministic local state: creature traits, objective position, route progress, and time without progress. Speech comes from a short authored library and does not accept free-form child input. Generated media remains optional and separate from progression.

## Acceptance gates

- A new player can locate and activate all three Root Beacons without coaching.
- Phone and keyboard players can deliberately drop through Forest branches.
- Stair-step and diagonal routes do not allow the player to fall through a platform that visually reads as safe.
- The Guardian awakens after the third Root Beacon without another puzzle.
- Every Guardian completion adds exactly one usable power-up and explains it on the result screen.
- The same power-up definition is used by the boss reward, inventory, pause menu, and shop.
- Existing saves, level completion, ship parts, coins, katana upgrades, rescued residents, and replay behavior remain compatible.
