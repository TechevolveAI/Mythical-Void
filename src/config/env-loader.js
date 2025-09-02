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
     * Load environment variables from .env file
     * Falls back to default values if file doesn't exist
     */
    async load() {
        try {
            // SECURITY: Don't fetch .env in production as it exposes secrets
            if (this.isProduction()) {
                console.log('🔒 Production mode: Using environment variables from hosting platform');
                this.loadFromWindowEnv();
            } else {
                // Development: Try to load .env, but fail gracefully
                try {
                    const response = await fetch('/.env');
                    if (response.ok) {
                        const envContent = await response.text();
                        this.parseEnvContent(envContent);
                        console.log('🔧 Development: Loaded .env file');
                    } else {
                        console.warn('⚠️ .env file not accessible, using defaults');
                        this.loadDefaults();
                    }
                } catch (fetchError) {
                    console.warn('⚠️ Could not fetch .env file, using defaults:', fetchError.message);
                    this.loadDefaults();
                }
            }
        } catch (error) {
            console.warn('⚠️ Environment loading failed, using defaults:', error.message);
            this.loadDefaults();
        }
        
        this.loaded = true;
        console.log('✅ Environment configuration loaded');
    }

    /**
     * Load environment from window object (for production builds)
     */
    loadFromWindowEnv() {
        // In production, environment variables should be injected at build time
        // or available through window object
        if (window.process && window.process.env) {
            this.config = { ...window.process.env };
        } else {
            // Fallback to production defaults
            this.config = {
                NODE_ENV: 'production',
                ENABLE_API_FEATURES: 'false',
                PORT: '8080',
                DEBUG: 'false',
                GAME_SAVE_PREFIX: 'mythical_creature_game',
                AUTO_SAVE_INTERVAL: '30000',
                MAX_SAVE_SLOTS: '3',
                CORS_ORIGINS: window.location.origin
            };
        }
    }

    /**
     * Check if running in production
     */
    isProduction() {
        return window.location.hostname !== 'localhost' && 
               window.location.hostname !== '127.0.0.1' &&
               !window.location.hostname.includes('192.168.') &&
               !window.location.hostname.includes('10.');
    }

    /**
     * Parse .env file content
     */
    parseEnvContent(content) {
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }
            
            // Parse key=value pairs
            const equalIndex = trimmedLine.indexOf('=');
            if (equalIndex > 0) {
                const key = trimmedLine.substring(0, equalIndex).trim();
                const value = trimmedLine.substring(equalIndex + 1).trim();
                this.config[key] = value;
            }
        }
    }

    /**
     * Load default configuration values
     */
    loadDefaults() {
        this.config = {
            NODE_ENV: 'development',
            PORT: '8080',
            DEBUG: 'false',
            GAME_SAVE_PREFIX: 'mythical_creature_game',
            AUTO_SAVE_INTERVAL: '30000',
            MAX_SAVE_SLOTS: '3',
            ENABLE_API_FEATURES: 'false',
            CORS_ORIGINS: 'http://localhost:8080,http://127.0.0.1:8080',
            // API keys will be undefined - must be set in .env
            XAI_API_KEY: undefined,
            XAI_ENDPOINT: 'https://api.x.ai/v1/chat/completions',
            XAI_MODEL: 'grok-4-latest'
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
        const value = this.get(key, defaultValue.toString());
        return value === 'true' || value === '1' || value === 'yes';
    }

    /**
     * Get number configuration value
     */
    getNumber(key, defaultValue = 0) {
        const value = this.get(key, defaultValue.toString());
        const parsed = parseInt(value, 10);
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
            'AUTO_SAVE_INTERVAL', 'MAX_SAVE_SLOTS', 'ENABLE_API_FEATURES'
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
        
        // Check for required API keys if API features are enabled
        if (this.getBool('ENABLE_API_FEATURES')) {
            if (!this.get('XAI_API_KEY')) {
                errors.push('XAI_API_KEY is required when ENABLE_API_FEATURES=true');
            }
        }
        
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