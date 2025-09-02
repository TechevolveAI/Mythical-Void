/**
 * MemoryManager - Handles proper cleanup and memory management
 * Prevents memory leaks from event listeners, textures, and animations
 */

class MemoryManager {
    constructor() {
        this.trackedResources = new Map();
        this.eventListeners = new Map();
        this.intervals = new Set();
        this.timeouts = new Set();
        this.tweens = new Set();
        this.textures = new Set();
        this.canvases = new Set();
        this.observers = new Map();
        this.memoryWarningThreshold = 100 * 1024 * 1024; // 100MB
        this.isMonitoring = false;
        this.lastCleanup = Date.now();
        this.cleanupInterval = 30000; // 30 seconds
    }

    /**
     * Initialize the memory manager
     */
    initialize() {
        // Start monitoring memory usage
        this.startMemoryMonitoring();
        
        // Set up periodic cleanup
        this.setupPeriodicCleanup();
        
        // Override global functions to track resources
        this.overrideGlobalFunctions();
        
        console.log('[MemoryManager] Memory management initialized');
    }

    /**
     * Start monitoring memory usage
     */
    startMemoryMonitoring() {
        if (!performance.memory) {
            console.warn('[MemoryManager] Performance.memory not available (Chrome only)');
            return;
        }
        
        this.isMonitoring = true;
        
        const checkMemory = () => {
            if (!this.isMonitoring) return;
            
            const memoryUsage = performance.memory.usedJSHeapSize;
            const memoryLimit = performance.memory.jsHeapSizeLimit;
            const percentage = (memoryUsage / memoryLimit) * 100;
            
            if (memoryUsage > this.memoryWarningThreshold) {
                console.warn(`[MemoryManager] High memory usage: ${Math.round(memoryUsage / 1024 / 1024)}MB (${percentage.toFixed(1)}%)`);
                this.performCleanup();
            }
            
            // Check again in 10 seconds
            setTimeout(checkMemory, 10000);
        };
        
        checkMemory();
    }

    /**
     * Set up periodic cleanup
     */
    setupPeriodicCleanup() {
        setInterval(() => {
            const now = Date.now();
            if (now - this.lastCleanup > this.cleanupInterval) {
                this.performCleanup();
                this.lastCleanup = now;
            }
        }, this.cleanupInterval);
    }

    /**
     * Override global functions to track resources
     */
    overrideGlobalFunctions() {
        // Track setInterval
        const originalSetInterval = window.setInterval;
        window.setInterval = (...args) => {
            const id = originalSetInterval(...args);
            this.intervals.add(id);
            return id;
        };
        
        // Track clearInterval
        const originalClearInterval = window.clearInterval;
        window.clearInterval = (id) => {
            this.intervals.delete(id);
            originalClearInterval(id);
        };
        
        // Track setTimeout
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = (...args) => {
            const id = originalSetTimeout(...args);
            this.timeouts.add(id);
            
            // Auto-remove after execution
            const originalCallback = args[0];
            args[0] = (...callbackArgs) => {
                this.timeouts.delete(id);
                return originalCallback(...callbackArgs);
            };
            
            return id;
        };
        
        // Track clearTimeout
        const originalClearTimeout = window.clearTimeout;
        window.clearTimeout = (id) => {
            this.timeouts.delete(id);
            originalClearTimeout(id);
        };
    }

    /**
     * Register an event listener for tracking
     */
    registerEventListener(target, event, listener, options) {
        if (!this.eventListeners.has(target)) {
            this.eventListeners.set(target, new Map());
        }
        
        const targetListeners = this.eventListeners.get(target);
        if (!targetListeners.has(event)) {
            targetListeners.set(event, new Set());
        }
        
        targetListeners.get(event).add({ listener, options });
        target.addEventListener(event, listener, options);
    }

    /**
     * Unregister an event listener
     */
    unregisterEventListener(target, event, listener) {
        const targetListeners = this.eventListeners.get(target);
        if (!targetListeners) return;
        
        const eventListeners = targetListeners.get(event);
        if (!eventListeners) return;
        
        for (const entry of eventListeners) {
            if (entry.listener === listener) {
                target.removeEventListener(event, listener, entry.options);
                eventListeners.delete(entry);
                break;
            }
        }
        
        // Clean up empty maps
        if (eventListeners.size === 0) {
            targetListeners.delete(event);
        }
        if (targetListeners.size === 0) {
            this.eventListeners.delete(target);
        }
    }

    /**
     * Remove all event listeners for a target
     */
    removeAllEventListeners(target) {
        const targetListeners = this.eventListeners.get(target);
        if (!targetListeners) return;
        
        for (const [event, listeners] of targetListeners) {
            for (const entry of listeners) {
                target.removeEventListener(event, entry.listener, entry.options);
            }
        }
        
        this.eventListeners.delete(target);
    }

