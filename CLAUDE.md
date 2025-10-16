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

## Architecture Overview

### Module Loading System
The game uses a **centralized preload system** via `src/global-init.js`:
- All core systems and scenes are loaded via `Promise.all()` before game initialization
- The `preloadModulesReady` promise ensures all modules are available before Phaser starts
- Phaser is exported globally via `window.Phaser` for system compatibility

**Critical**: Systems are initialized in a specific order in `src/main.js`:
1. ErrorHandler → MemoryManager → UITheme
2. KidMode → HatchCinematics → FXLibrary → ParallaxBiome
3. RaritySystem → RerollSystem → CreatureGenetics
4. GameState → SafetyManager → GraphicsEngine → CreatureAI
5. Finally: All scenes (HatchingScene → PersonalityScene → NamingScene → GameScene)

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

### Scene Flow Architecture

**Critical game flow logic** (protected by validation script):

```
HatchingScene → PersonalityScene → NamingScene → GameScene
```

**Scene transition conditions** (DO NOT MODIFY without team review):
```javascript
// In HatchingScene.js - CRITICAL SECTION
if (!gameStarted) {
    // Show welcome screen with START button
} else if (gameStarted && !creatureHatched) {
    // Show hatching sequence
} else if (gameStarted && creatureHatched && !creatureNamed) {
    // Transition to PersonalityScene then NamingScene
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

### Scene Lifecycle Patterns

Each scene follows this structure:
```javascript
class Scene extends Phaser.Scene {
    constructor() {
        super({ key: 'SceneName' });
        this.graphicsEngine = null; // Create in create()
    }

    create() {
        this.graphicsEngine = new GraphicsEngine(this);
        // Initialize scene-specific state
        // Create UI and game objects
        // Set up event listeners
    }

    shutdown() {
        // Clean up resources
        if (this.graphicsEngine) {
            this.graphicsEngine = null;
        }
        // Remove event listeners
    }
}
```

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

## Performance Considerations

- **Texture generation**: Generate textures once in `create()`, reuse throughout scene lifecycle
- **Memory cleanup**: Always destroy graphics objects after texture generation
- **State updates**: Batch GameState updates when possible to reduce event overhead
- **Auto-save frequency**: Default 30s interval; adjust via `GameState.startAutoSave(ms)`

## Security & Safety

- Follows **Vibe Coding Playbook** security standards (see VIBE_CODING_COMPLIANCE.md)
- **SafetyManager** handles parental controls and kid profiles
- **Input validation** via InputValidator system
- **No hardcoded secrets** - use environment variables with VITE_ prefix
- **Audit logging** for sensitive operations (parental controls, data deletion)

## Deployment

- Production-ready configs for **Netlify** (`netlify.toml`) and **Vercel** (`vercel.json`)
- Security headers configured for OWASP compliance
- Health check endpoints: `/health`, `/readiness`, `/metrics`
- See DEPLOYMENT.md for detailed instructions

## Key Development Notes

1. **Never modify critical game flow sections** without running validation
2. **Always use GameState.set()** for state updates (don't mutate state directly)
3. **Create GraphicsEngine per scene** (not global singleton)
4. **Destroy graphics objects** after texture generation to prevent memory leaks
5. **Use dot notation** for GameState property access
6. **Check genetic trait structure** before rendering creatures
7. **Initialize systems in correct order** in main.js
8. **Use VITE_ prefix** for all environment variables exposed to browser

## Architecture Diagram

```
main.js (entry point)
  └─> global-init.js (module loader)
       └─> Systems:
            ├─> ErrorHandler (error management)
            ├─> MemoryManager (resource tracking)
            ├─> GameState (state management)
            ├─> GraphicsEngine (sprite generation)
            ├─> CreatureGenetics (procedural genetics)
            ├─> RaritySystem (weighted rarity)
            ├─> HatchCinematics (animation sequences)
            └─> SafetyManager (parental controls)
       └─> Scenes:
            ├─> HatchingScene (egg hatching)
            ├─> PersonalityScene (personality selection)
            ├─> NamingScene (creature naming)
            └─> GameScene (exploration gameplay)
```

## Resources

- **Game documentation**: See `*.md` files in root directory
- **Technical specs**: TECHNICAL_IMPLEMENTATION.md
- **MVP roadmap**: MVP_ROADMAP.md
- **Tuning guide**: TUNING_GUIDE.md
- **Security docs**: SECURITY.md
- **PRD phases**: PRD_PHASE_1_3.md
