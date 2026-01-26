/**
 * CreatureProfileScene - Full-screen creature profile view
 * Shows detailed information about the current creature including:
 * - Visual representation
 * - Name, species, rarity
 * - Lifecycle stage and age
 * - Stats and personality
 * - Evolution history
 * - Cosmic affinity
 *
 * Database-ready: Uses unique IDs and timestamps for all data
 */

import Phaser from 'phaser';
import evolutionConfig from '../config/evolution.json';
import { devLog } from '../utils/devLogger.js';

export default class CreatureProfileScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CreatureProfileScene' });
        this.graphicsEngine = null;
        this.elements = [];
        this.creatureSprite = null;
        this.scrollY = 0;
        this.maxScroll = 0;
        this.isRestarting = false;
    }

    create() {
        console.log('[CreatureProfileScene] Creating profile view');

        // Reset restarting flag
        this.isRestarting = false;

        // Initialize graphics engine
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
        }

        const { width, height } = this.scale;
        this.isMobile = 'ontouchstart' in window && window.innerWidth < 768;

        // Create background
        this.createBackground();

        // Create header with back button
        this.createHeader();

        // Create scrollable content area
        this.createProfileContent();

        // Set up input
        this.setupInput();

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        console.log('[CreatureProfileScene] Profile view created');
    }

    createBackground() {
        const { width, height } = this.scale;

        // Dark gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0D0D1A, 0x0D0D1A, 0x1A1A3E, 0x1A1A3E, 1);
        bg.fillRect(0, 0, width, height);
        this.elements.push(bg);

        // Subtle star particles
        for (let i = 0; i < 30; i++) {
            const star = this.add.graphics();
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 1 + Math.random() * 2;
            const alpha = 0.3 + Math.random() * 0.5;

            star.fillStyle(0xFFFFFF, alpha);
            star.fillCircle(x, y, size);
            this.elements.push(star);

            // Twinkle animation
            this.tweens.add({
                targets: star,
                alpha: alpha * 0.3,
                duration: 1000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
                delay: Math.random() * 1000
            });
        }
    }

    createHeader() {
        const { width } = this.scale;
        const headerHeight = 60;

        // Header background
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1A1A3E, 0.95);
        headerBg.fillRect(0, 0, width, headerHeight);
        headerBg.lineStyle(1, 0x7B68EE, 0.5);
        headerBg.lineBetween(0, headerHeight, width, headerHeight);
        headerBg.setDepth(100);
        this.elements.push(headerBg);

        // Back button
        const backBtn = this.add.text(20, headerHeight / 2, '← Back', {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#FFFFFF'
        }).setOrigin(0, 0.5).setDepth(101);
        backBtn.setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.goBack());
        backBtn.on('pointerover', () => backBtn.setColor('#FFD700'));
        backBtn.on('pointerout', () => backBtn.setColor('#FFFFFF'));
        this.elements.push(backBtn);

        // Title
        const title = this.add.text(width / 2, headerHeight / 2, 'Creature Profile', {
            fontSize: this.isMobile ? '20px' : '24px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(title);

        // ESC to go back
        this.input.keyboard?.on('keydown-ESC', () => this.goBack());
        this.input.keyboard?.on('keydown-P', () => this.goBack());
    }

    createProfileContent() {
        const { width, height } = this.scale;
        const startY = 80;
        let currentY = startY;

        // Get creature data
        const creatureData = this.getCreatureData();
        if (!creatureData) {
            this.showNoCreatureMessage();
            return;
        }

        // Create creature display (centered, large)
        currentY = this.createCreatureDisplay(creatureData, currentY);

        // Create info sections
        currentY = this.createBasicInfoSection(creatureData, currentY);
        currentY = this.createHeritageSection(creatureData, currentY);
        currentY = this.createLifecycleSection(creatureData, currentY);
        currentY = this.createStatsSection(creatureData, currentY);
        currentY = this.createBondSection(creatureData, currentY);
        currentY = this.createPersonalitySection(creatureData, currentY);
        currentY = this.createEvolutionHistorySection(creatureData, currentY);

        // Dev tools section (only in development mode)
        if (import.meta.env.DEV) {
            currentY = this.createDevToolsSection(creatureData, currentY);
        }

        // Calculate max scroll
        this.maxScroll = Math.max(0, currentY - height + 100);
    }

    getCreatureData() {
        const gs = window.GameState;
        if (!gs) return null;

        const hatched = gs.get('creature.hatched');
        if (!hatched) return null;

        return {
            // Identifiers (database-ready)
            id: gs.get('creature.genes.id') || gs.get('creature.dna.id') || 'unknown',

            // Basic info
            name: gs.get('creature.name') || 'Unnamed',
            species: gs.get('creature.genes.species') || 'Unknown Species',
            rarity: gs.get('creature.genes.rarity') || 'common',

            // Genetics
            genes: gs.get('creature.genes'),
            dna: gs.get('creature.dna'),

            // Lifecycle
            lifecycle: gs.get('creature.lifecycle') || {},
            birthDate: gs.get('creature.lifecycle.birthDate') || gs.get('creature.hatchTime'),
            stage: gs.get('creature.lifecycle.stage') || 'baby',
            evolutionHistory: gs.get('creature.lifecycle.evolutionHistory') || [],

            // Stats
            stats: gs.get('creature.stats') || { health: 100, happiness: 100, energy: 100 },
            level: gs.get('creature.level') || 1,
            experience: gs.get('creature.experience') || 0,

            // Personality
            personality: gs.get('creature.personality'),
            personalityState: gs.get('creature.personalityState'),

            // Cosmic affinity
            cosmicAffinity: gs.get('creature.genes.cosmicAffinity'),

            // Mood
            mood: gs.get('creature.mood.current') || 'happy',

            // Texture
            textureName: gs.get('creature.textureName'),

            // Heritage/Lineage (for bred creatures)
            isOffspring: gs.get('creature.isOffspring') || false,
            generation: gs.get('creature.generation') || 1,
            parentIds: gs.get('creature.parentIds') || [],
            offspringBonus: gs.get('creature.offspringBonus'),

            // Birth events and secret abilities
            birthEvents: gs.get('creature.birthEvents') || [],
            secretAbilities: gs.get('creature.secretAbilities') || [],
            isShiny: gs.get('creature.isShiny') || false,
            hasDualAffinity: gs.get('creature.hasDualAffinity') || false,
            dualAffinity: gs.get('creature.dualAffinity') || null,

            // Ancient Lineage
            hasAncientLineage: gs.get('creature.hasAncientLineage') || false,
            ancientProphecy: gs.get('creature.ancientProphecy') || null,

            // Bond/Relationship data
            bond: gs.getBondStatus?.() || null
        };
    }

    createCreatureDisplay(data, startY) {
        const { width } = this.scale;
        const centerX = width / 2;
        const creatureY = startY + 80;

        // Glow behind creature
        const glow = this.add.graphics();
        const glowColor = this.getRarityColor(data.rarity);
        glow.fillStyle(glowColor, 0.2);
        glow.fillCircle(centerX, creatureY, 80);
        glow.fillStyle(glowColor, 0.1);
        glow.fillCircle(centerX, creatureY, 100);
        this.elements.push(glow);

        // Check if cached texture matches current stage
        const currentStage = data.stage || 'baby';
        const textureMatchesStage = data.textureName && data.textureName.includes(`_${currentStage}`);

        devLog(`[CreatureProfileScene] Creature data:`, {
            hasGenes: !!data.genes,
            hasDNA: !!data.dna,
            textureName: data.textureName,
            stage: currentStage,
            textureMatchesStage
        });

        // Create creature sprite
        if (data.textureName && this.textures.exists(data.textureName) && textureMatchesStage) {
            // Use cached texture only if it matches the current stage
            devLog(`[CreatureProfileScene] Using cached texture: ${data.textureName}`);
            this.creatureSprite = this.add.image(centerX, creatureY, data.textureName);
            this.creatureSprite.setScale(this.isMobile ? 1.0 : 1.2);
        } else if (this.graphicsEngine) {
            // Generate new texture for current stage
            let result = null;

            // Check if genes have valid traits structure (required by createRandomizedSpaceMythicCreature)
            const hasValidGenes = data.genes && data.genes.traits;

            if (data.dna) {
                // Prefer DNA-based rendering (more reliable)
                devLog(`[CreatureProfileScene] Generating from DNA for stage: ${currentStage}`);
                result = this.graphicsEngine.createCreatureFromDNA(
                    data.dna, 0, currentStage
                );
            } else if (hasValidGenes) {
                // Fallback to genes if no DNA
                devLog(`[CreatureProfileScene] Generating from genes for stage: ${currentStage}`);
                result = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                    data.genes, 0, currentStage
                );
            } else {
                console.error('[CreatureProfileScene] No valid DNA or genes data available for creature');
                devLog('[CreatureProfileScene] genes:', data.genes, 'dna:', data.dna);
            }

            if (result?.textureName) {
                devLog(`[CreatureProfileScene] Generated new texture: ${result.textureName}`);
                this.creatureSprite = this.add.image(centerX, creatureY, result.textureName);
                this.creatureSprite.setScale(this.isMobile ? 1.0 : 1.2);

                // Update GameState with new texture name so it's cached correctly
                window.GameState?.set('creature.textureName', result.textureName);
            } else {
                console.error('[CreatureProfileScene] Failed to generate creature texture');
            }
        }

        if (this.creatureSprite) {
            this.creatureSprite.setDepth(10);
            this.elements.push(this.creatureSprite);

            // Gentle floating animation
            this.tweens.add({
                targets: this.creatureSprite,
                y: creatureY - 8,
                duration: 2000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }

        // Creature name
        const nameText = this.add.text(centerX, creatureY + 70, data.name, {
            fontSize: this.isMobile ? '24px' : '28px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(nameText);

        // Species and rarity
        const rarityColor = this.getRarityColorHex(data.rarity);
        const speciesText = this.add.text(centerX, creatureY + 100,
            `${this.capitalizeFirst(data.rarity)} ${data.species}`, {
            fontSize: this.isMobile ? '14px' : '16px',
            color: rarityColor
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(speciesText);

        return creatureY + 130;
    }

    createBasicInfoSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        startY += 20;

        // Section header
        const header = this.createSectionHeader('Basic Info', startY);
        startY = header.y + 30;

        // Info grid
        const infoItems = [
            { label: 'Level', value: `${data.level}`, icon: '⭐' },
            { label: 'Experience', value: `${data.experience} XP`, icon: '✨' },
            { label: 'Mood', value: this.capitalizeFirst(data.mood), icon: this.getMoodIcon(data.mood) }
        ];

        if (data.cosmicAffinity) {
            infoItems.push({
                label: 'Cosmic Affinity',
                value: this.capitalizeFirst(data.cosmicAffinity.element || 'None'),
                icon: this.getAffinityIcon(data.cosmicAffinity.element)
            });
        }

        const itemsPerRow = this.isMobile ? 2 : 3;
        const itemWidth = (width - padding * 2) / itemsPerRow;

        infoItems.forEach((item, index) => {
            const col = index % itemsPerRow;
            const row = Math.floor(index / itemsPerRow);
            const x = padding + col * itemWidth + itemWidth / 2;
            const y = startY + row * 50;

            this.createInfoItem(x, y, item);
        });

        return startY + Math.ceil(infoItems.length / itemsPerRow) * 50 + 10;
    }

    /**
     * Create heritage/lineage section for bred creatures
     * Shows family tree, parents, generation, and bloodline bonuses
     */
    createHeritageSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        // Only show if creature is an offspring or generation > 1
        if (!data.isOffspring && data.generation <= 1) {
            return startY;
        }

        startY += 20;

        const header = this.createSectionHeader('🧬 Heritage & Bloodline', startY);
        startY = header.y + 30;

        // Generation badge (prominent)
        const genBadgeWidth = 120;
        const genBadgeHeight = 40;
        const genBadgeX = width / 2 - genBadgeWidth / 2;

        const genBadge = this.add.graphics();
        genBadge.fillStyle(0x4B0082, 0.9);
        genBadge.fillRoundedRect(genBadgeX, startY, genBadgeWidth, genBadgeHeight, 10);
        genBadge.lineStyle(2, 0xFFD700, 1);
        genBadge.strokeRoundedRect(genBadgeX, startY, genBadgeWidth, genBadgeHeight, 10);
        genBadge.setDepth(11);
        this.elements.push(genBadge);

        const genText = this.add.text(width / 2, startY + genBadgeHeight / 2, `Generation ${data.generation}`, {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(genText);

        startY += genBadgeHeight + 20;

        // Family Tree Visualization
        startY = this.createFamilyTreeDisplay(data, startY, padding, width);

        // Bloodline Bonuses (if any)
        if (data.offspringBonus) {
            startY += 15;

            const bonusHeader = this.add.text(padding, startY, '✨ Bloodline Bonuses', {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#88FF88',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(bonusHeader);

            startY += 25;

            // Cosmic Power bonus
            if (data.offspringBonus.cosmicPower && data.offspringBonus.cosmicPower > 1) {
                const powerBonus = Math.round((data.offspringBonus.cosmicPower - 1) * 100);
                const bonusText = this.add.text(padding + 15, startY, `💫 +${powerBonus}% Cosmic Power`, {
                    fontSize: '14px',
                    color: '#AAFFAA'
                }).setDepth(11);
                this.elements.push(bonusText);
                startY += 22;
            }

            // Description
            if (data.offspringBonus.description) {
                const descText = this.add.text(padding + 15, startY, `🎖️ ${data.offspringBonus.description}`, {
                    fontSize: '14px',
                    color: '#88CCFF'
                }).setDepth(11);
                this.elements.push(descText);
                startY += 22;
            }
        }

        // Generation benefits explanation
        startY += 10;
        const benefitText = this.add.text(padding, startY,
            `Higher generations gain stronger cosmic abilities!\nGen ${data.generation} creatures earn +${(data.generation - 1) * 5}% experience.`, {
            fontSize: '12px',
            color: '#888888',
            wordWrap: { width: width - padding * 2 }
        }).setDepth(11);
        this.elements.push(benefitText);
        startY += 45;

        // BIRTH EVENTS: Display special events that occurred at birth
        if (data.birthEvents && data.birthEvents.length > 0) {
            const eventHeader = this.add.text(padding, startY, '🎊 Birth Events', {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#FFD700',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(eventHeader);
            startY += 25;

            data.birthEvents.forEach(event => {
                const eventText = this.add.text(padding + 15, startY, event.message || event.name, {
                    fontSize: '13px',
                    color: this.getBirthEventColor(event.rarity)
                }).setDepth(11);
                this.elements.push(eventText);
                startY += 20;
            });

            startY += 10;
        }

        // SECRET ABILITIES: Display unlocked special abilities
        if (data.secretAbilities && data.secretAbilities.length > 0) {
            const abilityHeader = this.add.text(padding, startY, '🌟 Secret Abilities', {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#FF69B4',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(abilityHeader);
            startY += 25;

            data.secretAbilities.forEach(ability => {
                const abilityRow = this.add.text(padding + 15, startY, `${ability.icon || '⭐'} ${ability.name}`, {
                    fontSize: '13px',
                    color: '#E0BBE4',
                    fontStyle: 'bold'
                }).setDepth(11);
                this.elements.push(abilityRow);
                startY += 18;

                // Show ability description
                if (ability.description) {
                    const descText = this.add.text(padding + 30, startY, ability.description, {
                        fontSize: '11px',
                        color: '#AAAAAA',
                        wordWrap: { width: width - padding * 2 - 30 }
                    }).setDepth(11);
                    this.elements.push(descText);
                    startY += 18;
                }
            });

            startY += 10;
        }

        // ANCIENT LINEAGE: Show prophecy for ancient creatures
        if (data.hasAncientLineage && data.ancientProphecy) {
            startY += 5;
            const ancientHeader = this.add.text(padding, startY, '🌌 Ancient Lineage', {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#9B59B6',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(ancientHeader);
            startY += 25;

            const prophecyText = this.add.text(padding + 15, startY, `"${data.ancientProphecy}"`, {
                fontSize: '12px',
                color: '#DDA0DD',
                fontStyle: 'italic',
                wordWrap: { width: width - padding * 2 - 30 }
            }).setDepth(11);
            this.elements.push(prophecyText);
            startY += prophecyText.height + 15;
        }

        // SHINY indicator
        if (data.isShiny) {
            const shinyBadge = this.add.text(padding, startY, '✨ SHINY CREATURE ✨', {
                fontSize: '14px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setDepth(11);
            this.elements.push(shinyBadge);
            startY += 25;
        }

        // DUAL AFFINITY display
        if (data.hasDualAffinity && data.dualAffinity) {
            const affinityIcons = {
                star: '⭐', moon: '🌙', nebula: '🌌', crystal: '💎', void: '🕳️'
            };
            const icon1 = affinityIcons[data.dualAffinity.primary] || '✨';
            const icon2 = affinityIcons[data.dualAffinity.secondary] || '✨';

            const dualText = this.add.text(padding, startY,
                `${icon1} ${icon2} Dual Affinity: ${data.dualAffinity.primary} + ${data.dualAffinity.secondary}`, {
                fontSize: '14px',
                color: '#88CCFF',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(dualText);
            startY += 25;
        }

        return startY + 10;
    }

    /**
     * Get color for birth event based on rarity
     */
    getBirthEventColor(rarity) {
        const colors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            ultraRare: '#FF00FF',
            legendary: '#FFD700'
        };
        return colors[rarity] || '#FFFFFF';
    }

    /**
     * Create family tree visualization showing parents and lineage
     */
    createFamilyTreeDisplay(data, startY, padding, width) {
        // Get parent data from collection
        const collection = window.GameState?.get('creatures') || [];
        const parentIds = data.parentIds || [];

        // Find parent creatures in collection
        const parent1 = parentIds[0] ? this.findCreatureById(parentIds[0], collection) : null;
        const parent2 = parentIds[1] ? parentIds[1] !== parentIds[0] ? this.findCreatureById(parentIds[1], collection) : null : null;

        if (!parent1 && !parent2 && parentIds.length === 0) {
            // No parent info available - show origin info
            const originText = this.add.text(width / 2, startY, '🥚 Hatched from Egg', {
                fontSize: '14px',
                color: '#AAAAAA'
            }).setOrigin(0.5).setDepth(11);
            this.elements.push(originText);
            return startY + 30;
        }

        // Family tree header
        const treeHeader = this.add.text(width / 2, startY, '👪 Family Tree', {
            fontSize: this.isMobile ? '14px' : '16px',
            color: '#E6E6FA',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(treeHeader);

        startY += 30;

        // Parents row
        const parentWidth = (width - padding * 3) / 2;
        const parentHeight = 80;

        // Draw connecting lines (family tree structure)
        const lineGraphics = this.add.graphics();
        lineGraphics.lineStyle(2, 0x7B68EE, 0.6);

        // Parent 1 card
        const p1X = padding;
        this.createParentCard(p1X, startY, parentWidth, parentHeight, parent1, parentIds[0], '💜');

        // Parent 2 card
        const p2X = width - padding - parentWidth;
        this.createParentCard(p2X, startY, parentWidth, parentHeight, parent2, parentIds[1], '💙');

        // Draw connecting lines
        const centerX = width / 2;
        const connectY = startY + parentHeight + 10;

        // Lines from parents to center
        lineGraphics.lineBetween(p1X + parentWidth / 2, startY + parentHeight, centerX, connectY);
        lineGraphics.lineBetween(p2X + parentWidth / 2, startY + parentHeight, centerX, connectY);

        // Line from center down to "You" indicator
        lineGraphics.lineBetween(centerX, connectY, centerX, connectY + 25);

        lineGraphics.setDepth(10);
        this.elements.push(lineGraphics);

        startY += parentHeight + 15;

        // "You" indicator (offspring - current creature) with gold border
        const youPortraitRadius = 20;
        const youPortraitY = startY + 25;

        // Gold portrait circle background for current creature
        const youPortraitBg = this.add.graphics();
        youPortraitBg.fillStyle(0x1A1A3E, 0.9);
        youPortraitBg.fillCircle(centerX, youPortraitY, youPortraitRadius + 4);
        youPortraitBg.lineStyle(3, 0xFFD700, 1); // Gold border for current creature
        youPortraitBg.strokeCircle(centerX, youPortraitY, youPortraitRadius + 4);
        youPortraitBg.setDepth(11);
        this.elements.push(youPortraitBg);

        // Render mini creature portrait
        if (data.genes && this.graphicsEngine) {
            try {
                const textureName = data.textureName || window.GameState?.get('creature.textureName');
                if (textureName && this.textures.exists(textureName)) {
                    const portrait = this.add.sprite(centerX, youPortraitY, textureName);
                    portrait.setScale(0.3);
                    portrait.setDepth(12);
                    this.elements.push(portrait);
                } else {
                    // Generate texture
                    const { textureName: newTexture } = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                        data.genes, 0, data.stage || 'adult'
                    );
                    const portrait = this.add.sprite(centerX, youPortraitY, newTexture);
                    portrait.setScale(0.3);
                    portrait.setDepth(12);
                    this.elements.push(portrait);
                }
            } catch (e) {
                // Fallback to star emoji
                const youEmoji = this.add.text(centerX, youPortraitY, '⭐', {
                    fontSize: '18px'
                }).setOrigin(0.5).setDepth(12);
                this.elements.push(youEmoji);
            }
        } else {
            const youEmoji = this.add.text(centerX, youPortraitY, '⭐', {
                fontSize: '18px'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(youEmoji);
        }

        // "You" label with name
        const youText = this.add.text(centerX, youPortraitY + youPortraitRadius + 12, data.name, {
            fontSize: '12px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(youText);

        // Current creature badge
        const currentBadge = this.add.text(centerX, youPortraitY + youPortraitRadius + 26, '(You)', {
            fontSize: '10px',
            color: '#88FF88'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(currentBadge);

        return startY + 70;
    }

    /**
     * Create a parent card for the family tree with mini creature portrait
     */
    createParentCard(x, y, width, height, parentData, parentId, emoji) {
        // Card background
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x2A1A4E, 0.9);
        cardBg.fillRoundedRect(x, y, width, height, 10);
        cardBg.lineStyle(1, 0x7B68EE, 0.6);
        cardBg.strokeRoundedRect(x, y, width, height, 10);
        cardBg.setDepth(11);
        this.elements.push(cardBg);

        const centerX = x + width / 2;
        const portraitRadius = 22;

        if (parentData) {
            // Parent found - show details
            const rarity = parentData.rarity || parentData.genes?.rarity || 'common';
            const rarityColor = this.getRarityColorHex(rarity);
            const rarityColorNum = this.getRarityColor(rarity);

            // Mini creature portrait circle
            const portraitY = y + 28;
            const portraitBg = this.add.graphics();
            portraitBg.fillStyle(0x1A1A3E, 0.9);
            portraitBg.fillCircle(centerX, portraitY, portraitRadius + 3);
            portraitBg.lineStyle(2, rarityColorNum, 0.9); // Rarity-colored border
            portraitBg.strokeCircle(centerX, portraitY, portraitRadius + 3);
            portraitBg.setDepth(12);
            this.elements.push(portraitBg);

            // Try to render mini creature if we have genetics
            if (parentData.genes && this.graphicsEngine) {
                try {
                    const { textureName } = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                        parentData.genes, 0, 'adult'
                    );
                    const portrait = this.add.sprite(centerX, portraitY, textureName);
                    portrait.setScale(0.35);
                    portrait.setDepth(13);
                    this.elements.push(portrait);
                } catch (e) {
                    // Fallback to emoji
                    const emojiText = this.add.text(centerX, portraitY, emoji, {
                        fontSize: '20px'
                    }).setOrigin(0.5).setDepth(13);
                    this.elements.push(emojiText);
                }
            } else {
                // Emoji fallback when no genetics
                const emojiText = this.add.text(centerX, portraitY, emoji, {
                    fontSize: '20px'
                }).setOrigin(0.5).setDepth(13);
                this.elements.push(emojiText);
            }

            // Rarity dot indicator
            const dotX = centerX + portraitRadius;
            const dotY = portraitY - portraitRadius + 5;
            const dotBg = this.add.graphics();
            dotBg.fillStyle(rarityColorNum, 1);
            dotBg.fillCircle(dotX, dotY, 6);
            dotBg.lineStyle(1, 0xFFFFFF, 0.8);
            dotBg.strokeCircle(dotX, dotY, 6);
            dotBg.setDepth(14);
            this.elements.push(dotBg);

            // Parent name (below portrait)
            const nameText = this.add.text(centerX, y + 55, parentData.name || 'Unknown', {
                fontSize: '12px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(nameText);

            // Rarity + Generation
            const gen = parentData.generation || 1;
            const infoText = this.add.text(centerX, y + 70, `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} • Gen ${gen}`, {
                fontSize: '9px',
                color: rarityColor
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(infoText);
        } else {
            // Parent not found (may have been released or data lost)
            const portraitY = y + 28;
            const portraitBg = this.add.graphics();
            portraitBg.fillStyle(0x1A1A3E, 0.9);
            portraitBg.fillCircle(centerX, portraitY, portraitRadius + 3);
            portraitBg.lineStyle(2, 0x444444, 0.6);
            portraitBg.strokeCircle(centerX, portraitY, portraitRadius + 3);
            portraitBg.setDepth(12);
            this.elements.push(portraitBg);

            const unknownEmoji = this.add.text(centerX, portraitY, '❓', {
                fontSize: '22px'
            }).setOrigin(0.5).setDepth(13);
            this.elements.push(unknownEmoji);

            const unknownText = this.add.text(centerX, y + 55, 'Unknown', {
                fontSize: '11px',
                color: '#666666'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(unknownText);

            if (parentId) {
                const idText = this.add.text(centerX, y + 70, `ID: ${parentId.slice(-6)}`, {
                    fontSize: '8px',
                    color: '#444444'
                }).setOrigin(0.5).setDepth(12);
                this.elements.push(idText);
            }
        }
    }

    /**
     * Get rarity color as number (for graphics)
     */
    getRarityColor(rarity) {
        const colors = {
            common: 0x4CAF50,
            uncommon: 0x03A9F4,
            rare: 0xE91E63,
            epic: 0x9C27B0,
            legendary: 0xFFD700
        };
        return colors[rarity] || colors.common;
    }

    /**
     * Find a creature by ID in the collection
     */
    findCreatureById(id, collection) {
        if (!id || !collection) return null;

        return collection.find(c =>
            c.id === id ||
            c.genes?.id === id ||
            c.dna?.id === id
        );
    }

    createLifecycleSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        startY += 20;

        const header = this.createSectionHeader('Lifecycle', startY);
        startY = header.y + 30;

        // Calculate days alive
        const daysAlive = data.birthDate
            ? Math.floor((Date.now() - data.birthDate) / (1000 * 60 * 60 * 24))
            : 0;

        // Stage info
        const stageConfig = evolutionConfig.stages[data.stage] || {};
        const stageIcon = stageConfig.icon || '🐣';
        const stageName = stageConfig.displayName || this.capitalizeFirst(data.stage);

        // Stage display
        const stageText = this.add.text(padding, startY, `${stageIcon} Stage: ${stageName}`, {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#FFFFFF'
        }).setDepth(11);
        this.elements.push(stageText);

        startY += 30;

        // Age
        const ageText = this.add.text(padding, startY, `🗓️ Age: ${daysAlive} day${daysAlive !== 1 ? 's' : ''} old`, {
            fontSize: this.isMobile ? '14px' : '16px',
            color: '#AAAAAA'
        }).setDepth(11);
        this.elements.push(ageText);

        startY += 25;

        // Lifespan progress bar
        const totalLifespan = evolutionConfig.departure?.totalLifespanDays || 90;
        const lifeProgress = Math.min(daysAlive / totalLifespan, 1);

        const barWidth = width - padding * 2;
        const barHeight = 8;

        // Bar background
        const barBg = this.add.graphics();
        barBg.fillStyle(0x2A2A4E, 1);
        barBg.fillRoundedRect(padding, startY, barWidth, barHeight, 4);
        barBg.setDepth(11);
        this.elements.push(barBg);

        // Bar fill
        const barFill = this.add.graphics();
        const fillColor = lifeProgress > 0.9 ? 0xE6E6FA : (lifeProgress > 0.7 ? 0xFFD700 : 0x7B68EE);
        barFill.fillStyle(fillColor, 1);
        barFill.fillRoundedRect(padding, startY, barWidth * lifeProgress, barHeight, 4);
        barFill.setDepth(12);
        this.elements.push(barFill);

        startY += 20;

        // Days remaining
        const daysRemaining = Math.max(0, totalLifespan - daysAlive);
        const remainingText = this.add.text(padding, startY,
            daysRemaining > 0
                ? `${daysRemaining} days until cosmic journey`
                : 'Ready for cosmic journey', {
            fontSize: '12px',
            color: lifeProgress > 0.9 ? '#E6E6FA' : '#888888'
        }).setDepth(11);
        this.elements.push(remainingText);

        startY += 30;

        // DEV ONLY: Stage testing UI
        if (import.meta.env.DEV) {
            startY = this.createStageTestingUI(data, startY, padding, width);
        }

        return startY + 10;
    }

    /**
     * DEV ONLY: Create stage testing UI for visualizing lifecycle progression
     */
    createStageTestingUI(data, startY, padding, width) {
        startY += 10;

        // Section header
        const devHeader = this.add.text(padding, startY, '🧪 DEV: Stage Testing', {
            fontSize: '14px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setDepth(11);
        this.elements.push(devHeader);

        startY += 30;

        const stages = ['baby', 'juvenile', 'adult', 'elder'];
        const stageInfo = {
            baby: { icon: '🐣', label: 'Baby', color: 0x90EE90 },
            juvenile: { icon: '🌱', label: 'Juvenile', color: 0x87CEEB },
            adult: { icon: '✨', label: 'Adult', color: 0x9370DB },
            elder: { icon: '👑', label: 'Elder', color: 0xFFD700 }
        };

        const buttonWidth = (width - padding * 2 - 30) / 4;
        const currentStage = data.stage || 'baby';

        stages.forEach((stage, index) => {
            const x = padding + index * (buttonWidth + 10);
            const info = stageInfo[stage];
            const isActive = stage === currentStage;

            // Button background
            const btnBg = this.add.graphics();
            btnBg.fillStyle(isActive ? info.color : 0x2A2A4E, isActive ? 1 : 0.5);
            btnBg.fillRoundedRect(x, startY, buttonWidth, 50, 8);
            if (isActive) {
                btnBg.lineStyle(2, 0xFFD700, 1);
                btnBg.strokeRoundedRect(x, startY, buttonWidth, 50, 8);
            }
            btnBg.setDepth(11);
            this.elements.push(btnBg);

            // Icon and label
            const btnText = this.add.text(x + buttonWidth / 2, startY + 15, info.icon, {
                fontSize: '20px'
            }).setOrigin(0.5, 0).setDepth(12);
            this.elements.push(btnText);

            const btnLabel = this.add.text(x + buttonWidth / 2, startY + 32, info.label, {
                fontSize: '10px',
                color: isActive ? '#FFFFFF' : '#888888'
            }).setOrigin(0.5, 0).setDepth(12);
            this.elements.push(btnLabel);

            // Make interactive
            const hitZone = this.add.zone(x, startY, buttonWidth, 50);
            hitZone.setInteractive({ useHandCursor: true });
            hitZone.setDepth(13);

            hitZone.on('pointerdown', () => {
                // Prevent double-clicks during restart
                if (this.isRestarting) return;
                this.isRestarting = true;

                console.log(`[CreatureProfileScene] DEV: Changing stage to ${stage}`);

                // Play sound immediately for feedback
                if (window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }

                // Calculate birth date for this stage
                const stageDays = { baby: 0, juvenile: 1, adult: 3, elder: 10 };
                const daysNeeded = stageDays[stage] || 0;
                const newBirthDate = Date.now() - (daysNeeded * 24 * 60 * 60 * 1000);

                // Update active creature's GameState
                window.GameState?.set('creature.lifecycle.stage', stage);
                window.GameState?.set('creature.lifecycle.birthDate', newBirthDate);
                window.GameState?.set('creature.lifecycle.lastStageChange', Date.now());

                // Update visual days (approximate for each stage)
                const visualDays = { baby: 1, juvenile: 4, adult: 10, elder: 35 };
                window.GameState?.set('creature.lifecycle.daysAlive', visualDays[stage]);

                // Clear cached texture to force regeneration
                window.GameState?.set('creature.textureName', null);

                // CRITICAL: Also sync to creatures collection for breeding system
                const activeCreatureId = window.GameState?.get('creature.genes.id') ||
                                         window.GameState?.get('creature.dna.id');
                const collection = window.GameState?.get('creatures') || [];

                if (activeCreatureId && collection.length > 0) {
                    // Find and update the creature in collection
                    const creatureIndex = collection.findIndex(c =>
                        c.id === activeCreatureId ||
                        c.genes?.id === activeCreatureId ||
                        c.dna?.id === activeCreatureId
                    );

                    if (creatureIndex >= 0) {
                        // Update lifecycle in collection
                        if (!collection[creatureIndex].lifecycle) {
                            collection[creatureIndex].lifecycle = { evolutionHistory: [] };
                        }
                        collection[creatureIndex].lifecycle.stage = stage;
                        collection[creatureIndex].lifecycle.birthDate = newBirthDate;
                        collection[creatureIndex].lifecycle.lastStageChange = Date.now();

                        window.GameState?.set('creatures', collection);
                        console.log(`[CreatureProfileScene] DEV: Synced stage to collection creature at index ${creatureIndex}`);
                    }
                }

                // Save and restart
                window.GameState?.save?.();

                // Slight delay to prevent sticky pointer state, then restart
                this.time.delayedCall(50, () => {
                    this.scene.restart();
                });
            });

            // Hover effects
            hitZone.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(info.color, 0.8);
                btnBg.fillRoundedRect(x, startY, buttonWidth, 50, 8);
                btnLabel.setColor('#FFFFFF');
            });

            hitZone.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(isActive ? info.color : 0x2A2A4E, isActive ? 1 : 0.5);
                btnBg.fillRoundedRect(x, startY, buttonWidth, 50, 8);
                if (isActive) {
                    btnBg.lineStyle(2, 0xFFD700, 1);
                    btnBg.strokeRoundedRect(x, startY, buttonWidth, 50, 8);
                }
                btnLabel.setColor(isActive ? '#FFFFFF' : '#888888');
            });

            this.elements.push(hitZone);
        });

        startY += 60;

        // Info text
        const infoText = this.add.text(padding, startY,
            'Click a stage to see how your creature looks at that age.\nThe creature will update in the main game.',
            {
                fontSize: '10px',
                color: '#888888',
                align: 'center',
                wordWrap: { width: width - padding * 2 }
            }
        ).setDepth(11);
        this.elements.push(infoText);

        return startY + 35;
    }

    createStatsSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        startY += 20;

        const header = this.createSectionHeader('Stats', startY);
        startY = header.y + 30;

        const stats = [
            { key: 'health', label: 'Health', color: 0xFF6B6B, icon: '❤️' },
            { key: 'happiness', label: 'Happiness', color: 0xFFD93D, icon: '😊' },
            { key: 'energy', label: 'Energy', color: 0x6BCB77, icon: '⚡' }
        ];

        stats.forEach((stat, index) => {
            const y = startY + index * 40;
            const value = data.stats[stat.key] || 0;

            // Label
            const label = this.add.text(padding, y, `${stat.icon} ${stat.label}`, {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#FFFFFF'
            }).setDepth(11);
            this.elements.push(label);

            // Bar
            const barX = padding + 120;
            const barWidth = width - barX - padding - 50;
            const barHeight = 12;

            const barBg = this.add.graphics();
            barBg.fillStyle(0x2A2A4E, 1);
            barBg.fillRoundedRect(barX, y + 2, barWidth, barHeight, 6);
            barBg.setDepth(11);
            this.elements.push(barBg);

            const barFill = this.add.graphics();
            barFill.fillStyle(stat.color, 1);
            barFill.fillRoundedRect(barX, y + 2, barWidth * (value / 100), barHeight, 6);
            barFill.setDepth(12);
            this.elements.push(barFill);

            // Value
            const valueText = this.add.text(width - padding, y + 2, `${Math.round(value)}%`, {
                fontSize: '14px',
                color: '#FFFFFF'
            }).setOrigin(1, 0).setDepth(11);
            this.elements.push(valueText);
        });

        return startY + stats.length * 40 + 10;
    }

    /**
     * Create bond/relationship section
     */
    createBondSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        // Get bond data
        const bond = data.bond;
        if (!bond) {
            return startY;
        }

        startY += 20;

        const header = this.createSectionHeader('Relationship', startY);
        startY = header.y + 30;

        // Bond level with title
        const levelTitle = bond.description?.title || 'Stranger';
        const bondHeader = this.add.text(padding, startY, `💜 Bond Level ${bond.level}: ${levelTitle}`, {
            fontSize: this.isMobile ? '16px' : '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#E040FB',
            fontStyle: 'bold'
        }).setDepth(11);
        this.elements.push(bondHeader);

        startY += 30;

        // Progress bar to next level
        const barX = padding;
        const barWidth = width - padding * 2;
        const barHeight = 16;

        const barBg = this.add.graphics();
        barBg.fillStyle(0x2A2A4E, 1);
        barBg.fillRoundedRect(barX, startY, barWidth, barHeight, 8);
        barBg.setDepth(11);
        this.elements.push(barBg);

        const progressPercent = bond.progressPercent / 100;
        const barFill = this.add.graphics();
        barFill.fillStyle(0xE040FB, 1);
        barFill.fillRoundedRect(barX, startY, barWidth * progressPercent, barHeight, 8);
        barFill.setDepth(12);
        this.elements.push(barFill);

        // XP text
        const xpText = this.add.text(width / 2, startY + barHeight / 2,
            `${bond.xpInCurrentLevel} / ${bond.xpPerLevel} XP`, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(13);
        this.elements.push(xpText);

        startY += 30;

        // Current perk
        if (bond.description?.perk) {
            const perkText = this.add.text(padding, startY, `✨ ${bond.description.perk}`, {
                fontSize: this.isMobile ? '13px' : '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFD700'
            }).setDepth(11);
            this.elements.push(perkText);
            startY += 25;
        }

        // Statistics grid
        startY += 10;
        const statItems = [
            { icon: '🤲', label: 'Care Actions', value: bond.careActions || 0 },
            { icon: '💬', label: 'Conversations', value: bond.conversations || 0 },
            { icon: '🏆', label: 'Levels Completed', value: bond.levelsCompleted || 0 },
            { icon: '🎯', label: 'Total Interactions', value: bond.totalInteractions || 0 }
        ];

        const colWidth = (width - padding * 2) / 2;
        statItems.forEach((stat, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = padding + col * colWidth;
            const y = startY + row * 28;

            const statText = this.add.text(x, y, `${stat.icon} ${stat.label}: ${stat.value}`, {
                fontSize: this.isMobile ? '12px' : '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#AAAAAA'
            }).setDepth(11);
            this.elements.push(statText);
        });

        startY += 60;

        // Ability slots status
        const slots = bond.abilitySlots || { slot1: true, slot2: false, slot3: false };
        const slotText = this.add.text(padding, startY, '⚔️ Ability Slots:', {
            fontSize: this.isMobile ? '14px' : '15px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setDepth(11);
        this.elements.push(slotText);

        // Slot indicators
        const slotStartX = padding + slotText.width + 15;
        for (let i = 1; i <= 3; i++) {
            const slotKey = `slot${i}`;
            const isUnlocked = slots[slotKey];
            const slotX = slotStartX + (i - 1) * 35;

            const slotBg = this.add.graphics();
            slotBg.fillStyle(isUnlocked ? 0x7B68EE : 0x333333, 1);
            slotBg.fillRoundedRect(slotX, startY - 2, 28, 28, 6);
            slotBg.lineStyle(2, isUnlocked ? 0xFFD700 : 0x555555, 1);
            slotBg.strokeRoundedRect(slotX, startY - 2, 28, 28, 6);
            slotBg.setDepth(11);
            this.elements.push(slotBg);

            const slotIcon = this.add.text(slotX + 14, startY + 12,
                isUnlocked ? i.toString() : '🔒', {
                fontSize: isUnlocked ? '14px' : '12px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(slotIcon);
        }

        // Unlock hints
        startY += 35;
        if (!slots.slot2) {
            const hint = this.add.text(padding, startY, '🔒 Slot 2 unlocks at Bond Level 5', {
                fontSize: '11px',
                color: '#888888'
            }).setDepth(11);
            this.elements.push(hint);
            startY += 18;
        }
        if (!slots.slot3) {
            const hint = this.add.text(padding, startY, '🔒 Slot 3 unlocks at Bond Level 10', {
                fontSize: '11px',
                color: '#888888'
            }).setDepth(11);
            this.elements.push(hint);
            startY += 18;
        }

        return startY + 10;
    }

    createPersonalitySection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        if (!data.personality && !data.personalityState) {
            return startY;
        }

        startY += 20;

        const header = this.createSectionHeader('Personality', startY);
        startY = header.y + 30;

        // Core personality trait
        const coreTrait = data.personality?.core || data.personalityState?.coreTrait || 'Unknown';
        const traitText = this.add.text(padding, startY, `Core Trait: ${this.capitalizeFirst(coreTrait)}`, {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#FFD700'
        }).setDepth(11);
        this.elements.push(traitText);

        startY += 30;

        // Personality attributes (if available)
        const attributes = data.personality?.attributes || data.personalityState?.attributes;
        if (attributes) {
            const attrKeys = Object.keys(attributes).slice(0, 4);
            attrKeys.forEach((key, index) => {
                const value = attributes[key];
                const attrText = this.add.text(padding, startY + index * 22,
                    `• ${this.capitalizeFirst(key)}: ${Math.round(value * 100)}%`, {
                    fontSize: '14px',
                    color: '#AAAAAA'
                }).setDepth(11);
                this.elements.push(attrText);
            });
            startY += attrKeys.length * 22;
        }

        return startY + 10;
    }

    createEvolutionHistorySection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        const history = data.evolutionHistory || [];
        if (history.length === 0) {
            return startY;
        }

        startY += 20;

        const header = this.createSectionHeader('Evolution History', startY);
        startY = header.y + 30;

        history.forEach((evolution, index) => {
            const date = new Date(evolution.timestamp);
            const dateStr = date.toLocaleDateString();
            const fromIcon = evolutionConfig.stages[evolution.from]?.icon || '?';
            const toIcon = evolutionConfig.stages[evolution.to]?.icon || '?';

            const historyText = this.add.text(padding, startY + index * 25,
                `${fromIcon} → ${toIcon}  ${this.capitalizeFirst(evolution.from)} to ${this.capitalizeFirst(evolution.to)} (${dateStr})`, {
                fontSize: '14px',
                color: '#AAAAAA'
            }).setDepth(11);
            this.elements.push(historyText);
        });

        return startY + history.length * 25 + 20;
    }

    /**
     * Create dev tools section for testing (only visible in dev mode)
     * Allows quick age advancement for breeding testing
     */
    createDevToolsSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        startY += 30;

        // Header with warning styling
        const header = this.add.text(width / 2, startY, '🔧 DEV TOOLS', {
            fontSize: '16px',
            color: '#FF6B6B',
            fontStyle: 'bold',
            backgroundColor: '#2A1A1A',
            padding: { x: 15, y: 5 }
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(header);

        startY += 40;

        // Current stage display
        const currentStage = data.lifecycle?.stage || 'unknown';
        const stageText = this.add.text(width / 2, startY, `Current Stage: ${currentStage.toUpperCase()}`, {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(stageText);

        startY += 30;

        // Age buttons
        const stages = ['baby', 'juvenile', 'adult', 'elder'];
        const buttonWidth = 70;
        const buttonSpacing = 10;
        const totalWidth = (buttonWidth * 4) + (buttonSpacing * 3);
        let buttonX = (width - totalWidth) / 2;

        stages.forEach(stage => {
            const isCurrentStage = stage === currentStage;
            const buttonColor = isCurrentStage ? 0x228B22 : 0x4A4A6E;
            const textColor = isCurrentStage ? '#00FF00' : '#FFFFFF';

            const btn = this.add.graphics();
            btn.fillStyle(buttonColor, 0.9);
            btn.fillRoundedRect(buttonX, startY, buttonWidth, 35, 8);
            btn.lineStyle(2, isCurrentStage ? 0x00FF00 : 0x7B68EE, 0.8);
            btn.strokeRoundedRect(buttonX, startY, buttonWidth, 35, 8);
            btn.setDepth(11);
            this.elements.push(btn);

            const btnText = this.add.text(buttonX + buttonWidth / 2, startY + 17, stage.charAt(0).toUpperCase() + stage.slice(1), {
                fontSize: '12px',
                color: textColor,
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(btnText);

            // Make interactive
            const hitZone = this.add.zone(buttonX + buttonWidth / 2, startY + 17, buttonWidth, 35);
            hitZone.setInteractive({ useHandCursor: true });
            hitZone.setDepth(13);

            hitZone.on('pointerdown', () => {
                if (window.DevTools) {
                    window.DevTools.ageCreature(stage);
                    // Play feedback sound
                    window.AudioManager?.playButtonClick?.();
                    // Refresh the profile
                    this.scene.restart();
                }
            });

            hitZone.on('pointerover', () => {
                btn.clear();
                btn.fillStyle(0x6B6B9E, 0.9);
                btn.fillRoundedRect(buttonX, startY, buttonWidth, 35, 8);
                btn.lineStyle(2, 0xFFD700, 1);
                btn.strokeRoundedRect(buttonX, startY, buttonWidth, 35, 8);
            });

            hitZone.on('pointerout', () => {
                btn.clear();
                btn.fillStyle(buttonColor, 0.9);
                btn.fillRoundedRect(buttonX, startY, buttonWidth, 35, 8);
                btn.lineStyle(2, isCurrentStage ? 0x00FF00 : 0x7B68EE, 0.8);
                btn.strokeRoundedRect(buttonX, startY, buttonWidth, 35, 8);
            });

            this.elements.push(hitZone);
            buttonX += buttonWidth + buttonSpacing;
        });

        startY += 55;

        // Additional dev buttons row
        const devActions = [
            { label: '➕ Add Test Creature', action: () => window.DevTools?.addTestCreature() },
            { label: '⏭️ Skip 7 Days', action: () => window.DevTools?.skipDays(7) },
            { label: '🧪 Setup Breeding', action: () => window.DevTools?.setupBreedingTest() }
        ];

        const actionBtnWidth = (width - padding * 2 - 20) / 3;
        let actionX = padding;

        devActions.forEach(action => {
            const actionBtn = this.add.graphics();
            actionBtn.fillStyle(0x1A3A5C, 0.9);
            actionBtn.fillRoundedRect(actionX, startY, actionBtnWidth, 30, 6);
            actionBtn.lineStyle(1, 0x4ECDC4, 0.6);
            actionBtn.strokeRoundedRect(actionX, startY, actionBtnWidth, 30, 6);
            actionBtn.setDepth(11);
            this.elements.push(actionBtn);

            const actionText = this.add.text(actionX + actionBtnWidth / 2, startY + 15, action.label, {
                fontSize: '11px',
                color: '#4ECDC4'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(actionText);

            const actionZone = this.add.zone(actionX + actionBtnWidth / 2, startY + 15, actionBtnWidth, 30);
            actionZone.setInteractive({ useHandCursor: true });
            actionZone.setDepth(13);

            actionZone.on('pointerdown', () => {
                action.action();
                window.AudioManager?.playButtonClick?.();
                // Show feedback
                actionText.setColor('#FFD700');
                this.time.delayedCall(200, () => {
                    actionText.setColor('#4ECDC4');
                });
            });

            this.elements.push(actionZone);
            actionX += actionBtnWidth + 10;
        });

        startY += 50;

        // Info text
        const infoText = this.add.text(width / 2, startY, 'Dev tools only visible in development mode', {
            fontSize: '10px',
            color: '#666666'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(infoText);

        return startY + 30;
    }

    createSectionHeader(title, y) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        // Line before title
        const line = this.add.graphics();
        line.lineStyle(1, 0x7B68EE, 0.5);
        line.lineBetween(padding, y, width - padding, y);
        line.setDepth(11);
        this.elements.push(line);

        // Title
        const header = this.add.text(padding, y + 10, title, {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#7B68EE',
            fontStyle: 'bold'
        }).setDepth(11);
        this.elements.push(header);

        return { y: y + 10, text: header };
    }

    createInfoItem(x, y, item) {
        const bg = this.add.graphics();
        bg.fillStyle(0x2A2A4E, 0.5);
        bg.fillRoundedRect(x - 50, y - 15, 100, 40, 8);
        bg.setDepth(10);
        this.elements.push(bg);

        const icon = this.add.text(x, y - 5, item.icon, {
            fontSize: '16px'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(icon);

        const value = this.add.text(x, y + 12, item.value, {
            fontSize: '12px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(value);
    }

    showNoCreatureMessage() {
        const { width, height } = this.scale;

        const message = this.add.text(width / 2, height / 2, 'No creature hatched yet!', {
            fontSize: '20px',
            color: '#AAAAAA'
        }).setOrigin(0.5);
        this.elements.push(message);
    }

    setupInput() {
        // Touch/mouse scroll
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown && this.maxScroll > 0) {
                const dy = pointer.prevPosition.y - pointer.y;
                this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, 0, this.maxScroll);
                this.updateScroll();
            }
        });

        // Mouse wheel
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            if (this.maxScroll > 0) {
                this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScroll);
                this.updateScroll();
            }
        });
    }

    updateScroll() {
        // Update positions of scrollable elements
        // For now, keep it simple - could add smooth scrolling later
    }

    goBack() {
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
        this.scene.start('GameScene');
    }

    // Utility methods
    getRarityColor(rarity) {
        const colors = {
            common: 0x808080,
            uncommon: 0x1EFF00,
            rare: 0x0070DD,
            epic: 0xA335EE,
            legendary: 0xFF8000,
            mythic: 0xFF00FF,
            secret: 0x00FFFF
        };
        return colors[rarity] || colors.common;
    }

    getRarityColorHex(rarity) {
        const colors = {
            common: '#808080',
            uncommon: '#1EFF00',
            rare: '#0070DD',
            epic: '#A335EE',
            legendary: '#FF8000',
            mythic: '#FF00FF',
            secret: '#00FFFF'
        };
        return colors[rarity] || colors.common;
    }

    getMoodIcon(mood) {
        const icons = {
            happy: '😊',
            neutral: '😐',
            sad: '😢',
            abandoned: '😞'
        };
        return icons[mood] || '😊';
    }

    getAffinityIcon(element) {
        const icons = {
            star: '⭐',
            moon: '🌙',
            nebula: '🌌',
            crystal: '💎',
            void: '🕳️'
        };
        return icons[element] || '✨';
    }

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    shutdown() {
        console.log('[CreatureProfileScene] Shutting down');

        // Remove keyboard listeners
        if (this.input?.keyboard) {
            this.input.keyboard.off('keydown-ESC');
            this.input.keyboard.off('keydown-P');
        }

        // Remove input listeners
        if (this.input) {
            this.input.off('pointermove');
            this.input.off('wheel');
        }

        // Clear tweens
        this.tweens?.killAll();

        // Destroy elements
        this.elements.forEach(el => el?.destroy?.());
        this.elements = [];
        this.creatureSprite = null;
        this.graphicsEngine = null;

        console.log('[CreatureProfileScene] Cleanup complete');
    }
}
