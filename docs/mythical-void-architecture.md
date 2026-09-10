# Mythical Void Architecture

## High-level Product Summary
Mythical Void is a mobile-first Phaser game where players hatch and bond with a procedurally generated alien creature. The experience combines a peaceful Sanctuary community with side-on expedition realms built around platforming, combat, discovery, and Guardian encounters.

## Target Players and Tone
- **Audience**: Ages 8–14 and their caregivers/parents sharing screen time.
- **Tone**: Nurturing, encouraging, and lighthearted. Enemies are framed as playful void wisps. UI copy emphasizes curiosity and caring rather than competition.
- **Platform priority**: Mobile portrait PWA (touch-first), with keyboard support on desktop.
- **Economy stance**: Cosmic coins are soft currency only. Coins buy cosmetics, treats, and gentle upgrades—no timers, paywalls, or pressure loops.
- **LLM integration**: CreatureAI uses live LLMs only when `VITE_*` env vars provide keys; otherwise it defaults to offline fallback dialogue.

## Core Gameplay Loop
1. **Hatching** – Click to hatch the egg, watch color transitions, and sparkles (`HatchingScene`).
2. **Personality Reveal** – Reveal genetics/personality flare (`PersonalityScene`).
3. **Naming** – Player names the creature, building early bond (`NamingScene`).
4. **Sanctuary & Care** – Enter `GameScene`; care for the creature, meet residents, gather supplies, and grow the community.
5. **Realm Expeditions** – Enter a `PlatformerLevelScene` subclass; traverse authored routes, fight corruption, discover alien ecology, and confront a Guardian.
6. **Nurture Cycle** – Use care actions, feed/play/rest, track happiness/energy XP.
7. **Economy Loop** – Spend coins in Shop, manage items in Inventory, personalize the creature, repeat Sanctuary and expedition play.

## Gameplay Mode Boundary

These are separate player experiences and must not be treated as one generic movement scene.

| Contract | Sanctuary community | Realm platformer |
| --- | --- | --- |
| Code owner | `GameScene` | `PlatformerLevelScene` subclasses |
| Mode ID | `sanctuary-community` | `realm-platformer` |
| Camera | Top-down exploration | Side-on platforming |
| Movement | Continuous four-direction ground movement | Horizontal movement, jump and combat; vertical input only when a level explicitly enables it |
| Main purpose | Care, building, residents, resources and return moments | Traversal, hazards, enemies, ecology actions, Guardian and rescue |
| Failure expectation | Navigation remains forgiving and never strands the player | Checkpoints, pit recovery and readable platform collision own failure and recovery |
| UI expectation | One community objective and nearby action; four-direction mobile stick | One route objective plus jump/action controls; no Sanctuary-building controls |

`src/config/GameplayModes.js` is the code-level source for this boundary. Shared UI may consume the active mode, but mode-specific controls and progression remain owned by their scene family.

## Scene Overview
| Scene | Purpose | Notes |
| --- | --- | --- |
| `HatchingScene` | Entry point, onboarding, Kid Mode gating, Start button resets `GameState`. | Colors, sparkles, tutorial pointer, ensures flow state. |
| `PersonalityScene` | Shows creature genetics/personality quirks, ensures data from Hatching. | Uses `CreatureGenetics`, displays animations. |
| `NamingScene` | Player names creature; final pre-world gating. | Input validation via `InputValidator`, flags a welcome toast for GameScene. |
| `GameScene` | Sanctuary community loop: care, residents, resources, building and expedition departure. | Uses `WorldBuilder`, `EconomyHudManager`, and `CarePanelManager`; owns four-direction Sanctuary controls. |
| `PlatformerLevelScene` | Shared base for expedition realms. | Owns side-on movement, jump/combat controls, platforms, checkpoints, Guardian flow and return to Sanctuary. |
| `ShopScene` | Cosmic shop UI, responsive layout, categories + purchase panel. | Warm “Bring Home” copy plus “ask a grown-up” guidance; responsive dims per device. |
| `InventoryScene` | Manage items, sort/filter, equip/use with InventoryManager. | Desktop sidebar vs mobile layout. |

