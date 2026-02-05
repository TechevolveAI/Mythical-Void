# PRD: Pre-Launch Polish Pass
## Mythical Void - Comprehensive UX & Gameplay Improvements

**Version:** 1.0
**Date:** February 2026
**Author:** TechevolveAI Development Team

---

## Executive Summary

This PRD outlines prioritized improvements for Mythical Void's pre-launch polish. Based on deep codebase analysis, this document addresses:

1. **Mobile Responsiveness** - Screen optimization and control placement
2. **UI/UX Improvements** - Stat bar interactivity and top bar enhancements
3. **Combat System** - Weapon variety and unlimited ammo
4. **Shop Integration** - Combat items and power-ups

---

## Current State Analysis

### Mobile Controls (PlatformerLevelScene)
**Status: Well-implemented but room for optimization**

Current implementation:
- **Joystick**: Left side, 140px diameter, floating (follows touch)
- **Action Buttons**: Right side in arc layout
  - Jump (100px, green, bottom-center)
  - Melee (56px, red, free to use)
  - Ranged (48px, cyan, costs 1 energy)
  - Special (48px, purple, costs 3 energy)
- **Control Zone**: 120px height at bottom with semi-transparent background
- **Menu Button**: Top-left corner (50px)

**Issues Found:**
- Control zone background may obscure lower gameplay area
- Button opacity at 0.65 could be increased for visibility
- No visual feedback for energy costs on buttons

### Stats/HUD (MobileHUD.js)
**Status: Feature-rich but potentially overcrowded**

Current top bar elements:
- Level + XP bar (left side)
- Stage indicator (baby/juvenile/adult/elder)
- Coins display
- Streak counter
- Daily surprise gift box
- Mini stat indicators (health/happiness/energy)

**Potential Issues:**
- Top bar height: 44px (may feel cramped on small screens)
- Many elements competing for horizontal space
- Stat bar interactivity unknown (may need investigation)

### Combat System (PlatformerLevelScene)
**Current mechanics:**
- Crystal Energy: 5 max
- Player Health: 4 max
- **Melee**: Free, 1 damage, 70px range
- **Ranged**: 1 energy, 1 damage, projectile
- **Special**: 3 energy, AoE damage (300px radius)

**Key Finding: Energy limits shooting, NOT unlimited**

### Shop System (ShopScene.js)
**Current categories:**
1. **Eggs** - Cosmic (250), Stellar (1000)
2. **Food** - Stat boosters (20-50 coins)
3. **Utilities** - Maps and decorations (150-4000 coins)

**Key Finding: NO combat items exist!**

---

## Prioritized Requirements

### Priority 1: Critical (Must-Have Before Launch)

#### P1.1: Stat Bar Interactivity Investigation
**Problem:** User reports stat bar sometimes non-interactable in sanctuary
**Action:** Investigate GameScene stat bar z-depth and touch detection
**Files:** `src/scenes/GameScene.js`, `src/systems/ui/CarePanelManager.js`
**Effort:** Small (2-4 hours)

#### P1.2: Unlimited Basic Ammo
**Problem:** Energy limits make combat frustrating for kids
**Solution:** Make melee and basic ranged unlimited, special still costs energy
**Changes:**
```javascript
// PlatformerLevelScene.js performRangedAttack()
// Remove energy cost for basic ranged
// Keep special attack at 3 energy cost
```
**Files:** `src/scenes/PlatformerLevelScene.js`
**Effort:** Small (1-2 hours)

#### P1.3: Ship Parts Display in Top Bar
**Problem:** Players don't know their progress toward final boss
**Solution:** Add ship parts indicator (X/5) to top bar
**Design:** Cosmic flame/portal icon with count
**Files:** `src/systems/ui/MobileHUD.js`, `src/scenes/GameScene.js`
**Effort:** Medium (4-6 hours)

---

### Priority 2: High (Should-Have)

#### P2.1: Combat Item Shop Category
**Problem:** No way to upgrade combat abilities
**Solution:** Add "Power-ups" category to shop

