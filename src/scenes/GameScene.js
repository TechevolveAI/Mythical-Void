/**
 * GameScene - The main gameplay scene with an explorable world
 * Features: player movement, large world, environment objects, collision detection, interactions, AI chat
 */

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.cursors = null;
        this.wasdKeys = null;
        this.spaceKey = null;
        this.chatKey = null;
        this.feedKey = null;
        this.playKey = null;
        this.restKey = null;
        this.careKey = null;
        this.worldWidth = 1600;
        this.worldHeight = 1200;
        this.trees = null;
        this.rocks = null;
        this.flowers = null;
        this.creatureAI = null;
        this.chatUI = null;
        this.isChatOpen = false;
        this.careSystem = null;
        this.carePanel = null;
        this.isCarePanelOpen = false;
    }

    preload() {
        // Sprites will be created in create() method
    }

    create() {
        try {
            // Set current scene in GameState
            GameState.set('session.currentScene', 'GameScene');

            // Initialize CreatureAI for chat functionality
            this.creatureAI = new CreatureAI();
            this.creatureAI.initialize();

            // Initialize CareSystem for creature care mechanics
            if (typeof window.CareSystem !== 'undefined' && window.CareSystem) {
                this.careSystem = window.CareSystem;
                // Initialize if not already done
                if (typeof this.careSystem.initialize === 'function' && !this.careSystem.initialized) {
                    this.careSystem.initialize();
                }
                console.log('[GameScene] CareSystem ready');
            } else {
                console.error('CareSystem not available, care features will be disabled');
                this.careSystem = null;
            }

            // Initialize AchievementSystem for basic achievements
            if (typeof window.AchievementSystem !== 'undefined' && window.AchievementSystem) {
                this.achievementSystem = window.AchievementSystem;
                // Call initialize if it exists and hasn't been called
                if (typeof this.achievementSystem.initialize === 'function' && !this.achievementSystem.initialized) {
                    this.achievementSystem.initialize();
                }
                console.log('[GameScene] AchievementSystem ready');
            } else {
                console.error('AchievementSystem not available, achievement features will be disabled');
                this.achievementSystem = null;
            }

            // Initialize TutorialSystem for progressive onboarding
            if (typeof window.TutorialSystem !== 'undefined' && window.TutorialSystem) {
                this.tutorialSystem = window.TutorialSystem;
                // Call initialize if it exists and hasn't been called
                if (typeof this.tutorialSystem.initialize === 'function' && !this.tutorialSystem.initialized) {
                    this.tutorialSystem.initialize();
                }
                console.log('[GameScene] TutorialSystem ready');
            } else {
                console.error('TutorialSystem not available, tutorial features will be disabled');
                this.tutorialSystem = null;
            }

            // Initialize enhanced graphics engine
            this.graphicsEngine = new GraphicsEngine(this);
            
            // Create enhanced sprites programmatically
            this.createEnhancedEnvironmentSprites();
            
            // Set world bounds for the large explorable area
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
            
            // Create the world background
            this.createWorldBackground();
            
            // Create the player (hatched creature)
            this.createPlayer();
            
            // Set up camera to follow player
            this.setupCamera();
            
            // Create environment objects
            this.createEnvironmentObjects();
            
            // Set up input controls
            this.setupInput();
            
            // Create UI elements
            this.createUI();

            // Initialize Kid Mode features if enabled
            this.initializeKidMode();
            
            // Listen for GameState events
            this.setupGameStateListeners();
            
            console.log('[GameScene] Scene created successfully');
        } catch (error) {
            console.error('[GameScene] Error during scene creation:', error);
            console.error('[GameScene] Error stack:', error.stack);
            
            // Try to recover by showing a simple error message
            const errorText = this.add.text(400, 300, 'Error loading game scene.\nPlease refresh the page.', {
                fontSize: '20px',
                color: '#FF0000',
                stroke: '#FFFFFF',
                strokeThickness: 2,
                align: 'center'
            });
            errorText.setOrigin(0.5);
            
            // Still throw the error so it gets properly logged
            throw error;
        }
    }

    createEnhancedEnvironmentSprites() {
        // Get creature colors from GameState or use defaults
        const creatureColors = GameState.get('creature.colors') || {
            body: 0x9370DB,  // Default purple
            head: 0xDDA0DD,  // Default plum
            wings: 0x8A2BE2  // Default blue violet
        };
        
        // Create enhanced player creature sprites (4 frames for walking animation)
        // Note: This is now handled in createPlayer() using genetics, but kept for compatibility
        for (let i = 0; i < 4; i++) {
            this.graphicsEngine.createEnhancedCreature(
                creatureColors.body, 
                creatureColors.head, 
                creatureColors.wings, 
                i
            );
        }

        // Create enhanced environment objects with variations
        this.createEnvironmentVariations();
    }

    createEnvironmentVariations() {
        // Create multiple tree variations (different seasons/ages)
        this.graphicsEngine.createEnhancedTree(1.0, 'summer');
        this.graphicsEngine.createEnhancedTree(0.8, 'spring');
        this.graphicsEngine.createEnhancedTree(1.2, 'autumn');

        // Create rock variations with different moss levels
        for (let i = 0; i < 3; i++) {
            const mossiness = i * 0.3;
            this.graphicsEngine.createEnhancedRock(1.0, mossiness);
        }

        // Create flower variations with different colors
        const flowerColors = [
            { petal: 0xFF69B4, center: 0xFFD700 }, // Pink with gold center
            { petal: 0x9370DB, center: 0xFFA500 }, // Purple with orange center
            { petal: 0xFF6347, center: 0xFFFFE0 }, // Red with cream center
            { petal: 0x4169E1, center: 0xFFF8DC }, // Blue with cornsilk center
            { petal: 0xFFB6C1, center: 0xFF69B4 }  // Light pink with hot pink center
        ];

        flowerColors.forEach((color, index) => {
            this.graphicsEngine.createEnhancedFlower(color.petal, color.center, 1.0);
        });

        // Create magical sparkle for interactions
        this.graphicsEngine.createMagicalSparkle(0x00FFFF, 0.8); // Cyan sparkle for interactions
    }

    createWorldBackground() {
        // Create a large green ground background
        const background = this.add.graphics();
        background.fillStyle(0x7CFC00); // Lawn green
        background.fillRect(0, 0, this.worldWidth, this.worldHeight);
        
        // Add some texture with different shades of green
        background.fillStyle(0x90EE90, 0.3); // Light green patches
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const size = Phaser.Math.Between(20, 80);
            background.fillCircle(x, y, size);
        }
    }

    createPlayer() {
        // Get saved position or use center of world
        const savedPos = GameState.get('world.currentPosition');
        const startX = savedPos ? savedPos.x : this.worldWidth / 2;
        const startY = savedPos ? savedPos.y : this.worldHeight / 2;
        
        // Get creature genetics for proper sprite creation
        const creatureData = GameState.get('creature');
        let creatureTextures = ['enhancedCreature0']; // Default fallback
        
        if (creatureData && creatureData.genetics) {
            console.log('game:info [GameScene] Creating player with genetics:', creatureData.genetics.id);
            
            // Create creature sprites with genetics for all animation frames
            const spriteResults = [];
            for (let frame = 0; frame < 4; frame++) {
                const spriteResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(creatureData.genetics, frame);
                spriteResults.push(spriteResult.textureName);
            }
            creatureTextures = spriteResults;
            
            // Store the genetics reference for later use
            this.playerGenetics = creatureData.genetics;
        } else {
            console.warn('game:warn [GameScene] No genetics found, using default creature sprites');
            // Create fallback enhanced creature frames
            for (let frame = 0; frame < 4; frame++) {
                this.graphicsEngine.createEnhancedCreature(0x9370DB, 0xDDA0DD, 0x8A2BE2, frame, null);
            }
        }
        
        // Create physics sprite with the first texture
        this.player = this.physics.add.sprite(startX, startY, creatureTextures[0]);
        this.player.setScale(1.0);
        this.player.setCollideWorldBounds(true);
        
        // Make creature clickable for care interactions
        this.player.setInteractive({ cursor: 'pointer' });
        this.player.on('pointerdown', () => {
            this.showCreatureCareMenu();
        });
        
        // Add hover effect to show it's interactive
        this.player.on('pointerover', () => {
            this.player.setTint(0xffcccc); // Light red tint
            this.showInteractionHint('Click to care for your creature');
        });
        
        this.player.on('pointerout', () => {
            this.player.clearTint();
            this.hideInteractionHint();
        });
        
        // Create enhanced walking animation with genetics-based frames
        this.anims.create({
            key: 'walk',
            frames: creatureTextures.map(texture => ({ key: texture })),
            frameRate: 8,
            repeat: -1
        });

        // Create idle animation (just first frame)
        this.anims.create({
            key: 'idle',
            frames: [{ key: creatureTextures[0] }],
            frameRate: 1
        });
        
        console.log('game:info [GameScene] Player creature created with textures:', creatureTextures);
    }

    setupCamera() {
        // Make camera follow the player
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setZoom(1);
    }

    createEnvironmentObjects() {
        // Create physics groups for environment objects
        this.trees = this.physics.add.staticGroup();
        this.rocks = this.physics.add.staticGroup();
        this.flowers = this.physics.add.staticGroup();

        // Place enhanced trees randomly throughout the world
        const treeVariants = ['enhancedTree_summer', 'enhancedTree_spring', 'enhancedTree_autumn'];
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(100, this.worldWidth - 100);
            const y = Phaser.Math.Between(100, this.worldHeight - 100);
            const treeType = treeVariants[Math.floor(Math.random() * treeVariants.length)];
            const tree = this.trees.create(x, y, treeType);
            tree.setScale(Phaser.Math.FloatBetween(0.8, 1.4));
            tree.body.setSize(30, 40); // Collision area smaller than sprite
        }

        // Place enhanced rocks randomly with moss variations
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(50, this.worldWidth - 50);
            const y = Phaser.Math.Between(50, this.worldHeight - 50);
            const mossLevel = Math.floor(Math.random() * 3);
            const rock = this.rocks.create(x, y, `enhancedRock_${mossLevel}`);
            rock.setScale(Phaser.Math.FloatBetween(0.8, 1.4));
            rock.body.setSize(25, 20);
        }

        // Place enhanced flowers randomly with color variations
        for (let i = 0; i < 40; i++) {
            const x = Phaser.Math.Between(30, this.worldWidth - 30);
            const y = Phaser.Math.Between(30, this.worldHeight - 30);
            const flower = this.flowers.create(x, y, 'enhancedFlower');
            flower.setScale(Phaser.Math.FloatBetween(0.8, 1.2));
            flower.body.setSize(15, 20);
            
            // Add slight color tinting for variety
            const tints = [0xFFFFFF, 0xFFB6C1, 0xDDA0DD, 0x98FB98, 0xF0E68C];
            flower.setTint(tints[Math.floor(Math.random() * tints.length)]);
        }

        // Set up collision detection
        this.physics.add.collider(this.player, this.trees);
        this.physics.add.collider(this.player, this.rocks);
        this.physics.add.overlap(this.player, this.flowers, this.handleFlowerInteraction, null, this);
    }

    setupInput() {
        // Create cursor keys for arrow key movement
        this.cursors = this.input.keyboard.createCursorKeys();

        // Create WASD keys
        this.wasdKeys = this.input.keyboard.addKeys('W,S,A,D');

        // C key for chat toggle
        this.chatKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);

        // Care system keys
        this.feedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.playKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this.restKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.careKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);

        // Space key for interactions
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    createUI() {
        // Reset button (top-left corner, fixed to camera)
        this.createResetButton();

        // Position display (moved right to make room for reset button)
        this.positionText = this.add.text(16, 60, 'Position: (0, 0)', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 6, y: 3 }
        });
        this.positionText.setScrollFactor(0); // Keep fixed on screen

        // Creature stats display (top-right corner)
        const creature = GameState.get('creature');
        this.statsText = this.add.text(784, 16, '', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 },
            align: 'right'
        });
        this.statsText.setOrigin(1, 0);
        this.statsText.setScrollFactor(0);
        this.updateStatsDisplay();

        // Daily bonus button (top-center)
        this.createDailyBonusButton();

        // Care panel (hidden initially)
        this.createCarePanel();

        // Interaction hint (hidden initially)
        this.interactionText = this.add.text(400, 550, '', {
            fontSize: '14px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 }
        });
        this.interactionText.setOrigin(0.5);
        this.interactionText.setScrollFactor(0);
        this.interactionText.setVisible(false);

        // Care hint (bottom-left corner)
        this.careHintText = this.add.text(16, 584, '', {
            fontSize: '12px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 6, y: 3 }
        });
        this.careHintText.setOrigin(0, 1);
        this.careHintText.setScrollFactor(0);
        this.updateCareHint();
    }

    createDailyBonusButton() {
        // Check if care system is available
        if (!this.careSystem) {
            console.warn('CareSystem not available, skipping daily bonus button');
            return;
        }
        
        // Daily bonus button (top-center)
        const dailyBonus = this.careSystem.getDailyLoginBonus();

        this.dailyBonusButton = this.add.text(400, 16, '', {
            fontSize: '14px',
            color: dailyBonus.available ? '#FFD700' : '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: dailyBonus.available ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)',
            padding: { x: 12, y: 6 },
            align: 'center'
        });
        this.dailyBonusButton.setOrigin(0.5, 0);
        this.dailyBonusButton.setScrollFactor(0);
        this.dailyBonusButton.setInteractive({ useHandCursor: true });
        
        // Add accessibility attributes
        this.dailyBonusButton.setData('tooltip', 'Claim your daily bonus for extra XP and rewards');
        this.dailyBonusButton.setData('ariaLabel', 'Daily Bonus Button');

        // Make it clickable with visual feedback
        this.dailyBonusButton.on('pointerdown', () => {
            this.claimDailyBonus();
            // Add visual feedback
            if (window.UXEnhancements) {
                const buttonElement = this.dailyBonusButton;
                buttonElement.setScale(0.95);
                this.time.delayedCall(100, () => buttonElement.setScale(1));
            }
        });
        
        // Add hover effect
        this.dailyBonusButton.on('pointerover', () => {
            this.dailyBonusButton.setScale(1.05);
        });
        
        this.dailyBonusButton.on('pointerout', () => {
            this.dailyBonusButton.setScale(1);
        });

        this.updateDailyBonusButton();
    }

    createResetButton() {
        // Reset button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0xFF4444, 0.9);
        buttonBg.fillRoundedRect(16, 16, 80, 30, 6);
        buttonBg.lineStyle(2, 0xFFFFFF);
        buttonBg.strokeRoundedRect(16, 16, 80, 30, 6);
        buttonBg.setScrollFactor(0); // Keep fixed on screen

        // Reset button text
        const resetText = this.add.text(56, 31, '🔄 RESET', {
            fontSize: '12px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        resetText.setScrollFactor(0); // Keep fixed on screen

        // Make button interactive
        const resetButton = this.add.zone(16, 16, 80, 30)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });
        resetButton.setScrollFactor(0); // Keep fixed on screen

        resetButton.on('pointerdown', () => {
            this.resetGameData();
        });

        resetButton.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF6666, 0.9);
            buttonBg.fillRoundedRect(16, 16, 80, 30, 6);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(16, 16, 80, 30, 6);
        });

        resetButton.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF4444, 0.9);
            buttonBg.fillRoundedRect(16, 16, 80, 30, 6);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(16, 16, 80, 30, 6);
        });
    }

    resetGameData() {
        // Clear all game data and reload
        localStorage.removeItem('mythical-creature-save');
        console.log('🔄 Game data reset from game scene');
        window.location.reload();
    }

    createCarePanel() {
        // Care panel background (hidden initially)
        this.carePanelBg = this.add.graphics();
        this.carePanelBg.fillStyle(0x000000, 0.8);
        this.carePanelBg.fillRoundedRect(50, 50, 300, 400, 10);
        this.carePanelBg.lineStyle(2, 0x4B0082);
        this.carePanelBg.strokeRoundedRect(50, 50, 300, 400, 10);
        this.carePanelBg.setScrollFactor(0);
        this.carePanelBg.setVisible(false);

        // Care panel title
        this.carePanelTitle = this.add.text(200, 70, 'Creature Care', {
            fontSize: '18px',
            color: '#FFD700',
            align: 'center'
        });
        this.carePanelTitle.setOrigin(0.5, 0);
        this.carePanelTitle.setScrollFactor(0);
        this.carePanelTitle.setVisible(false);

        // Care action buttons
        this.createCareButtons();

        // Close button
        this.careCloseButton = this.add.text(330, 60, '✕', {
            fontSize: '20px',
            color: '#FF6347',
            padding: { x: 4, y: 4 }
        });
        this.careCloseButton.setScrollFactor(0);
        this.careCloseButton.setInteractive({ useHandCursor: true });
        this.careCloseButton.setData('tooltip', 'Close care panel');
        this.careCloseButton.setData('ariaLabel', 'Close care panel');
        
        // Add visual feedback on click
        this.careCloseButton.on('pointerdown', () => {
            this.toggleCarePanel();
            if (window.UXEnhancements) {
                window.UXEnhancements.announce('Care panel closed');
            }
        });
        
        // Add hover effect
        this.careCloseButton.on('pointerover', () => {
            this.careCloseButton.setScale(1.2);
        });
        
        this.careCloseButton.on('pointerout', () => {
            this.careCloseButton.setScale(1);
        });
        
        this.careCloseButton.setVisible(false);
    }

    createCareButtons() {
        // Initialize careButtons even if CareSystem is not available
        this.careButtons = {};
        
        if (!this.careSystem) {
            console.warn('CareSystem not available, skipping care buttons');
            return;
        }
        
        const careActions = this.careSystem.getAllCareActionsInfo();
        const buttonY = 100;

        Object.entries(careActions).forEach(([actionType, info], index) => {
            const y = buttonY + (index * 60);

            // Button background
            const buttonBg = this.add.graphics();
            buttonBg.fillStyle(info.canPerform ? 0x228B22 : 0x666666, 0.8);
            buttonBg.fillRoundedRect(70, y, 260, 50, 5);
            buttonBg.setScrollFactor(0);
            buttonBg.setVisible(false);

            // Button text
            const buttonText = this.add.text(200, y + 25, '', {
                fontSize: '14px',
                color: '#FFFFFF',
                align: 'center'
            });
            buttonText.setOrigin(0.5);
            buttonText.setScrollFactor(0);
            buttonText.setVisible(false);

            // Make button interactive
            buttonBg.setInteractive({ useHandCursor: true });
            buttonBg.setData('tooltip', info.description || `Perform ${info.name} action`);
            buttonBg.setData('ariaLabel', `${info.name} button`);
            
            buttonBg.on('pointerdown', () => {
                this.performCareAction(actionType);
                // Add visual feedback
                buttonBg.setScale(0.95);
                this.time.delayedCall(100, () => buttonBg.setScale(1));
            });
            
            // Add hover effect
            buttonBg.on('pointerover', () => {
                buttonBg.setAlpha(0.9);
            });
            
            buttonBg.on('pointerout', () => {
                buttonBg.setAlpha(1);
            });

            this.careButtons[actionType] = {
                bg: buttonBg,
                text: buttonText,
                y: y
            };
        });

        this.updateCareButtons();
    }

    updateCareHint() {
        if (!this.careSystem) {
            this.careHintText.setText('Care system unavailable');
            return;
        }
        
        const careStatus = this.careSystem.getCareStatus();
        if (!careStatus) return;

        const happinessDesc = this.careSystem.getHappinessDescription(careStatus.happiness);
        const hintText = `TAB: Care Menu | F: Feed (${careStatus.dailyCare.feedCount}/3) | P: Play (${careStatus.dailyCare.playCount}/2) | R: Rest`;

        this.careHintText.setText(hintText);
    }

    checkAndUnlockAchievements() {
        if (!this.achievementSystem) {
            return;
        }
        
        const newUnlocks = this.achievementSystem.checkAchievements();

        newUnlocks.forEach(achievement => {
            this.showAchievementNotification(achievement);
            // Grant XP reward
            GameState.updateCreature({ experience: achievement.reward });
        });
    }

    showAchievementNotification(achievement) {
        const notification = this.add.text(400, 150, '', {
            fontSize: '18px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 20, y: 12 }
        });
        notification.setOrigin(0.5);

        const message = `🏆 Achievement Unlocked!\n${achievement.icon} ${achievement.name}\n${achievement.description}\n+${achievement.reward} XP`;

        notification.setText(message);
        
        // Announce to screen reader
        if (window.UXEnhancements) {
            window.UXEnhancements.announce(`Achievement unlocked: ${achievement.name}. ${achievement.description}`, 'assertive');
        }

        // Animate notification
        this.tweens.add({
            targets: notification,
            scale: { from: 0.5, to: 1.2 },
            alpha: { from: 0, to: 1 },
            duration: 600,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Hold for 3 seconds, then fade out
                this.time.delayedCall(3000, () => {
                    this.tweens.add({
                        targets: notification,
                        alpha: 0,
                        scale: 0.8,
                        duration: 800,
                        onComplete: () => notification.destroy()
                    });
                });
            }
        });
    }

    getAchievementProgressText() {
        if (!this.achievementSystem) {
            return 'Achievements: N/A';
        }
        
        const progress = this.achievementSystem.getProgressPercentage();
        const unlocked = this.achievementSystem.getUnlockedAchievements().length;
        const total = Object.keys(this.achievementSystem.achievements).length;

        return `Achievements: ${unlocked}/${total} (${progress}%)`;
    }

    checkAndCompleteTutorials() {
        if (!this.tutorialSystem) {
            return;
        }
        
        const gameState = GameState.get();
        const completedSteps = this.tutorialSystem.checkTutorials(gameState, this);

        completedSteps.forEach(step => {
            this.showTutorialCompletion(step);
        });
    }

    showTutorialHintIfNeeded() {
        if (!this.tutorialSystem) {
            return;
        }
        
        const gameState = GameState.get();
        const nextTutorial = this.tutorialSystem.getNextTutorial(gameState, this);

        if (nextTutorial && !this.isShowingTutorial) {
            this.showTutorialHint(nextTutorial);
        }
    }

    showTutorialHint(tutorial) {
        this.isShowingTutorial = true;

        const hint = this.add.text(400, 100, tutorial.message, {
            fontSize: '16px',
            color: '#87CEEB',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 10 }
        });
        hint.setOrigin(0.5);
        hint.setScrollFactor(0);

        // Add title
        const title = this.add.text(400, 75, `💡 ${tutorial.title} Tutorial`, {
            fontSize: '14px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center'
        });
        title.setOrigin(0.5);
        title.setScrollFactor(0);

        // Animate in
        this.tweens.add({
            targets: [title, hint],
            alpha: { from: 0, to: 1 },
            y: { from: 50, to: '+=25' },
            duration: 600,
            ease: 'Back.easeOut'
        });

        // Remove after 6 seconds
        this.time.delayedCall(6000, () => {
            this.tweens.add({
                targets: [title, hint],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    title.destroy();
                    hint.destroy();
                    this.isShowingTutorial = false;
                }
            });
        });
    }

    showTutorialCompletion(tutorial) {
        const completion = this.add.text(400, 120, `✅ ${tutorial.title} Complete!`, {
            fontSize: '18px',
            color: '#90EE90',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 8 }
        });
        completion.setOrigin(0.5);
        completion.setScrollFactor(0);

        this.tweens.add({
            targets: completion,
            scale: { from: 0.8, to: 1.1 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: completion,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => completion.destroy()
                    });
                });
            }
        });
    }

    getTutorialProgressText() {
        if (!this.tutorialSystem) {
            return 'Tutorial: N/A';
        }
        return this.tutorialSystem.getProgressText();
    }

    updateDailyBonusButton() {
        if (!this.careSystem || !this.dailyBonusButton) {
            return;
        }
        
        const dailyBonus = this.careSystem.getDailyLoginBonus();

        if (dailyBonus.available) {
            this.dailyBonusButton.setText(`🎁 Daily Bonus Available! (+${dailyBonus.rewards.xp} XP)`);
            this.dailyBonusButton.setBackgroundColor('rgba(255, 215, 0, 0.3)');
        } else if (dailyBonus.claimed) {
            this.dailyBonusButton.setText('✅ Bonus Claimed Today');
            this.dailyBonusButton.setBackgroundColor('rgba(0, 0, 0, 0.5)');
        } else {
            this.dailyBonusButton.setText('🎁 Next Bonus Tomorrow');
            this.dailyBonusButton.setBackgroundColor('rgba(0, 0, 0, 0.5)');
        }
    }

    updateCareButtons() {
        if (!this.careSystem || !this.careButtons) {
            return;
        }
        
        const careActions = this.careSystem.getAllCareActionsInfo();

        Object.entries(careActions).forEach(([actionType, info]) => {
            const button = this.careButtons[actionType];
            if (!button) return;

            const countText = info.isUnlimited ? '' : ` (${info.currentCount}/${info.limit})`;
            const statusText = info.canPerform ? 'Ready' : 'Cooldown';

            button.text.setText(`${info.icon} ${info.name}${countText} - ${statusText}`);

            // Update button color
            button.bg.clear();
            button.bg.fillStyle(info.canPerform ? 0x228B22 : 0x666666, 0.8);
            button.bg.fillRoundedRect(70, button.y, 260, 50, 5);
        });
    }

    claimDailyBonus() {
        if (!this.careSystem) {
            return;
        }
        
        const success = this.careSystem.claimDailyLoginBonus();
        if (success) {
            this.showBonusClaimedMessage();
            this.updateDailyBonusButton();
        }
    }

    performCareAction(actionType) {
        if (!this.careSystem) {
            return;
        }
        
        const result = this.careSystem.performCareAction(actionType);
        if (result.success) {
            this.showCareActionMessage(actionType, result.happinessBonus);
            this.updateCareButtons();
            this.updateCareHint();
            this.updateStatsDisplay();
        } else {
            this.showCareActionMessage(actionType, 0, result.reason);
        }
    }

    showBonusClaimedMessage() {
        const bonusText = this.add.text(400, 100, '🎉 Daily Bonus Claimed!', {
            fontSize: '20px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 8 }
        });
        bonusText.setOrigin(0.5);
        bonusText.setScrollFactor(0);
        
        // Announce to screen reader
        if (window.UXEnhancements) {
            window.UXEnhancements.announce('Daily bonus claimed successfully!', 'assertive');
        }

        this.tweens.add({
            targets: bonusText,
            scale: { from: 0.8, to: 1.2 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: bonusText,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => bonusText.destroy()
                    });
                });
            }
        });
    }

    showCareActionMessage(actionType, happinessBonus, error = null) {
        if (!this.careSystem) {
            return;
        }
        
        const actionInfo = this.careSystem.careActions[actionType];
        const message = error || `${actionInfo.icon} ${actionInfo.name} +${happinessBonus} Happiness!`;
        const color = error ? '#FF6347' : '#90EE90';

        const actionText = this.add.text(400, 120, message, {
            fontSize: '16px',
            color: color,
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 12, y: 6 }
        });
        actionText.setOrigin(0.5);
        actionText.setScrollFactor(0);

        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: actionText,
                alpha: 0,
                duration: 500,
                onComplete: () => actionText.destroy()
            });
        });
    }

    toggleCarePanel() {
        this.isCarePanelOpen = !this.isCarePanelOpen;

        // Toggle visibility of all care panel elements
        this.carePanelBg.setVisible(this.isCarePanelOpen);
        this.carePanelTitle.setVisible(this.isCarePanelOpen);
        this.careCloseButton.setVisible(this.isCarePanelOpen);

        // Only iterate over careButtons if they exist
        if (this.careButtons) {
            Object.values(this.careButtons).forEach(button => {
                button.bg.setVisible(this.isCarePanelOpen);
                button.text.setVisible(this.isCarePanelOpen);
            });
        }

        if (this.isCarePanelOpen) {
            this.updateCareButtons();
            // Announce to screen reader
            if (window.UXEnhancements) {
                window.UXEnhancements.announce('Care panel opened. Use Tab to navigate options.');
            }
        }
    }

    handleFlowerInteraction(player, flower) {
        // Show interaction hint when near flowers
        this.showInteractionHint('Press SPACE to smell the flower');
        
        // Store reference to current flower for space key interaction
        this.nearbyFlower = flower;
    }

    showInteractionHint(message) {
        this.interactionText.setText(message);
        this.interactionText.setVisible(true);
        
        // Hide the hint after 3 seconds
        this.time.delayedCall(3000, () => {
            this.interactionText.setVisible(false);
        });
    }

    hideInteractionHint() {
        this.interactionText.setVisible(false);
    }

    showCreatureCareMenu() {
        // Prevent multiple menus
        if (this.careMenuOpen) {
            this.hideCreatureCareMenu();
            return;
        }

        this.careMenuOpen = true;

        // Create semi-transparent background
        this.careMenuBg = this.add.graphics();
        this.careMenuBg.fillStyle(0x000000, 0.7);
        this.careMenuBg.fillRect(0, 0, 800, 600);
        this.careMenuBg.setScrollFactor(0);

        // Create care menu panel
        const panelX = 250;
        const panelY = 150;
        const panelW = 300;
        const panelH = 300;

        this.careMenuPanel = this.add.graphics();
        this.careMenuPanel.fillStyle(0x4B0082, 0.95);
        this.careMenuPanel.fillRoundedRect(panelX, panelY, panelW, panelH, 15);
        this.careMenuPanel.lineStyle(4, 0xFFD700);
        this.careMenuPanel.strokeRoundedRect(panelX, panelY, panelW, panelH, 15);
        this.careMenuPanel.setScrollFactor(0);

        // Title
        this.careMenuTitle = this.add.text(400, 180, '💖 Care for Your Creature 💖', {
            fontSize: '20px',
            color: '#FFD700',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        this.careMenuTitle.setScrollFactor(0);

        // Get creature name
        const creatureName = GameState.get('creature.name');
        this.creatureNameText = this.add.text(400, 210, `${creatureName} is happy to see you!`, {
            fontSize: '14px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5);
        this.creatureNameText.setScrollFactor(0);

        // Care buttons
        this.createCareButtons();

        // Close button
        this.createCareMenuCloseButton();

        // Add to a group for easy cleanup
        this.careMenuGroup = [
            this.careMenuBg,
            this.careMenuPanel,
            this.careMenuTitle,
            this.creatureNameText
        ];
    }

    createCareButtons() {
        const buttonY = 250;
        const buttonSpacing = 60;
        const buttonWidth = 80;
        const buttonHeight = 40;

        // Feed button
        this.createCareButton(300, buttonY, buttonWidth, buttonHeight, '🍎 FEED', 'feed', 0x00AA00);
        
        // Play button  
        this.createCareButton(400, buttonY, buttonWidth, buttonHeight, '🎾 PLAY', 'play', 0x0080FF);
        
        // Rest button
        this.createCareButton(500, buttonY, buttonWidth, buttonHeight, '😴 REST', 'rest', 0xFF6600);

        // Pet button (new)
        this.createCareButton(350, buttonY + buttonSpacing, buttonWidth, buttonHeight, '🤗 PET', 'pet', 0xFF69B4);
        
        // Stats button
        this.createCareButton(450, buttonY + buttonSpacing, buttonWidth, buttonHeight, '📊 STATS', 'stats', 0x9370DB);
    }

    createCareButton(x, y, width, height, text, action, color) {
        // Button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(color, 0.9);
        buttonBg.fillRoundedRect(x - width/2, y - height/2, width, height, 8);
        buttonBg.lineStyle(2, 0xFFFFFF);
        buttonBg.strokeRoundedRect(x - width/2, y - height/2, width, height, 8);
        buttonBg.setScrollFactor(0);

        // Button text
        const buttonText = this.add.text(x, y, text, {
            fontSize: '12px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        buttonText.setScrollFactor(0);

        // Interactive zone
        const buttonZone = this.add.zone(x, y, width, height)
            .setInteractive({ cursor: 'pointer' });
        buttonZone.setScrollFactor(0);

        buttonZone.on('pointerdown', () => {
            this.performCareAction(action);
        });

        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            const lighterColor = Phaser.Display.Color.GetColor32(
                Math.min(255, Phaser.Display.Color.GetRed(color) + 30),
                Math.min(255, Phaser.Display.Color.GetGreen(color) + 30),
                Math.min(255, Phaser.Display.Color.GetBlue(color) + 30),
                255
            );
            buttonBg.fillStyle(lighterColor, 0.9);
            buttonBg.fillRoundedRect(x - width/2, y - height/2, width, height, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(x - width/2, y - height/2, width, height, 8);
        });

        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(color, 0.9);
            buttonBg.fillRoundedRect(x - width/2, y - height/2, width, height, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(x - width/2, y - height/2, width, height, 8);
        });

        // Add to group for cleanup (only if careMenuGroup exists)
        if (this.careMenuGroup) {
            this.careMenuGroup.push(buttonBg, buttonText, buttonZone);
        }
    }

    createCareMenuCloseButton() {
        const closeX = 520;
        const closeY = 170;

        const closeBg = this.add.graphics();
        closeBg.fillStyle(0xFF4444, 0.9);
        closeBg.fillRoundedRect(closeX - 15, closeY - 15, 30, 30, 5);
        closeBg.lineStyle(2, 0xFFFFFF);
        closeBg.strokeRoundedRect(closeX - 15, closeY - 15, 30, 30, 5);
        closeBg.setScrollFactor(0);

        const closeText = this.add.text(closeX, closeY, '✕', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        closeText.setScrollFactor(0);

        const closeZone = this.add.zone(closeX, closeY, 30, 30)
            .setInteractive({ cursor: 'pointer' });
        closeZone.setScrollFactor(0);

        closeZone.on('pointerdown', () => {
            this.hideCreatureCareMenu();
        });

        if (this.careMenuGroup) {
            this.careMenuGroup.push(closeBg, closeText, closeZone);
        }
    }

    hideCreatureCareMenu() {
        if (!this.careMenuOpen) return;

        this.careMenuOpen = false;

        // Clean up all menu elements
        if (this.careMenuGroup) {
            this.careMenuGroup.forEach(element => {
                if (element && element.destroy) {
                    element.destroy();
                }
            });
            this.careMenuGroup = [];
        }
    }

    performCareAction(action) {
        const creature = GameState.get('creature');
        let message = '';
        let effect = null;

        switch (action) {
            case 'feed':
                if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
                    const result = this.careSystem.performCareAction('feed');
                    message = result.success ? `🍎 Fed ${creature.name}! +15 Happiness` : result.message;
                } else {
                    // Fallback
                    GameState.updateCreature({ experience: 10 });
                    message = `🍎 Fed ${creature.name}! +10 XP`;
                }
                effect = 0x00FF00; // Green
                break;
            case 'play':
                if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
                    const result = this.careSystem.performCareAction('play');
                    message = result.success ? `🎾 Played with ${creature.name}! +10 Happiness` : result.message;
                } else {
                    GameState.updateCreature({ experience: 15 });
                    message = `🎾 Played with ${creature.name}! +15 XP`;
                }
                effect = 0x0080FF; // Blue
                break;
            case 'rest':
                if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
                    const result = this.careSystem.performCareAction('rest');
                    message = result.success ? `😴 ${creature.name} rested! +5 Happiness` : result.message;
                } else {
                    GameState.updateCreature({ experience: 5 });
                    message = `😴 ${creature.name} rested! +5 XP`;
                }
                effect = 0xFF6600; // Orange
                break;
            case 'pet':
                GameState.updateCreature({ experience: 8 });
                message = `🤗 Petted ${creature.name}! +8 XP`;
                effect = 0xFF69B4; // Pink
                break;
            case 'stats':
                const stats = GameState.get('creature.stats');
                const level = GameState.get('creature.level');
                const exp = GameState.get('creature.experience');
                message = `📊 ${creature.name} - Level ${level} | HP:${stats.health} Happiness:${stats.happiness} Energy:${stats.energy} | XP:${exp}`;
                effect = 0x9370DB; // Purple
                break;
        }

        // Show care effect
        this.showCareEffect(message, effect);
        
        // Update stats display
        this.updateStatsDisplay();

        // Close menu after action
        this.time.delayedCall(1500, () => {
            this.hideCreatureCareMenu();
        });
    }

    showCareEffect(message, color) {
        // Create floating message
        const effectText = this.add.text(this.player.x, this.player.y - 50, message, {
            fontSize: '14px',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Animate the message
        this.tweens.add({
            targets: effectText,
            y: effectText.y - 30,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                effectText.destroy();
            }
        });

        // Creature happiness animation
        this.tweens.add({
            targets: this.player,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true
        });
    }

    handleSpaceInteraction() {
        if (this.nearbyFlower) {
            // Track interaction in GameState
            GameState.updateWorldExploration(
                { x: this.player.x, y: this.player.y }, 
                'flowers'
            );
            
            // Create a magical sparkle effect on the flower
            const sparkle = this.add.image(this.nearbyFlower.x, this.nearbyFlower.y - 20, 'magicalSparkle');
            sparkle.setScale(0.6);
            
            // Animate the sparkle
            this.tweens.add({
                targets: sparkle,
                y: sparkle.y - 30,
                alpha: { from: 1, to: 0 },
                scale: { from: 0.5, to: 1 },
                duration: 1000,
                onComplete: () => sparkle.destroy()
            });
            
            // Update creature happiness
            GameState.updateCreature({
                stats: { happiness: GameState.get('creature.stats.happiness') + 2 }
            });

            // Show interaction message
            this.showInteractionHint('*sniff* What a lovely smell! (+2 Happiness, +5 XP)');
            this.nearbyFlower = null;

            // Update stats display
            this.updateStatsDisplay();

            // Check achievements after flower interaction
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        }
    }

    update() {
        // Handle player movement
        this.handleMovement();

        // Update position display
        this.updatePositionDisplay();

        // Handle C key for chat toggle
        if (Phaser.Input.Keyboard.JustDown(this.chatKey)) {
            this.toggleChat();
        }

        // Handle care keys (only if care system is available)
        if (this.careSystem) {
            if (Phaser.Input.Keyboard.JustDown(this.feedKey)) {
                this.performCareAction('feed');
            }
            if (Phaser.Input.Keyboard.JustDown(this.playKey)) {
                this.performCareAction('play');
            }
            if (Phaser.Input.Keyboard.JustDown(this.restKey)) {
                this.performCareAction('rest');
            }
            if (Phaser.Input.Keyboard.JustDown(this.careKey)) {
                this.toggleCarePanel();
            }
        }

        // Handle space key for interactions
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.handleSpaceInteraction();
        }

        // Check achievements periodically (every 5 seconds)
        if (this.time.now % 5000 < 100) {
            this.checkAndUnlockAchievements();
        }

        // Check tutorials periodically (every 3 seconds)
        if (this.time.now % 3000 < 100) {
            this.checkAndCompleteTutorials();
        }

        // Show tutorial hint if there's an active tutorial
        if (this.time.now % 8000 < 100) {
            this.showTutorialHintIfNeeded();
        }

        // Reset nearby flower when moving away
        if (!this.physics.overlap(this.player, this.flowers)) {
            this.nearbyFlower = null;
        }
    }

    handleMovement() {
        const speed = 200;
        let velocityX = 0;
        let velocityY = 0;
        let isMoving = false;

        // Check for input from both arrow keys and WASD
        if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
            velocityX = -speed;
            isMoving = true;
        } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
            velocityX = speed;
            isMoving = true;
        }

        if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
            velocityY = -speed;
            isMoving = true;
        } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
            velocityY = speed;
            isMoving = true;
        }

        // Normalize diagonal movement
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707; // 1/√2 for normalized diagonal movement
            velocityY *= 0.707;
        }

        // Apply velocity to player
        this.player.setVelocity(velocityX, velocityY);

        // Handle animations
        if (isMoving) {
            this.player.anims.play('walk', true);
        } else {
            this.player.anims.play('idle', true);
        }

        // Flip player sprite based on movement direction
        if (velocityX < 0) {
            this.player.setFlipX(true);
        } else if (velocityX > 0) {
            this.player.setFlipX(false);
        }
    }

    updatePositionDisplay() {
        const x = Math.round(this.player.x);
        const y = Math.round(this.player.y);
        this.positionText.setText(`Position: (${x}, ${y})`);

        // Update position in GameState every few pixels
        if (Math.abs(x - (GameState.get('world.currentPosition.x') || 0)) > 5 ||
            Math.abs(y - (GameState.get('world.currentPosition.y') || 0)) > 5) {
            GameState.updateWorldExploration({ x, y });

            // Check tutorials after movement
            this.time.delayedCall(300, () => this.checkAndCompleteTutorials());
        }
    }

    updateStatsDisplay() {
        const creature = GameState.get('creature');
        const stats = creature.stats;
        
        let careStatus = null;
        let happinessDesc = { level: 'unknown' };
        
        if (this.careSystem) {
            try {
                if (typeof this.careSystem.getCareStatus === 'function') {
                    careStatus = this.careSystem.getCareStatus();
                }
                if (typeof this.careSystem.getHappinessDescription === 'function') {
                    happinessDesc = this.careSystem.getHappinessDescription(stats.happiness);
                }
            } catch (careError) {
                console.warn('[GameScene] Error getting care status:', careError);
                careStatus = null;
                happinessDesc = { level: 'unknown' };
            }
        }
        
        const achievementProgress = this.getAchievementProgressText();
        const tutorialProgress = this.getTutorialProgressText();

        const displayText = [
            `${creature.name} - Level ${creature.level}`,
            `XP: ${creature.experience}/100`,
            `❤️ ${stats.health} 😊 ${stats.happiness} (${happinessDesc.level}) ⚡ ${stats.energy}`,
            `Care Streak: ${careStatus ? careStatus.careStreak : 0} days`,
            `${achievementProgress}`,
            `${tutorialProgress}`,
            `Flowers: ${GameState.get('world.discoveredObjects.flowers')}`
        ].join('\n');

        this.statsText.setText(displayText);
    }

    setupGameStateListeners() {
        // Listen for level up events
        GameState.on('levelUp', (data) => {
            // Show level up message
            const levelUpText = this.add.text(400, 200,
                `🎉 Level Up!\nLevel ${data.oldLevel} → ${data.newLevel}`, {
                fontSize: '24px',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: { x: 16, y: 8 }
            });
            levelUpText.setOrigin(0.5);
            levelUpText.setScrollFactor(0);

            // Animate and remove after 3 seconds
            this.tweens.add({
                targets: levelUpText,
                scale: { from: 0.8, to: 1.2 },
                alpha: { from: 0, to: 1 },
                duration: 500,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.time.delayedCall(2500, () => {
                        this.tweens.add({
                            targets: levelUpText,
                            alpha: 0,
                            duration: 500,
                            onComplete: () => levelUpText.destroy()
                        });
                    });
                }
            });

            this.updateStatsDisplay();
            // Check achievements after level up
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        });

        // Listen for care action events
        GameState.on('careActionPerformed', (data) => {
            this.showCareActionMessage(data.action, data.happinessBonus);
            this.updateCareButtons();
            this.updateCareHint();
            this.updateStatsDisplay();
            // Check achievements after care actions
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        });

        // Listen for daily bonus events
        GameState.on('dailyBonusClaimed', (data) => {
            this.showBonusClaimedMessage();
            this.updateDailyBonusButton();
        });

        // Listen for state changes to update UI
        GameState.on('stateChanged', (data) => {
            if (data.path.startsWith('creature.stats') ||
                data.path.startsWith('creature.care') ||
                data.path.startsWith('world.discoveredObjects') ||
                data.path.startsWith('dailyBonus')) {
                this.updateStatsDisplay();
                this.updateCareHint();
                this.updateDailyBonusButton();
                if (this.isCarePanelOpen) {
                    this.updateCareButtons();
                }
            }
        });
    }

    /**
     * Initialize Kid Mode UI components
     */
    initializeKidMode() {
        if (!window.KidMode || !window.KidMode.isKidMode()) {
            return;
        }

        console.log('ui:info [GameScene] Initializing Kid Mode UI');

        // Create Kid Mode HUD elements
        this.createKidModeHUD();

        // Set up Kid Mode event handlers
        this.setupKidModeEvents();

        // Update creature interaction for Kid Mode
        this.enhanceCreatureInteraction();
    }

    /**
     * Create Kid Mode HUD with status bars and CTA buttons
     */
    createKidModeHUD() {
        // Get creature stats for status bars
        const creatureStats = GameState.get('creature.stats') || { happiness: 80, energy: 60, health: 90 };
        const needsData = {
            hunger: 100 - creatureStats.happiness,
            energy: 100 - creatureStats.energy, 
            fun: Math.max(0, 100 - creatureStats.happiness - 20)
        };

        // Create status bar at top
        if (window.responsiveManager) {
            this.kidModeStatusBar = window.responsiveManager.createKidModeStatusBar(this, needsData);
        }

        // Get next best action based on creature state
        const emotion = this.determineCreatureEmotion(creatureStats);
        const bestAction = window.KidMode.getNextBestAction(emotion);
        const secondaryActions = window.KidMode.getSecondaryActions(bestAction.action);

        // Create CTA bar at bottom
        if (window.responsiveManager) {
            this.kidModeCTABar = window.responsiveManager.createKidModeCTABar(this, {
                primaryAction: bestAction,
                secondaryActions: secondaryActions.slice(0, 2), // Limit to 2 secondary
                showPhoto: true
            });
        }

        // Show contextual help message
        if (bestAction.message) {
            window.KidMode.showHelpMessage(this, bestAction.message);
        }
    }

    /**
     * Determine creature's current emotion based on stats
     * @param {Object} stats - Creature stats object
     * @returns {string} Emotion string
     */
    determineCreatureEmotion(stats) {
        const { happiness, energy, health } = stats;

        // Prioritize critical needs
        if (happiness < 30) return 'hungry';
        if (energy < 30) return 'sleepy'; 
        if (health < 50) return 'dirty';
        
        // Secondary states
        if (happiness < 60) return 'bored';
        if (happiness > 80 && energy > 70) return 'excited';
        
        return 'default'; // Happy/content
    }

    /**
     * Set up Kid Mode event handlers
     */
    setupKidModeEvents() {
        // Listen for Kid Mode actions from UI
        this.events.on('kid_mode_action', (action) => {
            this.handleKidModeAction(action);
        });

        // Update HUD when stats change
        GameState.on('stateChanged', (data) => {
            if (data.path.startsWith('creature.stats') && window.KidMode && window.KidMode.isKidMode()) {
                this.updateKidModeHUD();
            }
        });
    }

    /**
     * Handle Kid Mode action buttons
     * @param {string} action - Action to perform
     */
    handleKidModeAction(action) {
        console.log(`ui:info [GameScene] Kid Mode action: ${action}`);

        switch (action) {
            case 'feed':
                this.performCareAction('feed');
                break;
            case 'play':
                this.performCareAction('play');
                break;
            case 'rest':
                this.performCareAction('rest');
                break;
            case 'pet':
                this.performCareAction('pet');
                break;
            case 'clean':
                this.performCareAction('clean');
                break;
            case 'photo':
                this.takeCreaturePhoto();
                break;
            default:
                console.log(`ui:warn [GameScene] Unknown Kid Mode action: ${action}`);
        }

        // Refresh HUD after action
        this.time.delayedCall(500, () => {
            this.updateKidModeHUD();
        });
    }

    /**
     * Take a photo of the creature (Kid Mode feature)
     */
    takeCreaturePhoto() {
        console.log('ui:info [GameScene] Taking creature photo');

        // Create camera flash effect
        const flash = this.add.graphics();
        flash.fillStyle(0xFFFFFF, 0.8);
        flash.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        flash.setScrollFactor(0);

        // Flash animation
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy()
        });

        // Show photo feedback
        window.KidMode.showHelpMessage(this, '📸 Photo saved! Your creature looks adorable!', 2000);

        // Play camera sound
        window.KidMode.playButtonSound(this);

        // Update stats slightly (creatures like attention)
        if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
            this.careSystem.performCareAction('pet', 0.5); // Small happiness boost
        }
    }

    /**
     * Update Kid Mode HUD elements
     */
    updateKidModeHUD() {
        if (!window.KidMode || !window.KidMode.isKidMode()) {
            return;
        }

        // Get current stats
        const creatureStats = GameState.get('creature.stats') || { happiness: 80, energy: 60, health: 90 };
        
        // Determine new best action
        const emotion = this.determineCreatureEmotion(creatureStats);
        const bestAction = window.KidMode.getNextBestAction(emotion);

        // Update CTA bar primary button
        if (this.kidModeCTABar) {
            // This is a simplified update - in practice you'd rebuild or update specific elements
            console.log(`ui:debug [GameScene] Updating Kid Mode HUD, new primary action: ${bestAction.action}`);
        }

        // Show new contextual message if emotion changed
        if (this.lastEmotion !== emotion) {
            window.KidMode.showHelpMessage(this, bestAction.message);
            this.lastEmotion = emotion;
        }
    }

    /**
     * Enhance creature interaction for Kid Mode (larger click target)
     */
    enhanceCreatureInteraction() {
        if (this.player && window.KidMode && window.KidMode.isKidMode()) {
            // Make creature more clickable in Kid Mode
            this.player.setInteractive(new Phaser.Geom.Circle(0, 0, 60), Phaser.Geom.Circle.Contains);
            
            // Visual feedback for Kid Mode
            this.player.on('pointerover', () => {
                this.tweens.add({
                    targets: this.player,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 200,
                    ease: 'Power2'
                });
            });

            this.player.on('pointerout', () => {
                this.tweens.add({
                    targets: this.player,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 200,
                    ease: 'Power2'
                });
            });
        }
    }

    /**
     * Toggle chat interface
     */
    toggleChat() {
        console.log('Chat toggle - feature coming soon!');
        // TODO: Implement chat UI when needed
    }
}