// Import Tailwind CSS styles
import './styles/main.css';

import { createClient } from '@supabase/supabase-js';
import { Phaser, preloadModulesReady } from './global-init.js';
import HatchingScene from './scenes/HatchingScene.js';
import PersonalityScene from './scenes/PersonalityScene.js';
import NamingScene from './scenes/NamingScene.js';
import SoulRevealScene from './scenes/SoulRevealScene.js';
import GameScene from './scenes/GameScene.js';
import FusionPodScene from './scenes/FusionPodScene.js';
import BreedingHatchScene from './scenes/BreedingHatchScene.js';
import HubWorldScene from './scenes/HubWorldScene.js';
import WelcomeBackScene from './scenes/WelcomeBackScene.js';
import VoidMiniGameScene from './scenes/VoidMiniGameScene.js';
import AbilitySelectionScene from './scenes/AbilitySelectionScene.js';
import PlatformerLevelScene from './scenes/PlatformerLevelScene.js';
import VictoryScene from './scenes/VictoryScene.js';
import CloudSaveSettingsModal from './ui/CloudSaveSettingsModal.js';
import SharedFusionModal from './ui/SharedFusionModal.js';
import PageVisibilityController from './utils/PageVisibilityController.js';
// Individual levels are lazy loaded via SceneLoader when player enters them
// This reduces initial bundle size by ~200KB (each level is ~40-60KB)
// See: src/utils/SceneLoader.js for dynamic import configuration
import kidModeConfig from './config/kid-mode.json';
import hatchCinematicsConfig from './config/hatch-cinematics.json';
import biomesConfig from './config/biomes.json';

const cloneConfig = (config) => {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(config);
        }
    } catch (err) {
        // Ignore and fall back to JSON clone below
    }
    return JSON.parse(JSON.stringify(config));
};

async function startSceneWhenReady(game, sceneKey, data = undefined, options = {}) {
    const { stopScenes = [] } = options;

    try {
        if (window.SceneLoader) {
            const loaded = await window.SceneLoader.loadScene(game, sceneKey);
            if (!loaded) {
                return false;
            }
        }

        stopScenes.forEach(key => game.scene.stop(key));
        game.scene.start(sceneKey, data);
        return true;
    } catch (error) {
        console.error(`[Main] Could not start ${sceneKey}:`, error);
        window.UXEnhancements?.hideLoading?.();
        return false;
    }
}

async function launchLocalHighPowerPreview(game) {
    const previewParams = new URLSearchParams(window.location.search);
    const isLocalPreview = ['localhost', '127.0.0.1'].includes(
        window.location.hostname
    );
    if (!isLocalPreview || !previewParams.has('testHighPower')) return;

    if (window.SceneLoader) {
        await window.SceneLoader.loadScene(game, 'FinalVoidLevel');
    }
    game.scene.getScenes(true).forEach(activeScene => {
        if (activeScene.scene?.key !== 'FinalVoidLevel') {
            game.scene.stop(activeScene.scene.key);
        }
    });
    game.scene.start('FinalVoidLevel', {
        highPowerPreview: true
    });
}

function launchLocalHatchGallery(game, urlParams, isLocalPreview) {
    if (!isLocalPreview || !urlParams.has('testHatchGallery')) return;

    game.events.once('ready', () => {
        setTimeout(() => {
            game.scene.getScenes(true).forEach(activeScene => {
                game.scene.stop(activeScene.scene.key);
            });

            const galleryScene = new Phaser.Scene({
                key: 'LocalHatchGalleryScene'
            });
            galleryScene.create = function createHatchGallery() {
                const { width, height } = this.scale;
                const compact = width < 700;
                const columns = compact ? 2 : 4;
                const rows = compact ? 3 : 3;
                const specimenCount = columns * rows;
                const top = compact ? 112 : 104;
                const bottom = 24;
                const cellWidth = width / columns;
                const cellHeight = (height - top - bottom) / rows;
                const engine = new window.GraphicsEngine(this);
                const manifest = [];

                this.cameras.main.setBackgroundColor('#07100F');
                this.add.text(width / 2, 24, 'HATCH VARIATION // LIVE RENDERER', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: compact ? '17px' : '23px',
                    fontStyle: 'bold',
                    color: '#8FE3CF'
                }).setOrigin(0.5, 0);
                this.add.text(
                    width / 2,
                    compact ? 55 : 60,
                    `${specimenCount} independent genetics + DNA outcomes`,
                    {
                        fontFamily: 'Arial, sans-serif',
                        fontSize: compact ? '11px' : '14px',
                        color: '#F2C14E'
                    }
                ).setOrigin(0.5, 0);

                for (let index = 0; index < specimenCount; index += 1) {
                    const genes = window.CreatureGenetics
                        .generateCreatureGenetics();
                    const dna = window.CreatureDNA.generateDNA({
                        forcedRarity: genes.rarity
                    });
                    const result = engine.createCreatureFromDNA(
                        dna,
                        0,
                        'baby',
                        genes
                    );
                    const column = index % columns;
                    const row = Math.floor(index / columns);
                    const centerX = (column * cellWidth) + (cellWidth / 2);
                    const centerY = top + (row * cellHeight) + (cellHeight * 0.42);
                    const frameWidth = Math.max(72, cellWidth - (compact ? 18 : 30));
                    const frameHeight = Math.max(95, cellHeight - 18);
                    const frame = this.add.graphics();
                    frame.fillStyle(0x101616, 0.92);
                    frame.fillRoundedRect(
                        centerX - (frameWidth / 2),
                        top + (row * cellHeight),
                        frameWidth,
                        frameHeight,
                        6
                    );
                    frame.lineStyle(1, index % 2 === 0 ? 0x8FE3CF : 0xF2C14E, 0.72);
                    frame.strokeRoundedRect(
                        centerX - (frameWidth / 2),
                        top + (row * cellHeight),
                        frameWidth,
                        frameHeight,
                        6
                    );

                    const specimen = this.add.image(
                        centerX,
                        centerY,
                        result.textureName
                    );
                    const specimenScale = Math.min(
                        (frameWidth - 18) / specimen.width,
                        (frameHeight * 0.58) / specimen.height
                    );
                    specimen.setScale(specimenScale);

                    const labelY = top + (row * cellHeight) + (frameHeight * 0.75);
                    this.add.text(
                        centerX,
                        labelY,
                        `${genes.species.replace(/([a-z])([A-Z])/g, '$1 $2')}\n` +
                            `${dna.bodyArchetype} / ${dna.headArchetype}\n` +
                            `${genes.personality.core} / ${genes.cosmicAffinity.element}`,
                        {
                            fontFamily: 'Arial, sans-serif',
                            fontSize: compact ? '8px' : '11px',
                            fontStyle: 'bold',
                            align: 'center',
                            color: '#F4F4F4',
                            lineSpacing: 2,
                            wordWrap: { width: frameWidth - 10 }
                        }
                    ).setOrigin(0.5, 0);

                    manifest.push({
                        index,
                        geneticsId: genes.id,
                        dnaId: dna.id,
                        species: genes.species,
                        rarity: genes.rarity,
                        bodyArchetype: dna.bodyArchetype,
                        headArchetype: dna.headArchetype,
                        hybridTag: dna.hybridTag,
                        personality: genes.personality.core,
                        affinity: genes.cosmicAffinity.element,
                        mutations: genes.traits.features.wackyMutations || []
                    });
                }

                const exportElement = document.getElementById('hatch-qa-manifest')
                    || document.createElement('script');
                exportElement.id = 'hatch-qa-manifest';
                exportElement.type = 'application/json';
                exportElement.textContent = JSON.stringify(manifest);
                if (!exportElement.isConnected) {
                    document.body.appendChild(exportElement);
                }
            };

            game.scene.add('LocalHatchGalleryScene', galleryScene, true);
        }, 100);
    });
}

/**
 * Main game file that initializes Phaser with all game configuration
 * Enhanced with comprehensive error handling, memory management, and responsive design
 */

// Initialize error handler first
if (window.ErrorHandler) {
    window.errorHandler.initialize();
}

// Initialize memory manager
if (window.MemoryManager) {
    window.memoryManager.initialize();
}

// Initialize UI theme
if (window.UITheme) {
    // Theme is auto-initialized
    console.log('✅ UI Theme system ready');
}

// Cache frequently used globals - will be set after modules load
let GameState = null;
let cloudSaveManager = null;

// Initialize responsive manager (will be set up after Phaser loads)
let responsiveManager = null;
let pageVisibilityController = null;

// Initialize UX enhancements
let uxEnhancements = null;

// Initialize Space-Mythic systems
let kidModeManager = null;
let hatchCinematicsManager = null;
let fxLibrary = null;
let parallaxBiome = null;
let creatureGenetics = null;

async function initializeCloudSaves() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        || 'https://mkcmdbzcihjgidjuypqe.supabase.co';
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        || import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!publishableKey || !window.CloudSaveManager) {
        console.info('[CloudSave] Optional cloud saves are not configured.');
        return null;
    }

    const client = createClient(supabaseUrl, publishableKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });

    cloudSaveManager = new window.CloudSaveManager({
        client,
        gameState: GameState
    });
    window.CloudSave = cloudSaveManager;

    await cloudSaveManager.initialize();
    console.info('[CloudSave] Ready:', cloudSaveManager.getStatus());
    return cloudSaveManager;
}

