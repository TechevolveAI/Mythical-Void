# Game Flow Documentation

This document describes the expected game flow for Mythical Void.

## Initial Game Flow (New Player)

1. **HatchingScene** - Home Screen
   - Player clicks "Start Adventure" button
   - Sets `session.gameStarted = true`
   - Sets `creature.hatched = false`
   - Scene restarts

2. **HatchingScene** - Hatching Screen
   - Player clicks egg to hatch
   - Creature genetics are generated (via CreatureGenetics/RaritySystem)
   - Sets `creature.hatched = true`
   - Stores `creature.genes`
   - Transitions to PersonalityScene

3. **PersonalityScene** - Soul/Genetics Display
   - Shows creature's personality and traits
   - Player clicks "Continue"
   - Transitions to NamingScene

4. **NamingScene** - Name Your Creature
   - Player enters name
   - Sets `creature.name`
   - Sets `creature.named = true` (implicitly, via name being set)
   - Player clicks "Start Adventure"
   - Transitions to GameScene

5. **GameScene** - Main Game World
   - Player can navigate around the map
   - Collect coins, fight enemies
   - Visit shop, manage inventory
   - All normal gameplay

## Egg Hatching Flow (From Inventory)

When player hatches a new egg from inventory, the current creature is replaced.

### Flow Steps:

1. **GameScene** - Player opens shop (click on shop building)
2. **ShopScene** - Player buys Cosmic Egg (250 coins) or Stellar Egg (1000 coins)
3. **GameScene** - Player presses 'I' key to open inventory
4. **InventoryScene** (overlay over GameScene)
   - Player selects the egg item
   - Player clicks "USE" button

5. **Egg Confirmation Dialog**
   - Shows warning: "Your creature will be gone forever!"
   - Shows rarity odds
   - Player clicks "Hatch It!" button

6. **Farewell Animation** (3 seconds)
   - Dark overlay appears
   - Current creature fades out with sparkles
   - "Farewell, [creature name]..." text

7. **State Reset**
   - `creature.hatched = false`
   - `creature.named = false`
   - `creature.genes = null`
   - `creature.name = null`
   - `creature.spawnPosition` = saved position

8. **Scene Transition**
   - Stops GameScene
   - Stops InventoryScene
   - Starts HatchingScene with data:
     - `isEggHatch: true`
     - `eggType: 'cosmic' or 'stellar'`
     - `spawnPosition: {x, y}`

9. **HatchingScene** - Egg Hatching
   - Detects `isEggHatch = true`
   - Skips home screen, goes directly to hatching
   - Uses appropriate rarity distribution for egg type:
     - Cosmic: Standard odds (50% Common, 25% Uncommon, 15% Rare, 8% Epic, 2% Legendary)
     - Stellar: Premium odds (50% Uncommon, 30% Rare, 15% Epic, 5% Legendary - no common!)
   - Player hatches egg

10. **PersonalityScene** - New Creature Soul/Genetics
11. **NamingScene** - Name New Creature
12. **GameScene** - Back to map with new creature at saved position

### Technical Implementation: Scene Isolation Pattern

Each scene in the hatching flow **MUST stop all other scenes** to prevent visual overlap issues. This is critical because when transitioning from an overlay scene (InventoryScene) to a fresh scene flow, Phaser may not properly clean up the underlying scenes.

**Pattern used in each scene's create() method:**
```javascript
create() {
    // Stop all other scenes to ensure clean display
    const scenesToStop = ['GameScene', 'InventoryScene', 'ShopScene', 'HatchingScene', 'PersonalityScene'];
    scenesToStop.forEach(sceneKey => {
        try {
            this.scene.stop(sceneKey);
        } catch (e) {
            // Scene may not be active, ignore
        }
    });
    this.scene.bringToTop();

    // ... rest of create
}
```

**Why this is necessary:**
- Without this pattern, previous scene visuals persist and appear "on top" of the new scene
- Audio from the new scene plays but visuals from old scene remain
- Each scene must stop ALL potential scenes, not just the previous one in the flow

## Key State Variables

### Session State
- `session.gameStarted` - Whether player has clicked "Start Adventure"
- `session.currentScene` - Current active scene name (for cross-scene communication)

### Creature State
- `creature.hatched` - Whether current creature has been hatched
- `creature.named` - Whether creature has been named (derived from `creature.name`)
- `creature.genes` - Genetic data for creature rendering
- `creature.name` - Creature's name
- `creature.textureName` - Cached texture name for creature sprite
- `creature.spawnPosition` - Where to spawn creature in GameScene

## Egg Types

### Cosmic Egg (250 coins)
- Standard rarity odds
- Can get Common through Legendary

### Stellar Egg (1000 coins)
- Premium rarity odds - NO COMMON creatures!
- 50% Uncommon, 30% Rare, 15% Epic, 5% Legendary

## Troubleshooting

### Common Issues

1. **Stuck on NamingScene after clicking "Start Adventure"**
   - Check console for `isTransitioning` flag issues
   - DOM click handlers may persist between scene instances
   - Solution: Scene active checks in handlers

2. **Black screen after farewell animation**
   - Check console for scene transition errors
   - May be physics group clear errors in GameScene
   - Solution: Safety checks around `.clear()` calls

3. **Inventory closes during farewell animation**
   - ESC or I key pressed during animation
   - Solution: `farewellInProgress` flag prevents closure

4. **GameScene frozen after egg use**
   - State may have been reset but scene transition failed
   - Check console for HatchingScene initialization logs

## Debug Logging

Production logs are minimal. In development mode, use `devLog()` for debugging. Key log patterns:
- `[SceneName] Shutting down` - Scene cleanup beginning
- `[SceneName] Cleanup complete` - Scene cleanup finished
- Console errors for failed operations (always logged)

For detailed debugging, add `devLog()` statements temporarily in development mode.

## Scene Flow Diagram

```
[HatchingScene: Home] --Start Adventure--> [HatchingScene: Hatch]
        |                                           |
        v                                           v
[HatchingScene: Hatch] --Egg Hatched--> [PersonalityScene]
                                                    |
                                                    v
                                           [NamingScene]
                                                    |
                                                    v
                                           [GameScene]
                                                    |
                                            (Open Inventory)
                                                    |
                                                    v
                                    [InventoryScene: Use Egg]
                                                    |
                                          (Hatch It! clicked)
                                                    |
                                                    v
                                        [Farewell Animation]
                                                    |
                                                    v
                                    [HatchingScene: Egg Hatch]
                                                    |
                                                    v
                                           [PersonalityScene]
                                                    |
                                                    v
                                           [NamingScene]
                                                    |
                                                    v
                                    [GameScene: New Creature]
```