    /**
     * Register a Phaser tween for tracking
     */
    registerTween(tween) {
        this.tweens.add(tween);
        
        // Auto-remove when complete
        if (tween.on) {
            tween.on('complete', () => {
                this.tweens.delete(tween);
            });
        }
    }

    /**
     * Destroy a tween
     */
    destroyTween(tween) {
        if (tween && typeof tween.stop === 'function') {
            tween.stop();
        }
        if (tween && typeof tween.destroy === 'function') {
            tween.destroy();
        }
        this.tweens.delete(tween);
    }

    /**
     * Register a texture for tracking
     */
    registerTexture(texture) {
        this.textures.add(texture);
    }

    /**
     * Destroy a texture
     */
    destroyTexture(texture) {
        if (texture && typeof texture.destroy === 'function') {
            texture.destroy();
        }
        this.textures.delete(texture);
    }

    /**
     * Register a canvas element
     */
    registerCanvas(canvas) {
        this.canvases.add(canvas);
    }

    /**
     * Destroy a canvas element
     */
    destroyCanvas(canvas) {
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
        
        // Clear canvas context
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Release memory
        canvas.width = 0;
        canvas.height = 0;
        
        this.canvases.delete(canvas);
    }

    /**
     * Create a managed observer (MutationObserver, IntersectionObserver, etc.)
     */
    createObserver(type, callback, options) {
        let observer;
        
        switch(type) {
            case 'mutation':
                observer = new MutationObserver(callback);
                break;
            case 'intersection':
                observer = new IntersectionObserver(callback, options);
                break;
            case 'resize':
                observer = new ResizeObserver(callback);
                break;
            default:
                throw new Error(`Unknown observer type: ${type}`);
        }
        
        if (!this.observers.has(type)) {
            this.observers.set(type, new Set());
        }
        
        this.observers.get(type).add(observer);
        return observer;
    }

    /**
     * Disconnect and remove an observer
     */
    disconnectObserver(observer, type) {
        if (observer && typeof observer.disconnect === 'function') {
            observer.disconnect();
        }
        
        const typeObservers = this.observers.get(type);
        if (typeObservers) {
            typeObservers.delete(observer);
        }
    }

    /**
     * Clean up resources for a Phaser scene
     */
    cleanupScene(scene) {
        if (!scene) return;
        
        console.log(`[MemoryManager] Cleaning up scene: ${scene.scene.key}`);
        
        try {
            // Stop all tweens
            if (scene.tweens && typeof scene.tweens.killAll === 'function') {
                scene.tweens.killAll();
            }
            
            // Clear all timers
            if (scene.time && typeof scene.time.removeAllEvents === 'function') {
                scene.time.removeAllEvents();
            }
            
            // Destroy all game objects
            if (scene.children && scene.children.list) {
                const children = [...scene.children.list];
                children.forEach(child => {
                    if (child && typeof child.destroy === 'function' && !child.scene) {
                        try {
                            child.destroy();
                        } catch (e) {
                            console.warn(`[MemoryManager] Failed to destroy child object:`, e);
                        }
                    }
                });
            }
            
            // Clear input listeners
            if (scene.input) {
                if (typeof scene.input.removeAllListeners === 'function') {
                    scene.input.removeAllListeners();
                }
                if (scene.input.keyboard) {
                    if (typeof scene.input.keyboard.removeAllListeners === 'function') {
                        scene.input.keyboard.removeAllListeners();
                    }
                    if (typeof scene.input.keyboard.removeAllKeys === 'function') {
                        scene.input.keyboard.removeAllKeys();
                    }
                }
            }
            
            // Clear physics
            if (scene.physics && scene.physics.world && typeof scene.physics.world.shutdown === 'function') {
                scene.physics.world.shutdown();
            }
            
            // Clear cache - be careful as this is shared across scenes
            // Don't destroy the entire cache, just clear scene-specific entries if needed
            // Commenting out as cache is global and shouldn't be destroyed per scene
            // if (scene.cache && typeof scene.cache.destroy === 'function') {
            //     scene.cache.destroy();
            // }
            
            // Remove all custom event listeners
            this.removeAllEventListeners(scene);
            
            // Clear any scene-specific data
            for (const key in scene) {
                if (scene.hasOwnProperty(key) && key !== 'scene' && key !== 'sys') {
                    if (typeof scene[key] === 'object' && scene[key] !== null && key !== 'game') {
                        scene[key] = null;
                    }
                }
            }
        } catch (error) {
            console.warn(`[MemoryManager] Error during scene cleanup:`, error);
        }
    }

    /**
     * Perform general cleanup
     */
    performCleanup() {
        console.log('[MemoryManager] Performing cleanup...');
        
        const before = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        // Clean up detached DOM nodes
        this.cleanupDetachedNodes();
        
        // Clean up event listeners on removed elements
        this.cleanupOrphanedListeners();
        
        // Clean up completed tweens
        this.cleanupCompletedTweens();
        
        // Clean up unused textures
        this.cleanupUnusedTextures();
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        const after = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const freed = before - after;
        
        if (freed > 0) {
            console.log(`[MemoryManager] Freed ${Math.round(freed / 1024)}KB of memory`);
        }
    }

