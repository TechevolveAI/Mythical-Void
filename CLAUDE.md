# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A 2D mythical creature game built with Phaser.js 3.70.0 featuring procedural genetics, creature hatching, and exploration mechanics. The game uses programmatic sprite generation (no image assets required) and follows a modular system-based architecture.

## Development Commands

### Essential Commands
```bash
# Development server with hot reload (default: http://localhost:5173)
npm run dev

# Production build
npm run build

# Manual test harness (starts at http://localhost:8080/test-framework.html)
npm test

# Run unit tests (Jest)
npm run test:unit

# Validate critical game flow integrity (pre-commit hook)
npm run validate-flow
```

### Environment Configuration
- Environment variables must use `VITE_` prefix for browser access
- Create `.env.local` (git-ignored) for local configuration
- Example: `VITE_ENABLE_API_FEATURES=true`

### Mobile Development
The game uses a **mobile-first portrait layout** with responsive scaling:
- Uses `Phaser.Scale.RESIZE` mode for dynamic sizing
- `MobileControls` system provides virtual joystick and action buttons
- `ResponsiveManager` handles orientation changes and resize events
- Touch input supports multi-touch (up to 3 active pointers)

## Architecture Overview

### Module Loading System
The game uses a **centralized preload system** via `src/global-init.js`:
- All core systems and scenes are loaded via `Promise.all()` before game initialization
- The `preloadModulesReady` promise ensures all modules are available before Phaser starts
- Phaser is exported globally via `window.Phaser` for system compatibility
- `SceneLoader` handles lazy registration/start/launch transitions, while `GameSceneSceneRouter` and the HUD controller split launch and HUD orchestration out of `GameScene`

**Critical**: Systems are initialized in a specific order in `src/main.js`:
1. ErrorHandler → MemoryManager → UITheme
2. KidMode → HatchCinematics → FXLibrary → ParallaxBiome
3. RaritySystem → RerollSystem → CreatureGenetics
4. GameState → GraphicsEngine → CreatureAI
5. Finally: All scenes (HatchingScene → SoulRevealScene → GameScene, with PersonalityScene/NamingScene still loaded for compatibility)

### Core Systems Architecture

#### GameState System (`src/systems/GameState.js`)
- **Singleton pattern** - accessed globally via `window.GameState`
- Manages all persistent game state including creature stats, player progress, unlocks, breeding, care system, pity system, and reroll mechanics
- Event-driven architecture with `.on()`, `.once()`, `.emit()` methods
- Auto-saves every 30 seconds to localStorage
- Dot-notation property access: `GameState.get('creature.stats.happiness')`
- **Thread-safe state updates**: Always use `.set()` method to trigger events

Key state paths:
- `creature.hatched` - Whether egg has hatched
- `creature.genes` - Genetic data from CreatureGenetics/GeneticsEngine
- `session.gameStarted` - Critical for scene flow control
- `pitySystem.*` - Rarity pity counter state
- `rerollSystem.*` - Reroll mechanics state

#### GraphicsEngine System (`src/systems/GraphicsEngine.js`)
- **Context-aware rendering** - each scene creates its own GraphicsEngine instance
- Programmatically generates all sprites with realistic depth, lighting, and gradients
- **Enhanced creature rendering** with genetic trait support:
  - `createEnhancedCreature()` - Standard creatures with genetic modifications
  - `createSpaceMythicCreature()` - Space-themed variant with cosmic effects
  - `createRandomizedSpaceMythicCreature()` - Full genetic integration
  - `renderCreatureOnGraphics()` - Direct rendering for composition
- **Body type system**: Renders different creature morphologies (fish, cyclops, serpentine, aurora, crystal, guardian, balanced)
- **Advanced color processing**: Supports gradients, color shifts, prismatic effects, mutations
- **Marking patterns**: 15+ pattern types from simple spots to cosmic fractals
- Uses `createScratchGraphics()` for off-screen texture generation (prevents visual flashing)
- **Texture finalization**: Always call `finalizeTexture()` to generate texture and cleanup graphics

#### CreatureGenetics System (`src/systems/CreatureGenetics.js`)
- Generates unique genetic profiles with procedural traits
- Integrates with **RaritySystem** for weighted rarity distribution
- Produces genetics objects consumed by GraphicsEngine for visual rendering
- Supports breeding mechanics via genetic inheritance
- **Cosmic affinity system**: Creatures have elemental alignments (star, moon, nebula, crystal, void)
- **Personality traits**: Core personality (curious, playful, gentle, wise, energetic) affects behavior

#### HatchCinematics System (`src/systems/HatchCinematics.js`)
- Manages cinematic sequences during hatching with camera effects, screen shake, particle systems
- Configurable via `src/config/hatch-cinematics.json`
- Timeline-based animation sequences
- Telemetry logging for cinematic events

#### Kid Mode System (`src/systems/KidMode.js`)
- Family-friendly content filtering and UI simplification
- Provides next-best-action suggestions for young players
- Configurable via `src/config/kid-mode.json`
- Integrates with SafetyManager for parental controls

#### CreatureAnimationController System (`src/systems/CreatureAnimationController.js`)
- **State-driven idle animation system** - creates lively, personality-influenced creature behaviors
- **Emotion system**: Tracks 7 emotion states (happy, curious, shy, excited, tired, scared, content)
- **Stat-based emotion updates**: Automatically sets emotion based on happiness/energy/health stats
- **Emotion particle effects**: Triggers FXLibrary emotion particles on emotion changes
- **Environmental reactions**: Responds to biomes, space weather, time of day, player return
- **Game event reactions**: Responds to level_complete, level_failed, boss_defeated, etc.
- **Thought bubble integration**: Triggers ThoughtBubbleSystem for contextual creature thoughts

Key methods:
```javascript
controller.setEmotion('happy', 0.8);           // Set emotion with intensity (0-1)
controller.reactToBiome('crystal');            // React to environment
controller.reactToGameEvent('level_complete'); // React to game events
controller.setThoughtBubbleHandler(callback);  // Set thought callback
```

Emotion-to-behavior mapping:
- `happy`: bounce, spin, wiggle (frequency: 0.8)
- `curious`: look_around, head_tilt, sniff (frequency: 0.7)
- `excited`: excited_bounce, vibrate, quick_hop (frequency: 1.0)
- `tired`: yawn, sigh, slow_blink (frequency: 0.2)
- `scared`: shiver, look_around (frequency: 0.5)

#### ThoughtBubbleSystem (`src/systems/ThoughtBubbleSystem.js`)
- **Pre-written thought library** - ALL thoughts are pre-written, NO AI-generated text shown to children
- **Contextual awareness**: Tracks player struggle state (consecutive failures, recent failures)
- **Struggling player support**: Automatically shows encouraging thoughts when player fails repeatedly
- **Personality-aware**: Selects thoughts based on creature personality
- Access: `window.ThoughtBubbleSystem`

Key methods:
```javascript
system.recordFailure('level_1');     // Track level failure
system.recordSuccess('level_1');     // Track level success
system.isPlayerStruggling();         // Check if player needs encouragement
system.getThought('idle_thought', { personality: 'curious' });
system.getSuccessThought(context);   // Get appropriate success message
```

Thought categories:
- `idle_thought` - Random observations
- `biome_*` - Environment reactions (biome_cave, biome_crystal, biome_reef)
- `space_weather_*` - NASA space weather reactions
- `event_*` - Game event reactions (event_level_complete, event_level_failed)
- `struggling_encouragement` - Extra encouragement after multiple failures
- `post_struggle_success` - Celebration after overcoming difficulty

State paths:
- `thoughtContext.consecutiveFailures` - Failures on same level
- `thoughtContext.playerStruggling` - True after 3+ consecutive failures

#### FXLibrary Emotion Effects (`src/systems/FXLibrary.js`)
In addition to standard particle effects, FXLibrary provides 7 emotion-specific effects:

