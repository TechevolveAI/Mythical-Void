/**
 * SceneLoader - Lazy Scene Loading Utility
 *
 * Handles dynamic scene imports with:
 * - Loading states during chunk downloads
 * - Preloading for anticipated transitions
 * - Error handling and fallbacks
 * - Scene registration with Phaser
 *
 * Usage:
 *   // Preload a scene chunk
 *   await SceneLoader.preload('ShopScene');
 *
 *   // Load and start a scene
 *   await SceneLoader.loadAndStart(game, 'ShopScene', data);
 *
 *   // Preload multiple scenes
 *   SceneLoader.preloadChunk('menus');
 */

import { devLog, devWarn } from './devLogger.js';

class SceneLoaderClass {
    constructor() {
        // Track loaded scenes and their modules
        this.loadedScenes = new Set();
        this.loadedModules = new Map();  // Store actual module references

        // Track loading promises (prevent duplicate loads)
        this.loadingPromises = new Map();

        // Scene to chunk mapping
        // Each level gets its own chunk for optimal lazy loading
        this.sceneChunks = {
            // Onboarding chunk
            HatchingScene: 'onboarding',
            PersonalityScene: 'onboarding',
            NamingScene: 'onboarding',
            SoulRevealScene: 'onboarding',

            // Gameplay chunk
            GameScene: 'gameplay',

            // Hub and base class (always needed for levels)
            HubWorldScene: 'levels-hub',
            PlatformerLevelScene: 'levels-hub',
            VictoryScene: 'levels-hub',

            // Individual level chunks (lazy loaded on demand)
            CrystalCavesLevel: 'level-crystal',
            ReefLevel: 'level-reef',
            MythicalForestLevel: 'level-forest',
            AuroraDepthsLevel: 'level-aurora',
            FinalVoidLevel: 'level-final',

            // Menus chunk
            ShopScene: 'menus',
            InventoryScene: 'menus',
            AchievementMenuScene: 'menus',
            CreatureProfileScene: 'menus',

            // Advanced chunk
            FusionPodScene: 'advanced',
            BreedingHatchScene: 'advanced',
            VoidMiniGameScene: 'advanced',
            CreatureGatheringScene: 'advanced',
            WelcomeBackScene: 'advanced',
            AbilitySelectionScene: 'advanced'
        };

        // Dynamic import functions for each scene
        // Using dynamic imports enables code splitting - each level loads separately
        this.sceneImports = {
            // Onboarding scenes
            HatchingScene: () => import('../scenes/HatchingScene.js'),
            PersonalityScene: () => import('../scenes/PersonalityScene.js'),
            NamingScene: () => import('../scenes/NamingScene.js'),
            SoulRevealScene: () => import('../scenes/SoulRevealScene.js'),

            // Gameplay
            GameScene: () => import('../scenes/GameScene.js'),

            // Hub and core level infrastructure
            HubWorldScene: () => import('../scenes/HubWorldScene.js'),
            PlatformerLevelScene: () => import('../scenes/PlatformerLevelScene.js'),
            VictoryScene: () => import('../scenes/VictoryScene.js'),

            // Individual levels - each loads on demand
            CrystalCavesLevel: () => import('../scenes/levels/CrystalCavesLevel.js'),
            ReefLevel: () => import('../scenes/levels/ReefLevel.js'),
            MythicalForestLevel: () => import('../scenes/levels/MythicalForestLevel.js'),
            AuroraDepthsLevel: () => import('../scenes/levels/AuroraDepthsLevel.js'),
            FinalVoidLevel: () => import('../scenes/levels/FinalVoidLevel.js'),

            // Menus
            ShopScene: () => import('../scenes/ShopScene.js'),
            InventoryScene: () => import('../scenes/InventoryScene.js'),
            AchievementMenuScene: () => import('../scenes/AchievementMenuScene.js'),
            CreatureProfileScene: () => import('../scenes/CreatureProfileScene.js'),

            // Advanced
            FusionPodScene: () => import('../scenes/FusionPodScene.js'),
            BreedingHatchScene: () => import('../scenes/BreedingHatchScene.js'),
            VoidMiniGameScene: () => import('../scenes/VoidMiniGameScene.js'),
            CreatureGatheringScene: () => import('../scenes/CreatureGatheringScene.js'),
            WelcomeBackScene: () => import('../scenes/WelcomeBackScene.js'),
            AbilitySelectionScene: () => import('../scenes/AbilitySelectionScene.js')
        };

        // Chunk preload functions (load all scenes in a chunk)
        this.chunkPreloaders = {
            onboarding: () => Promise.all([
                this.preload('HatchingScene'),
                this.preload('PersonalityScene'),
                this.preload('NamingScene'),
                this.preload('SoulRevealScene')
            ]),
            gameplay: () => this.preload('GameScene'),
            // Hub infrastructure only - levels load individually
            'levels-hub': () => Promise.all([
                this.preload('HubWorldScene'),
                this.preload('PlatformerLevelScene'),
                this.preload('VictoryScene')
            ]),
            // Individual level preloaders
            'level-crystal': () => this.preload('CrystalCavesLevel'),
            'level-reef': () => this.preload('ReefLevel'),
            'level-forest': () => this.preload('MythicalForestLevel'),
            'level-aurora': () => this.preload('AuroraDepthsLevel'),
            'level-final': () => this.preload('FinalVoidLevel'),
            menus: () => Promise.all([
                this.preload('ShopScene'),
                this.preload('InventoryScene'),
                this.preload('AchievementMenuScene'),
                this.preload('CreatureProfileScene')
            ]),
            advanced: () => Promise.all([
                this.preload('FusionPodScene'),
                this.preload('BreedingHatchScene'),
                this.preload('VoidMiniGameScene')
            ])
        };

        // Map level scene names to their gate IDs for preloading
        this.levelSceneMap = {
            'crystal_caves': 'CrystalCavesLevel',
            'stellar_reef': 'ReefLevel',
            'mythical_forest': 'MythicalForestLevel',
            'aurora_depths': 'AuroraDepthsLevel',
            'final_void': 'FinalVoidLevel'
        };
    }

