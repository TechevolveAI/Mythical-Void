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
        currentY = this.createLifecycleSection(creatureData, currentY);
        currentY = this.createStatsSection(creatureData, currentY);
        currentY = this.createPersonalitySection(creatureData, currentY);
        currentY = this.createEvolutionHistorySection(creatureData, currentY);

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
            textureName: gs.get('creature.textureName')
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

                // Update GameState
                window.GameState?.set('creature.lifecycle.stage', stage);

                // Update visual days (approximate for each stage)
                const stageDays = { baby: 1, juvenile: 4, adult: 10, elder: 35 };
                window.GameState?.set('creature.lifecycle.daysAlive', stageDays[stage]);

                // Clear cached texture to force regeneration
                window.GameState?.set('creature.textureName', null);

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