| Method | Visual Effect | Colors |
|--------|---------------|--------|
| `emotionHappy(scene, x, y)` | Rising hearts and sparkles | Pink, gold, white |
| `emotionCurious(scene, x, y)` | Question marks, swirling dots | Sky blue |
| `emotionShy(scene, x, y)` | Retreating particles, blush | Plum, light pink |
| `emotionExcited(scene, x, y)` | Bursting stars, exclamation marks | Gold, orange, yellow |
| `emotionTired(scene, x, y)` | Floating Z's, dim sparkles | Muted blue |
| `emotionScared(scene, x, y)` | Trembling lines, dark wisps | Indigo, dark slate |
| `emotionContent(scene, x, y)` | Soft glow, gentle sparkles | Pale green, light blue |

Usage:
```javascript
if (window.FXLibrary) {
    window.FXLibrary.emotionHappy(scene, creature.x, creature.y);
}
```

### Scene Flow Architecture

**Critical game flow logic** (protected by validation script):

```
HatchingScene → SoulRevealScene → GameScene
```

**Scene transition conditions** (DO NOT MODIFY without team review):
```javascript
// In HatchingScene.js - CRITICAL SECTION
if (!gameStarted) {
    // Show welcome screen with START button
} else if (gameStarted && !creatureHatched) {
    // Show hatching sequence
} else if (gameStarted && creatureHatched && !creatureNamed) {
    // Transition to SoulRevealScene
} else {
    // Transition to GameScene
}
```

**START button critical logic**:
```javascript
GameState.set('session.gameStarted', true);
GameState.set('creature.hatched', false);
GameState.save();
this.time.delayedCall(100, () => {
    this.scene.restart();
});
```

### Inventory Egg Hatching Flow

When hatching an egg from inventory (purchased from shop), the flow differs from initial onboarding:

**Flow: Inventory → Farewell → HatchingScene → SoulRevealScene → GameScene**

**Key differences from initial onboarding:**
1. **State must be completely reset** - The existing creature data must be cleared before hatching
2. **Scene isolation required** - Each scene must stop all other scenes to prevent visual overlap
3. **Data passed via scene.start()** - The `isEggHatch` flag and egg type are passed to HatchingScene

**State reset in InventoryScene.showFarewellAnimation():**
```javascript
// Complete creature state reset for new hatching
window.GameState.set('creature.hatched', false);
window.GameState.set('creature.named', false);
window.GameState.set('creature.genes', null);
window.GameState.set('creature.name', null);
window.GameState.set('creature.textureName', null);
window.GameState.set('creature.dna', null);
window.GameState.set('creature.personality', null);
window.GameState.set('creature.personalityState', null);
window.GameState.set('creature.stats', { happiness: 100, energy: 100, health: 100 });
window.GameState.set('creature.level', 1);
window.GameState.set('creature.experience', 0);
window.GameState.save();
```

**Scene isolation pattern** (used by HatchingScene, SoulRevealScene, and the legacy naming flow):
```javascript
create() {
    // Stop all other scenes to ensure clean display
    const scenesToStop = ['GameScene', 'InventoryScene', 'ShopScene', 'HatchingScene', 'SoulRevealScene'];
    scenesToStop.forEach(sceneKey => {
        try {
            this.scene.stop(sceneKey);
        } catch (e) {
            // Scene might not exist - that's fine
        }
    });
    this.scene.bringToTop();
    // ... rest of create()
}
```

**HatchingScene receives egg data via init():**
```javascript
init(data) {
    this.isEggHatch = data?.isEggHatch || false;  // true when from inventory
    this.eggType = data?.eggType || null;         // 'cosmic', 'stellar', etc.
    this.spawnPosition = data?.spawnPosition || null;
}
```

### Scene Lifecycle Patterns

**CRITICAL**: Proper lifecycle management prevents memory leaks and ensures stable performance. Every scene MUST follow this pattern:

```javascript
class Scene extends Phaser.Scene {
    constructor() {
        super({ key: 'SceneName' });
        this.graphicsEngine = null; // Create in create()

        // Initialize all references that need cleanup
        this.eventListeners = [];
        this.timers = [];
        this.uiElements = [];
    }

    create() {
        this.graphicsEngine = new GraphicsEngine(this);

        // Initialize scene-specific state
        // Create UI and game objects
        // Set up event listeners (register them for cleanup)

        // Example event listener registration
        if (window.GameState) {
            window.GameState.on('eventName', this.handler, this);
            // Will be cleaned up in shutdown()
        }

        // Example timer registration (for periodic tasks)
        this.setupPeriodicTimers();
    }

    setupPeriodicTimers() {
        // BEST PRACTICE: Use timer-based execution for periodic tasks
        // AVOID: Modulo checks in update() loop (e.g., if (this.time.now % 5000 < 100))

        this.time.addEvent({
            delay: 5000,
            callback: () => this.periodicTask(),
            loop: true
        });
    }

    shutdown() {
        console.log('[SceneName] Shutting down - cleaning up resources');

        // 1. Remove global event listeners
        if (window.GameState) {
            window.GameState.off('eventName', this.handler, this);
        }
        if (window.InventoryManager) {
            window.InventoryManager.off('itemAdded', this.onItemAdded, this);
        }
        // Continue for all global event listeners...

        // 2. Remove keyboard listeners
        if (this.input && this.input.keyboard) {
            this.input.keyboard.off('keydown-I');
            this.input.keyboard.off('keydown-ESC');
            // Continue for all keyboard listeners...
        }

        // 3. Remove listeners from interactive zones/buttons
        if (this.interactiveZones && Array.isArray(this.interactiveZones)) {
            this.interactiveZones.forEach(zone => {
                if (zone && zone.removeAllListeners) {
                    zone.removeAllListeners();
                }
            });
        }

        // 4. Clear all timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // 5. Destroy tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // 6. Clear references
        this.graphicsEngine = null;
        this.uiElements = [];
        this.interactiveZones = [];

        console.log('[SceneName] Cleanup complete');
    }
}
```

**Memory Leak Prevention Checklist**:
- ✅ Remove ALL global event listeners (GameState, managers, etc.)
- ✅ Remove ALL keyboard event listeners
- ✅ Call `removeAllListeners()` on ALL interactive zones
- ✅ Call `time.removeAllEvents()` to clear timers
- ✅ Call `tweens.killAll()` to stop animations
- ✅ Null out all object references
- ✅ Log cleanup completion for debugging

## Genetic System Integration

### Creating Creatures with Genetics

```javascript
// 1. Generate genetics (or get from GameState)
const genetics = window.CreatureGenetics.generateCreature({
    rarity: 'rare', // or null for random with pity
    cosmicAffinity: 'star' // optional
});

// 2. Create visual representation
const graphicsEngine = new GraphicsEngine(scene);
const { textureName, visualConfig } = graphicsEngine.createRandomizedSpaceMythicCreature(
    genetics,
    0 // animation frame
);

// 3. Store in GameState
GameState.set('creature.genes', genetics);

// 4. Create sprite
const creature = scene.add.sprite(x, y, textureName);
```

### Genetic Trait Structure

Genetics objects contain:
- `id` - Unique identifier
- `species` - Creature species name
- `rarity` - common/uncommon/rare/epic/legendary
- `traits.colorGenome` - Primary, secondary, accent colors with advanced properties
- `traits.bodyShape` - Type (fish, cyclops, etc.) with intensity
- `traits.features` - Eyes, wings, markings, special features
- `cosmicAffinity` - Element and power level
- `personality` - Core trait and attributes
- `metadata` - Generation timestamp, lineage

## Creature Lifecycle System

### Lifecycle Stages

Creatures progress through four distinct life stages, each with unique visual characteristics:

