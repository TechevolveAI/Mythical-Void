/**
 * HatchingScene - The first scene where the player clicks an egg to hatch their mythical creature
 * Features: floating egg animation, progressive hatching with color changes, sparkle effects
 */

import Phaser from 'phaser';
import hatchCinematicsConfig from '../config/hatch-cinematics.json';
import evolutionConfig from '../config/evolution.json';
import rarityConfig from '../config/rarity-config.json';
import legalConfig from '../config/legal.json';
import projectBeacon from '../config/project-beacon.json';
import { CINEMATIC_MEDIA, shouldPlayCinematicMedia } from '../config/cinematic-media.js';
import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';
import MobileHelpers from '../utils/mobile-helpers.js';
const firstSessionFraming = projectBeacon.firstSessionFraming;

// Make evolution config available globally for GraphicsEngine and other systems
if (typeof window !== 'undefined') {
    window.evolutionConfig = evolutionConfig;
    console.log('[HatchingScene] Evolution config loaded globally:', {
        visionEnabled: evolutionConfig?.hatching?.visionReveal?.enabled,
        visionDuration: evolutionConfig?.hatching?.visionReveal?.visionDuration,
        babyScale: evolutionConfig?.stages?.baby?.visual?.scale,
        babySaturation: evolutionConfig?.stages?.baby?.visual?.colorSaturation
    });
}

const cloneConfig = (config) => {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(config);
        }
    } catch (err) {
        // Ignore and fall back to JSON cloning
    }
    return JSON.parse(JSON.stringify(config));
};

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

class HatchingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HatchingScene' });
        this.hatchingProgress = 0;
        this.isHatching = false;
        this.hatchingStarted = false;
        this.creatureAppeared = false;
        this.creatureGenetics = null; // Store the generated genetics
        this.creatureDisplayAttempt = null;

        // Egg hatching mode properties
        this.isEggHatch = false;
        this.eggType = null; // 'cosmic' or 'stellar'
        this.spawnPosition = null; // Where to spawn new creature
    }

    /**
     * Initialize scene with data (used for egg hatching)
     */
    init(data) {
        this.finishCreatureDisplayLoading();
        // Reset all scene state properties (important for scene restarts)
        this.hatchingProgress = 0;
        this.isHatching = false;
        this.hatchingStarted = false;
        this.creatureAppeared = false;
        this.creatureGenetics = null;
        this.creatureDNA = null;
        this.generatedHatchDNA = undefined;
        this.creaturePersonalityState = undefined;
        this.hatchPityData = null;
        this.hatchRerollData = null;
        this.hatchCommitAttempt = null;
        this.hatchSceneRetired = false;
        this.clearHatchSaveRecovery();
        this.rarityInfo = null;
        this.eggTextureName = null;
        this.isStartingGame = false; // Reset START button state
        this.themeMusicLoadRequested = false;
        this.themeMusicWanted = false;
        this.startButtonPressed = false;
        this.startFlowQueued = false;
        this.openingStartAttempt = null;
        this.homeContentReady = false;
        this.homeStartRecoveryTimer = null;
        this.nextHomeStartHealthCheck = 0;
        this.homeStartFallback = null;
        this.homeStartFallbackCleanup = null;
        this.eggHatchFallback = null;
        this.eggHatchFallbackCleanup = null;
        this.eggHatchReadyAt = 0;
        this.eggHatchReadyTimer = null;
        this.portraitPromise = null;
        this.portraitError = null;
        this.firstContactGuidance = null;
        this.firstContactPlatformShift = 0;

        // Set egg hatching properties from passed data
        const pendingHatch = window.GameState?.get?.('creature.hatchTransaction');
        const resumableHatch = pendingHatch?.status === 'reserved'
            ? pendingHatch
            : null;
        this.isEggHatch = data?.isEggHatch === true || Boolean(resumableHatch);
        this.eggType = data?.eggType || resumableHatch?.eggType || null;
        this.spawnPosition = data?.spawnPosition || resumableHatch?.spawnPosition || null;
        this.captureHatchSaveOwner();
    }

    preload() {
        this.load.image(
            'projectBeaconCrashSite',
            '/game/project-beacon-crash-site.webp'
        );
    }

    create() {
        // Boss/ending preview routes start their requested scene after boot.
        const previewParams = new URLSearchParams(window.location.search);
        const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        if (
            isLocalPreview &&
            (
                    previewParams.has('testBoss') ||
                    previewParams.has('testGuardianResult') ||
                    previewParams.has('testDebrief') ||
                    previewParams.has('testLevelEntry') ||
                    previewParams.has('testExpeditionDrill') ||
                    previewParams.has('testHub') ||
                    previewParams.has('testFieldKit') ||
                    previewParams.has('testWaypoint') ||
                    previewParams.has('testGarden') ||
                    previewParams.has('testCommunity') ||
                    previewParams.has('testCommunityMoment') ||
                    previewParams.has('testResidents') ||
                    previewParams.has('testGuardians') ||
                    previewParams.has('testGuardianExchange') ||
                    previewParams.has('testGuardianRecognition') ||
                    previewParams.has('testResidentExchange') ||
                    previewParams.has('testFendCulture') ||
                    previewParams.has('testConsent') ||
                    previewParams.has('testEarthMemory') ||
                    previewParams.has('testSenseiMemory') ||
                    previewParams.has('testShipBoard') ||
                    previewParams.has('testCurrentVeil') ||
                    previewParams.has('testIdentityArchive') ||
                    previewParams.has('testProfilePortrait') ||
                    previewParams.has('testWelcomeBackPortrait') ||
                    previewParams.has('testCurrentEcho') ||
                    previewParams.has('testLivingSignal') ||
                    previewParams.has('testMissionBriefing') ||
                    previewParams.has('testCheckIn') ||
                    previewParams.has('testControls') ||
                    previewParams.has('testStory') ||
                    previewParams.has('testSoulReveal') ||
                    previewParams.has('testBeaconLog') ||
                    previewParams.has('testSettings') ||
                    previewParams.has('testRecovery') ||
                    previewParams.has('testGuardianAlly') ||
                    previewParams.has('testStance') ||
                    previewParams.has('testFusion') ||
                    previewParams.has('testAchievements') ||
                    previewParams.has('testCloudSave') ||
                    previewParams.has('testEnding') ||
                    previewParams.has('testHighPower')
            )
        ) {
            return;
        }

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        this.events.on(Phaser.Scenes.Events.RESUME, this.startThemeMusic, this);
        this.scale.on('resize', this.resizeHatchingLayout, this);

        // Stop all other scenes to ensure clean display
        const scenesToStop = ['GameScene', 'InventoryScene', 'ShopScene'];
        SceneTransitionHelper.stopScenes(this, scenesToStop);
        SceneTransitionHelper.bringToTop(this);

        this.continueHatchEntry();
    }

    continueHatchEntry() {
        const GameState = getGameState();
        const owner = this.hatchSaveOwner;
        const ownsEntry = () => owner === this.hatchSaveOwner && owner?.state === GameState && owner.isCurrent();
        if (!ownsEntry()) return;
        if (!this.canCommitHatch()) {
            if (ownsEntry()) this.showHatchSaveRecovery(() => this.continueHatchEntry());
            return;
        }
        if (!ownsEntry()) return;
        let reader;
        try {
            const initial = JSON.stringify(GameState.state);
            const raw = localStorage.getItem(GameState.saveKey);
            if (!ownsEntry() || JSON.stringify(GameState.state) !== initial) return;
            const lease = GameState.cloudWriteLease;
            const notifications = [];
            const draft = { state: cloneConfig(GameState.state),
                emit: (event, data) => notifications.push({ event, data }),
                reportStateMutationError: error => { throw error; } };
            GameState.set.call(draft, 'session.currentScene', 'HatchingScene');
            if (!ownsEntry() || GameState.cloudWriteLease !== lease ||
                JSON.stringify(GameState.state) !== initial) return;
            if (!GameState.state.session || typeof GameState.state.session !== 'object') GameState.state.session = {};
            GameState.state.session.currentScene = draft.state.session.currentScene;
            reader = GameState.captureSaveAdmissionOwner({ raw });
            const canContinue = () => {
                if (!ownsEntry() || GameState.cloudWriteLease !== lease) return false;
                reader.assertCurrent();
                if (!this.canCommitHatch() || !ownsEntry()) return false;
                reader.assertCurrent();
                return true;
            };
            // Preserve the original setter's notification order without letting
            // its first callback deliver the remaining event to a successor.
            for (const notification of notifications) {
                if (!canContinue()) return;
                GameState.emit(notification.event, notification.data);
            }
            if (!canContinue()) return;

            const gameStarted = GameState.get('session.gameStarted') || false;
            const creatureHatched = GameState.get('creature.hatched') || false;
            const creatureName = GameState.get('creature.name');
            const creatureNamed = GameState.get('creature.named') === true || (
                creatureName && creatureName !== 'Your Creature'
            );
            const livingFormPending = GameState.get('tutorial.livingFormPending') === true;
            if (!canContinue()) return;

            // Keep the established Home -> Hatch -> Reveal -> Sanctuary order.
            if (this.isEggHatch) {
                this.showHatchingScreen();
                return;
            }
            if (!gameStarted) {
                this.showHomeScreen();
                return;
            } else if (gameStarted && !creatureHatched) {
                this.showHatchingScreen();
            } else if (gameStarted && creatureHatched && !creatureNamed) {
                this.scene.start('SoulRevealScene');
                return;
            } else if (gameStarted && creatureHatched && creatureNamed && livingFormPending) {
                this.scene.start('SoulRevealScene', { resumeLivingForm: true });
                return;
            } else if (gameStarted && creatureHatched && creatureNamed) {
                this.scene.start('GameScene');
                return;
            } else {
                this.showHomeScreen();
                return;
            }
        } catch (error) {
            // No draft/reset was published here. A route failure can retry only
            // while its unchanged reader and original scene still own entry.
            if (ownsEntry() && reader?.isCurrent()) {
                try { this.showHatchSaveRecovery(() => this.continueHatchEntry()); }
                catch (recoveryError) { console.warn('[HatchingScene] Entry remains paused.'); }
            }
        }
    }

    showHomeScreen() {
        // Initialize graphics engine for development mode
        const GraphicsEngine = getGraphicsEngine();
        this.graphicsEngine = new GraphicsEngine(this);

        // Enable Space-Mythic theme
        if (window.UITheme) {
            window.UITheme.applySpaceMythicTheme();
        }
        if (window.KidMode) {
            window.KidMode.enableKidMode();
        }

        // Create enhanced starfield background
        this.createEnhancedBackground();

        // Create animated stardust particles
        this.createStardustParticles();

        // Check age gate on first launch
        this.checkAgeGate(() => {
            // After age gate completed (or already confirmed), show home content
            this.showHomeContent();
        });
    }

    /**
     * Show home screen content after age gate check
     */
    showHomeContent() {
        // The age-gate completion callback must never create overlapping home
        // controls. Duplicate interactive containers make touch targeting
        // unpredictable and can leave only the faded copy visible.
        if (this.homeContentReady) return;
        this.homeContentReady = true;

        // Establish a browser-native route into the game before drawing the
        // canvas presentation. It remains usable even if a later render fails.
        this.createHomeStartFallback();

        // Main title with glow effect
        this.createEnhancedTitle();

        // Create enhanced START button with glassmorphism
        this.createEnhancedStartButton();

        // Game features preview cards
        this.createFeatureCards();

        // Bottom hint text
        this.createBottomHints();

        // Check for storage issues (incognito mode, etc.)
        this.checkStorageAndWarn();

        // Render first, then fetch the long soundtrack without blocking input.
        this.loadThemeMusicInBackground();

        // Recover from a partially initialized or externally interrupted home
        // render while the player is still waiting to begin.
        this.homeStartRecoveryTimer = this.time.delayedCall(900, () => {
            this.ensureHomeStartReady();
        });
    }

    ensureHomeStartReady() {
        if (!this.sys?.isActive() || getGameState().get('session.gameStarted')) {
            this.removeHomeStartFallback();
            return;
        }

        if (!this.homeStartFallback?.isConnected) {
            this.createHomeStartFallback();
        }

        const button = this.startButton;
        const bounds = button?.getBounds?.();
        const expectedX = this.scale.width / 2;
        const expectedY = this.scale.height * 0.5;
        const ready = Boolean(
            button?.active &&
            button.visible &&
            button.alpha >= 0.8 &&
            button.input?.enabled &&
            bounds &&
            bounds.left >= 0 &&
            bounds.top >= 0 &&
            bounds.right <= this.scale.width &&
            bounds.bottom <= this.scale.height &&
            Math.abs(button.x - expectedX) <= 2 &&
            Math.abs(button.y - expectedY) <= 2
        );
        if (ready) return;

        this.startButtonPressed = false;
        this.startButtonPressedAt = null;
        this.startFlowQueued = false;
        this.isStartingGame = false;
        if (button?.active) {
            const buttonWidth = Math.min(this.scale.width * 0.85, 340);
            const buttonHeight = Math.min(this.scale.height * 0.08, 95);
            button
                .setPosition(expectedX, expectedY)
                .setVisible(true)
                .setAlpha(1)
                .setScale(1)
                .setDepth(10000);
            MobileHelpers.setTouchHitArea(button, buttonWidth, buttonHeight, 30);
            return;
        }
        this.createEnhancedStartButton();
    }

    createHomeStartFallback() {
        if (typeof document === 'undefined' || this.homeStartFallback?.isConnected) {
            return;
        }

        const gameRoot = document.getElementById('game');
        if (!gameRoot) return;

        // A stopped or restarted scene can lose its element reference before a
        // delayed recovery callback runs. Never let that stale control survive
        // into gameplay or become a second, inert start button.
        gameRoot.querySelectorAll('[data-mythical-home-start]').forEach(element => {
            element.remove();
        });

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'home-start-fallback';
        button.dataset.mythicalHomeStart = 'true';
        button.setAttribute('aria-label', firstSessionFraming.homeCta);
        button.innerHTML = `<span aria-hidden="true">&#10022;</span><strong>${firstSessionFraming.homeCta}</strong>`;

        const activate = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!this.sys?.isActive() || this.isStartingGame || this.startFlowQueued) return;

            this.startButtonPressedAt = Date.now();
            this.onStartRelease(
                this.startButton,
                this.scale.width / 2,
                this.scale.height * 0.5
            );
        };
        button.addEventListener('click', activate);
        button.addEventListener('pointerdown', () => MobileHelpers.vibrate(35), { passive: true });
        gameRoot.appendChild(button);

        this.homeStartFallback = button;
        const cleanup = () => {
            this.events?.off?.(Phaser.Scenes.Events.SHUTDOWN, cleanup);
            button.removeEventListener('click', activate);
            button.remove();
            if (this.homeStartFallback === button) {
                this.homeStartFallback = null;
            }
            if (this.homeStartFallbackCleanup === cleanup) {
                this.homeStartFallbackCleanup = null;
            }
        };
        this.homeStartFallbackCleanup = cleanup;
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    }

    removeHomeStartFallback() {
        if (this.homeStartFallbackCleanup) {
            this.homeStartFallbackCleanup();
            this.homeStartFallbackCleanup = null;
        } else {
            this.homeStartFallback?.remove();
            this.homeStartFallback = null;
        }
        if (typeof document !== 'undefined') {
            document.querySelectorAll('[data-mythical-home-start]').forEach(element => {
                element.remove();
            });
        }
    }

    loadThemeMusicInBackground() {
        this.themeMusicWanted = true;
        this.themeMusicSettingsCleanup ??= window.AudioManager?.onPreferencesChange?.(
            () => this.syncThemeMusicPreferences()
        );
        if (this.cache.audio.exists('themeMusic')) {
            this.startThemeMusic();
            return;
        }
        if (this.themeMusicLoadRequested) return;

        this.themeMusicLoadRequested = true;
        this.load.once('filecomplete-audio-themeMusic', () => {
            this.themeMusicLoadRequested = false;
            if (!this.sys.isActive() || !this.themeMusicWanted) return;
            this.startThemeMusic();
        });
        this.load.once('loaderror', file => {
            if (file?.key !== 'themeMusic') return;
            this.themeMusicLoadRequested = false;
            console.warn('[HatchingScene] Theme music could not be loaded');
        });
        this.load.audio('themeMusic', [
            '/audio/theme-music.ogg',
            '/audio/theme-music.mp3'
        ]);
        this.load.start();
    }

    /**
     * Start playing the home screen theme music
     * Respects AudioManager mute settings
     */
    startThemeMusic() {
        if (!this.themeMusicWanted || !this.sys.isActive()) return;
        if (this.themeMusic?.isPlaying) return;

        // Check if audio is loaded
        if (!this.cache.audio.exists('themeMusic')) {
            console.log('[HatchingScene] Theme music not loaded yet');
            return;
        }

        // Check if AudioManager exists and is muted
        if (window.AudioManager && window.AudioManager.isMuted && window.AudioManager.isMuted()) {
            console.log('[HatchingScene] Audio is muted, skipping theme music');
            return;
        }

        // Create and play the theme music
        this.themeMusic ??= this.sound.add('themeMusic', {
            loop: true,
            volume: 0
        });

        // Fade in the music for a smooth start
        this.themeMusic.play();
        this.tweens.add({
            targets: this.themeMusic,
            volume: this.getThemeMusicVolume(),
            duration: 2000,
            ease: 'Sine.easeIn'
        });

        console.log('[HatchingScene] 🎵 Theme music started - Starwhale Over the Nebula Sea');
    }

    getThemeMusicVolume() {
        const volumes = window.AudioManager?.getVolumes?.() || { master: 0.7, music: 0.5 };
        return 0.6 * volumes.master * volumes.music;
    }

    syncThemeMusicPreferences() {
        if (!this.themeMusicWanted) return;
        if (!this.themeMusic) {
            this.startThemeMusic();
            return;
        }
        this.tweens.killTweensOf(this.themeMusic);
        this.themeMusic.setMute(window.AudioManager?.isMuted?.() === true);
        this.themeMusic.setVolume(this.getThemeMusicVolume());
    }

    /**
     * Stop theme music with fade out
     */
    stopThemeMusic(immediate = false) {
        this.themeMusicWanted = false;
        const music = this.themeMusic;
        if (!music) return;
        this.tweens.killTweensOf(music);
        const dispose = () => {
            music.stop();
            music.destroy();
            if (this.themeMusic === music) this.themeMusic = null;
        };
        if (immediate || !music.isPlaying) {
            dispose();
        } else {
            this.tweens.add({
                targets: music,
                volume: 0,
                duration: 800,
                ease: 'Sine.easeOut',
                onComplete: dispose
            });
            console.log('[HatchingScene] 🎵 Theme music fading out');
        }
    }

    /**
     * Check storage availability and show warning if needed
     */
    checkStorageAndWarn() {
        const GameState = getGameState();

        // Check if in memory-only mode (incognito/storage unavailable)
        if (GameState.storageMode === 'memory') {
            this.showStorageWarningBanner('Playing in private mode - your progress won\'t be saved when you close this tab.');
        }

        // Listen for future storage warnings
        GameState.on('storageWarning', (data) => {
            this.showStorageWarningBanner(data.message);
        });
    }

    /**
     * Show a warning banner at the top of the screen
     */
    showStorageWarningBanner(message) {
        const { width } = this.scale;

        // Create warning banner
        const bannerHeight = 50;
        const banner = this.add.graphics();
        banner.fillStyle(0xFF6B35, 0.95);
        banner.fillRect(0, 0, width, bannerHeight);
        banner.setScrollFactor(0);
        banner.setDepth(19000);

        // Warning icon and text
        const warningText = this.add.text(width / 2, bannerHeight / 2, `⚠️ ${message}`, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            wordWrap: { width: width - 40 },
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(19001);

        // Close button
        const closeBtn = this.add.text(width - 20, bannerHeight / 2, '✕', {
            fontSize: '18px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(19001);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => {
            banner.destroy();
            warningText.destroy();
            closeBtn.destroy();
        });

        // Auto-hide after 10 seconds
        this.time.delayedCall(10000, () => {
            if (banner.active) {
                this.tweens.add({
                    targets: [banner, warningText, closeBtn],
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        banner.destroy();
                        warningText.destroy();
                        closeBtn.destroy();
                    }
                });
            }
        });
    }

    /**
     * Check if age gate needs to be shown
     */
    async checkAgeGate(onComplete) {
        // Check if age gate already confirmed
        const hasConfirmed = localStorage.getItem('mythical_void_age_confirmed') === 'true';

        if (hasConfirmed) {
            // Already confirmed, proceed
            onComplete();
            return;
        }

        // Show age gate modal
        try {
            const AgeGateModal = (await import('../ui/AgeGateModal.js')).default;
            this.ageGateModal = new AgeGateModal(this);
            this.ageGateModal.show(onComplete);
        } catch (error) {
            console.warn('[HatchingScene] Failed to load age gate:', error);
            // Proceed anyway if modal fails to load
            onComplete();
        }
    }

    showHatchingScreen() {
        if (!this.canCommitHatch()) { this.showHatchSaveRecovery(() => this.showHatchingScreen()); return; }
        console.log('[HatchingScene] 🥚 Showing hatching screen with audio');
        if (!this.isEggHatch) this.loadThemeMusicInBackground();

        // Play suspenseful ambient sound
        if (window.AudioManager) {
            window.AudioManager.playSuspenseAmbient();
            console.log('[HatchingScene] 🎵 Playing suspense ambient sound');
        }

        // Initialize enhanced graphics engine
        const GraphicsEngine = getGraphicsEngine();
        this.graphicsEngine = new GraphicsEngine(this);

        // Generate creature genetics early so egg can have proper rarity pattern
        if (!this.generateCreatureGenetics()) { this.showHatchSaveRecovery(() => this.showHatchingScreen()); return; }

        // Create enhanced programmatic sprites (now with rarity info)
        this.createEnhancedSprites();

        // Add audio indicator
        this.createAudioIndicator();

        // ENHANCED: Use cosmic starfield background (matches home screen)
        this.createEnhancedBackground();
        this.createStardustParticles();

        // Create cosmic mystical platform for egg (replaces green ground)
        this.createCosmicPlatform();

        // Create the egg with floating animation
        this.createEgg();

        // Set up input handling
        this.setupInput();

        // Create UI text elements
        this.createUI();
        this.createTapToHatchText();

        // Initialize hatch cinematics if available
        if (window.HatchCinematics) {
            // Load config
            this.loadHatchConfig();
        }

        // Show tutorial hints for first-time players
        if (!this.hasSeenTutorial()) {
            // Create visual pointer to egg
            this.createTutorialPointer();

            // Show initial tutorial hint after a brief delay
            this.time.delayedCall(1000, () => {
                this.showTutorialHint('preHatch');
            });
        }
        this.resizeHatchingLayout();
    }

    createStartButton() {
        // Animated START button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x00FF00, 0.9);
        buttonBg.fillRoundedRect(300, 280, 200, 60, 15);
        buttonBg.lineStyle(4, 0xFFFFFF);
        buttonBg.strokeRoundedRect(300, 280, 200, 60, 15);

        // START button text
        const startText = this.add.text(400, 310, '🚀 START GAME', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Make button interactive
        const startButton = this.add.zone(300, 280, 200, 60)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        // Button animations
        this.tweens.add({
            targets: [buttonBg, startText],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // ⚠️ CRITICAL GAME FLOW FIX - DO NOT MODIFY WITHOUT TEAM REVIEW ⚠️
        // This handler fixes the core bug where game would skip egg hatching
        // The timing of GameState.save() and scene restart is critical
        // See GAME_FLOW_DOCUMENTATION.md for full explanation
        startButton.on('pointerdown', () => {
            console.log('🚀 START GAME button clicked!');

            // Play button click sound
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            const state = getGameState();

            // Mark game as started
            state.set('session.gameStarted', true);
            state.recordOpeningMilestone?.('hatch_started');
            console.log('✅ Set gameStarted to true');

            // NOTE: Do NOT reset creature collection here!
            // The collection persists across hatchings so players can have multiple creatures.
            // resetCreatureCollection() should only be called on explicit "New Game" with confirmation.
            console.log(`✅ Creature collection preserved (${state.get('creatures')?.length || 0} creatures)`);

            // CRITICAL: Reset creature to unhatched state for fresh game flow
            state.set('creature.hatched', false);
            state.set('creature.name', 'Your Creature');
            state.set('creature.hatchTime', null);
            state.set('creature.experience', 0);
            state.set('creature.level', 1);
            console.log('✅ Set creature.hatched to false');
            
            // Reset creature stats to defaults
            state.set('creature.stats', {
                happiness: 100,
                energy: 100,
                health: 100
            });
            
            // Clear personality, genes, DNA, and personality state to regenerate fresh
            state.set('creature.personality', null);
            state.set('creature.genes', null);
            state.set('creature.dna', null);
            state.set('creature.personalityState', null);

            // CRITICAL: Reset breeding/lineage fields to prevent old data persisting
            state.set('creature.isOffspring', false);
            state.set('creature.generation', null);
            state.set('creature.parentIds', null);
            state.set('creature.offspringBonus', null);
            state.set('creature.hasAncientLineage', false);
            state.set('creature.ancientProphecy', null);

            console.log('🔄 Creature reset complete - forcing save before scene transition...');
            
            // CRITICAL: Force immediate save to localStorage before scene restart
            // This ensures the reset state persists when scene restarts
            state.save();
            
            // Verify the state before restarting
            console.log('🔍 Pre-restart verification:');
            console.log('  gameStarted:', state.get('session.gameStarted'));
            console.log('  creatureHatched:', state.get('creature.hatched'));
            
            // Check what's actually in localStorage
            const savedData = localStorage.getItem('mythical-creature-save');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                console.log('💾 localStorage verification:');
                console.log('  creature.hatched in localStorage:', parsed.creature?.hatched);
                console.log('  Full creature in localStorage:', parsed.creature);
            } else {
                console.log('💾 No data found in localStorage!');
            }
            
            // Small delay to ensure save completes, then transition to hatching screen
            // The 100ms delay is critical - removing it breaks the flow
            this.time.delayedCall(100, () => {
                console.log('🔄 Now restarting scene to show hatching experience...');
                this.scene.restart();
            });
        });
        // ⚠️ END CRITICAL SECTION - TESTED AND WORKING ⚠️

        startButton.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x00FF66, 0.9);
            buttonBg.fillRoundedRect(300, 280, 200, 60, 15);
            buttonBg.lineStyle(4, 0xFFFFFF);
            buttonBg.strokeRoundedRect(300, 280, 200, 60, 15);
        });

        startButton.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x00FF00, 0.9);
            buttonBg.fillRoundedRect(300, 280, 200, 60, 15);
            buttonBg.lineStyle(4, 0xFFFFFF);
            buttonBg.strokeRoundedRect(300, 280, 200, 60, 15);
        });
    }

    createEnhancedSprites() {
        // Get rarity from creature DNA (generated in showHatchingScreen)
        const rarityKey = this.creatureDNA?.raritySignature || 'common';

        // Create enhanced egg with rarity-specific pattern
        const eggTextureName = this.createEnhancedEgg(rarityKey);

        // Store texture name for later use
        this.eggTextureName = eggTextureName || 'enhancedEgg_common';

        // Get creature colors from GameState (allows customization later)
        const creatureColors = getGameState().get('creature.colors') || {
            body: 0x9370DB,  // Default purple
            head: 0xDDA0DD,  // Default plum
            wings: 0x8A2BE2  // Default blue violet
        };

        // Create enhanced creature sprite with realistic depth
        this.graphicsEngine.createEnhancedCreature(
            creatureColors.body,
            creatureColors.head,
            creatureColors.wings,
            0
        );

        // Create magical sparkle effects
        this.graphicsEngine.createMagicalSparkle(0xFFD54F, 1.0);

        // Create enhanced volumetric clouds
        this.createEnhancedClouds();
    }

    createEnhancedEgg(rarityKey = 'common') {
        // Use pre-imported rarity config
        if (!this.rarityConfig) {
            this.rarityConfig = rarityConfig || {};
        }

        // Get rarity-specific egg configuration
        const rarityData = this.rarityConfig[rarityKey] || this.rarityConfig.common || {};
        const eggConfig = rarityData.egg || {
            baseColor: '#90EE90',
            pattern: 'speckled',
            patternColor: '#7CFC00',
            shimmer: 0.3
        };

        // Convert hex colors to numbers for Phaser
        const baseColor = parseInt(eggConfig.baseColor.replace('#', ''), 16);
        const patternColor = parseInt(eggConfig.patternColor.replace('#', ''), 16);

        // Check if texture already exists (prevent duplicate textures on scene restart)
        const textureName = `enhancedEgg_${rarityKey}`;
        if (this.textures.exists(textureName)) {
            console.log(`hatching:info [HatchingScene] Egg texture ${textureName} already exists, skipping generation`);
            return textureName;
        }

        const graphics = this.add.graphics();
        const center = { x: 50, y: 75 };

        // === RARITY-ENHANCED EGG WITH REALISTIC SHADING ===

        // Safe color manipulation helpers (avoid Phaser.Display.Color.ValueToColor stack overflow)
        const darkenColorSafe = (color, percent) => {
            const r = Math.floor(((color >> 16) & 0xFF) * (1 - percent));
            const g = Math.floor(((color >> 8) & 0xFF) * (1 - percent));
            const b = Math.floor((color & 0xFF) * (1 - percent));
            return (r << 16) | (g << 8) | b;
        };
        const lightenColorSafe = (color, percent) => {
            const r = Math.min(255, Math.floor(((color >> 16) & 0xFF) * (1 + percent)));
            const g = Math.min(255, Math.floor(((color >> 8) & 0xFF) * (1 + percent)));
            const b = Math.min(255, Math.floor((color & 0xFF) * (1 + percent)));
            return (r << 16) | (g << 8) | b;
        };

        // Egg shadow on ground
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 3, center.y + 25, 85, 45);

        // Egg base layer (darkest) - using rarity color darkened (safe method)
        const darkBase = darkenColorSafe(baseColor, 0.3);
        graphics.fillStyle(darkBase);
        graphics.fillEllipse(center.x, center.y, 84, 104);

        // Egg main color (from rarity config)
        graphics.fillStyle(baseColor);
        graphics.fillEllipse(center.x - 2, center.y - 2, 80, 100);

        // Egg highlight (creates 3D roundness) - lighter version of base (safe method)
        const lightBase = lightenColorSafe(baseColor, 0.2);
        graphics.fillStyle(lightBase);
        graphics.fillEllipse(center.x - 8, center.y - 8, 65, 85);

        // Egg shine (realistic light reflection) with shimmer intensity
        graphics.fillStyle(0xFFFFFF, eggConfig.shimmer);
        graphics.fillEllipse(center.x - 15, center.y - 15, 35, 45);

        // Apply pattern based on rarity
        this.applyEggPattern(graphics, center, eggConfig.pattern, patternColor, eggConfig.shimmer);

        // Egg outline for definition
        graphics.lineStyle(2, 0x8B4513, 0.8);
        graphics.strokeEllipse(center.x - 2, center.y - 2, 80, 100);

        graphics.generateTexture(textureName, 100, 150);
        graphics.destroy();

        return textureName;
    }

    /**
     * Apply pattern to egg based on rarity configuration
     */
    applyEggPattern(graphics, center, pattern, patternColor, shimmer) {
        switch (pattern) {
            case 'speckled': // Common
                const spots = [
                    { x: 35, y: 60, size: 8 },
                    { x: 65, y: 85, size: 6 },
                    { x: 45, y: 95, size: 5 },
                    { x: 30, y: 80, size: 4 },
                    { x: 55, y: 65, size: 3 }
                ];
                spots.forEach(spot => {
                    graphics.fillStyle(patternColor, 0.8);
                    graphics.fillCircle(center.x + spot.x - 50, center.y + spot.y - 75, spot.size);
                });
                break;

            case 'striped': // Unusual
                for (let i = 0; i < 5; i++) {
                    graphics.fillStyle(patternColor, 0.4 + i * 0.1);
                    graphics.fillRect(center.x - 40, center.y - 40 + i * 20, 80, 8);
                }
                break;

            case 'crystalline': // Rare
                const crystalPoints = [
                    [center.x - 20, center.y - 30],
                    [center.x + 10, center.y - 20],
                    [center.x - 15, center.y + 10],
                    [center.x + 15, center.y + 20]
                ];
                crystalPoints.forEach(([x, y]) => {
                    graphics.fillStyle(patternColor, shimmer);
                    graphics.fillTriangle(x, y, x + 8, y + 12, x - 8, y + 12);
                    graphics.fillStyle(0xFFFFFF, shimmer * 1.5);
                    graphics.fillTriangle(x, y, x + 4, y + 6, x - 4, y + 6);
                });
                break;

            case 'cosmic': // Epic
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const radius = 35 + Math.sin(angle * 3) * 8;
                    const x = center.x + Math.cos(angle) * radius;
                    const y = center.y + Math.sin(angle) * radius * 1.2;
                    graphics.fillStyle(patternColor, shimmer);
                    graphics.fillCircle(x, y, 3 + Math.sin(angle * 5) * 2);
                }
                break;

            case 'radiant': // Legendary
                const rays = 8;
                for (let i = 0; i < rays; i++) {
                    const angle = (i / rays) * Math.PI * 2;
                    graphics.lineStyle(2, patternColor, shimmer);
                    graphics.lineBetween(
                        center.x,
                        center.y,
                        center.x + Math.cos(angle) * 40,
                        center.y + Math.sin(angle) * 50
                    );
                }
                // Add central glow
                graphics.fillStyle(0xFFFFFF, shimmer);
                graphics.fillCircle(center.x, center.y, 10);
                break;

            case 'nebula': // Mythic
                for (let i = 0; i < 20; i++) {
                    const x = center.x + Phaser.Math.Between(-35, 35);
                    const y = center.y + Phaser.Math.Between(-45, 45);
                    const size = Phaser.Math.Between(2, 6);
                    graphics.fillStyle(patternColor, shimmer * Phaser.Math.FloatBetween(0.3, 0.9));
                    graphics.fillCircle(x, y, size);
                }
                break;

            case 'glitched': // Secret
                // Intentional "glitch" effect with random rectangles
                for (let i = 0; i < 15; i++) {
                    const x = center.x + Phaser.Math.Between(-40, 40);
                    const y = center.y + Phaser.Math.Between(-50, 50);
                    const w = Phaser.Math.Between(5, 15);
                    const h = Phaser.Math.Between(2, 8);
                    graphics.fillStyle(patternColor, Phaser.Math.FloatBetween(0.3, 1.0));
                    graphics.fillRect(x, y, w, h);
                }
                // Add cyan/magenta glitch offsets
                graphics.fillStyle(0x00FFFF, 0.3);
                graphics.fillEllipse(center.x - 3, center.y, 80, 100);
                graphics.fillStyle(0xFF00FF, 0.3);
                graphics.fillEllipse(center.x + 3, center.y, 80, 100);
                break;

            default:
                // Default to speckled
                this.applyEggPattern(graphics, center, 'speckled', patternColor, shimmer);
        }
    }

    createEnhancedClouds() {
        // Check if texture already exists
        if (this.textures.exists('enhancedCloud')) {
            return;
        }

        const graphics = this.add.graphics();

        // Volumetric clouds with multiple layers
        const cloudLayers = [
            { offset: { x: 0, y: 0 }, alpha: 0.3, size: 1.2, color: 0xF0F8FF },
            { offset: { x: -3, y: -2 }, alpha: 0.5, size: 1.0, color: 0xFFFFFF },
            { offset: { x: -6, y: -4 }, alpha: 0.7, size: 0.8, color: 0xFFFAF0 },
            { offset: { x: -8, y: -5 }, alpha: 0.9, size: 0.6, color: 0xFFFFFF }
        ];

        cloudLayers.forEach((layer, index) => {
            graphics.fillStyle(layer.color, layer.alpha);
            const scale = layer.size;
            const offsetX = layer.offset.x;
            const offsetY = layer.offset.y;

            // Organic cloud shape with multiple connected circles
            graphics.fillCircle(30 + offsetX, 25 + offsetY, 25 * scale);
            graphics.fillCircle(50 + offsetX, 20 + offsetY, 30 * scale);
            graphics.fillCircle(70 + offsetX, 25 + offsetY, 25 * scale);
            graphics.fillCircle(45 + offsetX, 35 + offsetY, 20 * scale);
            graphics.fillCircle(25 + offsetX, 30 + offsetY, 15 * scale);
            graphics.fillCircle(65 + offsetX, 32 + offsetY, 18 * scale);

            // Additional cloud wisps for realism
            graphics.fillCircle(15 + offsetX, 28 + offsetY, 12 * scale);
            graphics.fillCircle(80 + offsetX, 28 + offsetY, 14 * scale);
        });

        graphics.generateTexture('enhancedCloud', 100, 60);
        graphics.destroy();
    }

    createBackground() {
        // MOBILE-RESPONSIVE cloud positioning
        const { width, height } = this.scale;

        // Add floating enhanced clouds
        this.clouds = this.add.group();
        const cloudCount = width < 600 ? 3 : 4; // Fewer clouds on mobile

        for (let i = 0; i < cloudCount; i++) {
            const cloud = this.add.image(
                Phaser.Math.Between(width * 0.1, width * 0.9),  // 10%-90% of screen width
                Phaser.Math.Between(height * 0.08, height * 0.25), // Top 8%-25% of screen
                'enhancedCloud'
            );
            cloud.setAlpha(0.8);
            cloud.setScale(Phaser.Math.FloatBetween(0.8, 1.2));
            this.clouds.add(cloud);

            // Gentle cloud movement
            this.tweens.add({
                targets: cloud,
                x: cloud.x + Phaser.Math.Between(-50, 50),
                duration: Phaser.Math.Between(8000, 12000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }

    /**
     * Create cosmic mystical platform for the egg to rest on
     * MOBILE-RESPONSIVE: Positions based on screen dimensions
     */
    createCosmicPlatform() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const platformY = height * 0.65; // Platform at 65% down screen

        // Create mystical floating platform with glow
        const platform = this.add.graphics();

        // Outer glow ring
        platform.fillStyle(0x7B4FBF, 0.15);
        platform.fillEllipse(centerX, platformY, 280, 40);
        platform.fillStyle(0x7B4FBF, 0.25);
        platform.fillEllipse(centerX, platformY, 220, 30);

        // Main platform surface (glowing mystical stone)
        platform.fillStyle(0x4A148C, 0.8);
        platform.fillEllipse(centerX, platformY, 160, 20);
        platform.fillStyle(0x6A1B9A, 0.9);
        platform.fillEllipse(centerX, platformY - 3, 140, 15);

        // Highlight rim
        platform.lineStyle(2, 0xE1BEE7, 0.6);
        platform.strokeEllipse(centerX, platformY - 3, 140, 15);

        // Add mystical runes/markings on platform
        platform.lineStyle(1, 0xFFD54F, 0.4);
        platform.strokeEllipse(centerX, platformY - 3, 100, 10);
        platform.strokeEllipse(centerX, platformY - 3, 60, 6);

        // Store for cleanup
        this.cosmicPlatform = platform;
        this.hatchPlatformOrigin = { x: centerX, y: platformY };

        // Create floating energy particles around platform
        this.platformParticles = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 90;
            const particle = this.add.circle(
                centerX + Math.cos(angle) * radius,
                platformY + Math.sin(angle) * 15,
                3,
                0xFFD54F,
                0.5
            );

            this.platformParticles.push(particle);

            // Orbit animation
            this.tweens.add({
                targets: particle,
                x: centerX + Math.cos(angle + Math.PI * 2) * radius,
                duration: 8000 + i * 500,
                repeat: -1,
                ease: 'Linear'
            });

            // Pulse animation
            this.tweens.add({
                targets: particle,
                alpha: { from: 0.3, to: 0.8 },
                scale: { from: 0.8, to: 1.2 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                delay: i * 100
            });
        }

        // Gentle platform glow pulse
        this.tweens.add({
            targets: platform,
            alpha: { from: 1, to: 0.85 },
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createGround() {
        // LEGACY: Kept for backwards compatibility
        // Now replaced by createCosmicPlatform() for hatching screen
        // MOBILE-RESPONSIVE ground positioning
        const { width, height } = this.scale;
        const groundY = height * 0.83; // Ground at 83% down the screen
        const groundHeight = height * 0.17; // Ground is 17% of screen height

        // Create green ground at the bottom
        const ground = this.add.graphics();
        ground.fillStyle(0x228B22); // Forest green
        ground.fillRect(0, groundY, width, groundHeight);

        // Add some grass details - responsive count based on width
        ground.fillStyle(0x32CD32); // Lime green
        const grassCount = Math.floor(width / 40); // One grass tuft per 40px
        for (let i = 0; i < grassCount; i++) {
            const x = i * 40 + Phaser.Math.Between(-10, 10);
            ground.fillTriangle(x, groundY, x + 5, groundY - 10, x + 10, groundY);
        }
    }

    createEgg() {
        // FIX #3: Improved cleanup - kill tweens AND destroy sprite to prevent duplication
        if (this.egg) {
            this.tweens.killTweensOf(this.egg);
            this.egg.destroy();
            this.egg = null;
        }

        // MOBILE-RESPONSIVE egg positioning
        // Center the egg in the middle of the viewport
        const { width, height } = this.scale;
        const eggX = width / 2;
        const eggY = height * 0.45;

        // Stellar egg golden aura effect
        if (this.isEggHatch && this.eggType === 'stellar') {
            // Outer golden glow
            this.stellarGlow = this.add.graphics();
            this.stellarGlow.fillStyle(0xFFD700, 0.15);
            this.stellarGlow.fillCircle(eggX, eggY, 120);
            this.stellarGlow.fillStyle(0xFFD700, 0.25);
            this.stellarGlow.fillCircle(eggX, eggY, 80);
            this.stellarGlow.fillStyle(0xFFA500, 0.3);
            this.stellarGlow.fillCircle(eggX, eggY, 50);

            // Pulsing animation for glow
            this.tweens.add({
                targets: this.stellarGlow,
                alpha: { from: 1, to: 0.6 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Golden particles orbiting the egg
            this.stellarParticles = [];
            for (let i = 0; i < 12; i++) {
                const particle = this.add.graphics();
                particle.fillStyle(0xFFD700, 0.9);
                particle.fillCircle(0, 0, 4);
                particle.fillStyle(0xFFFFFF, 0.8);
                particle.fillCircle(0, 0, 2);
                particle.setPosition(eggX, eggY);

                // Orbit animation
                const angle = (i / 12) * Math.PI * 2;
                const radius = 90;
                this.tweens.add({
                    targets: particle,
                    x: { from: eggX + Math.cos(angle) * radius, to: eggX + Math.cos(angle + Math.PI * 2) * radius },
                    y: { from: eggY + Math.sin(angle) * radius, to: eggY + Math.sin(angle + Math.PI * 2) * radius },
                    duration: 4000,
                    repeat: -1,
                    ease: 'Linear'
                });

                this.stellarParticles.push(particle);
            }

            console.log('hatch:info [HatchingScene] ✨ Stellar egg golden visuals created');
        }

        // Use rarity-specific egg texture
        const textureName = this.eggTextureName || 'enhancedEgg_common';
        this.egg = this.add.image(eggX, eggY, textureName);  // Slightly above center
        this.hatchEggOrigin = { x: eggX, y: eggY };

        // Apply golden tint for Stellar eggs
        if (this.isEggHatch && this.eggType === 'stellar') {
            this.egg.setTint(0xFFE4B5); // Soft golden tint
        }

        // IMPORTANT: Set scale BEFORE interactive to ensure hit area matches visual size
        this.egg.setScale(1.2);

        // LARGE touch area for easy clicking - significantly bigger than the egg
        // This ensures clicking anywhere near the egg will trigger hatching
        const isMobile = MobileHelpers.isMobile();
        const hitAreaPadding = isMobile ? 80 : 60; // Even larger hit area
        // Now the hit area will correctly match the scaled egg size PLUS generous padding
        this.egg.setInteractive({
            hitArea: new Phaser.Geom.Circle(0, 0, (this.egg.width / 2) + hitAreaPadding),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            cursor: isMobile ? 'default' : 'pointer'
        });

        // CRITICAL FIX: Attach click handler HERE immediately after making egg interactive
        // This ensures the handler is ALWAYS attached when egg is created/recreated
        // Previously this was in setupInput() which meant handlers were lost on egg recreation
        this.egg.on('pointerdown', () => {
            console.log('🥚 EGG CLICKED! Starting hatching sequence...');

            if (!this.activateEggHatch()) {
                console.log('🥚 Egg click ignored - hatching already in progress or creature appeared');
            }
        });

        // The egg remains a Phaser image, but the actual first action should
        // not fail if a browser loses a canvas pointer event. This transparent
        // native button sits over the existing egg and calls the same guarded
        // hatch path. It adds no second egg and gives keyboard users a real
        // labelled control.
        // A mobile browser can synthesize a click after the Start touch has
        // already restarted this scene. Keep that single gesture from also
        // activating the newly created egg.
        const inputHandoffDelayMs = this.isEggHatch ? 0 : 450;
        this.eggHatchReadyAt = inputHandoffDelayMs > 0
            ? Date.now() + inputHandoffDelayMs
            : 0;
        this.createEggHatchFallback();
        this.eggHatchReadyTimer?.remove?.();
        if (inputHandoffDelayMs > 0) {
            this.eggHatchReadyTimer = this.time.delayedCall(inputHandoffDelayMs, () => {
                this.eggHatchReadyAt = 0;
                if (this.eggHatchFallback?.isConnected) {
                    this.eggHatchFallback.disabled = false;
                }
                this.eggHatchReadyTimer = null;
            });
        }

        // Create floating animation for the egg
        this.tweens.add({
            targets: this.egg,
            y: this.egg.y - 20,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

    }

    activateEggHatch(event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        if (
            !this.sys?.isActive() ||
            !this.egg?.active ||
            Date.now() < this.eggHatchReadyAt ||
            this.hatchingStarted ||
            this.creatureAppeared
        ) {
            return false;
        }

        MobileHelpers.vibrate(30);
        this.startHatching();
        return true;
    }

    createEggHatchFallback() {
        if (typeof document === 'undefined') return;

        this.removeEggHatchFallback();
        const gameRoot = document.getElementById('game');
        if (!gameRoot) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'egg-hatch-fallback';
        button.dataset.mythicalEggHatch = 'true';
        button.disabled = Date.now() < this.eggHatchReadyAt;
        const prompt = MobileHelpers.isMobile() || this.scale.width < 600
            ? firstSessionFraming.tapPromptMobile
            : firstSessionFraming.tapPromptDesktop;
        button.setAttribute('aria-label', prompt);
        button.title = prompt;

        const activate = event => this.activateEggHatch(event);
        button.addEventListener('click', activate);
        gameRoot.appendChild(button);

        this.eggHatchFallback = button;
        const cleanup = () => {
            this.events?.off?.(Phaser.Scenes.Events.SHUTDOWN, cleanup);
            button.removeEventListener('click', activate);
            button.remove();
            if (this.eggHatchFallback === button) {
                this.eggHatchFallback = null;
            }
            if (this.eggHatchFallbackCleanup === cleanup) {
                this.eggHatchFallbackCleanup = null;
            }
        };
        this.eggHatchFallbackCleanup = cleanup;
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    }

    removeEggHatchFallback() {
        if (this.eggHatchFallbackCleanup) {
            this.eggHatchFallbackCleanup();
            this.eggHatchFallbackCleanup = null;
            return;
        }
        this.eggHatchFallback?.remove();
        this.eggHatchFallback = null;
    }

    setupInput() {
        // NOTE: Egg click handler is now attached directly in createEgg()
        // This ensures the handler persists when egg is recreated

        // Handle space key for scene transition (with null check for touch devices)
        if (this.input.keyboard) {
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
    }

    /**
     * Check if player has seen the tutorial before
     * @returns {boolean} True if tutorial has been seen
     */
    hasSeenTutorial() {
        const gameState = getGameState();
        return gameState.get('tutorial.hatchingSeen') || false;
    }

    /**
     * Mark the hatching tutorial as seen
     */
    markTutorialSeen() {
        const gameState = getGameState();
        gameState.set('tutorial.hatchingSeen', true);
        console.log('[HatchingScene] Tutorial marked as seen');
    }

    /**
     * Create a visual pointer/indicator to guide player to the egg
     */
    createTutorialPointer() {
        if (this.hasSeenTutorial() || this.tutorialPointer) {
            return; // Don't show if already seen or already exists
        }

        const { width, height } = this.scale;
        const eggX = this.egg?.x ?? width / 2;
        const eggY = height * 0.45;
        const eggTop = this.egg
            ? this.egg.y - (this.egg.displayHeight / 2)
            : eggY - 60;

        // Create animated arrow pointing down at the egg
        const arrowGraphics = this.add.graphics();
        arrowGraphics.fillStyle(0xFFD700, 1);

        // Draw arrow shape
        const arrowSize = 22;
        const arrowX = eggX;
        const arrowY = eggTop - 4;
        const shaftHeight = 12;

        arrowGraphics.beginPath();
        arrowGraphics.moveTo(arrowX, arrowY);
        arrowGraphics.lineTo(arrowX - arrowSize/2, arrowY - arrowSize);
        arrowGraphics.lineTo(arrowX + arrowSize/2, arrowY - arrowSize);
        arrowGraphics.closePath();
        arrowGraphics.fillPath();

        // Draw arrow shaft
        arrowGraphics.fillRect(
            arrowX - 4,
            arrowY - arrowSize - shaftHeight,
            8,
            shaftHeight
        );

        this.tutorialPointer = arrowGraphics;

        // Animate the pointer with bouncing effect
        this.tweens.add({
            targets: this.tutorialPointer,
            y: '+=15',
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Add glow effect
        this.tweens.add({
            targets: this.tutorialPointer,
            alpha: 0.6,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        console.log('[HatchingScene] Tutorial pointer created');
    }

    /**
     * Show contextual tutorial hint based on current state
     * @param {string} stage - Tutorial stage: 'preHatch', 'hatching', 'postHatch'
     */
    showTutorialHint(stage) {
        if (this.hasSeenTutorial()) {
            return; // Skip hints for experienced players
        }

        const { width, height } = this.scale;
        let hintText = '';
        let duration = 4000;

        switch (stage) {
            case 'preHatch':
                hintText = firstSessionFraming.tutorialHints.preHatch;
                break;
            case 'hatching':
                hintText = firstSessionFraming.tutorialHints.hatching;
                duration = 3000;
                break;
            case 'postHatch':
                hintText = firstSessionFraming.tutorialHints.postHatch;
                duration = 5000;
                break;
            default:
                return;
        }

        // Remove existing hint if present
        if (this.tutorialHintText) {
            this.tweens.killTweensOf(this.tutorialHintText);
            this.tutorialHintText.destroy();
        }

        // Create hint text
        this.tutorialHintText = this.add.text(width / 2, height * 0.75, hintText, {
            fontSize: '18px',
            color: '#FFD700',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 20, y: 10 },
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            wordWrap: { width: width * 0.8 }
        }).setOrigin(0.5).setAlpha(0);

        // Fade in
        this.tweens.add({
            targets: this.tutorialHintText,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });

        // Auto-dismiss after duration
        this.time.delayedCall(duration, () => {
            if (this.tutorialHintText) {
                this.tweens.add({
                    targets: this.tutorialHintText,
                    alpha: 0,
                    duration: 300,
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

        console.log(`[HatchingScene] Showing tutorial hint: ${stage}`);
        const layout = this.getEggHatchLayout();
        this.tutorialHintText.setPosition(layout.eggX, layout.hintY)
            .setFontSize(layout.landscape ? 14 : 16)
            .setWordWrapWidth(layout.landscape ? this.scale.width * 0.42 : this.scale.width - 72);
    }

    createUI() {
        const { width, height } = this.scale;
        const centerX = width / 2;

        // MOBILE-RESPONSIVE font sizes
        const titleFontSize = Math.max(20, Math.min(32, width * 0.07));
        const subtitleFontSize = Math.max(14, Math.min(18, width * 0.04));
        const instructionFontSize = Math.max(16, Math.min(20, width * 0.045));

        // Main title
        this.hatchTitleText = this.add.text(centerX, height * 0.08, firstSessionFraming.hatchTitle, {
            fontSize: `${titleFontSize}px`,
            color: '#FFD54F',
            stroke: '#071418',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        this.hatchSubtitleText = this.add.text(centerX, height * 0.13, firstSessionFraming.hatchSubtitle, {
            fontSize: `${subtitleFontSize}px`,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif'
        }).setOrigin(0.5);

        // Instructions text with better styling and enhanced tutorial hints
        const tutorialText = this.hasSeenTutorial()
            ? firstSessionFraming.returningHatchPrompt
            : firstSessionFraming.firstHatchPrompt;

        this.instructionText = this.add.text(centerX, height * 0.2, tutorialText, {
            fontSize: `${instructionFontSize}px`,
            color: '#FFFFFF',
            stroke: '#071418',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        // Add pulsing animation to make instruction more noticeable
        if (!this.hasSeenTutorial()) {
            this.tweens.add({
                targets: this.instructionText,
                scale: 1.05,
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }

        // Create UI panel background
        this.createControlPanel();

        // Progress text (hidden initially)
        const progressFontSize = Math.max(18, Math.min(24, width * 0.055));
        this.progressText = this.add.text(centerX, height * 0.57, '', {
            fontSize: `${progressFontSize}px`,
            color: '#FFD54F',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold',
            wordWrap: { width: Math.max(260, width - 40) }
        }).setOrigin(0.5).setVisible(false);

        // Adventure text removed - replaced by Keep/Reroll UI
    }

    createControlPanel() {
        const { width, height } = this.scale;
        const centerX = width / 2;

        // Skip control panel on mobile to simplify UI
        if (width < 600) {
            return;
        }

        // Desktop: Control panel at bottom
        const panelWidth = Math.min(width * 0.9, 700);
        const panelHeight = 100;
        const panelY = height - 120;

        // Control panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.7);
        panelBg.fillRoundedRect(centerX - panelWidth/2, panelY, panelWidth, panelHeight, 15);
        panelBg.lineStyle(3, 0xFFD54F);
        panelBg.strokeRoundedRect(centerX - panelWidth/2, panelY, panelWidth, panelHeight, 15);

        // Instructions
        const controlText = this.add.text(centerX, panelY + 30, firstSessionFraming.controlPrompt, {
            fontSize: '16px',
            color: '#F5F5F5',
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        // Game info
        const journeyText = this.add.text(centerX, panelY + 60, firstSessionFraming.journeyPrompt, {
            fontSize: '14px',
            color: '#80CBC4',
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        this.controlPanelElements = { panelBg, controlText, journeyText };
    }


    startHatching() {
        if (this.hatchingStarted || this.creatureAppeared || !this.egg?.active) return;

        this.removeEggHatchFallback();
        this.hatchingStarted = true;
        this.isHatching = true;
        this.instructionText.setVisible(false);
        this.progressText.setVisible(true);

        // The egg prompt and movement guide have finished their job. Keeping
        // them behind the revealed creature makes the first-contact moment look
        // stale and gives the player several conflicting instructions.
        if (this.tapToHatchText) {
            this.tweens.killTweensOf(this.tapToHatchText);
            this.tapToHatchText.destroy();
            this.tapToHatchText = null;
        }
        Object.values(this.controlPanelElements || {}).forEach(element => element?.setVisible(false));

        // Hide tutorial pointer if present
        if (this.tutorialPointer) {
            this.tweens.add({
                targets: this.tutorialPointer,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    if (this.tutorialPointer) {
                        this.tutorialPointer.destroy();
                        this.tutorialPointer = null;
                    }
                }
            });
        }

        // Show hatching tutorial hint
        this.showTutorialHint('hatching');

        // Start shaking animation
        this.tweens.add({
            targets: this.egg,
            x: this.egg.x + 5,
            duration: 100,
            ease: 'Power2',
            yoyo: true,
            repeat: -1
        });

        // Progressive hatching timer
        this.hatchingTimer = this.time.addEvent({
            delay: 100,
            callback: this.updateHatching,
            callbackScope: this,
            loop: true
        });
    }

    updateHatching() {
        this.hatchingProgress += 2;
        this.progressText.setText(`Hatching... ${this.hatchingProgress}%`);

        // Change egg color as it hatches with crack sounds
        if (this.hatchingProgress >= 33 && this.hatchingProgress < 35) {
            // First crack at 33%
            console.log('[HatchingScene] 🔊 First crack sound (33%)');
            if (window.AudioManager) {
                window.AudioManager.playEggCrack();
            }
            // Change to pink
            this.updateEggColor(0xFFC0CB, 0x8B4513); // Pink with brown outline
        } else if (this.hatchingProgress >= 66 && this.hatchingProgress < 68) {
            // Second crack at 66%
            console.log('[HatchingScene] 🔊 Second crack sound (66%)');
            if (window.AudioManager) {
                window.AudioManager.playEggCrack();
            }
            // Change to red
            this.updateEggColor(0xFF6B6B, 0x8B4513); // Red with brown outline
        }

        // Complete hatching at 100%
        if (this.hatchingProgress >= 100) {
            this.completeHatching();
        }
    }

    updateEggColor(fillColor, strokeColor) {
        // Recreate egg texture with new colors
        const eggGraphics = this.add.graphics();
        eggGraphics.fillStyle(fillColor);
        eggGraphics.fillEllipse(50, 75, 80, 100);
        eggGraphics.lineStyle(3, strokeColor);
        eggGraphics.strokeEllipse(50, 75, 80, 100);
        eggGraphics.fillStyle(0xFFD54F); // Keep yellow spots
        eggGraphics.fillCircle(35, 60, 8);
        eggGraphics.fillCircle(65, 85, 6);
        eggGraphics.fillCircle(45, 95, 5);
        eggGraphics.generateTexture('eggHatching', 100, 150);
        eggGraphics.destroy();

        this.egg.setTexture('eggHatching');
    }

    completeHatching() {
        console.log('[HatchingScene] 🎉 Egg hatched! Playing celebration sound');
        this.stopThemeMusic();

        // Get rarity-specific effects configuration
        const rarityKey = this.creatureDNA?.raritySignature || 'common';
        const rarityConfigKey = rarityKey === 'uncommon' ? 'unusual' : rarityKey;
        const rarityConfig = this.rarityConfig?.[rarityConfigKey] || this.rarityConfig?.common || {};
        const hatchEffects = rarityConfig.hatchingEffects || {};

        // Play celebration sound
        if (window.AudioManager) {
            window.AudioManager.playHatchCelebration();
        }

        // Add rarity-specific camera effects for Epic+
        const rarityTiers = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
        const rarityTier = rarityTiers.indexOf(rarityKey);
        const isEpicOrHigher = rarityTier >= 3; // Epic and above

        if (isEpicOrHigher) {
            // Camera shake effect
            if (hatchEffects.cameraShake && this.cameras.main) {
                window.FeedbackManager?.cameraShake?.(this, 300, 0.005);
            }

            // Camera zoom effect
            if (hatchEffects.cameraZoom && this.cameras.main) {
                const originalZoom = this.cameras.main.zoom;
                this.tweens.add({
                    targets: this.cameras.main,
                    zoom: originalZoom + 0.1,
                    duration: 300,
                    yoyo: true,
                    ease: 'Sine.easeInOut'
                });
            }
        }

        // Add extra sparkles based on rarity
        if (hatchEffects.extraSparkles > 0 && window.FXLibrary) {
            const { width, height } = this.scale;
            const eggX = width / 2;
            const eggY = height * 0.45;

            window.FXLibrary.stardustBurst(this, eggX, eggY, {
                count: hatchEffects.particleCount || 20,
                color: [0xFFD700, 0xFFA500, 0xFFFFFF],
                duration: 2000
            });
        }

        // The baby reveal owns rarity text; a second banner would cover it.

        this.hatchingTimer.destroy();
        this.isHatching = false;
        this.progressText.setVisible(false);

        // Stop shaking and floating animations
        this.tweens.killTweensOf(this.egg);

        // Make egg disappear with fade effect (with flash intensity based on rarity)
        const flashIntensity = hatchEffects.flashIntensity || 0.2;
        this.createFlashEffect(flashIntensity);

        this.tweens.add({
            targets: this.egg,
            alpha: 0,
            scale: 0,
            duration: 500,
            onComplete: () => {
                this.egg.destroy();
                this.showCreature();
            }
        });
    }

    /**
     * Show celebration banner with rarity-specific message
     */
    showCelebrationBanner(message, rarityConfig) {
        const { width, height } = this.scale;

        // Get rarity display name and visual config
        const displayName = rarityConfig.displayName || 'Living Form';
        const visualConfig = rarityConfig.visual || {};
        const frameColor = visualConfig.frame ? parseInt(visualConfig.frame.replace('#', ''), 16) : 0x7CFC00;
        const badge = visualConfig.badge || '✨';
        const isCompact = width <= 520;
        const bannerWidth = Math.min(500, width - 24);
        const bannerHeight = isCompact ? 104 : 100;
        const bannerX = (width - bannerWidth) / 2;
        const bannerY = height * 0.15;

        // Create banner background
        const bannerBg = this.add.graphics();
        bannerBg.fillStyle(0x000000, 0.7);
        bannerBg.fillRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 15);
        bannerBg.lineStyle(3, frameColor, 1);
        bannerBg.strokeRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 15);
        bannerBg.setDepth(1000);

        // Create banner text
        const bannerText = this.add.text(width / 2, bannerY + 29, `${badge} ${displayName}`, {
            fontSize: isCompact ? '22px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            align: 'center'
        }).setOrigin(0.5).setDepth(1001);

        const messageText = this.add.text(width / 2, bannerY + 67, message, {
            fontSize: isCompact ? '14px' : '16px',
            color: '#FFFFFF',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            align: 'center',
            wordWrap: { width: bannerWidth - 28 }
        }).setOrigin(0.5).setDepth(1001);

        // Fade in animation
        bannerBg.setAlpha(0);
        bannerText.setAlpha(0);
        messageText.setAlpha(0);

        this.tweens.add({
            targets: [bannerBg, bannerText, messageText],
            alpha: 1,
            duration: 500,
            ease: 'Sine.easeOut'
        });

        // Scale animation for text
        bannerText.setScale(0.5);
        this.tweens.add({
            targets: bannerText,
            scale: 1,
            duration: 600,
            ease: 'Back.easeOut'
        });

        // Auto-dismiss after 3 seconds
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: [bannerBg, bannerText, messageText],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    bannerBg.destroy();
                    bannerText.destroy();
                    messageText.destroy();
                }
            });
        });
    }

    /**
     * Create flash effect for hatching
     */
    createFlashEffect(intensity = 0.3) {
        const { width, height } = this.scale;
        const flash = this.add.graphics();
        flash.fillStyle(0xFFFFFF, intensity);
        flash.fillRect(0, 0, width, height);
        flash.setDepth(500);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy()
        });
    }

    showCreature() {
        if (this.creatureAppeared || this.creatureDisplayAttempt) return;
        console.log('hatch:info [HatchingScene] === showCreature() called ===');
        this.creatureAppeared = true;
        const attempt = { active: true, timer: null };
        this.creatureDisplayAttempt = attempt;

        try {
            window.UXEnhancements?.showLoading?.('Showing your creature...', attempt);
        } catch (error) {
            console.warn('[HatchingScene] Optional loading display unavailable');
        }

        const display = () => {
            if (this.creatureDisplayAttempt !== attempt || !attempt.active) return;
            attempt.timer = null;
            try {
                // Generate genetics if not already generated (should be generated in showHatchingScreen)
                if (!this.creatureGenetics) {
                    console.log('hatch:info [HatchingScene] Step 1: Generating creature genetics (fallback)...');
                    this.generateCreatureGenetics();

                    if (!this.creatureGenetics) {
                        console.error('hatch:error [HatchingScene] CRITICAL: generateCreatureGenetics() returned null!');
                        this.showCriticalError('Failed to generate creature genetics');
                        return;
                    }
                } else {
                    console.log('hatch:info [HatchingScene] Step 1: Using pre-generated creature genetics');
                }

                // Check if vision reveal is enabled
                const visionConfig = evolutionConfig?.hatching?.visionReveal;
                const showVisionFirst = visionConfig?.enabled && visionConfig?.showAdultFirst;

                if (showVisionFirst) {
                    console.log('hatch:info [HatchingScene] Step 2: Showing adult vision first...');
                    this.showAdultVision(visionConfig);
                } else {
                    console.log('hatch:info [HatchingScene] Step 2: Creating creature sprite (no vision)...');
                    const creatureResult = this.createUniqueCreature('baby');
                    this.completeCreatureDisplay(creatureResult);
                }
            } catch (error) {
                console.error('hatch:error [HatchingScene] Error during creature generation:', error);
                this.showCriticalError('An error occurred during creature generation');
            } finally {
                this.finishCreatureDisplayLoading(attempt);
            }
        };
        try {
            // Let the loading display paint without making it own the hatch operation.
            attempt.timer = this.time.delayedCall(100, display);
        } catch (error) {
            this.finishCreatureDisplayLoading(attempt);
            this.showCriticalError('The creature display could not start');
        }
    }

    finishCreatureDisplayLoading(attempt = this.creatureDisplayAttempt) {
        if (!attempt?.active) return;
        attempt.active = false;
        attempt.timer?.remove?.(false);
        attempt.timer = null;
        if (this.creatureDisplayAttempt === attempt) this.creatureDisplayAttempt = null;
        try {
            window.UXEnhancements?.hideLoading?.(attempt);
        } catch (error) {
            console.warn('[HatchingScene] Optional loading cleanup unavailable');
        }
    }

    /**
     * Show the adult vision of the creature before revealing the baby
     */
    showAdultVision(visionConfig) {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const creatureY = height * 0.45;
        const targetScale = width < 600 ? Math.min(1.8, width / 250) : 1.8; // Larger for more impact

        console.log('hatch:info [HatchingScene] ========================================');
        console.log('hatch:info [HatchingScene] STARTING ADULT VISION REVEAL');
        console.log('hatch:info [HatchingScene] Vision duration:', visionConfig.visionDuration, 'ms');
        console.log('hatch:info [HatchingScene] ========================================');

        // Create dark overlay for dramatic effect (more contrast)
        this.visionOverlay = this.add.graphics();
        this.visionOverlay.fillStyle(0x000033, 0.6);
        this.visionOverlay.fillRect(0, 0, width, height);
        this.visionOverlay.setDepth(10);
        this.visionOverlay.setAlpha(0);

        // Create the ADULT version of the creature
        console.log('hatch:info [HatchingScene] Creating adult vision creature...');
        const adultResult = this.createUniqueCreature('adult');

        if (!adultResult || !adultResult.textureName) {
            console.error('hatch:error [HatchingScene] Failed to create adult vision');
            if (this.visionOverlay) this.visionOverlay.destroy();
            const babyResult = this.createUniqueCreature('baby');
            this.completeCreatureDisplay(babyResult);
            return;
        }

        console.log('hatch:info [HatchingScene] Adult creature created:', adultResult.textureName);

        // Create ethereal glow behind the creature (more prominent)
        const glowColor = visionConfig.visionEffects?.glowColor ?
            parseInt(visionConfig.visionEffects.glowColor.replace('#', ''), 16) : 0xFFD700; // Gold glow
        const glowIntensity = visionConfig.visionEffects?.glowIntensity || 1.0;

        const glow = this.add.graphics();
        // Much larger glow for dramatic effect
        glow.fillStyle(glowColor, glowIntensity * 0.15);
        glow.fillCircle(centerX, creatureY, 200);
        glow.fillStyle(glowColor, glowIntensity * 0.3);
        glow.fillCircle(centerX, creatureY, 150);
        glow.fillStyle(glowColor, glowIntensity * 0.5);
        glow.fillCircle(centerX, creatureY, 100);
        glow.fillStyle(glowColor, glowIntensity * 0.7);
        glow.fillCircle(centerX, creatureY, 60);
        glow.setDepth(15);
        glow.setAlpha(0);

        // Create the adult creature sprite (vision)
        this.visionCreature = this.add.image(centerX, creatureY, adultResult.textureName);
        this.visionCreature.setScale(0.3);
        this.visionCreature.setAlpha(0);
        this.visionCreature.setDepth(20);
        // Add slight golden tint for "destiny" effect
        this.visionCreature.setTint(0xFFFACD);

        // Create vision message with more emphasis
        const visionMessageY = width < 600 ? height * 0.72 : height * 0.1;
        const visionMessage = this.add.text(centerX, visionMessageY, visionConfig.visionMessage || 'PROJECTED MATURITY // GROWTH POTENTIAL', {
            fontSize: width < 600 ? '20px' : '26px',
            color: '#FFD700',
            fontStyle: 'bold italic',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5).setDepth(25).setAlpha(0);

        // Fade in dark overlay first
        this.tweens.add({
            targets: this.visionOverlay,
            alpha: 1,
            duration: 400,
            ease: 'Sine.easeIn'
        });

        // Fade in glow
        this.tweens.add({
            targets: glow,
            alpha: 1,
            duration: 600,
            ease: 'Sine.easeIn',
            delay: 200
        });

        // Play mystical vision reveal sound
        this.time.delayedCall(300, () => {
            if (window.AudioManager) {
                window.AudioManager.playVisionReveal();
            }
        });

        // Fade in and scale up the adult vision with dramatic entrance
        this.tweens.add({
            targets: this.visionCreature,
            alpha: 1,
            scale: targetScale,
            duration: 1200,
            ease: 'Back.easeOut',
            delay: 400
        });

        // Fade in message
        this.tweens.add({
            targets: visionMessage,
            alpha: 1,
            duration: 800,
            delay: 600
        });

        // Add floating animation to vision
        this.tweens.add({
            targets: this.visionCreature,
            y: creatureY - 20,
            duration: 1800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: 1600
        });

        // Add destiny sparkles
        if (visionConfig.visionEffects?.particles) {
            this.createVisionParticles(centerX, creatureY);
        }

        // After vision duration, transition to baby
        const visionDuration = visionConfig.visionDuration || 4000;

        console.log('hatch:info [HatchingScene] Vision will transition in', visionDuration, 'ms');

        this.time.delayedCall(visionDuration, () => {
            console.log('hatch:info [HatchingScene] Starting transition from adult vision to baby...');

            // Show transition message with baby reveal message
            const transitionMsg = visionConfig.transitionMessage || 'One possible future. Trust and experience will shape the rest.';
            visionMessage.setText(transitionMsg);
            visionMessage.setColor('#FFFFFF');

            this.tweens.add({
                targets: visionMessage,
                alpha: { from: 1, to: 0.9 },
                duration: 400,
                yoyo: true,
                onComplete: () => {
                    // Fade out vision creature, glow, and overlay
                    this.tweens.add({
                        targets: [this.visionCreature, glow, this.visionOverlay],
                        alpha: 0,
                        duration: 1000,
                        ease: 'Sine.easeIn',
                        onComplete: () => {
                            // Cleanup vision elements
                            if (this.visionCreature) {
                                this.visionCreature.destroy();
                                this.visionCreature = null;
                            }
                            glow.destroy();
                            if (this.visionOverlay) {
                                this.visionOverlay.destroy();
                                this.visionOverlay = null;
                            }

                            // Update message for baby reveal
                            const babyMsg = visionConfig.babyRevealMessage || 'FIRST CONTACT // PRESENT FORM';
                            visionMessage.setText(babyMsg);
                            visionMessage.setColor('#98FB98');

                            this.tweens.add({
                                targets: visionMessage,
                                alpha: { from: 0, to: 1 },
                                duration: 500
                            });

                            // Fade out message after a moment
                            this.time.delayedCall(2000, () => {
                                this.tweens.add({
                                    targets: visionMessage,
                                    alpha: 0,
                                    duration: 500,
                                    onComplete: () => visionMessage.destroy()
                                });
                            });

                            // Now show the baby version
                            console.log('hatch:info [HatchingScene] Creating baby creature...');
                            const babyResult = this.createUniqueCreature('baby');
                            this.completeCreatureDisplay(babyResult);
                        }
                    });
                }
            });
        });
    }

    /**
     * Create destiny sparkle particles for vision reveal
     */
    createVisionParticles(centerX, centerY) {
        const colors = [0xFFFFFF, 0xFFD700, 0xE6E6FA, 0x87CEEB];

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const distance = 80 + Math.random() * 60;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;

            const particle = this.add.graphics();
            particle.fillStyle(colors[i % colors.length], 0.8);
            particle.fillCircle(0, 0, 2 + Math.random() * 2);
            particle.setPosition(x, y);
            particle.setDepth(22);
            particle.setAlpha(0);

            // Animate particles in a cosmic swirl
            this.tweens.add({
                targets: particle,
                alpha: { from: 0, to: 0.8 },
                duration: 500,
                delay: i * 50,
                onComplete: () => {
                    this.tweens.add({
                        targets: particle,
                        x: centerX + Math.cos(angle + 0.5) * (distance - 20),
                        y: centerY + Math.sin(angle + 0.5) * (distance - 20),
                        alpha: 0,
                        duration: 2000,
                        ease: 'Sine.easeOut',
                        onComplete: () => particle.destroy()
                    });
                }
            });
        }
    }

    /**
     * Create dramatic birth celebration effects
     * Triggered when the baby creature is revealed
     */
    createBirthCelebration(centerX, centerY) {
        console.log('hatch:info [HatchingScene] 🎉 Creating birth celebration effects!');
        const { width, height } = this.scale;

        // 1. Screen flash (soft golden glow)
        const flash = this.add.graphics();
        flash.fillStyle(0xFFD700, 0.35);
        flash.fillRect(0, 0, width, height);
        flash.setDepth(100);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 600,
            ease: 'Sine.easeOut',
            onComplete: () => flash.destroy()
        });

        // 2. Radial starburst particles
        const burstColors = [0xFFD700, 0xFFFFFF, 0xE1BEE7, 0xFFA500, 0x87CEEB];
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const distance = 150 + Math.random() * 50;
            const particle = this.add.graphics();
            const color = burstColors[i % burstColors.length];
            const size = 3 + Math.random() * 4;

            // Star shape for larger particles
            if (i % 3 === 0) {
                particle.fillStyle(color, 0.9);
                this.drawStar(particle, 0, 0, 5, size * 2, size);
            } else {
                particle.fillStyle(color, 0.8);
                particle.fillCircle(0, 0, size);
            }

            particle.setPosition(centerX, centerY);
            particle.setDepth(99);

            this.tweens.add({
                targets: particle,
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                alpha: 0,
                scale: { from: 1, to: 0.3 },
                duration: 800 + Math.random() * 400,
                ease: 'Power2.easeOut',
                delay: i * 20,
                onComplete: () => particle.destroy()
            });
        }

        // 3. Rising sparkles (fairy dust effect)
        for (let i = 0; i < 15; i++) {
            const sparkle = this.add.graphics();
            sparkle.fillStyle(0xFFFFFF, 0.9);
            sparkle.fillCircle(0, 0, 2);
            sparkle.fillStyle(0xFFD700, 0.7);
            sparkle.fillCircle(1, 1, 1);

            const startX = centerX + Phaser.Math.Between(-80, 80);
            sparkle.setPosition(startX, centerY + 30);
            sparkle.setDepth(98);

            this.tweens.add({
                targets: sparkle,
                y: centerY - 100 - Math.random() * 80,
                x: startX + Phaser.Math.Between(-30, 30),
                alpha: { from: 1, to: 0 },
                duration: 1200 + Math.random() * 600,
                ease: 'Sine.easeOut',
                delay: 200 + i * 80,
                onComplete: () => sparkle.destroy()
            });
        }

        // 4. Pulsing ring effect
        const ring = this.add.graphics();
        ring.lineStyle(3, 0xFFD700, 0.8);
        ring.strokeCircle(centerX, centerY, 30);
        ring.setDepth(97);

        this.tweens.add({
            targets: ring,
            scaleX: 4,
            scaleY: 4,
            alpha: 0,
            duration: 1000,
            ease: 'Sine.easeOut',
            onComplete: () => ring.destroy()
        });

        // 5. Second delayed ring
        this.time.delayedCall(200, () => {
            const ring2 = this.add.graphics();
            ring2.lineStyle(2, 0xE1BEE7, 0.6);
            ring2.strokeCircle(centerX, centerY, 20);
            ring2.setDepth(96);

            this.tweens.add({
                targets: ring2,
                scaleX: 5,
                scaleY: 5,
                alpha: 0,
                duration: 1200,
                ease: 'Sine.easeOut',
                onComplete: () => ring2.destroy()
            });
        });

        // 6. Use FXLibrary if available for extra effects
        if (window.FXLibrary) {
            window.FXLibrary.emotionHappy(this, centerX, centerY);
        }
    }

    /**
     * Draw a star shape on graphics object
     */
    drawStar(graphics, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;

        graphics.beginPath();
        graphics.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            graphics.lineTo(
                cx + Math.cos(rot) * outerRadius,
                cy + Math.sin(rot) * outerRadius
            );
            rot += step;
            graphics.lineTo(
                cx + Math.cos(rot) * innerRadius,
                cy + Math.sin(rot) * innerRadius
            );
            rot += step;
        }

        graphics.lineTo(cx, cy - outerRadius);
        graphics.closePath();
        graphics.fillPath();
    }

    completeCreatureDisplay(creatureResult) {
        const displayedGenetics = this.creatureGenetics;
        const displayOwner = this.hatchSaveOwner;
        let displayedCreature = null;
        const isCurrentDisplay = () => displayOwner?.isCurrent() && displayedCreature?.active !== false &&
            this.creature === displayedCreature && this.creatureGenetics === displayedGenetics;
        console.log('hatch:info [HatchingScene] Step 3: Creature result:', creatureResult ? 'SUCCESS' : 'FAILED');

        if (creatureResult && creatureResult.textureName) {
            console.log('hatch:info [HatchingScene] Step 4: Creating sprite with texture:', creatureResult.textureName);

            // Verify texture exists
            if (!this.textures.exists(creatureResult.textureName)) {
                console.error('hatch:error [HatchingScene] Texture does not exist in cache!');
                this.showCriticalError('Creature texture generation failed');
                return;
            }

            // MOBILE-RESPONSIVE creature positioning
            const { width, height } = this.scale;
            const centerX = width / 2;
            const layout = this.getFirstContactLayout(!this.isEggHatch);
            const creatureY = layout.creatureY;
            const targetScale = layout.creatureScale;

            // Create the enhanced creature with the new texture
            this.creature = this.add.image(centerX, creatureY, creatureResult.textureName);
            displayedCreature = this.creature;
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);
            this.creature.setDepth(20);
            this.applyFirstContactCreaturePresentation(this.creature, layout);

            // Store genetics data on the sprite for later access
            this.creature.genetics = this.creatureGenetics;

            console.log('hatch:info [HatchingScene] Step 5: Fading in creature...');
            // Fade in the creature
            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: targetScale,
                duration: 1000,
                ease: 'Back.easeOut',
                onComplete: () => {
                    if (!isCurrentDisplay() || !this.hatchCommitAttempt?.complete) return;
                    console.log('hatch:info [HatchingScene] Creature fade-in complete');

                    // 🎉 CELEBRATION BURST - Dramatic effect for creature reveal!
                    this.createBirthCelebration(this.creature.x, this.creature.y);

                    // Add cute baby idle animations
                    this.addCuteIdleAnimations(this.creature, targetScale);

                    // Play cute baby sound with celebration
                    if (window.AudioManager) {
                        window.AudioManager.playBabyCoo();
                        // Add a small delay then play achievement sound for extra celebration
                        this.time.delayedCall(300, () => {
                            if (!isCurrentDisplay()) return;
                            window.AudioManager.playAchievement();
                        });
                    }

                    // Show post-hatch tutorial hint and mark tutorial as seen
                    if (!this.hasSeenTutorial()) {
                        if (window.rerollSystem) {
                            // The first-contact guidance below now owns this step.
                            this.markTutorialSeen();
                        } else {
                            this.time.delayedCall(500, () => {
                                if (!isCurrentDisplay()) return;
                                this.showTutorialHint('postHatch');
                                this.markTutorialSeen();
                            });
                        }
                    }
                }
            });

            // Add cosmic effects based on genetics
            this.addGeneticEffects();

            // Save genetics to GameState
            this.saveCreatureGenetics(() => {
                if (!isCurrentDisplay()) return;
                this.beginLivingPortraitPrewarm();
                this.exportLocalPortraitQASpecimen();
                this.finishHatchReveal(isCurrentDisplay);
            });
            return;

        } else {
            // Fallback to default creature
            console.warn('hatch:warn [HatchingScene] Failed to create genetic creature, using default fallback');

            // Check if default texture exists
            if (!this.textures.exists('enhancedCreature0')) {
                console.error('hatch:error [HatchingScene] Default texture enhancedCreature0 also missing!');
                this.showCriticalError('No creature textures available');
                return;
            }

            // MOBILE-RESPONSIVE fallback creature positioning
            const { width, height } = this.scale;
            const centerX = width / 2;
            const layout = this.getFirstContactLayout(!this.isEggHatch);
            const creatureY = layout.creatureY;
            const targetScale = layout.creatureScale;

            this.creature = this.add.image(centerX, creatureY, 'enhancedCreature0');
            displayedCreature = this.creature;
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);
            this.creature.setDepth(20);
            this.applyFirstContactCreaturePresentation(this.creature, layout);

            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: targetScale,
                duration: 1000,
                ease: 'Back.easeOut'
            });
        }

        if (!this.creatureGenetics) {
            this.showCriticalError('Creature identity could not be created');
            return;
        }
        this.saveCreatureGenetics(() => this.finishHatchReveal(isCurrentDisplay));
    }

    finishHatchReveal(isCurrentDisplay) {
        if (!isCurrentDisplay()) return;
        console.log('hatch:info [HatchingScene] Step 6: Creating sparkle effects...');
        // Create sparkle effects around the creature
        this.createSparkles();

        console.log('hatch:info [HatchingScene] Step 7: Setting up reroll system...');
        // Start reroll session if system is available
        if (window.rerollSystem && this.creatureGenetics) {
            window.rerollSystem.startHatchSession({
                genetics: this.creatureGenetics,
                rarity: this.creatureGenetics.rarity
            });
        }

        // Classification is local game data and must never disappear because an
        // optional reroll or hosted-media service is unavailable.
        this.time.delayedCall(650, () => {
            if (!isCurrentDisplay()) return;
            console.log('hatch:info [HatchingScene] Showing classification and genetic trait');
            this.showRarityReveal();
            this.showRerollOptions();
        });

        console.log('hatch:info [HatchingScene] === showCreature() complete ===');
    }

    beginLivingPortraitPrewarm() {
        if (
            this.portraitPromise ||
            !this.creature ||
            !this.creatureGenetics ||
            !window.LivingPortraitService?.prewarm
        ) {
            return;
        }

        try {
            const job = window.LivingPortraitService.prewarm({
                creatureData: {
                    name: 'Mythical Creature',
                    stage: 'baby',
                    genes: this.creatureGenetics,
                    dna: this.creatureDNA
                },
                sprite: this.creature,
                style: 'cinematic',
                source: 'post_hatch'
            });
            if (!job) return;
            const observed = Promise.resolve(job);
            this.portraitPromise = observed;
            observed.catch(error => {
                if (this.portraitPromise !== observed) return;
                this.portraitError = error;
                console.warn('[HatchingScene] Optional living portrait unavailable');
            });
        } catch (error) {
            this.portraitError = error;
            console.warn('[HatchingScene] Optional living portrait unavailable');
        }
    }

    exportLocalPortraitQASpecimen() {
        const isLocal = ['localhost', '127.0.0.1'].includes(
            window.location?.hostname
        );
        const isRequested = new URLSearchParams(window.location?.search)
            .has('portraitQa');
        if (
            !isLocal ||
            !isRequested ||
            !this.creature ||
            !this.creatureGenetics ||
            !window.CreaturePortraitSpec?.create ||
            !window.LivingPortraitService?.captureReference
        ) {
            return;
        }

        const portraitSpec = window.CreaturePortraitSpec.create({
            name: 'Astra-23',
            stage: 'baby',
            genes: this.creatureGenetics,
            dna: this.creatureDNA
        });
        const referenceImage = window.LivingPortraitService.captureReference(
            this.creature
        );
        if (!portraitSpec || !referenceImage) return;

        const exportElement = document.getElementById('portrait-qa-specimen')
            || document.createElement('script');
        exportElement.id = 'portrait-qa-specimen';
        exportElement.type = 'application/json';
        exportElement.textContent = JSON.stringify({
            portraitSpec,
            referenceImage
        });
        if (!exportElement.isConnected) {
            document.body.appendChild(exportElement);
        }
    }

    /**
     * Show critical error message to user
     */
    showCriticalError(message) {
        this.finishCreatureDisplayLoading();
        // MOBILE-RESPONSIVE error message
        const { width, height } = this.scale;
        const centerX = width / 2;
        const fontSize = width < 600 ? 18 : 24;

        const errorText = this.add.text(centerX, height * 0.5, `${message}\n\nPlease refresh the page`, {
            fontSize: `${fontSize}px`,
            color: '#FF4444',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: Math.min(560, width - 32) }
        }).setOrigin(0.5);

        errorText.setDepth(1000);
    }

    createSparkles() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height * 0.45;
        const horizontalSpread = Math.min(100, width * 0.22);
        const verticalSpread = Math.min(80, height * 0.1);
        const sparkles = [];
        for (let i = 0; i < 8; i++) {
            const sparkle = this.add.image(
                centerX + Phaser.Math.Between(-horizontalSpread, horizontalSpread),
                centerY + Phaser.Math.Between(-verticalSpread, verticalSpread),
                'magicalSparkle'
            );
            sparkle.setScale(0);
            sparkles.push(sparkle);

            // Animate sparkles appearing
            this.tweens.add({
                targets: sparkle,
                scale: 1,
                alpha: { from: 0, to: 1 },
                duration: 300,
                delay: i * 100,
                onComplete: () => {
                    // Fade out sparkles
                    this.tweens.add({
                        targets: sparkle,
                        alpha: 0,
                        scale: 0.5,
                        duration: 800,
                        delay: 500,
                        onComplete: () => sparkle.destroy()
                    });
                }
            });
        }
    }

    /**
     * Load hatch cinematics configuration
     */
    async loadHatchConfig() {
        try {
            this.hatchConfig = cloneConfig(hatchCinematicsConfig);
            console.log('cinematic:debug [HatchingScene] Config loaded', this.hatchConfig);
        } catch (error) {
            console.log('cinematic:debug [HatchingScene] Using default config:', error.message);
            this.hatchConfig = null; // Will use defaults
        }
    }

    /**
     * Enhanced hatching sequence with cinematic timing
     */
    async startCinematicHatch() {
        if (!window.HatchCinematics) {
            // Fallback to original hatching
            this.startHatching();
            return;
        }

        try {
            // Initialize hatch cinematics with our config
            if (this.hatchConfig) {
                window.HatchCinematics.initialize(this.hatchConfig);
            }

            console.log('cinematic:info [HatchingScene] Starting cinematic hatch sequence');
            
            // Store references for cinematics system
            if (this.egg) {
                this.egg.name = 'egg';
            }

            // Play the full 8-beat cinematic sequence
            await window.HatchCinematics.play(this, {
                assets: {
                    egg: this.egg,
                    creature: this.creature
                }
            });

            // After cinematics complete, trigger transition
            this.time.delayedCall(1000, () => {
                this.transitionToPersonality();
            });

        } catch (error) {
            console.warn('cinematic:warn [HatchingScene] Cinematics failed, using fallback:', error);
            this.startHatching(); // Fallback to original
        }
    }

    /**
     * Trigger the first emote after naming
     */
    triggerFirstEmote() {
        if (window.HatchCinematics && this.creature) {
            window.HatchCinematics.triggerFirstEmote(this, this.hatchConfig);
        }
    }

    /**
     * Generate unique genetics for this creature with rarity system
     */
    generateCreatureGenetics() {
        if (!this.canCommitHatch()) return false;
        if (!window.CreatureGenetics) {
            console.warn('hatch:warn [HatchingScene] CreatureGenetics system not available');
            return false;
        }

        // Check if RaritySystem is available
        if (!window.raritySystem) {
            console.warn('hatch:warn [HatchingScene] RaritySystem not available, using default generation');
            this.creatureGenetics = window.CreatureGenetics.generateCreatureGenetics();
            this.attachMendelianGenome();
            this.rarityInfo = { name: 'Unknown', emoji: '🔮', displayColor: '#9370DB' };
            return Boolean(this.creatureGenetics);
        }

        // Get pity data from GameState
        const state = getGameState();
        let pityData = cloneConfig(state.get('pitySystem') || null);

        // Initialize pity system if needed
        if (!pityData || typeof pityData.hatchesSinceEpic === 'undefined') {
            pityData = window.raritySystem.initializePitySystem();
        }

        let rarity;

        // Check if in egg hatching mode - use egg-specific rarity rolling
        if (this.isEggHatch && this.eggType) {
            // Use egg-specific rarity (no pity system)
            rarity = window.raritySystem.rollEggRarity(this.eggType);
            console.log(`hatch:info [HatchingScene] 🥚 Egg rarity roll (${this.eggType}): ${rarity}`);

            // Don't update pity for egg hatching - it was already reset
        } else {
            // Roll rarity using pity system (normal flow)
            const rollResult = window.raritySystem.rollRarity(pityData);
            rarity = rollResult.rarity;

            // Keep the updated pity counter with this uncommitted hatch.
            this.hatchPityData = rollResult.pityData;
        }

        // Generate creature with the rolled rarity
        this.creatureGenetics = window.CreatureGenetics.generateCreatureGenetics(rarity);
        this.attachMendelianGenome();

        // Store rarity info for UI
        this.rarityInfo = window.raritySystem.getRarityInfo(rarity);

        // Generate DNA profile (DNA v1)
        if (window.CreatureDNA) {
            this.creatureDNA = window.CreatureDNA.generateDNA({ forcedRarity: rarity });
            this.generatedHatchDNA = this.creatureDNA;

            // DNA and personality stay local until the complete hatch is saved.
            console.log(`hatch:info [HatchingScene] Generated DNA profile:`, {
                id: this.creatureDNA.id,
                body: this.creatureDNA.bodyArchetype,
                head: this.creatureDNA.headArchetype,
                hybrid: this.creatureDNA.hybridTag,
                temperament: this.creatureDNA.temperament,
                rarity: this.creatureDNA.raritySignature
            });

            // Initialize personality shaping system (Personality v1)
            if (window.PersonalitySystem) {
                const personalityState = window.PersonalitySystem.initializePersonalityState(this.creatureDNA);
                this.creaturePersonalityState = personalityState;
                console.log('hatch:info [HatchingScene] Initialized personality shaping system');
            }
        } else {
            console.warn('hatch:warn [HatchingScene] CreatureDNA system not available');
        }

        // Get pity counter info (only available for normal hatching, not egg hatching)
        const pityInfo = this.isEggHatch
            ? 'N/A (egg hatch)'
            : `${pityData.hatchesSinceEpic}/${window.raritySystem.PITY_THRESHOLD}`;

        console.log(`hatch:info [HatchingScene] Generated ${this.creatureGenetics.rarity} ${this.creatureGenetics.species}:`, {
            id: this.creatureGenetics.id,
            personality: this.creatureGenetics.personality.core,
            cosmicElement: this.creatureGenetics.cosmicAffinity.element,
            specialFeatures: this.creatureGenetics.traits.features.specialFeatures?.length || 0,
            pityCounter: pityInfo
        });
        return true;
    }

    /**
     * Create unique creature sprite using GraphicsEngine
     */
    createUniqueCreature(stage = 'baby') {
        console.log('hatch:debug [HatchingScene] createUniqueCreature() called with stage:', stage);

        if (!this.graphicsEngine) {
            console.error('hatch:error [HatchingScene] No graphics engine available!');
            return null;
        }

        // Try DNA-based rendering first (if CreatureDNA is available)
        if (this.creatureDNA && typeof this.graphicsEngine.createCreatureFromDNA === 'function') {
            console.log('hatch:info [HatchingScene] Using DNA-based creature rendering');
            console.log('hatch:debug [HatchingScene] DNA:', {
                id: this.creatureDNA.id,
                body: this.creatureDNA.bodyArchetype,
                head: this.creatureDNA.headArchetype,
                hybrid: this.creatureDNA.hybridTag,
                aura: this.creatureDNA.elementalAura,
                rarity: this.creatureDNA.raritySignature
            });

            try {
                const creatureResult = this.graphicsEngine.createCreatureFromDNA(
                    this.creatureDNA,
                    0,
                    stage,
                    this.creatureGenetics
                );

                if (!creatureResult || !creatureResult.textureName) {
                    console.warn('hatch:warn [HatchingScene] DNA rendering failed, falling back to genetics');
                } else {
                    console.log('hatch:info [HatchingScene] Successfully created DNA-based creature:', creatureResult.textureName);
                    return creatureResult;
                }
            } catch (error) {
                console.error('hatch:error [HatchingScene] DNA rendering error, falling back to genetics:', error);
            }
        }

        // Fallback to genetics-based rendering
        if (!this.creatureGenetics) {
            console.error('hatch:error [HatchingScene] No genetics available!');
            return null;
        }

        console.log('hatch:info [HatchingScene] Using genetics-based creature rendering with stage:', stage);
        console.log('hatch:debug [HatchingScene] Genetics:', {
            id: this.creatureGenetics.id,
            species: this.creatureGenetics.species,
            rarity: this.creatureGenetics.rarity,
            bodyType: this.creatureGenetics.traits?.bodyShape?.type,
            colors: this.creatureGenetics.traits?.colorGenome
        });

        try {
            // Ensure graphics engine has necessary methods
            if (typeof this.graphicsEngine.createRandomizedSpaceMythicCreature !== 'function') {
                console.error('hatch:error [HatchingScene] GraphicsEngine missing createRandomizedSpaceMythicCreature method');
                return null;
            }

            console.log('hatch:debug [HatchingScene] Calling createRandomizedSpaceMythicCreature with stage:', stage);

            // Use the GraphicsEngine to create a randomized creature with the specified stage
            const creatureResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                this.creatureGenetics,
                0, // frame 0
                stage // lifecycle stage (baby, juvenile, adult, elder)
            );

            console.log('hatch:debug [HatchingScene] createRandomizedSpaceMythicCreature returned:', creatureResult);

            // Validate the result
            if (!creatureResult || !creatureResult.textureName) {
                console.error('hatch:error [HatchingScene] Graphics engine returned invalid result:', creatureResult);
                return null;
            }

            console.log('hatch:info [HatchingScene] Successfully created creature texture:', creatureResult.textureName);
            return creatureResult;
        } catch (error) {
            console.error('hatch:error [HatchingScene] Failed to create unique creature:', error);
            console.error('hatch:error [HatchingScene] Error message:', error.message);
            console.error('hatch:error [HatchingScene] Stack trace:', error.stack);
            return null;
        }
    }

    attachMendelianGenome() {
        if (!this.creatureGenetics || !window.BreedingEngine?.resolveCreatureGenes) {
            return;
        }
        this.creatureGenetics.mendelianGenes =
            window.BreedingEngine.resolveCreatureGenes({
                id: this.creatureGenetics.id,
                genes: this.creatureGenetics
            });
    }

    /**
     * Add cute idle animations for baby creatures
     * Based on cartoon animation principles: breathing, bobbing, squash & stretch
     * @param {Phaser.GameObjects.Image} creature - The creature sprite
     * @param {number} baseScale - The base scale of the creature
     */
    addCuteIdleAnimations(creature, baseScale) {
        if (!creature) return;
        (this.creatureIdleTweens || []).forEach(tween => tween.remove());
        this.creatureIdleBounceTimer?.remove?.();
        this.creatureIdleSparkleTimer?.remove?.();
        this.creatureIdleReactionTween?.remove?.();
        this.creatureIdleBounceTimer = null;
        this.creatureIdleSparkleTimer = null;
        this.creatureIdleReactionTween = null;
        this.creatureIdleTweens = [];
        baseScale = this.getFirstContactLayout(Boolean(this.rerollUI)).creatureScale;
        creature.setScale(baseScale);

        const stage = window.GameState?.get('creature.lifecycle.stage') || 'baby';

        // Only add extra cute animations for babies
        const isBaby = stage === 'baby';
        const breathingIntensity = isBaby ? 0.05 : 0.02;
        const bobbingAmplitude = isBaby ? 8 : 3;
        const breathingDuration = isBaby ? 1500 : 2500;

        console.log('hatch:info [HatchingScene] Adding cute idle animations for stage:', stage);

        // Breathing animation - gentle scale oscillation (squash/stretch)
        this.creatureIdleTweens.push(this.tweens.add({
            targets: creature,
            scaleX: baseScale * (1 + breathingIntensity),
            scaleY: baseScale * (1 - breathingIntensity * 0.5),
            duration: breathingDuration,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        }));

        // Bobbing animation - gentle up/down movement
        this.creatureIdleTweens.push(this.tweens.add({
            targets: creature,
            y: creature.y - bobbingAmplitude,
            duration: breathingDuration * 1.3,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: 200 // Slight offset from breathing for natural feel
        }));

        // For babies, add occasional cute reactions
        if (isBaby) {
            // Random "excited" bounce every 5-8 seconds
            this.creatureIdleBounceTimer = this.time.addEvent({
                delay: 5000 + Math.random() * 3000,
                callback: () => {
                    if (!creature || !creature.active) return;

                    // Quick excited bounce
                    this.creatureIdleReactionTween = this.tweens.add({
                        targets: creature,
                        scaleX: baseScale * 1.15,
                        scaleY: baseScale * 0.85,
                        duration: 100,
                        ease: 'Quad.easeOut',
                        yoyo: true,
                        onComplete: () => {
                            // Rebound stretch
                            this.creatureIdleReactionTween = this.tweens.add({
                                targets: creature,
                                scaleX: baseScale * 0.92,
                                scaleY: baseScale * 1.08,
                                duration: 100,
                                ease: 'Quad.easeOut',
                                yoyo: true
                            });
                        }
                    });

                    // Play cute sound
                    if (window.AudioManager && Math.random() > 0.5) {
                        window.AudioManager.playBabyChirp();
                    }
                },
                loop: true
            });

            // Add sparkle particles around baby periodically
            if (window.FXLibrary) {
                this.creatureIdleSparkleTimer = this.time.addEvent({
                    delay: 3000,
                    callback: () => {
                        if (!creature || !creature.active) return;
                        window.FXLibrary.stardustBurst(this, creature.x, creature.y, {
                            count: 3,
                            color: [0xFFB6C1, 0xFFFFFF, 0x87CEEB],
                            duration: 1500
                        });
                    },
                    loop: true
                });
            }
        }
    }

    /**
     * Add visual effects based on creature genetics
     */
    addGeneticEffects() {
        if (!this.creatureGenetics || !this.creature) return;

        const genetics = this.creatureGenetics;
        const creature = this.creature;

        // Add cosmic affinity-based particle effects
        if (window.FXLibrary && genetics.cosmicAffinity.powerLevel > 0.6) {
            const element = genetics.cosmicAffinity.element;
            
            // Different effects based on cosmic element
            switch (element) {
                case 'star':
                    window.FXLibrary.stardustBurst(this, creature.x, creature.y, {
                        count: 6,
                        color: [0xFFD54F, 0xF5F5F5],
                        duration: 2000
                    });
                    break;
                case 'nebula':
                    window.FXLibrary.auroraPass(this, {
                        strips: 1,
                        colors: [0xF48FB1, 0x64B5F6]
                    });
                    break;
                case 'crystal':
                    window.FXLibrary.biolumePulse(creature, {
                        color: 0xB39DDB,
                        intensity: { min: 0.3, max: 0.7 }
                    });
                    break;
            }
        }

        // Add personality-based subtle effects
        if (genetics.personality.core === 'energetic') {
            // Gentle bounce animation
            this.tweens.add({
                targets: creature,
                y: creature.y - 5,
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }

        // Add rarity-based glow
        if (genetics.rarity === 'legendary') {
            // Golden legendary glow
            this.tweens.add({
                targets: creature,
                alpha: 0.8,
                duration: 1500,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }

    captureHatchSaveOwner() {
        const state = getGameState();
        const cloud = window.CloudSave;
        const epoch = state.getSaveAdmission().epoch;
        const campaignGuard = cloud?.captureCampaignGuard?.() || (() => true);
        this.hatchSaveOwner = { state,
            reservation: cloneConfig(state.get('creature.hatchTransaction') || null),
            activeIdentity: state.getHatchActiveIdentity(),
            ownsUpload: lease => state === window.GameState && cloud === window.CloudSave &&
                cloud?.gameState === state && cloud?.activeCloudWrite === lease && campaignGuard(),
            isCurrent: () => !this.hatchSceneRetired && state === window.GameState && cloud === window.CloudSave &&
                state.getSaveAdmission().epoch === epoch && campaignGuard() };
    }

    canCommitHatch() {
        const owner = this.hatchSaveOwner;
        return Boolean(owner?.isCurrent() && owner.state.canCommitHatchSave() &&
            owner.state.getHatchActiveIdentity() === owner.activeIdentity);
    }

    saveCreatureGenetics(onSaved = () => {}) {
        let attempt = this.hatchCommitAttempt;
        const sameAttempt = attempt?.genetics === this.creatureGenetics;
        const owner = this.hatchSaveOwner;
        if (!this.creatureGenetics?.id || !owner?.isCurrent() ||
            (!sameAttempt && owner.state.getHatchActiveIdentity() !== owner.activeIdentity)) {
            this.showHatchSaveRecovery();
            return false;
        }
        if (!attempt || attempt.genetics !== this.creatureGenetics) {
            attempt = { genetics: this.creatureGenetics, owner: this.hatchSaveOwner,
                profile: cloneConfig({ genetics: this.creatureGenetics,
                    dna: this.generatedHatchDNA !== undefined ? this.generatedHatchDNA : this.creatureDNA || undefined,
                    personalityState: this.creaturePersonalityState,
                    pitySystem: this.hatchPityData, rerollSystem: this.hatchRerollData,
                    textureName: this.creature?.texture?.key || `creature_${this.creatureGenetics.id}_0`,
                    descriptiveName: this.generateCreatureName(), spawnPosition: this.spawnPosition }),
                onSaved, saving: false, complete: false };
            this.hatchCommitAttempt = attempt;
        }
        return this.retryHatchCommit(attempt);
    }

    retryHatchCommit(attempt = this.hatchCommitAttempt, { probeStorage = false } = {}) {
        if (!attempt || attempt !== this.hatchCommitAttempt || attempt.saving ||
            attempt.owner !== this.hatchSaveOwner || !attempt.owner.isCurrent()) return false;
        const state = attempt.owner.state;
        if (probeStorage && state.storageMode === 'memory') state.checkStorageAvailability();
        if (!attempt.complete && !state.canCommitHatchSave()) { this.showHatchSaveRecovery(); return false; }
        attempt.saving = true;
        try {
            if (!attempt.complete) {
                const result = state.commitCreatureHatch(attempt.profile, {
                    isInventoryHatch: this.isEggHatch, expectedReservation: attempt.owner.reservation,
                    expectedActiveIdentity: attempt.owner.activeIdentity,
                    isCurrentUpload: attempt.owner.ownsUpload,
                    isCurrentCampaign: () => attempt === this.hatchCommitAttempt &&
                        attempt.owner.isCurrent() && attempt.genetics === this.creatureGenetics
                });
                if (!result.success) { this.showHatchSaveRecovery(); return false; }
                attempt.complete = true;
                attempt.isCurrent = result.isCurrent;
                attempt.owner.activeIdentity = state.getHatchActiveIdentity();
            }
            this.clearHatchSaveRecovery();
            if (!attempt.owner.isCurrent() || !attempt.isCurrent()) return false;
            if (!attempt.continuationComplete) {
                attempt.onSaved();
                attempt.continuationComplete = true;
            }
            return attempt.owner.isCurrent() && attempt.isCurrent();
        } catch (error) {
            console.warn('[HatchingScene] Hatch commit paused:', error);
            this.showHatchSaveRecovery();
            return false;
        } finally { attempt.saving = false; }
    }

    clearHatchSaveRecovery() {
        this.hatchSaveRecovery?.remove();
        this.hatchSaveRecovery = null;
    }

    showHatchSaveRecovery(retryEntry = null) {
        if (!this.hatchSaveOwner?.isCurrent()) return;
        this.clearHatchSaveRecovery();
        const overlay = document.createElement('div');
        overlay.className = 'save-recovery-gate';
        overlay.dataset.mythicalHatchSave = 'true';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Hatch paused');
        const panel = document.createElement('section');
        const title = document.createElement('h1'); title.textContent = 'Hatch paused';
        const text = document.createElement('p');
        text.textContent = 'We could not save your creature yet. Keep this page open and try again.';
        panel.append(title, text); overlay.append(panel);
        if ((this.hatchCommitAttempt || retryEntry) && this.hatchSaveOwner.state.getSaveAdmission().status === 'ready') {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = retryEntry ? 'Try again' : 'Try saving again';
            const attempt = this.hatchCommitAttempt;
            button.addEventListener('click', () => {
                if (overlay !== this.hatchSaveRecovery) return;
                if (retryEntry) {
                    if (!this.hatchSaveOwner?.isCurrent()) return;
                    if (this.hatchSaveOwner.state.storageMode === 'memory') this.hatchSaveOwner.state.checkStorageAvailability();
                    if (!this.canCommitHatch()) { this.showHatchSaveRecovery(retryEntry); return; }
                    this.clearHatchSaveRecovery();
                    retryEntry();
                } else this.retryHatchCommit(attempt, { probeStorage: true });
            });
            panel.append(button);
            overlay.addEventListener('keydown', event => {
                if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
            });
        } else text.textContent = 'Your saved game needs checking. Keep this page open and ask a grown-up to help.';
        this.hatchSaveRecovery = overlay;
        document.body.append(overlay);
        panel.querySelector('button')?.focus();
    }

    /**
     * Generate a Space-Mythic descriptive name based on genetics
     */
    generateCreatureName() {
        if (!this.creatureGenetics) return 'Cosmic Friend';

        const genetics = this.creatureGenetics;
        
        // Create descriptive name parts
        const elementPrefix = {
            star: 'Stellar',
            moon: 'Lunar', 
            nebula: 'Nebula',
            crystal: 'Crystal',
            void: 'Void'
        };

        const personalityType = {
            curious: 'Explorer',
            playful: 'Dancer',
            gentle: 'Whisperer', 
            wise: 'Sage',
            energetic: 'Spark'
        };

        const speciesSuffix = {
            stellarWyrm: 'Wyrm',
            crystalDrake: 'Drake',
            nebulaSprite: 'Sprite'
        };

        const prefix = elementPrefix[genetics.cosmicAffinity.element] || 'Cosmic';
        const middle = personalityType[genetics.personality.core] || 'Friend';
        const suffix = speciesSuffix[genetics.species] || 'Being';

        return `${prefix} ${middle} ${suffix}`;
    }

    /**
     * Transition to personality scene
     */
    transitionToPersonality() {
        // Genetics persistence commits the hatch before this transition.
        const state = getGameState();
        const attempt = this.hatchCommitAttempt;
        if (!attempt?.complete || !attempt.owner.isCurrent() || !attempt.isCurrent() ||
            !state.get('creature.hatched') || !state.get('creature.genes')?.id) {
            console.error('[HatchingScene] Blocked transition without a committed creature identity');
            this.showHatchSaveRecovery();
            return;
        }

        // Fade transition - responsive to screen size
        const { width, height } = this.scale;
        const fadeGraphics = this.add.graphics();
        fadeGraphics.fillStyle(0x000000, 0);
        fadeGraphics.fillRect(0, 0, width, height);

        this.tweens.add({
            targets: fadeGraphics,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                if (!attempt.owner.isCurrent() || !attempt.isCurrent()) return;
                this.scene.start('SoulRevealScene');
            }
        });
    }

    /**
     * Create audio indicator with mute/unmute toggle
     */
    createAudioIndicator() {
        const width = this.cameras.main.width;
        const isMobile = width < 600;

        // Position in top-right corner
        const x = width - (isMobile ? 50 : 70);
        const y = isMobile ? 30 : 40;
        const size = isMobile ? 40 : 50;

        // Create background circle
        this.audioIndicatorBg = this.add.graphics();
        this.audioIndicatorBg.setPosition(x, y);
        this.audioIndicatorBg.fillStyle(0x2A0A4E, 0.8);
        this.audioIndicatorBg.fillCircle(0, 0, size / 2);
        this.audioIndicatorBg.lineStyle(2, 0x7B68EE);
        this.audioIndicatorBg.strokeCircle(0, 0, size / 2);
        this.audioIndicatorBg.setDepth(1000);

        // Create audio icon (speaker with waves)
        this.audioIcon = this.add.text(x, y, '🔊', {
            fontSize: isMobile ? '24px' : '28px'
        }).setOrigin(0.5).setDepth(1001);

        // Pulsing animation for audio waves
        this.tweens.add({
            targets: this.audioIcon,
            scale: { from: 1, to: 1.1 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Make it interactive
        const hitArea = new Phaser.Geom.Circle(0, 0, size / 2);
        this.audioIcon.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

        // Toggle mute on click
        this.audioIcon.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.toggleMute();
                const isMuted = window.AudioManager.muted;
                this.audioIcon.setText(isMuted ? '🔇' : '🔊');

                // Play feedback sound if unmuting
                if (!isMuted && window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }

                console.log(`[HatchingScene] Audio ${isMuted ? 'muted' : 'unmuted'}`);
            }
        });

        // Hover effect
        this.audioIcon.on('pointerover', () => {
            this.audioIndicatorBg.clear();
            this.audioIndicatorBg.fillStyle(0x4A0080, 1);
            this.audioIndicatorBg.fillCircle(0, 0, size / 2);
            this.audioIndicatorBg.lineStyle(3, 0xFFD700);
            this.audioIndicatorBg.strokeCircle(0, 0, size / 2);
        });

        this.audioIcon.on('pointerout', () => {
            this.audioIndicatorBg.clear();
            this.audioIndicatorBg.fillStyle(0x2A0A4E, 0.8);
            this.audioIndicatorBg.fillCircle(0, 0, size / 2);
            this.audioIndicatorBg.lineStyle(2, 0x7B68EE);
            this.audioIndicatorBg.strokeCircle(0, 0, size / 2);
        });

        // Update icon based on current mute state
        if (window.AudioManager && window.AudioManager.muted) {
            this.audioIcon.setText('🔇');
        }

        console.log('[HatchingScene] ✅ Audio indicator created');
    }

    /**
     * FIX #5: Scene cleanup to prevent duplication on restart
     * Called automatically by Phaser when scene stops/restarts
     * ENHANCED: Now includes complete cleanup of all scene elements
     */
    shutdown() {
        console.log('🧹 HatchingScene.shutdown() - Cleaning up scene resources');
        this.hatchSceneRetired = true;
        this.openingStartAttempt = null;
        this.hatchCommitAttempt = null;
        this.clearHatchSaveRecovery();
        this.finishCreatureDisplayLoading();
        this.portraitPromise = null;
        this.stopThemeMusic(true);
        this.themeMusicSettingsCleanup?.();
        this.themeMusicSettingsCleanup = null;
        this.events.off(Phaser.Scenes.Events.RESUME, this.startThemeMusic, this);
        this.scale?.off?.('resize', this.resizeHatchingLayout, this);
        this.creatureIdleTweens = [];
        this.creatureIdleBounceTimer = null;
        this.creatureIdleSparkleTimer = null;
        this.creatureIdleReactionTween = null;

        this.homeStartRecoveryTimer?.remove?.();
        this.homeStartRecoveryTimer = null;
        this.eggHatchReadyTimer?.remove?.();
        this.eggHatchReadyTimer = null;
        this.eggHatchReadyAt = 0;
        this.removeEggHatchFallback();
        this.removeHomeStartFallback();

        // 1. Clean up tap to hatch text
        if (this.tapToHatchText) {
            this.tweens.killTweensOf(this.tapToHatchText);
            this.tapToHatchText.destroy();
            this.tapToHatchText = null;
        }

        // 2. Clean up egg
        if (this.egg) {
            this.tweens.killTweensOf(this.egg);
            this.egg.destroy();
            this.egg = null;
        }

        // 3. Clean up creature
        if (this.creature) {
            this.tweens.killTweensOf(this.creature);
            this.creature.destroy();
            this.creature = null;
        }

        // 4. Clean up clouds group
        if (this.clouds) {
            this.clouds.clear(true, true);
            this.clouds = null;
        }

        // 5. Clean up stardust particles (added for responsive fix)
        if (this.stardustParticles && Array.isArray(this.stardustParticles)) {
            this.stardustParticles.forEach(particle => {
                if (particle) {
                    this.tweens.killTweensOf(particle);
                    particle.destroy();
                }
            });
            this.stardustParticles = [];
        }

        // 6. Clean up background stars
        if (this.backgroundStars && Array.isArray(this.backgroundStars)) {
            this.backgroundStars.forEach(star => {
                if (star) {
                    this.tweens.killTweensOf(star);
                    star.destroy();
                }
            });
            this.backgroundStars = [];
        }

        // 6b. Clean up cosmic platform and particles
        if (this.cosmicPlatform) {
            this.tweens.killTweensOf(this.cosmicPlatform);
            this.cosmicPlatform.destroy();
            this.cosmicPlatform = null;
        }
        if (this.platformParticles && Array.isArray(this.platformParticles)) {
            this.platformParticles.forEach(particle => {
                if (particle) {
                    this.tweens.killTweensOf(particle);
                    particle.destroy();
                }
            });
            this.platformParticles = [];
        }

        // 7. Clean up UI elements
        if (this.instructionText) {
            this.instructionText.destroy();
            this.instructionText = null;
        }

        if (this.progressText) {
            this.progressText.destroy();
            this.progressText = null;
        }

        // 8. Clean up tutorial elements
        if (this.tutorialPointer) {
            this.tweens.killTweensOf(this.tutorialPointer);
            this.tutorialPointer.destroy();
            this.tutorialPointer = null;
        }

        if (this.tutorialHintText) {
            this.tweens.killTweensOf(this.tutorialHintText);
            this.tutorialHintText.destroy();
            this.tutorialHintText = null;
        }

        // 9. Clean up reroll UI elements
        this.cleanupRerollUI();

        // 10. Remove keyboard listeners
        if (this.input && this.input.keyboard) {
            this.input.keyboard.off('keydown-SPACE');
            this.input.keyboard.off('keydown-ESC');
        }

        // 11. Clear all remaining timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // 12. Kill all remaining tweens (catch-all)
        if (this.tweens) {
            this.tweens.killAll();
        }

        // 13. Clean up graphics engine
        if (this.graphicsEngine) {
            this.graphicsEngine = null;
        }

        // 14. Reset scene state flags
        this.hatchingProgress = 0;
        this.isHatching = false;
        this.hatchingStarted = false;
        this.creatureAppeared = false;
        this.creatureGenetics = null;
        this.creatureDNA = null;
        this.rarityInfo = null;

        console.log('✅ HatchingScene cleanup complete');
    }

    update(time) {
        if (
            this.homeContentReady &&
            time >= this.nextHomeStartHealthCheck &&
            !getGameState().get('session.gameStarted')
        ) {
            this.nextHomeStartHealthCheck = time + 500;
            this.ensureHomeStartReady();
        }

        // Keyboard and touch share the same hatch, identity and rarity reveal.
        if (
            this.spaceKey &&
            Date.now() >= this.eggHatchReadyAt &&
            Phaser.Input.Keyboard.JustDown(this.spaceKey)
        ) {
            if (this.egg && !this.isHatching && !this.creatureAppeared) {
                this.activateEggHatch();
            } else if (this.creatureAppeared) {
                this.transitionToPersonality();
            }
        }
    }

    getEggHatchLayout() {
        const { width, height } = this.scale;
        const landscape = width > height && height < 600;
        return {
            landscape, textX: landscape ? width * 0.27 : width / 2,
            textWidth: landscape ? width * 0.48 - 24 : Math.min(600, width - 40),
            titleY: landscape ? 32 : Math.min(60, height * 0.08),
            eggX: landscape ? width * 0.75 : width / 2,
            eggY: height * (landscape ? 0.46 : 0.48),
            eggScale: Math.min(1.2, height * (landscape ? 0.40 : 0.29) / 150),
            platformY: height * (landscape ? 0.74 : 0.67),
            promptY: height * (landscape ? 0.81 : 0.75),
            hintY: landscape ? height - 28 : height * 0.9
        };
    }

    layoutHatchPlatform(x, y) {
        const origin = this.hatchPlatformOrigin;
        if (!origin || !this.cosmicPlatform?.active) return;
        const landscape = this.scale.width > this.scale.height && this.scale.height < 600;
        const size = Math.min(1, this.scale.width * (landscape ? 0.35 : 0.9) / 280);
        this.cosmicPlatform.setScale(size).setPosition(x - origin.x * size, y - origin.y * size);
        (this.platformParticles || []).forEach((particle, index) => {
            this.tweens.killTweensOf(particle);
            const angle = index / 8 * Math.PI * 2;
            particle.setPosition(x + Math.cos(angle) * 90 * size, y + Math.sin(angle) * 15 * size);
        });
    }

    resizeHatchingLayout() {
        if (this.hatchSceneRetired) return;
        const { width, height } = this.scale;
        if (width <= 0 || height <= 0) return;
        const background = this.projectBeaconBackground;
        if (background?.active) {
            background.setPosition(width / 2, height / 2)
                .setScale(Math.max(width / background.width, height / background.height));
        }
        [this.projectBeaconBackgroundFallback, this.projectBeaconContrastVeil].forEach(rect => {
            if (rect?.active) rect.setPosition(width / 2, height / 2).setSize(width, height);
        });
        if (this.projectBeaconMotionBackdrop?.active) {
            this.projectBeaconMotionBackdrop.setPosition(width < 600 ? width * 0.92 : width * 0.65, height / 2)
                .setDisplaySize(Math.max(width, height * 16 / 9), Math.max(height, width * 9 / 16));
        }
        if (this.audioIcon?.active) {
            this.audioIcon.setPosition(width - 32, 32);
            this.audioIndicatorBg.setPosition(width - 32, 32);
        }
        if (this.creatureAppeared) {
            this.resizeFirstContactLayout();
            return;
        }
        if (!this.egg?.active) return;
        const layout = this.getEggHatchLayout();
        const positionText = (text, x, y, fontSize, wrap) => {
            if (text?.active) text.setPosition(x, y).setFontSize(fontSize).setWordWrapWidth(wrap);
        };
        positionText(this.hatchTitleText, layout.textX, layout.titleY,
            Math.min(30, (layout.textWidth - 40) / 8.5), layout.textWidth - 32);
        positionText(this.hatchSubtitleText, layout.textX, layout.titleY + 34, 14, layout.textWidth);
        positionText(this.instructionText, layout.textX, layout.landscape ? height * 0.43 : layout.titleY + 100,
            16, layout.textWidth);
        if (this.tapToHatchText?.active) {
            this.tweens.killTweensOf(this.tapToHatchText);
            this.tapToHatchText.setScale(1);
            positionText(this.tapToHatchText, layout.textX, layout.promptY,
                Math.min(24, layout.textWidth / 13), layout.textWidth);
        }
        positionText(this.progressText, layout.textX, layout.promptY, 22, layout.textWidth);
        positionText(this.tutorialHintText, layout.eggX, layout.hintY, layout.landscape ? 14 : 16,
            layout.landscape ? width * 0.42 : width - 72);
        Object.values(this.controlPanelElements || {}).forEach(element => element?.setVisible(false));
        this.layoutHatchPlatform(layout.eggX, layout.platformY);

        // Only replace decorative motion. The hatch timer, DNA, input delay and
        // completion fade retain their owners and are never restarted by resize.
        if (!this.hatchingStarted || this.isHatching) {
            this.tweens.killTweensOf(this.egg);
            this.egg.setPosition(layout.eggX, layout.eggY).setScale(layout.eggScale);
            this.tweens.add({ targets: this.egg, y: layout.eggY - 8, duration: 2000,
                ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
            if (this.isHatching) this.tweens.add({ targets: this.egg, x: layout.eggX + 5,
                duration: 100, ease: 'Power2', yoyo: true, repeat: -1 });
        } else {
            this.egg.setPosition(layout.eggX, layout.eggY);
        }
        if (this.eggHatchFallback) {
            this.eggHatchFallback.style.left = `${layout.eggX / width * 100}%`;
            this.eggHatchFallback.style.top = `${layout.eggY / height * 100}%`;
            this.eggHatchFallback.style.width = `${Math.max(150, 150 * layout.eggScale + 24)}px`;
        }
        if (this.stellarGlow?.active && this.hatchEggOrigin) {
            this.stellarGlow.setPosition(layout.eggX - this.hatchEggOrigin.x, layout.eggY - this.hatchEggOrigin.y);
            (this.stellarParticles || []).forEach((particle, index) => {
                this.tweens.killTweensOf(particle);
                const angle = index / 12 * Math.PI * 2;
                particle.setPosition(layout.eggX + Math.cos(angle) * 70, layout.eggY + Math.sin(angle) * 70);
            });
        }
        if (this.tutorialPointer?.active && !this.hatchingStarted) {
            this.tweens.killTweensOf(this.tutorialPointer);
            this.tutorialPointer.destroy();
            this.tutorialPointer = null;
            this.createTutorialPointer();
        }
    }

    resizeFirstContactLayout() {
        if (!this.creature?.active || this.hatchSceneRetired) return;
        const canReroll = Boolean(this.rerollUI);
        const layout = this.getFirstContactLayout(canReroll);
        const { centerX, bannerY, bannerHeight, bannerWidth, buttonY, buttonWidth, buttonHeight, buttonGap } = layout;
        this.applyFirstContactCreaturePresentation(this.creature, layout);
        if (this.creatureIdleTweens?.length) {
            this.addCuteIdleAnimations(this.creature, layout.creatureScale);
        } else {
            // Update the destination of an in-flight reveal without cancelling
            // its completion callback or creating another reveal.
            for (const tween of this.tweens.getTweensOf(this.creature)) {
                tween.updateTo('scaleX', layout.creatureScale, true);
                tween.updateTo('scaleY', layout.creatureScale, true);
            }
        }
        const banner = this.rarityBanner;
        if (banner) {
            banner.bannerBg.clear().fillStyle(0x03151a, 0.66)
                .fillRoundedRect(centerX - bannerWidth / 2, bannerY, bannerWidth, bannerHeight, 8)
                .lineStyle(1, parseInt(this.rarityInfo.displayColor.replace('#', '0x')), 0.8)
                .strokeRoundedRect(centerX - bannerWidth / 2, bannerY, bannerWidth, bannerHeight, 8);
            banner.eyebrowText.setPosition(centerX, bannerY + 16);
            banner.rarityText.setPosition(centerX, bannerY + bannerHeight * 0.43)
                .setFontSize(layout.isCompact ? 17 : 21).setWordWrapWidth(bannerWidth - 24);
            banner.speciesText.setPosition(centerX, bannerY + bannerHeight * 0.75)
                .setFontSize(layout.isCompact ? 12 : 14).setWordWrapWidth(bannerWidth - 28);
        }
        const moveButton = (ui, prefix, x, colour, border, dimsKey) => {
            if (!ui) return;
            const dims = { x, y: buttonY, w: buttonWidth, h: buttonHeight };
            this[dimsKey] = dims;
            ui[`${prefix}Bg`].clear().fillStyle(colour, 0.96)
                .fillRoundedRect(x, buttonY, buttonWidth, buttonHeight, 8)
                .lineStyle(2, border).strokeRoundedRect(x, buttonY, buttonWidth, buttonHeight, 8);
            ui[`${prefix}Text`].setPosition(x + buttonWidth / 2, buttonY + buttonHeight / 2)
                .setFontSize(layout.isCompact ? 12 : 16);
            ui[`${prefix}Zone`].setPosition(x, buttonY).setSize(buttonWidth, buttonHeight);
        };
        moveButton(this.keepUI, 'keep', canReroll ? centerX - buttonWidth - buttonGap / 2 : centerX - buttonWidth / 2,
            0x146b55, 0xFFD54F, this.finalText ? 'finalKeepButtonDims' : 'keepButtonDims');
        moveButton(this.rerollUI, 'reroll', centerX + buttonGap / 2, 0x273c74, 0x8FE3D4, 'rerollButtonDims');
        this.adviceText?.setPosition(centerX, layout.scanY).setFontSize(12).setWordWrapWidth(layout.guidanceWidth);
        this.finalText?.setPosition(centerX, layout.guidanceY).setFontSize(13).setWordWrapWidth(layout.guidanceWidth);
        if (this.firstContactGuidance) {
            const { guidanceBg, tutorialHint } = this.firstContactGuidance;
            guidanceBg.clear().fillStyle(0x04171b, 0.72)
                .fillRoundedRect(centerX - layout.guidanceWidth / 2, layout.guidanceY - 24, layout.guidanceWidth, 48, 8);
            tutorialHint.setPosition(centerX, layout.guidanceY).setFontSize(12).setWordWrapWidth(layout.guidanceWidth - 24);
        }
    }

    getFirstContactLayout(canReroll = true) {
        const { width, height } = this.scale;
        if (height < 600) {
            const landscape = width > height;
            const contentWidth = landscape ? width * 0.60 : width;
            const bannerHeight = landscape ? 98 : 108;
            const buttonY = height - 66;
            const scanY = canReroll ? buttonY - 32 : null;
            const guidanceY = (scanY || buttonY) - 50;
            const creatureY = landscape ? height * 0.48 : (120 + guidanceY - 36) / 2;
            const creatureRoom = landscape ? height * 0.54 : guidanceY - 164;
            const creatureScale = Math.min(2, creatureRoom / 160, (landscape ? width * 0.32 : width - 40) / 160);
            return { width, height, isCompact: true, centerX: contentWidth / 2,
                creatureX: landscape ? width * 0.80 : width / 2,
                bannerY: 12, bannerWidth: contentWidth - 24, bannerHeight,
                creatureY, creatureScale, platformY: creatureY + creatureRoom / 2,
                guidanceY, guidanceWidth: contentWidth - 30, scanY, buttonY,
                buttonHeight: 50, buttonGap: 12,
                buttonWidth: canReroll ? Math.min(190, (contentWidth - 44 - 12) / 2) : Math.min(240, contentWidth - 44) };
        }
        const isCompact = width < 600;
        const bannerY = Math.max(isCompact ? 22 : 28, height * 0.04);
        const bannerHeight = isCompact ? 108 : 98;
        const creatureY = Phaser.Math.Clamp(
            height * (isCompact ? 0.395 : 0.405),
            bannerY + bannerHeight + (isCompact ? 145 : 175),
            height * 0.48
        );
        const platformY = creatureY + (isCompact ? 145 : 162);
        const guidanceY = platformY + (isCompact ? 58 : 60);
        const scanY = canReroll ? guidanceY + (isCompact ? 61 : 58) : null;
        const buttonHeight = isCompact ? 56 : 54;
        const buttonY = Math.min(
            canReroll ? scanY + (isCompact ? 49 : 46) : guidanceY + 48,
            height - buttonHeight - (isCompact ? 26 : 32)
        );
        const buttonGap = isCompact ? 12 : 20;
        const buttonWidth = canReroll
            ? Math.min(isCompact ? 166 : 190, (width - 44 - buttonGap) / 2)
            : Math.min(isCompact ? 250 : 240, width - 44);

        return {
            width,
            height,
            isCompact,
            centerX: width / 2,
            bannerY,
            bannerWidth: Math.min(width - (isCompact ? 22 : 48), 620),
            bannerHeight,
            creatureY,
            creatureScale: isCompact ? Math.min(3.05, width / 125) : 3.15,
            platformY,
            guidanceY,
            guidanceWidth: Math.min(width - (isCompact ? 30 : 56), 620),
            scanY,
            buttonY,
            buttonHeight,
            buttonGap,
            buttonWidth
        };
    }

    applyFirstContactCreaturePresentation(creature, layout) {
        if (!creature) return;

        creature.setPosition(layout.creatureX ?? layout.centerX, layout.creatureY);
        creature.setBlendMode(Phaser.BlendModes.SCREEN);
        creature.clearMask?.(true);

        this.layoutHatchPlatform(layout.creatureX ?? layout.centerX, layout.platformY);
    }

    /**
     * Show rarity announcement banner
     */
    showRarityReveal() {
        try {
            if (!this.creatureGenetics || !this.rarityInfo) {
                console.error('hatch:error [HatchingScene] Missing genetics or rarity info for reveal');
                return;
            }

            if (!this.creatureGenetics.rarity) {
                console.error('hatch:error [HatchingScene] Creature genetics missing rarity field');
                return;
            }

            const rarity = this.creatureGenetics.rarity;
            const rarityInfo = this.rarityInfo;

            // MOBILE-RESPONSIVE rarity banner
            const canReroll = this.isEggHatch
                ? false
                : Boolean(window.rerollSystem?.canReroll?.());
            const layout = this.getFirstContactLayout(canReroll);
            const {
                centerX,
                isCompact,
                bannerWidth,
                bannerHeight,
                bannerY
            } = layout;
            const bannerX = centerX - (bannerWidth / 2);

            // Responsive font sizes
            const titleSize = isCompact ? 17 : 21;
            const subtitleSize = isCompact ? 12 : 14;

            // The classification result owns the header area while this decision is open.
            [this.hatchTitleText, this.hatchSubtitleText, this.instructionText, this.progressText]
                .forEach(element => element?.setVisible(false));
            if (this.tutorialHintText) {
                this.tweens.killTweensOf(this.tutorialHintText);
                this.tutorialHintText.destroy();
                this.tutorialHintText = null;
            }

            // Create banner background
            const bannerBg = this.add.graphics();
            bannerBg.fillStyle(0x03151a, 0.66);
            bannerBg.fillRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 8);
            bannerBg.lineStyle(1, parseInt(rarityInfo.displayColor.replace('#', '0x')), 0.8);
            bannerBg.strokeRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 8);

            const eyebrowText = this.add.text(centerX, bannerY + (isCompact ? 17 : 16), 'FIELD CLASSIFICATION', {
                fontSize: `${isCompact ? 10 : 11}px`,
                color: '#8FE3D4',
                fontStyle: 'bold',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif'
            }).setOrigin(0.5);

            // Use the plain-language classification supplied by the rarity config.
            const rarityLabel = rarityInfo.displayName || `${rarityInfo.name} Life Form`;
            const rarityText = this.add.text(centerX, bannerY + (bannerHeight * 0.43), rarityLabel.toUpperCase(), {
                fontSize: `${titleSize}px`,
                color: rarityInfo.displayColor,
                fontStyle: 'bold',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            // One readable field line: rarity, organism family and temperament.
            const formatFieldTerm = value => String(value || 'unknown')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/[_-]+/g, ' ')
                .replace(/\b\w/g, letter => letter.toUpperCase());
            const specialFeature = this.creatureGenetics.traits?.features?.specialFeatures?.[0]?.type ||
                this.creatureGenetics.traits?.features?.wackyMutations?.[0]?.type ||
                this.creatureGenetics.cosmicAffinity?.element ||
                this.creatureGenetics.personality?.core;
            const speciesText = this.add.text(centerX, bannerY + (bannerHeight * 0.75), `${formatFieldTerm(this.creatureGenetics.species)} · ${formatFieldTerm(this.creatureGenetics.personality?.core)}\nGENETIC TRAIT · ${formatFieldTerm(specialFeature)}`, {
                fontSize: `${subtitleSize}px`,
                color: '#FFFFFF',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
                align: 'center',
                wordWrap: { width: bannerWidth - 28 }
            }).setOrigin(0.5);

            // Animate banner
            [bannerBg, eyebrowText, rarityText, speciesText].forEach(element => {
                element.setAlpha(0);
                this.tweens.add({
                    targets: element,
                    alpha: 1,
                    duration: 450,
                    ease: 'Sine.easeOut'
                });
            });

            // Store references for cleanup
            this.rarityBanner = { bannerBg, eyebrowText, rarityText, speciesText };
            this.applyFirstContactCreaturePresentation(this.creature, layout);

        } catch (error) {
            console.error('hatch:error [HatchingScene] Error in showRarityReveal:', error);
            if (window.errorHandler) {
                window.errorHandler.handleError({
                    type: 'scene',
                    severity: 'error',
                    message: 'Failed to show rarity reveal: ' + error.message,
                    stack: error.stack
                });
            }
        }
    }

    /**
     * Show Keep/Reroll buttons
     */
    showRerollOptions() {
        try {
            if (!this.creatureGenetics || !this.creatureGenetics.rarity) {
                console.error('hatch:error [HatchingScene] Creature genetics or rarity missing for reroll options');
                return;
            }

            // Disable reroll for egg hatching
            const canReroll = this.isEggHatch
                ? false
                : Boolean(window.rerollSystem?.canReroll?.());

            console.log('hatch:info [HatchingScene] Reroll check:', {
                isEggHatch: this.isEggHatch,
                canReroll: canReroll,
                hasRerollState: !!window.rerollSystem.currentRerollState
            });

            if (this.isEggHatch) {
                console.log('hatch:info [HatchingScene] 🥚 Reroll disabled for egg hatching');
            }

            // MOBILE-RESPONSIVE button positioning
            const { width } = this.scale;
            const isMobile = width < 600;
            const layout = this.getFirstContactLayout(canReroll);
            const { centerX } = layout;

            // Responsive sizing
            const buttonWidth = layout.buttonWidth;
            const buttonHeight = layout.buttonHeight;
            const buttonSpacing = layout.buttonGap;
            const buttonY = layout.buttonY;
            const fontSize = isMobile ? 13 : 16;

            // Calculate button positions (centered pair)
            const keepX = canReroll ?
                (centerX - buttonWidth - (buttonSpacing / 2)) :
                (centerX - (buttonWidth / 2));
            const rerollX = centerX + (buttonSpacing / 2);

            // KEEP button
            const keepBg = this.add.graphics();
            keepBg.fillStyle(0x146b55, 0.96);
            keepBg.fillRoundedRect(keepX, buttonY, buttonWidth, buttonHeight, 8);
            keepBg.lineStyle(2, 0xFFD54F);
            keepBg.strokeRoundedRect(keepX, buttonY, buttonWidth, buttonHeight, 8);

            const keepLabel = canReroll ? 'CONFIRM CONTACT' : 'MEET THIS CREATURE';
            const keepText = this.add.text(keepX + (buttonWidth / 2), buttonY + (buttonHeight / 2), keepLabel, {
                fontSize: `${fontSize}px`,
                color: '#FFFFFF',
                fontStyle: 'bold',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif'
            }).setOrigin(0.5);

            const keepZone = this.add.zone(keepX, buttonY, buttonWidth, buttonHeight).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });

            // Store dimensions for hover effects
            this.keepButtonDims = { x: keepX, y: buttonY, w: buttonWidth, h: buttonHeight };

            // REROLL button (if available)
            let rerollBg, rerollText, rerollZone;
            if (canReroll) {
                rerollBg = this.add.graphics();
                rerollBg.fillStyle(0x273c74, 0.96);
                rerollBg.fillRoundedRect(rerollX, buttonY, buttonWidth, buttonHeight, 8);
                rerollBg.lineStyle(2, 0x8FE3D4);
                rerollBg.strokeRoundedRect(rerollX, buttonY, buttonWidth, buttonHeight, 8);

                rerollText = this.add.text(rerollX + (buttonWidth / 2), buttonY + (buttonHeight / 2), 'RESCAN CREATURE', {
                    fontSize: `${fontSize}px`,
                    color: '#FFFFFF',
                    fontStyle: 'bold'
                }).setOrigin(0.5);

                rerollZone = this.add.zone(rerollX, buttonY, buttonWidth, buttonHeight).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });

                // Store dimensions for hover effects
                this.rerollButtonDims = { x: rerollX, y: buttonY, w: buttonWidth, h: buttonHeight };
            }

            // Advice text
            const advice = canReroll ? window.rerollSystem.getRerollAdvice(this.creatureGenetics.rarity) : null;
            const adviceFontSize = isMobile ? 12 : 14;
            const adviceText = advice ? this.add.text(centerX, layout.scanY, `SCAN ESTIMATE · ${advice.message}`, {
                fontSize: `${adviceFontSize}px`,
                color: '#FFD54F',
                align: 'center',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
                wordWrap: { width: layout.guidanceWidth }
            }).setOrigin(0.5) : null;

            // Tutorial hint for first-time players
            let tutorialHint = null;
            const gameState = getGameState();
            const hasSeenRerollTutorial = gameState.get('tutorial.rerollSeen') || false;

            if (!hasSeenRerollTutorial && canReroll) {
                const tutorialFontSize = isMobile ? 13 : 15;
                const guidanceHeight = isMobile ? 48 : 46;
                const guidanceBg = this.add.graphics();
                guidanceBg.fillStyle(0x04171b, 0.72);
                guidanceBg.fillRoundedRect(
                    centerX - (layout.guidanceWidth / 2),
                    layout.guidanceY - (guidanceHeight / 2),
                    layout.guidanceWidth,
                    guidanceHeight,
                    8
                );
                guidanceBg.lineStyle(1, 0x8FE3D4, 0.45);
                guidanceBg.strokeRoundedRect(
                    centerX - (layout.guidanceWidth / 2),
                    layout.guidanceY - (guidanceHeight / 2),
                    layout.guidanceWidth,
                    guidanceHeight,
                    8
                );
                tutorialHint = this.add.text(centerX, layout.guidanceY,
                    'One rescan remains. Accept this reading, or ask the beacon to look again.', {
                    fontSize: `${tutorialFontSize}px`,
                    color: '#FFFFFF',
                    align: 'center',
                    fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
                    wordWrap: { width: layout.guidanceWidth - 24 }
                }).setOrigin(0.5).setAlpha(0);
                guidanceBg.setAlpha(0);
                this.firstContactGuidance = { guidanceBg, tutorialHint };

                // Mark tutorial as seen
                gameState.set('tutorial.rerollSeen', true);
            }

            // Animate elements
            const elements = [keepBg, keepText];
            if (adviceText) {
                elements.push(adviceText);
            }
            if (canReroll) {
                elements.push(rerollBg, rerollText);
            }
            if (tutorialHint) {
                elements.push(this.firstContactGuidance.guidanceBg);
                elements.push(tutorialHint);
            }

            elements.forEach((el, index) => {
                el.setAlpha(0);
                this.tweens.add({
                    targets: el,
                    alpha: 1,
                    duration: 500,
                    delay: index * 100,
                    ease: 'Power2'
                });
            });

            // Button interactions
            keepZone.on('pointerdown', () => this.handleKeepCreature());
            keepZone.on('pointerover', () => {
                const dims = this.keepButtonDims;
                keepBg.clear();
                keepBg.fillStyle(0x32CD32, 0.9);
                keepBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 8);
                keepBg.lineStyle(2, 0xFFD54F);
                keepBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 8);
            });
            keepZone.on('pointerout', () => {
                const dims = this.keepButtonDims;
                keepBg.clear();
                keepBg.fillStyle(0x146b55, 0.96);
                keepBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 8);
                keepBg.lineStyle(2, 0xFFD54F);
                keepBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 8);
            });

            if (canReroll) {
                console.log('hatch:info [HatchingScene] Reroll button enabled and interactive');
                rerollZone.on('pointerdown', () => {
                    console.log('hatch:info [HatchingScene] Reroll zone clicked!');
                    this.handleRerollCreature();
                });
                rerollZone.on('pointerover', () => {
                    const dims = this.rerollButtonDims;
                    rerollBg.clear();
                    rerollBg.fillStyle(0x6495ED, 0.9);
                    rerollBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 8);
                    rerollBg.lineStyle(2, 0x8FE3D4);
                    rerollBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 8);
                });
                rerollZone.on('pointerout', () => {
                    const dims = this.rerollButtonDims;
                    rerollBg.clear();
                    rerollBg.fillStyle(0x273c74, 0.96);
                    rerollBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 8);
                    rerollBg.lineStyle(2, 0x8FE3D4);
                    rerollBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 8);
                });

                this.rerollUI = { rerollBg, rerollText, rerollZone };
            }

            this.keepUI = { keepBg, keepText, keepZone };
            this.adviceText = adviceText;
            this.resizeFirstContactLayout();

        } catch (error) {
            console.error('hatch:error [HatchingScene] Error in showRerollOptions:', error);
            if (window.errorHandler) {
                window.errorHandler.handleError({
                    type: 'scene',
                    severity: 'error',
                    message: 'Failed to show reroll options: ' + error.message,
                    stack: error.stack
                });
            }
        }
    }

    /**
     * Handle KEEP button click
     */
    handleKeepCreature() {
        if (!this.hatchCommitAttempt?.complete || !this.hatchCommitAttempt.owner.isCurrent() ||
            !this.hatchCommitAttempt.isCurrent()) { this.showHatchSaveRecovery(); return; }
        console.log('hatch:info [HatchingScene] Player kept creature');

        // Cleanup UI
        this.cleanupRerollUI();

        // End reroll session
        window.rerollSystem?.endHatchSession?.();

        const { width, height } = this.scale;
        const confirmText = this.add.text(width / 2, height * 0.7, 'CONTACT CONFIRMED', {
            fontSize: `${Math.max(18, Math.min(24, width * 0.055))}px`,
            color: '#FFD54F',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
            targets: confirmText,
            alpha: { from: 0, to: 1 },
            scale: { from: 0.8, to: 1.2 },
            duration: 500,
            yoyo: true,
            onComplete: () => {
                confirmText.destroy();
                this.transitionToPersonality();
            }
        });
    }

    /**
     * Handle REROLL button click
     */
    handleRerollCreature() {
        if (!this.canCommitHatch() || !this.hatchCommitAttempt?.complete ||
            !this.hatchCommitAttempt.isCurrent()) { this.showHatchSaveRecovery(); return; }
        console.log('hatch:info [HatchingScene] 🔄 REROLL BUTTON CLICKED!');

        if (!this.creatureGenetics) {
            console.error('hatch:error [HatchingScene] No creature genetics to reroll');
            return;
        }

        const originalRarity = this.creatureGenetics.rarity;
        console.log(`hatch:info [HatchingScene] Player rerolling ${originalRarity} creature`);

        // Execute reroll
        if (!window.rerollSystem.executeReroll()) {
            console.warn('hatch:warn [HatchingScene] Reroll failed - already used or not available');
            return;
        }

        // Track reroll in GameState
        const state = getGameState();
        let rerollData = cloneConfig(state.get('rerollSystem') || null);
        if (!rerollData) {
            rerollData = window.rerollSystem.initializeRerollData();
        }
        rerollData = window.rerollSystem.trackReroll(originalRarity, 'pending', rerollData);
        this.hatchRerollData = rerollData;

        // Cleanup current UI
        this.cleanupRerollUI();

        // Check if creature exists
        if (!this.creature) {
            console.error('hatch:error [HatchingScene] No creature object to animate');
            // Skip animation and regenerate immediately
            this.performRerollRegeneration(originalRarity, rerollData, state);
            return;
        }

        console.log('hatch:info [HatchingScene] Fading out current creature...');

        // Fade out current creature
        this.tweens.add({
            targets: this.creature,
            alpha: 0,
            scale: 0.5,
            duration: 500,
            onComplete: () => {
                console.log('hatch:info [HatchingScene] Creature fade out complete, destroying...');
                this.creature.destroy();

                this.performRerollRegeneration(originalRarity, rerollData, state);
            }
        });
    }

    /**
     * Perform the creature regeneration after reroll
     */
    performRerollRegeneration(originalRarity, rerollData, state) {
        if (!this.canCommitHatch() || state !== this.hatchSaveOwner.state) return;
        console.log('hatch:info [HatchingScene] Generating new creature after reroll...');

        // Generate NEW creature with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        let creatureResult = null;

        while (retryCount < maxRetries && !creatureResult) {
            // Generate NEW creature genetics
            this.generateCreatureGenetics();

            if (!this.creatureGenetics) {
                console.error(`hatch:error [HatchingScene] Failed to generate new genetics (attempt ${retryCount + 1})`);
                retryCount++;
                continue;
            }

            console.log(`hatch:info [HatchingScene] New creature generated: ${this.creatureGenetics.rarity} ${this.creatureGenetics.species}`);

            // Try to create the creature (always baby when hatching)
            creatureResult = this.createUniqueCreature('baby');

            if (!creatureResult || !creatureResult.textureName) {
                console.warn(`hatch:warn [HatchingScene] Creature creation failed (attempt ${retryCount + 1}), retrying...`);
                creatureResult = null;
                retryCount++;

                // Clear DNA and try genetics-only on retry
                if (retryCount > 1) {
                    this.creatureDNA = null;
                }
            }
        }

        // Final validation
        if (!creatureResult || !creatureResult.textureName) {
            console.error('hatch:error [HatchingScene] Failed to create creature after all retries');
            this.showRerollError('Creature generation failed - please try again');
            return;
        }

        console.log('hatch:info [HatchingScene] Creating new creature sprite with texture:', creatureResult.textureName);

        // Verify texture exists before creating sprite
        if (!this.textures.exists(creatureResult.textureName)) {
            console.error('hatch:error [HatchingScene] Texture was not created properly:', creatureResult.textureName);
            this.showRerollError('Failed to generate creature appearance');
            return;
        }

        // MOBILE-RESPONSIVE rerolled creature positioning
        const { width, height } = this.scale;
        const centerX = width / 2;
        const layout = this.getFirstContactLayout(false);
        const creatureY = layout.creatureY;
        const targetScale = layout.creatureScale;

        this.creature = this.add.image(centerX, creatureY, creatureResult.textureName);
        this.creature.setScale(1.5);
        this.creature.setAlpha(0);
        this.creature.setDepth(20);
        this.creature.genetics = this.creatureGenetics;
        this.applyFirstContactCreaturePresentation(this.creature, layout);
        const rerolledGenetics = this.creatureGenetics;

        // Fade in new creature with audio feedback
        this.tweens.add({
            targets: this.creature,
            alpha: 1,
            scale: targetScale,
            duration: 1000,
            ease: 'Back.easeOut',
            onComplete: () => {
                const attempt = this.hatchCommitAttempt;
                if (!attempt?.complete || attempt.genetics !== rerolledGenetics ||
                    this.creatureGenetics !== rerolledGenetics || !attempt.owner.isCurrent()) return;
                // Play reveal sound for dramatic effect
                if (window.AudioManager) {
                    window.AudioManager.playLevelUp();
                }
            }
        });

        // Bring back sparkle reveal & genetic VFX
        this.createSparkles();
        this.addGeneticEffects();

        // Persist latest genetics/texture to GameState so downstream scenes use the rerolled creature
        rerollData = window.rerollSystem.trackReroll(originalRarity, this.creatureGenetics.rarity, rerollData);
        this.hatchRerollData = rerollData;
        this.saveCreatureGenetics(() => {
            window.rerollSystem.setRerolledCreature({
                genetics: this.creatureGenetics,
                rarity: this.creatureGenetics.rarity
            });
            const attempt = this.hatchCommitAttempt;
            this.time.delayedCall(1000, () => {
                if (attempt !== this.hatchCommitAttempt || !attempt.owner.isCurrent() || !attempt.isCurrent()) return;
                this.showRarityReveal();
                this.showFinalKeepButton();
            });
        });
    }

    /**
     * Show final KEEP button after reroll (no second reroll allowed)
     */
    showFinalKeepButton() {
        // MOBILE-RESPONSIVE final keep button (after reroll)
        const { width } = this.scale;
        const layout = this.getFirstContactLayout(false);
        const { centerX } = layout;
        const isMobile = layout.isCompact;

        // Button sizing
        const buttonWidth = layout.buttonWidth;
        const buttonHeight = layout.buttonHeight;
        const buttonX = centerX - (buttonWidth / 2);
        const buttonY = layout.buttonY;
        const fontSize = isMobile ? 14 : 17;
        const textFontSize = isMobile ? 13 : 15;

        const keepBg = this.add.graphics();
        keepBg.fillStyle(0x228B22, 0.9);
        keepBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
        keepBg.lineStyle(3, 0xFFD54F);
        keepBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);

        const keepText = this.add.text(centerX, buttonY + (buttonHeight / 2), 'CONFIRM CONTACT', {
            fontSize: `${fontSize}px`,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const keepZone = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });

        const finalText = this.add.text(centerX, layout.guidanceY, 'CREATURE LOCKED · RESCAN COMPLETE', {
            fontSize: `${textFontSize}px`,
            color: '#90EE90',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        [keepBg, keepText, finalText].forEach(el => {
            el.setAlpha(0);
            this.tweens.add({
                targets: el,
                alpha: 1,
                duration: 500,
                ease: 'Power2'
            });
        });

        // Store dimensions for hover effects
        this.finalKeepButtonDims = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };

        keepZone.on('pointerdown', () => this.handleKeepCreature());
        keepZone.on('pointerover', () => {
            const dims = this.finalKeepButtonDims;
            keepBg.clear();
            keepBg.fillStyle(0x32CD32, 0.9);
            keepBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
            keepBg.lineStyle(3, 0xFFD54F);
            keepBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
        });
        keepZone.on('pointerout', () => {
            const dims = this.finalKeepButtonDims;
            keepBg.clear();
            keepBg.fillStyle(0x228B22, 0.9);
            keepBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
            keepBg.lineStyle(3, 0xFFD54F);
            keepBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
        });

        this.keepUI = { keepBg, keepText, keepZone };
        this.finalText = finalText;
        this.resizeFirstContactLayout();
    }

    /**
     * Show error message when reroll fails
     */
    showRerollError(message) {
        // MOBILE-RESPONSIVE error message positioning
        const { width, height } = this.scale;
        const centerX = width / 2;
        const errorY = height * 0.4; // 40% from top
        const fontSize = Math.max(18, Math.min(24, width * 0.055));

        const errorText = this.add.text(centerX, errorY, `⚠️ ${message}`, {
            fontSize: `${fontSize}px`,
            color: '#FF6B6B',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        errorText.setAlpha(0);
        this.tweens.add({
            targets: errorText,
            alpha: 1,
            duration: 500
        });

        // Show retry button after delay
        this.time.delayedCall(2000, () => {
            this.showFinalKeepButton();
        });
    }

    /**
     * Cleanup reroll UI elements
     */
    cleanupRerollUI() {
        if (this.rarityBanner) {
            Object.values(this.rarityBanner).forEach(el => el && el.destroy());
            this.rarityBanner = null;
        }
        if (this.keepUI) {
            Object.values(this.keepUI).forEach(el => el && el.destroy());
            this.keepUI = null;
        }
        if (this.rerollUI) {
            Object.values(this.rerollUI).forEach(el => el && el.destroy());
            this.rerollUI = null;
        }
        if (this.adviceText) {
            this.adviceText.destroy();
            this.adviceText = null;
        }
        if (this.firstContactGuidance) {
            Object.values(this.firstContactGuidance).forEach(el => el && el.destroy());
            this.firstContactGuidance = null;
        }
        if (this.finalText) {
            this.finalText.destroy();
            this.finalText = null;
        }
    }

    // ==========================================
    // ENHANCED HOME SCREEN UI METHODS
    // ==========================================

    /**
     * Create the Project Beacon crash-site backdrop.
     */
    createEnhancedBackground() {
        const { width, height } = this.scale;
        const fallback = this.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x061116,
            1
        );

        if (this.textures?.exists('projectBeaconCrashSite')) {
            const background = this.add.image(
                width / 2,
                height / 2,
                'projectBeaconCrashSite'
            );
            const coverScale = Math.max(
                width / background.width,
                height / background.height
            );
            background.setScale(coverScale);
            fallback.setVisible(false);
            this.projectBeaconBackground = background;
        }

        this.createProjectBeaconMotionBackdrop(width, height);

        const contrastVeil = this.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x02080B,
            0.2
        );
        this.projectBeaconBackgroundFallback = fallback;
        this.projectBeaconContrastVeil = contrastVeil;
    }

    createProjectBeaconMotionBackdrop(width, height) {
        if (!shouldPlayCinematicMedia() || !this.add?.video) return null;
        const videoX = width < 600 ? width * 0.92 : width * 0.65;
        const video = this.add.video(videoX, height / 2)
            .setOrigin(0.5)
            .setDisplaySize(
                Math.max(width, height * (16 / 9)),
                Math.max(height, width * (9 / 16))
            )
            .setAlpha(0);
        video.loadURL(CINEMATIC_MEDIA.projectBeaconHome.url, true, 'anonymous');
        video.setMute?.(true);
        video.video?.setAttribute?.('playsinline', '');
        video.once?.('playing', () => {
            video.setAlpha(0.94);
            this.projectBeaconBackground?.setAlpha(0.14);
        });
        video.once?.('error', () => video.destroy?.());
        video.play?.(true);
        this.events.once('shutdown', () => {
            video.stop?.();
            video.removeVideoElement?.();
        });
        this.projectBeaconMotionBackdrop = video;
        return video;
    }

    /**
     * Create animated stardust particles
     * MOBILE-RESPONSIVE: Uses actual viewport dimensions for all positions
     */
    createStardustParticles() {
        // Create floating stardust particles
        const { width, height } = this.scale;

        // Store particles for cleanup
        this.stardustParticles = this.stardustParticles || [];

        for (let i = 0; i < 15; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                2,
                0xFFD54F,
                0.6
            );

            this.stardustParticles.push(particle);

            // Floating animation - use scene reference for responsive reset
            const scene = this;
            this.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(100, 200),
                x: particle.x + Phaser.Math.Between(-20, 20),
                alpha: 0,
                duration: Phaser.Math.Between(4000, 6000),
                ease: 'Sine.easeOut',
                delay: Math.random() * 2000,
                repeat: -1,
                onRepeat: () => {
                    // RESPONSIVE: Get current screen dimensions on each repeat
                    const currentWidth = scene.scale.width;
                    const currentHeight = scene.scale.height;
                    // Reset to bottom of screen (90% height) for upward float
                    particle.y = currentHeight * 0.9;
                    particle.x = Phaser.Math.Between(0, currentWidth);
                    particle.alpha = 0.6;
                }
            });
        }
    }

    /**
     * Create enhanced title with glow effect
     * MOBILE-FIRST RESPONSIVE: Now uses actual viewport dimensions
     * RESIZE mode means width/height are the actual screen pixels
     */
    createEnhancedTitle() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const titleY = height * 0.15;  // 15% from top - works for portrait
        const panelWidth = Math.min(width * 0.95, 600);  // 95% of screen width, max 600px
        const panelHeight = Math.min(height * 0.18, 150);  // Taller panel for both lines

        // MOBILE-RESPONSIVE font sizes - scaled for readability
        // Desktop: 48px title, 18px subtitle
        // Mobile (390px): 31px title, 14px subtitle
        const titleFontSize = Math.max(28, Math.min(48, width * 0.08));  // 8% of screen width, min 28px
        const subtitleFontSize = Math.max(14, Math.min(18, width * 0.036));  // 3.6% of screen width

        // Glassmorphic panel behind title
        const titlePanel = this.add.graphics();
        titlePanel.fillStyle(0x061018, 0.76);
        titlePanel.fillRoundedRect(centerX - panelWidth/2, titleY - 30, panelWidth, panelHeight, 20);
        titlePanel.lineStyle(2, 0xFFD54F, 0.5);
        titlePanel.strokeRoundedRect(centerX - panelWidth/2, titleY - 30, panelWidth, panelHeight, 20);

        // Main title - "MYTHICAL VOID" stays on ONE line (NO word wrap)
        const titleText = this.add.text(centerX, titleY, 'MYTHICAL VOID', {
            fontSize: `${titleFontSize}px`,
            color: '#FFD54F',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold',
            stroke: '#071418',
            strokeThickness: 3
            // NO wordWrap - title must never break across lines
        }).setOrigin(0.5);

        // Add glow effect
        titleText.setStyle({
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: 'rgba(255, 213, 79, 0.8)',
                blur: 20,
                stroke: true,
                fill: false
            }
        });

        // Pulsing glow animation
        this.tweens.add({
            targets: titleText,
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Project Beacon mission identifier on a separate line below.
        // Dynamic spacing based on title font size for proper visual hierarchy
        const subtitleY = titleY + (titleFontSize * 1.6);  // 1.6x title size = proper spacing
        const subtitleText = this.add.text(centerX, subtitleY, firstSessionFraming.homeSubtitle, {
            fontSize: `${subtitleFontSize}px`,
            color: '#B0B0B0',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Store for cleanup
        this.titlePanel = titlePanel;
        this.titleText = titleText;
        this.subtitleText = subtitleText;
    }

    /**
     * Create enhanced START button with glassmorphism
     * MOBILE-RESPONSIVE positioning
     */
    createEnhancedStartButton() {
        const { width, height } = this.scale;
        const buttonX = width / 2;
        const buttonY = height * 0.5;  // Center vertically at 50%

        // Responsive button sizing for mobile - wider for portrait screens
        const buttonWidth = Math.min(width * 0.85, 340);  // 85% of screen width, max 340px
        const buttonHeight = Math.min(height * 0.08, 95);  // 8% of screen height, max 95px

        // Create container for the button
        const buttonContainer = this.add.container(buttonX, buttonY)
            .setScrollFactor(0)
            .setDepth(10000);

        // LAYERED GLOW SYSTEM - Creates magnetic visual pull
        const outerGlow = this.add.graphics();
        outerGlow.fillStyle(0xFF6B35, 0.12);
        outerGlow.fillRoundedRect(-buttonWidth/2 - 24, -buttonHeight/2 - 24, buttonWidth + 48, buttonHeight + 48, 28);
        outerGlow.setBlendMode(Phaser.BlendModes.ADD);

        const middleGlow = this.add.graphics();
        middleGlow.fillStyle(0xFF6B35, 0.2);
        middleGlow.fillRoundedRect(-buttonWidth/2 - 14, -buttonHeight/2 - 14, buttonWidth + 28, buttonHeight + 28, 24);
        middleGlow.setBlendMode(Phaser.BlendModes.ADD);

        const innerGlow = this.add.graphics();
        innerGlow.fillStyle(0xFF6B35, 0.3);
        innerGlow.fillRoundedRect(-buttonWidth/2 - 5, -buttonHeight/2 - 5, buttonWidth + 10, buttonHeight + 10, 20);
        innerGlow.setBlendMode(Phaser.BlendModes.ADD);

        // WARM GRADIENT BACKGROUND - Orange (urgency) to yellow (optimism)
        const bg = this.add.graphics();
        bg.fillGradientStyle(0xFF6B35, 0xFF6B35, 0xFFB347, 0xFFB347, 1, 1, 1, 1);
        bg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 18);

        // Bright border for definition
        bg.lineStyle(3, 0xFFFFFF, 0.95);
        bg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 18);

        // Top shine for 3D depth
        const shine = this.add.graphics();
        shine.fillStyle(0xFFFFFF, 0.22);
        shine.fillRoundedRect(-buttonWidth/2 + 8, -buttonHeight/2 + 8, buttonWidth - 16, buttonHeight/2 - 10, 14);

        // POWER WORDS - Action-oriented, benefit-focused (responsive font size)
        // Canvas width is authoritative here. Browser device detection can report a
        // desktop-class user agent on narrow embedded and accessibility viewports.
        const buttonFontSize = width <= 360
            ? '18px'
            : width < 600
                ? '22px'
                : MobileHelpers.getFontSize(this.scale, 28);
        const buttonText = this.add.text(0, 0, firstSessionFraming.homeCta, {
            fontSize: buttonFontSize,
            color: '#FFFFFF',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: '900',
            align: 'center',
            stroke: '#8B3000',
            strokeThickness: 4,
            shadow: {
                offsetX: 0,
                offsetY: 2,
                color: 'rgba(0,0,0,0.35)',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);

        // ROCKET EMOJI - Visual anchor + emotional connection
        const rocket = this.add.text(0, -33, '🚀', {
            fontSize: '36px'
        }).setOrigin(0.5);

        // URGENCY PULSE DOT - Triggers FOMO
        const urgencyDot = this.add.circle(buttonWidth/2 - 22, -buttonHeight/2 + 14, 5, 0x00FF88, 1);

        buttonContainer.add([outerGlow, middleGlow, innerGlow, bg, shine, rocket, buttonText, urgencyDot]);

        // Mobile-optimized touch hit area
        MobileHelpers.setTouchHitArea(buttonContainer, buttonWidth, buttonHeight, 30);

        // BREATHING ANIMATION - Subconscious familiarity
        this.tweens.add({
            targets: buttonContainer,
            scaleX: 1.025,
            scaleY: 1.025,
            duration: 2200,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // LAYERED GLOW PULSE - Energy feeling
        this.tweens.add({
            targets: [outerGlow, middleGlow, innerGlow],
            alpha: '-=0.08',
            duration: 1900,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // URGENCY DOT PULSE - FOMO trigger
        this.tweens.add({
            targets: urgencyDot,
            alpha: 0.4,
            scale: 1.4,
            duration: 1100,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // ROCKET FLOAT - Motion draws attention
        this.tweens.add({
            targets: rocket,
            y: -35,
            duration: 1600,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // HOVER - Immediate dopamine feedback
        buttonContainer.on('pointerover', () => {
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 1.09,
                scaleY: 1.09,
                duration: 160,
                ease: 'Back.easeOut.config(1.4)'
            });
            this.tweens.add({
                targets: [outerGlow, middleGlow, innerGlow],
                alpha: '+=0.25',
                duration: 160
            });
            this.tweens.add({
                targets: buttonText,
                y: -3,
                duration: 160,
                ease: 'Back.easeOut'
            });
            this.tweens.add({
                targets: rocket,
                angle: -12,
                scale: 1.2,
                duration: 160
            });
        });

        buttonContainer.on('pointerout', () => {
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Back.easeIn'
            });
            this.tweens.add({
                targets: [outerGlow, middleGlow, innerGlow],
                alpha: '-=0.25',
                duration: 200
            });
            this.tweens.add({
                targets: buttonText,
                y: 0,
                duration: 200
            });
            this.tweens.add({
                targets: rocket,
                angle: 0,
                scale: 1,
                duration: 200
            });
        });

        // CLICK - Tactile satisfaction & reward
        buttonContainer.on('pointerdown', () => {
            console.log('🚀 START GAME button clicked!');
            this.startButtonPressed = true;
            this.startButtonPressedAt = Date.now();
            this.animateStartPress();

            // Haptic feedback for mobile
            MobileHelpers.vibrate(50);

            // Squash effect
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 0.94,
                scaleY: 0.94,
                duration: 85,
                ease: 'Power2'
            });
            // Flash
            this.tweens.add({
                targets: shine,
                alpha: 0.55,
                duration: 85
            });
        });

        const onReleaseStart = () => {
            if (!this.startButtonPressed) return;
            this.startButtonPressed = false;
            this.onStartRelease(buttonContainer, buttonX, buttonY);
        };

        buttonContainer.on('pointerup', () => onReleaseStart());
        buttonContainer.on('pointerupoutside', () => onReleaseStart());
        buttonContainer.on('pointercancel', () => {
            this.startButtonPressed = false;
        });
        buttonContainer.on('pointerout', () => {
            // Keep pressed state if dragging back in, but reset when this is a non-UI
            // environment that doesn't support outside tracking.
            if (!this.startButtonPressed || !this.sys?.isActive()) return;
            this.startButtonPressed = false;
        });
        buttonContainer.setData('startButton', true);

        // Fallback for environments where Phaser pointer lifecycle can miss release
        buttonContainer.once('destroy', () => {
            this.startButtonPressed = false;
        });

        this.input.on('pointerup', onReleaseStart);

        if (typeof document !== 'undefined' && this.game?.canvas) {
            const fallbackHandler = (event) => {
                if (!this.sys?.isActive() || !this.startButtonPressed) return;
                const bounds = this.game.canvas.getBoundingClientRect();
                const x = event.clientX || 0;
                const y = event.clientY || 0;
                const inside = x >= bounds.left && x <= bounds.right
                    && y >= bounds.top && y <= bounds.bottom;
                if (inside) {
                    onReleaseStart();
                } else {
                    this.startButtonPressed = false;
                }
            };

            window.addEventListener('pointerup', fallbackHandler, { capture: true, passive: true });
            this.inputAbortHandler = () => {
                window.removeEventListener('pointerup', fallbackHandler, true);
            };
            this.game.events.once('shutdown', this.inputAbortHandler);
            this.game.events.once('destroy', this.inputAbortHandler);
        }

        this.startButton = buttonContainer;
    }

    animateStartPress() {
        if (!this.startButton || !this.startButton.active) return;
        this.tweens.add({
            targets: this.startButton,
            scaleX: 0.94,
            scaleY: 0.94,
            duration: 85,
            ease: 'Power2'
        });
    }

    animateStartRelease(buttonContainer) {
        if (!buttonContainer?.active) return;
        this.tweens.add({
            targets: buttonContainer,
            scaleX: 1.06,
            scaleY: 1.06,
            duration: 110,
            ease: 'Back.easeOut'
        });
    }

    onStartRelease(buttonContainer, buttonX, buttonY) {
        // Prevent double-clicks and re-entry into transition path
        if (this.isStartingGame || this.startFlowQueued || this.openingStartAttempt ||
            this.hatchSceneRetired || this.sys?.isActive?.() === false) return false;

        if (this.startButtonPressedAt && Date.now() - this.startButtonPressedAt > 18000) {
            this.startButtonPressedAt = null;
            this.startButtonPressed = false;
            return false;
        }

        const owner = this.hatchSaveOwner;
        if (!this.canCommitHatch()) {
            this.showHatchSaveRecovery(() => this.onStartRelease(buttonContainer, buttonX, buttonY));
            return false;
        }
        const state = owner.state;
        let attempt;
        try {
            attempt = { owner, state, memory: state.state,
                snapshot: JSON.stringify(state.createSaveSnapshot()), raw: localStorage.getItem(state.saveKey) };
            attempt.reader = state.captureLocalSaveWrite(attempt.snapshot);
        } catch (error) {
            // Start is still visible; no live reset or presentation handoff has begun.
            return false;
        }
        if (this.hatchSaveOwner !== owner || this.openingStartAttempt || this.hatchSceneRetired ||
            this.sys?.isActive?.() === false || !owner.isCurrent() || state.state !== attempt.memory ||
            JSON.stringify(state.createSaveSnapshot()) !== attempt.snapshot) return false;
        attempt.ownsScene = () => this.openingStartAttempt === attempt && this.hatchSaveOwner === owner &&
            !this.hatchSceneRetired && this.sys?.isActive?.() !== false && owner.isCurrent();
        attempt.isCurrent = () => {
            try {
                if (!attempt.ownsScene()) return false;
                if (attempt.result?.success) return attempt.result.isCurrent();
                if (state.state !== attempt.memory || JSON.stringify(state.createSaveSnapshot()) !== attempt.snapshot) return false;
                attempt.reader.assertCurrent(attempt.raw);
                return true;
            } catch (error) { return false; }
        };
        this.openingStartAttempt = attempt;
        if (!attempt.isCurrent()) return false;
        this.isStartingGame = true;
        this.startFlowQueued = true;
        this.startButtonPressed = false;
        try {
            this.removeHomeStartFallback();
            if (!attempt.isCurrent()) return false;
            if (!this.performOpeningStartFeedback(attempt,
                () => window.UXEnhancements?.showLoading('Preparing your adventure...'))) return false;
            if (!this.performOpeningStartFeedback(attempt, () => this.animateStartRelease(buttonContainer))) return false;
            // The release commits directly; it never waits on a tween or timer.
            return this.handleStartGame(attempt);
        } catch (error) {
            return this.recoverOpeningStart(attempt);
        }
    }

    /**
     * Create feature preview cards
     * MOBILE-RESPONSIVE: Stack vertically on narrow screens
     */
    createFeatureCards() {
        const { width, height } = this.scale;
        const centerX = width / 2;

        // Skip feature cards on mobile to simplify UI
        // They're just informational and clutter the portrait layout
        if (width < 600) {
            return;
        }

        // Desktop: Horizontal layout
        const cardWidth = 180;
        const cardHeight = 120;
        const cardY = height - 180;
        const spacing = Math.min(215, width / 4);

        const cardColors = [0xEF767A, 0x8FE3CF, 0xF2C14E];
        const cardPositions = [centerX - spacing, centerX, centerX + spacing];
        const cards = firstSessionFraming.homeCards.map((card, index) => ({
            ...card,
            desc: card.description,
            x: cardPositions[index],
            color: cardColors[index]
        }));

        cards.forEach(card => {
            // Glassmorphic card with subtle gradient
            const cardBg = this.add.graphics();
            cardBg.fillStyle(0x061018, 0.78);
            cardBg.fillRoundedRect(card.x - cardWidth/2, cardY, cardWidth, cardHeight, 12);
            cardBg.lineStyle(2, card.color, 0.5);
            cardBg.strokeRoundedRect(card.x - cardWidth/2, cardY, cardWidth, cardHeight, 12);

            // Icon
            const icon = this.add.text(card.x, cardY + 30, card.icon, {
                fontSize: '40px'
            }).setOrigin(0.5);

            // Title
            const title = this.add.text(card.x, cardY + 70, card.title, {
                fontSize: '18px',
                color: '#FFD54F',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Description
            const desc = this.add.text(card.x, cardY + 100, card.desc, {
                fontSize: '12px',
                color: '#B39DDB',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
                align: 'center'
            }).setOrigin(0.5);

            // Hover animation
            const cardContainer = this.add.container(0, 0, [cardBg, icon, title, desc]);
            cardContainer.setSize(cardWidth, cardHeight);
            cardContainer.setInteractive({ cursor: 'pointer' });

            cardContainer.on('pointerover', () => {
                this.tweens.add({
                    targets: [icon, title, desc],
                    y: '+=- 5',
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            });

            cardContainer.on('pointerout', () => {
                this.tweens.add({
                    targets: [icon, title, desc],
                    y: '+= 5',
                    duration: 200,
                    ease: 'Back.easeIn'
                });
            });
        });
    }

    /**
     * Create bottom hint text
     */
    createBottomHints() {
        const { width, height } = this.scale;
        const hintText = this.add.text(width / 2, height - 50, firstSessionFraming.homePromise, {
            fontSize: width < 600 ? '13px' : '16px',
            color: '#D9D3E8',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            align: 'center',
            wordWrap: { width: Math.max(260, width - 24) }
        }).setOrigin(0.5);

        // Gentle fade animation
        this.tweens.add({
            targets: hintText,
            alpha: 0.6,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Copyright footer
        this.createCopyrightFooter();
    }

    /**
     * Create copyright footer with legal links
     */
    createCopyrightFooter() {
        const { width, height } = this.scale;

        // Get copyright text from legal config
        const copyrightText = legalConfig?.copyright?.notice || '© 2026 Tech Evolve AI. All rights reserved.';

        // Copyright text
        const copyright = this.add.text(width / 2 - 40, height - 18, copyrightText, {
            fontSize: '11px',
            color: '#666666',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5).setAlpha(0.8);

        // Legal link (clickable)
        const legalLink = this.add.text(width / 2 + 80, height - 18, '📜 Legal', {
            fontSize: '11px',
            color: '#7B68EE',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5).setAlpha(0.9);
        legalLink.setInteractive({ useHandCursor: true });

        legalLink.on('pointerover', () => {
            legalLink.setColor('#9B88FF');
            legalLink.setAlpha(1);
        });
        legalLink.on('pointerout', () => {
            legalLink.setColor('#7B68EE');
            legalLink.setAlpha(0.9);
        });
        legalLink.on('pointerdown', () => {
            this.showLegalDocuments();
        });
    }

    /**
     * Show legal documents modal
     */
    async showLegalDocuments() {
        try {
            const LegalDocumentsModal = (await import('../ui/LegalDocumentsModal.js')).default;
            if (!this.legalModal) {
                this.legalModal = new LegalDocumentsModal(this);
            }
            this.legalModal.show();
        } catch (error) {
            console.warn('[HatchingScene] Failed to load legal modal:', error);
        }
    }

    /**
     * Create "Tap to Hatch" instructional text over the egg
     * Quick Win #1 from QA Audit - improves discoverability
     * FIX #1: Make text non-interactive so clicks pass through to egg
     * FIX #2: Destroy existing text to prevent duplication
     */
    createTapToHatchText() {
        // FIX #2: Destroy existing text if it exists (prevents duplication)
        if (this.tapToHatchText) {
            this.tweens.killTweensOf(this.tapToHatchText);
            this.tapToHatchText.destroy();
            this.tapToHatchText = null;
        }

        const { width, height } = this.scale;
        const isMobile = MobileHelpers.isMobile() || width < 600;
        const text = isMobile
            ? firstSessionFraming.tapPromptMobile
            : firstSessionFraming.tapPromptDesktop;

        // MOBILE-RESPONSIVE positioning - position relative to egg
        const textX = width / 2;
        const availableWidth = Math.max(260, width - 32);
        const fittedFontSize = availableWidth / (text.length * 0.62);
        const fontSize = Math.max(18, Math.min(28, fittedFontSize));
        const instructionBottom = this.instructionText
            ? this.instructionText.y + (this.instructionText.height / 2)
            : height * 0.22;
        const textY = instructionBottom + (fontSize / 2) + 14;

        this.tapToHatchText = this.add.text(textX, textY, text, {
            fontSize: `${fontSize}px`,
            color: '#FFD54F',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold',
            stroke: '#071418',
            strokeThickness: 4,
            align: 'center',
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: 'rgba(255, 213, 79, 0.8)',
                blur: 15,
                fill: true
            }
        }).setOrigin(0.5);

        // Pulsing animation - draws attention without being annoying
        this.tweens.add({
            targets: this.tapToHatchText,
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.85,
            duration: 1200,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Gentle floating animation synced with egg
        this.tweens.add({
            targets: this.tapToHatchText,
            y: textY - 6,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * Create star burst particle effect
     */
    createStartBurstEffect(x, y) {
        // Create particles radiating outward
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const distance = 60;

            const particle = this.add.circle(x, y, 4, 0xFFD54F, 1);

            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0,
                scale: 0,
                duration: 600,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }

        // Central flash
        const flash = this.add.circle(x, y, 20, 0xFFFFFF, 0.8);
        flash.setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
            targets: flash,
            scale: 3,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => flash.destroy()
        });
    }

    /**
     * Handle start game button click
     * ⚠️ CRITICAL SECTION - DO NOT MODIFY - GAME FLOW LOGIC ⚠️
     */
    createOpeningStartDraft(state) {
        const notifications = [];
        const draft = { state: cloneConfig(state.get()), set: state.set,
            recordOpeningMilestone: state.recordOpeningMilestone,
            emit: (event, data) => notifications.push({ event, data }),
            reportStateMutationError: error => { throw error; } };
        draft.set('session.gameStarted', true);
        // Preserve the original calculation order, including legacy active-creature milestones.
        draft.recordOpeningMilestone('hatch_started');
        for (const [key, value] of [
            ['creature.hatched', false], ['creature.hatchTransaction', null],
            ['creature.name', 'Your Creature'], ['creature.named', false],
            ['tutorial.livingFormPending', false], ['tutorial.livingFormSeen', false],
            ['creature.hatchTime', null], ['creature.experience', 0], ['creature.level', 1],
            ['creature.stats', { happiness: 100, energy: 100, health: 100 }],
            ['creature.personality', null], ['creature.genes', null], ['creature.genetics', null],
            ['creature.dna', null], ['creature.personalityState', null], ['creature.isOffspring', false],
            ['creature.generation', null], ['creature.parentIds', null], ['creature.offspringBonus', null],
            ['creature.hasAncientLineage', false], ['creature.ancientProphecy', null]
        ]) draft.set(key, value);
        return { state: draft.state, notifications };
    }

    performOpeningStartFeedback(attempt, callback) {
        if (!attempt.isCurrent()) return false;
        try { callback(); }
        catch (error) { console.warn('[HatchingScene] Start feedback unavailable:', error); }
        return attempt.isCurrent();
    }

    recoverOpeningStart(attempt) {
        if (!attempt?.isCurrent()) return false;
        this.isStartingGame = false;
        this.startFlowQueued = false;
        if (!this.performOpeningStartFeedback(attempt, () => window.UXEnhancements?.hideLoading())) return false;
        this.showHatchSaveRecovery(() => {
            if (!attempt.isCurrent() || this.isStartingGame || this.startFlowQueued) return;
            this.isStartingGame = true;
            this.startFlowQueued = true;
            if (this.performOpeningStartFeedback(attempt,
                () => window.UXEnhancements?.showLoading('Preparing your adventure...'))) this.handleStartGame(attempt);
        });
        return false;
    }

    handleStartGame(attempt = this.openingStartAttempt) {
        if (!attempt?.isCurrent()) return false;
        try {
            if (!attempt.result?.success) {
                const draft = this.createOpeningStartDraft(attempt.state);
                if (!attempt.isCurrent()) return false;
                const result = attempt.state.commitHatchSaveDraft(draft.state, {
                    isCurrentCampaign: attempt.ownsScene,
                    notifications: draft.notifications,
                    isCurrentResult: (live, durable, serialized) =>
                        JSON.stringify(attempt.state.createSaveSnapshot({ state: live })) === serialized &&
                        JSON.stringify(durable) === serialized
                });
                if (!result.success) return this.recoverOpeningStart(attempt);
                attempt.result = result;
                attempt.owner.activeIdentity = attempt.state.getHatchActiveIdentity();
            }
            if (!attempt.isCurrent()) return false;
            if (!this.performOpeningStartFeedback(attempt, () => window.UXEnhancements?.hideLoading())) return false;
            this.scene.restart();
            return true;
        } catch (error) {
            if (!attempt.isCurrent()) return false;
            try {
                if (!attempt.result?.success) return this.recoverOpeningStart(attempt);
                this.scene.start('HatchingScene');
                return true;
            } catch (startError) {
                return this.recoverOpeningStart(attempt);
            }
        }
    }
}

export default HatchingScene;

if (typeof window !== 'undefined') {
    window.HatchingScene = HatchingScene;
}
