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

## Recent Implementation Work (Production-Stable Foundation)

### Phase 1-8 Enhancements (25 Tasks Completed)

The codebase has undergone comprehensive polish and stabilization work. **DO NOT reverse or break these patterns**:

#### Phase 1: Critical Bug Fixes
- ✅ **Debug graphics wrapped** in `import.meta.env.DEV` checks (GameScene.js)
- ✅ **GraphicsEngine methods added**: `addSoftGlow()`, `addGentleShimmer()` (GraphicsEngine.js:3262-3308)
- ✅ **Event listener cleanup** implemented in all scenes (GameScene, ShopScene, InventoryScene)
  - Pattern: Remove global listeners, keyboard listeners, zone listeners in `shutdown()`
  - Clear timers with `time.removeAllEvents()`
  - Null out all references

#### Phase 2: Performance Optimizations
- ✅ **Timer-based periodic execution** replaces modulo checks (GameScene.js:2844-2871)
  - `setupPeriodicTimers()` method pattern
  - `time.addEvent({ delay, callback, loop })` for achievements, tutorials
- ✅ **Development-only logging** via `devLogger.js` utility
  - `devLog()`, `devWarn()`, `devDebug()` functions
  - Production logs stripped automatically

#### Phase 3: Loading States
- ✅ **Loading overlay system** via UXEnhancements
  - `showLoading(message)` / `hideLoading()` pattern
  - Applied to: creature generation, shop transitions, inventory operations
- ✅ **Async operation wrapping** prevents perceived freezing

#### Phase 4: User Confirmations
- ✅ **Purchase confirmation dialog** (ShopScene.js:480-622)
  - Modal overlay pattern (depth 200+)
  - ESC key support for cancellation
  - Hover effects on buttons
- ✅ **Item use confirmation** for expensive items (InventoryScene.js:515-651)
  - Threshold: 100+ cosmic coins
  - Same modal pattern as purchases

#### Phase 5: Tutorial System
- ✅ **Tutorial state management** (GameState paths: `tutorial.*`)
  - `hasSeenTutorial()` / `markTutorialSeen()` pattern
  - Progressive hints (preHatch → hatching → postHatch)
- ✅ **Visual tutorial pointers** (HatchingScene.js:544-691)
  - Animated arrows pointing to interactive elements
  - Pulsing animations for emphasis
  - Auto-dismiss after completion
- ✅ **Reroll tutorial** with state tracking (HatchingScene.js:1738-1758)
- ✅ **Personality scene tutorial** (PersonalityScene.js:746-803)

#### Phase 6: Visual Feedback
- ✅ **Floating coin animations** (GameScene.js:1099-1151)
  - Spawn at player position with random offset
  - Float up with scale increase and fade out
- ✅ **Level up celebration** (GameScene.js:1157-1287)
  - Screen flash with golden tint
  - Particle bursts via FXLibrary.stardustBurst()
  - Animated level up text with scale/glow effects
  - Sound effect integration
- ✅ **Achievement unlock modal** (GameScene.js:1978-2137)
  - Full-screen dark overlay
  - Centered modal with achievement details
  - Particle effects and sound
  - Auto-dismiss with fade out
- ✅ **Stat warning indicators** (GameScene.js:3065-3167)
  - Dynamic icons: 🔴 critical (≤20%), 🟡 warning (≤40%), ✅ good (>40%)
  - Background color changes for critical stats
  - Pulsing animation for critical states

#### Phase 7: Sound Effects
- ✅ **Procedural sound effects** added to AudioManager (AudioManager.js:98-138)
  - `playLevelUp()` - 5-note triumphant fanfare
  - `playAchievement()` - Magical chime sequence
  - `playPet()` - Warm, gentle tone
  - `playFeed()` - Satisfying munch (3 notes)
  - `playPlay()` - Playful bounce (4 notes)
- ✅ **Sound integration** in GameScene (GameScene.js:2340-2353)
  - Care actions (pet, feed, play)
  - Level up events
  - Achievement unlocks

#### Phase 8: Polish & UX
- ✅ **Item tooltips** in ShopScene (ShopScene.js:630-682)
  - Hover to show detailed item information
  - Auto-positioning to prevent overflow
  - Clean up on hover out
- ✅ **Inventory sorting & filtering** (InventoryScene.js:105-278, 433-494)
  - Sort options: None, Name, Type, Price
  - Filter options: All, Food, Accessories, Consumables
  - Visual state indication (gold highlight for active)
  - Sound feedback on selection

### Critical Files Modified (DO NOT BREAK)

**GameScene.js** - Main gameplay scene
- Lines 477-489: Debug graphics wrapped in DEV check
- Lines 1099-1151: Floating coin animation system
- Lines 1157-1287: Level up celebration system
- Lines 1978-2137: Achievement modal system
- Lines 2340-2353: Care action sound integration
- Lines 2844-2871: Timer-based periodic execution
- Lines 3065-3167: Stat warning indicator system
- Lines 3308-3378: Comprehensive shutdown cleanup

**InventoryScene.js** - Inventory management
- Lines 17-22: Sort/filter state variables
- Lines 105-278: Sort/filter control UI
- Lines 433-494: Sort/filter logic
- Lines 515-651: Expensive item confirmation
- Lines 1071-1121: Enhanced shutdown cleanup

**ShopScene.js** - Shop interface
- Lines 480-622: Purchase confirmation dialog
- Lines 630-682: Item tooltip system
- Shutdown cleanup with event listener removal

**HatchingScene.js** - Egg hatching flow
- Lines 544-691: Tutorial system (progressive hints)
- Lines 1738-1758: Reroll tutorial
- Tutorial state tracking via GameState

**AudioManager.js** - Sound system
- Lines 98-138: New procedural sound effects
- Lines 202-232: New playback methods

**devLogger.js** (NEW) - Development logging utility
- `devLog()`, `devWarn()`, `devDebug()` functions
- Environment-aware logging

**GraphicsEngine.js** - Sprite generation
- Lines 3262-3308: `addSoftGlow()` and `addGentleShimmer()` methods

### Architectural Patterns Established (MUST FOLLOW)

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

## Resources

- **Game documentation**: See `*.md` files in root directory
- **Technical specs**: TECHNICAL_IMPLEMENTATION.md
- **MVP roadmap**: MVP_ROADMAP.md
- **Tuning guide**: TUNING_GUIDE.md
- **Security docs**: SECURITY.md
- **PRD phases**: PRD_PHASE_1_3.md
- **Implementation plan**: IMPLEMENTATION_PLAN.md (Phase 1-8 completed)