| Stage | Days | Visual Features |
|-------|------|-----------------|
| **Baby** | 0-3 | Smaller size (0.6x), larger eyes (1.8x), rosy cheek blush, sparkle eyes, cute_sparkle particles |
| **Juvenile** | 3-7 | Growing size (0.75x), moderate eye size (1.2x), subtle_sparkle particles |
| **Adult** | 7-30 | Full size (1.0x), normal proportions, standard_aura particles |
| **Elder** | 30+ | Slightly larger (1.1x), wisdom marks, ethereal_aura, golden wisdom mark color |

### Configuration

Lifecycle stages are configured in `src/config/evolution.json`:
- `stages.*` - Visual, stat, and audio configurations per stage
- `hatching.visionReveal` - Adult vision reveal during hatching
- `hatching.babyAnimation` - Cute animations for babies (breathing, blinking, bobbing)
- `babyEnhancements` - Baby-specific visual features (cheek blush, sparkle eyes)

### Hatching Vision Reveal

During hatching, the game can show a dramatic "vision" of the creature's adult form before revealing the baby:

```javascript
// Configured in evolution.json
"hatching": {
    "visionReveal": {
        "enabled": true,           // Enable adult vision reveal
        "showAdultFirst": true,    // Show adult before baby
        "visionDuration": 4000,    // Duration in ms before transitioning to baby
        "visionMessage": "✨ Behold their magnificent destiny...",
        "transitionMessage": "Watch them grow into this incredible form!",
        "babyRevealMessage": "🐣 Your journey together begins now!"
    }
}
```

**Flow**: Adult appears (gold glow + particles) → 4 second display → Transition message → Baby appears with cute animations

### Baby Visual Enhancements

Baby creatures automatically receive cute visual features:
- **Cheek Blush**: Pink circular blush on both cheeks (via `addCheekBlush()`)
- **Sparkle Eyes**: Extra white sparkle highlights in eyes (via `addSparkleEyes()`)
- **Cute Particles**: Star-shaped sparkles around the creature
- **Idle Animations**: Breathing (squash/stretch), bobbing, occasional excited bounce

### Creating Stage-Specific Creatures

```javascript
// The 'stage' parameter controls visual appearance
const { textureName } = graphicsEngine.createRandomizedSpaceMythicCreature(
    genetics,
    0,        // frame
    'baby'    // stage: 'baby', 'juvenile', 'adult', 'elder'
);

// Or with DNA
const { textureName } = graphicsEngine.createCreatureFromDNA(
    dna,
    0,        // frame
    'baby'    // stage
);
```

## Critical Code Sections

### Protected Game Flow Logic
The `scripts/validate-game-flow.js` script enforces integrity of critical code sections:
- **HatchingScene.js**: Scene flow decision logic and START button handler
- **GameState.js**: Save/load methods
- **KidMode.js**: Core kid mode functions
- **HatchCinematics.js**: Cinematic system functions

**Before modifying these sections**, run `npm run validate-flow` to ensure integrity.

### Memory Management
- `MemoryManager` system tracks resource usage and performs automatic cleanup
- Scene cleanup occurs in `shutdown()` and `destroy()` lifecycle methods
- Graphics objects must be explicitly destroyed: `graphics.destroy()`
- Textures are automatically managed by Phaser's texture cache

### Error Handling
- `ErrorHandler` system provides centralized error tracking
- All systems emit errors via `window.errorHandler.handleError()`
- Error severities: 'info', 'warning', 'error'
- Phaser errors are intercepted via game events

## Configuration Files

### JSON Configuration System
- `src/config/kid-mode.json` - Kid mode behavior settings
- `src/config/hatch-cinematics.json` - Cinematic sequence definitions
- `src/config/biomes.json` - Parallax biome configurations
- `src/config/evolution.json` - Creature lifecycle stages, hatching vision reveal, baby enhancements
- `src/config/bosses.json` - Boss fight configurations
- `src/config/rarity-config.json` - Rarity tiers and probabilities
- `src/config/personality-expanded.json` - Extended personality traits
- `src/config/chat-responses.json` - Creature chat dialogue library
- `src/config/creature-responses.json` - Creature interaction responses
- `src/config/legal.json` - Legal/compliance configuration

**Pattern**: Systems load configs via `cloneConfig()` helper in main.js to prevent mutation.

## Testing Strategy

### Unit Tests
- Located in `src/__tests__/`
- Jest configuration in `package.json`
- Test GameState, HatchCinematics, KidMode systems

### Manual Test Framework
- `npm test` starts custom test harness
- Located at `/test-framework.html`
- Provides manual testing interface for game features

### Game Flow Validation
- **Pre-commit hook**: `npm run validate-flow`
- Validates critical code patterns haven't been accidentally modified
- Checks for protection marker comments

## Common Development Patterns

### Adding a New System

1. Create system in `src/systems/NewSystem.js`
2. Export to window: `window.NewSystem = NewSystem;`
3. Add to `src/global-init.js` module list
4. Initialize in `src/main.js` postBoot callback
5. Access globally via `window.NewSystem`

### Creating New Sprites

```javascript
const graphics = this.graphicsEngine.createScratchGraphics();

// Draw shapes using Phaser graphics API
graphics.fillStyle(0xFF0000);
graphics.fillCircle(50, 50, 20);

// Generate texture
const textureName = this.graphicsEngine.finalizeTexture(
    graphics,
    'myTexture',
    100, // width
    100  // height
);

// Use texture
const sprite = this.add.sprite(x, y, textureName);
```

### State Management Pattern

```javascript
// Read state
const happiness = GameState.get('creature.stats.happiness');

// Update state (triggers events)
GameState.set('creature.stats.happiness', newValue);

// Listen to changes
GameState.on('changed:creature.stats.happiness', (newValue, oldValue) => {
    console.log('Happiness changed:', oldValue, '->', newValue);
});

// One-time listener
GameState.once('levelUp', (data) => {
    console.log('Level up!', data);
});
```

### Scene Transitions

```javascript
// Simple transition
this.scene.start('GameScene');

// With data
this.scene.start('GameScene', { fromHatching: true });

// Parallel scenes
this.scene.launch('UIScene');
this.scene.bringToTop('UIScene');

// Restart current scene
this.scene.restart();
```

### Shop and Inventory Scenes

**ShopScene** (`src/scenes/ShopScene.js`):
- Displays purchasable items (eggs, consumables, cosmetics)
- Integrates with EconomyManager for transactions
- Shows confirmation dialogs for purchases over 100 coins
- Keyboard: `S` to open from GameScene

**InventoryScene** (`src/scenes/InventoryScene.js`):
- Displays player's owned items
- Supports item usage (eggs trigger hatching flow)
- Includes farewell animation when replacing creature
- Keyboard: `I` to open from GameScene

### Platformer Levels (Side-Scrolling)

Platformer levels extend `PlatformerLevelScene` base class which provides different gameplay mechanics from sanctuary-style scenes:

**Key Differences from Sanctuary (Top-Down):**
- Uses gravity-based physics (`gravityY = 500` default, or lower for swimming levels)
- Side-scrolling camera following
- Jump mechanics with grounded detection
- Combat system with melee, ranged, and special attacks

**Required Mobile Controls:**
All platformer levels MUST have mobile controls that include:
1. **Joystick** (bottom-left, 140px diameter) - Horizontal movement
2. **Action Buttons** (bottom-right, arc layout) - Jump (100px, bottom), Attack buttons in arc above
3. **Menu Button** (top-left) - Opens pause menu with Exit to Hub option

**CRITICAL - Control Placement:**
- Controls MUST be positioned in the dedicated control zone at the BOTTOM of the screen
- Controls must NEVER overlay the playable game area - player must always see their character
- The control zone height is 120px, positioned at the very bottom above the safe area
- Joystick and buttons stay within/just above ground level visually

**Pause Menu Requirements:**
- ESC key on desktop opens pause menu
- Menu button on mobile opens pause menu
- Pause menu MUST include:
  - Resume button
  - Exit to Hub button (returns to HubWorldScene)

