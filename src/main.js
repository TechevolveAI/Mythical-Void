// Import Tailwind CSS styles
import './styles/main.css';

import { Phaser, preloadModulesReady } from './global-init.js';
import HatchingScene from './scenes/HatchingScene.js';
import PersonalityScene from './scenes/PersonalityScene.js';
import NamingScene from './scenes/NamingScene.js';
import GameScene from './scenes/GameScene.js';
import ShopScene from './scenes/ShopScene.js';
import InventoryScene from './scenes/InventoryScene.js';
import BreedingShrineScene from './scenes/BreedingShrineScene.js';
import BreedingHatchScene from './scenes/BreedingHatchScene.js';
import HubWorldScene from './scenes/HubWorldScene.js';
import CreatureProfileScene from './scenes/CreatureProfileScene.js';
import WelcomeBackScene from './scenes/WelcomeBackScene.js';
import VoidMiniGameScene from './scenes/VoidMiniGameScene.js';
import PlatformerLevelScene from './scenes/PlatformerLevelScene.js';
import CrystalCavesLevel from './scenes/levels/CrystalCavesLevel.js';
import ReefLevel from './scenes/levels/ReefLevel.js';
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

// Initialize responsive manager (will be set up after Phaser loads)
let responsiveManager = null;

// Initialize UX enhancements
let uxEnhancements = null;

// Initialize Space-Mythic systems
let kidModeManager = null;
let hatchCinematicsManager = null;
let fxLibrary = null;
let parallaxBiome = null;
let creatureGenetics = null;

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
        const config = {
            type: Phaser.AUTO,
            parent: 'game',
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: '#0a0118',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [HatchingScene, PersonalityScene, NamingScene, GameScene, ShopScene, InventoryScene, BreedingShrineScene, BreedingHatchScene, HubWorldScene, CreatureProfileScene, WelcomeBackScene, VoidMiniGameScene, PlatformerLevelScene, CrystalCavesLevel, ReefLevel],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: window.innerWidth,
                height: window.innerHeight,
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
        
        // Handle visibility change (tab switching, minimize)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Pause game when hidden
                if (game && game.scene) {
                    game.scene.pause();
                }
                // Save state
                if (GameState) {
                    GameState.save();
                }
            } else {
                // Resume game when visible
                if (game && game.scene) {
                    game.scene.resume();
                }
            }
        });
        
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
                const activeScene = game.scene.getScenes(true)[0];
                if (activeScene) {
                    if (activeScene.scene.isPaused()) {
                        activeScene.scene.resume();
                    } else {
                        activeScene.scene.pause();
                    }
                }
            }
        }
    });
}
