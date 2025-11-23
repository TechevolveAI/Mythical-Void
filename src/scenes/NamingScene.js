/**
 * NamingScene - Scene for naming the creature and displaying its characteristics
 * Features: creature naming, genetics display, personality traits, transition to game world
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

class NamingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'NamingScene' });
        this.nameInput = '';
        this.maxNameLength = 20;
        this.cursorBlink = true;
        this.isTransitioning = false;  // CRITICAL: Initialize to prevent stuck state
        this.domClickHandler = null;   // Store reference for cleanup
    }

    preload() {
        // Nothing to preload - sprites created in create()
    }

    create() {
        // Stop all other scenes to ensure clean display
        const scenesToStop = ['GameScene', 'InventoryScene', 'ShopScene', 'HatchingScene', 'PersonalityScene'];
        scenesToStop.forEach(sceneKey => {
            try {
                this.scene.stop(sceneKey);
            } catch (e) {
                // Scene might not exist - that's fine
            }
        });
        this.scene.bringToTop();

        const state = getGameState();

        // CRITICAL: Reset transition state for this instance
        this.isTransitioning = false;

        // Set current scene in GameState
        state.set('session.currentScene', 'NamingScene');

        // Initialize graphics engine
        const GraphicsEngine = getGraphicsEngine();
        this.graphicsEngine = new GraphicsEngine(this);

        // Create background
        this.createBackground();

        // Generate creature genetics and personality
        this.generateCreatureTraits();

        // Display the creature
        this.displayCreature();

        // Create UI elements
        this.createUI();

        // Set up input handling
        console.log('[NamingScene] Calling setupInput...');
        try {
            this.setupInput();
            console.log('[NamingScene] setupInput completed successfully');
        } catch (inputError) {
            console.error('[NamingScene] Error in setupInput:', inputError);
        }

        // Create cursor blink timer
        this.createCursorBlink();
    }

    createBackground() {
        // MOBILE-RESPONSIVE background
        const { width, height } = this.scale;

        // Create a gentle gradient background
        const background = this.add.graphics();
        background.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xE0F6FF, 0xE0F6FF, 1);
        background.fillRect(0, 0, width, height);

        // Add some floating clouds (fewer on mobile)
        this.clouds = this.add.group();
        const cloudCount = width < 600 ? 2 : 3;
        for (let i = 0; i < cloudCount; i++) {
            // Create simple cloud graphics
            const cloudGraphics = this.add.graphics();
            cloudGraphics.fillStyle(0xFFFFFF, 0.8);
            cloudGraphics.fillCircle(0, 0, 25);
            cloudGraphics.fillCircle(20, -5, 30);
            cloudGraphics.fillCircle(40, 0, 25);
            cloudGraphics.fillCircle(25, 10, 20);

            const cloud = this.add.container(
                Phaser.Math.Between(width * 0.1, width * 0.9),
                Phaser.Math.Between(height * 0.05, height * 0.25)
            );
            cloud.add(cloudGraphics);
            cloud.setAlpha(0.6);
            this.clouds.add(cloud);

            // Gentle movement
            this.tweens.add({
                targets: cloud,
                x: cloud.x + Phaser.Math.Between(-30, 30),
                duration: Phaser.Math.Between(8000, 12000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }

    generateCreatureTraits() {
        const state = getGameState();
        const creatureData = state.get('creature');

        if (!creatureData.genes) {
            creatureData.genes = {
                size: Phaser.Math.RND.pick(['small', 'medium', 'large']),
                pattern: Phaser.Math.RND.pick(['solid', 'striped', 'spotted']),
                eyeColor: Phaser.Math.RND.pick([0x4169E1, 0x228B22, 0x8B4513, 0x9370DB]),
                temperament: Phaser.Math.RND.pick(['gentle', 'playful', 'curious', 'wise']),
                specialTrait: Phaser.Math.RND.pick(['none', 'horns', 'crest', 'extra_fluffy'])
            };
            state.set('creature.genes', creatureData.genes);
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
            state.set('creature.personality', personality);
        }

        this.creatureData = state.get('creature');
    }

    displayCreature() {
        console.log('naming:info [NamingScene] Loading creature from GameState');

        let textureName = 'enhancedCreature0'; // Default fallback

        try {
            // Use unified creature loading method
            const creatureResult = this.graphicsEngine.loadCreatureFromGameState(0);

            if (creatureResult && creatureResult.textureName) {
                textureName = creatureResult.textureName;
                console.log('naming:info [NamingScene] Successfully loaded creature:', textureName);
            } else {
                console.warn('naming:warn [NamingScene] Failed to load creature, using fallback');
                // Create fallback creature
                this.graphicsEngine.createEnhancedCreature(0x9370DB, 0xDDA0DD, 0x8A2BE2, 0, null);
            }
        } catch (error) {
            console.error('naming:error [NamingScene] Error loading creature:', error);
            // Create fallback creature
            this.graphicsEngine.createEnhancedCreature(0x9370DB, 0xDDA0DD, 0x8A2BE2, 0, null);
        }

        // MOBILE-RESPONSIVE creature positioning
        const { width, height } = this.scale;
        const isMobile = width < 600;
        const creatureX = isMobile ? width / 2 : 200;
        const creatureY = isMobile ? height * 0.25 : 300;
        const baseScale = isMobile ? Math.min(1.5, width / 300) : 1.5;

        this.creature = this.add.image(creatureX, creatureY, textureName);
        this.creature.setScale(baseScale);

        // Gentle breathing animation
        this.tweens.add({
            targets: this.creature,
            scaleY: baseScale * 1.05,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    createUI() {
        // MOBILE-RESPONSIVE UI with vertical stacking for mobile
        const { width, height } = this.scale;
        const centerX = width / 2;
        const isMobile = width < 600;

        // Responsive font sizes
        const titleSize = Math.max(20, Math.min(28, width * 0.065));
        const subtitleSize = Math.max(14, Math.min(16, width * 0.04));
        const instructionSize = Math.max(14, Math.min(18, width * 0.042));

        // Enhanced title with emoji
        this.titleText = this.add.text(centerX, height * 0.04, '🎉 Meet Your Magical Creature! 🎉', {
            fontSize: `${titleSize}px`,
            color: '#4B0082',
            stroke: '#FFFFFF',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        // Subtitle
        this.subtitleText = this.add.text(centerX, height * 0.09, 'Your creature has hatched! Now give it a special name.', {
            fontSize: `${subtitleSize}px`,
            color: '#2E8B57',
            stroke: '#FFFFFF',
            strokeThickness: 1,
            align: 'center',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        // Reset button in top right
        this.createResetButton();

        if (isMobile) {
            // MOBILE LAYOUT: Stack vertically
            this.createMobileLayout();
        } else {
            // DESKTOP LAYOUT: Side-by-side
            this.createInfoPanel();
            this.createNamingSection();
        }

        // Enhanced instructions with better styling
        // ALWAYS create a button for both mobile and desktop for better UX
        this.createEnterWorldButton();

        // Control hints (hide on mobile to save space)
        if (!isMobile) {
            this.controlText = this.add.text(centerX, height * 0.97, '🎮 Type to name • Backspace to delete • ENTER to continue', {
                fontSize: '14px',
                color: '#666666',
                align: 'center'
            }).setOrigin(0.5);
        }

        // CRITICAL: Ensure input is enabled
        if (!this.input.enabled) {
            console.warn('[NamingScene] Input was disabled, enabling now');
            this.input.enabled = true;
        }

        // Debug: Add scene-wide pointer listener to understand click issues
        this.input.on('pointerdown', (pointer) => {
            console.log('[NamingScene] Scene pointer down at:', pointer.x, pointer.y);
            if (this.enterButtonDims) {
                const { x, y, w, h } = this.enterButtonDims;
                const inButton = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
                console.log('[NamingScene] Button bounds:', x, y, w, h, 'In button:', inButton);
            }
        });

        // Also listen for pointerup in case that's what's needed
        this.input.on('pointerup', (pointer) => {
            console.log('[NamingScene] Scene pointer UP at:', pointer.x, pointer.y);
        });

        console.log('[NamingScene] Create complete, input enabled:', this.input.enabled);
        console.log('[NamingScene] Input manager active:', this.input.manager?.isActive);

        // Check input status after a delay to catch any late initialization issues
        this.time.delayedCall(100, () => {
            console.log('[NamingScene] Delayed input check - enabled:', this.input.enabled,
                        'keyboard:', !!this.input.keyboard,
                        'pointer count:', this.input.manager?.pointers?.length);
        });
    }

    createResetButton() {
        // MOBILE-RESPONSIVE reset button in top right
        const { width, height } = this.scale;

        const buttonWidth = Math.min(100, width * 0.22);
        const buttonHeight = Math.min(35, height * 0.045);
        const buttonX = width - buttonWidth - (width * 0.03);
        const buttonY = height * 0.015;
        const fontSize = Math.max(12, Math.min(14, width * 0.035));

        // Reset button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0xFF4444, 0.9);
        buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        buttonBg.lineStyle(2, 0xFFFFFF);
        buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);

        // Reset button text
        const resetText = this.add.text(buttonX + buttonWidth/2, buttonY + buttonHeight/2, '🔄 RESET', {
            fontSize: `${fontSize}px`,
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Make button interactive
        const resetButton = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        // Store dimensions for hover effects
        this.resetButtonDims = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };

        resetButton.on('pointerdown', () => {
            this.resetGameData();
        });

        resetButton.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF6666, 0.9);
            buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        });

        resetButton.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF4444, 0.9);
            buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        });
    }

    resetGameData() {
        // Clear all game data and reload
        localStorage.removeItem('mythical-creature-save');
        console.log('🔄 Game data reset from naming scene');
        window.location.reload();
    }

    createMobileLayout() {
        // SIMPLIFIED MOBILE LAYOUT: Creature → Name Input only (no duplicate info)
        const { width, height } = this.scale;
        const centerX = width / 2;

        // Responsive font sizes for mobile
        const labelSize = Math.max(16, Math.min(20, width * 0.05));
        const bodySize = Math.max(14, Math.min(16, width * 0.04));

        // Reposition creature to center with more prominence
        if (this.creature) {
            this.creature.x = centerX;
            this.creature.y = height * 0.35;
            const scale = Math.min(1.8, width / 280);
            this.creature.setScale(scale);
        }

        // NAME INPUT SECTION - centered and prominent
        const inputWidth = width * 0.85;
        const inputHeight = height * 0.07;
        const inputX = centerX - (inputWidth / 2);
        const inputY = height * 0.58;

        // Name label with cosmic styling
        this.add.text(centerX, inputY - (height * 0.04), '✨ Give your creature a name ✨', {
            fontSize: `${labelSize}px`,
            color: '#FFD700',
            align: 'center',
            fontStyle: 'bold',
            stroke: '#4B0082',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Name input background with cosmic theme
        const inputBg = this.add.graphics();
        inputBg.fillStyle(0x1A1A3E, 0.9);
        inputBg.fillRoundedRect(inputX, inputY, inputWidth, inputHeight, 12);
        inputBg.lineStyle(3, 0x9370DB);
        inputBg.strokeRoundedRect(inputX, inputY, inputWidth, inputHeight, 12);

        // ALWAYS start with blank name field
        this.nameInput = '';
        console.log('naming:info [NamingScene] Name field initialized as blank (mobile)');

        // Name input display
        this.nameText = this.add.text(centerX, inputY + (inputHeight / 2), '', {
            fontSize: `${bodySize}px`,
            color: '#FFFFFF'
        }).setOrigin(0.5);

        // Create HTML input element for mobile keyboard
        this.createMobileInput(inputX, inputY, inputWidth, inputHeight);

        this.updateNameDisplay();
    }

    createInfoPanel() {
        // SIMPLIFIED DESKTOP LAYOUT - no duplicate personality/genetics info
        // Just show a hint about the creature's rarity
        const { width, height } = this.scale;

        // Get rarity info for display
        const rarity = this.creatureGenetics?.rarity || 'common';
        const rarityColors = {
            common: '#32CD32',
            uncommon: '#FF8C00',
            rare: '#DC143C',
            epic: '#9370DB',
            legendary: '#FFD700'
        };

        // Small rarity badge below creature
        const rarityBadge = this.add.text(200, 420, `${rarity.toUpperCase()} CREATURE`, {
            fontSize: '14px',
            color: rarityColors[rarity] || '#32CD32',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
    }

    createNamingSection() {
        // SIMPLIFIED DESKTOP NAMING - cosmic themed, centered
        const { width, height } = this.scale;
        const centerX = width / 2;

        // Name label with cosmic styling
        this.add.text(centerX, height * 0.55, '✨ Give your creature a name ✨', {
            fontSize: '22px',
            color: '#FFD700',
            align: 'center',
            fontStyle: 'bold',
            stroke: '#4B0082',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Name input background with cosmic theme
        const inputWidth = 280;
        const inputHeight = 50;
        const inputX = centerX - (inputWidth / 2);
        const inputY = height * 0.60;

        const inputBg = this.add.graphics();
        inputBg.fillStyle(0x1A1A3E, 0.9);
        inputBg.fillRoundedRect(inputX, inputY, inputWidth, inputHeight, 12);
        inputBg.lineStyle(3, 0x9370DB);
        inputBg.strokeRoundedRect(inputX, inputY, inputWidth, inputHeight, 12);

        // ALWAYS start with blank name field
        this.nameInput = '';
        console.log('naming:info [NamingScene] Name field initialized as blank');

        // Name input display
        this.nameText = this.add.text(centerX, inputY + (inputHeight / 2), '', {
            fontSize: '18px',
            color: '#FFFFFF'
        }).setOrigin(0.5);

        // Detect touch capability and create mobile input if needed
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) {
            console.log('[NamingScene] Touch device detected on desktop layout - creating mobile input');
            this.createMobileInput(inputX, inputY, inputWidth, inputHeight);
        }

        this.updateNameDisplay();
    }

    /**
     * Create HTML input element for mobile keyboard
     */
    createMobileInput(inputX, inputY, inputWidth, inputHeight) {
        // Create HTML input element
        const htmlInput = document.createElement('input');
        htmlInput.type = 'text';
        htmlInput.maxLength = this.maxNameLength;
        htmlInput.placeholder = 'Tap to name your creature';
        htmlInput.value = ''; // Ensure it starts empty

        // Use inline styles for maximum compatibility (no Tailwind dependencies)
        htmlInput.style.position = 'absolute';
        htmlInput.style.fontSize = '18px'; // Prevents iOS zoom (16px+ required)
        htmlInput.style.padding = '12px';
        htmlInput.style.zIndex = '10000'; // Very high to ensure it's on top
        htmlInput.style.textAlign = 'center';
        htmlInput.style.backgroundColor = 'rgba(255, 255, 255, 0.98)';
        htmlInput.style.color = '#333333';
        htmlInput.style.border = '3px solid #4B0082';
        htmlInput.style.borderRadius = '12px';
        htmlInput.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        htmlInput.style.outline = 'none';
        htmlInput.style.WebkitAppearance = 'none'; // Remove iOS default styling
        htmlInput.style.WebkitTapHighlightColor = 'transparent';
        htmlInput.style.touchAction = 'manipulation'; // Prevent double-tap zoom

        htmlInput.autocomplete = 'off';
        htmlInput.autocorrect = 'off';
        htmlInput.autocapitalize = 'words';
        htmlInput.spellcheck = false;
        htmlInput.inputMode = 'text'; // Hint for mobile keyboard type

        // Position the input - need to account for canvas position
        const updateInputPosition = () => {
            const canvas = this.game.canvas;
            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvasRect.width / this.scale.width;
            const scaleY = canvasRect.height / this.scale.height;

            const screenX = canvasRect.left + (inputX * scaleX);
            const screenY = canvasRect.top + (inputY * scaleY);
            const screenWidth = inputWidth * scaleX;
            const screenHeight = inputHeight * scaleY;

            htmlInput.style.left = `${screenX}px`;
            htmlInput.style.top = `${screenY}px`;
            htmlInput.style.width = `${screenWidth}px`;
            htmlInput.style.height = `${screenHeight}px`;
        };

        // Add to document body (not game container)
        document.body.appendChild(htmlInput);
        updateInputPosition();

        // Update position on window resize
        window.addEventListener('resize', updateInputPosition);
        this.inputResizeHandler = updateInputPosition;

        // Sync HTML input with game state
        htmlInput.addEventListener('input', (e) => {
            const value = e.target.value;

            // Validate input
            let validation;
            if (window.InputValidator && typeof window.InputValidator.validate === 'function') {
                try {
                    validation = window.InputValidator.validate(value, 'username', { maxLength: this.maxNameLength });
                } catch (validatorError) {
                    console.warn('InputValidator error, using fallback:', validatorError);
                    validation = this.fallbackValidation(value, value.slice(-1));
                }
            } else {
                validation = this.fallbackValidation(value, value.slice(-1));
            }

            if (validation.isValid) {
                this.nameInput = validation.sanitized || value;
            } else {
                this.nameInput = validation.sanitized || value.slice(0, -1);
                htmlInput.value = this.nameInput; // Sync back
            }

            this.updateNameDisplay();
            this.validateName();
        });

        // Handle Enter key on mobile keyboard
        htmlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                htmlInput.blur(); // Hide keyboard
                this.finalizeName();
            }
        });

        // Focus when tapped (handle both touch and click)
        htmlInput.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            htmlInput.focus();
            console.log('[NamingScene] HTML input touched');
        });

        htmlInput.addEventListener('click', (e) => {
            e.stopPropagation();
            htmlInput.focus();
            console.log('[NamingScene] HTML input clicked');
        });

        // Store reference for cleanup
        this.mobileInput = htmlInput;

        // CRITICAL iOS FIX: Create a Phaser interactive zone that forwards touches to HTML input
        // iOS requires focus() to be called directly from a user event, not programmatically
        const inputZone = this.add.zone(inputX + inputWidth/2, inputY + inputHeight/2, inputWidth, inputHeight)
            .setOrigin(0.5)
            .setInteractive({ cursor: 'text' });

        inputZone.on('pointerdown', (pointer) => {
            console.log('[NamingScene] Input zone tapped - focusing HTML input');
            // This happens directly in response to user touch, so iOS allows keyboard
            htmlInput.focus();
            htmlInput.click(); // Some devices need this
        });

        // Store zone reference for cleanup
        this.mobileInputZone = inputZone;
    }

    /**
     * Create "Enter World" button (works for both mobile and desktop)
     */
    createEnterWorldButton() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const isMobile = width < 600;

        const buttonWidth = isMobile ? Math.min(width * 0.65, 200) : 250;
        const buttonHeight = isMobile ? Math.min(height * 0.065, 50) : 55;
        const buttonX = centerX - (buttonWidth / 2);
        const buttonY = isMobile ? height * 0.88 : height * 0.85;
        const fontSize = isMobile ? Math.max(16, Math.min(20, width * 0.048)) : 22;

        // Button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x32CD32, 0.95);
        buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 12);
        buttonBg.lineStyle(3, 0xFFD700);
        buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 12);
        buttonBg.setDepth(100);

        // Button text
        const buttonText = this.add.text(centerX, buttonY + (buttonHeight / 2), '🚀 START ADVENTURE 🚀', {
            fontSize: `${fontSize}px`,
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(101);

        // Interactive zone - MUST be above other elements
        const buttonZone = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer', useHandCursor: true })
            .setDepth(102);

        console.log('[NamingScene] Button zone created at:', buttonX, buttonY, buttonWidth, buttonHeight);

        // Store dimensions for hover effects
        this.enterButtonDims = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };

        // Button interactions
        buttonZone.on('pointerdown', () => {
            console.log('[NamingScene] START ADVENTURE button clicked via pointerdown');
            this.finalizeName();
        });

        // Also try pointerup as backup
        buttonZone.on('pointerup', () => {
            console.log('[NamingScene] START ADVENTURE button clicked via pointerup');
            this.finalizeName();
        });

        // Store reference for potential direct access
        this.startAdventureButton = buttonZone;

        // DOM-level debug: Check if clicks reach the canvas at all
        if (this.game.canvas) {
            const canvas = this.game.canvas;
            const sceneRef = this;  // Store reference for closure
            const debugClickHandler = (e) => {
                // CRITICAL: Check if THIS scene is the active scene before processing
                const currentScene = window.GameState?.get('session.currentScene');
                if (currentScene !== 'NamingScene') {
                    console.log('[NamingScene] DOM click ignored - scene not active (current:', currentScene, ')');
                    return;
                }

                // Also check if the scene instance is still valid
                if (!sceneRef.scene || !sceneRef.scene.isActive()) {
                    console.log('[NamingScene] DOM click ignored - scene instance not active');
                    return;
                }

                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                console.log('[NamingScene] DOM canvas click at:', x, y);

                // Check if within button bounds
                if (sceneRef.enterButtonDims) {
                    const { x: bx, y: by, w, h } = sceneRef.enterButtonDims;
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const gameX = x * scaleX;
                    const gameY = y * scaleY;
                    console.log('[NamingScene] Scaled to game coords:', gameX, gameY);

                    if (gameX >= bx && gameX <= bx + w && gameY >= by && gameY <= by + h) {
                        console.log('[NamingScene] DOM click was inside button! Calling finalizeName directly.');
                        sceneRef.finalizeName();
                    }
                }
            };

            // Store handler for cleanup
            this.domClickHandler = debugClickHandler;
            canvas.addEventListener('click', debugClickHandler);
            console.log('[NamingScene] Added DOM-level click handler as fallback');
        }

        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x3FE03F, 0.95);
            buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 12);
            buttonBg.lineStyle(4, 0xFFD700);
            buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 12);
        });

        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x32CD32, 0.95);
            buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 12);
            buttonBg.lineStyle(3, 0xFFD700);
            buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 12);
        });

        // Store UI elements
        this.enterWorldButton = { buttonBg, buttonText, buttonZone };
    }

    setupInput() {
        console.log('[NamingScene] Setting up keyboard input');

        // Set up keyboard input for naming
        this.input.keyboard.on('keydown', (event) => {
            console.log('[NamingScene] Key pressed:', event.key);

            if (event.key === 'Enter') {
                console.log('[NamingScene] Enter key pressed - calling finalizeName()');
                event.preventDefault(); // Prevent default behavior
                event.stopPropagation(); // Stop event bubbling
                this.finalizeName();
            } else if (event.key === 'Backspace') {
                this.nameInput = this.nameInput.slice(0, -1);
                this.updateNameDisplay();
                this.validateName();
            } else if (event.key.length === 1 && this.nameInput.length < this.maxNameLength) {
                // Use input validator with safe fallback
                const testInput = this.nameInput + event.key;
                let validation;
                
                if (window.InputValidator && typeof window.InputValidator.validate === 'function') {
                    try {
                        validation = window.InputValidator.validate(testInput, 'username', { maxLength: this.maxNameLength });
                    } catch (validatorError) {
                        console.warn('InputValidator error, using fallback:', validatorError);
                        validation = this.fallbackValidation(testInput, event.key);
                    }
                } else {
                    validation = this.fallbackValidation(testInput, event.key);
                }
                
                if (validation.isValid) {
                    this.nameInput = validation.sanitized || testInput;
                    this.updateNameDisplay();
                    this.validateName();
                }
            }
        });
    }
    
    /**
     * Fallback validation when InputValidator is not available
     */
    fallbackValidation(testInput, key) {
        // Allow letters, numbers, spaces, and common punctuation
        const isValidChar = /[a-zA-Z0-9 \-_']/.test(key);
        const sanitized = testInput.replace(/[^a-zA-Z0-9 \-_']/g, '');
        
        return {
            isValid: isValidChar && testInput.length <= this.maxNameLength,
            sanitized: sanitized,
            errors: []
        };
    }
    
    validateName() {
        // Real-time validation feedback
        if (!window.InputValidator) return true;
        
        const validation = window.InputValidator.validate(this.nameInput, 'username', {
            minLength: 1,
            maxLength: this.maxNameLength
        });
        
        // Update visual feedback
        if (!this.validationText) {
            this.validationText = this.add.text(400, 475, '', {
                fontSize: '12px',
                color: '#FF0000',
                align: 'center'
            }).setOrigin(0.5);
        }
        
        if (!validation.isValid && this.nameInput.length > 0) {
            this.validationText.setText(validation.errors[0] || '');
            this.validationText.setColor('#FF0000');
        } else if (this.nameInput.length > 0) {
            this.validationText.setText('✓ Valid name');
            this.validationText.setColor('#00FF00');
        } else {
            this.validationText.setText('');
        }
        
        return validation.isValid;
    }

    createCursorBlink() {
        this.time.addEvent({
            delay: 500,
            callback: () => {
                this.cursorBlink = !this.cursorBlink;
                this.updateNameDisplay();
            },
            loop: true
        });
    }

    updateNameDisplay() {
        const displayName = this.nameInput || 'Enter name';
        const cursor = this.cursorBlink ? '|' : '';
        this.nameText.setText(displayName + cursor);
    }

    finalizeName() {
        console.log('[NamingScene] finalizeName() called, nameInput:', this.nameInput);

        if (this.nameInput.trim().length > 0) {
            console.log('[NamingScene] Valid name entered:', this.nameInput.trim());

            try {
                const state = getGameState();
                state.set('creature.name', this.nameInput.trim());
                state.set('creature.named', true);
                state.set('session.showWelcomeToast', true);
                state.set('session.pendingWelcomeName', this.nameInput.trim());
                state.save();
                console.log('[NamingScene] Name saved to GameState');
            } catch (error) {
                console.error('[NamingScene] Error saving name:', error);
            }

            // IMMEDIATELY hide mobile input before transition
            if (this.mobileInput) {
                this.mobileInput.style.display = 'none';
                console.log('[NamingScene] Mobile input hidden');
            }

            this.transitionToGame();
        } else {
            console.warn('[NamingScene] Empty name - showing error');
            // Show error message briefly
            const { width } = this.scale;
            const errorText = this.add.text(width / 2, this.scale.height * 0.5, 'Please enter a name!', {
                fontSize: '20px',
                fontFamily: 'Arial Black',
                color: '#FF0000',
                stroke: '#FFFFFF',
                strokeThickness: 3
            }).setOrigin(0.5);

            this.time.delayedCall(2000, () => {
                errorText.destroy();
            });
        }
    }

    transitionToGame() {
        console.log('[NamingScene] ===== STARTING TRANSITION TO GAMESCENE =====');

        // Prevent multiple transitions
        if (this.isTransitioning) {
            console.warn('[NamingScene] Already transitioning, ignoring');
            return;
        }
        this.isTransitioning = true;

        try {
            // Stop all tweens before transition - wrap in try-catch as this can fail
            try {
                if (this.tweens) {
                    this.tweens.killAll();
                }
                console.log('[NamingScene] Tweens killed');
            } catch (tweenError) {
                console.warn('[NamingScene] Error killing tweens (continuing):', tweenError.message);
            }

            // Remove keyboard listeners - wrap in try-catch
            try {
                if (this.input && this.input.keyboard) {
                    this.input.keyboard.removeAllListeners();
                }
                console.log('[NamingScene] Keyboard listeners removed');
            } catch (keyboardError) {
                console.warn('[NamingScene] Error removing keyboard listeners (continuing):', keyboardError.message);
            }

            // Clean up mobile HTML input if it exists
            try {
                if (this.mobileInput && this.mobileInput.parentElement) {
                    this.mobileInput.parentElement.removeChild(this.mobileInput);
                    this.mobileInput = null;
                    console.log('[NamingScene] Mobile input cleaned up');
                }
            } catch (mobileError) {
                console.warn('[NamingScene] Error cleaning mobile input (continuing):', mobileError.message);
            }

            // Clean up mobile input zone
            try {
                if (this.mobileInputZone) {
                    if (this.mobileInputZone.removeAllListeners) {
                        this.mobileInputZone.removeAllListeners();
                    }
                    this.mobileInputZone = null;
                    console.log('[NamingScene] Mobile input zone cleaned up');
                }
            } catch (zoneError) {
                console.warn('[NamingScene] Error cleaning mobile zone (continuing):', zoneError.message);
            }

            // Remove resize listener
            try {
                if (this.inputResizeHandler) {
                    window.removeEventListener('resize', this.inputResizeHandler);
                    this.inputResizeHandler = null;
                    console.log('[NamingScene] Resize listener removed');
                }
            } catch (resizeError) {
                console.warn('[NamingScene] Error removing resize listener (continuing):', resizeError.message);
            }

            console.log('[NamingScene] Creating fade effect...');

            // Fade out effect with proper dimensions
            const { width, height } = this.scale;
            const fadeGraphics = this.add.graphics();
            fadeGraphics.setDepth(10000); // Ensure it's on top
            fadeGraphics.fillStyle(0x000000, 0);
            fadeGraphics.fillRect(0, 0, width, height);

            this.tweens.add({
                targets: fadeGraphics,
                alpha: 1,
                duration: 800,
                onStart: () => {
                    console.log('[NamingScene] Fade animation started');
                },
                onUpdate: (tween) => {
                    const progress = tween.progress;
                    fadeGraphics.clear();
                    fadeGraphics.fillStyle(0x000000, progress);
                    fadeGraphics.fillRect(0, 0, width, height);
                },
                onComplete: () => {
                    console.log('[NamingScene] Fade complete, transitioning to GameScene');

                    try {
                        // Start GameScene first - this will handle cleanup of NamingScene
                        // Don't stop NamingScene explicitly as it kills the execution context
                        console.log('[NamingScene] Starting GameScene');
                        this.scene.start('GameScene');
                        console.log('[NamingScene] GameScene started');
                    } catch (sceneError) {
                        console.error('[NamingScene] Error in scene transition:', sceneError);
                        // Fallback: Use game scene manager
                        this.game.scene.start('GameScene');
                    }
                }
            });
        } catch (error) {
            console.error('[NamingScene] CRITICAL ERROR in transition:', error);
            // Emergency fallback: Direct scene switch
            console.log('[NamingScene] Attempting emergency fallback transition');
            this.isTransitioning = false;
            this.scene.start('GameScene');
        }
    }

    update() {
        // Scene handled by input events
    }

    shutdown() {
        console.log('[NamingScene] Shutting down - cleaning up resources');

        // Clean up mobile HTML input if it exists
        if (this.mobileInput) {
            if (this.mobileInput.parentElement) {
                this.mobileInput.parentElement.removeChild(this.mobileInput);
            }
            this.mobileInput = null;
            console.log('[NamingScene] Mobile input cleaned up in shutdown');
        }

        // Clean up mobile input zone
        if (this.mobileInputZone) {
            if (this.mobileInputZone.removeAllListeners) {
                this.mobileInputZone.removeAllListeners();
            }
            this.mobileInputZone = null;
            console.log('[NamingScene] Mobile input zone cleaned up in shutdown');
        }

        // Clean up DOM click handler
        if (this.domClickHandler && this.game.canvas) {
            this.game.canvas.removeEventListener('click', this.domClickHandler);
            this.domClickHandler = null;
            console.log('[NamingScene] DOM click handler cleaned up in shutdown');
        }

        // Remove resize listener
        if (this.inputResizeHandler) {
            window.removeEventListener('resize', this.inputResizeHandler);
            this.inputResizeHandler = null;
            console.log('[NamingScene] Resize listener removed in shutdown');
        }

        // Remove keyboard listeners
        if (this.input && this.input.keyboard) {
            this.input.keyboard.removeAllListeners();
            console.log('[NamingScene] Keyboard listeners removed in shutdown');
        }

        // Stop all tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Clear timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Clear references
        this.graphicsEngine = null;
        this.creature = null;
        this.clouds = null;
        this.enterWorldButton = null;

        // Reset transition state
        this.isTransitioning = false;

        console.log('[NamingScene] Cleanup complete');
    }

    // Backup cleanup method in case shutdown isn't called
    destroy() {
        console.log('[NamingScene] Destroy called - ensuring cleanup');

        // Clean up DOM click handler if not already done
        if (this.domClickHandler && this.game?.canvas) {
            this.game.canvas.removeEventListener('click', this.domClickHandler);
            this.domClickHandler = null;
            console.log('[NamingScene] DOM click handler cleaned up in destroy');
        }

        // Clean up mobile HTML input if it exists
        if (this.mobileInput && this.mobileInput.parentElement) {
            this.mobileInput.parentElement.removeChild(this.mobileInput);
            this.mobileInput = null;
        }

        // Reset state
        this.isTransitioning = false;
    }
}

export default NamingScene;

if (typeof window !== 'undefined') {
    window.NamingScene = NamingScene;
}