**Extending PlatformerLevelScene:**
```javascript
class MyLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'MyLevel',
            levelId: 'my_level_1',
            biomeId: 'my_biome',
            levelWidth: 5000,
            levelHeight: 800
        });

        // Override physics for special mechanics (e.g., swimming)
        this.gravityY = 60;  // Lower gravity for swimming
        this.playerSpeed = 170;
    }

    create() {
        super.create();  // Sets up physics, player, input, HUD, mobile controls
        this.showLevelEntry();  // Show level intro screen
    }

    createLevelContent() {
        // Override to add level-specific enemies, collectibles, etc.
    }
}
```

**Current Platformer Levels:**
- `MythicalForestLevel` - Cosmic forest with vertical tree climbing, 4 enemy types, Elder Treant boss (50 HP)
  - **8000px level width** - Extended for longer journey
  - **Mandatory tree climbing** - Large void gaps (500-1400px) force vertical traversal
  - **Enemy types**: Void Sprites (ground chasers), Branch Crawlers (platform patrollers), Spore Drifters (AoE hazards with warning telegraphs), Forest Wisps (teleporting shooters with stun window)
- `CrystalCavesLevel` - Crystal-themed cave platformer with Crystal Golem boss
- `ReefLevel` - Cosmic void swimming level with Nyx'voral boss
- `AuroraDepthsLevel` - Deep aurora-lit caverns
- `FinalVoidLevel` - Final boss confrontation with Void Empress
- `VictoryScene` - Level completion celebration screen

### Level Design Patterns (MUST FOLLOW)

All platformer levels should follow these established patterns based on the MythicalForestLevel template:

#### Level Structure Requirements

1. **Dimensions**: Use appropriate dimensions for verticality
   - Standard: `levelWidth: 5000-6000, levelHeight: 800-1200`
   - Vertical-focused levels should use taller height (1200px)
   - Swimming levels can use shorter height (600-800px)

2. **Ground Sections with Void Gaps**: Create ground platforms with hazard gaps
   ```javascript
   const groundSections = [
       { x: 0, width: 500 },      // Starting area (safe)
       { x: 600, width: 300 },    // After first gap (learning gap)
       { x: 1000, width: 400 },   // Progression continues
       // ... void gaps between sections create danger
   ];
   ```

3. **Vertical Structures**: Add climbable structures (trees, crystals, pillars)
   - Each structure should have multiple branch/platform levels
   - Alternate left/right positioning for interesting climbing
   - Top platforms should reward exploration

4. **Connecting Bridges**: Link vertical structures with different bridge types
   - **Static bridges**: Safe, solid platforms
   - **Vine/stepping bridges**: Require precision jumping
   - **Collapsing bridges**: Time-pressure challenge

#### Enemy Design Requirements

Each level MUST have 3-4 distinct enemy types with different behaviors:

| Enemy Type | Behavior | Placement |
|------------|----------|-----------|
| **Ground Chasers** | Patrol/chase on ground level | Ground sections |
| **Platform Patrollers** | Walk back and forth on platforms | Elevated platforms |
| **Floating Hazards** | Float and emit AoE damage with **warning telegraph** | Open air areas |
| **Ranged Shooters** | Teleport/shoot at player with **stun window** | Strategic locations |

**CRITICAL Enemy Behavior Rules:**
- **All enemies MUST apply knockback on collision** - prevents trapping player
- **AoE attacks MUST have warning telegraph** (0.5-1s pulsing visual before damage)
- **Teleporting enemies MUST have vulnerability window** after attacking
- **Cluster density limited to 2 enemies** - prevents unfair difficulty spikes

**Enemy Implementation Pattern:**
```javascript
createEnemies() {
    // Ground enemies
    const groundPositions = [{ x: 700, y: groundY }, ...];
    groundPositions.forEach(pos => this.createGroundEnemy(pos.x, pos.y));

    // Platform enemies - attach to specific platforms
    const platformEnemies = [{ platformIndex: 2 }, ...];
    platformEnemies.forEach(config => this.createPlatformEnemy(config));

    // Floating hazards - clusters in open areas
    const hazardClusters = [{ x: 900, y: 400, count: 3 }, ...];
    hazardClusters.forEach(cluster => this.createHazardCluster(cluster));

    // Ranged enemies - strategic positions
    const rangedPositions = [{ x: 1100, y: 300 }, ...];
    rangedPositions.forEach(pos => this.createRangedEnemy(pos.x, pos.y));
}
```

#### Collectible Requirements

1. **Star Fragments**: 5 per level, placed at challenging locations
   - 1 tutorial location (easy to find)
   - 2-3 moderate difficulty (requires exploration)
   - 1-2 hard locations (high risk or timed)

2. **Coins**: Scattered throughout
   - Ground level coins (basic reward)
   - Platform coins (exploration reward)
   - Bonus coin arcs over hazards (skill reward, +50% value)

**Collectible Placement Pattern:**
```javascript
placeCollectibles() {
    // Star Fragments at challenging spots
    const starLocations = [
        { x: 300, y: topOfTree1, hint: 'tutorial' },      // Easy
        { x: 1300, y: hiddenBranch, hint: 'explore' },    // Medium
        { x: 3650, y: collapsingBridge, hint: 'timed' }   // Hard
    ];

    // Coins - ground, platforms, bonus arcs
    this.placeGroundCoins();
    this.placePlatformCoins();
    this.placeBonusCoinArcs();
}
```

#### Boss Arena Requirements

1. **Position**: At the end of the level, after final vertical structure
2. **Visual Distinction**: Ritual circles, glowing runes, atmospheric particles
3. **Trigger Zone**: Invisible zone that starts boss fight when player enters
4. **Arena Size**: At least 800px wide for boss movement

**Boss Fight Structure:**
```javascript
createBossArena() {
    const arenaX = this.levelWidth - 1100;  // End of level
    const arenaWidth = 1000;

    // Visual: ritual circles, runes, particles
    // Physics: flat arena floor
    // Trigger: invisible zone starts fight
}

spawnBoss() {
    // Create texture (procedural, no image files)
    // Set physics properties
    // Create health bar UI
    // Start AI timer
}

bossAITick() {
    // Face player
    // Choose attack based on phase
    // Execute attack with telegraphs
}
```

#### Level-Specific Theming

Each level MUST have a unique visual identity:

| Level | Theme | Color Palette | Unique Mechanic |
|-------|-------|---------------|-----------------|
| **Mythical Forest** | Cosmic trees, bioluminescence | Purple, green, teal glows | Vertical tree climbing |
| **Crystal Caves** | Crystalline formations | Blue, cyan, white sparkle | Crystal platforms |
| **Stellar Reef** | Cosmic underwater | Deep blue, coral pink | Swimming physics |
| **Aurora Depths** | Northern lights caverns | Aurora colors, dark depths | Light/dark zones |
| **Final Void** | Pure void corruption | Deep purple, black, crimson | Reality tears |

#### Performance Requirements for Levels

1. **Texture Reuse**: Create enemy/collectible textures once with `if (!this.textures.exists(key))`
2. **Cleanup in shutdown()**: Destroy ALL enemies, collectibles, platforms, particles
3. **Timer-based AI**: Use `this.time.addEvent()` not `update()` modulo checks
4. **Particle Limits**: Max 50 simultaneous floating particles per level

## Performance Considerations & Best Practices

### Core Performance Rules

1. **Texture generation**: Generate textures once in `create()`, reuse throughout scene lifecycle
2. **Memory cleanup**: Always destroy graphics objects after texture generation
3. **State updates**: Batch GameState updates when possible to reduce event overhead
4. **Auto-save frequency**: Default 30s interval; adjust via `GameState.startAutoSave(ms)`

### Timer-Based Execution (CRITICAL)

**ALWAYS USE** timer-based periodic execution instead of modulo checks in `update()` loops:

