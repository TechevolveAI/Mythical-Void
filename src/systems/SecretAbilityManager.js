/**
 * SecretAbilityManager - Makes secret abilities functional in gameplay
 *
 * Ability Categories:
 * - Combat: Affect damage, defense, attacks
 * - Utility: Reveal items, movement speed
 * - Passive: XP bonuses, stat multipliers
 *
 * Inspired by: Pokemon abilities, Diablo skills, roguelite powerups
 */

class SecretAbilityManager {
    constructor() {
        this.activeAbilities = [];
        this.abilityEffects = {};
        this.cooldowns = {};
        this.scene = null;

        // Visual indicators for active abilities
        this.abilityIndicators = [];

        // Ability implementations
        this.abilityHandlers = {
            // === COMBAT ABILITIES ===
            voidStrike: {
                type: 'combat',
                apply: (creature) => {
                    this.abilityEffects.damageMultiplier = (this.abilityEffects.damageMultiplier || 1) * 1.5;
                    this.abilityEffects.ignoreDefense = true;
                    return { damageBonus: 0.5, ignoreDefense: true };
                },
                getDescription: () => '+50% damage, ignores enemy defense'
            },

            crystalShield: {
                type: 'combat',
                cooldown: 30000, // 30 seconds
                duration: 3000, // 3 seconds active
                apply: (creature, scene) => {
                    if (this.isOnCooldown('crystalShield')) return null;

                    this.startCooldown('crystalShield', 30000);
                    this.abilityEffects.shieldActive = true;
                    this.abilityEffects.shieldAbsorb = 50;

                    // Visual effect
                    if (scene && creature) {
                        this.showShieldEffect(scene, creature);
                    }

                    // Auto-deactivate after duration
                    setTimeout(() => {
                        this.abilityEffects.shieldActive = false;
                        this.abilityEffects.shieldAbsorb = 0;
                    }, 3000);

                    return { shieldActive: true, absorb: 50 };
                },
                getDescription: () => 'Temporary shield absorbs 50 damage (30s cooldown)'
            },

            novaBlast: {
                type: 'combat',
                cooldown: 15000, // 15 seconds
                apply: (creature, scene, targetX, targetY) => {
                    if (this.isOnCooldown('novaBlast')) return null;

                    this.startCooldown('novaBlast', 15000);

                    // AOE damage effect
                    if (scene && window.EnemyManager) {
                        const enemies = window.EnemyManager.getEnemiesInRadius?.(targetX, targetY, 150) || [];
                        enemies.forEach(enemy => {
                            const damage = 30 * (this.abilityEffects.damageMultiplier || 1);
                            window.EnemyManager.damageEnemy?.(enemy, damage);
                        });

                        // Visual nova explosion
                        this.showNovaEffect(scene, targetX, targetY);
                    }

                    return { aoeTriggered: true, radius: 150, damage: 30 };
                },
                getDescription: () => 'AOE blast hits all enemies in radius (15s cooldown)'
            },

            // === UTILITY ABILITIES ===
            treasureScent: {
                type: 'utility',
                apply: (creature, scene) => {
                    this.abilityEffects.treasureRevealRange = 200;
                    this.abilityEffects.showHiddenItems = true;

                    // Reveal nearby collectibles
                    if (scene && window.CollectibleManager) {
                        window.CollectibleManager.revealHiddenInRange?.(
                            creature?.x || 0,
                            creature?.y || 0,
                            200
                        );
                    }

                    return { revealRange: 200 };
                },
                getDescription: () => 'Reveals hidden items within 200px'
            },

            swiftPaws: {
                type: 'utility',
                apply: (creature) => {
                    this.abilityEffects.speedBonus = (this.abilityEffects.speedBonus || 0) + 0.25;
                    return { speedBonus: 0.25 };
                },
                getDescription: () => '+25% movement speed'
            },

            gentleAura: {
                type: 'utility',
                apply: (creature) => {
                    this.abilityEffects.healingBonus = (this.abilityEffects.healingBonus || 0) + 0.5;
                    this.abilityEffects.auraRange = 100;
                    return { healingBonus: 0.5, range: 100 };
                },
                getDescription: () => '+50% healing effectiveness'
            },

            // === PASSIVE ABILITIES ===
            cosmicResonance: {
                type: 'passive',
                apply: (creature) => {
                    // Double XP when in matching affinity biome
                    this.abilityEffects.xpMultiplier = 2.0;
                    return { xpMultiplier: 2.0 };
                },
                getDescription: () => '2x XP in matching affinity biomes'
            },

            bloodlineMemory: {
                type: 'passive',
                apply: (creature) => {
                    const generation = creature?.generation || 1;
                    const bonus = (generation - 1) * 0.05;
                    this.abilityEffects.statBonusPercent = (this.abilityEffects.statBonusPercent || 0) + bonus;
                    return { statBonus: bonus, generation };
                },
                getDescription: () => '+5% stats per generation'
            },

            timeWarp: {
                type: 'passive',
                apply: (creature) => {
                    this.abilityEffects.cooldownReduction = 0.5;
                    this.abilityEffects.agingSpeed = 0.5;
                    return { cooldownReduction: 0.5, agingSpeed: 0.5 };
                },
                getDescription: () => '50% faster cooldowns, slower aging'
            },

            cosmicGuardian: {
                type: 'passive',
                apply: (creature) => {
                    this.abilityEffects.statusImmunity = true;
                    return { statusImmunity: true };
                },
                getDescription: () => 'Immune to negative status effects'
            }
        };
    }

