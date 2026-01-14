# Testing Documentation

This document covers the testing strategy, existing tests, and required test coverage for the Mythical Void project.

**Last Updated**: January 2026

## Test Summary

- **Total Tests**: 152 passing
- **Test Suites**: 6
- **Test Runner**: Jest

## Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npm run test:unit -- --testPathPattern=GameState

# Run tests in watch mode
npm run test:unit -- --watch

# Run with coverage report
npm run test:unit -- --coverage

# Manual test framework (browser-based)
npm test
# Opens http://localhost:8080/test-framework.html

# Validate critical game flow (pre-commit hook)
npm run validate-flow
```

## Test Configuration

- **Framework**: Jest
- **Config**: `jest.config.cjs`
- **Test Location**: `src/__tests__/`
- **Mocking**: Tests mock `global.Phaser`, `global.window`, and `window.GameState`

## Current Test Coverage

### Existing Tests (6 systems)

| System | File | Tests | Status |
|--------|------|-------|--------|
| GameState | `GameState.test.js` | Reset, events, listeners, care actions | Passing |
| HatchCinematics | `HatchCinematics.test.js` | Configuration, timeline, effects, telemetry | Passing |
| KidMode | `KidMode.test.js` | Enable/disable, emotion mapping, actions | Passing |
| CreatureGenetics | `CreatureGenetics.test.js` | Genetic profiles, traits, breeding (49 tests) | Passing |
| RaritySystem | `RaritySystem.test.js` | Rarity rolls, pity system, colors | Passing |
| RerollSystem | `RerollSystem.test.js` | Reroll mechanics, history tracking | Passing |

### Test Details

#### GameState.test.js
Tests the core state management system:
- `reset()` restores default creature state and clears localStorage
- Event listener cleanup via disposer and `off()`
- `once()` listeners fire only once
- `performCareAction()` applies happiness bonuses correctly

#### HatchCinematics.test.js
Tests the hatching animation system:
- Default configuration initialization
- Custom configuration acceptance
- Timeline construction with correct beat sequence
- Cumulative timing calculations
- Effect creation (cosmic crack, nebula glow, stardust particles, trait cards)
- Telemetry logging with timing offsets
- Total sequence duration validation (5-12 seconds)

#### KidMode.test.js
Tests the kid-friendly mode:
- Enable/disable functionality
- Emotion-to-action mapping (hungry→feed, sleepy→rest, etc.)
- Secondary action generation
- Configuration management
- Action data validation

#### CreatureGenetics.test.js
Tests the genetic system (49 tests):
- Initialization with 7 species templates
- Personality traits (5 types)
- Cosmic affinities (5 types)
- Rarity weight validation
- Genetic profile generation
- Color genome generation
- Body shape and features
- Breeding data and lineage
- Telemetry events
- System statistics

#### RaritySystem.test.js
Tests the rarity mechanics:
- Rarity tier definitions and probabilities
- Pity system initialization and threshold
- Weighted random selection
- Color generation per rarity
- Guaranteed rarity after pity threshold
- Statistics calculation

#### RerollSystem.test.js
Tests the reroll mechanics:
- Session management (start/end)
- Reroll availability checks
- Reroll execution
- Creature replacement tracking
- Reroll history and statistics
- Success rate calculations
- Reroll advice based on rarity

---

## Test Gaps - Priority Matrix

### High Priority (Core Mechanics)

These systems are critical but lack tests:

| System | Complexity | Impact | Suggested Tests |
|--------|------------|--------|-----------------|
| **MobileControls** | High | Critical | Touch detection, joystick tracking, button actions |
| **EconomyManager** | Medium | High | Coin transactions, balance checks, purchase validation |
| **InventoryManager** | Medium | High | Item storage, usage, egg management |
| **AudioManager** | High | Medium | Sound generation, volume control, mute state |
| **BreedingEngine** | High | High | Genetic inheritance, compatibility, offspring generation |

### Medium Priority (Gameplay Features)

| System | Suggested Tests |
|--------|-----------------|
| CareSystem | Daily care actions, happiness calculations, cooldowns |
| EnemyManager | Enemy spawning, AI behavior, damage dealing |
| ProjectileManager | Projectile creation, collision detection |
| BossFightManager | Boss phases, attack patterns, rewards |
| CollectibleManager | Collectible spawning, collection tracking |
| CreatureLifecycle | Stage progression, aging system |
| CreatureSkills | Skill unlocking, cooldowns, effects |

### Lower Priority (Supporting Systems)

| System | Suggested Tests |
|--------|-----------------|
| CreatureAI | Behavior trees, state transitions |
| CreatureAIController | Chat responses, personality-based behavior |
| CreatureAnimationController | Animation states, transitions |
| PersonalitySystem | Personality generation, trait mixing |
| ParallaxBiome | Layer management, scrolling |
| FXLibrary | Particle systems, visual effects |
| GraphicsEngine | Sprite generation, texture management |

### Scene Testing (None Currently)

| Scene | Priority | Test Focus |
|-------|----------|------------|
| HatchingScene | High | State transitions, creature generation flow |
| PersonalityScene | High | Personality selection, scene transitions |
| NamingScene | High | Name validation, save flow |
| GameScene | High | Core gameplay loop, UI interactions |
| PlatformerLevelScene | Medium | Physics, platform mechanics, boss fights |
| ShopScene | Medium | Purchase flow, item display |
| InventoryScene | Medium | Item display, usage actions |

---

## Required Test Coverage (Updated)

### Remaining High Priority Systems

#### 1. InventoryManager.test.js
**System**: `src/systems/InventoryManager.js`

Tests needed:
- Add item to inventory
- Remove item from inventory
- Get item by ID
- Check item quantity
- Stack management for stackable items
- Inventory capacity limits
- Item use and consumption
- Event emission (itemAdded, itemRemoved, itemUsed)
- Save/load inventory state
- Edge cases: duplicate items, invalid IDs

#### 5. EconomyManager.test.js
**System**: `src/systems/EconomyManager.js`

Tests needed:
- Add/remove currency (cosmic coins)
- Check sufficient funds
- Purchase validation
- Transaction history
- Currency overflow protection
- Event emission (currencyChanged, purchaseComplete)
- Save/load economy state

#### 6. CareSystem.test.js
**System**: `src/systems/CareSystem.js`

Tests needed:
- Care action execution (feed, pet, play)
- Cooldown management
- Stat modifications (hunger, happiness, energy)
- Action availability checks
- Streak tracking
- XP rewards from care actions
- Event emission

#### 7. AchievementSystem.test.js
**System**: `src/systems/AchievementSystem.js`

Tests needed:
- Achievement unlock conditions
- Progress tracking
- Reward distribution
- Achievement state persistence
- Event emission (achievementUnlocked)
- Multiple achievement types

### Medium Priority (Gameplay Support)

#### 8. SafetyManager.test.js
**System**: `src/systems/SafetyManager.js`

Tests needed:
- Parental controls initialization
- Content filtering
- Age-appropriate content checks
- Settings persistence
- Audit logging for sensitive operations

#### 9. AudioManager.test.js
**System**: `src/systems/AudioManager.js`

Tests needed:
- Sound effect playback
- Mute/unmute functionality
- Volume controls (master, SFX, music)
- Sound generation (Web Audio API)
- Error handling for audio context issues

#### 10. PersonalitySystem.test.js
**System**: `src/systems/PersonalitySystem.js`

Tests needed:
- Personality trait assignment
- Trait-based behavior modifiers
- Personality influence on stats
- Personality persistence

#### 11. InputValidator.test.js
**System**: `src/systems/InputValidator.js`

Tests needed:
- Text input validation (creature names)
- Character limits
- Profanity filtering
- Special character handling
- SQL/XSS injection prevention

#### 12. BreedingEngine.test.js
**System**: `src/systems/BreedingEngine.js`

Tests needed:
- Parent genetics combination
- Dominant/recessive trait inheritance
- Mutation chances
- Offspring rarity calculation
- Breeding compatibility checks

### Lower Priority (Infrastructure)

#### 13. ErrorHandler.test.js
Tests needed:
- Error capture and logging
- Severity levels (info, warning, error)
- Error event emission
- Stack trace handling

#### 14. MemoryManager.test.js
Tests needed:
- Resource tracking
- Cleanup triggers
- Memory threshold warnings

#### 15. TutorialSystem.test.js
Tests needed:
- Tutorial state management
- Step progression
- Completion tracking

---

## Test Writing Guidelines

### Mocking Phaser

All tests need to mock Phaser since it's a browser-only library:

```javascript
const createPhaserStub = () => ({
    Math: {
        Between: (min, max) => min,
        FloatBetween: (min, max) => min
    },
    Display: {
        Color: {
            ValueToColor: () => ({ r: 255, g: 255, b: 255 }),
            GetColor: (r, g, b) => (r << 16) | (g << 8) | b
        }
    },
    BlendModes: { ADD: 'ADD' }
});

