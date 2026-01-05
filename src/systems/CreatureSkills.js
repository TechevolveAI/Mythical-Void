/**
 * CreatureSkills - Manages creature abilities based on cosmic affinity
 * Each affinity grants unique skills that can be used in exploration
 */

class CreatureSkills {
    constructor() {
        this.initialized = false;
        this.activeSkills = new Map();
        this.cooldowns = new Map();
        this.skillLevels = {};

        // Skill definitions per cosmic affinity
        this.skillDefinitions = this.defineSkills();
    }

    /**
     * Initialize the skills system
     */
    init() {
        if (this.initialized) return;

        console.log('[CreatureSkills] Initializing creature skills system...');

        // Load saved skill progress
        this.loadSkillProgress();

        this.initialized = true;
        console.log('[CreatureSkills] Skills system initialized');
    }

    /**
     * Define skills for each cosmic affinity
     */
    defineSkills() {
        return {
            star: {
                name: 'Star Affinity',
                description: 'Connected to stellar energy',
                color: 0xFFD700,
                skills: [
                    {
                        id: 'radiant_pulse',
                        name: 'Radiant Pulse',
                        description: 'Emit a burst of light that reveals hidden collectibles nearby',
                        icon: '✨',
                        type: 'exploration',
                        cooldown: 30000, // 30 seconds
                        duration: 5000,  // Effect lasts 5 seconds
                        range: 300,
                        unlockLevel: 1,
                        effect: 'reveal_collectibles'
                    },
                    {
                        id: 'warmth_aura',
                        name: 'Warmth Aura',
                        description: 'Generate warmth that increases happiness recovery',
                        icon: '🌟',
                        type: 'passive',
                        cooldown: 60000,
                        duration: 15000,
                        unlockLevel: 3,
                        effect: 'happiness_boost',
                        boostAmount: 0.5
                    },
                    {
                        id: 'star_dash',
                        name: 'Star Dash',
                        description: 'Burst forward in a trail of starlight',
                        icon: '💫',
                        type: 'movement',
                        cooldown: 15000,
                        duration: 500,
                        unlockLevel: 5,
                        effect: 'speed_boost',
                        boostAmount: 3.0
                    }
                ]
            },
            moon: {
                name: 'Moon Affinity',
                description: 'Attuned to lunar cycles',
                color: 0xC0C0C0,
                skills: [
                    {
                        id: 'lunar_sight',
                        name: 'Lunar Sight',
                        description: 'Sense rare items and creatures in the area',
                        icon: '🌙',
                        type: 'exploration',
                        cooldown: 45000,
                        duration: 8000,
                        range: 400,
                        unlockLevel: 1,
                        effect: 'reveal_rare'
                    },
                    {
                        id: 'dream_shield',
                        name: 'Dream Shield',
                        description: 'Create a protective barrier that reduces damage',
                        icon: '🛡️',
                        type: 'defensive',
                        cooldown: 40000,
                        duration: 10000,
                        unlockLevel: 3,
                        effect: 'damage_reduction',
                        reductionAmount: 0.5
                    },
                    {
                        id: 'moonwalk',
                        name: 'Moonwalk',
                        description: 'Glide silently, avoiding enemy detection',
                        icon: '👻',
                        type: 'stealth',
                        cooldown: 30000,
                        duration: 8000,
                        unlockLevel: 5,
                        effect: 'stealth_mode'
                    }
                ]
            },
            nebula: {
                name: 'Nebula Affinity',
                description: 'Flowing with cosmic mists',
                color: 0x9370DB,
                skills: [
                    {
                        id: 'mist_veil',
                        name: 'Mist Veil',
                        description: 'Surround yourself in cosmic mist, confusing enemies',
                        icon: '🌫️',
                        type: 'defensive',
                        cooldown: 25000,
                        duration: 6000,
                        range: 150,
                        unlockLevel: 1,
                        effect: 'enemy_confusion'
                    },
                    {
                        id: 'emotion_link',
                        name: 'Emotion Link',
                        description: 'Sense the mood of nearby creatures, boosting bond XP',
                        icon: '💜',
                        type: 'passive',
                        cooldown: 60000,
                        duration: 20000,
                        unlockLevel: 3,
                        effect: 'xp_boost',
                        boostAmount: 1.5
                    },
                    {
                        id: 'color_burst',
                        name: 'Color Burst',
                        description: 'Explode in a rainbow of colors, stunning enemies',
                        icon: '🌈',
                        type: 'combat',
                        cooldown: 35000,
                        duration: 3000,
                        range: 200,
                        unlockLevel: 5,
                        effect: 'stun_enemies'
                    }
                ]
            },
            crystal: {
                name: 'Crystal Affinity',
                description: 'Resonates with crystalline structures',
                color: 0x00CED1,
                skills: [
                    {
                        id: 'crystal_sense',
                        name: 'Crystal Sense',
                        description: 'Detect valuable crystals and gems in the area',
                        icon: '💎',
                        type: 'exploration',
                        cooldown: 40000,
                        duration: 10000,
                        range: 350,
                        unlockLevel: 1,
                        effect: 'reveal_crystals'
                    },
                    {
                        id: 'healing_resonance',
                        name: 'Healing Resonance',
                        description: 'Channel crystal energy to restore health',
                        icon: '💚',
                        type: 'healing',
                        cooldown: 45000,
                        duration: 5000,
                        unlockLevel: 3,
                        effect: 'heal',
                        healAmount: 25
                    },
                    {
                        id: 'crystal_armor',
                        name: 'Crystal Armor',
                        description: 'Coat yourself in protective crystals',
                        icon: '🔷',
                        type: 'defensive',
                        cooldown: 50000,
                        duration: 12000,
                        unlockLevel: 5,
                        effect: 'armor_boost',
                        armorAmount: 30
                    }
                ]
            },
            void: {
                name: 'Void Affinity',
                description: 'Touched by the deep cosmos',
                color: 0x4B0082,
                skills: [
                    {
                        id: 'void_sense',
                        name: 'Void Sense',
                        description: 'Detect hidden paths and secret areas',
                        icon: '🌑',
                        type: 'exploration',
                        cooldown: 50000,
                        duration: 12000,
                        range: 500,
                        unlockLevel: 1,
                        effect: 'reveal_secrets'
                    },
                    {
                        id: 'shadow_step',
                        name: 'Shadow Step',
                        description: 'Teleport a short distance through the void',
                        icon: '🕳️',
                        type: 'movement',
                        cooldown: 20000,
                        duration: 0,
                        range: 200,
                        unlockLevel: 3,
                        effect: 'teleport'
                    },
                    {
                        id: 'void_grasp',
                        name: 'Void Grasp',
                        description: 'Pull distant collectibles toward you',
                        icon: '🫴',
                        type: 'utility',
                        cooldown: 25000,
                        duration: 3000,
                        range: 300,
                        unlockLevel: 5,
                        effect: 'attract_items'
                    }
                ]
            }
        };
    }