```javascript
// ❌ BAD - Inefficient, runs check every frame
update(time, delta) {
    if (this.time.now % 5000 < 100) {
        this.checkAchievements();
    }
}

// ✅ GOOD - Efficient, runs exactly when needed
create() {
    this.time.addEvent({
        delay: 5000,
        callback: () => this.checkAchievements(),
        loop: true
    });
}
```

**Why this matters**: Modulo checks execute every frame (~60fps), causing unnecessary CPU overhead. Timer-based execution runs precisely when needed.

### Development vs Production Code

**ALWAYS wrap debug/development code** with environment checks:

```javascript
import { devLog, devWarn, devDebug } from './utils/devLogger.js';

// Development-only logging
devLog('[GameScene] Creature spawned:', creatureData);

// Development-only debug graphics
if (import.meta.env.DEV) {
    const debugGraphics = this.add.graphics();
    debugGraphics.lineStyle(2, 0x00FF00);
    debugGraphics.strokeRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
}

// Production errors should still use console.error
if (!creature) {
    console.error('[GameScene] Failed to create creature');
}
```

**Available utilities** (`src/utils/devLogger.js`):
- `devLog()` - Development-only console.log
- `devWarn()` - Development-only console.warn
- `devDebug()` - Development-only debug messages with [DEBUG] prefix
- `isDev()` - Check if running in development mode

### Performance Optimization Checklist

- ✅ Use timer-based periodic execution (not modulo checks)
- ✅ Wrap debug graphics in `if (import.meta.env.DEV)` checks
- ✅ Use `devLog()`/`devWarn()` instead of `console.log()` for debugging
- ✅ Generate textures once, reuse via texture cache
- ✅ Destroy graphics objects after texture generation
- ✅ Clean up ALL event listeners in `shutdown()`
- ✅ Clear ALL timers in `shutdown()`
- ✅ Batch state updates when possible

## UX Enhancement Patterns (PRODUCTION-READY)

### Loading States

**ALWAYS show loading states** for async operations and scene transitions to prevent perceived freezing:

```javascript
// In any scene with async operations
async performAsyncOperation() {
    // Show loading overlay
    if (window.UXEnhancements) {
        window.UXEnhancements.showLoading('Generating creature...');
    }

    try {
        // Perform async work
        await this.generateCreature();

        // Hide loading overlay
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }
    } catch (error) {
        console.error('[Scene] Operation failed:', error);
        window.UXEnhancements?.hideLoading();
    }
}
```

**When to use loading states**:
- Scene transitions (HatchingScene → PersonalityScene)
- Creature generation
- Inventory operations
- Shop transactions
- Save/load operations

### Confirmation Dialogs

**ALWAYS request confirmation** for expensive, destructive, or irreversible actions:

```javascript
showConfirmation(item) {
    // Create dark overlay (depth 200+)
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(200);

    // Create modal panel
    const panel = this.add.graphics();
    panel.fillStyle(0x1A1A3E, 1);
    panel.fillRoundedRect(x, y, width, height, 15);
    panel.lineStyle(3, 0x7B68EE);
    panel.strokeRoundedRect(x, y, width, height, 15);
    panel.setDepth(201);

    // Add confirm/cancel buttons with hover effects
    // Store all elements in array for cleanup
    const dialogElements = [overlay, panel, title, details, confirmBtn, cancelBtn];

    // ESC key to cancel
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            dialogElements.forEach(el => el.destroy());
            this.input.keyboard.off('keydown', escHandler);
        }
    };
    this.input.keyboard.on('keydown', escHandler);
}
```

**When to use confirmations**:
- Expensive purchases (threshold: 100+ coins)
- Expensive item usage
- Destructive actions (delete, reset)
- Irreversible decisions

### Tutorial System

**ALWAYS implement progressive tutorial hints** for new features:

```javascript
// Tutorial state management
hasSeenTutorial() {
    return window.GameState?.get('tutorial.featureName') || false;
}

markTutorialSeen() {
    window.GameState?.set('tutorial.featureName', true);
}

showTutorialHint(stage) {
    if (this.hasSeenTutorial()) return;

    const hintText = this.getTutorialText(stage);

    this.tutorialHint = this.add.text(x, y, hintText, {
        fontSize: '16px',
        color: '#FFFFFF',
        backgroundColor: 'rgba(123, 31, 162, 0.8)',
        padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setAlpha(0);

    // Fade in
    this.tweens.add({
        targets: this.tutorialHint,
        alpha: 1,
        duration: 500
    });

    // Auto-dismiss after 5 seconds
    this.time.delayedCall(5000, () => {
        this.tweens.add({
            targets: this.tutorialHint,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.tutorialHint?.destroy();
                this.markTutorialSeen();
            }
        });
    });
}
```

**Tutorial state paths**:
- `tutorial.hatchingSeen` - Egg hatching tutorial
- `tutorial.rerollSeen` - Reroll system tutorial
- `tutorial.personalitySeen` - Personality selection tutorial
- Add new paths as needed for features

### Visual Feedback System

**ALWAYS provide visual feedback** for player actions:

```javascript
// Floating text animations
showFloatingText(text, x, y, color = '#FFD700') {
    const floatingText = this.add.text(x, y, text, {
        fontSize: '24px',
        color: color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
        targets: floatingText,
        y: y - 80,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 1.5 },
        duration: 1500,
        onComplete: () => floatingText.destroy()
    });
}

// Celebration with particles (requires FXLibrary)
showCelebration(x, y) {
    // Screen flash
    const flash = this.add.graphics();
    flash.fillStyle(0xFFD700, 0.3);
    flash.fillRect(0, 0, width, height);
    this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 500,
        onComplete: () => flash.destroy()
    });

    // Particle burst
    if (window.FXLibrary) {
        window.FXLibrary.stardustBurst(this, x, y, {
            count: 20,
            color: [0xFFD700, 0xFFA500, 0xFFFFFF],
            duration: 2000
        });
    }

    // Sound effect
    if (window.AudioManager) {
        window.AudioManager.playLevelUp();
    }
}

// Stat warning indicators
getStatWarning(value, max) {
    const percentage = (value / max) * 100;
    if (percentage <= 20) {
        return { icon: '🔴', warning: true, critical: true };
    } else if (percentage <= 40) {
        return { icon: '🟡', warning: true, critical: false };
    } else {
        return { icon: '✅', warning: false, critical: false };
    }
}
```

**Visual feedback checklist**:
- ✅ Floating coin animations on collection
- ✅ Screen flash + particles for major events (level up, achievements)
- ✅ Stat warning indicators (🔴 critical, 🟡 warning, ✅ good)
- ✅ Button hover effects (color change, scale)
- ✅ Pulsing animations for critical states

### Audio System Integration

**ALWAYS provide audio feedback** for player actions:

```javascript
// Example integration in GameScene
performAction(actionType) {
    const result = this.executeAction(actionType);

    if (result.success && window.AudioManager) {
        switch(actionType) {
            case 'pet':
                window.AudioManager.playPet();
                break;
            case 'feed':
                window.AudioManager.playFeed();
                break;
            case 'play':
                window.AudioManager.playPlay();
                break;
            case 'levelUp':
                window.AudioManager.playLevelUp();
                break;
            case 'achievement':
                window.AudioManager.playAchievement();
                break;
            case 'coinCollect':
                window.AudioManager.playCoinCollect();
                break;
            case 'purchase':
                window.AudioManager.playPurchase();
                break;
            case 'error':
                window.AudioManager.playError();
                break;
        }
    }
}
```

