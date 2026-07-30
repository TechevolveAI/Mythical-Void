/**
 * Environment Configuration Loader
 * Securely loads environment variables from .env file
 * Follows 12-factor app methodology for configuration management
 */

class EnvironmentLoader {
    constructor() {
        this.config = {};
        this.loaded = false;
    }

    /**
     * Load environment variables from Vite-provided import.meta.env
     * Falls back to default values if keys are missing
     */
    async load() {
        const defaults = this.getDefaultConfig();
        const envSource = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

        const merged = { ...defaults };
        const mappings = {
            NODE_ENV: envSource.MODE || envSource.VITE_NODE_ENV,
            ENABLE_API_FEATURES: envSource.VITE_ENABLE_API_FEATURES,
            ENABLE_AI_PORTRAITS: envSource.VITE_ENABLE_AI_PORTRAITS,
            PORT: envSource.VITE_PORT,
            DEBUG: envSource.VITE_DEBUG,
            GAME_SAVE_PREFIX: envSource.VITE_GAME_SAVE_PREFIX,
            AUTO_SAVE_INTERVAL: envSource.VITE_AUTO_SAVE_INTERVAL,
            MAX_SAVE_SLOTS: envSource.VITE_MAX_SAVE_SLOTS,
            CORS_ORIGINS: envSource.VITE_CORS_ORIGINS,
            NASA_API_KEY: envSource.VITE_NASA_API_KEY // For space weather features
        };

        for (const [key, value] of Object.entries(mappings)) {
            if (value !== undefined && value !== null) {
                merged[key] = String(value);
            }
        }

        this.config = merged;
        this.loaded = true;
        console.log('✅ Environment configuration loaded');
    }

    getDefaultConfig() {
        return {
            NODE_ENV: 'development',
            PORT: '8080',
            DEBUG: 'false',
            GAME_SAVE_PREFIX: 'mythical_creature_game',
            AUTO_SAVE_INTERVAL: '30000',
            MAX_SAVE_SLOTS: '3',
            ENABLE_API_FEATURES: 'false',
            ENABLE_AI_PORTRAITS: 'false',
            CORS_ORIGINS: 'http://localhost:8080,http://127.0.0.1:8080'
        };
    }

    /**
     * Get configuration value
     */
    get(key, defaultValue = undefined) {
        if (!this.loaded) {
            console.warn('⚠️ Environment not loaded yet, call load() first');
            return defaultValue;
        }
        
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    /**
     * Get boolean configuration value
     */
    getBool(key, defaultValue = false) {
        const value = this.get(key, defaultValue);
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        const normalized = String(value).toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }

    /**
     * Get number configuration value
     */
    getNumber(key, defaultValue = 0) {
        const raw = this.get(key, defaultValue);
        const parsed = parseInt(raw, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    /**
     * Check if environment is production
     */
    isProduction() {
        return this.get('NODE_ENV') === 'production';
    }

    /**
     * Check if environment is development
     */
    isDevelopment() {
        return this.get('NODE_ENV') === 'development';
    }

    /**
     * Get all configuration (for debugging - excludes sensitive keys)
     */
    getPublicConfig() {
        const publicKeys = [
            'NODE_ENV', 'PORT', 'DEBUG', 'GAME_SAVE_PREFIX', 
            'AUTO_SAVE_INTERVAL', 'MAX_SAVE_SLOTS', 'ENABLE_API_FEATURES',
            'ENABLE_AI_PORTRAITS'
        ];
        
        const publicConfig = {};
        for (const key of publicKeys) {
            if (this.config[key] !== undefined) {
                publicConfig[key] = this.config[key];
            }
        }
        
        return publicConfig;
    }

    /**
     * Validate required environment variables
     */
    validate() {
        const errors = [];

        // Validate numeric values
        const numericKeys = ['PORT', 'AUTO_SAVE_INTERVAL', 'MAX_SAVE_SLOTS'];
        for (const key of numericKeys) {
            const value = this.get(key);
            if (value !== undefined && isNaN(parseInt(value, 10))) {
                errors.push(`${key} must be a valid number, got: ${value}`);
            }
        }

        if (errors.length > 0) {
            console.error('❌ Environment validation failed:');
            errors.forEach(error => console.error(`  - ${error}`));
            return false;
        }

        console.log('✅ Environment validation passed');
        return true;
    }
}

// Create singleton instance
window.EnvironmentLoader = EnvironmentLoader;
window.envLoader = new EnvironmentLoader();
