/**
 * API Configuration
 * Loads API configuration from environment variables
 * Follows security best practices - no hardcoded secrets
 *
 * EU AI Act Compliance Note:
 * This game does NOT use external LLM/AI APIs for chat responses.
 * All creature chat responses are pre-written and human-authored.
 * The only external API is Replicate for optional AI art generation,
 * which is clearly labeled as AI-generated content.
 */

class APIConfig {
    constructor() {
        this.config = {};
        this.initialized = false;
    }

    /**
     * Initialize API configuration from environment
     * Currently only supports Replicate API for AI art generation
     */
    async initialize() {
        if (!window.envLoader || !window.envLoader.loaded) {
            throw new Error('EnvironmentLoader must be loaded before APIConfig');
        }

        // Replicate API for AI art generation (optional feature)
        // Note: This is configured via Netlify environment variables, not client-side
        // The client calls a Netlify function which has the API key server-side
        this.config.apiFeaturesEnabled = window.envLoader.getBool('ENABLE_API_FEATURES', false);
        this.config.replicateConfigured = this.config.apiFeaturesEnabled;

        this.initialized = true;
        console.log(
            `[APIConfig] Initialized (optional API features ${
                this.config.apiFeaturesEnabled ? 'enabled' : 'disabled'
            })`
        );
    }

    /**
     * Get API configuration for service
     * @param {string} service - Service name
     * @returns {object|null} - Config or null if not available
     */
    get(service) {
        if (!this.initialized) {
            console.warn('[APIConfig] Not initialized, call initialize() first');
            return null;
        }

        return Object.prototype.hasOwnProperty.call(this.config, service)
            ? this.config[service]
            : null;
    }

    /**
     * Check if API features are available
     */
    isEnabled() {
        return this.initialized && this.config.apiFeaturesEnabled === true;
    }

    /**
     * Get public configuration info (no secrets exposed)
     */
    getPublicConfig() {
        return {
            aiArtGeneration: {
                provider: 'Replicate (via Netlify function)',
                available: this.isEnabled(),
                status: this.isEnabled() ? 'enabled' : 'disabled',
                euAiActCompliance: 'Images labeled as AI-generated'
            },
            creatureChat: {
                provider: 'None (pre-written responses)',
                status: 'No external AI',
                euAiActCompliance: 'Fully compliant - no AI-generated text'
            }
        };
    }
}

// Create singleton instance
window.APIConfig = new APIConfig();