**Available sound effects** (procedurally generated via Web Audio API):
- `playCoinCollect()` - Bright, satisfying chime
- `playError()` - Descending tone for errors
- `playButtonClick()` - Short blip for UI interactions
- `playPurchase()` - Triumphant chime for purchases
- `playAttack()` - Sharp combat sound
- `playEnemyHit()` - Lower impact sound
- `playLevelUp()` - Triumphant fanfare (5-note ascending)
- `playAchievement()` - Magical chime sequence
- `playPet()` - Warm, gentle tone
- `playFeed()` - Satisfying munch sound (3 notes)
- `playPlay()` - Playful bounce (4 notes)
- `playVisionReveal()` - Mystical shimmer for adult vision during hatching
- `playBabyCoo()` - Soft, warm, content baby sound
- `playBabyChirp()` - Short, happy baby chirp
- `playBabyGiggle()` - Multi-note playful giggle
- `playBabyYawn()` - Cute yawning sound
- `playBabyHappy()` - Excited, bouncy happy sound

**Audio system notes**:
- All sounds are procedurally generated (no audio files required)
- Web Audio API context auto-resumes on user interaction
- Respects mute state (`AudioManager.toggleMute()`)
- Volume controls: `setMasterVolume()`, `setSFXVolume()`, `setMusicVolume()`

### UI Component Patterns

**Tooltips** (hover-based information):
```javascript
showTooltip(item, x, y) {
    this.hideTooltip(); // Clean up existing

    this.tooltip = this.add.graphics();
    this.tooltip.fillStyle(0x1A1A3E, 0.95);
    this.tooltip.fillRoundedRect(x, y, width, height, 10);

    this.tooltipText = this.add.text(x + padding, y + padding, detailsText, {
        fontSize: '14px',
        color: '#FFFFFF',
        wordWrap: { width: width - 2 * padding }
    });
}

hideTooltip() {
    this.tooltip?.destroy();
    this.tooltipText?.destroy();
    this.tooltip = null;
    this.tooltipText = null;
}

// Attach to hover events
zone.on('pointerover', () => this.showTooltip(item, x, y));
zone.on('pointerout', () => this.hideTooltip());
```

**Sort/Filter Controls**:
```javascript
// State management
constructor() {
    super({ key: 'SceneName' });
    this.currentSort = 'none'; // none, name, type, price
    this.currentFilter = 'all'; // all, category1, category2
}

// Apply to data before display
refreshData() {
    let items = this.getAllItems();
    items = this.applyFilter(items);
    items = this.applySort(items);
    this.displayItems(items);
}

applySort(items) {
    if (this.currentSort === 'none') return items;

    const sorted = [...items]; // Don't mutate original
    switch (this.currentSort) {
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'price':
            sorted.sort((a, b) => b.price - a.price); // Descending
            break;
    }
    return sorted;
}
```

## Global Keyboard Shortcuts

The following keyboard shortcuts are available globally (defined in `main.js`):

| Shortcut | Action |
|----------|--------|
| **Alt + F** | Toggle fullscreen mode |
| **Alt + D** | Toggle dark mode |
| **Alt + M** | Mute/unmute audio |
| **Escape** | Pause/unpause game |

## Manager Systems

### EconomyManager (`src/systems/EconomyManager.js`)
- Manages player currency (coins)
- Handles transactions (spend, earn)
- Validates sufficient funds before purchases
- Events: `coinsChanged`, `transactionComplete`, `insufficientFunds`
- Access: `window.EconomyManager`

### InventoryManager (`src/systems/InventoryManager.js`)
- Manages player inventory (items, eggs, consumables)
- Handles item acquisition and usage
- Events: `itemAdded`, `itemRemoved`, `itemUsed`
- Access: `window.InventoryManager`

### EnemyManager (`src/systems/EnemyManager.js`)
- Spawns and manages enemy entities
- Handles enemy AI and behavior
- Access: `window.EnemyManager`

### ProjectileManager (`src/systems/ProjectileManager.js`)
- Handles projectile creation and collision
- Manages attack animations
- Access: `window.ProjectileManager`

### CombatJuice (`src/systems/CombatJuice.js`)
- **Screen shake** on hits with intensity scaling
- **Haptic feedback** for mobile devices (light/medium/heavy)
- **Combo system** with damage bonuses (1.1x at 5 hits, up to 1.5x at 20+ hits)
- **Damage numbers** floating above enemies
- **Hit flash** effects on sprites
- **Critical hit detection** with special effects

```javascript
// Usage in platformer levels
if (this.combatJuice) {
    this.combatJuice.registerHit(damage);       // Track combo
    this.combatJuice.screenShake(intensity, duration);
    this.combatJuice.hapticFeedback('medium');  // light/medium/heavy
    this.combatJuice.showDamageNumber(x, y, damage, isCritical);
    this.combatJuice.hitFlash(sprite, color, duration);
}
```

### ChatManager (`src/systems/ChatManager.js`)
- Manages in-game chat system
- Kid-safe filtering integration
- Access: `window.ChatManager`

### SpaceWeatherSystem (`src/systems/SpaceWeatherSystem.js`)
- Connects real NASA space weather data to game atmosphere
- Uses NASA DONKI API (Solar Flares, Geomagnetic Storms, High Speed Streams)
- 4-hour cache to avoid API spam
- Graceful fallback when offline
- Access: `window.SpaceWeatherSystem`

**Game Effects from Space Weather**:
- `auroraActive` / `auroraIntensity` - Visual aurora effects
- `solarActivity` - quiet/moderate/active/intense
- `cosmicEnergy` - Affects creature energy (0-100)
- `skyTint` - Dynamic sky color changes

### HubWorldScene Navigation
The game uses a Crash Bandicoot-style hub world with gates to different biomes:

```javascript
// Transition from HubWorldScene to a level
this.scene.start('CrystalCavesLevel', { fromHub: true });

// Return to hub from a level
this.scene.start('HubWorldScene');
```

**Key HubWorldScene features**:
- Circular gate layout with selectable biome portals
- Creature display in center
- Arrow key / tap navigation between gates
- Collection button for viewing creature collection

### Sanctuary Features (GameScene)

The main GameScene provides a sanctuary-style top-down area with several interactive zones:

**Target Practice Range** (`WorldBuilder.createTargetRange()`):
- Located in the training grounds zone
- Targets: Bullseyes (3), Dummies (2), Barrels (2 - explode!), Moving Target (1)
- Score display when in range
- Projectiles auto-target range targets when player is within range
- Targets respawn after being hit

**Navigation Paths**:
- Visual paths connect sanctuary landmarks
- Path destinations include: Hatching Area, Cosmic Pond, Training Grounds, Treasure Dig

**Collectibles**:
- Treasure chest spawn points
- Coin collection with floating text animations

## Security & Safety

- Follows **Vibe Coding Playbook** security standards (see VIBE_CODING_COMPLIANCE.md)
- **KidMode** provides family-friendly content filtering (always enabled)
- **Input validation** via InputValidator system
- **No hardcoded secrets** - use environment variables with VITE_ prefix

## Netlify Functions

The project includes serverless functions for backend operations:

### AI Art Generator (`netlify/functions/generate-ai-art.js`)
- Transforms creature images into realistic/artistic versions using AI
- Supports multiple backends: Replicate, OpenArt, Stability AI
- **Required Environment Variables** (set in Netlify dashboard):
  - `REPLICATE_API_TOKEN` - Replicate API key
  - `OPENART_API_KEY` - OpenArt API key (optional)

**Art Styles Available**: realistic, fantasy, anime, oil_painting, cosmic

**Request Format**:
```javascript
{
    imageBase64: string,    // Base64 encoded creature image
    prompt: string,         // Generated prompt from creature traits
    style: string,          // Art style
    creatureData: object    // Creature metadata for prompt enhancement
}
```

## Code Splitting Architecture

The game uses Vite's code splitting to optimize load times and caching.

### Chunk Categories

| Chunk | Contents | Size (gzip) | When Loaded |
|-------|----------|-------------|-------------|
| **vendor-phaser** | Phaser.js | ~340 KB | Always (cached long-term) |
| **core** | Essential systems | ~81 KB | Always |
| **creature** | Creature systems | ~34 KB | Always |
| **onboarding** | Hatching flow scenes | ~32 KB | Always |
| **gameplay** | GameScene | ~42 KB | Always |
| **menus** | Shop, Inventory, etc. | ~25 KB | On demand |
| **levels** | Platformer levels | ~37 KB | On demand |
| **advanced** | Breeding, Fusion, etc. | ~25 KB | On demand |