    /**
     * Get skills for a specific affinity
     */
    getSkillsForAffinity(affinity) {
        const affinityData = this.skillDefinitions[affinity];
        if (!affinityData) return [];

        return affinityData.skills.map(skill => ({
            ...skill,
            affinityName: affinityData.name,
            affinityColor: affinityData.color,
            level: this.getSkillLevel(skill.id),
            isUnlocked: this.isSkillUnlocked(skill.id),
            cooldownRemaining: this.getCooldownRemaining(skill.id)
        }));
    }

    /**
     * Get current creature's skills
     */
    getCurrentCreatureSkills() {
        let affinity = window.GameState?.get('creature.genes.cosmicAffinity.element');

        // Fallback: Try to get affinity from collection creature data
        if (!affinity) {
            const activeCreature = window.GameState?.getActiveCreature?.();
            affinity = activeCreature?.cosmicAffinity || activeCreature?.genes?.cosmicAffinity?.element;
        }

        // Fallback: Assign a default affinity based on creature personality or random
        if (!affinity) {
            const personality = window.GameState?.get('creature.personality.core');
            const personalityToAffinity = {
                curious: 'nebula',
                playful: 'star',
                gentle: 'moon',
                wise: 'crystal',
                energetic: 'star'
            };
            affinity = personalityToAffinity[personality] || 'star';
            console.log(`[CreatureSkills] No cosmic affinity found, using fallback: ${affinity}`);
        }

        return this.getSkillsForAffinity(affinity);
    }

