/**
 * API Configuration
 * Loads API configuration from environment variables
 * Follows security best practices - no hardcoded secrets
 */

class APIConfig {
    constructor() {
        this.config = {};
        this.initialized = false;
    }

    /**
     * Initialize API configuration from environment
     * Must be called after EnvironmentLoader.load()
     */
    async initialize() {
        if (!window.envLoader || !window.envLoader.loaded) {
            throw new Error('EnvironmentLoader must be loaded before APIConfig');
        }

        // Only load API config if features are enabled
        if (window.envLoader.getBool('ENABLE_API_FEATURES')) {
            this.config.xai = {
                apiKey: window.envLoader.get('XAI_API_KEY'),
                endpoint: window.envLoader.get('XAI_ENDPOINT'),
                model: window.envLoader.get('XAI_MODEL')
            };

            // Validate API key exists
            if (!this.config.xai.apiKey) {
                console.error('❌ XAI_API_KEY not found in environment variables');
                throw new Error('Missing required API configuration');
            }

            console.log('✅ API configuration loaded securely');
        } else {
            console.log('💡 API features disabled in environment configuration');
        }

        this.initialized = true;
    }

    /**
     * Get API configuration for service
     */
    get(service) {
        if (!this.initialized) {
            console.warn('⚠️ APIConfig not initialized, call initialize() first');
            return null;
        }

        if (!window.envLoader.getBool('ENABLE_API_FEATURES')) {
            console.warn('⚠️ API features are disabled');
            return null;
        }

        return this.config[service] || null;
    }

    /**
     * Check if API features are available
     */
    isEnabled() {
        return this.initialized && window.envLoader.getBool('ENABLE_API_FEATURES');
    }

    /**
     * Get masked configuration for debugging (hides sensitive values)
     */
    getPublicConfig() {
        const publicConfig = {};
        
        for (const [service, config] of Object.entries(this.config)) {
            publicConfig[service] = {
                endpoint: config.endpoint,
                model: config.model,
                apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : 'not set'
            };
        }
        
        return publicConfig;
    }
}

// Create singleton instance
window.APIConfig = new APIConfig();