### Configuration

Chunks are defined in `vite.config.js` using `manualChunks`:

```javascript
manualChunks: (id) => {
    if (id.includes('node_modules/phaser')) return 'vendor-phaser';
    if (id.includes('/systems/GameState')) return 'core';
    if (id.includes('/scenes/HatchingScene')) return 'onboarding';
    // ... etc
}
```

### SceneLoader Utility

`src/utils/SceneLoader.js` provides lazy scene loading capabilities:

```javascript
// Preload a scene chunk
await SceneLoader.preload('ShopScene');

// Load and start a scene
await SceneLoader.loadAndStart(game, 'ShopScene', data);

// Preload an entire chunk
SceneLoader.preloadChunk('menus');

// Preload anticipated scenes based on current location
SceneLoader.preloadAnticipated('HatchingScene');
```

### ChunkPreloader Utility

`src/utils/ChunkPreloader.js` provides intelligent idle-time preloading:

```javascript
// Preload chunks for a game phase
ChunkPreloader.preloadForPhase('gameplay');

// Preload all chunks during idle time
ChunkPreloader.preloadAllDuringIdle();
```

### Benefits

1. **Better Caching**: Phaser chunk changes rarely, stays cached
2. **Parallel Loading**: Multiple smaller files load faster
3. **Selective Invalidation**: Only changed chunks re-download on updates
4. **Future Lazy Loading**: Infrastructure ready for true lazy loading

## Service Worker & Caching

The game uses a smart service worker (`public/sw.js`) for offline capabilities:

- **Auto-versioning**: Cache name includes build timestamp (updates on each deployment)
- **Network-first for HTML**: Always fetches fresh HTML, falls back to cache
- **Cache-first for assets**: Static assets cached with fingerprinted URLs
- **Automatic cleanup**: Old caches deleted on activation

**Build Timestamp Injection**:
The `scripts/inject-build-timestamp.js` replaces `__BUILD_TIMESTAMP__` in sw.js during build.

## Deployment

- Production-ready configs for **Netlify** (`netlify.toml`) and **Vercel** (`vercel.json`)
- Security headers configured for OWASP compliance
- Health check endpoints: `/health`, `/readiness`, `/metrics`
- See DEPLOYMENT.md for detailed instructions
- **CRITICAL**: See `docs/DEPLOYMENT_LESSONS.md` for production incident learnings

## Key Development Notes (CRITICAL - READ FIRST)