    /**
     * Initialize abilities for current creature
     */
    initializeForCreature(creature, scene) {
        this.scene = scene;
        this.activeAbilities = [];
        this.abilityEffects = {};
        this.cooldowns = {};

        const abilities = creature?.secretAbilities || [];

        abilities.forEach(ability => {
            const handler = this.abilityHandlers[ability.id];
            if (handler) {
                this.activeAbilities.push({
                    ...ability,
                    handler
                });

                // Apply passive abilities immediately
                if (handler.type === 'passive') {
                    handler.apply(creature, scene);
                    console.log(`[SecretAbilityManager] Applied passive: ${ability.name}`);
                }
            }
        });

        console.log(`[SecretAbilityManager] Initialized ${this.activeAbilities.length} abilities`);
        return this.activeAbilities;
    }

    /**
     * Get combat modifiers from active abilities
     */
    getCombatModifiers() {
        return {
            damageMultiplier: this.abilityEffects.damageMultiplier || 1,
            ignoreDefense: this.abilityEffects.ignoreDefense || false,
            shieldActive: this.abilityEffects.shieldActive || false,
            shieldAbsorb: this.abilityEffects.shieldAbsorb || 0
        };
    }

    /**
     * Get utility modifiers from active abilities
     */
    getUtilityModifiers() {
        return {
            speedBonus: this.abilityEffects.speedBonus || 0,
            treasureRevealRange: this.abilityEffects.treasureRevealRange || 0,
            healingBonus: this.abilityEffects.healingBonus || 0
        };
    }

    /**
     * Get passive modifiers from active abilities
     */
    getPassiveModifiers() {
        return {
            xpMultiplier: this.abilityEffects.xpMultiplier || 1,
            statBonusPercent: this.abilityEffects.statBonusPercent || 0,
            cooldownReduction: this.abilityEffects.cooldownReduction || 1,
            statusImmunity: this.abilityEffects.statusImmunity || false
        };
    }

    /**
     * Trigger an active ability
     */
    triggerAbility(abilityId, creature, scene, targetX, targetY) {
        const ability = this.activeAbilities.find(a => a.id === abilityId);
        if (!ability || !ability.handler) {
            console.warn(`[SecretAbilityManager] Ability not found: ${abilityId}`);
            return null;
        }

        if (this.isOnCooldown(abilityId)) {
            console.log(`[SecretAbilityManager] ${abilityId} on cooldown`);
            return null;
        }

        const result = ability.handler.apply(creature, scene, targetX, targetY);
        console.log(`[SecretAbilityManager] Triggered ${ability.name}:`, result);

        // Play ability sound
        window.AudioManager?.playAchievement?.();

        return result;
    }

    /**
     * Check if ability is on cooldown
     */
    isOnCooldown(abilityId) {
        const cooldownEnd = this.cooldowns[abilityId];
        return cooldownEnd && Date.now() < cooldownEnd;
    }

    /**
     * Start ability cooldown
     */
    startCooldown(abilityId, duration) {
        // Apply cooldown reduction if available
        const reduction = this.abilityEffects.cooldownReduction || 1;
        const actualDuration = duration * reduction;
        this.cooldowns[abilityId] = Date.now() + actualDuration;
    }

    /**
     * Get remaining cooldown for ability
     */
    getCooldownRemaining(abilityId) {
        const cooldownEnd = this.cooldowns[abilityId];
        if (!cooldownEnd) return 0;
        return Math.max(0, cooldownEnd - Date.now());
    }

