/**
 * PersonalityScene - Reveals the creature's personality and traits after hatching
 * Features: personality display, genetics showcase, creature animation
 */

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

function requireGlobal(name) {
    if (typeof window === 'undefined' || !window[name]) {
        throw new Error(`${name} system not ready`);
    }
    return window[name];
}

function getGameState() {
    return requireGlobal('GameState');
}

function getGraphicsEngine() {
    return requireGlobal('GraphicsEngine');
}

class PersonalityScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PersonalityScene' });
        this.revealed = false;
    }

    preload() {
        // Nothing to preload - sprites created in create()
    }

    create() {
        const state = getGameState();

        // Set current scene in GameState
        state.set('session.currentScene', 'PersonalityScene');

        // Initialize graphics engine
        const GraphicsEngine = getGraphicsEngine();
        this.graphicsEngine = new GraphicsEngine(this);

        // Create background
        this.createBackground();

        // Generate creature traits if not already done
        this.generateCreatureTraits();

        // Display the creature
        this.displayCreature();

        // Show personality reveal
        this.showPersonalityReveal();

        // Set up input handling
        this.setupInput();
    }

    createBackground() {
        // MOBILE-RESPONSIVE: Use actual viewport dimensions
        const { width, height } = this.scale;

        // Create a magical gradient background
        const background = this.add.graphics();
        background.fillGradientStyle(0x4B0082, 0x4B0082, 0x9370DB, 0x9370DB, 1);
        background.fillRect(0, 0, width, height);

        // Add magical sparkles
        const sparkleCount = Math.min(20, Math.floor(width / 40)); // Fewer sparkles on small screens
        for (let i = 0; i < sparkleCount; i++) {
            const sparkle = this.add.graphics();
            sparkle.fillStyle(0xFFFFFF, Phaser.Math.FloatBetween(0.3, 0.8));
            sparkle.fillCircle(0, 0, Phaser.Math.Between(1, 3));
            sparkle.x = Phaser.Math.Between(width * 0.05, width * 0.95);
            sparkle.y = Phaser.Math.Between(height * 0.05, height * 0.95);

            // Twinkle animation
            this.tweens.add({
                targets: sparkle,
                alpha: { from: 0.2, to: 1 },
                scale: { from: 0.5, to: 1.5 },
                duration: Phaser.Math.Between(1000, 3000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 1000)
            });
        }
    }

    generateCreatureTraits() {
        const state = getGameState();
        let creatureData = state.get('creature');

        // Ensure creatureData exists
        if (!creatureData) {
            console.warn('personality:warn [PersonalityScene] No creature data found, creating fresh');
            creatureData = {
                name: 'Your Creature',
                hatched: true,
                colors: { body: 0x9370DB, head: 0xDDA0DD, wings: 0x8A2BE2 }
            };
            state.set('creature', creatureData);
        }

        if (creatureData && creatureData.genetics) {
            console.log('personality:info [PersonalityScene] Using genetics from HatchingScene:', creatureData.genetics.id);
            this.creatureGenetics = creatureData.genetics;
        } else {
            console.warn('personality:warn [PersonalityScene] No genetics found, generating fallback');
            if (window.CreatureGenetics) {
                this.creatureGenetics = window.CreatureGenetics.generateCreatureGenetics();
                state.set('creature.genetics', this.creatureGenetics);
            } else {
                this.generateLegacyTraits(creatureData);
                return;
            }
        }

        if (!creatureData.personality && this.creatureGenetics && this.creatureGenetics.personality) {
            const geneticsPersonality = this.creatureGenetics.personality;
            const displayPersonality = {
                name: this.getPersonalityDisplayName(geneticsPersonality.core),
                description: geneticsPersonality.description,
                core: geneticsPersonality.core,
                quirks: geneticsPersonality.quirks || [],
                socialLevel: geneticsPersonality.socialLevel || 0.5,
                cosmicAffinity: this.creatureGenetics.cosmicAffinity
            };

            creatureData.personality = displayPersonality;
            state.set('creature.personality', displayPersonality);
        }

        if (!creatureData.genes && this.creatureGenetics) {
            creatureData.genes = this.convertGeneticsToLegacyGenes(this.creatureGenetics);
            state.set('creature.genes', creatureData.genes);
        }

        this.creatureData = state.get('creature');

        // Final safety check
        if (!this.creatureData || !this.creatureData.personality || !this.creatureData.genes) {
            console.error('personality:error [PersonalityScene] Failed to generate creature traits, using emergency fallback');
            this.generateLegacyTraits(this.creatureData || {});
        }
    }

    generateLegacyTraits(creatureData) {
        // Legacy fallback system
        if (!creatureData.genes) {
            creatureData.genes = {
                size: Phaser.Math.RND.pick(['small', 'medium', 'large']),
                pattern: Phaser.Math.RND.pick(['solid', 'striped', 'spotted']),
                eyeColor: Phaser.Math.RND.pick([0x4169E1, 0x228B22, 0x8B4513, 0x9370DB]),
                temperament: Phaser.Math.RND.pick(['gentle', 'playful', 'curious', 'wise']),
                specialTrait: Phaser.Math.RND.pick(['none', 'horns', 'crest', 'extra_fluffy'])
            };
            getGameState().set('creature.genes', creatureData.genes);
        }

        if (!creatureData.personality) {
            const personalities = [
                { name: 'Gentle Spirit', description: 'Calm and nurturing, loves peaceful moments' },
                { name: 'Curious Explorer', description: 'Always eager to discover new things' },
                { name: 'Playful Friend', description: 'Energetic and loves to have fun' },
                { name: 'Wise Oracle', description: 'Thoughtful and observant of the world' }
            ];
            
            const personality = Phaser.Math.RND.pick(personalities);
            creatureData.personality = personality;
            getGameState().set('creature.personality', personality);
        }

        this.creatureData = getGameState().get('creature');
    }

    getPersonalityDisplayName(core) {
        const displayNames = {
            curious: 'Curious Explorer',
            playful: 'Playful Spirit',
            gentle: 'Gentle Soul',
            wise: 'Ancient Sage',
            energetic: 'Energetic Spark'
        };
        return displayNames[core] || 'Mysterious Being';
    }

    convertGeneticsToLegacyGenes(genetics) {
        if (!genetics) return null;

        // Map new genetics system to legacy display format
        const bodyShapeToSize = {
            'slender': 'small',
            'balanced': 'medium', 
            'sturdy': 'large',
            'fish': 'medium',
            'cyclops': 'large',
            'serpentine': 'medium'
        };

        const markingsToPattern = {
            'solid': 'solid',
            'striped': 'striped', 
            'spotted': 'spotted',
            'scales': 'scaled',
            'crystalline': 'crystalline'
        };

        const personalityToTemperament = {
            'curious': 'curious',
            'playful': 'playful',
            'gentle': 'gentle',
            'wise': 'wise',
            'energetic': 'energetic'
        };

        return {
            size: bodyShapeToSize[genetics.traits.bodyShape.type] || 'medium',
            pattern: markingsToPattern[genetics.traits.features.markings?.type] || 'solid',
            eyeColor: genetics.traits.colorGenome.eyeColor || 0x4169E1,
            temperament: personalityToTemperament[genetics.personality.core] || 'gentle',
            specialTrait: genetics.traits.features.specialFeatures?.length > 0 ? 
                genetics.traits.features.specialFeatures[0] : 'none'
        };
    }

    getRarityMeta(rarity) {
        const meta = {
            common: { name: 'Common', emoji: '🟢', color: '#7CFC00' },
            uncommon: { name: 'Uncommon', emoji: '🟠', color: '#FFA500' },
            rare: { name: 'Rare', emoji: '🩷', color: '#FF6B81' },
            epic: { name: 'Epic', emoji: '🟣', color: '#9B59B6' },
            legendary: { name: 'Legendary', emoji: '⭐', color: '#FFD700' }
        };
        return meta[rarity] || meta.common;
    }

    buildPersonalitySummary(personality = {}, genetics = {}) {
        if (!personality.core) {
            return 'This soul is still stabilising — keep bonding to learn its temperament.';
        }

        const quirks = this.formatQuirks(personality.quirks);
        const carePrefs = this.formatCarePreferences(genetics.personality?.carePreferences || personality.carePreferences);
        const social = Math.round((personality.socialLevel ?? 0.5) * 100);
        const independence = Math.round((personality.independence ?? 0.5) * 100);

        return [
            `Essence: ${personality.description || 'A mysterious being with untapped potential.'}`,
            quirks ? `Quirks: ${quirks}` : '',
            carePrefs ? `Thrives when you: ${carePrefs}` : '',
            `Social ${social}% • Independence ${independence}%`
        ].filter(Boolean).join('\n');
    }

    buildGeneticSummary(genetics = {}) {
        const traits = genetics.traits || {};
        const body = traits.bodyShape || {};
        const features = traits.features || {};
        const markings = features.markings || {};
        const specialFeatures = this.formatSpecialFeatures(features.specialFeatures);

        const bodyFlavor = this.describeBodyForm(body.type);
        const markingFlavor = markings.pattern ? `Markings: ${this.formatTitleCase(markings.pattern)} ${markings.distribution ? `with ${markings.distribution} flow` : ''}` : '';
        const wingFlavor = features.wings ? `Wing style: ${this.describeWing(features.wings.type)} (${Math.round((features.wings.span ?? 1) * 100)}% span)` : '';

        return [
            bodyFlavor,
            markingFlavor,
            wingFlavor,
            specialFeatures ? `Signature traits: ${specialFeatures}` : 'Signature traits: still awakening'
        ].filter(Boolean).join('\n');
    }

    buildCosmicSummary(cosmic = {}) {
        if (!cosmic.element) {
            return 'Cosmic alignment is still forming — explore together to unlock it.';
        }

        const abilities = this.formatList(cosmic.specialAbilities, 'Hidden potential awaiting discovery');
        const effects = this.formatList(cosmic.visualEffects, null);
        const power = Math.round((cosmic.powerLevel ?? 0.5) * 100);

        return [
            `${this.describeElement(cosmic.element)} (${power}% resonance)`,
            cosmic.description || '',
            abilities ? `Innate gifts: ${abilities}` : '',
            effects ? `Aura tells: ${effects}` : ''
        ].filter(Boolean).join('\n');
    }

    formatQuirks(quirks = []) {
        if (!Array.isArray(quirks) || quirks.length === 0) return '';
        return quirks.map(q => this.formatTitleCase(q.replace(/_/g, ' '))).join(', ');
    }

    formatCarePreferences(preferences = {}) {
        const entries = Object.entries(preferences)
            .filter(([, value]) => typeof value === 'number' && value > 1.05)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([action]) => this.formatCareAction(action));

        return entries.length ? entries.join(', ') : '';
    }

    formatSpecialFeatures(features) {
        if (!features || features.length === 0) return '';
        const names = features.map(feature => {
            if (typeof feature === 'string') return feature;
            if (feature && typeof feature === 'object' && feature.type) return feature.type;
            return null;
        }).filter(Boolean);

        return names.length ? this.formatList(names) : '';
    }

    describeBodyForm(type = 'balanced') {
        const map = {
            slender: 'Body form: Slender stargazer build',
            balanced: 'Body form: Balanced adventurer stance',
            sturdy: 'Body form: Stalwart guardian frame',
            fish: 'Body form: Flowing aquatic drifter',
            cyclops: 'Body form: Mythic cyclopean sentinel',
            serpentine: 'Body form: Serpentine wanderer'
        };
        return map[type] || `Body form: ${this.formatTitleCase(type)}`;
    }

    describeWing(type = 'feathered') {
        const map = {
            feathered: 'feathered starlight wings',
            crystal: 'crystalline resonance wings',
            ethereal: 'ethereal aurora wings',
            none: 'no visible wings'
        };
        return map[type] || `${type} wings`;
    }

    describeElement(element = 'star') {
        const map = {
            star: 'Element: Radiant Starborn',
            moon: 'Element: Lunar Dreamtide',
            nebula: 'Element: Nebula Mystic',
            crystal: 'Element: Crystal Resonant',
            void: 'Element: Void Whisper'
        };
        return map[element] || `Element: ${this.formatTitleCase(element)}`;
    }

    formatCareAction(action) {
        const map = {
            feed: 'Feasting together',
            play: 'Playful adventures',
            rest: 'Soft starlit rests',
            pet: 'Affectionate cuddles',
            photo: 'Capturing memories',
            clean: 'Aurora baths'
        };
        return map[action] || this.formatTitleCase(action);
    }

    formatList(items, fallback = '') {
        if (!items || items.length === 0) return fallback;
        return items.map(item => this.formatTitleCase(String(item).replace(/_/g, ' '))).join(', ');
    }

    formatTitleCase(text = '') {
        return text.replace(/\b\w/g, char => char.toUpperCase());
    }

    displayCreature() {
        let textureName = 'enhancedCreature0'; // Default fallback

        // Priority 1: Use saved texture name from GameState (most reliable)
        const savedTextureName = this.creatureData?.textureName;
        if (savedTextureName && this.textures.exists(savedTextureName)) {
            console.log('personality:info [PersonalityScene] Using saved texture from GameState:', savedTextureName);
            textureName = savedTextureName;
        }
        // Priority 2: Use genetics system if available
        else if (this.creatureGenetics) {
            console.log('personality:info [PersonalityScene] Loading creature with genetics ID:', this.creatureGenetics.id);

            // IMPORTANT: Use the same texture name that was created in HatchingScene
            // Don't regenerate - just reuse the existing texture
            const expectedTextureName = `creature_${this.creatureGenetics.id}_0`;

            // Check if the texture already exists from HatchingScene
            if (this.textures.exists(expectedTextureName)) {
                console.log('personality:info [PersonalityScene] Reusing existing texture:', expectedTextureName);
                textureName = expectedTextureName;
            } else {
                // Texture doesn't exist, need to create it
                console.warn('personality:warn [PersonalityScene] Texture not found, creating new:', expectedTextureName);
                try {
                    const spriteResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(this.creatureGenetics, 0);
                    textureName = spriteResult.textureName;
                } catch (error) {
                    console.error('personality:error [PersonalityScene] Failed to create creature sprite:', error);
                    // Fall back to default
                    textureName = 'enhancedCreature0';
                    this.graphicsEngine.createEnhancedCreature(0x9370DB, 0xDDA0DD, 0x8A2BE2, 0, null);
                }
            }
        } else if (this.creatureData && this.creatureData.colors) {
            // Legacy fallback
            console.log('personality:info [PersonalityScene] Using legacy creature rendering');
            this.graphicsEngine.createEnhancedCreature(
                this.creatureData.colors.body,
                this.creatureData.colors.head,
                this.creatureData.colors.wings,
                0,
                this.creatureData.genes
            );
        } else {
            // Final fallback - create a basic creature
            console.warn('personality:warn [PersonalityScene] Using basic fallback creature');
            this.graphicsEngine.createEnhancedCreature(0x9370DB, 0xDDA0DD, 0x8A2BE2, 0, null);
        }

        // MOBILE-RESPONSIVE creature positioning
        const { width, height } = this.scale;
        const centerX = width / 2;

        // Position creature centered horizontally, in upper portion
        const creatureX = centerX;
        const creatureY = height * 0.35; // 35% from top

        // Responsive scale - larger on desktop, smaller on mobile to fit
        const baseScale = width < 600 ? 1.2 : 1.5;
        const targetScale = width < 600 ? 1.0 : 1.2;

        this.creature = this.add.image(creatureX, creatureY, textureName);
        this.creature.setScale(baseScale * 1.3); // Start larger for entrance
        this.creature.setAlpha(0); // Start invisible

        // Dramatic entrance animation
        this.tweens.add({
            targets: this.creature,
            alpha: 1,
            scale: targetScale,
            duration: 1500,
            ease: 'Back.easeOut',
            delay: 500
        });

        // Gentle breathing animation
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: this.creature,
                scaleY: targetScale * 1.05,
                duration: 2000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        });
    }

    showPersonalityReveal() {
        // MOBILE-RESPONSIVE positioning
        const { width, height } = this.scale;
        const centerX = width / 2;
        const titleFontSize = Math.max(20, Math.min(32, width * 0.07));

        // Title appears first
        this.titleText = this.add.text(centerX, height * 0.08, '✨ Your Creature\'s Soul Revealed! ✨', {
            fontSize: `${titleFontSize}px`,
            color: '#FFD700',
            stroke: '#4B0082',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);
        this.titleText.setAlpha(0);

        // Animate title
        this.tweens.add({
            targets: this.titleText,
            alpha: 1,
            y: this.titleText.y - 10,
            duration: 1000,
            ease: 'Power2',
            delay: 1000
        });

        // Create personality reveal panel
        this.time.delayedCall(2000, () => {
            this.createPersonalityPanel();
        });

        // Continue button appears last
        this.time.delayedCall(4000, () => {
            this.createContinueButton();

            // Show tutorial hint for first-time players
            this.time.delayedCall(500, () => {
                this.showTutorialHint();
            });
        });
    }

    createPersonalityPanel() {
        // Validate creatureData exists
        if (!this.creatureData || !this.creatureData.personality || !this.creatureData.genes) {
            console.error('personality:error [PersonalityScene] Cannot create panel - missing creature data');
            // Show error and return to hatching
            this.showErrorAndRestart();
            return;
        }

        // MOBILE-RESPONSIVE panel positioning
        const { width, height } = this.scale;
        const centerX = width / 2;

        const panelW = Math.min(width * 0.9, 400); // 90% of width or 400px max
        const panelH = Math.min(height * 0.6, 350); // 60% of height or 350px max
        const panelX = centerX - (panelW / 2); // Center horizontally
        const panelY = height * 0.2; // Start at 20% from top

        this.panel = this.add.graphics();
        this.panel.fillStyle(0x000000, 0.8);
        this.panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);

        // Magical border
        this.panel.lineStyle(4, 0xFFD700);
        this.panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);

        // Inner border
        this.panel.lineStyle(2, 0xFF69B4);
        this.panel.strokeRoundedRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16, 15);

        this.panel.setAlpha(0);

        // Animate panel appearance
        this.tweens.add({
            targets: this.panel,
            alpha: 1,
            scaleX: { from: 0.8, to: 1 },
            scaleY: { from: 0.8, to: 1 },
            duration: 800,
            ease: 'Back.easeOut'
        });

        // RESPONSIVE content positioning and font sizes
        const padding = panelW * 0.06; // 6% padding
        const contentX = panelX + padding;
        let currentY = panelY + (panelH * 0.08); // Start 8% from top

        // Responsive font sizes based on panel width
        const titleFontSize = Math.max(18, Math.min(24, panelW * 0.055));
        const subtitleFontSize = Math.max(16, Math.min(18, panelW * 0.045));
        const bodyFontSize = Math.max(12, Math.min(14, panelW * 0.035));
        const smallFontSize = Math.max(11, Math.min(13, panelW * 0.032));

        const rarityMeta = this.getRarityMeta(this.creatureGenetics?.rarity);
        const personality = this.creatureData.personality || {};
        const genetics = this.creatureGenetics || {};

        this.rarityBadge = this.add.text(contentX, currentY, `${rarityMeta.emoji} ${rarityMeta.name} Soul`, {
            fontSize: `${titleFontSize}px`,
            color: rarityMeta.color,
            fontStyle: 'bold',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif'
        }).setOrigin(0, 0.5);
        currentY += titleFontSize * 1.5;

        this.personalityTitle = this.add.text(contentX, currentY, '🌟 Personality Profile', {
            fontSize: `${subtitleFontSize}px`,
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        currentY += subtitleFontSize * 1.4;

        this.personalityDesc = this.add.text(contentX, currentY, this.buildPersonalitySummary(personality, genetics), {
            fontSize: `${bodyFontSize}px`,
            color: '#FFFFFF',
            align: 'left',
            lineSpacing: 4,
            wordWrap: { width: panelW - (padding * 2) }
        }).setOrigin(0, 0);
        currentY += this.personalityDesc.height + (panelH * 0.04);

        this.geneticsTitle = this.add.text(contentX, currentY, '🧬 Genetic Highlights', {
            fontSize: `${subtitleFontSize}px`,
            color: '#87CEEB',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        currentY += subtitleFontSize * 1.4;

        this.geneticsText = this.add.text(contentX, currentY, this.buildGeneticSummary(genetics), {
            fontSize: `${smallFontSize}px`,
            color: '#E0E0E0',
            align: 'left',
            lineSpacing: 4,
            wordWrap: { width: panelW - (padding * 2) }
        }).setOrigin(0, 0);
        currentY += this.geneticsText.height + (panelH * 0.04);

        this.cosmicTitle = this.add.text(contentX, currentY, '🔮 Cosmic Affinity', {
            fontSize: `${subtitleFontSize}px`,
            color: '#B39DDB',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        currentY += subtitleFontSize * 1.4;

        this.cosmicText = this.add.text(contentX, currentY, this.buildCosmicSummary(genetics.cosmicAffinity), {
            fontSize: `${smallFontSize}px`,
            color: '#CCCCFF',
            align: 'left',
            lineSpacing: 4,
            wordWrap: { width: panelW - (padding * 2) }
        }).setOrigin(0, 0);

        const revealTexts = [
            this.rarityBadge,
            this.personalityTitle,
            this.personalityDesc,
            this.geneticsTitle,
            this.geneticsText,
            this.cosmicTitle,
            this.cosmicText
        ];

        revealTexts.forEach(text => text.setAlpha(0));

        revealTexts.forEach((text, index) => {
            this.tweens.add({
                targets: text,
                alpha: 1,
                x: text.x + 12,
                duration: 600,
                ease: 'Power2',
                delay: 200 + (index * 250)
            });
        });
    }

    showErrorAndRestart() {
        const errorText = this.add.text(400, 300, '⚠️ Error Loading Creature\n\nReturning to start...', {
            fontSize: '24px',
            color: '#FF4444',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        this.time.delayedCall(2000, () => {
            this.scene.start('HatchingScene');
        });
    }

    createContinueButton() {
        // MOBILE-RESPONSIVE button positioning
        const { width, height } = this.scale;
        const centerX = width / 2;

        const buttonWidth = Math.min(width * 0.85, 300);
        const buttonHeight = Math.min(height * 0.08, 60);
        const buttonX = centerX - (buttonWidth / 2);
        const buttonY = height * 0.88; // 88% from top (near bottom)
        const fontSize = Math.max(14, Math.min(18, width * 0.042));

        // Continue button with magical styling
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x9370DB, 0.9);
        buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 15);
        buttonBg.lineStyle(3, 0xFFD700);
        buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 15);

        const buttonText = this.add.text(centerX, buttonY + (buttonHeight / 2), '💫 NAME YOUR CREATURE', {
            fontSize: `${fontSize}px`,
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // Make button interactive
        const buttonZone = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        // Button animations
        this.tweens.add({
            targets: [buttonBg, buttonText],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        buttonZone.on('pointerdown', () => {
            this.transitionToNaming();
        });

        // Store dimensions for hover effects
        this.buttonDimensions = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };

        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xBA55D3, 0.9);
            buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 15);
            buttonBg.lineStyle(3, 0xFFD700);
            buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 15);
        });

        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x9370DB, 0.9);
            buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 15);
            buttonBg.lineStyle(3, 0xFFD700);
            buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 15);
        });

        // Start all elements as invisible
        [buttonBg, buttonText, buttonZone].forEach(element => {
            element.setAlpha(0);
        });

        // Animate button appearance
        this.tweens.add({
            targets: [buttonBg, buttonText],
            alpha: 1,
            duration: 800,
            ease: 'Power2'
        });
    }

    setupInput() {
        // Space key as alternative to button
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    /**
     * Show tutorial hint for first-time players
     */
    showTutorialHint() {
        const state = getGameState();
        const hasSeenTutorial = state.get('tutorial.personalitySeen') || false;

        if (hasSeenTutorial) {
            return; // Skip for experienced players
        }

        const { width, height } = this.scale;
        const centerX = width / 2;
        const tutorialFontSize = Math.max(14, Math.min(16, width * 0.04));

        // Create tutorial hint text
        this.tutorialHintText = this.add.text(
            centerX,
            height * 0.75,
            '💡 These traits define your creature\'s personality!\nClick the button below to give your creature a name.',
            {
                fontSize: `${tutorialFontSize}px`,
                color: '#FFFFFF',
                backgroundColor: 'rgba(123, 31, 162, 0.8)',
                padding: { x: 15, y: 10 },
                align: 'center',
                fontFamily: 'Arial, sans-serif',
                wordWrap: { width: width * 0.85 }
            }
        ).setOrigin(0.5).setAlpha(0);

        // Fade in animation
        this.tweens.add({
            targets: this.tutorialHintText,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });

        // Auto-dismiss after 6 seconds
        this.time.delayedCall(6000, () => {
            if (this.tutorialHintText) {
                this.tweens.add({
                    targets: this.tutorialHintText,
                    alpha: 0,
                    duration: 500,
                    ease: 'Power2',
                    onComplete: () => {
                        if (this.tutorialHintText) {
                            this.tutorialHintText.destroy();
                            this.tutorialHintText = null;
                        }
                    }
                });
            }
        });

        // Mark tutorial as seen
        state.set('tutorial.personalitySeen', true);
        console.log('[PersonalityScene] Tutorial hint shown and marked as seen');
    }

    transitionToNaming() {
        // Fade out effect
        const fadeGraphics = this.add.graphics();
        fadeGraphics.fillStyle(0x000000, 0);
        fadeGraphics.fillRect(0, 0, 800, 600);

        this.tweens.add({
            targets: fadeGraphics,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                this.scene.start('NamingScene');
            }
        });
    }

    update() {
        // Check for space key or enter key to continue
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            if (this.revealed) {
                this.transitionToNaming();
            }
        }

        // Mark as revealed after 4 seconds
        if (!this.revealed && this.time.now > 4000) {
            this.revealed = true;
        }
    }
}

export default PersonalityScene;

if (typeof window !== 'undefined') {
    window.PersonalityScene = PersonalityScene;
}
