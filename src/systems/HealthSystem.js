/**
 * Health Check System
 * Implements /healthz and /readyz endpoints following Vibe Coding Playbook standards
 * Provides monitoring and diagnostic capabilities for the game
 */

class HealthSystem {
    constructor() {
        this.startTime = Date.now();
        this.checks = new Map();
        this.status = 'initializing';
        this.version = '1.0.0';
        
        // Register default health checks
        this.registerCheck('gameState', () => this.checkGameState());
        this.registerCheck('graphicsEngine', () => this.checkGraphicsEngine());
        this.registerCheck('localStorage', () => this.checkLocalStorage());
        this.registerCheck('phaser', () => this.checkPhaser());
        
        console.log('✅ HealthSystem initialized');
    }

    /**
     * Register a health check function
     * @param {string} name - Name of the check
     * @param {Function} checkFn - Function that returns boolean or Promise<boolean>
     */
    registerCheck(name, checkFn) {
        this.checks.set(name, checkFn);
    }

    /**
     * Remove a health check
     * @param {string} name - Name of the check to remove
     */
    unregisterCheck(name) {
        this.checks.delete(name);
    }

    /**
     * Get basic health status - quick check
     * Corresponds to /healthz endpoint
     */
    async getHealth() {
        const now = new Date().toISOString();
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        
        try {
            // Quick basic checks
            const isHealthy = this.isBasicallyHealthy();
            
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: now,
                version: this.version,
                uptime: uptime,
                environment: window.envLoader?.get('NODE_ENV') || 'unknown'
            };
        } catch (error) {
            console.error('Health check failed:', error);
            return {
                status: 'unhealthy',
                timestamp: now,
                version: this.version,
                uptime: uptime,
                error: error.message,
                environment: window.envLoader?.get('NODE_ENV') || 'unknown'
            };
        }
    }

    /**
     * Get detailed readiness status - thorough check
     * Corresponds to /readyz endpoint
     */
    async getReadiness() {
        const now = new Date().toISOString();
        const checkResults = {};
        let overallReady = true;

        // Run all registered health checks
        for (const [name, checkFn] of this.checks) {
            try {
                const result = await Promise.resolve(checkFn());
                checkResults[name] = !!result;
                if (!result) {
                    overallReady = false;
                }
            } catch (error) {
                console.error(`Health check '${name}' failed:`, error);
                checkResults[name] = false;
                overallReady = false;
            }
        }

        return {
            status: overallReady ? 'ready' : 'not_ready',
            timestamp: now,
            checks: checkResults
        };
    }

    /**
     * Basic health check - minimal overhead
     */
    isBasicallyHealthy() {
        try {
            // Check if core systems are available
            if (typeof window === 'undefined') return false;
            if (typeof document === 'undefined') return false;
            
            // Check if game is not destroyed
            if (window.mythicalGame && window.mythicalGame.isDestroyed) {
                return false;
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check GameState system health
     */
    checkGameState() {
        try {
            if (typeof GameState === 'undefined') return false;
            if (!GameState.initialized) return false;
            
            // Test basic functionality
            const testValue = GameState.get('creature.name');
            return testValue !== undefined;
        } catch (error) {
            console.warn('GameState health check failed:', error);
            return false;
        }
    }

    /**
     * Check GraphicsEngine system health
     */
    checkGraphicsEngine() {
        try {
            if (typeof GraphicsEngine === 'undefined') return false;
            
            // Check if we can create an instance (with mock scene)
            const mockScene = {
                add: {
                    graphics: () => ({
                        fillStyle: () => {},
                        destroy: () => {}
                    })
                }
            };
            
            const engine = new GraphicsEngine(mockScene);
            return engine instanceof GraphicsEngine;
        } catch (error) {
            console.warn('GraphicsEngine health check failed:', error);
            return false;
        }
    }

    /**
     * Check localStorage availability
     */
    checkLocalStorage() {
        try {
            if (typeof Storage === 'undefined') return false;
            
            const testKey = '_health_check_test';
            const testValue = 'test';
            
            localStorage.setItem(testKey, testValue);
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            return retrieved === testValue;
        } catch (error) {
            console.warn('localStorage health check failed:', error);
            return false;
        }
    }

    /**
     * Check Phaser.js system health
     */
    checkPhaser() {
        try {
            if (typeof Phaser === 'undefined') return false;
            
            // Check if game instance exists and is not destroyed
            if (window.mythicalGame) {
                return !window.mythicalGame.isDestroyed;
            }
            
            // If no game instance, at least Phaser library is available
            return true;
        } catch (error) {
            console.warn('Phaser health check failed:', error);
            return false;
        }
    }

    /**
     * Get system metrics for monitoring
     */
    getMetrics() {
        const metrics = {
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            version: this.version,
            timestamp: new Date().toISOString(),
            system: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            }
        };

        // Add memory info if available
        if (performance.memory) {
            metrics.memory = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
            };
        }

        // Add game-specific metrics
        if (window.mythicalGame && !window.mythicalGame.isDestroyed) {
            metrics.game = {
                running: true,
                scenes: window.mythicalGame.scene.scenes.length,
                activeScene: window.mythicalGame.scene.getScenes(true)[0]?.scene.key || 'none'
            };
        }

        // Add GameState metrics if available
        if (typeof GameState !== 'undefined' && GameState.initialized) {
            try {
                metrics.gameState = {
                    creatureLevel: GameState.get('creature.level'),
                    totalPlayTime: GameState.get('session.totalPlayTime'),
                    currentScene: GameState.get('session.currentScene')
                };
            } catch (error) {
                console.warn('Could not get GameState metrics:', error);
            }
        }

        return metrics;
    }

    /**
     * Start health monitoring (periodic checks)
     */
    startMonitoring(intervalMs = 60000) {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(async () => {
            try {
                const health = await this.getHealth();
                if (health.status === 'unhealthy') {
                    console.warn('⚠️ System health check failed:', health);
                    
                    // Emit health event for other systems to react
                    if (typeof CustomEvent !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('healthcheck-failed', {
                            detail: health
                        }));
                    }
                }
            } catch (error) {
                console.error('Health monitoring error:', error);
            }
        }, intervalMs);

        console.log(`✅ Health monitoring started (interval: ${intervalMs}ms)`);
    }

    /**
     * Stop health monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('🛑 Health monitoring stopped');
        }
    }

    /**
     * Create HTTP-like endpoints for health checks
     * This allows the system to respond to health check requests
     */
    createEndpoints() {
        // Create a simple router for health endpoints
        const router = {
            '/health': () => this.getHealth(),
            '/healthz': () => this.getHealth(),
            '/readiness': () => this.getReadiness(),
            '/readyz': () => this.getReadiness(),
            '/metrics': () => this.getMetrics()
        };

        // Attach to window for external access
        window.healthEndpoints = router;
        
        // Create a helper function to call endpoints
        window.callHealthEndpoint = async (path) => {
            const endpoint = router[path];
            if (!endpoint) {
                return {
                    status: 404,
                    error: 'Endpoint not found',
                    timestamp: new Date().toISOString()
                };
            }
            
            try {
                const result = await endpoint();
                return {
                    status: 200,
                    data: result,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                return {
                    status: 500,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        };

        console.log('✅ Health endpoints created:', Object.keys(router));
    }

    /**
     * Destroy the health system
     */
    destroy() {
        this.stopMonitoring();
        this.checks.clear();
        
        // Clean up window references
        if (window.healthEndpoints) {
            delete window.healthEndpoints;
        }
        if (window.callHealthEndpoint) {
            delete window.callHealthEndpoint;
        }
        
        console.log('🛑 HealthSystem destroyed');
    }
}

// Create and initialize singleton
window.HealthSystem = HealthSystem;
window.healthSystem = new HealthSystem();

// Auto-start monitoring and create endpoints
window.healthSystem.createEndpoints();
window.healthSystem.startMonitoring(30000); // Check every 30 seconds

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HealthSystem;
}