    /**
     * Check if a skill is unlocked based on creature level
     */
    isSkillUnlocked(skillId) {
        const creatureLevel = window.GameState?.get('creature.level') || 1;
        const skill = this.findSkillById(skillId);

        if (!skill) return false;
        return creatureLevel >= skill.unlockLevel;
    }

    /**
     * Find a skill by ID across all affinities
     */
    findSkillById(skillId) {
        for (const affinity of Object.values(this.skillDefinitions)) {
            const skill = affinity.skills.find(s => s.id === skillId);
            if (skill) return skill;
        }
        return null;
    }

    /**
     * Get skill level (increases with use)
     */
    getSkillLevel(skillId) {
        return this.skillLevels[skillId] || 1;
    }

    /**
     * Increase skill level through use
     */
    increaseSkillXP(skillId, amount = 1) {
        if (!this.skillLevels[skillId]) {
            this.skillLevels[skillId] = 1;
        }

        // Simple leveling: every 10 uses = level up (max level 5)
        const currentLevel = this.skillLevels[skillId];
        if (currentLevel < 5) {
            const xpNeeded = currentLevel * 10;
            const currentXP = (this.skillXP?.[skillId] || 0) + amount;

            if (currentXP >= xpNeeded) {
                this.skillLevels[skillId]++;
                this.skillXP = this.skillXP || {};
                this.skillXP[skillId] = 0;

                console.log(`[CreatureSkills] Skill ${skillId} leveled up to ${this.skillLevels[skillId]}!`);
                this.saveSkillProgress();

                return { leveledUp: true, newLevel: this.skillLevels[skillId] };
            } else {
                this.skillXP = this.skillXP || {};
                this.skillXP[skillId] = currentXP;
            }
        }

        return { leveledUp: false };
    }

    /**
     * Use a skill
     */
    useSkill(scene, skillId) {
        const skill = this.findSkillById(skillId);
        if (!skill) {
            console.warn(`[CreatureSkills] Unknown skill: ${skillId}`);
            return { success: false, reason: 'unknown_skill' };
        }

        // Check if unlocked
        if (!this.isSkillUnlocked(skillId)) {
            console.log(`[CreatureSkills] Skill ${skillId} not unlocked yet`);
            return { success: false, reason: 'locked' };
        }

        // Check cooldown
        if (this.isOnCooldown(skillId)) {
            const remaining = this.getCooldownRemaining(skillId);
            console.log(`[CreatureSkills] Skill ${skillId} on cooldown: ${Math.ceil(remaining / 1000)}s remaining`);
            return { success: false, reason: 'cooldown', remaining };
        }

        // Execute skill effect
        const result = this.executeSkillEffect(scene, skill);

        if (result.success) {
            // Start cooldown
            this.startCooldown(skillId, skill.cooldown);

            // Increase skill XP
            this.increaseSkillXP(skillId);

            // Play sound
            if (window.AudioManager) {
                window.AudioManager.playPurchase?.();
            }

            console.log(`[CreatureSkills] Used skill: ${skill.name}`);
        }

        return result;
    }