    /**
     * Preload a specific level by its gate ID
     * Called from HubWorldScene when player hovers over a gate
     * @param {string} gateId - The gate ID (e.g., 'crystal_caves')
     */
    async preloadLevel(gateId) {
        const sceneName = this.levelSceneMap[gateId];
        if (sceneName) {
            devLog(`[SceneLoader] Preloading level for gate: ${gateId}`);
            return this.preload(sceneName);
        }
        return null;
    }

    /**
     * Preload a scene module (downloads but doesn't register)
     * @param {string} sceneName - Name of the scene to preload
     * @returns {Promise<Object>} - The loaded module
     */
    async preload(sceneName) {
        // Already loaded - return the stored module
        if (this.loadedScenes.has(sceneName)) {
            devLog(`[SceneLoader] ${sceneName} already loaded`);
            return this.loadedModules.get(sceneName);
        }

        // Already loading - return existing promise
        if (this.loadingPromises.has(sceneName)) {
            devLog(`[SceneLoader] ${sceneName} already loading, awaiting...`);
            return this.loadingPromises.get(sceneName);
        }

        const importFn = this.sceneImports[sceneName];
        if (!importFn) {
            devWarn(`[SceneLoader] Unknown scene: ${sceneName}`);
            return null;
        }

        // Start loading
        devLog(`[SceneLoader] Preloading ${sceneName}...`);
        const loadPromise = importFn()
            .then(module => {
                this.loadedScenes.add(sceneName);
                this.loadedModules.set(sceneName, module);  // Store the module reference
                this.loadingPromises.delete(sceneName);
                devLog(`[SceneLoader] ${sceneName} preloaded successfully`);
                return module;
            })
            .catch(error => {
                this.loadingPromises.delete(sceneName);
                console.error(`[SceneLoader] Failed to preload ${sceneName}:`, error);
                throw error;
            });

        this.loadingPromises.set(sceneName, loadPromise);
        return loadPromise;
    }

    /**
     * Preload an entire chunk of scenes
     * @param {string} chunkName - Name of the chunk (onboarding, gameplay, levels, menus, advanced)
     * @returns {Promise<void>}
     */
    async preloadChunk(chunkName) {
        const preloader = this.chunkPreloaders[chunkName];
        if (!preloader) {
            devWarn(`[SceneLoader] Unknown chunk: ${chunkName}`);
            return;
        }

        devLog(`[SceneLoader] Preloading chunk: ${chunkName}`);
        await preloader();
        devLog(`[SceneLoader] Chunk ${chunkName} preloaded`);
    }