    /**
     * Apply damage with ability modifiers
     */
    calculateDamage(baseDamage, targetDefense = 0) {
        const mods = this.getCombatModifiers();
        let damage = baseDamage * mods.damageMultiplier;

        if (!mods.ignoreDefense) {
            damage = Math.max(1, damage - targetDefense);
        }

        return Math.round(damage);
    }

    /**
     * Apply incoming damage with shield
     */
    applyShield(incomingDamage) {
        const mods = this.getCombatModifiers();

        if (mods.shieldActive && mods.shieldAbsorb > 0) {
            const absorbed = Math.min(incomingDamage, mods.shieldAbsorb);
            this.abilityEffects.shieldAbsorb -= absorbed;
            return incomingDamage - absorbed;
        }

        return incomingDamage;
    }

    /**
     * Get movement speed with ability modifiers
     */
    getModifiedSpeed(baseSpeed) {
        const mods = this.getUtilityModifiers();
        return baseSpeed * (1 + mods.speedBonus);
    }

    /**
     * Get XP with ability modifiers
     */
    getModifiedXP(baseXP, inMatchingBiome = false) {
        const mods = this.getPassiveModifiers();
        let xp = baseXP;

        if (inMatchingBiome && mods.xpMultiplier > 1) {
            xp *= mods.xpMultiplier;
        }

        // Add stat bonus percent as additional XP
        if (mods.statBonusPercent > 0) {
            xp *= (1 + mods.statBonusPercent);
        }

        return Math.round(xp);
    }

    // === VISUAL EFFECTS ===

    showShieldEffect(scene, creature) {
        if (!scene) return;

        const x = creature?.x || scene.scale.width / 2;
        const y = creature?.y || scene.scale.height / 2;

        const shield = scene.add.graphics();
        shield.lineStyle(4, 0x00FFFF, 0.8);
        shield.strokeCircle(x, y, 60);
        shield.fillStyle(0x00FFFF, 0.2);
        shield.fillCircle(x, y, 60);
        shield.setDepth(2000);

        // Pulsing animation
        scene.tweens.add({
            targets: shield,
            alpha: { from: 1, to: 0.3 },
            scaleX: { from: 1, to: 1.2 },
            scaleY: { from: 1, to: 1.2 },
            duration: 500,
            yoyo: true,
            repeat: 5,
            onComplete: () => shield.destroy()
        });

        // Sound
        window.AudioManager?.playButtonClick?.();
    }

    showNovaEffect(scene, x, y) {
        if (!scene) return;

        // Expanding ring
        const ring = scene.add.graphics();
        ring.lineStyle(6, 0xFF6600, 1);
        ring.strokeCircle(x, y, 20);
        ring.setDepth(2000);

        scene.tweens.add({
            targets: ring,
            scaleX: 8,
            scaleY: 8,
            alpha: 0,
            duration: 500,
            onComplete: () => ring.destroy()
        });

        // Central flash
        const flash = scene.add.graphics();
        flash.fillStyle(0xFFAA00, 0.8);
        flash.fillCircle(x, y, 30);
        flash.setDepth(2001);

        scene.tweens.add({
            targets: flash,
            alpha: 0,
            scaleX: 3,
            scaleY: 3,
            duration: 300,
            onComplete: () => flash.destroy()
        });

        // Particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(scene, x, y, {
                count: 20,
                color: [0xFF6600, 0xFFAA00, 0xFFFF00],
                duration: 1000
            });
        }

        // Sound
        window.AudioManager?.playAttack?.();
    }

    /**
     * Check if creature has specific ability
     */
    hasAbility(abilityId) {
        return this.activeAbilities.some(a => a.id === abilityId);
    }

    /**
     * Get list of active abilities with cooldown status
     */
    getAbilityStatus() {
        return this.activeAbilities.map(ability => ({
            id: ability.id,
            name: ability.name,
            icon: ability.icon,
            type: ability.handler?.type || 'unknown',
            description: ability.handler?.getDescription?.() || ability.description,
            onCooldown: this.isOnCooldown(ability.id),
            cooldownRemaining: this.getCooldownRemaining(ability.id)
        }));
    }

    /**
     * Clean up
     */
    cleanup() {
        this.activeAbilities = [];
        this.abilityEffects = {};
        this.cooldowns = {};
        this.scene = null;
        this.abilityIndicators.forEach(i => i?.destroy?.());
        this.abilityIndicators = [];
    }
}

// Create singleton
window.SecretAbilityManager = window.SecretAbilityManager || new SecretAbilityManager();

export default SecretAbilityManager;
