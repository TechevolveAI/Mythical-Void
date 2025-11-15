# Mythical Void Architecture

## High-level Product Summary
Mythical Void is a cozy, mobile-first Phaser game where players hatch and bond with a procedurally generated mythical companion. The experience blends Tamagotchi-style nurturing (feeding, playing, resting) with light exploration, collectible coins, and gentle “sparkle combat” moments. Visuals are hand-crafted via the GraphicsEngine, creating a whimsical, sci-fi-meets-fantasy vibe without heavy asset pipelines.

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
4. **Exploration & Care** – Enter `GameScene`; move with touch/keys, smell flowers, collect coins, calm void wisps.
5. **Nurture Cycle** – Use care actions, feed/play/rest, track happiness/energy XP.
6. **Economy Loop** – Spend coins in Shop, manage items in Inventory, personalize the companion, repeat exploring & caring.

## Scene Overview
| Scene | Purpose | Notes |
| --- | --- | --- |
| `HatchingScene` | Entry point, onboarding, Kid Mode gating, Start button resets `GameState`. | Colors, sparkles, tutorial pointer, ensures flow state. |
| `PersonalityScene` | Shows creature genetics/personality quirks, ensures data from Hatching. | Uses `CreatureGenetics`, displays animations. |
| `NamingScene` | Player names creature; final pre-world gating. | Input validation via `InputValidator`, flags a welcome toast for GameScene. |
| `GameScene` | Main loop: exploration, interactions, coins, enemies, care UI, mobile controls. | Uses `WorldBuilder`, `EconomyHudManager`, and `CarePanelManager` to shrink scope. |
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
- **Accessory systems**: `AudioManager`, `HatchCinematics`, `ParallaxBiome`, `UXEnhancements`, etc., initialized in `main.js` once Phaser boots.

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
