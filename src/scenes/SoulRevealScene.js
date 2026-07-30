/**
 * SoulRevealScene - Unified soul reveal + naming screen
 *
 * Combines the old PersonalityScene and NamingScene into a first-contact reading.
 * Features:
 * - AI-generated unique soul phrases
 * - Meaningful context for all stats (rarity odds, ability benefits, etc.)
 * - Personality preview with sample dialogue
 * - Dramatic sequential animations
 * - Data saved to GameState for profile page access
 */

import Phaser from 'phaser';
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
        this.nameDomElement = null;
        this.portraitPromise = null;
        this.portraitError = null;
        this.portraitDomElement = null;
        this.portraitHandoffActive = false;
    }

    init(data) {
        this.isEggHatch = data?.isEggHatch || false;
        this.eggType = data?.eggType || null;
        this.portraitPreviewImage = data?.portraitPreviewImage || null;
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
        if (this.portraitPreviewImage) {
            this.portraitPromise = new Promise(resolve => {
                this.time.delayedCall(1400, () => resolve({
                    identityKey: 'local-preview',
                    stage: 'baby',
                    imageUrl: this.portraitPreviewImage
                }));
            });
        }

        // Create background
        this.createBackground(width, height);

        // Start the dramatic reveal sequence
        this.startRevealSequence(width, height);

        // Setup keyboard input for desktop
        this.setupKeyboardInput();
        this.events.once('shutdown', this.shutdown, this);

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
        this.portraitCreatureData = {
            name: window.GameState?.get('creature.name') || 'Mythical Creature',
            stage: window.GameState?.get('creature.lifecycle.stage') || 'baby',
            genes: genes || genetics
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
                observation: 'Tracks every light and movement around the wreck.',
                trait: 'Alert, investigative, and quick to notice change'
            },
            playful: {
                observation: 'Mirrors your movements, then waits for a response.',
                trait: 'Social, responsive, and drawn to movement'
            },
            gentle: {
                observation: 'Keeps close when your suit alarm sounds.',
                trait: 'Calm, attentive, and sensitive to distress'
            },
            wise: {
                observation: 'Studies the scanner before approaching you.',
                trait: 'Patient, deliberate, and highly observant'
            },
            energetic: {
                observation: 'Moves first, then checks whether you follow.',
                trait: 'Fast, decisive, and constantly in motion'
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
                displayRange: 'Medium range',
                benefit: 'Find treasures others miss'
            },
            moon: {
                name: 'Lunar Sight',
                description: 'Senses rare items nearby',
                icon: '🌙',
                type: 'exploration',
                color: 0xC0C0C0,
                range: '400px radius',
                displayRange: 'Long range',
                benefit: 'Locate rare & legendary items'
            },
            nebula: {
                name: 'Mist Veil',
                description: 'Confuses nearby enemies',
                icon: '🌫️',
                type: 'defensive',
                color: 0x9370DB,
                range: '150px radius',
                displayRange: 'Short range',
                benefit: 'Escape dangerous situations'
            },
            crystal: {
                name: 'Crystal Sense',
                description: 'Detects crystals & gems',
                icon: '💎',
                type: 'exploration',
                color: 0x00CED1,
                range: '350px radius',
                displayRange: 'Medium range',
                benefit: 'Maximize crystal collection'
            },
            void: {
                name: 'Void Sense',
                description: 'Reveals secret paths',
                icon: '🌑',
                type: 'exploration',
                color: 0x4B0082,
                range: '500px radius',
                displayRange: 'Long range',
                benefit: 'Discover hidden areas'
            }
        };

        return abilities[affinity] || abilities.star;
    }

    getRevealLayout(width = this.scale.width, height = this.scale.height) {
        const compactHeight = height < 660;
        const panelHeight = compactHeight ? 264 : 276;
        const formTail = 156;
        const preferredPanelY = height * (width < 600 ? 0.38 : 0.32);
        const panelY = Math.max(
            compactHeight ? 126 : 150,
            Math.min(preferredPanelY, height - panelHeight - formTail)
        );
        const panelWidth = Math.min(width - 32, 380);
        const panelBottom = panelY + panelHeight;
        const inputHeight = 46;
        const inputTop = panelBottom + 42;
        const buttonTop = panelBottom + 102;

        return {
            compactHeight,
            panelX: (width - panelWidth) / 2,
            panelY,
            panelWidth,
            panelHeight,
            panelBottom,
            titleY: Math.max(30, panelY - (compactHeight ? 142 : 156)),
            creatureY: Math.max(76, panelY - (compactHeight ? 54 : 72)),
            creatureMaxSize: Math.min(
                width * 0.26,
                compactHeight ? 72 : 104
            ),
            inputTop,
            inputHeight,
            inputWidth: Math.min(panelWidth - 24, 320),
            buttonTop,
            buttonHeight: 48
        };
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
        const layout = this.getRevealLayout(width, height);
        const title = this.add.text(width / 2, layout.titleY, 'FIRST CONTACT // INITIAL READINGS', {
            fontSize: Math.min(20, width * 0.047) + 'px',
            fontFamily: 'Arial, sans-serif',
            color: '#DCE8ED',
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
        const layout = this.getRevealLayout(width, height);
        const creatureY = layout.creatureY;
        const maxSize = layout.creatureMaxSize;

        this.creature = this.add.sprite(width / 2, creatureY, textureName);
        const scale = maxSize / Math.max(this.creature.width, this.creature.height);
        this.creature.setScale(0).setDepth(50);
        this.elements.push(this.creature);
        this.beginLivingPortraitPrewarm();

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

    beginLivingPortraitPrewarm() {
        if (
            this.portraitPromise ||
            !this.creature
        ) {
            return;
        }

        if (!this.portraitCreatureData?.genes) {
            return;
        }

        const job = window.LivingPortraitService?.prewarm?.({
            creatureData: this.portraitCreatureData,
            sprite: this.creature,
            style: 'cinematic',
            source: 'post_hatch'
        });
        if (!job) {
            return;
        }

        this.portraitPromise = job;
        job.catch(error => {
            this.portraitError = error;
            devLog('[SoulRevealScene] Portrait prewarm unavailable:', error.message);
        });
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

        const layout = this.getRevealLayout(width, height);
        const {
            panelX,
            panelY,
            panelWidth,
            panelHeight
        } = layout;

        // Info panel background
        this.infoPanel = this.add.graphics();
        this.infoPanel.fillStyle(0x1A1A3E, 0.95);
        this.infoPanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        this.infoPanel.lineStyle(2, config.bg, 0.8);
        this.infoPanel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        this.infoPanel.setDepth(30).setAlpha(0);
        this.elements.push(this.infoPanel);

        // Rarity header with emoji
        const rarityText = this.add.text(
            panelX + 15,
            panelY + 12,
            `FIELD CLASSIFICATION // ${rarity.toUpperCase()}`,
            {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                color: config.text,
                fontStyle: 'bold'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(rarityText);

        // Rarity odds (meaningful context!)
        const oddsText = this.add.text(
            panelX + panelWidth - 15,
            panelY + 34,
            `VARIATION ${context.statBoost > 0 ? `+${context.statBoost}%` : 'BASELINE'}`,
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
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
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#7FEEAF'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(bonusText);

        // Store panel bounds for later elements
        this.panelBounds = {
            x: panelX,
            y: panelY,
            width: panelWidth,
            height: panelHeight
        };

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
        const personalityY = panelY + 60;

        const personality = this.creatureData.personalityCore;
        const preview = this.personalityPreview;

        // Personality header
        const headerText = this.add.text(
            panelX + 15,
            personalityY,
            `OBSERVED TEMPERAMENT // ${personality.toUpperCase()}`,
            {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#CE93D8',
                fontStyle: 'bold'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(headerText);

        // Trait description
        const traitText = this.add.text(
            panelX + 15,
            personalityY + 20,
            preview.trait,
            {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#9B8FBB'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(traitText);

        // Sample dialogue bubble
        const dialogueText = this.add.text(
            panelX + 15,
            personalityY + 42,
            `OBSERVATION // ${preview.observation}`,
            {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#E8D5FF',
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
        const affinityY = panelY + 142;

        // Get affinity info
        const affinity = this.creatureData.cosmicAffinity;
        const power = this.creatureData.powerLevel;
        const emoji = window.SoulPhraseGenerator?.getAffinityEmoji(affinity) || '✨';
        const name = `${String(affinity || 'unknown').toUpperCase()} RESONANCE`;

        // Affinity header
        const affinityText = this.add.text(
            panelX + 15,
            affinityY,
            `${emoji} ${name}`,
            {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
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
            `SIGNAL ${powerPercent}%`,
            {
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
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
        const abilityY = panelY + 181;

        // Ability section header
        const headerText = this.add.text(
            panelX + 15,
            abilityY,
            'INNATE ABILITY',
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#7B68EE',
                letterSpacing: 1
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(headerText);

        // Ability card background
        const cardX = panelX + 10;
        const cardY = abilityY + 16;
        const cardWidth = panelWidth - 20;
        const cardHeight = 64;

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
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(nameText);

        // Range/effect (concrete benefit!)
        const rangeText = this.add.text(
            cardX + cardWidth - 10,
            cardY + 10,
            this.innateAbility.displayRange || this.innateAbility.range,
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
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
                fontFamily: 'Arial, sans-serif',
                color: '#E8D5FF',
                wordWrap: { width: cardWidth - 55 }
            }
        ).setDepth(100).setAlpha(0);
        this.elements.push(benefitText);

        // Unlock status
        const unlockText = this.add.text(
            cardX + 45,
            cardY + 45,
            'Available now',
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
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

        const layout = this.getRevealLayout(width, height);
        const inputY = layout.inputTop;

        // Name label
        const nameLabel = this.add.text(
            width / 2,
            inputY - 20,
            'The creature is watching you. What will you call them?',
            {
                fontSize: width < 500 ? '13px' : '15px',
                fontFamily: 'Arial, sans-serif',
                color: '#C8B8FF',
                align: 'center',
                wordWrap: { width: Math.min(width - 32, 430) }
            }
        ).setOrigin(0.5).setDepth(100).setAlpha(0);
        this.elements.push(nameLabel);

        // Fade in
        this.tweens.add({
            targets: nameLabel,
            alpha: 1,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
                this.inputActive = true;
                this.createMobileInput(width, inputY, layout);
            }
        });
    }

    /**
     * Create a visible native field so mobile browsers open their keyboard from
     * the user's direct tap instead of forwarding focus from the canvas.
     */
    createMobileInput(width, inputY, layout = this.getRevealLayout()) {
        this.nameDomElement?.destroy?.();
        this.htmlInput?.remove?.();

        this.htmlInput = document.createElement('input');
        this.htmlInput.type = 'text';
        this.htmlInput.maxLength = 20;
        this.htmlInput.inputMode = 'text';
        this.htmlInput.enterKeyHint = 'done';
        this.htmlInput.setAttribute('aria-label', 'Name your creature');
        this.htmlInput.setAttribute('data-testid', 'creature-name-input');
        this.htmlInput.autocomplete = 'off';
        this.htmlInput.autocorrect = 'off';
        this.htmlInput.spellcheck = false;
        this.htmlInput.autocapitalize = 'words';
        this.htmlInput.placeholder = 'Enter a name';
        Object.assign(this.htmlInput.style, {
            width: `${layout.inputWidth}px`,
            height: `${layout.inputHeight}px`,
            boxSizing: 'border-box',
            border: '2px solid #7B68EE',
            borderRadius: '6px',
            background: '#101126',
            color: '#FFFFFF',
            caretColor: '#8FE3CF',
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            lineHeight: 'normal',
            padding: '0 14px',
            outline: 'none',
            textAlign: 'center',
            opacity: '1',
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            appearance: 'none',
            WebkitAppearance: 'none'
        });

        this.nameDomElement = this.add.dom(
            width / 2,
            inputY + layout.inputHeight / 2,
            this.htmlInput
        ).setOrigin(0.5).setDepth(105);
        if (this.game.domContainer) {
            this.game.domContainer.style.zIndex = '110';
            this.game.domContainer.style.pointerEvents = 'none';
        }
        this.elements.push(this.nameDomElement);

        // Sync input
        this.htmlInput.addEventListener('input', () => {
            this.nameInput = this.htmlInput.value
                .replace(/[^\p{L}\p{N} '\-_]/gu, '')
                .slice(0, 20);
            this.updateInputDisplay();
        });

        this.htmlInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (
                e.key === 'Enter' &&
                this.canProceed &&
                this.nameInput.trim().length > 0
            ) {
                e.preventDefault();
                this.finalizeName();
            }
        });

        this.htmlInput.addEventListener('focus', () => {
            this.htmlInput.style.borderColor = '#8FE3CF';
            this.htmlInput.style.boxShadow = '0 0 0 3px rgba(143, 227, 207, 0.2)';
        });
        this.htmlInput.addEventListener('blur', () => {
            this.htmlInput.style.borderColor = '#7B68EE';
            this.htmlInput.style.boxShadow = 'none';
        });
    }

    /**
     * Setup keyboard input for desktop
     */
    setupKeyboardInput() {
        if (!this.input?.keyboard) return;

        this.input.keyboard.on('keydown', (event) => {
            if (!this.inputActive) return;
            if (document.activeElement === this.htmlInput) return;

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
        if (this.htmlInput && this.htmlInput.value !== this.nameInput) {
            this.htmlInput.value = this.nameInput;
        }
    }

    /**
     * Show begin button (static, no animation)
     */
    showBeginButton(width, height) {
        const layout = this.getRevealLayout(width, height);
        const btnY = layout.buttonTop;
        const btnWidth = layout.inputWidth;
        const btnX = (width - btnWidth) / 2;

        // Button background
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x4CAF50, 1);
        btnBg.fillRoundedRect(btnX, btnY, btnWidth, 46, 6);
        btnBg.lineStyle(2, 0xFFD700, 0.8);
        btnBg.strokeRoundedRect(btnX, btnY, btnWidth, 46, 6);
        btnBg.setDepth(100).setAlpha(0);
        this.elements.push(btnBg);

        // Button text
        const btnText = this.add.text(
            width / 2,
            btnY + 23,
            'ENTER SANCTUARY',
            {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(btnText);

        // Interactive zone
        const btnZone = this.add.zone(width / 2, btnY + 23, btnWidth, 46)
            .setInteractive({ cursor: 'pointer' })
            .setDepth(102);

        btnZone.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0x66BB6A, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnWidth, 46, 6);
            btnBg.lineStyle(2, 0xFFD700, 1);
            btnBg.strokeRoundedRect(btnX, btnY, btnWidth, 46, 6);
        });

        btnZone.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x4CAF50, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnWidth, 46, 6);
            btnBg.lineStyle(2, 0xFFD700, 0.8);
            btnBg.strokeRoundedRect(btnX, btnY, btnWidth, 46, 6);
        });

        btnZone.on('pointerdown', () => {
            if (!this.nameInput.trim()) {
                this.htmlInput?.focus();
                if (this.htmlInput) {
                    this.htmlInput.style.borderColor = '#F2C14E';
                    this.htmlInput.style.boxShadow = '0 0 0 3px rgba(242, 193, 78, 0.24)';
                }
                return;
            }
            if (this.canProceed) {
                this.finalizeName();
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
            this.htmlInput?.focus();
            return;
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
        this.nameDomElement?.destroy?.();
        this.nameDomElement = null;
        this.htmlInput = null;

        if (this.portraitPromise) {
            this.showLivingPortraitHandoff(finalName);
            return;
        }

        this.transitionToGame();
    }

    transitionToGame() {
        this.portraitHandoffActive = false;
        this.portraitDomElement?.destroy?.();
        this.portraitDomElement = null;
        this.cameras.main.fadeOut(800, 0, 0, 0);

        this.time.delayedCall(800, () => {
            this.scene.start('GameScene', { fromSoulReveal: true });
        });
    }

    showLivingPortraitHandoff(finalName) {
        this.portraitHandoffActive = true;
        this.tweens.killAll();
        this.elements.forEach(element => element?.destroy?.());
        this.elements = [];

        const { width, height } = this.scale;
        const compact = height < 660;
        const bg = this.add.graphics()
            .fillStyle(0x070B16, 1)
            .fillRect(0, 0, width, height)
            .setDepth(1);
        this.elements.push(bg);

        const title = this.add.text(
            width / 2,
            compact ? 34 : 52,
            'LIVING FORM // RESOLVING',
            {
                fontSize: compact ? '18px' : '22px',
                fontFamily: 'Arial, sans-serif',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(20);
        this.elements.push(title);

        const subtitle = this.add.text(
            width / 2,
            compact ? 67 : 90,
            `The Beacon is translating ${finalName}'s pixel form into a living portrait.`,
            {
                fontSize: compact ? '12px' : '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#DCE8ED',
                align: 'center',
                wordWrap: { width: width - 48 }
            }
        ).setOrigin(0.5, 0).setDepth(20);
        this.elements.push(subtitle);

        const textureName = this.creatureData.textureName;
        if (textureName && this.textures.exists(textureName)) {
            const pixelCreature = this.add.sprite(
                width / 2,
                height / 2 - (compact ? 20 : 35),
                textureName
            ).setDepth(15);
            const maxSize = Math.min(width * 0.46, compact ? 180 : 230);
            pixelCreature.setScale(
                maxSize / Math.max(pixelCreature.width, pixelCreature.height)
            );
            this.elements.push(pixelCreature);
            this.tweens.add({
                targets: pixelCreature,
                alpha: { from: 0.65, to: 1 },
                scaleX: pixelCreature.scaleX * 1.03,
                scaleY: pixelCreature.scaleY * 1.03,
                duration: 1100,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        const status = this.add.text(
            width / 2,
            height - (compact ? 122 : 150),
            'Identity locked from genetics, markings, affinity, and temperament.',
            {
                fontSize: compact ? '11px' : '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#AAB6C4',
                align: 'center',
                wordWrap: { width: width - 42 }
            }
        ).setOrigin(0.5).setDepth(20);
        this.elements.push(status);

        const continueButton = this.add.text(
            width / 2,
            height - (compact ? 66 : 82),
            'ENTER SANCTUARY',
            {
                fontSize: compact ? '15px' : '17px',
                fontFamily: 'Arial, sans-serif',
                color: '#071014',
                backgroundColor: '#6FE7DD',
                fontStyle: 'bold',
                padding: { x: 28, y: 12 }
            }
        ).setOrigin(0.5).setDepth(30).setAlpha(0);
        continueButton.setInteractive({ useHandCursor: true });
        continueButton.on('pointerdown', () => this.transitionToGame());
        this.elements.push(continueButton);
        this.tweens.add({
            targets: continueButton,
            alpha: 1,
            duration: 300,
            delay: 800
        });

        this.time.delayedCall(6500, () => {
            if (this.portraitHandoffActive && !this.portraitDomElement) {
                status.setText(
                    'The portrait is still forming. Continue now and it will be saved to the creature profile.'
                );
            }
        });

        this.portraitPromise
            .then(record => {
                if (!record?.imageUrl) {
                    return;
                }
                if (!this.portraitHandoffActive) {
                    window.GameState?.emit?.('notification', {
                        type: 'portraitReady',
                        message: `${finalName}'s living portrait is ready`
                    });
                    return;
                }
                this.revealLivingPortrait(record, finalName, status, title);
            })
            .catch(error => {
                if (this.portraitHandoffActive) {
                    status.setText(
                        `Living portrait unavailable right now. ${error.message}`
                    );
                    status.setColor('#FFCC66');
                }
            });
    }

    revealLivingPortrait(record, finalName, status, title) {
        if (this.portraitDomElement || !record?.imageUrl) {
            return;
        }

        const { width, height } = this.scale;
        const compact = height < 660;
        const image = document.createElement('img');
        image.src = record.imageUrl;
        image.alt = `AI-generated living portrait of ${finalName}`;
        image.referrerPolicy = 'no-referrer';
        image.style.width = `${Math.min(width - 48, compact ? 250 : 320)}px`;
        image.style.height = `${Math.min(height - 250, compact ? 250 : 360)}px`;
        image.style.objectFit = 'contain';
        image.style.border = '2px solid #6FE7DD';
        image.style.borderRadius = '8px';
        image.style.background = '#101820';
        image.style.boxShadow = '0 10px 30px rgba(111, 231, 221, 0.24)';

        this.portraitDomElement = this.add.dom(
            width / 2,
            height / 2 - (compact ? 18 : 28),
            image
        ).setDepth(25);
        title.setText(`${finalName.toUpperCase()} // LIVING FORM`);
        status.setText('AI-GENERATED INTERPRETATION // Saved to creature profile');
        status.setColor('#8FE3CF');
        window.AudioManager?.playLevelUp?.();
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

        this.nameDomElement?.destroy?.();
        this.nameDomElement = null;
        this.portraitHandoffActive = false;
        this.portraitDomElement?.destroy?.();
        this.portraitDomElement = null;
        this.htmlInput = null;

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