// Function to clean up before scene transition
function cleanupScene(scene) {
    if (!scene) return;

    console.log(`[Main] Cleaning up scene: ${scene.scene.key}`);

    try {
        // Use memory manager for cleanup
        if (window.memoryManager) {
            window.memoryManager.cleanupScene(scene);
        }

        // Clear any scene-specific event listeners
        if (scene.events) {
            scene.events.removeAllListeners();
        }

        // Clear input handlers
        if (scene.input) {
            scene.input.removeAllListeners();
            if (scene.input.keyboard) {
                scene.input.keyboard.removeAllKeys();
            }
        }
    } catch (error) {
        console.warn(`[Main] Error during scene cleanup:`, error);
    }
}

let gameInitialized = false;

async function initializeGame() {
    if (gameInitialized) return;
    gameInitialized = true;

    try {
        await preloadModulesReady;
        console.log('🚀 Initializing Mythical Creature Game...');

        // Cache GameState after modules are loaded
        GameState = window.GameState;

        // Initialize environment configuration first
        if (window.envLoader) {
            await window.envLoader.load();
            if (!window.envLoader.validate()) {
                console.warn('⚠️ Environment validation failed, continuing with defaults');
            }
        }

        // Initialize API configuration
        if (window.APIConfig) {
            try {
                await window.APIConfig.initialize();
            } catch (apiError) {
                console.warn('⚠️ API configuration failed:', apiError.message);
            }
        }

        // Check for required dependencies
        if (typeof Phaser === 'undefined') {
            throw new Error('Phaser.js library not loaded');
        }

        if (!window.GameState) {
            throw new Error('GameState system not loaded');
        }

        if (!window.GraphicsEngine) {
            throw new Error('GraphicsEngine system not loaded');
        }

        if (!HatchingScene || !NamingScene || !GameScene) {
            throw new Error('Game scenes not loaded properly');
        }

        // Initialize game state system with error handling
        try {
            GameState.init();
            console.log('✅ GameState initialized successfully');

            await initializeCloudSaves();

            // DEV MODE: Auto-reset creature collection to prevent stale cache issues
            // This ensures fresh starts during development testing
            if (import.meta.env.DEV) {
                const urlParams = new URLSearchParams(window.location.search);
                const forceReset = urlParams.get('reset') === 'true';
                const keepSave = urlParams.get('keep') === 'true';

                if (forceReset) {
                    console.log('🔧 DEV MODE: Force reset requested via ?reset=true');
                    localStorage.removeItem('mythical_creature_save');
                    GameState.reset();
                    console.log('✅ DEV MODE: All game data cleared');
                } else if (!keepSave) {
                    // Always reset creature collection in dev mode unless ?keep=true
                    const collection = GameState.get('creatureCollection') || [];
                    if (collection.length > 0) {
                        console.log(`🔧 DEV MODE: Clearing stale creature collection (${collection.length} creatures)`);
                        console.log('   (Use ?keep=true to preserve save data)');
                        GameState.resetCreatureCollection();
                    }
                }
            }
        } catch (stateError) {
            console.error('❌ GameState initialization failed:', stateError);
            if (window.errorHandler) {
                window.errorHandler.handleError({
                    type: 'initialization',
                    message: 'Failed to initialize game progress system',
                    error: stateError,
                    severity: 'warning'
                });
            }
        }

        // Initialize economy system (depends on GameState)
        try {
            if (window.EconomyManager) {
                window.EconomyManager.initialize();
            } else {
                console.warn('⚠️ EconomyManager not available');
            }
        } catch (economyError) {
            console.error('❌ EconomyManager initialization failed:', economyError);
        }

        // Initialize audio system
        try {
            if (window.AudioManager) {
                window.AudioManager.initialize();
            } else {
                console.warn('⚠️ AudioManager not available');
            }
        } catch (audioError) {
            console.error('❌ AudioManager initialization failed:', audioError);
        }

        // Initialize enemy system
        try {
            if (window.EnemyManager) {
                window.EnemyManager.initialize();
            } else {
                console.warn('⚠️ EnemyManager not available');
            }
        } catch (enemyError) {
            console.error('❌ EnemyManager initialization failed:', enemyError);
        }

        // Initialize projectile system
        try {
            if (window.ProjectileManager) {
                window.ProjectileManager.initialize();
            } else {
                console.warn('⚠️ ProjectileManager not available');
            }
        } catch (projectileError) {
            console.error('❌ ProjectileManager initialization failed:', projectileError);
        }

        // Initialize inventory system
        try {
            if (window.InventoryManager) {
                window.InventoryManager.initialize();
            } else {
                console.warn('⚠️ InventoryManager not available');
            }
        } catch (inventoryError) {
            console.error('❌ InventoryManager initialization failed:', inventoryError);
        }

        // Initialize quest system
        try {
            if (window.QuestManager) {
                window.QuestManager.init();
                console.log('✅ QuestManager initialized successfully');
            } else {
                console.warn('⚠️ QuestManager not available');
            }
        } catch (questError) {
            console.error('❌ QuestManager initialization failed:', questError);
        }

        // Initialize collectible system
        try {
            if (window.CollectibleManager) {
                window.CollectibleManager.init();
                console.log('✅ CollectibleManager initialized successfully');
            } else {
                console.warn('⚠️ CollectibleManager not available');
            }
        } catch (collectibleError) {
            console.error('❌ CollectibleManager initialization failed:', collectibleError);
        }

        // Initialize creature skills system
        try {
            if (window.CreatureSkills) {
                window.CreatureSkills.init();
                console.log('✅ CreatureSkills initialized successfully');
            } else {
                console.warn('⚠️ CreatureSkills not available');
            }
        } catch (skillsError) {
            console.error('❌ CreatureSkills initialization failed:', skillsError);
        }

        // Set up GameState event listeners with error handling
        try {
            GameState.on('levelUp', (data) => {
                console.log(`🎉 Creature leveled up! Level ${data.oldLevel} → ${data.newLevel}`);
            });

            GameState.on('unlocked', (data) => {
                console.log(`🔓 Unlocked ${data.type}: ${data.item}`);
            });

            GameState.on('saved', () => {
                console.log('💾 Game saved automatically');
            });

            GameState.on('saveError', (error) => {
                console.error('💾❌ Save failed:', error);
                if (window.errorHandler) {
                    window.errorHandler.handleError({
                        type: 'save',
                        message: 'Failed to save game progress',
                        error: error,
                        severity: 'warning'
                    });
                }
            });

            GameState.on('loadError', (error) => {
                console.error('📂❌ Load failed:', error);
                console.log('🔄 Starting with default game state');
                if (window.errorHandler) {
                    window.errorHandler.handleError({
                        type: 'load',
                        message: 'Could not load saved game',
                        error: error,
                        severity: 'warning'
                    });
                }
            });

        } catch (listenerError) {
            console.warn('⚠️ Some GameState event listeners failed to set up:', listenerError);
        }

        // Game configuration - MOBILE-FIRST PORTRAIT LAYOUT
        // iPhone 12 dimensions: 390x844 (portrait), but we use dynamic sizing
        const viewportWidth = Math.max(
            1,
            Math.floor(window.visualViewport?.width || window.innerWidth)
        );
        const viewportHeight = Math.max(
            1,
            Math.floor(window.visualViewport?.height || window.innerHeight)
        );
        const config = {
            type: Phaser.AUTO,
            parent: 'game',
            width: viewportWidth,
            height: viewportHeight,
            backgroundColor: '#0a0118',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            // Individual platformer levels (CrystalCavesLevel, ReefLevel, etc.) are lazy loaded
            // via SceneLoader when player enters them from HubWorldScene
            scene: [HatchingScene, PersonalityScene, NamingScene, SoulRevealScene, GameScene, FusionPodScene, BreedingHatchScene, HubWorldScene, WelcomeBackScene, VoidMiniGameScene, AbilitySelectionScene, PlatformerLevelScene, VictoryScene],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: viewportWidth,
                height: viewportHeight,
                // Handle window resize for orientation changes
                parent: 'game',
                expandParent: true,
                fullscreenTarget: 'game'
            },
            input: {
                activePointers: 3, // Support multi-touch
                touch: {
                    capture: true
                },
                mouse: {
                    preventDefaultWheel: false
                }
            },
            dom: {
                createContainer: true
            },
            // Add Phaser's built-in error handling
            callbacks: {
                postBoot: function (game) {
                    console.log('🎮 Phaser game booted successfully');

                    try {
                        const canvas = game.canvas;
                        if (canvas) {
                            canvas.classList.add('ready');
                        }

                        const loadingScreen = document.getElementById('loading-screen');
                        if (loadingScreen) {
                            loadingScreen.style.opacity = '0';
                            loadingScreen.style.pointerEvents = 'none';
                            setTimeout(() => loadingScreen.remove(), 500);
                        }
                    } catch (uiError) {
                        console.warn('ui:warn [Main] Failed to finalize loading screen:', uiError);
                    }

                    // Initialize responsive manager
                    if (window.ResponsiveManager) {
                        responsiveManager = new ResponsiveManager();
                        responsiveManager.initialize(game);
                        window.responsiveManager = responsiveManager;
                    }

                    // Initialize UX enhancements
                    if (window.UXEnhancements) {
                        uxEnhancements = window.UXEnhancements;
                        uxEnhancements.initialize(game);
                        console.log('✅ UX Enhancements initialized');
                    }

                    // Initialize Kid Mode system
                    if (window.KidMode) {
                        kidModeManager = window.KidMode;
                        try {
                            kidModeManager.initialize(cloneConfig(kidModeConfig));
                            console.log('✅ Kid Mode system initialized');
                        } catch (configError) {
                            console.warn('Kid Mode config failed to load, using defaults', configError);
                            kidModeManager.initialize();
                        }
                    }

                    // Initialize Hatch Cinematics system
                    if (window.HatchCinematics) {
                        hatchCinematicsManager = window.HatchCinematics;
                        try {
                            hatchCinematicsManager.initialize(cloneConfig(hatchCinematicsConfig));
                            console.log('✅ Hatch Cinematics system initialized');
                        } catch (configError) {
                            console.warn('Hatch Cinematics config failed to load, using defaults', configError);
                            hatchCinematicsManager.initialize();
                        }
                    }

                    // Initialize FX Library system
                    if (window.FXLibrary) {
                        fxLibrary = window.FXLibrary;
                        fxLibrary.initialize();
                        console.log('✅ FX Library system initialized');
                    }

                    // Initialize Parallax Biome system
                    if (window.ParallaxBiome) {
                        parallaxBiome = window.ParallaxBiome;
                        try {
                            parallaxBiome.initialize(cloneConfig(biomesConfig));
                            console.log('✅ Parallax Biome system initialized');
                        } catch (configError) {
                            console.warn('Parallax Biome config failed to load, using defaults', configError);
                            parallaxBiome.initialize();
                        }
                    }

                    // Initialize Creature Genetics system
                    if (window.CreatureGenetics) {
                        creatureGenetics = window.CreatureGenetics;
                        creatureGenetics.initialize();
                        console.log('✅ Creature Genetics system initialized');
                    }

                    // Initialize Creature DNA system
                    if (window.CreatureDNA) {
                        window.CreatureDNA.initialize();
                        console.log('✅ Creature DNA system initialized');
                    }

                    // Initialize Personality Shaping system
                    if (window.PersonalitySystem) {
                        window.PersonalitySystem.initialize();
                        console.log('✅ Personality Shaping system initialized');
                    }

                    // Initialize Creature AI Controller (kid-safe chat)
                    if (window.CreatureAIController) {
                        window.CreatureAIController.initialize();
                        console.log('✅ Creature AI Controller initialized');
                    }

                    // Initialize Creature AI system
                    if (window.CreatureAI) {
                        const creatureAI = new window.CreatureAI();
                        creatureAI.initialize().then(() => {
                            window.creatureAI = creatureAI;
                            console.log('✅ Creature AI system initialized');
                        }).catch((error) => {
                            console.warn('⚠️ Creature AI initialization failed, using fallback mode:', error.message);
                            window.creatureAI = creatureAI; // Still available in fallback mode
                        });
                    }

                    // Resume audio context on first user interaction (browser requirement)
                    const resumeAudio = () => {
                        if (window.AudioManager) {
                            window.AudioManager.resume();
                            // Remove listener after first interaction
                            document.removeEventListener('click', resumeAudio);
                            document.removeEventListener('touchstart', resumeAudio);
                            document.removeEventListener('keydown', resumeAudio);
                        }
                    };
                    document.addEventListener('click', resumeAudio);
                    document.addEventListener('touchstart', resumeAudio);
                    document.addEventListener('keydown', resumeAudio);

                    // Set up scene transition cleanup
                    game.scene.scenes.forEach(scene => {
                        if (scene.events) {
                            // Clean up on destroy only (not shutdown to avoid conflicts)
                            scene.events.once('destroy', () => {
                                try {
                                    // Minimal cleanup - let Phaser handle most of it
                                    if (scene.events) {
                                        scene.events.removeAllListeners();
                                    }
                                } catch (e) {
                                    console.warn(`[Main] Scene destroy cleanup error:`, e);
                                }
                            });
                        }
                    });

                    setTimeout(() => {
                        launchLocalHighPowerPreview(game).catch(error => {
                            window.errorHandler?.handleError?.({
                                type: 'qa-preview',
                                message: error?.message || 'High-power preview failed',
                                error,
                                severity: 'error'
                            });
                        });
                    }, 100);
                }
            }
        };

        // Initialize the Phaser game with error handling
        let game;
        try {
            game = new Phaser.Game(config);
            window.mythicalGame = game; // Store reference for debugging
            console.log('✅ Phaser game initialized successfully');

            // Set up error boundary for Phaser
            game.events.on('error', (error) => {
                console.error('Phaser error:', error);
                if (window.errorHandler) {
                    window.errorHandler.handleError({
                        type: 'runtime',
                        message: 'Game engine error',
                        error: error,
                        severity: 'error'
                    });
                }
            });

            if (window.errorHandler && typeof window.errorHandler.setupPhaserErrorHandling === 'function') {
                window.errorHandler.setupPhaserErrorHandling(game);
            } else {
                game.events.on('sceneerror', (error, scene) => {
                    console.error(`Scene error in ${scene.sys.config.key}:`, error);
                    if (window.errorHandler) {
                        window.errorHandler.handleError({
                            type: 'scene',
                            message: `Error in scene: ${scene.sys.config.key}`,
                            error: error,
                            severity: 'error'
                        });
                    }
                });
            }

        } catch (phaserError) {
            console.error('❌ Phaser initialization failed:', phaserError);
            if (window.errorHandler) {
                window.errorHandler.handleError({
                    type: 'initialization',
                    message: 'Failed to initialize game engine',
                    error: phaserError,
                    severity: 'error'
                });
            }
            return; // Exit early if Phaser fails
        }

        // Check for test mode URL parameters
        // Usage: ?testBoss=mythicalForest to jump directly to boss fight
        const urlParams = new URLSearchParams(window.location.search);
        const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const hasLocalQaRoute = isLocalPreview &&
            [...urlParams.keys()].some(key => key.startsWith('test'));
        launchLocalHatchGallery(game, urlParams, isLocalPreview);
        const testBoss = urlParams.get('testBoss');
        if (isLocalPreview && testBoss) {
            console.log(`🧪 TEST MODE: Jumping to ${testBoss} boss fight`);
            game.events.once('ready', () => {
                // Wait a moment for scenes to register
                setTimeout(async () => {
                    const testBossScenes = {
                        mythicalForest: 'MythicalForestLevel',
                        forest: 'MythicalForestLevel',
                        crystalCaves: 'CrystalCavesLevel',
                        crystal: 'CrystalCavesLevel',
                        reef: 'ReefLevel',
                        auroraDepths: 'AuroraDepthsLevel',
                        aurora: 'AuroraDepthsLevel',
                        voidPeaks: 'VoidPeaksLevel',
                        peaks: 'VoidPeaksLevel',
                        finalVoid: 'FinalVoidLevel',
                        final: 'FinalVoidLevel',
                        victory: 'VictoryScene'
                    };

                    const sceneName = testBossScenes[testBoss];
                    if (!sceneName) {
                        return;
                    }

                    if (window.SceneLoader) {
                        await window.SceneLoader.loadScene(game, sceneName);
                    }

                    if (
                        isLocalPreview &&
                        urlParams.get('testPowerups') === '1' &&
                        window.InventoryManager
                    ) {
                        const previewPowerups = [
                            ['energy_crystal', 'Energy Crystal', '⚡', { crystalEnergy: 3 }],
                            ['power_shot', 'Power Shot', '🎯', { nextRangedDamageMultiplier: 5 }],
                            ['crystal_shield', 'Crystal Shield', '🛡️', { shieldHits: 2 }],
                            ['super_blast', 'Super Blast', '💥', { freeSpecialAttack: 1 }],
                            ['health_boost', 'Health Boost', '❤️', { fullHealth: true }],
                            ['double_coins', 'Coin Magnet', '🧲', { coinMultiplier: 2 }]
                        ];

                        window.InventoryManager.inventory = previewPowerups.map((
                            [id, name, icon, effect],
                            slot
                        ) => ({
                            id,
                            name,
                            icon,
                            effect,
                            type: 'powerup',
                            usableInLevel: true,
                            quantity: 2,
                            slot
                        }));
                    }

                    const katanaPreview = ['crystal', 'aurora', 'full'].includes(
                        urlParams.get('katanaPreview')
                    ) ? urlParams.get('katanaPreview') : null;
                    game.scene.start(sceneName, {
                        testMode: true,
                        katanaPreview,
                        forceMobileControls:
                            urlParams.get('forceMobileControls') === '1',
                        platformerPreviewSize:
                            urlParams.get('previewSize') === 'mobile'
                                ? 'mobile'
                                : null,
                        bossAttackPreview: [
                            'root_slam',
                            'vine_whip',
                            'spore_cloud',
                            'nature_fury',
                            'ground_slam',
                            'crystal_barrage',
                            'charge',
                            'voidLunge',
                            'dimensionalTear',
                            'summonMinions',
                            'flame_dive',
                            'shadow_feathers',
                            'fire_trail',
                            'rebirth_nova',
                            'shadow_clones',
                            'gravityCrush',
                            'starRain',
                            'voidPunch',
                            'singularity'
                        ].includes(urlParams.get('testAttack'))
                            ? urlParams.get('testAttack')
                            : null
                    });
                }, 100);
            });
        }

        // Local story preview: ?testDebrief=1 through ?testDebrief=5
        const testDebrief = Number.parseInt(urlParams.get('testDebrief'), 10);

        // Local, non-mutating previews for the final priority and epilogues.
        const testEnding = urlParams.get('testEnding');
        if (
            isLocalPreview
            && [
                'choice',
                'remain_and_defend',
                'prepare_homecoming',
                'prepare_first_contact'
            ].includes(testEnding)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('VictoryScene', {
                        testMode: true,
                        endingPreview: testEnding,
                        endingPreviewPage: urlParams.get('endingPage'),
                        endingPreviewView: urlParams.get('endingView')
                    });
                }, 100);
            });
        }

        // Local, non-mutating guardian restoration result preview.
        if (isLocalPreview && urlParams.get('testGuardianResult') === 'finalVoid') {
            game.events.once('ready', () => {
                setTimeout(async () => {
                    if (window.SceneLoader) {
                        await window.SceneLoader.loadScene(game, 'FinalVoidLevel');
                    }

                    game.scene.start('FinalVoidLevel', {
                        resultPreview: true,
                        rescuePortraitPreview:
                            urlParams.get('previewPortrait') === '1',
                        platformerPreviewSize:
                            urlParams.get('previewSize') === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        // Local, non-mutating level-entry previews for responsive visual QA.
        const testLevelEntry = urlParams.get('testLevelEntry');
        if (isLocalPreview && testLevelEntry) {
            const forceMobileControls =
                urlParams.get('forceMobileControls') === '1';
            const katanaPreview = ['crystal', 'aurora', 'full'].includes(
                urlParams.get('katanaPreview')
            ) ? urlParams.get('katanaPreview') : null;
            game.events.once('ready', () => {
                setTimeout(async () => {
                    const entryPreviewScenes = {
                        mythicalForest: 'MythicalForestLevel',
                        crystalCaves: 'CrystalCavesLevel',
                        reef: 'ReefLevel',
                        voidPeaks: 'VoidPeaksLevel',
                        auroraDepths: 'AuroraDepthsLevel',
                        finalVoid: 'FinalVoidLevel'
                    };
                    const sceneName = entryPreviewScenes[testLevelEntry];
                    if (!sceneName) {
                        return;
                    }

                    if (window.SceneLoader) {
                        await window.SceneLoader.loadScene(game, sceneName);
                    }

                    game.scene.start(sceneName, {
                        entryPreview: true,
                        forceMobileControls,
                        katanaPreview,
                        platformerPreviewSize:
                            urlParams.get('previewSize') === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        // Local, non-saving later-realm ecology consequence previews.
        // Example: ?testCurrentEcho=reef&echoMode=mixed
        const testCurrentEcho = urlParams.get('testCurrentEcho');
        const currentEchoMode = [
            'quiet',
            'care',
            'extraction',
            'mixed'
        ].includes(urlParams.get('echoMode'))
            ? urlParams.get('echoMode')
            : 'mixed';
        if (isLocalPreview && testCurrentEcho) {
            const launchCurrentEchoPreview = () => {
                setTimeout(async () => {
                    const previewScenes = {
                        forest: {
                            sceneKey: 'MythicalForestLevel',
                            runtimeLevelId: 'mythical_forest_1'
                        },
                        reef: {
                            sceneKey: 'ReefLevel',
                            runtimeLevelId: 'reef_1'
                        },
                        voidPeaks: {
                            sceneKey: 'VoidPeaksLevel',
                            runtimeLevelId: 'void_peaks_1'
                        },
                        auroraDepths: {
                            sceneKey: 'AuroraDepthsLevel',
                            runtimeLevelId: 'aurora_depths_1'
                        },
                        finalVoid: {
                            sceneKey: 'FinalVoidLevel',
                            runtimeLevelId: 'final_void_1'
                        }
                    };
                    const preview = previewScenes[testCurrentEcho];
                    const ecology = window.CurrentEcology;
                    if (!preview || !ecology || !GameState) return;

                    GameState.set('world.currentEcology', {
                        schemaVersion: 3,
                        observedSignalIds: [],
                        restoredRegionIds: [],
                        arrivalConsequences: {},
                        regions: {},
                        history: []
                    });
                    const seedActions = {
                        quiet: [],
                        care: [
                            ['mythicalForest', 'protect'],
                            ['crystalCaves', 'redirect']
                        ],
                        extraction: [
                            ['mythicalForest', 'siphon'],
                            ['crystalCaves', 'siphon']
                        ],
                        mixed: [
                            ['mythicalForest', 'siphon'],
                            ['crystalCaves', 'protect']
                        ]
                    }[currentEchoMode];
                    seedActions.forEach(([levelId, actionId], index) => {
                        ecology.recordCurrentRegionAction(
                            GameState,
                            levelId,
                            'observe',
                            {
                                operationId:
                                    `preview_echo_scan_${currentEchoMode}_${index}`,
                                occurredAt:
                                    '2026-07-31T04:22:23.000Z',
                                save: false
                            }
                        );
                        ecology.recordCurrentRegionAction(
                            GameState,
                            levelId,
                            actionId,
                            {
                                operationId:
                                    `preview_echo_${currentEchoMode}_${index}`,
                                occurredAt:
                                    '2026-07-31T04:23:00.000Z',
                                save: false
                            }
                        );
                    });
                    ecology.applyCurrentArrivalConsequence(
                        GameState,
                        preview.runtimeLevelId,
                        {
                            occurredAt:
                                '2026-07-31T04:23:23.000Z',
                            save: false
                        }
                    );

                    if (window.SceneLoader) {
                        await window.SceneLoader.loadScene(
                            game,
                            preview.sceneKey
                        );
                    }
                    game.scene.getScenes(true).forEach(activeScene => {
                        if (
                            activeScene.scene?.key !==
                            preview.sceneKey
                        ) {
                            game.scene.stop(activeScene.scene.key);
                        }
                    });
                    game.scene.start(preview.sceneKey, {
                        currentEcologyPreview: true,
                        currentEcologyPreviewSize:
                            urlParams.get('previewSize') === 'mobile'
                                ? 'mobile'
                                : null,
                        forceMobileControls:
                            urlParams.get('forceMobileControls') === '1'
                    });
                }, 100);
            };
            if (game.isBooted) {
                launchCurrentEchoPreview();
            } else {
                game.events.once('ready', launchCurrentEchoPreview);
            }
        }

        // Local checkpoint-resume QA. Unlike the visual entry previews, this
        // starts a normal expedition so its durable Project Beacon checkpoint
        // is restored through the production path.
        const testCheckpointResume = urlParams.get('testCheckpointResume');
        if (isLocalPreview && testCheckpointResume) {
            game.events.once('ready', () => {
                setTimeout(async () => {
                    const checkpointResumeScenes = {
                        mythicalForest: {
                            sceneKey: 'MythicalForestLevel',
                            levelId: 'mythical_forest_1',
                            checkpoints: [
                                ['forest_anchor_1', 1770, 1000],
                                ['forest_anchor_2', 3570, 1000],
                                ['forest_anchor_3', 5300, 1000]
                            ]
                        },
                        crystalCaves: {
                            sceneKey: 'CrystalCavesLevel',
                            levelId: 'crystal_caves_1',
                            checkpoints: [
                                ['caves_anchor_1', 1220, 650],
                                ['caves_anchor_2', 2520, 650],
                                ['caves_anchor_3', 3480, 650]
                            ]
                        },
                        reef: {
                            sceneKey: 'ReefLevel',
                            levelId: 'reef_1',
                            checkpoints: [
                                ['reef_waypoint_1', 1250, 690],
                                ['reef_waypoint_2', 3150, 430],
                                ['reef_waypoint_3', 4750, 630]
                            ]
                        },
                        voidPeaks: {
                            sceneKey: 'VoidPeaksLevel',
                            levelId: 'void_peaks_1',
                            checkpoints: [
                                ['peaks_relay_1', 1180, 700],
                                ['peaks_relay_2', 2380, 700],
                                ['peaks_relay_3', 3680, 480]
                            ]
                        },
                        auroraDepths: {
                            sceneKey: 'AuroraDepthsLevel',
                            levelId: 'aurora_depths_1',
                            checkpoints: [
                                ['aurora_prism_1', 1150, 770],
                                ['aurora_prism_2', 2480, 770],
                                ['aurora_prism_3', 3680, 770]
                            ]
                        },
                        finalVoid: {
                            sceneKey: 'FinalVoidLevel',
                            levelId: 'final_void_1',
                            checkpoints: [
                                ['final_bond_1', 600, 770],
                                ['final_bond_2', 1420, 770],
                                ['final_bond_3', 2200, 770]
                            ]
                        }
                    };
                    const preview = checkpointResumeScenes[testCheckpointResume];
                    if (!preview) {
                        return;
                    }

                    const requestedCheckpoint = Number.parseInt(
                        urlParams.get('checkpoint'),
                        10
                    );
                    const checkpoint =
                        preview.checkpoints[requestedCheckpoint - 1];
                    if (checkpoint && window.GameState) {
                        const [checkpointId, x, y] = checkpoint;
                        window.GameState.set(
                            'story.projectBeacon.expeditionCheckpoint',
                            {
                                version: 1,
                                sceneKey: preview.sceneKey,
                                levelId: preview.levelId,
                                checkpointId,
                                checkpointIndex: requestedCheckpoint - 1,
                                x,
                                y,
                                savedAt: Date.now()
                            }
                        );
                        window.GameState.save?.();
                    }

                    if (window.SceneLoader) {
                        await window.SceneLoader.loadScene(game, preview.sceneKey);
                    }

                    game.scene.start(preview.sceneKey);
                }, 100);
            });
        }

        // Local, non-mutating preview of the first expedition field drill.
        if (isLocalPreview && urlParams.has('testExpeditionDrill')) {
            const expeditionDrillPreview = urlParams.get('testExpeditionDrill');
            const forceMobileControls = [
                'mobile',
                'katana-mobile',
                'power-mobile'
            ].includes(expeditionDrillPreview);
            game.events.once('ready', () => {
                setTimeout(async () => {
                    if (window.SceneLoader) {
                        await window.SceneLoader.loadScene(game, 'MythicalForestLevel');
                    }

                    game.scene.start('MythicalForestLevel', {
                        firstExpeditionDrillPreview: true,
                        firstExpeditionDrillAutoCompletePreview:
                            expeditionDrillPreview === 'power' ||
                            expeditionDrillPreview === 'power-mobile',
                        firstExpeditionDrillStepPreview:
                            expeditionDrillPreview === 'katana' ||
                            expeditionDrillPreview === 'katana-mobile'
                                ? 2
                                : 0,
                        forceMobileControls,
                        companionNamePreview: 'Nova'
                    });
                }, 100);
            });
        }

        // Local, non-mutating Hub progression and first-route previews.
        const testHub = urlParams.get('testHub');
        if (
            isLocalPreview &&
            [
                'complete',
                'firstRoute',
                'routeMap',
                'checkpoint',
                'diagnostics',
                'finalApproach'
            ].includes(testHub)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('HubWorldScene', {
                        progressionPreview: testHub,
                        previewSize:
                            urlParams.get('previewSize') === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        // Local, non-mutating map-shelf preview for shop purchase-state QA.
        const testShop = urlParams.get('testShop');
        if (isLocalPreview && ['maps', 'crystals'].includes(testShop)) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    startSceneWhenReady(game, 'ShopScene', {
                        routeMapPreview: testShop === 'maps'
                            ? ['stellar_reef', 'crystal_caves']
                            : [],
                        voidCrystalCapacityPreview: testShop === 'crystals',
                        initialCategory: testShop === 'crystals' ? 'utilities' : 'eggs'
                    }, { stopScenes: ['HatchingScene'] });
                }, 100);
            });
        }

        // Local field-kit and ship-inventory preview.
        if (isLocalPreview && urlParams.get('testInventory') === 'kit') {
            game.events.once('ready', () => {
                setTimeout(() => {
                    startSceneWhenReady(game, 'InventoryScene', {
                        kitPreview: {
                            fieldKit: {
                                id: 'wanderer_7_field_kit',
                                name: 'Wanderer-77 Field Kit',
                                recovered: true,
                                katana: {
                                    id: 'earth_field_katana',
                                    name: 'Earth-forged Field Katana',
                                    material: 'Titanium-ceramic laminate',
                                    upgradeSlots: 2,
                                    installedUpgrades: [{
                                        id: 'crystal_edge',
                                        name: 'Resonant Edge'
                                    }]
                                }
                            },
                            shipPartIds: ['crystal_core', 'forest_core']
                        }
                    }, { stopScenes: ['HatchingScene'] });
                }, 100);
            });
        }

        // Local, non-saving smoke route for Shop -> map input recovery.
        if (isLocalPreview && urlParams.get('testMapRecovery') === 'shop') {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.stop('HatchingScene');
                    game.scene.start('GameScene', { mapRecoveryPreview: true });
                }, 100);
            });
        }

        // Local, non-mutating mobile HUD prompt and control-dock preview.
        if (isLocalPreview && urlParams.has('testInteractionPrompt')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.stop('HatchingScene');
                    game.scene.start('GameScene', {
                        interactionPromptPreview: true
                    });
                }, 100);
            });
        }

        // Local field-kit recovery preview. This renders the interaction without recovering it.
        const testFieldKit = urlParams.get('testFieldKit');
        if (
            isLocalPreview &&
            ['1', 'mobile', 'earth', 'crystal', 'aurora'].includes(testFieldKit)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        fieldKitPreview: true,
                        fieldKitPreviewSize: testFieldKit === 'mobile' ? 'mobile' : null,
                        fieldKitPreviewStage: ['crystal', 'aurora'].includes(testFieldKit)
                            ? testFieldKit
                            : 'earth'
                    });
                }, 100);
            });
        }

        const testWaypoint = urlParams.get('testWaypoint');
        if (isLocalPreview && ['fieldKit', 'signals'].includes(testWaypoint)) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', { waypointPreview: testWaypoint });
                }, 100);
            });
        }

        // Local, non-mutating Signal Garden stage previews.
        const testGarden = urlParams.get('testGarden');
        if (isLocalPreview && ['seed', 'sprout', 'bud', 'bloom'].includes(testGarden)) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', { signalGardenPreview: testGarden });
                }, 100);
            });
        }

        // Local, non-saving Village Heart command-panel states.
        const testVillage = urlParams.get('testVillage');
        if (isLocalPreview && ['empty', 'building', 'active', 'complete'].includes(testVillage)) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.stop('HatchingScene');
                    game.scene.start('GameScene', {
                        villageCommandPreview: testVillage
                    });
                }, 100);
            });
        }

        const testCommunity = urlParams.get('testCommunity');
        if (
            isLocalPreview &&
            ['0', '1', '2', '3', '4'].includes(testCommunity)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        communityPreview: Number(testCommunity)
                    });
                }, 100);
            });
        }

        const testCommunityMoment = urlParams.get('testCommunityMoment');
        if (
            isLocalPreview &&
            ['1', '2', '3', '4'].includes(testCommunityMoment)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        communityMomentPreview: Number(testCommunityMoment)
                    });
                }, 100);
            });
        }

        const testResidents = urlParams.get('testResidents');
        if (
            isLocalPreview &&
            ['0', '1', '2', '3', '4'].includes(testResidents)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        residentPreview: Number(testResidents)
                    });
                }, 100);
            });
        }

        const testGuardians = urlParams.get('testGuardians');
        if (
            isLocalPreview &&
            ['0', '1', '2', '3', '4', '5', '6'].includes(testGuardians)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        guardianResidentPreview: Number(testGuardians),
                        livingPortraitReadyPreview:
                            urlParams.get('testPortraitReady') === '1'
                    });
                }, 100);
            });
        }

        const testGuardianExchange = urlParams.get('testGuardianExchange');
        const guardianTaskPreview = [
            'accepted',
            'ready',
            'completed',
            'selected',
            'synergy',
            'debrief'
        ].includes(urlParams.get('guardianTaskState'))
            ? urlParams.get('guardianTaskState')
            : null;
        if (
            isLocalPreview &&
            ['1', '2', '3', '4', '5', '6'].includes(testGuardianExchange)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        guardianResidentPreview: 6,
                        guardianExchangePreview: Number(testGuardianExchange),
                        guardianTaskPreview
                    });
                }, 100);
            });
        }

        const testGuardianRecognition = urlParams.get(
            'testGuardianRecognition'
        );
        if (
            isLocalPreview &&
            ['1', '2', '3', '4', '5', '6'].includes(
                testGuardianRecognition
            )
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        guardianResidentPreview: 6,
                        guardianRecognitionPreview: Number(
                            testGuardianRecognition
                        )
                    });
                }, 100);
            });
        }

        const testResidentExchange = urlParams.get('testResidentExchange');
        if (
            isLocalPreview &&
            ['1', '2', '3', '4'].includes(testResidentExchange)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        residentExchangePreview: Number(testResidentExchange)
                    });
                }, 100);
            });
        }

        const testFendCulture = urlParams.get('testFendCulture');
        if (
            isLocalPreview &&
            ['ready', 'refuge', 'restoration', 'warning'].includes(
                testFendCulture
            )
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        fendCulturePreview: testFendCulture
                    });
                }, 100);
            });
        }

        const testConsent = urlParams.get('testConsent');
        if (
            isLocalPreview &&
            ['menu', 'route', 'evidence', 'power', 'complete'].includes(
                testConsent
            )
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        companionConsentPreview: testConsent
                    });
                }, 100);
            });
        }

        const testEarthMemory = urlParams.get('testEarthMemory');
        const testEarthMemorySize = urlParams.get('testEarthMemorySize');
        if (
            isLocalPreview &&
            ['menu', 'dojo', 'ocean', 'city', 'shared'].includes(
                testEarthMemory
            )
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        companionEarthMemoryPreview: testEarthMemory,
                        companionEarthMemoryPreviewSize:
                            testEarthMemorySize === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        const testSenseiMemory = urlParams.get('testSenseiMemory');
        const testSenseiMemorySize = urlParams.get('testSenseiMemorySize');
        if (
            isLocalPreview &&
            ['footing', 'trust', 'restraint', 'confirmed'].includes(
                testSenseiMemory
            )
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        senseiMemoryPreview: testSenseiMemory,
                        senseiMemoryPreviewSize:
                            testSenseiMemorySize === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        const testShipBoard = urlParams.get('testShipBoard');
        const testShipBoardSize = urlParams.get('testShipBoardSize');
        if (
            isLocalPreview &&
            [
                'berth',
                'repair_0',
                'repair_3',
                'repair_final',
                'repair_complete',
                'systems',
                'evidence',
                'boundaries',
                'complete',
                'protocol_0',
                'protocol_3',
                'protocol_complete',
                'handoff'
            ].includes(
                testShipBoard
            )
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        shipEvidencePreview: testShipBoard,
                        shipEvidencePreviewSize:
                            testShipBoardSize === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        const testCurrentVeil = urlParams.get('testCurrentVeil');
        const testCurrentVeilSize = urlParams.get(
            'testCurrentVeilSize'
        );
        if (
            isLocalPreview &&
            [
                'available',
                'active',
                'verification',
                'complete'
            ].includes(testCurrentVeil)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        currentVeilPreview: testCurrentVeil,
                        currentVeilPreviewSize:
                            testCurrentVeilSize === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        const testIdentityArchive = urlParams.get(
            'testIdentityArchive'
        );
        const testIdentityArchiveSize = urlParams.get(
            'testIdentityArchiveSize'
        );
        if (
            isLocalPreview &&
            [
                'identity',
                'living_form',
                'shared_journey',
                'inheritance',
                'shared_inheritance',
                'complete'
            ].includes(testIdentityArchive)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    startSceneWhenReady(game, 'CreatureProfileScene', {
                        identityArchivePreview: testIdentityArchive,
                        identityArchivePreviewSize:
                            testIdentityArchiveSize === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        if (isLocalPreview && urlParams.has('testProfilePortrait')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    startSceneWhenReady(game, 'CreatureProfileScene', {
                        profilePortraitPreview: true,
                        profilePortraitPreviewSize:
                            urlParams.get('previewSize') === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        if (isLocalPreview && urlParams.has('testWelcomeBackPortrait')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('WelcomeBackScene', {
                        returnPortraitPreview: true,
                        offlineMinutes: 143,
                        returnScene: 'GameScene',
                        events: [
                            {
                                icon: '✦',
                                creatureName: 'Nova',
                                result: 'Mapped a new current path near the Signal Garden.'
                            },
                            {
                                icon: '◇',
                                creatureName: 'Nova',
                                result: 'Shared gathered light with a rescued guardian.'
                            },
                            {
                                icon: '⌖',
                                creatureName: 'Nova',
                                result: 'Kept watch beside the Wanderer-77 repair bay.'
                            }
                        ]
                    });
                }, 100);
            });
        }

        const hasSanctuaryDecorPreview = urlParams.has('testSanctuaryDecor');
        const testSanctuaryDecor = hasSanctuaryDecorPreview
            ? Number(urlParams.get('testSanctuaryDecor'))
            : Number.NaN;
        if (
            isLocalPreview &&
            hasSanctuaryDecorPreview &&
            Number.isFinite(testSanctuaryDecor) &&
            testSanctuaryDecor >= 0 &&
            testSanctuaryDecor <= 3
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.stop('HatchingScene');
                    game.scene.start('GameScene', {
                        sanctuaryDecorationPreview: testSanctuaryDecor
                    });
                }, 100);
            });
        }

        const testKinshipBeacon = urlParams.get(
            'testKinshipBeacon'
        );
        if (isLocalPreview && testKinshipBeacon !== null) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.stop('HatchingScene');
                    game.scene.start('GameScene', {
                        kinshipBeaconPreview:
                            testKinshipBeacon === 'shared'
                                ? 'shared'
                                : 'local'
                    });
                }, 100);
            });
        }

        const testFusionLandmark = urlParams.get(
            'testFusionLandmark'
        );
        if (
            isLocalPreview &&
            [
                'dormant',
                'calibrating',
                'maturing',
                'ready'
            ].includes(testFusionLandmark)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.stop('HatchingScene');
                    game.scene.start('GameScene', {
                        fusionLandmarkPreview: testFusionLandmark
                    });
                }, 100);
            });
        }

        if (isLocalPreview && urlParams.has('testFusionStory')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.stop('HatchingScene');
                    game.scene.start('GameScene', {
                        fusionStoryPreview: true,
                        fusionStoryPreviewSize:
                            urlParams.get('testFusionStory') === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        // Local, non-mutating authored Living Signal encounter previews.
        const testLivingSignal = urlParams.get('testLivingSignal');
        const testLivingSignalProgressParam = urlParams.get(
            'testLivingSignalProgress'
        );
        const testLivingSignalProgress = testLivingSignalProgressParam === null
            ? Number.NaN
            : Number(testLivingSignalProgressParam);
        if (
            isLocalPreview &&
            ['echo_bloom', 'memory_stone', 'rootlight'].includes(testLivingSignal)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        livingSignalPreview: testLivingSignal,
                        livingSignalPreviewSize:
                            urlParams.get('previewSize') === 'mobile'
                                ? 'mobile'
                                : null,
                        livingSignalProgressPreview: Number.isFinite(
                            testLivingSignalProgress
                        )
                            ? Math.max(0, Math.min(100, testLivingSignalProgress)) / 100
                            : null
                    });
                }, 100);
            });
        }

        const testMissionBriefing = urlParams.get('testMissionBriefing');
        const testMissionBriefingSize = urlParams.get('testMissionBriefingSize');
        if (isLocalPreview && ['care', 'fieldKit', 'signals', 'gate'].includes(testMissionBriefing)) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        missionBriefingPreview: testMissionBriefing,
                        missionBriefingPreviewSize: testMissionBriefingSize === 'mobile' ?
                            'mobile' :
                            null
                    });
                }, 100);
            });
        }

        // Local, non-mutating preview of the first sanctuary controls handoff.
        if (isLocalPreview && urlParams.has('testControls')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', { controlsPreview: true });
                }, 100);
            });
        }

        // Local, non-mutating preview of the opening Project Beacon story.
        if (isLocalPreview && urlParams.has('testStory')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.getScenes(true).forEach(scene => {
                        game.scene.stop(scene.scene.key);
                    });
                    game.scene.start('GameScene', { storyPreview: true });
                }, 100);
            });
        }

        // Local, non-mutating preview of the first-contact naming screen.
        if (isLocalPreview && urlParams.has('testSoulReveal')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('SoulRevealScene', {
                        portraitPreviewImage: urlParams.get('testSoulReveal') === 'portrait'
                            ? '/marketing/nova.webp'
                            : null,
                        portraitPreviewFailure: urlParams.get('testSoulReveal') === 'fallback',
                        portraitPreviewSpecies: 'nebulaSprite'
                    });
                }, 100);
            });
        }

        // Local, non-mutating Project Beacon mission-log previews.
        const testBeaconLog = urlParams.get('testBeaconLog');
        const testBeaconLogSize = urlParams.get('testBeaconLogSize');
        if (
            isLocalPreview &&
            ['mission', 'recovery', 'archive', 'memory'].includes(
                testBeaconLog
            )
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        beaconLogPreview: testBeaconLog,
                        beaconLogPreviewSize:
                            testBeaconLogSize === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        // Local, non-mutating settings preview.
        if (isLocalPreview && urlParams.has('testSettings')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', { settingsPreview: true });
                }, 100);
            });
        }

        // Local, non-mutating checkpoint recovery preview.
        const testRecovery = urlParams.get('testRecovery');
        if (
            isLocalPreview
            && ['checkpoint', 'restart', 'agency'].includes(testRecovery)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('PlatformerLevel', {
                        recoveryPreview: testRecovery,
                        forceMobileControls:
                            urlParams.get('forceMobileControls') === '1'
                    });
                }, 100);
            });
        }

        const testGuardianAlly = urlParams.get('testGuardianAlly');
        if (
            isLocalPreview &&
            [
                'elder_treant',
                'crystal_golem',
                'nyxvoral',
                'shadow_phoenix',
                'cosmic_titan',
                'void_empress'
            ].includes(testGuardianAlly)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('PlatformerLevel', {
                        guardianAllyPreview: testGuardianAlly,
                        forceMobileControls:
                            urlParams.get('forceMobileControls') === '1'
                    });
                }, 100);
            });
        }

        const testStance = urlParams.get('testStance');
        const testStanceSize = urlParams.get('testStanceSize');
        if (
            isLocalPreview &&
            ['armed', 'complete'].includes(testStance)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('PlatformerLevel', {
                        centeringStancePreview: testStance,
                        centeringStancePreviewSize:
                            testStanceSize === 'mobile'
                                ? 'mobile'
                                : null,
                        forceMobileControls:
                            urlParams.get('forceMobileControls') === '1'
                    });
                }, 100);
            });
        }

        // Local, non-mutating Care Corner preview for onboarding and responsive QA.
        if (isLocalPreview && urlParams.get('testCare') === 'panel') {
            let carePreviewBootChecks = 0;
            const showCarePanelPreview = () => {
                if (!game.isBooted) {
                    carePreviewBootChecks++;
                    if (carePreviewBootChecks <= 40) {
                        setTimeout(showCarePanelPreview, 50);
                    }
                    return;
                }

                setTimeout(() => {
                    game.scene.stop('HatchingScene');
                    game.scene.start('GameScene', { carePanelPreview: true });
                }, 250);
            };

            showCarePanelPreview();
        }

        const testCheckIn = urlParams.get('testCheckIn');
        if (
            isLocalPreview &&
            ['curious', 'playful', 'gentle', 'wise', 'energetic'].includes(
                testCheckIn
            )
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('GameScene', {
                        checkInPreview: testCheckIn,
                        checkInBonusPreview:
                            urlParams.get('testCheckInBonus') === '1'
                    });
                }, 100);
            });
        }

        // Local, non-saving Fusion Pod previews for maturity requirements and selection QA.
        const testFusion = urlParams.get('testFusion');
        if (isLocalPreview && ['eligible', 'ready', 'journey', 'blocked', 'hatch', 'consent'].includes(testFusion)) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    const now = Date.now();
                    const createPreviewCreature = (id, name, stage, daysAlive, rarity) => {
                        const genes = window.CreatureGenetics
                            ?.generateCreatureGenetics?.(rarity) || {
                                id: `genes_${id}`,
                                rarity,
                                species: 'hybrid',
                                traits: {
                                    bodyShape: { type: 'balanced', intensity: 0.5 },
                                    colorGenome: {},
                                    features: {}
                                },
                                personality: {},
                                cosmicAffinity: { element: 'crystal' }
                            };
                        const birthDate = now - daysAlive * 24 * 60 * 60 * 1000;
                        return {
                            id,
                            name,
                            genes,
                            dna: genes,
                            rarity,
                            generation: 1,
                            hatchTime: birthDate,
                            lifecycle: {
                                birthDate,
                                stage
                            }
                        };
                    };
                    const previewCreatures = ['eligible', 'ready', 'journey', 'hatch', 'consent'].includes(testFusion)
                        ? [
                            createPreviewCreature('preview_adult', 'Stardust', 'adult', 3, 'rare'),
                            createPreviewCreature('preview_elder', 'Moonglow', 'elder', 12, 'epic'),
                            createPreviewCreature('preview_baby', 'Newlight', 'baby', 0, 'common')
                        ]
                        : [
                            createPreviewCreature('preview_baby', 'Newlight', 'baby', 0, 'common'),
                            createPreviewCreature('preview_juvenile', 'Sprig', 'juvenile', 1, 'uncommon')
                        ];

                    if (testFusion === 'hatch') {
                        const offspringGenes = window.CreatureGenetics
                            ?.generateCreatureGenetics?.('rare') || {
                                id: 'preview_fusion_genes',
                                rarity: 'rare',
                                species: 'hybrid',
                                cosmicAffinity: { element: 'crystal' }
                            };
                        game.scene.start('BreedingHatchScene', {
                            offspringGenes,
                            offspringData: {
                                creatureId: 'preview_fusion_child',
                                generation: 2,
                                rarity: 'rare',
                                parentIds: ['preview_adult', 'preview_elder'],
                                parentNames: ['Stardust', 'Moonglow'],
                                inheritedTraits: {
                                    fromParent1: ['Body form', 'color'],
                                    fromParent2: ['Affinity', 'markings']
                                }
                            },
                            parent1: previewCreatures[0],
                            parent2: previewCreatures[1],
                            birthEvents: [],
                            hasRareEvent: false,
                            previewOnly: true,
                            fusionTransaction: {
                                schemaVersion: 1,
                                operationId: 'preview_fusion_hatch',
                                parentIds: ['preview_adult', 'preview_elder'],
                                offspringIds: ['preview_fusion_child'],
                                offspringCount: 1,
                                createdAt: now,
                                status: 'pending'
                            }
                        });
                        return;
                    }

                    game.scene.start('FusionPodScene', {
                        previewCreatures,
                        previewAutoSelect: ['ready', 'journey'].includes(testFusion),
                        previewAutoStart: testFusion === 'journey',
                        previewConsentOnly: testFusion === 'consent'
                    });
                }, 100);
            });
        }

        // Local, non-saving Shared Fusion previews for protected-link UI QA.
        const testSharedFusion = urlParams.get('testSharedFusion');
        if (
            isLocalPreview &&
            ['pod', 'home', 'waiting', 'paired', 'staged', 'reveal'].includes(
                testSharedFusion
            )
        ) {
            let sharedFusionPreviewBootChecks = 0;
            const showSharedFusionPreview = () => {
                if (!game.isBooted) {
                    sharedFusionPreviewBootChecks++;
                    if (sharedFusionPreviewBootChecks <= 60) {
                        setTimeout(showSharedFusionPreview, 50);
                    }
                    return;
                }
                setTimeout(() => {
                    const now = Date.now();
                    const invitationId =
                        '824363b2-d374-4b44-bf7f-1d7a177fa074';
                    const operationId = 'fusion_shared_preview_23';
                    const parent = {
                        id: 'preview_shared_parent',
                        name: 'Stardust',
                        rarity: 'rare',
                        generation: 1,
                        hatchTime: now - 5 * 24 * 60 * 60 * 1000,
                        lifecycle: {
                            birthDate:
                                now - 5 * 24 * 60 * 60 * 1000,
                            stage: 'adult'
                        },
                        stats: { happiness: 88 },
                        mood: { current: 'steady' },
                        genes: {
                            rarity: 'rare',
                            cosmicAffinity: { element: 'crystal' }
                        }
                    };
                    const status = testSharedFusion === 'reveal'
                        ? 'committed'
                        : testSharedFusion === 'pod'
                            ? 'home'
                            : testSharedFusion;
                    let invitation = {
                        invitationId,
                        role: 'host',
                        status,
                        ownParentId: parent.id,
                        peerSignal: ['paired', 'staged', 'committed'].includes(
                            status
                        )
                            ? {
                                rarity: 'epic',
                                affinity: 'verdant',
                                generation: 2,
                                stage: 'elder'
                            }
                            : null,
                        hostConfirmed: status === 'paired'
                            ? false
                            : ['staged', 'committed'].includes(status),
                        guestConfirmed: ['paired', 'staged', 'committed']
                            .includes(status),
                        createdAt: new Date(now).toISOString(),
                        expiresAt: new Date(
                            now + 15 * 60 * 1000
                        ).toISOString(),
                        operationId: ['staged', 'committed'].includes(status)
                            ? operationId
                            : null,
                        ownOffspringId: ['staged', 'committed'].includes(status)
                            ? 'creature_shared_preview_23'
                            : null,
                        ownNameSubmitted: status === 'committed',
                        code: status === 'waiting'
                            ? '23AF-BEAC-077A'
                            : null,
                        terminal: status === 'committed'
                    };
                    const child = {
                        id: 'creature_shared_preview_23',
                        name: 'Beacon',
                        rarity: 'epic',
                        generation: 2,
                        cosmicAffinity: { element: 'verdant' },
                        genes: {
                            rarity: 'epic',
                            cosmicAffinity: { element: 'verdant' }
                        }
                    };
                    let pendingReveal = status === 'committed'
                        ? {
                            invitationId,
                            operationId,
                            creatureId: child.id,
                            receivedAt: now,
                            creature: child
                        }
                        : null;
                    const execution = {
                        invitationId,
                        operationId,
                        role: 'host',
                        status: 'staged',
                        offspring: {
                            offspringGenes: child.genes,
                            offspringData: {
                                creatureId: child.id,
                                rarity: child.rarity,
                                generation: child.generation,
                                dualAffinity: {
                                    primary: 'verdant',
                                    secondary: 'crystal'
                                }
                            }
                        },
                        compatibilityScore: 83,
                        birthEvents: [],
                        replay: false
                    };
                    const gameState = {
                        get(path) {
                            if (
                                path ===
                                'breedingShrine.sharedFusion.activeInvitation'
                            ) {
                                return testSharedFusion === 'home'
                                    ? null
                                    : invitation;
                            }
                            return null;
                        },
                        set() {},
                        save() {},
                        getPendingSharedFusionReveal() {
                            return pendingReveal;
                        },
                        acknowledgeSharedFusionReveal() {
                            pendingReveal = null;
                            return true;
                        }
                    };
                    const service = {
                        async create() {
                            invitation = {
                                ...invitation,
                                status: 'waiting',
                                code: '23AF-BEAC-077A',
                                terminal: false
                            };
                            return invitation;
                        },
                        async join() {
                            invitation = {
                                ...invitation,
                                status: 'paired',
                                code: null,
                                peerSignal: {
                                    rarity: 'epic',
                                    affinity: 'verdant',
                                    generation: 2,
                                    stage: 'elder'
                                },
                                hostConfirmed: false,
                                guestConfirmed: true,
                                terminal: false
                            };
                            return invitation;
                        },
                        async get() {
                            return invitation;
                        },
                        async confirm() {
                            invitation = {
                                ...invitation,
                                status: 'staged',
                                hostConfirmed: true,
                                guestConfirmed: true,
                                operationId,
                                ownOffspringId: child.id
                            };
                            return invitation;
                        },
                        async execute() {
                            return execution;
                        },
                        async submitName(_invitationId, name) {
                            child.name = String(name || '').trim() ||
                                child.name;
                            pendingReveal = {
                                invitationId,
                                operationId,
                                creatureId: child.id,
                                receivedAt: Date.now(),
                                creature: child
                            };
                            invitation = {
                                ...invitation,
                                status: 'committed',
                                ownNameSubmitted: true,
                                terminal: true
                            };
                            return { invitation };
                        },
                        async cancel() {
                            invitation = {
                                ...invitation,
                                status: 'cancelled',
                                terminal: true
                            };
                            return invitation;
                        },
                        destroy() {}
                    };
                    const cloudSave = {
                        async synchronize() {}
                    };

                    game.scene.stop('HatchingScene');
                    game.scene.start('FusionPodScene', {
                        previewCreatures: [parent],
                        previewSharedFusionAvailable: true
                    });
                    if (testSharedFusion === 'pod') return;
                    setTimeout(() => {
                        const scene = game.scene.getScene('FusionPodScene');
                        window.__sharedFusionPreviewModal?.destroy?.();
                        window.__sharedFusionPreviewModal =
                            new SharedFusionModal(scene, {
                                service,
                                gameState,
                                cloudSave
                            });
                        window.__sharedFusionPreviewModal.show({
                            parents: [parent]
                        });
                    }, 150);
                }, 100);
            };
            showSharedFusionPreview();
        }

        if (!hasLocalQaRoute) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    const resumableFusion = window.GameState
                        ?.getPendingFusionHatchData?.();
                    if (!resumableFusion) return;

                    game.scene.stop('HatchingScene');
                    game.scene.stop('GameScene');
                    game.scene.start('BreedingHatchScene', resumableFusion);
                }, 250);
            });
        }

        if (isLocalPreview && urlParams.has('testAchievements')) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    startSceneWhenReady(
                        game,
                        'AchievementMenuScene',
                        undefined,
                        { stopScenes: ['HatchingScene'] }
                    );
                }, 100);
            });
        }

        // Local Cloud Save previews. The restricted fixture never reads or writes player storage.
        const testCloudSave = urlParams.get('testCloudSave');
        if (
            isLocalPreview
            && ['live', 'under13', 'restored', 'uploaded'].includes(testCloudSave)
        ) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    const activeScenes = game.scene.getScenes(true);
                    const previewScene = activeScenes.find(
                        scene => scene.scene?.key === 'HatchingScene'
                    ) || activeScenes[activeScenes.length - 1];
                    if (!previewScene?.cameras?.main) {
                        console.warn('[CloudSave] Preview skipped because no active scene is ready.');
                        return;
                    }
                    const restrictedManager = {
                        getStatus: () => ({
                            configured: true,
                            enabled: false,
                            ageEligible: false,
                            ageGroup: 'age_under_13',
                            status: 'restricted',
                            lastSyncedAt: null,
                            hasError: false
                        })
                    };
                    const syncedPreviewManager = {
                        getStatus: () => ({
                            configured: true,
                            enabled: true,
                            ageEligible: true,
                            ageGroup: 'age_18_plus',
                            status: 'synced',
                            lastSyncedAt: Date.UTC(2026, 6, 28, 12, 30),
                            lastSyncDirection: testCloudSave,
                            hasError: false
                        })
                    };
                    previewScene.cloudSavePreviewModal = new CloudSaveSettingsModal(previewScene, {
                        getManager: () => {
                            if (testCloudSave === 'under13') return restrictedManager;
                            if (['restored', 'uploaded'].includes(testCloudSave)) {
                                return syncedPreviewManager;
                            }
                            return window.CloudSave;
                        }
                    });
                    previewScene.cloudSavePreviewModal.show();
                }, 100);
            });
        }

        if (isLocalPreview && testDebrief >= 1 && testDebrief <= 5) {
            game.events.once('ready', () => {
                setTimeout(() => {
                    game.scene.start('HubWorldScene', {
                        previewSize:
                            urlParams.get('previewSize') === 'mobile'
                                ? 'mobile'
                                : null
                    });
                }, 100);
            });
        }

        // Handle page unload - save game state with error handling
        window.addEventListener('beforeunload', () => {
            try {
                // Clean up resources
                if (window.memoryManager) {
                    window.memoryManager.performCleanup();
                }

                // Save game state
                if (GameState && typeof GameState.save === 'function') {
                    GameState.save();
                    console.log('💾 Final save completed');
                }
                cloudSaveManager?.flush().catch(() => {
                    // The local save has already completed; retry cloud sync next launch.
                });

                pageVisibilityController?.detach();
                pageVisibilityController = null;

                // Destroy responsive manager
                if (responsiveManager) {
                    responsiveManager.destroy();
                }

                // Destroy UX enhancements
                if (uxEnhancements) {
                    uxEnhancements.destroy();
                }
            } catch (saveError) {
                console.error('💾❌ Final save failed:', saveError);
                // Don't show error message here as page is unloading
            }
        });

        // Pause only scenes that are currently running. Scenes already paused by
        // menus or modals must stay paused when the player returns to the tab.
        pageVisibilityController = new PageVisibilityController({
            game,
            documentRef: document,
            onHidden: () => {
                if (GameState) {
                    GameState.save();
                }
                cloudSaveManager?.flush().catch((error) => {
                    console.warn('[CloudSave] Background sync deferred:', error);
                });
            }
        });
        pageVisibilityController.attach();

        // Set up periodic health checks with memory monitoring
        setupHealthChecks(game);

        // Add keyboard shortcuts for accessibility
        setupKeyboardShortcuts(game);

        console.log('🎮✅ Game initialized successfully!');

    } catch (initError) {
        console.error('💥 Critical initialization error:', initError);
        if (window.errorHandler) {
            window.errorHandler.handleError({
                type: 'initialization',
                message: 'Failed to start the game',
                error: initError,
                severity: 'error'
            });
        }
    }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeGame();
} else {
    window.addEventListener('DOMContentLoaded', initializeGame);
}