    /**
     * Clean up detached DOM nodes
     */
    cleanupDetachedNodes() {
        // Find all tracked elements that are no longer in DOM
        for (const [element] of this.eventListeners) {
            if (element instanceof HTMLElement && !document.contains(element)) {
                this.removeAllEventListeners(element);
            }
        }
    }

    /**
     * Clean up orphaned event listeners
     */
    cleanupOrphanedListeners() {
        const orphaned = [];
        
        for (const [target] of this.eventListeners) {
            // Check if target still exists and is valid
            if (!target || (target instanceof HTMLElement && !document.contains(target))) {
                orphaned.push(target);
            }
        }
        
        orphaned.forEach(target => {
            this.removeAllEventListeners(target);
        });
    }

    /**
     * Clean up completed tweens
     */
    cleanupCompletedTweens() {
        for (const tween of this.tweens) {
            if (!tween || (tween.isPlaying && !tween.isPlaying())) {
                this.destroyTween(tween);
            }
        }
    }

    /**
     * Clean up unused textures
     */
    cleanupUnusedTextures() {
        // This would integrate with Phaser's texture manager
        // For now, just clear our tracking of destroyed textures
        const toRemove = [];
        
        for (const texture of this.textures) {
            if (!texture || texture.destroyed) {
                toRemove.push(texture);
            }
        }
        
        toRemove.forEach(texture => {
            this.textures.delete(texture);
        });
    }

    /**
     * Clear all tracked resources
     */
    clearAll() {
        // Clear all intervals
        for (const id of this.intervals) {
            clearInterval(id);
        }
        this.intervals.clear();
        
        // Clear all timeouts
        for (const id of this.timeouts) {
            clearTimeout(id);
        }
        this.timeouts.clear();
        
        // Remove all event listeners
        for (const [target] of this.eventListeners) {
            this.removeAllEventListeners(target);
        }
        
        // Destroy all tweens
        for (const tween of this.tweens) {
            this.destroyTween(tween);
        }
        
        // Destroy all textures
        for (const texture of this.textures) {
            this.destroyTexture(texture);
        }
        
        // Destroy all canvases
        for (const canvas of this.canvases) {
            this.destroyCanvas(canvas);
        }
        
        // Disconnect all observers
        for (const [type, observers] of this.observers) {
            for (const observer of observers) {
                this.disconnectObserver(observer, type);
            }
        }
        this.observers.clear();
        
        // Clear all maps
        this.trackedResources.clear();
        
        console.log('[MemoryManager] All resources cleared');
    }

    /**
     * Get current memory statistics
     */
    getMemoryStats() {
        if (!performance.memory) {
            return { available: false };
        }
        
        const used = performance.memory.usedJSHeapSize;
        const total = performance.memory.totalJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        
        return {
            available: true,
            used: Math.round(used / 1024 / 1024), // MB
            total: Math.round(total / 1024 / 1024), // MB
            limit: Math.round(limit / 1024 / 1024), // MB
            percentage: ((used / limit) * 100).toFixed(1),
            eventListeners: this.eventListeners.size,
            intervals: this.intervals.size,
            timeouts: this.timeouts.size,
            tweens: this.tweens.size,
            textures: this.textures.size,
            canvases: this.canvases.size
        };
    }

    /**
     * Create a resource scope for automatic cleanup
     */
    createScope() {
        const scope = {
            resources: new Set(),
            listeners: new Map(),
            
            addResource(resource, cleanupFn) {
                this.resources.add({ resource, cleanupFn });
            },
            
            addEventListener(target, event, listener, options) {
                window.memoryManager.registerEventListener(target, event, listener, options);
                
                if (!this.listeners.has(target)) {
                    this.listeners.set(target, new Map());
                }
                const targetListeners = this.listeners.get(target);
                if (!targetListeners.has(event)) {
                    targetListeners.set(event, new Set());
                }
                targetListeners.get(event).add(listener);
            },
            
            cleanup() {
                // Clean up resources
                for (const { resource, cleanupFn } of this.resources) {
                    if (cleanupFn) {
                        cleanupFn(resource);
                    }
                }
                this.resources.clear();
                
                // Clean up event listeners
                for (const [target, events] of this.listeners) {
                    for (const [event, listeners] of events) {
                        for (const listener of listeners) {
                            window.memoryManager.unregisterEventListener(target, event, listener);
                        }
                    }
                }
                this.listeners.clear();
            }
        };
        
        return scope;
    }
}

// Create global instance
window.MemoryManager = MemoryManager;
window.memoryManager = new MemoryManager();