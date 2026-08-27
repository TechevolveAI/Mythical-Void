/**
 * SpaceWeatherSystem - Connects real space weather to game atmosphere
 *
 * Uses NASA DONKI API to fetch:
 * - Solar Flares (FLR)
 * - Geomagnetic Storms (GST)
 * - High Speed Streams (HSS)
 *
 * Translates real cosmic events into game effects and creature reactions
 */

import { devLog, devWarn } from '../utils/devLogger.js';

class SpaceWeatherSystem {
    constructor() {
        this.isInitialized = false;
        this.initializationPromise = null;
        this.refreshPromise = null;
        this.lifecycleToken = 0;
        this.refreshInterval = null;
        this.apiKey = null;
        this.baseUrl = 'https://api.nasa.gov/DONKI';
        this.requestTimeoutMs = 8000;

        // Cache settings - don't spam NASA
        this.cache = {
            data: null,
            lastFetch: 0,
            cacheDuration: 4 * 60 * 60 * 1000 // 4 hours
        };

        // Current game weather state
        this.currentWeather = {
            auroraActive: false,
            auroraIntensity: 0, // 0-1 scale
            solarActivity: 'quiet', // quiet, moderate, active, intense
            skyTint: null, // hex color or null
            cosmicEnergy: 0, // 0-100, affects creature energy
            activeEvents: []
        };

        // Fallback data when offline or API unavailable
        this.fallbackWeather = this.generateFallbackWeather();

        // Event listeners
        this.listeners = {};
    }