**Proposed Items:**
```javascript
powerups: [
    {
        id: 'energy_boost',
        name: 'Crystal Energy +3',
        description: 'Restore 3 crystal energy during levels',
        icon: '⚡',
        price: 50,
        type: 'consumable',
        effect: { crystalEnergy: 3 },
        usableInLevel: true
    },
    {
        id: 'power_shot',
        name: 'Power Shot',
        description: 'Next ranged attack does 3x damage (one-shot kills!)',
        icon: '🎯',
        price: 75,
        type: 'consumable',
        effect: { nextRangedDamage: 3 },
        usableInLevel: true
    },
    {
        id: 'shield_crystal',
        name: 'Shield Crystal',
        description: 'Block the next hit you take',
        icon: '🛡️',
        price: 100,
        type: 'consumable',
        effect: { shieldHits: 1 },
        usableInLevel: true
    },
    {
        id: 'super_blast',
        name: 'Super Blast',
        description: 'FREE special attack (normally costs 3 energy)',
        icon: '💥',
        price: 150,
        type: 'consumable',
        effect: { freeSpecialAttack: 1 },
        usableInLevel: true
    }
]
```
**Files:** `src/scenes/ShopScene.js`, `src/systems/InventoryManager.js`
**Effort:** Medium (6-8 hours)

#### P2.2: Weapon Damage Tuning
**Problem:** Takes too many hits to kill enemies
**Current:** All attacks do 1 damage, enemies have varying health
**Proposed:**
- **Melee**: 2 damage (was 1) - reward close combat risk
- **Ranged**: 1 damage (unchanged) - safe but slower
- **Special**: 4 damage (was unspecified) - powerful AoE

**Files:** `src/scenes/PlatformerLevelScene.js`
**Effort:** Small (1-2 hours)

#### P2.3: Daily Streak Visual Enhancement
**Problem:** Current streak display is plain numbers
**Solution:** Add cosmic flame/portal animation effect
**Design:**
- Day 1-2: Single blue-green flame
- Day 3-6: Double flame, subtle glow
- Day 7+: Triple flame with portal swirl, pulsing animation
- Day 14+: Rainbow cosmic effect

**Files:** `src/systems/ui/MobileHUD.js`
**Effort:** Medium (4-6 hours)

---

### Priority 3: Medium (Nice-to-Have)

#### P3.1: Screen Space Optimization
**Problem:** Controls may cover too much gameplay area
**Analysis:**
- Current control zone: 120px + safe area
- Total bottom coverage: ~140-180px depending on device

**Proposed Changes:**
1. Reduce control zone height to 100px
2. Make control background 40% opacity (was 65%)
3. Add toggle to hide controls briefly when jumping
4. Ensure platforms don't spawn in bottom 150px

**Files:** `src/scenes/PlatformerLevelScene.js`
**Effort:** Medium (4-6 hours)

#### P3.2: Weapon Type System
**Problem:** All weapons feel the same
**Solution:** Add distinct weapon behaviors via shop unlocks

**Proposed Weapons (Future):**
```javascript
weapons: [
    {
        id: 'rapid_blaster',
        name: 'Rapid Blaster',
        description: 'Faster fire rate, lower damage',
        icon: '🔫',
        price: 500,
        type: 'weapon',
        stats: { fireRate: 2x, damage: 0.5x }
    },
    {
        id: 'crystal_cannon',
        name: 'Crystal Cannon',
        description: 'Slow but powerful shots',
        icon: '💎',
        price: 750,
        type: 'weapon',
        stats: { fireRate: 0.5x, damage: 3x }
    },
    {
        id: 'spread_shot',
        name: 'Spread Shot',
        description: 'Fires 3 projectiles in a cone',
        icon: '🌟',
        price: 1000,
        type: 'weapon',
        stats: { projectiles: 3, damage: 0.7x }
    }
]
```
**Files:** `src/scenes/ShopScene.js`, `src/scenes/PlatformerLevelScene.js`, `src/systems/InventoryManager.js`
**Effort:** Large (12-16 hours)
**Note:** Consider for v1.1 post-launch

#### P3.3: Enemy Variety Balance
**Problem:** Some enemies may be too tanky
**Proposed Health Values:**
- Basic enemies: 2-3 HP (2-3 hits to kill)
- Medium enemies: 4-5 HP
- Boss adds: 3 HP
- Mini-bosses: 10 HP
- Full bosses: 20-30 HP

