import PlatformerLevelScene from '../PlatformerLevelScene.js';

/**
 * MythicalForestLevel - Mystical Forest platformer level
 *
 * Story: "An ancient forest where the trees whisper secrets of the cosmos.
 * The Elder Treant guards the heart of this mystical realm, its roots reaching
 * deep into the void between worlds. Those who seek the Forest Core must
 * prove their worth against nature's eternal guardian."
 *
 * Features:
 * - Enchanted forest atmosphere with magical particles
 * - Mystical tree enemies and forest spirits
 * - Elder Treant boss with root/vine attacks
 * - Forest Core ship part reward
 */
class MythicalForestLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1',
            biomeId: 'mythical_forest',
            levelWidth: 5000,
            levelHeight: 800
        });

        // Physics tuned for forest platforming
        this.playerSpeed = 200;
        this.jumpVelocity = -450;
        this.playerAcceleration = 0.20;
        this.playerDeceleration = 0.70;
        this.coyoteTime = 150;
        this.jumpBufferTime = 150;

        // Level-specific state
        this.starFragmentsCollected = 0;
        this.totalStarFragments = 5;
        this.bossDefeated = false;
        this.forestCoreFound = false;
        this.bossFightActive = false;

        // Boss state
        this.boss = null;
        this.bossHealth = 0;
        this.bossMaxHealth = 10;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;

        // Forest particles
        this.forestParticles = [];
        this.magicMotes = [];
    }

    /**
     * Override init to reset level-specific state on restart
     */
    init(data) {
        super.init(data);

        // Check if this is a test/preview mode - spawn boss immediately
        this.testMode = data?.testMode || false;

        // Reset level-specific state
        this.starFragmentsCollected = 0;
        this.bossDefeated = false;
        this.forestCoreFound = false;
        this.bossFightActive = false;

        // Reset boss state
        this.boss = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;

        // Reset particles
        this.forestParticles = [];
        this.magicMotes = [];

        console.log('[MythicalForestLevel] Level state reset');
    }

    create() {
        super.create();

        // Record level entry
        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('level_entered', { levelId: 'mythicalForest' });
        }

        this.levelStartTime = Date.now();
        this.damageTaken = 0;

        // Show level entry or test mode
        if (this.testMode) {
            this.startTestMode();
        } else {
            this.showLevelEntry();
        }
    }

    /**
     * Test mode - spawn boss immediately for preview
     */
    startTestMode() {
        console.log('[MythicalForestLevel] TEST MODE - Spawning boss immediately');

        // Create forest background
        this.createForestBackground();

        // Create basic platform for boss arena
        this.createTestArenaPlatform();

        // Position player
        if (this.player) {
            this.player.setPosition(200, this.levelHeight - 200);
        }

        // Spawn the boss immediately
        this.time.delayedCall(500, () => {
            this.spawnElderTreant();
        });
    }

    /**
     * Create a simple test arena platform
     */
    createTestArenaPlatform() {
        const groundY = this.levelHeight - 100;

        // Ground platform
        const ground = this.add.graphics();
        ground.fillStyle(0x2D4A2D, 1);
        ground.fillRect(0, groundY, this.levelWidth, 100);

        // Add grass texture
        ground.fillStyle(0x3D5A3D, 1);
        for (let x = 0; x < this.levelWidth; x += 20) {
            const grassHeight = 5 + Math.random() * 10;
            ground.fillRect(x, groundY - grassHeight, 3, grassHeight);
        }

        // Create physics platform
        if (!this.platforms) {
            this.platforms = this.physics.add.staticGroup();
        }

        const platformZone = this.add.zone(this.levelWidth / 2, groundY + 50, this.levelWidth, 100);
        this.physics.add.existing(platformZone, true);
        this.platforms.add(platformZone);
    }

    /**
     * Show level entry screen
     */
    showLevelEntry() {
        const { width, height } = this.cameras.main;

        this.physics.pause();

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        // Panel
        const panelWidth = 450;
        const panelHeight = 350;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A251A, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x228B22, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        // Forest decorations
        this.addForestDecoration(panel, panelX + 30, panelY + 30);
        this.addForestDecoration(panel, panelX + panelWidth - 30, panelY + 30);

        // Title
        const title = this.add.text(width / 2, panelY + 50, 'MYTHICAL FOREST', {
            fontSize: '36px',
            color: '#228B22',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Subtitle
        this.add.text(width / 2, panelY + 90, '"Where ancient trees guard cosmic secrets"', {
            fontSize: '16px',
            color: '#90EE90',
            fontStyle: 'italic'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(2, 0x228B22, 0.5);
        divider.lineBetween(panelX + 40, panelY + 120, panelX + panelWidth - 40, panelY + 120);
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        // Objective header
        this.add.text(width / 2, panelY + 145, 'OBJECTIVE', {
            fontSize: '14px',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Main objective
        this.add.text(width / 2, panelY + 175, 'Find the Forest Core', {
            fontSize: '20px',
            color: '#90EE90',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Secondary objectives
        const secondaryY = panelY + 220;
        this.add.text(panelX + 60, secondaryY, '[ ] Collect Star Fragments (0/5)', {
            fontSize: '16px',
            color: '#AAAAAA'
        }).setScrollFactor(0).setDepth(3002);

        this.add.text(panelX + 60, secondaryY + 30, '[ ] Defeat the Elder Treant', {
            fontSize: '16px',
            color: '#AAAAAA'
        }).setScrollFactor(0).setDepth(3002);

        // Enter button
        const enterBtn = this.add.text(width / 2, panelY + panelHeight - 50, '[ ENTER THE FOREST ]', {
            fontSize: '20px',
            color: '#228B22',
            backgroundColor: '#1A251A',
            padding: { x: 25, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });

        enterBtn.on('pointerover', () => enterBtn.setColor('#90EE90'));
        enterBtn.on('pointerout', () => enterBtn.setColor('#228B22'));
        enterBtn.on('pointerdown', () => {
            // Fade out and start level
            this.tweens.add({
                targets: [overlay, panel, title, enterBtn],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    panel.destroy();
                    this.physics.resume();
                    this.startLevel();
                }
            });
        });
    }

    /**
     * Add forest decoration to panel
     */
    addForestDecoration(graphics, x, y) {
        // Tree silhouette
        graphics.fillStyle(0x228B22, 0.5);
        graphics.fillTriangle(x, y + 20, x - 15, y, x + 15, y);
        graphics.fillTriangle(x, y + 10, x - 10, y - 5, x + 10, y - 5);
        graphics.fillStyle(0x8B4513, 0.5);
        graphics.fillRect(x - 3, y + 20, 6, 10);
    }

    /**
     * Start the actual level
     */
    startLevel() {
        console.log('[MythicalForestLevel] Starting level');
        this.createForestBackground();
        this.createLevelContent();
    }

    /**
     * Create mystical forest background
     */
    createForestBackground() {
        const { width, height } = this.cameras.main;

        // Dark forest gradient background
        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(-100);

        // Gradient from dark purple to dark green
        for (let y = 0; y < height; y++) {
            const ratio = y / height;
            const r = Math.floor(10 + ratio * 20);
            const g = Math.floor(20 + ratio * 40);
            const b = Math.floor(30 + ratio * 20);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
            bg.fillRect(0, y, width, 1);
        }

        // Add mystical mist/fog
        this.createMysticalMist();

        // Add floating particles
        this.createForestParticles();
    }

    /**
     * Create mystical mist effect
     */
    createMysticalMist() {
        const { width, height } = this.cameras.main;

        for (let i = 0; i < 5; i++) {
            const mist = this.add.graphics();
            mist.setScrollFactor(0.1 + i * 0.1);
            mist.setDepth(-50 + i);
            mist.fillStyle(0x228B22, 0.05);

            // Create organic mist shapes
            for (let j = 0; j < 3; j++) {
                const x = Math.random() * width;
                const y = height * 0.6 + Math.random() * height * 0.3;
                const radius = 100 + Math.random() * 150;
                mist.fillCircle(x, y, radius);
            }
        }
    }

    /**
     * Create floating forest particles
     */
    createForestParticles() {
        // Create floating motes of light
        for (let i = 0; i < 30; i++) {
            const mote = this.add.graphics();
            const x = Math.random() * this.levelWidth;
            const y = Math.random() * this.levelHeight * 0.8;

            // Random green/gold/purple colors
            const colors = [0x90EE90, 0xFFD700, 0x9370DB, 0x00FF7F];
            const color = colors[Math.floor(Math.random() * colors.length)];

            mote.fillStyle(color, 0.6);
            mote.fillCircle(0, 0, 2 + Math.random() * 3);
            mote.setPosition(x, y);
            mote.setDepth(50);

            // Gentle floating animation
            this.tweens.add({
                targets: mote,
                y: y - 20 - Math.random() * 30,
                alpha: { from: 0.6, to: 0.2 },
                duration: 3000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.magicMotes.push(mote);
        }
    }

    /**
     * Create level content - platforms, enemies, collectibles
     */
    createLevelContent() {
        // For now, create boss arena at the end
        this.createBossArena();
    }

    /**
     * Create the boss arena at the end of the level
     */
    createBossArena() {
        const arenaX = 4000;
        const arenaWidth = 800;
        const groundY = this.levelHeight - 100;

        // Arena floor
        const arena = this.add.graphics();
        arena.fillStyle(0x1A251A, 1);
        arena.fillRect(arenaX, groundY, arenaWidth, 100);

        // Mystical roots pattern
        arena.fillStyle(0x8B4513, 0.5);
        for (let i = 0; i < 20; i++) {
            const rootX = arenaX + Math.random() * arenaWidth;
            arena.fillRect(rootX, groundY - 5, 3, 15);
        }

        // Boss trigger zone
        const triggerZone = this.add.zone(arenaX + arenaWidth / 2, groundY - 50, 100, 100);
        this.physics.add.existing(triggerZone, true);

        // Trigger boss fight when player enters
        if (this.player) {
            this.physics.add.overlap(this.player, triggerZone, () => {
                if (!this.bossFightActive && !this.bossDefeated) {
                    triggerZone.destroy();
                    this.startBossFight();
                }
            });
        }
    }

    /**
     * Start the Elder Treant boss fight
     */
    startBossFight() {
        console.log('[MythicalForestLevel] Starting Elder Treant boss fight!');
        this.bossFightActive = true;

        // Dramatic pause
        this.physics.pause();

        // Flash warning
        this.cameras.main.flash(500, 34, 139, 34); // Forest green flash

        // Warning text
        const { width, height } = this.cameras.main;
        const warningText = this.add.text(width / 2, height / 2, '⚠ THE ANCIENT ONE AWAKENS ⚠', {
            fontSize: '32px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        // Screen shake
        this.cameras.main.shake(1500, 0.015);

        // Play boss intro sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // Fade out warning
        this.tweens.add({
            targets: warningText,
            alpha: 0,
            duration: 1500,
            onComplete: () => warningText.destroy()
        });

        // Darken the arena
        this.time.delayedCall(1000, () => {
            const darkness = this.add.graphics();
            darkness.fillStyle(0x000000, 0.3);
            darkness.fillRect(0, 0, width, height);
            darkness.setScrollFactor(0);
            darkness.setDepth(100);

            this.tweens.add({
                targets: darkness,
                alpha: 0,
                duration: 5000,
                onComplete: () => darkness.destroy()
            });
        });

        // Spawn boss after atmosphere builds
        this.time.delayedCall(1500, () => {
            this.spawnElderTreant();
            this.physics.resume();
        });
    }

    /**
     * Create the Elder Treant boss texture - translating the image to code
     *
     * The image shows:
     * - Angry tree face with menacing expression
     * - Glowing red eyes
     * - Purple and green glowing antlers/horns at top
     * - Orange/lava-like veins running through bark
     * - Sharp teeth in screaming mouth
     * - Dark green bark texture
     * - Purple foliage at base
     */
    createElderTreantTexture() {
        const textureKey = 'elderTreant';
        if (this.textures.exists(textureKey)) return textureKey;

        const graphics = this.make.graphics({ add: false });
        const size = 200; // Larger boss
        const centerX = size / 2;
        const centerY = size / 2;

        // === LAYER 1: OUTER GLOW (Menacing aura) ===
        graphics.fillStyle(0x228B22, 0.2); // Forest green glow
        graphics.fillCircle(centerX, centerY + 20, size / 2 + 10);

        // Purple mystical glow
        graphics.fillStyle(0x9370DB, 0.15);
        graphics.fillCircle(centerX, centerY - 20, size / 2);

        // === LAYER 2: MAIN TRUNK/BODY ===
        // Dark bark base color
        graphics.fillStyle(0x2D4A2D, 1); // Dark forest green

        // Main trunk shape - organic tree form
        graphics.beginPath();
        graphics.moveTo(centerX - 50, size - 20); // Bottom left
        graphics.lineTo(centerX - 60, centerY + 40); // Left side
        graphics.lineTo(centerX - 55, centerY); // Left shoulder
        graphics.lineTo(centerX - 40, centerY - 30); // Upper left
        graphics.lineTo(centerX - 20, centerY - 50); // Head left
        graphics.lineTo(centerX + 20, centerY - 50); // Head right
        graphics.lineTo(centerX + 40, centerY - 30); // Upper right
        graphics.lineTo(centerX + 55, centerY); // Right shoulder
        graphics.lineTo(centerX + 60, centerY + 40); // Right side
        graphics.lineTo(centerX + 50, size - 20); // Bottom right
        graphics.closePath();
        graphics.fillPath();

        // === LAYER 3: BARK TEXTURE ===
        // Vertical bark lines
        graphics.lineStyle(2, 0x1A301A, 0.8);
        for (let i = -40; i < 40; i += 8) {
            const startY = centerY - 45 + Math.abs(i) * 0.3;
            const endY = size - 25;
            const waveOffset = Math.sin(i * 0.1) * 3;
            graphics.lineBetween(
                centerX + i + waveOffset,
                startY,
                centerX + i + waveOffset * 0.5,
                endY
            );
        }

        // Horizontal bark cracks
        graphics.lineStyle(1, 0x1A301A, 0.6);
        for (let y = centerY - 30; y < size - 40; y += 15) {
            const leftX = centerX - 45 + (y - centerY) * 0.2;
            const rightX = centerX + 45 - (y - centerY) * 0.2;
            graphics.lineBetween(leftX, y, rightX, y + Math.random() * 5 - 2);
        }

        // === LAYER 4: ORANGE LAVA VEINS ===
        graphics.lineStyle(3, 0xFF4500, 0.9);

        // Main center vein
        graphics.beginPath();
        graphics.moveTo(centerX, size - 30);
        graphics.lineTo(centerX - 5, centerY + 50);
        graphics.lineTo(centerX + 3, centerY + 20);
        graphics.lineTo(centerX - 2, centerY - 10);
        graphics.lineTo(centerX, centerY - 35);
        graphics.stroke();

        // Left branching veins
        graphics.beginPath();
        graphics.moveTo(centerX - 5, centerY + 30);
        graphics.lineTo(centerX - 25, centerY + 10);
        graphics.lineTo(centerX - 45, centerY + 20);
        graphics.stroke();

        graphics.beginPath();
        graphics.moveTo(centerX - 2, centerY - 5);
        graphics.lineTo(centerX - 30, centerY - 25);
        graphics.stroke();

        // Right branching veins
        graphics.beginPath();
        graphics.moveTo(centerX + 3, centerY + 25);
        graphics.lineTo(centerX + 20, centerY + 5);
        graphics.lineTo(centerX + 40, centerY + 15);
        graphics.stroke();

        graphics.beginPath();
        graphics.moveTo(centerX + 1, centerY - 8);
        graphics.lineTo(centerX + 28, centerY - 20);
        graphics.stroke();

        // Glowing effect on veins
        graphics.lineStyle(6, 0xFF6600, 0.3);
        graphics.beginPath();
        graphics.moveTo(centerX, size - 30);
        graphics.lineTo(centerX, centerY - 35);
        graphics.stroke();

        // === LAYER 5: FACE - ANGRY EXPRESSION ===
        // Brow ridge / forehead wrinkles
        graphics.fillStyle(0x1A301A, 1);

        // Angry brow - left
        graphics.beginPath();
        graphics.moveTo(centerX - 35, centerY - 25);
        graphics.lineTo(centerX - 15, centerY - 35);
        graphics.lineTo(centerX - 10, centerY - 30);
        graphics.lineTo(centerX - 30, centerY - 20);
        graphics.closePath();
        graphics.fillPath();

        // Angry brow - right
        graphics.beginPath();
        graphics.moveTo(centerX + 35, centerY - 25);
        graphics.lineTo(centerX + 15, centerY - 35);
        graphics.lineTo(centerX + 10, centerY - 30);
        graphics.lineTo(centerX + 30, centerY - 20);
        graphics.closePath();
        graphics.fillPath();

        // === LAYER 6: GLOWING RED EYES ===
        // Eye glow (outer)
        graphics.fillStyle(0xFF0000, 0.4);
        graphics.fillCircle(centerX - 22, centerY - 15, 18);
        graphics.fillCircle(centerX + 22, centerY - 15, 18);

        // Eye sockets (dark)
        graphics.fillStyle(0x1A0000, 1);
        graphics.fillCircle(centerX - 22, centerY - 15, 12);
        graphics.fillCircle(centerX + 22, centerY - 15, 12);

        // Glowing red iris
        graphics.fillStyle(0xFF0000, 1);
        graphics.fillCircle(centerX - 22, centerY - 15, 8);
        graphics.fillCircle(centerX + 22, centerY - 15, 8);

        // Bright center
        graphics.fillStyle(0xFF6666, 1);
        graphics.fillCircle(centerX - 22, centerY - 15, 4);
        graphics.fillCircle(centerX + 22, centerY - 15, 4);

        // Hot white core
        graphics.fillStyle(0xFFAAAA, 1);
        graphics.fillCircle(centerX - 22, centerY - 15, 2);
        graphics.fillCircle(centerX + 22, centerY - 15, 2);

        // === LAYER 7: SCREAMING MOUTH WITH TEETH ===
        // Mouth cavity (dark)
        graphics.fillStyle(0x1A0000, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 30, centerY + 15);
        graphics.lineTo(centerX - 25, centerY + 45);
        graphics.lineTo(centerX + 25, centerY + 45);
        graphics.lineTo(centerX + 30, centerY + 15);
        graphics.closePath();
        graphics.fillPath();

        // Inner mouth (deep red)
        graphics.fillStyle(0x4A0000, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 25, centerY + 20);
        graphics.lineTo(centerX - 20, centerY + 40);
        graphics.lineTo(centerX + 20, centerY + 40);
        graphics.lineTo(centerX + 25, centerY + 20);
        graphics.closePath();
        graphics.fillPath();

        // Sharp teeth - top row
        graphics.fillStyle(0xFFFACD, 1);
        const teethTopY = centerY + 18;
        const teethWidth = 8;
        for (let i = 0; i < 5; i++) {
            const toothX = centerX - 20 + i * 10;
            graphics.fillTriangle(
                toothX - teethWidth/2, teethTopY,
                toothX + teethWidth/2, teethTopY,
                toothX, teethTopY + 12 + Math.random() * 5
            );
        }

        // Sharp teeth - bottom row
        const teethBottomY = centerY + 42;
        for (let i = 0; i < 4; i++) {
            const toothX = centerX - 15 + i * 10;
            graphics.fillTriangle(
                toothX - teethWidth/2, teethBottomY,
                toothX + teethWidth/2, teethBottomY,
                toothX, teethBottomY - 10 - Math.random() * 5
            );
        }

        // === LAYER 8: ANTLERS/HORNS ===
        // Purple glowing horn (left)
        graphics.fillStyle(0x9932CC, 1);
        this.drawAntler(graphics, centerX - 30, centerY - 55, -1, 0x9932CC);

        // Green glowing horn (right)
        graphics.fillStyle(0x32CD32, 1);
        this.drawAntler(graphics, centerX + 30, centerY - 55, 1, 0x32CD32);

        // Horn glow effects
        graphics.fillStyle(0xDA70D6, 0.4);
        graphics.fillCircle(centerX - 35, centerY - 75, 15);
        graphics.fillStyle(0x90EE90, 0.4);
        graphics.fillCircle(centerX + 35, centerY - 75, 15);

        // === LAYER 9: PURPLE FOLIAGE AT BASE ===
        graphics.fillStyle(0x8B008B, 0.7);
        for (let i = 0; i < 8; i++) {
            const leafX = centerX - 40 + i * 12 + Math.random() * 5;
            const leafY = size - 15;
            this.drawLeaf(graphics, leafX, leafY, 0x8B008B);
        }

        // Some green leaves mixed in
        graphics.fillStyle(0x228B22, 0.6);
        for (let i = 0; i < 4; i++) {
            const leafX = centerX - 30 + i * 18 + Math.random() * 8;
            const leafY = size - 18;
            this.drawLeaf(graphics, leafX, leafY, 0x228B22);
        }

        // Generate texture
        graphics.generateTexture(textureKey, size, size);
        graphics.destroy();

        return textureKey;
    }

    /**
     * Draw an antler/horn shape
     */
    drawAntler(graphics, x, y, direction, color) {
        graphics.fillStyle(color, 1);

        // Main horn trunk
        graphics.beginPath();
        graphics.moveTo(x, y);
        graphics.lineTo(x + direction * 5, y - 25);
        graphics.lineTo(x + direction * 15, y - 50);
        graphics.lineTo(x + direction * 10, y - 52);
        graphics.lineTo(x + direction * 2, y - 28);
        graphics.lineTo(x - direction * 3, y);
        graphics.closePath();
        graphics.fillPath();

        // Branch 1
        graphics.beginPath();
        graphics.moveTo(x + direction * 8, y - 30);
        graphics.lineTo(x + direction * 25, y - 40);
        graphics.lineTo(x + direction * 22, y - 45);
        graphics.lineTo(x + direction * 6, y - 35);
        graphics.closePath();
        graphics.fillPath();

        // Branch 2
        graphics.beginPath();
        graphics.moveTo(x + direction * 12, y - 45);
        graphics.lineTo(x + direction * 5, y - 65);
        graphics.lineTo(x + direction * 10, y - 65);
        graphics.lineTo(x + direction * 15, y - 47);
        graphics.closePath();
        graphics.fillPath();

        // Glow segments (lighter color)
        const glowColor = color === 0x9932CC ? 0xDA70D6 : 0x90EE90;
        graphics.fillStyle(glowColor, 0.6);

        // Glow on tips
        graphics.fillCircle(x + direction * 15, y - 50, 4);
        graphics.fillCircle(x + direction * 25, y - 42, 3);
        graphics.fillCircle(x + direction * 7, y - 65, 3);
    }

    /**
     * Draw a leaf shape
     */
    drawLeaf(graphics, x, y, color) {
        graphics.fillStyle(color, 0.8);
        graphics.beginPath();
        graphics.moveTo(x, y);
        graphics.lineTo(x - 5, y - 8);
        graphics.lineTo(x, y - 15);
        graphics.lineTo(x + 5, y - 8);
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Spawn the Elder Treant boss
     */
    spawnElderTreant() {
        console.log('[MythicalForestLevel] Spawning Elder Treant!');

        // Create boss texture
        const textureKey = this.createElderTreantTexture();

        // Spawn position - center of screen for test mode, or boss arena
        const { width, height } = this.cameras.main;
        const spawnX = this.testMode ? width / 2 + 200 : 4400;
        const spawnY = this.levelHeight - 220;

        // Create boss sprite
        this.boss = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0);
        this.boss.setDepth(880);
        this.boss.body.setSize(120, 160);
        this.boss.body.setOffset(40, 30);
        this.boss.setScale(1.5); // Make it imposing

        // Initialize boss state
        this.bossHealth = this.bossMaxHealth;
        this.bossPhase = 1;
        this.boss.isAttacking = false;
        this.boss.facingRight = false;

        // Boss collision with platforms
        if (this.platforms) {
            this.physics.add.collider(this.boss, this.platforms);
        }

        // Boss collision with player
        if (this.player) {
            this.physics.add.overlap(this.player, this.boss, this.handleBossCollision, null, this);
        }

        // Create boss health bar
        this.createBossHealthBar();

        // Add entrance animation
        this.boss.setAlpha(0);
        this.boss.setScale(0.5);

        this.tweens.add({
            targets: this.boss,
            alpha: 1,
            scale: 1.5,
            duration: 1000,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Start boss AI
                this.startBossAI();

                // Camera shake for dramatic effect
                this.cameras.main.shake(300, 0.01);

                if (window.AudioManager) {
                    window.AudioManager.playError();
                }
            }
        });

        // Add ambient glow effect
        this.createBossAmbientEffects();
    }

    /**
     * Create ambient visual effects around the boss
     */
    createBossAmbientEffects() {
        if (!this.boss) return;

        // Pulsing glow
        const glow = this.add.graphics();
        glow.setDepth(this.boss.depth - 1);

        const updateGlow = () => {
            if (!this.boss || !glow.active) return;

            glow.clear();
            glow.setPosition(this.boss.x, this.boss.y);

            // Orange vein glow
            glow.fillStyle(0xFF4500, 0.2 + Math.sin(this.time.now * 0.003) * 0.1);
            glow.fillCircle(0, 0, 120);

            // Purple mystical aura
            glow.fillStyle(0x9932CC, 0.1);
            glow.fillCircle(-40, -80, 40);

            // Green aura
            glow.fillStyle(0x32CD32, 0.1);
            glow.fillCircle(40, -80, 40);
        };

        this.time.addEvent({
            delay: 50,
            callback: updateGlow,
            loop: true
        });

        this.bossGlow = glow;
    }

    /**
     * Create boss health bar UI
     */
    createBossHealthBar() {
        const screenWidth = this.cameras.main.width;
        const barWidth = Math.min(350, screenWidth - 60);
        const barHeight = 28;
        const barX = (screenWidth - barWidth) / 2;
        const barY = 55;

        // UI container
        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500);

        // Boss name
        this.bossNameText = this.add.text(screenWidth / 2, barY - 28, '🌳 ELDER TREANT 🌳', {
            fontSize: '22px',
            color: '#90EE90',
            fontStyle: 'bold',
            stroke: '#1A251A',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.bossUI.add(this.bossNameText);

        // Subtitle
        const subtitle = this.add.text(screenWidth / 2, barY - 8, 'Guardian of the Mythical Forest', {
            fontSize: '11px',
            color: '#228B22'
        }).setOrigin(0.5);
        this.bossUI.add(subtitle);

        // Health bar background
        const bgBar = this.add.graphics();
        bgBar.fillStyle(0x1A251A, 0.9);
        bgBar.fillRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
        bgBar.lineStyle(2, 0x228B22, 1);
        bgBar.strokeRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
        this.bossUI.add(bgBar);

        // Health bar
        this.bossHealthBar = this.add.graphics();
        this.bossUI.add(this.bossHealthBar);

        // Initial draw
        this.updateBossHealthBar(barX, barY, barWidth, barHeight);
    }

    /**
     * Update boss health bar
     */
    updateBossHealthBar(barX, barY, barWidth, barHeight) {
        if (!this.bossHealthBar) return;

        barX = barX || (this.cameras.main.width - 350) / 2;
        barY = barY || 55;
        barWidth = barWidth || 350;
        barHeight = barHeight || 28;

        this.bossHealthBar.clear();

        const healthPercent = this.bossHealth / this.bossMaxHealth;
        const currentWidth = barWidth * healthPercent;

        // Health gradient (green to red based on health)
        const r = Math.floor(255 * (1 - healthPercent));
        const g = Math.floor(255 * healthPercent);
        const healthColor = Phaser.Display.Color.GetColor(r, g, 0);

        this.bossHealthBar.fillStyle(healthColor, 1);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight, 6);

        // Shiny overlay
        this.bossHealthBar.fillStyle(0xFFFFFF, 0.2);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight / 2, { tl: 6, tr: 6, bl: 0, br: 0 });
    }

    /**
     * Start boss AI behavior
     */
    startBossAI() {
        console.log('[MythicalForestLevel] Starting Elder Treant AI');

        // Boss AI timer
        this.bossAITimer = this.time.addEvent({
            delay: 2000,
            callback: () => this.bossAITick(),
            loop: true
        });
    }

    /**
     * Boss AI tick - choose and execute attacks
     */
    bossAITick() {
        if (!this.boss || this.bossDefeated || !this.bossFightActive) return;

        // Face the player
        if (this.player && this.boss) {
            this.boss.facingRight = this.player.x > this.boss.x;
            this.boss.setFlipX(!this.boss.facingRight);
        }

        // Choose attack based on phase
        const attacks = ['root_slam', 'vine_whip', 'spore_cloud'];
        if (this.bossPhase >= 2) {
            attacks.push('nature_fury');
        }

        const attack = attacks[Math.floor(Math.random() * attacks.length)];
        this.executeBossAttack(attack);
    }

    /**
     * Execute a boss attack
     */
    executeBossAttack(attackType) {
        if (!this.boss || this.boss.isAttacking) return;

        this.boss.isAttacking = true;

        switch (attackType) {
            case 'root_slam':
                this.bossRootSlam();
                break;
            case 'vine_whip':
                this.bossVineWhip();
                break;
            case 'spore_cloud':
                this.bossSporeCloud();
                break;
            case 'nature_fury':
                this.bossNatureFury();
                break;
        }

        // Reset attack state after cooldown
        this.time.delayedCall(1500, () => {
            if (this.boss) {
                this.boss.isAttacking = false;
            }
        });
    }

    /**
     * Root Slam attack - ground shockwave
     */
    bossRootSlam() {
        if (!this.boss) return;

        // Telegraph
        const telegraph = this.add.graphics();
        telegraph.fillStyle(0xFF4500, 0.3);
        telegraph.fillRect(this.boss.x - 150, this.levelHeight - 120, 300, 30);
        telegraph.setDepth(100);

        // Screen shake
        this.cameras.main.shake(200, 0.01);

        this.time.delayedCall(400, () => {
            telegraph.destroy();

            // Create root spikes
            for (let i = -3; i <= 3; i++) {
                const rootX = this.boss.x + i * 50;
                const rootY = this.levelHeight - 120;

                const root = this.add.graphics();
                root.fillStyle(0x8B4513, 1);
                root.fillTriangle(rootX - 10, rootY, rootX + 10, rootY, rootX, rootY - 40);
                root.setDepth(850);

                // Damage check
                if (this.player &&
                    Math.abs(this.player.x - rootX) < 30 &&
                    this.player.y > rootY - 60) {
                    this.handlePlayerDamage(1);
                }

                // Remove root after delay
                this.time.delayedCall(1000, () => root.destroy());
            }
        });
    }

    /**
     * Vine Whip attack
     */
    bossVineWhip() {
        if (!this.boss || !this.player) return;

        const direction = this.boss.facingRight ? 1 : -1;

        // Create vine projectile
        const vine = this.add.graphics();
        vine.fillStyle(0x228B22, 1);
        vine.fillRect(0, -5, 80, 10);
        vine.setPosition(this.boss.x + direction * 50, this.boss.y);
        vine.setDepth(850);

        // Animate vine extending
        this.tweens.add({
            targets: vine,
            x: vine.x + direction * 300,
            duration: 300,
            onComplete: () => {
                // Check collision
                if (this.player &&
                    Math.abs(this.player.x - vine.x) < 100 &&
                    Math.abs(this.player.y - vine.y) < 30) {
                    this.handlePlayerDamage(1);
                }

                // Retract
                this.tweens.add({
                    targets: vine,
                    x: this.boss.x + direction * 50,
                    duration: 200,
                    onComplete: () => vine.destroy()
                });
            }
        });
    }

    /**
     * Spore Cloud attack - area denial
     */
    bossSporeCloud() {
        if (!this.boss || !this.player) return;

        // Target player position
        const targetX = this.player.x;
        const targetY = this.player.y;

        // Create spore cloud
        const cloud = this.add.graphics();
        cloud.fillStyle(0x9932CC, 0.5);
        cloud.fillCircle(0, 0, 60);
        cloud.setPosition(targetX, targetY);
        cloud.setDepth(100);
        cloud.setAlpha(0);

        // Fade in
        this.tweens.add({
            targets: cloud,
            alpha: 1,
            duration: 500
        });

        // Damage over time zone
        let ticks = 0;
        const damageInterval = this.time.addEvent({
            delay: 500,
            callback: () => {
                if (this.player &&
                    Math.abs(this.player.x - cloud.x) < 60 &&
                    Math.abs(this.player.y - cloud.y) < 60) {
                    this.handlePlayerDamage(1);
                }
                ticks++;
                if (ticks >= 4) {
                    damageInterval.remove();
                    this.tweens.add({
                        targets: cloud,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => cloud.destroy()
                    });
                }
            },
            loop: true
        });
    }

    /**
     * Nature Fury attack - Phase 2 ultimate
     */
    bossNatureFury() {
        if (!this.boss) return;

        // Screen flash
        this.cameras.main.flash(500, 34, 139, 34);

        // Warning text
        const { width, height } = this.cameras.main;
        const warning = this.add.text(width / 2, height / 3, '🌿 NATURE\'S FURY! 🌿', {
            fontSize: '28px',
            color: '#90EE90',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: warning,
            alpha: 0,
            duration: 1500,
            onComplete: () => warning.destroy()
        });

        // Rain of leaves/projectiles
        for (let i = 0; i < 10; i++) {
            this.time.delayedCall(i * 200, () => {
                const leafX = Math.random() * width;

                const leaf = this.add.graphics();
                leaf.fillStyle(Math.random() > 0.5 ? 0x228B22 : 0x8B008B, 1);
                leaf.fillTriangle(-10, 0, 10, 0, 0, 20);
                leaf.setPosition(leafX, -20);
                leaf.setDepth(850);

                this.tweens.add({
                    targets: leaf,
                    y: this.levelHeight,
                    x: leafX + (Math.random() - 0.5) * 100,
                    rotation: Math.PI * 2,
                    duration: 1500,
                    onComplete: () => {
                        // Damage check at landing
                        if (this.player && Math.abs(this.player.x - leaf.x) < 30) {
                            this.handlePlayerDamage(1);
                        }
                        leaf.destroy();
                    }
                });
            });
        }
    }

    /**
     * Handle collision between player and boss
     */
    handleBossCollision(player, boss) {
        if (this.isInvincible || this.isPlayerDead) return;
        this.handlePlayerDamage(1);
    }

    /**
     * Handle player taking damage
     */
    handlePlayerDamage(damage) {
        if (this.isInvincible || this.isPlayerDead) return;

        this.health -= damage;
        this.isInvincible = true;

        // Flash player
        this.tweens.add({
            targets: this.player,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 5,
            onComplete: () => {
                if (this.player) this.player.setAlpha(1);
                this.isInvincible = false;
            }
        });

        // Update HUD
        if (this.hud) {
            this.hud.updateHealth(this.health, this.maxHealth);
        }

        // Check death
        if (this.health <= 0) {
            this.handlePlayerDeath();
        }

        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }
    }

    /**
     * Handle player death
     */
    handlePlayerDeath() {
        this.isPlayerDead = true;
        // TODO: Implement death screen
        console.log('[MythicalForestLevel] Player died!');
    }

    /**
     * Handle boss taking damage
     */
    damageBoss(amount = 1) {
        if (!this.boss || this.bossDefeated) return;

        this.bossHealth -= amount;
        this.updateBossHealthBar();

        // Flash boss
        this.boss.setTint(0xFF0000);
        this.time.delayedCall(100, () => {
            if (this.boss) this.boss.clearTint();
        });

        // Phase transition at 50% health
        if (this.bossHealth <= this.bossMaxHealth * 0.5 && this.bossPhase === 1) {
            this.triggerPhase2();
        }

        // Boss defeated
        if (this.bossHealth <= 0) {
            this.onBossDefeated();
        }

        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Trigger phase 2
     */
    triggerPhase2() {
        this.bossPhase = 2;

        // Screen effects
        this.cameras.main.shake(500, 0.02);
        this.boss.setTint(0xFF6B6B);

        const { width, height } = this.cameras.main;
        const phaseText = this.add.text(width / 2, height / 2, '🌿 TREANT ENRAGED! 🌿', {
            fontSize: '28px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: phaseText,
            alpha: 0,
            y: height / 2 - 50,
            duration: 1500,
            onComplete: () => phaseText.destroy()
        });

        // Speed up AI
        if (this.bossAITimer) {
            this.bossAITimer.delay = 1500;
        }
    }

    /**
     * Handle boss defeat
     */
    onBossDefeated() {
        console.log('[MythicalForestLevel] Elder Treant defeated!');
        this.bossDefeated = true;
        this.bossFightActive = false;

        // Stop AI
        if (this.bossAITimer) {
            this.bossAITimer.remove();
        }

        // Boss death animation
        this.boss.setVelocity(0, 0);
        this.boss.body.setAllowGravity(false);

        this.cameras.main.shake(800, 0.03);

        // Dramatic death sequence
        this.tweens.add({
            targets: this.boss,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 1.5,
            y: this.boss.y - 50,
            duration: 2000,
            onComplete: () => {
                this.boss.destroy();
                this.boss = null;

                if (this.bossGlow) {
                    this.bossGlow.destroy();
                }

                this.showBossVictory();
            }
        });

        // Hide health bar
        if (this.bossUI) {
            this.tweens.add({
                targets: this.bossUI,
                alpha: 0,
                duration: 500
            });
        }
    }

    /**
     * Show boss victory screen
     */
    showBossVictory() {
        const { width, height } = this.cameras.main;

        const victoryText = this.add.text(width / 2, height / 2, '🌳 ELDER TREANT DEFEATED 🌳', {
            fontSize: '32px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        this.tweens.add({
            targets: victoryText,
            alpha: 1,
            scaleX: { from: 0.5, to: 1 },
            scaleY: { from: 0.5, to: 1 },
            duration: 500,
            yoyo: true,
            hold: 2000,
            onComplete: () => {
                victoryText.destroy();
                // TODO: Show level complete screen
            }
        });

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }
    }

    /**
     * Override shutdown for cleanup
     */
    shutdown() {
        console.log('[MythicalForestLevel] Shutting down');

        // Clean up boss
        if (this.boss) {
            this.boss.destroy();
            this.boss = null;
        }

        if (this.bossUI) {
            this.bossUI.destroy();
            this.bossUI = null;
        }

        if (this.bossGlow) {
            this.bossGlow.destroy();
            this.bossGlow = null;
        }

        if (this.bossAITimer) {
            this.bossAITimer.remove();
        }

        // Clean up particles
        this.magicMotes.forEach(mote => mote.destroy());
        this.magicMotes = [];

        super.shutdown();
    }
}

// Export for module system
export default MythicalForestLevel;

// Also export to window for global access
if (typeof window !== 'undefined') {
    window.MythicalForestLevel = MythicalForestLevel;
}