    /**
     * Execute the actual skill effect
     */
    executeSkillEffect(scene, skill) {
        if (!scene) return { success: false, reason: 'no_scene' };

        const player = scene.player;
        if (!player) return { success: false, reason: 'no_player' };

        const skillLevel = this.getSkillLevel(skill.id);
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2; // 20% bonus per level

        switch (skill.effect) {
            case 'reveal_collectibles':
                return this.effectRevealCollectibles(scene, skill, levelMultiplier);

            case 'reveal_rare':
                return this.effectRevealRare(scene, skill, levelMultiplier);

            case 'reveal_crystals':
                return this.effectRevealCrystals(scene, skill, levelMultiplier);

            case 'reveal_secrets':
                return this.effectRevealSecrets(scene, skill, levelMultiplier);

            case 'speed_boost':
                return this.effectSpeedBoost(scene, skill, levelMultiplier);

            case 'happiness_boost':
                return this.effectHappinessBoost(scene, skill, levelMultiplier);

            case 'xp_boost':
                return this.effectXPBoost(scene, skill, levelMultiplier);

            case 'heal':
                return this.effectHeal(scene, skill, levelMultiplier);

            case 'damage_reduction':
                return this.effectDamageReduction(scene, skill, levelMultiplier);

            case 'stealth_mode':
                return this.effectStealth(scene, skill, levelMultiplier);

            case 'enemy_confusion':
                return this.effectConfusion(scene, skill, levelMultiplier);

            case 'stun_enemies':
                return this.effectStun(scene, skill, levelMultiplier);

            case 'teleport':
                return this.effectTeleport(scene, skill, levelMultiplier);

            case 'attract_items':
                return this.effectAttractItems(scene, skill, levelMultiplier);

            case 'armor_boost':
                return this.effectArmorBoost(scene, skill, levelMultiplier);

            default:
                console.warn(`[CreatureSkills] Unknown effect: ${skill.effect}`);
                return { success: false, reason: 'unknown_effect' };
        }
    }

    // Skill effect implementations

    effectRevealCollectibles(scene, skill, multiplier) {
        const range = skill.range * multiplier;
        this.showSkillVisual(scene, skill, range);

        // Highlight nearby collectibles
        if (scene.collectibles) {
            scene.collectibles.forEach(collectible => {
                if (!collectible.container) return;
                const dist = Phaser.Math.Distance.Between(
                    scene.player.x, scene.player.y,
                    collectible.container.x, collectible.container.y
                );
                if (dist <= range) {
                    this.highlightObject(scene, collectible.container, 0xFFD700, skill.duration);
                }
            });
        }

        return { success: true, message: 'Nearby collectibles revealed!' };
    }

    effectRevealRare(scene, skill, multiplier) {
        const range = skill.range * multiplier;
        this.showSkillVisual(scene, skill, range);

        // Show rare item indicators
        if (scene.collectibles) {
            scene.collectibles.forEach(collectible => {
                if (!collectible.container || !collectible.type) return;
                if (collectible.type.rarity === 'rare' || collectible.type.rarity === 'legendary' || collectible.type.isLore) {
                    const dist = Phaser.Math.Distance.Between(
                        scene.player.x, scene.player.y,
                        collectible.container.x, collectible.container.y
                    );
                    if (dist <= range) {
                        this.highlightObject(scene, collectible.container, 0xC0C0C0, skill.duration);
                    }
                }
            });
        }

        return { success: true, message: 'Rare items sensed!' };
    }

    effectRevealCrystals(scene, skill, multiplier) {
        const range = skill.range * multiplier;
        this.showSkillVisual(scene, skill, range);

        if (scene.collectibles) {
            scene.collectibles.forEach(collectible => {
                if (!collectible.container || !collectible.type) return;
                if (collectible.type.id?.includes('crystal') || collectible.type.id?.includes('gem')) {
                    const dist = Phaser.Math.Distance.Between(
                        scene.player.x, scene.player.y,
                        collectible.container.x, collectible.container.y
                    );
                    if (dist <= range) {
                        this.highlightObject(scene, collectible.container, 0x00CED1, skill.duration);
                    }
                }
            });
        }

        return { success: true, message: 'Crystal energy detected!' };
    }

    effectRevealSecrets(scene, skill, multiplier) {
        const range = skill.range * multiplier;
        this.showSkillVisual(scene, skill, range);

        // Reveal lore fragments specifically
        if (scene.collectibles) {
            scene.collectibles.forEach(collectible => {
                if (!collectible.container || !collectible.type) return;
                if (collectible.type.isLore || collectible.type.isSecret) {
                    const dist = Phaser.Math.Distance.Between(
                        scene.player.x, scene.player.y,
                        collectible.container.x, collectible.container.y
                    );
                    if (dist <= range) {
                        this.highlightObject(scene, collectible.container, 0x4B0082, skill.duration);
                    }
                }
            });
        }

        return { success: true, message: 'Secrets of the void revealed!' };
    }