global.window = {
    GameState: {
        emit: jest.fn(),
        get: jest.fn(),
        set: jest.fn()
    },
    Phaser: createPhaserStub()
};
```

### Test Structure

```javascript
const SystemName = require('../systems/SystemName.js');

describe('SystemName', () => {
    let system;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        localStorage.clear();

        // Initialize system
        system = new SystemName();
        system.initialize();
    });

    afterEach(() => {
        // Cleanup
        system.cleanup?.();
    });

    describe('Feature Group', () => {
        test('should do specific thing', () => {
            // Arrange
            const input = { ... };

            // Act
            const result = system.method(input);

            // Assert
            expect(result).toBeDefined();
            expect(result.property).toBe(expectedValue);
        });
    });
});
```

### Assertions Best Practices

- Test both success and failure cases
- Verify event emissions with `expect(spy).toHaveBeenCalledWith()`
- Check state mutations via `GameState.set` calls
- Validate edge cases (null, undefined, empty arrays)
- Test configuration overrides

---

## Manual Test Framework

The manual test framework (`test-framework.html`) provides browser-based testing for:
- Visual verification of creature rendering
- Scene transitions
- UI interactions
- Audio playback
- Performance monitoring

Start it with:
```bash
npm test
```

Then open http://localhost:8080/test-framework.html

---

## Game Flow Validation

The `npm run validate-flow` script checks critical code sections haven't been accidentally modified:
- HatchingScene scene flow logic
- GameState save/load methods
- KidMode core functions
- HatchCinematics system functions

Run this before committing changes to these protected areas.

---

## Test Coverage Goals

| Category | Systems Tested | Total Systems | Coverage |
|----------|----------------|---------------|----------|
| Core Systems | 6 | 48 | 12.5% |
| Scenes | 0 | 14 | 0% |

| Priority | Target Coverage | Current | Gap |
|----------|----------------|---------|-----|
| High Priority Systems | 80%+ | ~25% | 55% |
| Medium Priority Systems | 60%+ | 0% | 60% |
| Lower Priority Systems | 40%+ | 0% | 40% |

**Completed**:
- [x] GameState tests
- [x] HatchCinematics tests
- [x] KidMode tests
- [x] CreatureGenetics tests (49 tests)
- [x] RaritySystem tests
- [x] RerollSystem tests

**Next Steps**:
1. Implement MobileControls tests (critical for mobile gameplay)
2. Implement EconomyManager tests (transactions)
3. Implement InventoryManager tests (item management)
4. Implement BreedingEngine tests (complex genetics)
5. Add scene integration tests

---

## Continuous Integration

Consider adding CI/CD test automation:
- Run `npm run test:unit` on every PR
- Run `npm run validate-flow` on every PR
- Block merges if tests fail
- Generate coverage reports