**Files:** Individual level files
**Effort:** Medium (4-6 hours)

---

### Priority 4: Low (Post-Launch)

#### P4.1: Sanctuary Combat Mode
**Problem:** User wants friendly combat in sanctuary
**Solution:** Add training dummy or friendly sparring mode
**Concept:**
- Training dummy that respawns
- Rewards coins for hitting combos
- No creature damage, just practice

**Effort:** Large (16+ hours)

#### P4.2: Advanced Weapon System
- Weapon equipping/switching
- Upgrade paths per weapon
- Weapon-specific abilities

**Effort:** Extra Large (40+ hours)

---

## Implementation Order

### Phase 1: Quick Wins (This Session)
1. ✅ P1.2: Unlimited basic ammo
2. ✅ P2.2: Weapon damage tuning
3. 🔍 P1.1: Stat bar investigation

### Phase 2: Core Enhancements (Next Session)
4. P1.3: Ship parts in top bar
5. P2.1: Combat item shop category
6. P2.3: Daily streak visuals

### Phase 3: Polish (Pre-Launch)
7. P3.1: Screen space optimization
8. P3.3: Enemy balance pass

### Phase 4: Post-Launch
9. P3.2: Weapon type system
10. P4.1: Sanctuary combat
11. P4.2: Advanced weapon system

---

## Technical Implementation Notes

### Unlimited Ammo Implementation
```javascript
// In PlatformerLevelScene.js

performRangedAttack() {
    // REMOVED: Energy cost check
    // if (this.crystalEnergy < 1) { ... }

    // REMOVED: Energy deduction
    // this.crystalEnergy -= 1;

    // Keep all other logic the same
    console.log('[PlatformerLevel] Ranged attack performed (unlimited ammo)');
    // ... rest of projectile creation
}
```

### Shop Category Addition
```javascript
// In ShopScene.js initializeShopItems()

this.shopItems = {
    eggs: [...],
    food: [...],
    powerups: [  // NEW CATEGORY
        { id: 'energy_boost', ... },
        { id: 'power_shot', ... },
        { id: 'shield_crystal', ... },
        { id: 'super_blast', ... }
    ],
    utilities: [...]
};
```

### Top Bar Ship Parts Display
```javascript
// In MobileHUD.js createTopBar()

createShipPartsIndicator() {
    const shipParts = window.GameState?.get('hubWorld.shipParts');
    const collected = shipParts?.collected?.length || 0;

    // Cosmic flame icon
    const flame = this.scene.add.text(x, y, '🔥', { fontSize: '16px' });
    flame.setTint(0x00CED1); // Cyan-green cosmic color

    // Count text
    const count = this.scene.add.text(x + 20, y, `${collected}/5`, {
        fontSize: '12px',
        color: '#FFD700'
    });

    // Pulse animation for progress
    if (collected > 0) {
        this.scene.tweens.add({
            targets: flame,
            scale: { from: 1, to: 1.2 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
    }
}
```

---

## Success Metrics

1. **Combat Feel**: Players should feel powerful, killing basic enemies in 2-3 hits
2. **Mobile UX**: 95%+ of screen visible during gameplay
3. **Progression Clarity**: Ship parts progress always visible
4. **Shop Usage**: Combat items purchased by 30%+ of players

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Unlimited ammo too easy | Medium | Keep special attack energy cost, tune enemy health up |
| Shop bloat | Low | Clear category organization, hide advanced items initially |
| Mobile control overlap | High | Extensive device testing, adjustable control positions |
| Breaking existing saves | High | Migration functions in GameState, backward compatibility |

---

## Appendix A: Boss Fight Enhancement Research

Based on analysis of successful indie games (2024-2025), here are recommended boss fight enhancements:

### Core Principles (From Industry Research)

1. **Visual Telegraphs** - Every dangerous attack should have a visible/audible warning
2. **Glowing Weak Points** - Make vulnerabilities obvious, especially for kids
3. **Multi-Phase Design** - 2-3 phases that build on previous mechanics
4. **Teaching Through Combat** - Each phase teaches a skill needed for the next
5. **Fair Difficulty** - Challenging but never frustrating (Kirby-style for family games)

### Recommended Enhancements