    effectSpeedBoost(scene, skill, multiplier) {
        const boost = skill.boostAmount * multiplier;
        const originalSpeed = scene.playerSpeed || 200;

        scene.playerSpeed = originalSpeed * boost;

        // Visual trail effect
        this.showSpeedTrail(scene, skill);

        scene.time.delayedCall(skill.duration, () => {
            scene.playerSpeed = originalSpeed;
        });

        return { success: true, message: 'Star power surges through you!' };
    }

    effectHappinessBoost(scene, skill, multiplier) {
        const currentHappiness = window.GameState?.get('creature.stats.happiness') || 100;
        const boost = 10 * multiplier;

        window.GameState?.set('creature.stats.happiness', Math.min(100, currentHappiness + boost));
        scene.updateStatsDisplay?.();

        this.showSkillVisual(scene, skill, 100);

        return { success: true, message: `Warmth spreads through you! (+${Math.floor(boost)} happiness)` };
    }

    effectXPBoost(scene, skill, multiplier) {
        // Store boost state for XP gains
        scene.xpMultiplier = skill.boostAmount * multiplier;

        this.showSkillVisual(scene, skill, 150);

        scene.time.delayedCall(skill.duration, () => {
            scene.xpMultiplier = 1;
        });

        return { success: true, message: 'Emotional bond strengthened! XP boost active.' };
    }

    effectHeal(scene, skill, multiplier) {
        const currentHealth = window.GameState?.get('creature.stats.health') || 100;
        const healAmount = skill.healAmount * multiplier;

        window.GameState?.set('creature.stats.health', Math.min(100, currentHealth + healAmount));
        scene.updateStatsDisplay?.();

        this.showHealEffect(scene);

        return { success: true, message: `Crystal healing! (+${Math.floor(healAmount)} health)` };
    }

    effectDamageReduction(scene, skill, multiplier) {
        scene.damageReduction = skill.reductionAmount * multiplier;

        this.showShieldEffect(scene, 0xC0C0C0, skill.duration);

        scene.time.delayedCall(skill.duration, () => {
            scene.damageReduction = 0;
        });

        return { success: true, message: 'Dream shield activated!' };
    }

    effectStealth(scene, skill, multiplier) {
        scene.isStealthed = true;

        // Make player semi-transparent
        scene.tweens.add({
            targets: scene.player,
            alpha: 0.5,
            duration: 500
        });

        scene.time.delayedCall(skill.duration * multiplier, () => {
            scene.isStealthed = false;
            scene.tweens.add({
                targets: scene.player,
                alpha: 1,
                duration: 500
            });
        });

        return { success: true, message: 'Moving like moonlight...' };
    }

    effectConfusion(scene, skill, multiplier) {
        const range = skill.range * multiplier;

        this.showSkillVisual(scene, skill, range);

        // Confuse nearby enemies
        if (scene.enemies) {
            scene.enemies.getChildren().forEach(enemy => {
                const dist = Phaser.Math.Distance.Between(
                    scene.player.x, scene.player.y,
                    enemy.x, enemy.y
                );
                if (dist <= range) {
                    enemy.isConfused = true;
                    scene.time.delayedCall(skill.duration, () => {
                        if (enemy.active) enemy.isConfused = false;
                    });
                }
            });
        }

        return { success: true, message: 'Enemies lost in the mist!' };
    }

    effectStun(scene, skill, multiplier) {
        const range = skill.range * multiplier;

        this.showColorBurst(scene);

        if (scene.enemies) {
            scene.enemies.getChildren().forEach(enemy => {
                const dist = Phaser.Math.Distance.Between(
                    scene.player.x, scene.player.y,
                    enemy.x, enemy.y
                );
                if (dist <= range) {
                    enemy.isStunned = true;
                    enemy.setTint(0x888888);
                    scene.time.delayedCall(skill.duration, () => {
                        if (enemy.active) {
                            enemy.isStunned = false;
                            enemy.clearTint();
                        }
                    });
                }
            });
        }

        return { success: true, message: 'Color explosion stuns enemies!' };
    }

