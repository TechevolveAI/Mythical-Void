/**
 * SoulRevealScene - Unified soul reveal + naming screen
 *
 * Combines the old PersonalityScene and NamingScene into a single dramatic reveal.
 * Features:
 * - AI-generated unique soul phrases
 * - Meaningful context for all stats (rarity odds, ability benefits, etc.)
 * - Personality preview with sample dialogue
 * - Dramatic sequential animations
 * - Data saved to GameState for profile page access
 */

import { devLog } from '../utils/devLogger.js';
import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';

export default class SoulRevealScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SoulRevealScene' });
        this.elements = [];
        this.nameInput = '';
        this.inputActive = false;
        this.canProceed = false;
        this.htmlInput = null;
    }

    init(data) {
        this.isEggHatch = data?.isEggHatch || false;
        this.eggType = data?.eggType || null;
        devLog('[SoulRevealScene] Init with data:', data);
    }

    create() {
        // Stop other scenes to ensure clean display
        const scenesToStop = ['HatchingScene', 'PersonalityScene', 'NamingScene', 'GameScene'];
        SceneTransitionHelper.stopActiveScenes(this, scenesToStop);
        SceneTransitionHelper.bringToTop(this);

        const { width, height } = this.scale;

        // Initialize SoulPhraseGenerator
        if (window.SoulPhraseGenerator && !window.SoulPhraseGenerator.initialized) {
            window.SoulPhraseGenerator.initialize();
        }

        // Get creature data
        this.loadCreatureData();

        // Create background
        this.createBackground(width, height);

        // Start the dramatic reveal sequence
        this.startRevealSequence(width, height);

        // Setup keyboard input for desktop
        this.setupKeyboardInput();

        devLog('[SoulRevealScene] Created');
    }

    /**
     * Load creature data from GameState
     */
    loadCreatureData() {
        const genetics = window.GameState?.get('creature.genetics');
        const genes = window.GameState?.get('creature.genes');
        const personality = window.GameState?.get('creature.personality');

        // Extract key data
        this.creatureData = {
            rarity: genetics?.rarity || genes?.rarity || 'common',
            personalityCore: personality?.core || genetics?.personality?.core || 'curious',
            cosmicAffinity: genetics?.cosmicAffinity?.element || 'star',
            powerLevel: genetics?.cosmicAffinity?.powerLevel || 0.5,
            textureName: window.GameState?.get('creature.textureName'),
            isShiny: genetics?.isShiny || false,
            shinyType: genetics?.shinyType || null,
            mutations: genetics?.traits?.features?.wackyMutations || [],
            specialFeatures: genetics?.traits?.features?.specialFeatures || []
        };

        // Get innate ability from CreatureSkills with full details
        this.innateAbility = this.getInnateAbility(this.creatureData.cosmicAffinity);

        // Generate unique soul phrase
        if (window.SoulPhraseGenerator) {
            this.soulPhrase = window.SoulPhraseGenerator.generate(
                this.creatureData.personalityCore,
                this.creatureData.cosmicAffinity,
                this.creatureData.rarity
            );
        } else {
            this.soulPhrase = {
                phrase: 'A unique soul awakens to greet the cosmos',
                nature: 'A unique soul',
                action: 'awakens',
                element: 'to greet the cosmos'
            };
        }

        // Get personality preview dialogue
        this.personalityPreview = this.getPersonalityPreview(this.creatureData.personalityCore);

        // Get rarity context (odds, bonuses)
        this.rarityContext = this.getRarityContext(this.creatureData.rarity);

        // Check for Ancient Lineage (5% for testing, normally 0.5%)
        this.hasAncientLineage = Math.random() < 0.05;

        devLog('[SoulRevealScene] Creature data loaded:', this.creatureData);
        devLog('[SoulRevealScene] Soul phrase:', this.soulPhrase.phrase);
        devLog('[SoulRevealScene] Innate ability:', this.innateAbility?.name);
    }

    /**
     * Get rarity context - odds and bonuses
     */
    getRarityContext(rarity) {
        const contexts = {
            common: {
                odds: '1 in 2 hatches',
                bonus: 'Standard stats',
                statBoost: 0
            },
            uncommon: {
                odds: '1 in 5 hatches',
                bonus: '+10% all stats',
                statBoost: 10
            },
            rare: {
                odds: '1 in 20 hatches',
                bonus: '+25% all stats',
                statBoost: 25
            },
            epic: {
                odds: '1 in 50 hatches',
                bonus: '+40% all stats',
                statBoost: 40
            },
            legendary: {
                odds: '1 in 100 hatches',
                bonus: '+60% all stats · Unique aura',
                statBoost: 60
            }
        };
        return contexts[rarity] || contexts.common;
    }

    /**
     * Get personality preview dialogue samples
     */
    getPersonalityPreview(personality) {
        const previews = {
            curious: {
                greeting: "What's that over there?!",
                happy: "I wonder what we'll discover today!",
                trait: "Loves exploring and asking questions"
            },
            playful: {
                greeting: "Let's play! Please? PLEASE?!",
                happy: "Hehe, that was so much fun!",
                trait: "Always ready for games and mischief"
            },
            gentle: {
                greeting: "Hello, friend...",
                happy: "I'm so happy we're together.",
                trait: "Kind, caring, and peaceful"
            },
            wise: {
                greeting: "I sense something interesting...",
                happy: "Knowledge brings the greatest joy.",
                trait: "Thoughtful and observant"
            },
            energetic: {
                greeting: "WOOO! Let's GO!",
                happy: "I have SO much energy right now!",
                trait: "Boundless enthusiasm and speed"
            }
        };
        return previews[personality] || previews.curious;
    }

    /**
     * Get innate ability (Level 1 skill) for a cosmic affinity with full details
     */
    getInnateAbility(affinity) {
        // Full ability definitions with concrete benefits
        const abilities = {
            star: {
                name: 'Radiant Pulse',
                description: 'Reveals hidden collectibles',
                icon: '✨',
                type: 'exploration',
                color: 0xFFD700,
                range: '300px radius',
                benefit: 'Find treasures others miss'
            },
            moon: {
                name: 'Lunar Sight',
                description: 'Senses rare items nearby',
                icon: '🌙',
                type: 'exploration',
                color: 0xC0C0C0,
                range: '400px radius',
                benefit: 'Locate rare & legendary items'
            },
            nebula: {
                name: 'Mist Veil',
                description: 'Confuses nearby enemies',
                icon: '🌫️',
                type: 'defensive',
                color: 0x9370DB,
                range: '150px radius',
                benefit: 'Escape dangerous situations'
            },
            crystal: {
                name: 'Crystal Sense',
                description: 'Detects crystals & gems',
                icon: '💎',
                type: 'exploration',
                color: 0x00CED1,
                range: '350px radius',
                benefit: 'Maximize crystal collection'
            },
            void: {
                name: 'Void Sense',
                description: 'Reveals secret paths',
                icon: '🌑',
                type: 'exploration',
                color: 0x4B0082,
                range: '500px radius',
                benefit: 'Discover hidden areas'
            }
        };

        return abilities[affinity] || abilities.star;
    }

    /**
     * Create magical background
     */
    createBackground(width, height) {
        // Gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x2d1b4e, 0x2d1b4e, 1);
        bg.fillRect(0, 0, width, height);
        bg.setDepth(0);
        this.elements.push(bg);

        // Twinkling stars
        this.createStarfield(width, height);
    }

    /**
     * Create animated starfield
     */
    createStarfield(width, height) {
        for (let i = 0; i < 50; i++) {
            const star = this.add.graphics();
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 1 + Math.random() * 2;
            const alpha = 0.3 + Math.random() * 0.7;

            star.fillStyle(0xFFFFFF, alpha);
            star.fillCircle(x, y, size);
            star.setDepth(1);
            this.elements.push(star);

            // Twinkle animation
            this.tweens.add({
                targets: star,
                alpha: { from: alpha, to: alpha * 0.3 },
                duration: 1000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
                delay: Math.random() * 1000
            });
        }
    }

    /**
     * Start the dramatic reveal sequence
     */
    startRevealSequence(width, height) {
        const timeline = [];
        let delay = 0;

        // 0.0s - Title
        timeline.push({ delay: delay, fn: () => this.showTitle(width, height) });
        delay += 300;

        // 0.3s - Creature entrance
        timeline.push({ delay: delay, fn: () => this.showCreature(width, height) });
        delay += 700;

        // 1.0s - Rarity badge with context
        timeline.push({ delay: delay, fn: () => this.showRarityBadge(width, height) });
        delay += 500;

        // 1.5s - Ancient Lineage (if applicable)
        if (this.hasAncientLineage) {
            timeline.push({ delay: delay, fn: () => this.showAncientLineage(width, height) });
            delay += 1000;
        }

        // 2.0s - Personality with preview
        timeline.push({ delay: delay, fn: () => this.showPersonality(width, height) });
        delay += 800;

        // 2.8s - Cosmic affinity with power comparison
        timeline.push({ delay: delay, fn: () => this.showCosmicAffinity(width, height) });
        delay += 500;

        // 3.3s - Innate ability with benefits
        timeline.push({ delay: delay, fn: () => this.showInnateAbility(width, height) });
        delay += 600;

        // 3.9s - Name input
        timeline.push({ delay: delay, fn: () => this.showNameInput(width, height) });
        delay += 400;

        // 4.3s - Begin button
        timeline.push({ delay: delay, fn: () => this.showBeginButton(width, height) });

        // Execute timeline
        timeline.forEach(item => {
            this.time.delayedCall(item.delay, item.fn);
        });
    }

    /**
     * Show title with fade animation
     */
    showTitle(width, height) {
        const title = this.add.text(width / 2, height * 0.06, 'A SOUL AWAKENS', {
            fontSize: Math.min(24, width * 0.06) + 'px',
            color: '#E8D5FF',
            fontStyle: 'bold',
            stroke: '#2D1B4E',
            strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0).setDepth(100);
        this.elements.push(title);

        this.tweens.add({
            targets: title,
            alpha: 1,
            y: title.y + 10,
            duration: 500,
            ease: 'Power2'
        });

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playVisionReveal?.();
        }
    }

    /**
     * Show creature with dramatic entrance
     */
    showCreature(width, height) {
        const textureName = this.creatureData.textureName;
        if (!textureName || !this.textures.exists(textureName)) {
            devLog('[SoulRevealScene] No creature texture found');
            return;
        }

        // Calculate creature position and size
        const creatureY = height * 0.22;
        const maxSize = Math.min(width * 0.35, height * 0.2);

        this.creature = this.add.sprite(width / 2, creatureY, textureName);
        const scale = maxSize / Math.max(this.creature.width, this.creature.height);
        this.creature.setScale(0).setDepth(50);
        this.elements.push(this.creature);

        // Dramatic entrance: scale from 0 → 1.1 → 1.0
        this.tweens.add({
            targets: this.creature,
            scale: scale * 1.15,
            duration: 400,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: this.creature,
                    scale: scale,
                    duration: 200,
                    ease: 'Power2'
                });
            }
        });

        // Sparkle burst
        this.createSparkleBurst(width / 2, creatureY);

        // Breathing animation
        this.time.delayedCall(600, () => {
            this.tweens.add({
                targets: this.creature,
                scaleY: scale * 1.03,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });

        // Play baby sound
        if (window.AudioManager) {
            window.AudioManager.playBabyCoo?.();
        }
    }

    /**
     * Create sparkle burst effect
     */
    createSparkleBurst(x, y) {
        const colors = [0xFFD700, 0xE8D5FF, 0xFFFFFF, 0x9B7FEE];

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const distance = 60 + Math.random() * 40;

            const sparkle = this.add.graphics();
            sparkle.fillStyle(colors[i % colors.length], 1);
            // Draw a 4-pointed star shape manually
            const size = 6;
            const points = [
                { x: x, y: y - size },
                { x: x + size * 0.3, y: y - size * 0.3 },
                { x: x + size, y: y },
                { x: x + size * 0.3, y: y + size * 0.3 },
                { x: x, y: y + size },
                { x: x - size * 0.3, y: y + size * 0.3 },
                { x: x - size, y: y },
                { x: x - size * 0.3, y: y - size * 0.3 }
            ];
            sparkle.fillPoints(points, true);
            sparkle.setDepth(45);
            this.elements.push(sparkle);

            this.tweens.add({
                targets: sparkle,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                alpha: 0,
                scale: 0.5,
                duration: 800,
                ease: 'Power2',
                onComplete: () => sparkle.destroy()
            });
        }
    }

    /**
     * Show rarity badge with meaningful context
     */
    showRarityBadge(width, height) {
        const rarityColors = {
            common: { bg: 0x4CAF50, text: '#4CAF50', emoji: '🟢' },
            uncommon: { bg: 0x2196F3, text: '#64B5F6', emoji: '🔵' },
            rare: { bg: 0x9C27B0, text: '#CE93D8', emoji: '🟣' },
            epic: { bg: 0xFF9800, text: '#FFB74D', emoji: '🟠' },
            legendary: { bg: 0xFFD700, text: '#FFD700', emoji: '⭐' }
        };

        const rarity = this.creatureData.rarity;
        const config = rarityColors[rarity] || rarityColors.common;
        const context = this.rarityContext;

        const panelY = height * 0.38;
        const panelWidth = Math.min(width - 30, 320);
        const panelX = (width - panelWidth) / 2;

        // Info panel background
        const panelHeight = height * 0.48;
        this.infoPanel = this.add.graphics();
        this.infoPanel.fillStyle(0x1A1A3E, 0.95);
        this.infoPanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
        this.infoPanel.lineStyle(2, config.bg, 0.8);
        this.infoPanel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
        this.infoPanel.setDepth(30).setAlpha(0);
        this.elements.push(this.infoPanel);

        // Rarity header with emoji
        const rarityText = this.add.text(
            panelX + 15,
            panelY + 12,
            `${config.emoji} ${rarity.toUpperCase()}`,
            {
                fontSize: '16px',
                color: config.text,
                fontStyle: 'bold'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(rarityText);

        // Rarity odds (meaningful context!)
        const oddsText = this.add.text(
            panelX + panelWidth - 15,
            panelY + 14,
            context.odds,
            {
                fontSize: '11px',
                color: '#8B7FBB'
            }
        ).setOrigin(1, 0).setDepth(100).setAlpha(0);
        this.elements.push(oddsText);

        // Bonus indicator
        const bonusText = this.add.text(
            panelX + 15,
            panelY + 32,
            context.bonus,
            {
                fontSize: '11px',
                color: '#7FEEAF'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(bonusText);

        // Store panel bounds for later elements
        this.panelBounds = { x: panelX, y: panelY, width: panelWidth };

        // Fade in
        this.tweens.add({
            targets: [this.infoPanel, rarityText, oddsText, bonusText],
            alpha: 1,
            duration: 400,
            ease: 'Power2'
        });
    }

    /**
     * Show Ancient Lineage prophecy (if triggered)
     */
    showAncientLineage(width, height) {
        // Dim screen briefly
        const dimOverlay = this.add.graphics();
        dimOverlay.fillStyle(0x000000, 0.5);
        dimOverlay.fillRect(0, 0, width, height);
        dimOverlay.setDepth(200).setAlpha(0);
        this.elements.push(dimOverlay);

        this.tweens.add({
            targets: dimOverlay,
            alpha: 0.5,
            duration: 300,
            yoyo: true,
            hold: 1500
        });

        // Prophecy text
        const prophecy = this.add.text(
            width / 2,
            height * 0.15,
            'THE ANCIENT BLOODLINE AWAKENS',
            {
                fontSize: '14px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#4B0082',
                strokeThickness: 3
            }
        ).setOrigin(0.5).setDepth(201).setAlpha(0);
        this.elements.push(prophecy);

        // Golden aura around creature
        if (this.creature) {
            const aura = this.add.graphics();
            aura.fillStyle(0xFFD700, 0.3);
            aura.fillCircle(this.creature.x, this.creature.y, 80);
            aura.setDepth(49).setAlpha(0);
            this.elements.push(aura);

            this.tweens.add({
                targets: aura,
                alpha: { from: 0, to: 0.5 },
                scale: { from: 0.8, to: 1.2 },
                duration: 800,
                yoyo: true,
                repeat: 1
            });
        }

        this.tweens.add({
            targets: prophecy,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });

        // Play special sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp?.();
        }
    }

    /**
     * Show personality with preview dialogue
     */
    showPersonality(width, height) {
        if (!this.panelBounds) return;

        const { x: panelX, y: panelY, width: panelWidth } = this.panelBounds;
        const personalityY = panelY + 55;

        const personality = this.creatureData.personalityCore;
        const preview = this.personalityPreview;

        // Personality header
        const headerText = this.add.text(
            panelX + 15,
            personalityY,
            `${this.getPersonalityEmoji(personality)} ${personality.toUpperCase()} SOUL`,
            {
                fontSize: '13px',
                color: '#CE93D8',
                fontStyle: 'bold'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(headerText);

        // Trait description
        const traitText = this.add.text(
            panelX + 15,
            personalityY + 18,
            preview.trait,
            {
                fontSize: '11px',
                color: '#9B8FBB'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(traitText);

        // Sample dialogue bubble
        const dialogueText = this.add.text(
            panelX + 15,
            personalityY + 36,
            `"${preview.greeting}"`,
            {
                fontSize: '12px',
                color: '#E8D5FF',
                fontStyle: 'italic',
                wordWrap: { width: panelWidth - 30 }
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(dialogueText);

        // Fade in
        this.tweens.add({
            targets: [headerText, traitText, dialogueText],
            alpha: 1,
            duration: 400,
            ease: 'Power2'
        });
    }

    /**
     * Get emoji for personality
     */
    getPersonalityEmoji(personality) {
        const emojis = {
            curious: '🔍',
            playful: '🎮',
            gentle: '💜',
            wise: '📚',
            energetic: '⚡'
        };
        return emojis[personality] || '✨';
    }

    /**
     * Show cosmic affinity with power comparison
     */
    showCosmicAffinity(width, height) {
        if (!this.panelBounds) return;

        const { x: panelX, y: panelY, width: panelWidth } = this.panelBounds;
        const affinityY = panelY + 105;

        // Get affinity info
        const affinity = this.creatureData.cosmicAffinity;
        const power = this.creatureData.powerLevel;
        const emoji = window.SoulPhraseGenerator?.getAffinityEmoji(affinity) || '✨';
        const name = window.SoulPhraseGenerator?.getAffinityName(affinity) || 'Cosmic Soul';

        // Affinity header
        const affinityText = this.add.text(
            panelX + 15,
            affinityY,
            `${emoji} ${name}`,
            {
                fontSize: '13px',
                color: '#9B7FEE',
                fontStyle: 'bold'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(affinityText);

        // Power comparison (meaningful!)
        const powerPercent = Math.round(power * 100);
        const comparisonText = this.add.text(
            panelX + panelWidth - 15,
            affinityY + 2,
            `Top ${100 - powerPercent}%`,
            {
                fontSize: '11px',
                color: '#7FEEAF'
            }
        ).setOrigin(1, 0).setDepth(100).setAlpha(0);
        this.elements.push(comparisonText);

        // Power bar background
        const barX = panelX + 15;
        const barY = affinityY + 20;
        const barWidth = panelWidth - 30;
        const barHeight = 8;

        const barBg = this.add.graphics();
        barBg.fillStyle(0x2D1B4E, 1);
        barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 4);
        barBg.setDepth(99).setAlpha(0);
        this.elements.push(barBg);

        // Power bar fill
        const barFill = this.add.graphics();
        barFill.fillStyle(this.innateAbility.color || 0x9B7FEE, 1);
        barFill.fillRoundedRect(barX, barY, barWidth * power, barHeight, 4);
        barFill.setDepth(100).setAlpha(0);
        this.elements.push(barFill);

        // Fade in
        this.tweens.add({
            targets: [affinityText, comparisonText, barBg, barFill],
            alpha: 1,
            duration: 400,
            ease: 'Power2'
        });
    }

    /**
     * Show innate ability with concrete benefits
     */
    showInnateAbility(width, height) {
        if (!this.panelBounds || !this.innateAbility) return;

        const { x: panelX, y: panelY, width: panelWidth } = this.panelBounds;
        const abilityY = panelY + 145;

        // Ability section header
        const headerText = this.add.text(
            panelX + 15,
            abilityY,
            'INNATE ABILITY',
            {
                fontSize: '10px',
                color: '#7B68EE',
                letterSpacing: 1
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(headerText);

        // Ability card background
        const cardX = panelX + 10;
        const cardY = abilityY + 16;
        const cardWidth = panelWidth - 20;
        const cardHeight = 65;

        const abilityCard = this.add.graphics();
        abilityCard.fillStyle(0x2D1B4E, 0.8);
        abilityCard.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 10);
        abilityCard.lineStyle(2, this.innateAbility.color || 0x9B7FEE, 0.6);
        abilityCard.strokeRoundedRect(cardX, cardY, cardWidth, cardHeight, 10);
        abilityCard.setDepth(99).setAlpha(0);
        this.elements.push(abilityCard);

        // Ability icon
        const iconText = this.add.text(
            cardX + 22,
            cardY + 20,
            this.innateAbility.icon,
            {
                fontSize: '24px'
            }
        ).setOrigin(0.5).setDepth(100).setAlpha(0);
        this.elements.push(iconText);

        // Ability name
        const nameText = this.add.text(
            cardX + 45,
            cardY + 8,
            this.innateAbility.name,
            {
                fontSize: '13px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(nameText);

        // Range/effect (concrete benefit!)
        const rangeText = this.add.text(
            cardX + cardWidth - 10,
            cardY + 10,
            this.innateAbility.range,
            {
                fontSize: '10px',
                color: '#7FEEAF'
            }
        ).setOrigin(1, 0).setDepth(100).setAlpha(0);
        this.elements.push(rangeText);

        // Benefit description (what it actually does for the player)
        const benefitText = this.add.text(
            cardX + 45,
            cardY + 26,
            this.innateAbility.benefit,
            {
                fontSize: '11px',
                color: '#E8D5FF',
                wordWrap: { width: cardWidth - 55 }
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(benefitText);

        // Unlock status
        const unlockText = this.add.text(
            cardX + 45,
            cardY + 45,
            'Available now · Level 1',
            {
                fontSize: '10px',
                color: '#8B7FBB'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(unlockText);

        // Animate in with a flash effect
        const flash = this.add.graphics();
        flash.fillStyle(this.innateAbility.color || 0x9B7FEE, 0.3);
        flash.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 10);
        flash.setDepth(98).setAlpha(0);
        this.elements.push(flash);

        // Flash then fade
        this.tweens.add({
            targets: flash,
            alpha: { from: 0.6, to: 0 },
            duration: 400,
            ease: 'Power2'
        });

        // Fade in elements
        this.tweens.add({
            targets: [headerText, abilityCard, iconText, nameText, rangeText, benefitText, unlockText],
            alpha: 1,
            duration: 400,
            ease: 'Power2'
        });

        // Play a subtle sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }
    }

    /**
     * Show name input field
     */
    showNameInput(width, height) {
        if (!this.panelBounds) return;

        const { x: panelX, width: panelWidth } = this.panelBounds;
        const inputY = height * 0.85;

        // Name label
        const nameLabel = this.add.text(
            width / 2,
            inputY - 25,
            'Name your companion:',
            {
                fontSize: '13px',
                color: '#9B7FEE'
            }
        ).setOrigin(0.5).setDepth(100).setAlpha(0);
        this.elements.push(nameLabel);

        // Input background
        const inputWidth = Math.min(panelWidth - 30, 260);
        const inputX = (width - inputWidth) / 2;

        const inputBg = this.add.graphics();
        inputBg.fillStyle(0x12122A, 1);
        inputBg.fillRoundedRect(inputX, inputY, inputWidth, 36, 10);
        inputBg.lineStyle(2, 0x7B68EE, 0.8);
        inputBg.strokeRoundedRect(inputX, inputY, inputWidth, 36, 10);
        inputBg.setDepth(100).setAlpha(0);
        this.elements.push(inputBg);

        // Input text display
        this.inputText = this.add.text(
            width / 2,
            inputY + 18,
            '|',
            {
                fontSize: '16px',
                color: '#FFFFFF'
            }
        ).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(this.inputText);

        // Store input bounds for click detection
        this.inputBounds = { x: inputX, y: inputY, width: inputWidth, height: 36 };

        // Cursor blink
        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                if (this.inputText && this.inputActive) {
                    const text = this.nameInput || '';
                    const cursor = this.inputText.text.endsWith('|') ? '' : '|';
                    this.inputText.setText(text + cursor);
                }
            }
        });

        // Fade in
        this.tweens.add({
            targets: [nameLabel, inputBg, this.inputText],
            alpha: 1,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
                this.inputActive = true;
                this.createMobileInput(width, inputY);
            }
        });
    }

    /**
     * Create HTML input for mobile keyboards
     */
    createMobileInput(width, inputY) {
        // Create invisible HTML input for mobile keyboard
        this.htmlInput = document.createElement('input');
        this.htmlInput.type = 'text';
        this.htmlInput.maxLength = 20;
        this.htmlInput.autocomplete = 'off';
        this.htmlInput.autocorrect = 'off';
        this.htmlInput.autocapitalize = 'words';
        this.htmlInput.style.position = 'absolute';
        this.htmlInput.style.left = `${(width - 200) / 2}px`;
        this.htmlInput.style.top = `${inputY}px`;
        this.htmlInput.style.width = '200px';
        this.htmlInput.style.height = '36px';
        this.htmlInput.style.opacity = '0.01';
        this.htmlInput.style.fontSize = '16px';
        this.htmlInput.style.zIndex = '1000';
        this.htmlInput.placeholder = 'Enter name...';

        document.body.appendChild(this.htmlInput);

        // Sync input
        this.htmlInput.addEventListener('input', () => {
            this.nameInput = this.htmlInput.value.slice(0, 20);
            this.updateInputDisplay();
        });

        this.htmlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.canProceed) {
                this.finalizeName();
            }
        });

        // Focus on tap
        const inputZone = this.add.zone(
            this.inputBounds.x + this.inputBounds.width / 2,
            this.inputBounds.y + this.inputBounds.height / 2,
            this.inputBounds.width,
            this.inputBounds.height
        ).setInteractive().setDepth(102);

        inputZone.on('pointerdown', () => {
            this.htmlInput.focus();
        });

        this.elements.push(inputZone);
    }

    /**
     * Setup keyboard input for desktop
     */
    setupKeyboardInput() {
        if (!this.input?.keyboard) return;

        this.input.keyboard.on('keydown', (event) => {
            if (!this.inputActive) return;

            if (event.key === 'Enter' && this.canProceed && this.nameInput.length > 0) {
                this.finalizeName();
            } else if (event.key === 'Backspace') {
                this.nameInput = this.nameInput.slice(0, -1);
                this.updateInputDisplay();
            } else if (event.key.length === 1 && this.nameInput.length < 20) {
                // Allow letters, numbers, spaces, common punctuation
                if (/^[a-zA-Z0-9 '\-_]$/.test(event.key)) {
                    this.nameInput += event.key;
                    this.updateInputDisplay();
                }
            }
        });
    }

    /**
     * Update the input text display
     */
    updateInputDisplay() {
        if (this.inputText) {
            this.inputText.setText(this.nameInput + '|');
        }
        if (this.htmlInput) {
            this.htmlInput.value = this.nameInput;
        }
    }

    /**
     * Show begin button (static, no animation)
     */
    showBeginButton(width, height) {
        const btnY = height * 0.93;
        const btnWidth = Math.min(width - 60, 260);
        const btnX = (width - btnWidth) / 2;

        // Button background
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x4CAF50, 1);
        btnBg.fillRoundedRect(btnX, btnY, btnWidth, 44, 12);
        btnBg.lineStyle(2, 0xFFD700, 0.8);
        btnBg.strokeRoundedRect(btnX, btnY, btnWidth, 44, 12);
        btnBg.setDepth(100).setAlpha(0);
        this.elements.push(btnBg);

        // Button text
        const btnText = this.add.text(
            width / 2,
            btnY + 22,
            'BEGIN ADVENTURE',
            {
                fontSize: '16px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(btnText);

        // Interactive zone
        const btnZone = this.add.zone(width / 2, btnY + 22, btnWidth, 44)
            .setInteractive({ cursor: 'pointer' })
            .setDepth(102);

        btnZone.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0x66BB6A, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnWidth, 44, 12);
            btnBg.lineStyle(2, 0xFFD700, 1);
            btnBg.strokeRoundedRect(btnX, btnY, btnWidth, 44, 12);
        });

        btnZone.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x4CAF50, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnWidth, 44, 12);
            btnBg.lineStyle(2, 0xFFD700, 0.8);
            btnBg.strokeRoundedRect(btnX, btnY, btnWidth, 44, 12);
        });

        btnZone.on('pointerdown', () => {
            if (this.canProceed) {
                this.finalizeName();
            } else if (this.nameInput.length === 0) {
                // Flash the input to indicate name needed
                this.tweens.add({
                    targets: this.inputText,
                    alpha: { from: 1, to: 0.3 },
                    duration: 100,
                    yoyo: true,
                    repeat: 2
                });
            }
        });

        this.elements.push(btnZone);

        // Fade in (static button)
        this.tweens.add({
            targets: [btnBg, btnText],
            alpha: 1,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
                this.canProceed = true;
            }
        });
    }

    /**
     * Finalize name and transition to game
     */
    finalizeName() {
        if (!this.canProceed) return;
        if (!this.nameInput || this.nameInput.trim().length === 0) {
            // Generate a random name if empty
            this.nameInput = this.generateRandomName();
        }

        this.canProceed = false;
        this.inputActive = false;

        const finalName = this.nameInput.trim();
        devLog('[SoulRevealScene] Finalizing name:', finalName);

        // Save to GameState
        window.GameState?.set('creature.name', finalName);
        window.GameState?.set('creature.named', true);

        // CRITICAL: Add creature to collection for multi-creature support
        const collectionStatus = window.GameState?.getCollectionStatus?.() || { hasSpace: true };
        if (collectionStatus.hasSpace) {
            const added = window.GameState?.addCreatureToCollection();
            if (added) {
                devLog('[SoulRevealScene] Creature added to collection successfully');
            } else {
                devLog('[SoulRevealScene] Failed to add creature to collection');
            }
        } else {
            devLog('[SoulRevealScene] Collection full, creature not added');
        }

        const genetics = window.GameState?.get('creature.genes');
        window.AchievementSystem?.recordEvent?.('creature_hatched', {
            hatchId: genetics?.id || `primary:${window.GameState?.get('creature.hatchTime')}`,
            rarity: genetics?.rarity || 'common',
            species: genetics?.species || 'unknown'
        });

        // Save soul data for profile page access
        this.saveSoulDataForProfile();

        // Handle Ancient Lineage
        if (this.hasAncientLineage && window.BirthEventSystem) {
            try {
                const lineageData = window.BirthEventSystem.applyAncientLineage?.();
                if (lineageData) {
                    devLog('[SoulRevealScene] Ancient Lineage applied:', lineageData);
                }
            } catch (e) {
                devLog('[SoulRevealScene] Ancient Lineage error:', e);
            }
        }

        // Save state
        window.GameState?.save();

        // Play transition sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp?.();
        }

        // Remove HTML input
        if (this.htmlInput) {
            this.htmlInput.remove();
            this.htmlInput = null;
        }

        // Fade out and transition
        this.cameras.main.fadeOut(800, 0, 0, 0);

        this.time.delayedCall(800, () => {
            this.scene.start('GameScene', { fromSoulReveal: true });
        });
    }

    /**
     * Save soul data to GameState for profile page access
     */
    saveSoulDataForProfile() {
        const soulData = {
            phrase: this.soulPhrase.phrase,
            personality: {
                core: this.creatureData.personalityCore,
                preview: this.personalityPreview
            },
            affinity: {
                element: this.creatureData.cosmicAffinity,
                powerLevel: this.creatureData.powerLevel,
                powerPercent: Math.round(this.creatureData.powerLevel * 100)
            },
            ability: {
                name: this.innateAbility.name,
                icon: this.innateAbility.icon,
                description: this.innateAbility.description,
                benefit: this.innateAbility.benefit,
                range: this.innateAbility.range
            },
            rarity: {
                tier: this.creatureData.rarity,
                context: this.rarityContext
            },
            hasAncientLineage: this.hasAncientLineage,
            mutations: this.creatureData.mutations,
            isShiny: this.creatureData.isShiny,
            shinyType: this.creatureData.shinyType
        };

        window.GameState?.set('creature.soulData', soulData);
        devLog('[SoulRevealScene] Soul data saved for profile:', soulData);
    }

    /**
     * Generate a random creature name
     */
    generateRandomName() {
        const prefixes = ['Luna', 'Nova', 'Spark', 'Star', 'Moon', 'Sky', 'Cloud', 'Mist', 'Glow', 'Shimmer'];
        const suffixes = ['beam', 'dust', 'wing', 'heart', 'soul', 'light', 'shade', 'dream', 'wish', 'song'];

        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

        return prefix + suffix;
    }

    /**
     * Cleanup on shutdown
     */
    shutdown() {
        devLog('[SoulRevealScene] Shutting down');

        // Remove HTML input
        if (this.htmlInput) {
            this.htmlInput.remove();
            this.htmlInput = null;
        }

        // Clear typewriter timer
        if (this.typewriterTimer) {
            this.typewriterTimer.remove();
        }

        // Clear all timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Kill all tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Remove keyboard listeners
        if (this.input?.keyboard) {
            this.input.keyboard.removeAllListeners();
        }

        // Clear references
        this.elements = [];
        this.creature = null;
        this.inputText = null;
        this.infoPanel = null;
    }
}

// Expose globally for Phaser
if (typeof window !== 'undefined') {
    window.SoulRevealScene = SoulRevealScene;
}
