# Testing Documentation

This document covers the testing strategy, existing tests, and required test coverage for the Mythical Void project.

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
- **Mocking**: Tests mock `window.Phaser` and `window.GameState` globally

## Current Test Coverage

### Existing Tests (3 systems)

| System | File | Coverage |
|--------|------|----------|
| GameState | `GameState.test.js` | Reset, events, listeners, care actions |
| HatchCinematics | `HatchCinematics.test.js` | Configuration, timeline, effects, telemetry |
| KidMode | `KidMode.test.js` | Enable/disable, emotion mapping, actions |

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
- Effect creation (crack, glow, particles, trait cards)
- Telemetry logging with timing offsets
- Total sequence duration validation (8-10 seconds)

#### KidMode.test.js
Tests the kid-friendly mode:
- Enable/disable functionality
- Emotion-to-action mapping (hungry→feed, sleepy→rest, etc.)
- Secondary action generation
- Configuration management
- Action data validation

---

## Required Test Coverage

### High Priority (Core Game Systems)

These systems are critical to gameplay and require comprehensive testing:

#### 1. CreatureGenetics.test.js
**System**: `src/systems/CreatureGenetics.js`

Tests needed:
- Genetic profile generation with valid structure
- Rarity distribution (common/uncommon/rare/epic/legendary)
- Cosmic affinity assignment (star/moon/nebula/crystal/void)
- Personality trait generation
- Color genome generation with primary/secondary/accent colors
- Body shape assignment with intensity
- Feature generation (eyes, wings, markings)
- Breeding/inheritance mechanics
- Pity system integration
- Edge cases: null inputs, missing config

#### 2. RaritySystem.test.js
**System**: `src/systems/RaritySystem.js`

Tests needed:
- Weighted random selection accuracy
- Pity system counter increments
- Guaranteed rarity after pity threshold
- Rarity tier probabilities match config
- Reset after guaranteed drop
- Configuration validation

#### 3. RerollSystem.test.js
**System**: `src/systems/RerollSystem.js`

Tests needed:
- Reroll availability check
- Reroll cost calculation
- Reroll execution and new genetics generation
- Reroll limit enforcement
- State persistence across sessions
- Cost escalation mechanics

#### 4. InventoryManager.test.js
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

| Priority | Target Coverage | Current | Gap |
|----------|----------------|---------|-----|
| High Priority Systems | 80%+ | ~10% | 70% |
| Medium Priority Systems | 60%+ | 0% | 60% |
| Lower Priority Systems | 40%+ | 0% | 40% |

**Next Steps**:
1. Implement tests for CreatureGenetics (most critical)
2. Implement tests for RaritySystem and RerollSystem
3. Implement tests for InventoryManager and EconomyManager
4. Gradually increase coverage for remaining systems

---

## Continuous Integration

Consider adding CI/CD test automation:
- Run `npm run test:unit` on every PR
- Run `npm run validate-flow` on every PR
- Block merges if tests fail
- Generate coverage reports
