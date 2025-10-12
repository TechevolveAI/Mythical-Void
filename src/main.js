import { Phaser } from './global-init.js';
import HatchingScene from './scenes/HatchingScene.js';
import PersonalityScene from './scenes/PersonalityScene.js';
import NamingScene from './scenes/NamingScene.js';
import GameScene from './scenes/GameScene.js';

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

// Cache frequently used globals
const GameState = window.GameState;

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
        console.log('🚀 Initializing Mythical Creature Game...');
        
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
        
        if (typeof GameState === 'undefined') {
            throw new Error('GameState system not loaded');
        }
        
        if (typeof GraphicsEngine === 'undefined') {
            throw new Error('GraphicsEngine system not loaded');
        }
        
        if (typeof HatchingScene === 'undefined' || typeof NamingScene === 'undefined' || typeof GameScene === 'undefined') {
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
        
        // Game configuration object with responsive settings
        const config = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,
            backgroundColor: '#87CEEB', // Sky blue background
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [HatchingScene, PersonalityScene, NamingScene, GameScene],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: window.innerWidth,
                height: window.innerHeight,
                min: {
                    width: 800,
                    height: 600
                },
                max: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            },
            input: {
                activePointers: 3, // Support multi-touch
                touch: {
                    capture: true
                }
            },
            dom: {
                createContainer: true
            },
            // Add Phaser's built-in error handling
            callbacks: {
                postBoot: function (game) {
                    console.log('🎮 Phaser game booted successfully');
                    
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
                        // Load Kid Mode config
                        fetch('src/config/kid-mode.json')
                            .then(response => response.json())
                            .then(config => {
                                kidModeManager.initialize(config);
                                console.log('✅ Kid Mode system initialized');
                            })
                            .catch(error => {
                                console.log('Kid Mode config not found, using defaults');
                                kidModeManager.initialize();
                            });
                    }

                    // Initialize Hatch Cinematics system
                    if (window.HatchCinematics) {
                        hatchCinematicsManager = window.HatchCinematics;
                        // Load cinematics config
                        fetch('src/config/hatch-cinematics.json')
                            .then(response => response.json())
                            .then(config => {
                                hatchCinematicsManager.initialize(config);
                                console.log('✅ Hatch Cinematics system initialized');
                            })
                            .catch(error => {
                                console.log('Cinematics config not found, using defaults');
                                hatchCinematicsManager.initialize();
                            });
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
                        // Load biomes config
                        fetch('src/config/biomes.json')
                            .then(response => response.json())
                            .then(config => {
                                parallaxBiome.initialize(config);
                                console.log('✅ Parallax Biome system initialized');
                            })
                            .catch(error => {
                                console.log('Biomes config not found, using defaults');
                                parallaxBiome.initialize();
                            });
                    }

                    // Initialize Creature Genetics system
                    if (window.CreatureGenetics) {
                        creatureGenetics = window.CreatureGenetics;
                        creatureGenetics.initialize();
                        console.log('✅ Creature Genetics system initialized');
                    }
                    
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
        
        // Alt + M to mute/unmute (future audio support)
        if (event.altKey && event.key === 'm') {
            console.log('Audio toggle (not yet implemented)');
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
