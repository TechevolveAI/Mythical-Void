/**
 * ChunkPreloader - Intelligent Chunk Preloading
 *
 * Preloads game chunks during idle time based on user journey predictions.
 * Uses requestIdleCallback for non-blocking preloads.
 *
 * Preloading Strategy:
 * - On game boot: Preload onboarding chunks
 * - After hatching: Preload gameplay chunks
 * - In GameScene: Preload menu chunks during idle
 * - In HubWorld: Preload level chunks
 */

import { devLog } from './devLogger.js';

class ChunkPreloaderClass {
    constructor() {
        this.preloadedChunks = new Set();
        this.preloadQueue = [];
        this.isPreloading = false;
    }

    /**
     * Add a chunk to the preload queue
     * @param {Function} importFn - Dynamic import function
     * @param {string} name - Chunk name for logging
     * @param {number} priority - Lower = higher priority
     */
    queuePreload(importFn, name, priority = 5) {
        if (this.preloadedChunks.has(name)) {
            return;
        }

        this.preloadQueue.push({ importFn, name, priority });
        this.preloadQueue.sort((a, b) => a.priority - b.priority);

        this.processQueue();
    }

    /**
     * Process the preload queue during idle time
     */
    processQueue() {
        if (this.isPreloading || this.preloadQueue.length === 0) {
            return;
        }

        this.isPreloading = true;

        const schedulePreload = () => {
            if (this.preloadQueue.length === 0) {
                this.isPreloading = false;
                return;
            }

            const item = this.preloadQueue.shift();

            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                    this.preloadItem(item).then(() => {
                        schedulePreload();
                    });
                }, { timeout: 5000 });
            } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(() => {
                    this.preloadItem(item).then(() => {
                        schedulePreload();
                    });
                }, 100);
            }
        };

        schedulePreload();
    }

    /**
     * Preload a single item
     */
    async preloadItem(item) {
        if (this.preloadedChunks.has(item.name)) {
            return;
        }

        try {
            devLog(`[ChunkPreloader] Preloading: ${item.name}`);
            await item.importFn();
            this.preloadedChunks.add(item.name);
            devLog(`[ChunkPreloader] Preloaded: ${item.name}`);
        } catch (error) {
            console.warn(`[ChunkPreloader] Failed to preload ${item.name}:`, error);
        }
    }

    /**
     * Preload chunks for a specific game phase
     * @param {string} phase - Game phase (boot, hatching, gameplay, hub)
     */
    preloadForPhase(phase) {
        devLog(`[ChunkPreloader] Preloading for phase: ${phase}`);

        switch (phase) {
            case 'boot':
                // Preload onboarding scenes during boot
                // These are already statically imported, so this is just a hint
                break;

            case 'hatching':
                // Preload gameplay chunk for after hatching
                this.queuePreload(
                    () => import('../scenes/GameScene.js'),
                    'GameScene',
                    1
                );
                break;

            case 'gameplay':
                // Preload common menus
                this.queuePreload(
                    () => import('../scenes/ShopScene.js'),
                    'ShopScene',
                    3
                );
                this.queuePreload(
                    () => import('../scenes/InventoryScene.js'),
                    'InventoryScene',
                    3
                );
                this.queuePreload(
                    () => import('../scenes/HubWorldScene.js'),
                    'HubWorldScene',
                    5
                );
                break;

            case 'hub':
                // Preload level scenes
                this.queuePreload(
                    () => import('../scenes/levels/CrystalCavesLevel.js'),
                    'CrystalCavesLevel',
                    2
                );
                this.queuePreload(
                    () => import('../scenes/levels/ReefLevel.js'),
                    'ReefLevel',
                    2
                );
                this.queuePreload(
                    () => import('../scenes/levels/VoidPeaksLevel.js'),
                    'VoidPeaksLevel',
                    3
                );
                break;

            default:
                break;
        }
    }

    /**
     * Preload all non-critical chunks during idle time
     * Call this after the game is fully loaded
     */
    preloadAllDuringIdle() {
        devLog('[ChunkPreloader] Starting idle preload of all chunks');

        // Queue all chunks with low priority
        const chunks = [
            { fn: () => import('../scenes/ShopScene.js'), name: 'ShopScene' },
            { fn: () => import('../scenes/InventoryScene.js'), name: 'InventoryScene' },
            { fn: () => import('../scenes/AchievementMenuScene.js'), name: 'AchievementMenuScene' },
            { fn: () => import('../scenes/CreatureProfileScene.js'), name: 'CreatureProfileScene' },
            { fn: () => import('../scenes/HubWorldScene.js'), name: 'HubWorldScene' },
            { fn: () => import('../scenes/levels/VoidPeaksLevel.js'), name: 'VoidPeaksLevel' },
            { fn: () => import('../scenes/FusionPodScene.js'), name: 'FusionPodScene' },
            { fn: () => import('../scenes/BreedingHatchScene.js'), name: 'BreedingHatchScene' },
            { fn: () => import('../scenes/VoidMiniGameScene.js'), name: 'VoidMiniGameScene' }
        ];

        chunks.forEach((chunk, index) => {
            this.queuePreload(chunk.fn, chunk.name, 10 + index);
        });
    }

    /**
     * Get preload statistics
     */
    getStats() {
        return {
            preloadedCount: this.preloadedChunks.size,
            preloadedChunks: Array.from(this.preloadedChunks),
            queueLength: this.preloadQueue.length,
            isPreloading: this.isPreloading
        };
    }
}

// Export singleton instance
const ChunkPreloader = new ChunkPreloaderClass();

// Also export to window for global access
if (typeof window !== 'undefined') {
    window.ChunkPreloader = ChunkPreloader;
}

export default ChunkPreloader;
export { ChunkPreloader };