1. **Never modify critical game flow sections** without running validation (`npm run validate-flow`)
2. **Always use GameState.set()** for state updates (don't mutate state directly)
3. **Create GraphicsEngine per scene** (not global singleton)
4. **Destroy graphics objects** after texture generation to prevent memory leaks
5. **Use dot notation** for GameState property access
6. **Check genetic trait structure** before rendering creatures
7. **Initialize systems in correct order** in main.js
8. **Use VITE_ prefix** for all environment variables exposed to browser
9. **ALWAYS implement proper shutdown()** cleanup - remove ALL event listeners, timers, and references
10. **ALWAYS use timer-based execution** for periodic tasks (NOT modulo checks in update loops)
11. **ALWAYS wrap debug code** in `if (import.meta.env.DEV)` checks
12. **ALWAYS show loading states** for async operations and transitions
13. **ALWAYS request confirmation** for expensive/destructive actions (threshold: 100+ coins)
14. **ALWAYS implement tutorial hints** for new features with state tracking
15. **ALWAYS provide visual AND audio feedback** for player actions

## Architectural Patterns (MUST FOLLOW)

The codebase follows these established patterns. **DO NOT reverse or break them**:

1. **Scene Lifecycle Pattern**: constructor → create → setupPeriodicTimers → shutdown
2. **Memory Management Pattern**: Track all listeners/timers/refs → clean up in shutdown
3. **Loading State Pattern**: showLoading → async operation → hideLoading (with try/catch)
4. **Confirmation Pattern**: Expensive actions (100+ coins) require user confirmation
5. **Tutorial Pattern**: Check seen state → show hint → mark seen → auto-dismiss
6. **Visual Feedback Pattern**: Floating text + particles + sound for major events
7. **Audio Integration Pattern**: Check success → switch on action type → play sound
8. **Tooltip Pattern**: Show on hover → position carefully → hide on hover out
9. **Sort/Filter Pattern**: State management → apply transformations → visual indicators

### Breaking Change Prevention

**BEFORE making changes to these areas, MUST:**
1. Run `npm run validate-flow` to check critical sections
2. Review this CLAUDE.md file for established patterns
3. Test memory cleanup (check console for cleanup logs)
4. Verify loading states work correctly
5. Test tutorial hints don't show for returning users
6. Confirm sounds play appropriately
7. Check confirmations trigger for expensive actions

**RED FLAGS** (indicates pattern violation):
- ❌ Adding console.log() without `devLog()` wrapper
- ❌ Using modulo checks in update() for periodic tasks
- ❌ Not implementing shutdown() cleanup
- ❌ Missing loading states for async operations
- ❌ No confirmation for actions over 100 coins
- ❌ Tutorial hints repeating for returning users
- ❌ Missing sound effects for player actions
- ❌ Event listeners not removed in shutdown()
- ❌ Debug graphics not wrapped in DEV check

## Architecture Diagram

```
main.js (entry point)
  └─> global-init.js (module loader)
       └─> Core Systems:
            ├─> ErrorHandler (error management)
            ├─> MemoryManager (resource tracking)
            ├─> GameState (state management)
            ├─> GraphicsEngine (sprite generation)
            ├─> InputValidator (input validation)
            └─> OnboardingManager (new user flow)
       └─> Creature Systems:
            ├─> CreatureGenetics (procedural genetics)
            ├─> CreatureDNA (DNA encoding)
            ├─> CreatureAI (AI behavior)
            ├─> CreatureAIController (chat behavior)
            ├─> CreatureAnimationController (idle animations)
            ├─> CreatureLifecycle (stage progression)
            ├─> CreatureSkills (abilities/skills)
            ├─> CreatureAgent (autonomous behavior)
            ├─> PersonalitySystem (personality shaping)
            ├─> BreedingEngine (breeding mechanics)
            └─> StageVisualResolver (stage-based rendering)
       └─> Game Systems:
            ├─> RaritySystem (weighted rarity)
            ├─> RerollSystem (reroll mechanics)
            ├─> CareSystem (creature care)
            ├─> AchievementSystem (achievements)
            ├─> TutorialSystem (guided tutorials)
            ├─> HatchCinematics (animation sequences)
            ├─> QuestManager (quest system)
            ├─> BossFightManager (boss encounters)
            ├─> CollectibleManager (collectible items)
            ├─> SecretAbilityManager (hidden abilities)
            ├─> SpaceWeatherSystem (NASA integration)
            └─> NASAContentSystem (space content)
       └─> Managers:
            ├─> EconomyManager (coins/currency)
            ├─> InventoryManager (items/inventory)
            ├─> EnemyManager (enemy spawning)
            ├─> ProjectileManager (projectiles)
            ├─> AudioManager (sound effects)
            ├─> ChatManager (chat system)
            └─> FeedbackManager (user feedback)
       └─> UI/UX Systems:
            ├─> UITheme (theming)
            ├─> UXEnhancements (loading states)
            ├─> ResponsiveManager (responsive design)
            ├─> MobileControls (touch controls)
            ├─> MobileHUD (mobile interface)
            ├─> FXLibrary (particle effects)
            ├─> ParallaxBiome (parallax backgrounds)
            ├─> ThoughtBubbleSystem (creature thoughts)
            ├─> ToastNotificationSystem (notifications)
            ├─> CarePanelManager (care UI)
            └─> KidMode (family-friendly mode)
       └─> World Systems:
            ├─> WorldBuilder (procedural worlds)
            └─> SanctuaryZones (safe zones)
       └─> Scenes:
            ├─> HatchingScene (egg hatching)
            ├─> PersonalityScene (personality selection)
            ├─> NamingScene (creature naming)
            ├─> SoulRevealScene (soul phrase reveal)
            ├─> GameScene (exploration gameplay)
            ├─> HubWorldScene (level hub)
            ├─> ShopScene (in-game shop)
            ├─> InventoryScene (inventory management)
            ├─> FusionPodScene (creature fusion)
            ├─> BreedingHatchScene (breeding hatching)
            ├─> CreatureProfileScene (creature details)
            ├─> AbilitySelectionScene (ability choice)
            ├─> AchievementMenuScene (achievements UI)
            └─> VoidMiniGameScene (mini-games)
       └─> Platformer Levels:
            ├─> PlatformerLevelScene (base class)
            ├─> CrystalCavesLevel (cave platformer)
            └─> ReefLevel (swimming level)
```

## Quick Reference: Code Quality Checklist

**Before committing ANY code, verify:**

### Memory & Performance ✅
- [ ] Implemented `shutdown()` method with ALL cleanup
- [ ] Removed ALL global event listeners (GameState, managers, etc.)
- [ ] Removed ALL keyboard event listeners
- [ ] Called `removeAllListeners()` on ALL zones/buttons
- [ ] Called `time.removeAllEvents()` to clear timers
- [ ] Nulled out all object references
- [ ] Used timer-based execution (NOT modulo checks)
- [ ] Wrapped debug code in `if (import.meta.env.DEV)`

### User Experience ✅
- [ ] Added loading state for async operations
- [ ] Added confirmation for actions >= 100 coins
- [ ] Implemented tutorial hints with state tracking
- [ ] Added visual feedback (animations, particles)
- [ ] Added audio feedback (sound effects)
- [ ] Implemented hover tooltips where needed
- [ ] Added sort/filter for data-heavy UIs

### Code Quality ✅
- [ ] Used `devLog()`/`devWarn()` instead of `console.log()`
- [ ] Production errors use `console.error()`
- [ ] Followed established naming conventions
- [ ] Added JSDoc comments for public methods
- [ ] No hardcoded magic numbers
- [ ] Proper error handling with try/catch

### Testing ✅
- [ ] Ran `npm run validate-flow` (if touching critical sections)
- [ ] Tested scene transitions work smoothly
- [ ] Verified memory cleanup (check console logs)
- [ ] Tested with localStorage cleared (new user experience)
- [ ] Verified tutorial hints work correctly
- [ ] Tested sounds play appropriately
- [ ] Checked confirmations trigger correctly

## Quick Reference: Common Tasks

### Adding a New Scene
```javascript
// 1. Create scene file: src/scenes/NewScene.js
export default class NewScene extends Phaser.Scene {
    constructor() {
        super({ key: 'NewScene' });
        this.eventListeners = [];
        this.timers = [];
    }

    create() {
        // Initialize UI
        // Set up event listeners
        this.setupPeriodicTimers();
    }

    setupPeriodicTimers() {
        this.time.addEvent({
            delay: 5000,
            callback: () => this.periodicTask(),
            loop: true
        });
    }

    shutdown() {
        // CRITICAL: Clean up everything
        if (window.GameState) {
            window.GameState.off('event', this.handler, this);
        }
        if (this.input?.keyboard) {
            this.input.keyboard.off('keydown-ESC');
        }
        this.time?.removeAllEvents();
        this.tweens?.killAll();
        // Null out references
    }
}

// 2. Register in src/global-init.js
// 3. Initialize in src/main.js
// 4. Add to scene flow documentation
```

### Adding a New Sound Effect
```javascript
// 1. In src/systems/AudioManager.js - generateCommonSounds()
this.createToneSequence('sound_name', [
    { frequency: 523.25, duration: 0.15, volume: 0.2 },
    { frequency: 659.25, duration: 0.15, volume: 0.2 }
]);

// 2. Add playback method
playSoundName() {
    this.playSound('sound_name');
}

// 3. Use in scenes
if (window.AudioManager) {
    window.AudioManager.playSoundName();
}
```

### Adding a New Tutorial
```javascript
// 1. Check if seen
hasSeenFeatureTutorial() {
    return window.GameState?.get('tutorial.featureName') || false;
}

// 2. Show tutorial
if (!this.hasSeenFeatureTutorial()) {
    this.showTutorialHint('💡 Learn about this feature!');
}

// 3. Mark as seen
window.GameState?.set('tutorial.featureName', true);
```

### Adding Visual Feedback
```javascript
// Floating text
this.showFloatingText(`+${amount}`, x, y, '#FFD700');

// Celebration with particles
if (window.FXLibrary) {
    window.FXLibrary.stardustBurst(this, x, y, {
        count: 20,
        color: [0xFFD700, 0xFFA500],
        duration: 2000
    });
}

// Sound effect
if (window.AudioManager) {
    window.AudioManager.playLevelUp();
}
```

## Git Workflow - CRITICAL

### NEVER Deploy Directly from Main

**All development work MUST happen on feature branches.** Main branch deploys automatically to production.

```bash
# Create feature branch BEFORE making changes
git checkout -b feature/my-feature

# Make changes, test locally
npm run dev
npm run build

# Push to feature branch (NOT main!)
git push -u origin feature/my-feature

# Create PR, test deploy preview, THEN merge to main
```

### Pre-Push Checklist

Before pushing ANY code changes:
1. [ ] `npm run dev` - Game loads without errors
2. [ ] `npm run build` - Production build succeeds
3. [ ] `npm run validate-flow` - Critical sections intact
4. [ ] Test creature rendering - Creatures appear with correct colors

## Color Handling - CRITICAL

### Always Use extractHexColor()

**NEVER** access colorGenome properties directly. Always use the safe extraction helper:

```javascript
// WRONG - Can crash if colorGenome has nested objects
const color = colorGenome.primary;

// CORRECT - Safe extraction with fallback
const color = this.extractHexColor(colorGenome.primary, 0x9370DB);
```

### colorGenome Must Be Plain Hex Numbers

```javascript
// CORRECT format - plain integers
{ primary: 0x9370DB, secondary: 0x8A2BE2, accent: 0xFFD700 }

// WRONG format - nested objects cause stack overflow
{ primary: { color: 0x9370DB, saturation: 0.8 } }  // NEVER DO THIS
```

## Netlify Deployment

### Required Build Configuration

```toml
[build.environment]
  NODE_VERSION = "20"           # Pin to LTS (Node 22 has npm bugs)
  NODE_ENV = "development"      # Allows devDependencies to install
```

### Build Command Must Delete Lock File

```toml
command = "rm -rf node_modules package-lock.json && npm install && npm run build"
```

This ensures Linux-specific optional dependencies are installed correctly.

### Minification

Use **esbuild** (Vite's default), NOT Terser. Terser's aggressive optimization breaks Phaser.

## Resources

- **Technical specs**: `docs/TECHNICAL_IMPLEMENTATION.md`
- **Testing guide**: `docs/TESTING.md`
- **Tuning guide**: `docs/TUNING_GUIDE.md`
- **Security docs**: `docs/SECURITY.md`
- **Deployment**: `docs/DEPLOYMENT.md`
- **Deployment lessons**: `docs/DEPLOYMENT_LESSONS.md` (CRITICAL - read before deploying!)
- **Color system**: `docs/COLOR_SYSTEM_ANALYSIS.md` (color variety, fallbacks, improvements)
- **Game flow**: `docs/GAME_FLOW_DOCUMENTATION.md`
- **Development guide**: `docs/DEVELOPMENT_GUIDE.md`
- **Future plans**: `docs/archive/planning/` (roadmaps, implementation plans)
- **Product requirements**: `prd.md`