## Systems Overview
- **`GameState` (`src/systems/GameState.js`)**: Central persistence (localStorage), event emitter, auto-save, state guards. Owners dot-path `get/set`, `updateCreature`, world exploration tracking, versioning.
- **`GraphicsEngine`**: All sprites programmatically, exposes helper methods for trees, rocks, flowers, creatures, coins, etc.
- **`MemoryManager`**: Overrides `setTimeout/Interval` for tracking, cleanup, and leak prevention. Called on unload.
- **`KidMode` + `ResponsiveManager`**: Adjusts UI/UX for young players, handles virtual joystick, safe-zone HUD.
- **`CreatureAI`**: LLM-backed dialogue (live when env keys present). Falls back to personality-based responses offline.
- **`CareSystem`**: Encapsulates feed/play/rest logic, streaks, happiness states, multiplies into achievements.
- **`EconomyManager`**: Soft currency tracker, coin add/spend events, hooks for HUD animations.
- **`EconomyHudManager`**: Cached HUD sprite + floating coin/animation logic so `GameScene` doesn’t manage listeners directly.
- **`CarePanelManager`**: Builds the Care Corner UI, handles hotkeys, and shows heart popups + hint copy when care events fire.
- **`WorldBuilder`**: Generates the background texture once, spawns trees/rocks/flowers/shop, and exposes Phaser groups for collisions.
- **`EnemyManager` + `ProjectileManager`**: Manages void wisp spawn/behavior, simple AIs, projectiles with limited counts.
- **`InventoryManager`**: Adds/uses/removes items, stackable logic.

### Shop Outcome Contract

- Eggs and care items enter Inventory and explain their use location.
- Expedition power-ups enter Inventory and activate from the expedition pause menu.
- Void Crystals enter Inventory and are placed into the Sanctuary from there.
- Route maps bypass finite slots and immediately unlock their matching Hub route.
- The Project Beacon field kit is progression equipment rather than shop inventory. Its katana is auto-equipped to the astronaut and appears under Inventory > Kit.
- Inventory display slots retain the canonical manager slot after sorting and filtering; actions never operate on a display-only index.
- **Accessory systems**: `AudioManager`, `HatchCinematics`, `ParallaxBiome`, `UXEnhancements`, etc., initialized in `main.js` once Phaser boots.

### Artifact Media Contract

- The field katana uses three curated, bundled artworks: untouched Earth configuration, Resonant Edge, and Aurora Guard.
- `KatanaArtifactModal` derives the displayed stage only from canonical installed upgrade IDs. Presentation state cannot award or mutate progression.
- Recovery reveals the untouched blade. Newly earned Guardian upgrades reveal their evolved artwork before the ordinary level-reward panel.
- Inventory > Kit provides a persistent Inspect route to the currently installed configuration.
- All three images are prefetched before their likely reveal and require no runtime generation call, so the moment is immediate and visually consistent.
- Artwork is visibly identified as an AI-assisted artistic interpretation.

## Event & Lifecycle Patterns
- Scenes register shutdown/destroy hooks (`this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)`), store unsubscribe handles, and tear down timers/tweens during `shutdown()`.
- Example pattern (from GameScene & managers):
  ```js
  this.gameStateUnsubscribers.push(getGameState().on('levelUp', handler));
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

  shutdown() {
    this.gameStateUnsubscribers.forEach(unsub => unsub?.());
    this.cleanupCallbacks.forEach(cb => cb?.());
    this.periodicTimers.forEach(timer => timer.remove?.());
  }
  ```
- UI subsystems (e.g., `EconomyHudManager`) encapsulate their own listeners and expose `destroy()` to GameScene.
- `GameState` events: `stateChanged`, `levelUp`, `dailyBonusClaimed`, etc. Scenes should bind via helper functions and remove on shutdown to avoid duplicates.
- Memory safety: `MemoryManager` catches lingering timeouts, `main.js` also sets `beforeunload` to save & cleanup.

## Technical Debt Snapshot
- **P1**: Scene shutdown/cleanup is now wired but must be preserved as new scenes/managers are created. Always store unsubs.
- **P2**:
  1. **GameScene “god scene”** – `WorldBuilder`, `EconomyHudManager`, and `CarePanelManager` now own major subsystems. Next up: InteractionController + Chat UI extraction. 
  2. **Graphics performance** – background + HUD converted to cached textures; remaining heavy Graphics: mini-map frame, reset/combat/chat buttons, achievement modals. 
  3. **Onboarding feel** – welcome toast, heart popups, and “calm the wisp” copy landed; future work: richer tutorials + more creature emotes.
- **P3**: Additional cozy polish (tutorial micro-prompts, mobile-focused spacing, more empathic copy). Future features should follow the documented tone (soft economy, no pressure timers), respect Kid Mode toggles, and use CreatureAI fallback when env keys are absent.

---
This doc is intended as a living reference—update it as new managers/scenes are extracted, event contracts change, or we adjust LLM/economy policies.