#### P5.1: Attack Telegraph System (High Priority)
**Current State:** Bosses attack without warning
**Enhancement:** Add visual indicators before dangerous attacks

```javascript
// Boss telegraph pattern
showAttackWarning(attackType) {
    // Warning indicator (red flash + icon)
    const warning = this.add.graphics();
    warning.fillStyle(0xFF0000, 0.3);
    warning.fillCircle(this.boss.x, this.boss.y, 100);

    // Attack type icon
    const icon = this.add.text(this.boss.x, this.boss.y - 80, '⚠️', {
        fontSize: '32px'
    }).setOrigin(0.5);

    // Flash then attack
    this.tweens.add({
        targets: [warning, icon],
        alpha: { from: 1, to: 0 },
        duration: 800,
        yoyo: true,
        repeat: 2,
        onComplete: () => this.executeAttack(attackType)
    });
}
```
**Effort:** Small (2-3 hours per boss)

#### P5.2: Glowing Weak Points
**Enhancement:** Make boss vulnerable spots pulse/glow when hittable

```javascript
// Weak point visual
highlightWeakPoint(x, y) {
    const glow = this.add.graphics();
    glow.fillStyle(0xFFD700, 0.6);
    glow.fillCircle(x, y, 30);

    this.tweens.add({
        targets: glow,
        scaleX: { from: 1, to: 1.5 },
        scaleY: { from: 1, to: 1.5 },
        alpha: { from: 0.6, to: 0.2 },
        duration: 500,
        yoyo: true,
        repeat: -1
    });

    return glow;
}
```
**Effort:** Small (1-2 hours per boss)

#### P5.3: Phase Transitions (Medium Priority)
**Enhancement:** Add dramatic transitions between boss phases

- Screen flash + shake
- Boss transformation animation
- "Phase 2!" text overlay
- Music intensity change
- New attack unlocked message

**Effort:** Medium (4-6 hours)

#### P5.4: Victory Celebration
**Enhancement:** Dramatic boss defeat sequence

- Slow-motion final hit
- Explosion particles
- Creature victory animation
- Coin/reward fountain
- Achievement popup

**Effort:** Medium (4-6 hours)

#### P5.5: Combo System (Nice-to-Have)
**Enhancement:** Reward consecutive hits without taking damage

- Combo counter display (x2, x3, x4...)
- Bonus damage at high combos
- Bonus coins at combo milestones
- Visual flair (screen shake, particles)

**Effort:** Medium (6-8 hours)

### Kid-Friendly Considerations

Based on Kirby game design philosophy:
- Bosses should be beatable in 5-10 attempts max
- Clear visual language (red = danger, gold = hit here)
- Encourage experimentation over memorization
- Reward all progress (partial health rewards)
- No "gotcha" mechanics or instant deaths

### Reference Games

| Game | What to Learn |
|------|---------------|
| **Kirby** | Family-friendly difficulty, generous hitboxes |
| **Cuphead** | Clear telegraphs, pattern recognition |
| **Hollow Knight** | Fair challenge, satisfying feedback |
| **Undertale/Deltarune** | Story through combat, unique mechanics per boss |
| **Hades** | Phase variety, dramatic moments |

---

## Appendix B: File Reference

| Feature | Primary Files |
|---------|---------------|
| Combat | `src/scenes/PlatformerLevelScene.js` |
| Shop | `src/scenes/ShopScene.js` |
| Inventory | `src/systems/InventoryManager.js` |
| Mobile HUD | `src/systems/ui/MobileHUD.js` |
| Stat Bar | `src/scenes/GameScene.js`, `src/systems/ui/CarePanelManager.js` |
| Game State | `src/systems/GameState.js` |
| Boss Fights | `src/scenes/levels/*.js` |

---

## Appendix C: Research Sources

- [Boss Design: How to Make an Unforgettable Boss Battle](https://gamedesignskills.com/game-design/game-boss-design/)
- [Boss Battle Design and Structure](https://www.gamedeveloper.com/design/boss-battle-design-and-structure)
- [10 Best Boss Fights In Indie Games](https://www.dualshockers.com/best-indie-game-boss-fights/)
- [7 Essential Ingredients for an Unforgettable Boss Battle](https://mentalblockgaming.com/blog/game-design/boss-fights)