    effectTeleport(scene, skill, multiplier) {
        const range = skill.range * multiplier;

        // Get direction player is facing
        const direction = scene.lastMoveDirection || { x: 1, y: 0 };
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y) || 1;

        const targetX = scene.player.x + (direction.x / magnitude) * range;
        const targetY = scene.player.y + (direction.y / magnitude) * range;

        // Clamp to world bounds
        const bounds = scene.physics.world.bounds;
        const finalX = Phaser.Math.Clamp(targetX, bounds.x + 50, bounds.width - 50);
        const finalY = Phaser.Math.Clamp(targetY, bounds.y + 50, bounds.height - 50);

        // Teleport effect
        this.showTeleportEffect(scene, scene.player.x, scene.player.y, finalX, finalY);

        scene.player.setPosition(finalX, finalY);

        return { success: true, message: 'Shadow step!' };
    }

    effectAttractItems(scene, skill, multiplier) {
        const range = skill.range * multiplier;

        this.showSkillVisual(scene, skill, range);

        // Pull coins and collectibles toward player
        if (scene.coins) {
            scene.coins.getChildren().forEach(coin => {
                const dist = Phaser.Math.Distance.Between(
                    scene.player.x, scene.player.y,
                    coin.x, coin.y
                );
                if (dist <= range && dist > 50) {
                    scene.tweens.add({
                        targets: coin,
                        x: scene.player.x,
                        y: scene.player.y,
                        duration: skill.duration,
                        ease: 'Power2'
                    });
                }
            });
        }

        return { success: true, message: 'Items drawn to the void!' };
    }

    effectArmorBoost(scene, skill, multiplier) {
        scene.bonusArmor = skill.armorAmount * multiplier;

        this.showShieldEffect(scene, 0x00CED1, skill.duration);

        scene.time.delayedCall(skill.duration, () => {
            scene.bonusArmor = 0;
        });

        return { success: true, message: 'Crystal armor formed!' };
    }

    // Visual effect helpers

    showSkillVisual(scene, skill, range) {
        const { x, y } = scene.player;

        // Create expanding ring
        const ring = scene.add.graphics();
        ring.lineStyle(3, skill.affinityColor || 0xFFFFFF, 0.8);
        ring.strokeCircle(0, 0, 10);
        ring.setPosition(x, y);
        ring.setDepth(1000);

        scene.tweens.add({
            targets: ring,
            scaleX: range / 10,
            scaleY: range / 10,
            alpha: 0,
            duration: 1000,
            onComplete: () => ring.destroy()
        });

        // Show floating text
        this.showSkillText(scene, skill.name, skill.icon);
    }

    showSkillText(scene, text, icon) {
        const { x, y } = scene.player;

        const skillText = scene.add.text(x, y - 60, `${icon} ${text}`, {
            fontSize: '16px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(1001);

        scene.tweens.add({
            targets: skillText,
            y: y - 100,
            alpha: 0,
            duration: 1500,
            onComplete: () => skillText.destroy()
        });
    }

    highlightObject(scene, obj, color, duration) {
        if (!obj) return;

        const highlight = scene.add.graphics();
        highlight.lineStyle(3, color, 0.8);
        highlight.strokeCircle(obj.x, obj.y, 30);
        highlight.setDepth(obj.depth + 1);

        scene.tweens.add({
            targets: highlight,
            alpha: { from: 0.8, to: 0.3 },
            scaleX: { from: 1, to: 1.2 },
            scaleY: { from: 1, to: 1.2 },
            duration: 500,
            yoyo: true,
            repeat: Math.floor(duration / 1000),
            onComplete: () => highlight.destroy()
        });
    }

    showSpeedTrail(scene, skill) {
        const interval = scene.time.addEvent({
            delay: 50,
            callback: () => {
                const trail = scene.add.circle(scene.player.x, scene.player.y, 8, 0xFFD700, 0.5);
                trail.setDepth(scene.player.depth - 1);
                scene.tweens.add({
                    targets: trail,
                    alpha: 0,
                    scale: 0.5,
                    duration: 300,
                    onComplete: () => trail.destroy()
                });
            },
            repeat: Math.floor(skill.duration / 50)
        });
    }

    showHealEffect(scene) {
        const { x, y } = scene.player;

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const particle = scene.add.text(x, y, '💚', { fontSize: '16px' }).setDepth(1000);

            scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * 50,
                y: y + Math.sin(angle) * 50 - 30,
                alpha: 0,
                duration: 800,
                onComplete: () => particle.destroy()
            });
        }
    }

    showShieldEffect(scene, color, duration) {
        const shield = scene.add.graphics();
        shield.lineStyle(4, color, 0.6);
        shield.strokeCircle(0, 0, 40);
        shield.setDepth(scene.player.depth + 1);

        scene.time.addEvent({
            delay: 16,
            callback: () => {
                if (scene.player) {
                    shield.setPosition(scene.player.x, scene.player.y);
                }
            },
            repeat: Math.floor(duration / 16)
        });

        scene.time.delayedCall(duration, () => shield.destroy());
    }

    showColorBurst(scene) {
        const { x, y } = scene.player;
        const colors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x8B00FF];

        colors.forEach((color, i) => {
            const angle = (i / colors.length) * Math.PI * 2;
            const burst = scene.add.circle(x, y, 15, color, 0.8).setDepth(1000);

            scene.tweens.add({
                targets: burst,
                x: x + Math.cos(angle) * 150,
                y: y + Math.sin(angle) * 150,
                alpha: 0,
                scale: 0.3,
                duration: 600,
                onComplete: () => burst.destroy()
            });
        });
    }

    showTeleportEffect(scene, fromX, fromY, toX, toY) {
        // Disappear effect
        const disappear = scene.add.circle(fromX, fromY, 30, 0x4B0082, 0.8).setDepth(1000);
        scene.tweens.add({
            targets: disappear,
            scale: 0,
            alpha: 0,
            duration: 300,
            onComplete: () => disappear.destroy()
        });

        // Appear effect
        const appear = scene.add.circle(toX, toY, 5, 0x4B0082, 0.8).setDepth(1000);
        scene.tweens.add({
            targets: appear,
            scale: 6,
            alpha: 0,
            duration: 400,
            onComplete: () => appear.destroy()
        });
    }

    // Cooldown management

    isOnCooldown(skillId) {
        const cooldownEnd = this.cooldowns.get(skillId);
        if (!cooldownEnd) return false;
        return Date.now() < cooldownEnd;
    }

    getCooldownRemaining(skillId) {
        const cooldownEnd = this.cooldowns.get(skillId);
        if (!cooldownEnd) return 0;
        return Math.max(0, cooldownEnd - Date.now());
    }

    startCooldown(skillId, duration) {
        this.cooldowns.set(skillId, Date.now() + duration);
    }

    // Save/Load

    saveSkillProgress() {
        try {
            const data = {
                skillLevels: this.skillLevels,
                skillXP: this.skillXP || {}
            };
            localStorage.setItem('creatureSkills', JSON.stringify(data));
        } catch (e) {
            console.warn('[CreatureSkills] Failed to save skill progress:', e);
        }
    }

    loadSkillProgress() {
        try {
            const data = localStorage.getItem('creatureSkills');
            if (data) {
                const parsed = JSON.parse(data);
                this.skillLevels = parsed.skillLevels || {};
                this.skillXP = parsed.skillXP || {};
            }
        } catch (e) {
            console.warn('[CreatureSkills] Failed to load skill progress:', e);
        }
    }
}

// Create singleton instance
const creatureSkills = new CreatureSkills();

// Export for browser
if (typeof window !== 'undefined') {
    window.CreatureSkills = creatureSkills;
}

export default creatureSkills;