    /**
     * Load a scene and register it with Phaser
     * @param {Phaser.Game} game - The Phaser game instance
     * @param {string} sceneName - Name of the scene to load
     * @returns {Promise<boolean>} - Whether the scene was loaded successfully
     */
    async loadScene(game, sceneName) {
        if (!game || !game.scene) {
            console.error('[SceneLoader] Invalid game instance');
            return false;
        }

        // Check if scene is already in Phaser's scene manager
        if (game.scene.getScene(sceneName)) {
            devLog(`[SceneLoader] ${sceneName} already registered`);
            return true;
        }

        try {
            // Show loading state
            if (window.UXEnhancements) {
                window.UXEnhancements.showLoading(`Loading ${sceneName}...`);
            }

            // Load the module
            const module = await this.preload(sceneName);
            if (!module) {
                throw new Error(`Module not found for ${sceneName}`);
            }

            // Get the scene class (default export)
            const SceneClass = module.default;
            if (!SceneClass) {
                throw new Error(`No default export found for ${sceneName}`);
            }

            // Register with Phaser
            game.scene.add(sceneName, SceneClass, false);
            devLog(`[SceneLoader] ${sceneName} registered with Phaser`);

            // Hide loading state
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }

            return true;
        } catch (error) {
            console.error(`[SceneLoader] Failed to load ${sceneName}:`, error);

            // Hide loading state
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }

            return false;
        }
    }

    /**
     * Load and start a scene
     * @param {Phaser.Game} game - The Phaser game instance
     * @param {string} sceneName - Name of the scene to start
     * @param {Object} data - Data to pass to the scene
     * @returns {Promise<boolean>} - Whether the scene was started successfully
     */
    async loadAndStart(game, sceneName, data = {}) {
        const loaded = await this.loadScene(game, sceneName);
        if (loaded) {
            game.scene.start(sceneName, data);
            return true;
        }
        return false;
    }

    /**
     * Load and launch a scene (parallel to current scene)
     * @param {Phaser.Game} game - The Phaser game instance
     * @param {string} sceneName - Name of the scene to launch
     * @param {Object} data - Data to pass to the scene
     * @returns {Promise<boolean>} - Whether the scene was launched successfully
     */
    async loadAndLaunch(game, sceneName, data = {}) {
        const loaded = await this.loadScene(game, sceneName);
        if (loaded) {
            game.scene.launch(sceneName, data);
            return true;
        }
        return false;
    }

    /**
     * Get preload hints for anticipated transitions
     * Call this to preload scenes the player is likely to visit next
     * @param {string} currentScene - The current scene name
     */
    preloadAnticipated(currentScene) {
        // Preload based on current scene
        switch (currentScene) {
            case 'HatchingScene':
                // User will likely go to PersonalityScene next
                this.preload('PersonalityScene');
                this.preload('NamingScene');
                break;

            case 'PersonalityScene':
                // User will go to NamingScene then SoulRevealScene
                this.preload('NamingScene');
                this.preload('SoulRevealScene');
                break;

            case 'NamingScene':
                // User will go to SoulRevealScene then GameScene
                this.preload('SoulRevealScene');
                this.preload('GameScene');
                break;

            case 'SoulRevealScene':
                // User will go to GameScene
                this.preload('GameScene');
                break;

            case 'GameScene':
                // User might access menus or hub
                // Use requestIdleCallback to preload during idle time
                if (typeof requestIdleCallback !== 'undefined') {
                    requestIdleCallback(() => {
                        this.preload('ShopScene');
                        this.preload('InventoryScene');
                    }, { timeout: 5000 });
                    requestIdleCallback(() => {
                        this.preload('HubWorldScene');
                    }, { timeout: 10000 });
                }
                break;

            case 'HubWorldScene':
                // User will likely enter a level
                this.preloadChunk('levels');
                break;

            default:
                break;
        }
    }

    /**
     * Check if a scene is loaded
     * @param {string} sceneName - Name of the scene
     * @returns {boolean}
     */
    isLoaded(sceneName) {
        return this.loadedScenes.has(sceneName);
    }

    /**
     * Get loading statistics
     * @returns {Object} - Stats about loaded scenes
     */
    getStats() {
        return {
            loadedCount: this.loadedScenes.size,
            loadedScenes: Array.from(this.loadedScenes),
            pendingCount: this.loadingPromises.size,
            pendingScenes: Array.from(this.loadingPromises.keys())
        };
    }
}

// Export singleton instance
const SceneLoader = new SceneLoaderClass();

// Also export to window for global access
if (typeof window !== 'undefined') {
    window.SceneLoader = SceneLoader;
}

export default SceneLoader;
export { SceneLoader };