    async fetchWithTimeout(url, options = {}) {
        const controller = typeof AbortController !== 'undefined'
            ? new AbortController()
            : null;
        const requestOptions = controller
            ? { ...options, signal: controller.signal }
            : options;
        let timeoutId = null;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                controller?.abort?.();
                const error = new Error('Space-weather request timed out');
                error.name = 'TimeoutError';
                reject(error);
            }, this.requestTimeoutMs);
        });

        try {
            return await Promise.race([
                Promise.resolve().then(() => fetch(url, requestOptions)),
                timeout
            ]);
        } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
        }
    }

    /**
     * Initialize the space weather system
     */
    async initialize() {
        if (this.isInitialized) return this;
        if (this.initializationPromise) return this.initializationPromise;

        const lifecycleToken = ++this.lifecycleToken;
        const initialization = (async () => {
            this.apiKey = window.envLoader?.get('NASA_API_KEY') || 'DEMO_KEY';

            devLog('[SpaceWeather] Initializing with API key:',
                this.apiKey === 'DEMO_KEY'
                    ? 'DEMO_KEY (limited)'
                    : '***' + this.apiKey.slice(-4));

            // Space weather enriches the atmosphere but is not required for
            // play. Start from the authored fallback and fetch only when an
            // explicit feature requests fresh data, so a public NASA rate
            // limit can never delay or pollute normal gameplay.
            this.currentWeather = { ...this.fallbackWeather };
            if (lifecycleToken !== this.lifecycleToken) return this;

            this.isInitialized = true;
            devLog('[SpaceWeather] System initialized', this.currentWeather);
            return this;
        })();
        this.initializationPromise = initialization;

        try {
            return await initialization;
        } finally {
            if (this.initializationPromise === initialization) {
                this.initializationPromise = null;
            }
        }
    }

    /**
     * Refresh space weather data from NASA
     */
    async refresh() {
        const now = Date.now();

        // Check cache
        if (this.cache.data && (now - this.cache.lastFetch) < this.cache.cacheDuration) {
            devLog('[SpaceWeather] Using cached data');
            return this.currentWeather;
        }
        if (this.refreshPromise) return this.refreshPromise;

        const lifecycleToken = this.lifecycleToken;
        const refresh = (async () => {
            try {
                const [gstData, flrData] = await Promise.all([
                    this.fetchGeomagnetic(),
                    this.fetchSolarFlares()
                ]);
                if (lifecycleToken !== this.lifecycleToken) return this.currentWeather;

                this.processWeatherData(gstData, flrData);
                this.cache.data = { gstData, flrData };
                this.cache.lastFetch = now;

                this.emit('weatherUpdated', this.currentWeather);
                devLog('[SpaceWeather] Weather updated from NASA', this.currentWeather);
            } catch (error) {
                if (lifecycleToken !== this.lifecycleToken) return this.currentWeather;
                devWarn('[SpaceWeather] API fetch failed, using fallback:', error.message);
                this.currentWeather = { ...this.fallbackWeather };
                this.emit('weatherUpdated', this.currentWeather);
            }

            return this.currentWeather;
        })();
        this.refreshPromise = refresh;

        try {
            return await refresh;
        } finally {
            if (this.refreshPromise === refresh) this.refreshPromise = null;
        }
    }

    /**
     * Fetch geomagnetic storm data (auroras!)
     */
    async fetchGeomagnetic() {
        const startDate = this.getDateString(-7); // Past week
        const endDate = this.getDateString(0);

        const url = `${this.baseUrl}/GST?startDate=${startDate}&endDate=${endDate}&api_key=${this.apiKey}`;

        const response = await this.fetchWithTimeout(url);
        if (!response.ok) throw new Error(`GST API error: ${response.status}`);

        return response.json();
    }

    /**
     * Fetch solar flare data
     */
    async fetchSolarFlares() {
        const startDate = this.getDateString(-3); // Past 3 days
        const endDate = this.getDateString(0);

        const url = `${this.baseUrl}/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${this.apiKey}`;

        const response = await this.fetchWithTimeout(url);
        if (!response.ok) throw new Error(`FLR API error: ${response.status}`);

        return response.json();
    }

    /**
     * Process NASA data into game weather state
     */
    processWeatherData(gstData, flrData) {
        const weather = {
            auroraActive: false,
            auroraIntensity: 0,
            solarActivity: 'quiet',
            skyTint: null,
            cosmicEnergy: 30, // Base energy
            activeEvents: []
        };

        // Process geomagnetic storms (auroras)
        if (gstData && gstData.length > 0) {
            const recentStorm = gstData[gstData.length - 1];
            const kpIndex = this.extractKpIndex(recentStorm);

            if (kpIndex >= 4) {
                weather.auroraActive = true;
                weather.auroraIntensity = Math.min(1, (kpIndex - 3) / 6);
                weather.cosmicEnergy += 20;
                weather.activeEvents.push({
                    type: 'geomagnetic_storm',
                    intensity: kpIndex,
                    message: this.getAuroraMessage(kpIndex)
                });
            }
        }

        // Process solar flares
        if (flrData && flrData.length > 0) {
            const recentFlare = flrData[flrData.length - 1];
            const flareClass = recentFlare.classType || '';

            if (flareClass.startsWith('X')) {
                weather.solarActivity = 'intense';
                weather.skyTint = 0xFFAA00; // Golden orange
                weather.cosmicEnergy += 40;
                weather.activeEvents.push({
                    type: 'solar_flare',
                    class: flareClass,
                    message: this.getSolarFlareMessage('X')
                });
            } else if (flareClass.startsWith('M')) {
                weather.solarActivity = 'active';
                weather.skyTint = 0xFFDD88; // Soft gold
                weather.cosmicEnergy += 25;
                weather.activeEvents.push({
                    type: 'solar_flare',
                    class: flareClass,
                    message: this.getSolarFlareMessage('M')
                });
            } else if (flareClass.startsWith('C')) {
                weather.solarActivity = 'moderate';
                weather.cosmicEnergy += 10;
            }
        }

        // Cap cosmic energy
        weather.cosmicEnergy = Math.min(100, weather.cosmicEnergy);

        this.currentWeather = weather;
    }

    /**
     * Extract Kp index from storm data
     */
    extractKpIndex(stormData) {
        if (!stormData || !stormData.allKpIndex) return 0;

        // Get the highest Kp value from the storm
        const kpValues = stormData.allKpIndex.map(kp => parseFloat(kp.kpIndex) || 0);
        return Math.max(...kpValues, 0);
    }

    /**
     * Get aurora-related creature message
     */
    getAuroraMessage(kpIndex) {
        const messages = {
            low: [
                "The sky has a faint shimmer tonight! Can you see it?",
                "There's a gentle glow dancing up there... so pretty!",
                "The aurora is whispering hello tonight!"
            ],
            medium: [
                "Wow! The aurora is really dancing tonight! It's magical!",
                "Look at those colors in the sky! The sun sent us a light show!",
                "The northern lights are putting on a show just for us!"
            ],
            high: [
                "AMAZING! The whole sky is alive with color! This is incredible!",
                "I've never seen the aurora this bright! The cosmos is celebrating!",
                "The sky is on fire with beautiful lights! What a gift!"
            ]
        };

        const category = kpIndex >= 7 ? 'high' : kpIndex >= 5 ? 'medium' : 'low';
        const options = messages[category];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Get solar flare creature message
     */
    getSolarFlareMessage(flareClass) {
        const messages = {
            'C': [
                "The sun gave a little sneeze today! How cute!",
                "There was a tiny solar flare - the sun is stretching!"
            ],
            'M': [
                "The sun had a big burst of energy today! I feel tingly!",
                "A solar flare happened! That's why everything feels so sparkly!",
                "The sun flexed its cosmic muscles today! Feel that energy?"
            ],
            'X': [
                "WOW! The sun did something HUGE today! Can you feel it?!",
                "A massive solar flare just happened! The whole solar system felt it!",
                "The sun threw a cosmic party and we're all invited! Such power!"
            ]
        };

        const options = messages[flareClass] || messages['C'];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Generate fallback weather when offline
     */
    generateFallbackWeather() {
        // Use date-based pseudo-randomness for consistent daily fallbacks
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
        const seed = dayOfYear % 10;

        return {
            auroraActive: seed === 3 || seed === 7, // ~20% chance
            auroraIntensity: seed === 7 ? 0.6 : seed === 3 ? 0.3 : 0,
            solarActivity: seed >= 8 ? 'moderate' : 'quiet',
            skyTint: null,
            cosmicEnergy: 30 + (seed * 5),
            activeEvents: []
        };
    }

    /**
     * Get current weather state
     */
    getWeather() {
        return { ...this.currentWeather };
    }

    /**
     * Check if aurora is active
     */
    isAuroraActive() {
        return this.currentWeather.auroraActive;
    }

    /**
     * Get aurora intensity (0-1)
     */
    getAuroraIntensity() {
        return this.currentWeather.auroraIntensity;
    }

    /**
     * Get sky tint color (or null)
     */
    getSkyTint() {
        return this.currentWeather.skyTint;
    }

    /**
     * Get cosmic energy level (0-100)
     */
    getCosmicEnergy() {
        return this.currentWeather.cosmicEnergy;
    }

    /**
     * Get a random creature comment about current space weather
     */
    getCreatureComment() {
        const events = this.currentWeather.activeEvents;

        if (events.length === 0) {
            // Quiet space weather messages
            const quietMessages = [
                "The cosmos is peaceful today. Perfect for exploring!",
                "The sun is resting quietly. I feel so calm!",
                "It's a lovely cosmic day - not too sparkly, not too quiet!",
                "The stars are twinkling just right tonight!",
                "Space is being very gentle with us today."
            ];
            return quietMessages[Math.floor(Math.random() * quietMessages.length)];
        }

        // Return a message from an active event
        const event = events[Math.floor(Math.random() * events.length)];
        return event.message;
    }

    /**
     * Check if there's exciting space weather to mention
     */
    hasExcitingNews() {
        return this.currentWeather.activeEvents.length > 0;
    }

    /**
     * Get date string in YYYY-MM-DD format
     */
    getDateString(daysOffset = 0) {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        return date.toISOString().split('T')[0];
    }

    /**
     * Clean up system
     */
    destroy() {
        this.lifecycleToken += 1;
        this.initializationPromise = null;
        this.refreshPromise = null;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.listeners = {};
        this.isInitialized = false;
        devLog('[SpaceWeather] System destroyed');
    }

    // Event emitter methods
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => callback(data));
    }
}

// Create singleton
const spaceWeatherSystem = new SpaceWeatherSystem();
window.SpaceWeatherSystem = spaceWeatherSystem;

export default spaceWeatherSystem;