// Function to set up periodic health checks
function setupHealthChecks(game) {
    // Check game health every 30 seconds
    setInterval(() => {
        try {
            // Check if game is still running
            if (!game || game.isDestroyed) {
                console.warn('⚠️ Game instance appears to be destroyed');
                return;
            }

            // Check if GameState is responsive
            if (GameState && typeof GameState.get === 'function') {
                GameState.get('session.currentScene'); // Simple health check
            }

            // Get memory stats from memory manager
            if (window.memoryManager) {
                const memoryStats = window.memoryManager.getMemoryStats();
                if (memoryStats.available) {
                    if (memoryStats.percentage > 80) {
                        console.warn(`⚠️ High memory usage: ${memoryStats.used}MB (${memoryStats.percentage}%)`);
                        // Trigger cleanup
                        window.memoryManager.performCleanup();
                    }
                }
            }

        } catch (healthError) {
            console.warn('⚠️ Health check failed:', healthError);
        }
    }, 30000); // 30 seconds
}

// Function to set up keyboard shortcuts
function setupKeyboardShortcuts(game) {
    document.addEventListener('keydown', (event) => {
        // Alt + F for fullscreen
        if (event.altKey && event.key === 'f') {
            if (window.responsiveManager) {
                window.responsiveManager.toggleFullscreen();
            }
        }

        // Alt + D for dark mode
        if (event.altKey && event.key === 'd') {
            if (window.UITheme) {
                window.UITheme.toggleDarkMode();
            }
        }

        // Alt + M to mute/unmute
        if (event.altKey && event.key === 'm') {
            if (window.AudioManager) {
                const muted = window.AudioManager.toggleMute();
                console.log(`Audio ${muted ? 'muted' : 'unmuted'}`);
            }
        }

        // Escape to pause/unpause
        if (event.key === 'Escape') {
            if (game && game.scene) {
                try {
                    const activeScene = game.scene.getScenes(true)[0];
                    if (activeScene && activeScene.scene.isActive()) {
                        if (activeScene.scene.isPaused()) {
                            activeScene.scene.resume();
                        } else {
                            activeScene.scene.pause();
                        }
                    }
                } catch (e) {
                    // Scene might be transitioning, ignore pause request
                }
            }
        }
    });
}
