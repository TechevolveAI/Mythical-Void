/**
 * NASAContentSystem - Daily NASA content delivery for creatures
 *
 * Features:
 * - Astronomy Picture of the Day (APOD) - Shows on first daily login
 * - Mars Rover Postcards - Random Mars photos
 * - ISS Overhead Alerts - Real-time Space Station tracking
 *
 * All content creates magical connection between game creatures and real space events
 */

import { devLog, devWarn } from '../utils/devLogger.js';

class NASAContentSystem {
    constructor() {
        this.isInitialized = false;
        this.apiKey = null;
        this.baseUrl = 'https://api.nasa.gov';

        // Cache settings
        this.cache = {
            apod: { data: null, date: null },
            mars: { data: null, date: null },
            iss: { data: null, lastFetch: 0 }
        };

        // Daily content tracking
        this.lastShownDate = null;
        this.contentQueue = []; // Queue of content to show

        // ISS tracking
        this.issCheckInterval = null;
        this.playerLocation = null; // { lat, lon }
        this.lastISSAlert = 0;
        this.issAlertCooldown = 30 * 60 * 1000; // 30 minutes between alerts

        // Event listeners
        this.listeners = {};

        // Rate limiting to prevent API abuse
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000; // Minimum 1 second between requests
        this.rateLimitedUntil = 0; // Timestamp when rate limiting expires
    }

    /**
     * Rate-limited fetch wrapper for NASA API
     * Prevents burst requests and handles 429 responses
     */
    async rateLimitedFetch(url) {
        // Check if we're currently rate limited
        if (Date.now() < this.rateLimitedUntil) {
            devWarn('[NASAContent] Rate limited, skipping request');
            return null;
        }

        // Enforce minimum interval between requests
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(resolve =>
                setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
            );
        }

        this.lastRequestTime = Date.now();

        const response = await fetch(url);

        // Handle rate limiting
        if (response.status === 429) {
            // Rate limited - back off for 5 minutes
            this.rateLimitedUntil = Date.now() + (5 * 60 * 1000);
            devWarn('[NASAContent] Rate limited by NASA API, backing off for 5 minutes');
            return null;
        }

        return response;
    }

    /**
     * Initialize the NASA content system
     */
    async initialize() {
        this.apiKey = window.envLoader?.get('NASA_API_KEY') || 'DEMO_KEY';

        devLog('[NASAContent] Initializing with API key:',
            this.apiKey === 'DEMO_KEY' ? 'DEMO_KEY (limited)' : '***' + this.apiKey.slice(-4));

        // Load last shown date from storage
        this.loadLastShownDate();

        // Pre-fetch today's content
        await this.prefetchDailyContent();

        // Start ISS tracking (checks every 5 minutes)
        this.startISSTracking();

        this.isInitialized = true;
        devLog('[NASAContent] System initialized');

        return this;
    }

    /**
     * Load last shown date from localStorage
     */
    loadLastShownDate() {
        try {
            const stored = localStorage.getItem('nasa_last_shown_date');
            this.lastShownDate = stored || null;
        } catch (e) {
            this.lastShownDate = null;
        }
    }

    /**
     * Save last shown date to localStorage
     */
    saveLastShownDate() {
        try {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem('nasa_last_shown_date', today);
            this.lastShownDate = today;
        } catch (e) {
            devWarn('[NASAContent] Failed to save last shown date');
        }
    }

    /**
     * Check if we should show daily content (first login today)
     */
    shouldShowDailyContent() {
        const today = new Date().toISOString().split('T')[0];
        const shouldShow = this.lastShownDate !== today;
        devLog(`[NASAContent] shouldShowDailyContent: ${shouldShow} (lastShown: ${this.lastShownDate}, today: ${today})`);
        return shouldShow;
    }

    /**
     * Force reset daily content for testing
     * Call from DevTools: window.NASAContentSystem.resetDailyContent()
     */
    resetDailyContent() {
        try {
            localStorage.removeItem('nasa_last_shown_date');
            this.lastShownDate = null;
            devLog('[NASAContent] Daily content reset - will show on next check');
            return true;
        } catch (e) {
            devWarn('[NASAContent] Failed to reset daily content');
            return false;
        }
    }

    /**
     * Pre-fetch today's content in background
     */
    async prefetchDailyContent() {
        try {
            await Promise.all([
                this.fetchAPOD(),
                this.fetchMarsPhoto()
            ]);
            devLog('[NASAContent] Daily content prefetched');
        } catch (error) {
            devWarn('[NASAContent] Failed to prefetch:', error.message);
        }
    }

    /**
     * Get daily content queue for display
     * Returns array of content objects to show in modals
     */
    async getDailyContentQueue() {
        if (!this.shouldShowDailyContent()) {
            return [];
        }

        const queue = [];

        // Add APOD if available
        const apod = await this.fetchAPOD();
        if (apod) {
            queue.push({
                type: 'apod',
                title: 'Astronomy Picture of the Day',
                subtitle: apod.title,
                imageUrl: this.ensureHttps(apod.url),
                hdUrl: this.ensureHttps(apod.hdurl),
                description: this.simplifyDescription(apod.explanation),
                date: apod.date,
                creatureComment: this.getCreatureAPODComment(apod.title)
            });
        }

        // Add Mars photo (50% chance to include, alternate with APOD)
        if (Math.random() < 0.5) {
            const mars = await this.fetchMarsPhoto();
            if (mars) {
                queue.push({
                    type: 'mars',
                    title: 'Postcard from Mars',
                    subtitle: `${mars.rover.name} Rover - ${mars.camera.full_name}`,
                    imageUrl: this.ensureHttps(mars.img_src),
                    description: `This photo was taken on Mars by the ${mars.rover.name} rover on Sol ${mars.sol} (Martian day ${mars.sol}).`,
                    date: mars.earth_date,
                    creatureComment: this.getCreatureMarsComment()
                });
            }
        }

        return queue;
    }

    /**
     * Mark daily content as shown
     */
    markDailyContentShown() {
        this.saveLastShownDate();
    }

    /**
     * Fetch Astronomy Picture of the Day
     */
    async fetchAPOD() {
        const today = new Date().toISOString().split('T')[0];

        // Return cached if same day
        if (this.cache.apod.data && this.cache.apod.date === today) {
            return this.cache.apod.data;
        }

        try {
            const url = `${this.baseUrl}/planetary/apod?api_key=${this.apiKey}`;
            const response = await this.rateLimitedFetch(url);

            // Rate limited or failed
            if (!response) return null;

            if (!response.ok) throw new Error(`APOD API error: ${response.status}`);

            const data = await response.json();

            // Only cache image type (not videos)
            if (data.media_type === 'image') {
                this.cache.apod = { data, date: today };
                return data;
            }

            devLog('[NASAContent] APOD is video today, skipping');
            return null;

        } catch (error) {
            devWarn('[NASAContent] APOD fetch failed:', error.message);
            return null;
        }
    }

    /**
     * Fetch random Mars Rover photo
     */
    async fetchMarsPhoto() {
        const today = new Date().toISOString().split('T')[0];

        // Return cached if same day
        if (this.cache.mars.data && this.cache.mars.date === today) {
            return this.cache.mars.data;
        }

        try {
            // Use photos endpoint with a recent sol (Martian day)
            // Curiosity landed on Sol 0 = Aug 6, 2012
            // Calculate approximate current sol (Mars day is ~24h 37m)
            const landingDate = new Date('2012-08-06');
            const now = new Date();
            const earthDays = Math.floor((now - landingDate) / (1000 * 60 * 60 * 24));
            const approxSol = Math.floor(earthDays / 1.027); // Mars day is ~1.027 Earth days

            // Try a sol from the last 30 days for variety
            const randomSolOffset = Math.floor(Math.random() * 30);
            const targetSol = Math.max(1, approxSol - randomSolOffset);

            const url = `${this.baseUrl}/mars-photos/api/v1/rovers/curiosity/photos?sol=${targetSol}&api_key=${this.apiKey}`;
            const response = await this.rateLimitedFetch(url);

            // Rate limited or failed
            if (!response) return null;

            if (!response.ok) throw new Error(`Mars API error: ${response.status}`);

            const data = await response.json();

            if (data.photos && data.photos.length > 0) {
                // Pick a random photo from the results
                const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
                this.cache.mars = { data: photo, date: today };
                return photo;
            }

            // If no photos for that sol, try ONE fallback (to limit API calls)
            const fallbackSol = Math.max(1, approxSol - 100);
            const fallbackUrl = `${this.baseUrl}/mars-photos/api/v1/rovers/curiosity/photos?sol=${fallbackSol}&api_key=${this.apiKey}`;
            const fallbackResponse = await this.rateLimitedFetch(fallbackUrl);

            if (fallbackResponse && fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.photos && fallbackData.photos.length > 0) {
                    const photo = fallbackData.photos[Math.floor(Math.random() * fallbackData.photos.length)];
                    this.cache.mars = { data: photo, date: today };
                    return photo;
                }
            }

            return null;

        } catch (error) {
            devWarn('[NASAContent] Mars fetch failed:', error.message);
            return null;
        }
    }

    /**
     * Ensure URL uses HTTPS (NASA Mars API returns HTTP URLs)
     */
    ensureHttps(url) {
        if (!url) return url;
        return url.replace(/^http:\/\//i, 'https://');
    }

    /**
     * Simplify NASA description for kids
     */
    simplifyDescription(text) {
        if (!text) return '';

        // Truncate to first 2-3 sentences, max 200 chars
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        let result = '';

        for (const sentence of sentences) {
            if (result.length + sentence.length > 200) break;
            result += sentence.trim() + '. ';
        }

        return result.trim() || text.substring(0, 200) + '...';
    }

    /**
     * Get creature comment for APOD
     */
    getCreatureAPODComment(title) {
        const comments = [
            `Wow! NASA shared this picture today! It's called "${title}"!`,
            `Look what I found! This is today's space picture from NASA!`,
            `The cosmos is so beautiful! NASA calls this "${title}"!`,
            `I love exploring space with you! Check out "${title}"!`,
            `*gazes at the stars* This is from real telescopes! "${title}"!`
        ];
        return comments[Math.floor(Math.random() * comments.length)];
    }

    /**
     * Get creature comment for Mars photo
     */
    getCreatureMarsComment() {
        const comments = [
            "I got a postcard from Mars! A robot took this picture on another planet!",
            "Look! The Curiosity rover sent us a photo from Mars!",
            "Can you believe this? This is the surface of MARS!",
            "A robot on Mars took this picture just for us!",
            "Red rocks, dusty skies... this is really Mars! Amazing!"
        ];
        return comments[Math.floor(Math.random() * comments.length)];
    }

    // ==================== ISS TRACKING ====================

    /**
     * Set player's approximate location for ISS tracking
     */
    setPlayerLocation(lat, lon) {
        this.playerLocation = { lat, lon };
        devLog('[NASAContent] Player location set for ISS tracking');
    }

    /**
     * Start ISS tracking interval
     */
    startISSTracking() {
        // Open Notify API only supports HTTP, which causes mixed content errors on HTTPS
        // Skip ISS tracking in production HTTPS environments
        if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
            devLog('[NASAContent] ISS tracking disabled on HTTPS (API only supports HTTP)');
            return;
        }

        // Check every 5 minutes
        this.issCheckInterval = setInterval(() => {
            this.checkISSOverhead();
        }, 5 * 60 * 1000);

        // Initial check
        this.checkISSOverhead();
    }

    /**
     * Check if ISS is overhead
     */
    async checkISSOverhead() {
        // Skip if no location set or on cooldown
        if (!this.playerLocation) return;

        const now = Date.now();
        if (now - this.lastISSAlert < this.issAlertCooldown) return;

        try {
            // Get current ISS position
            const response = await fetch('http://api.open-notify.org/iss-now.json');
            const data = await response.json();

            if (data.message !== 'success') return;

            const issLat = parseFloat(data.iss_position.latitude);
            const issLon = parseFloat(data.iss_position.longitude);

            // Calculate distance (rough approximation)
            const distance = this.calculateDistance(
                this.playerLocation.lat,
                this.playerLocation.lon,
                issLat,
                issLon
            );

            // ISS is "overhead" if within ~1500km (visible range)
            if (distance < 1500) {
                this.lastISSAlert = now;
                this.emit('issOverhead', {
                    distance,
                    issLat,
                    issLon,
                    message: this.getISSAlertMessage(distance)
                });
                devLog('[NASAContent] ISS overhead alert triggered, distance:', distance);
            }

        } catch (error) {
            devWarn('[NASAContent] ISS check failed:', error.message);
        }
    }

    /**
     * Calculate distance between two points (Haversine formula, km)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    /**
     * Get ISS alert message for creature speech bubble
     */
    getISSAlertMessage(distance) {
        if (distance < 500) {
            return "LOOK UP! The Space Station is RIGHT above us! Wave to the astronauts!";
        } else if (distance < 1000) {
            return "The Space Station is flying nearby! If you look up, you might see it!";
        } else {
            return "The International Space Station is passing over our area! Astronauts are waving hello!";
        }
    }

    /**
     * Get astronaut count on ISS
     */
    async getAstronautCount() {
        try {
            const response = await fetch('http://api.open-notify.org/astros.json');
            const data = await response.json();

            if (data.message === 'success') {
                const issAstronauts = data.people.filter(p => p.craft === 'ISS');
                return {
                    count: issAstronauts.length,
                    names: issAstronauts.map(p => p.name)
                };
            }
        } catch (error) {
            devWarn('[NASAContent] Astronaut count fetch failed');
        }
        return null;
    }

    /**
     * Clean up system
     */
    destroy() {
        if (this.issCheckInterval) {
            clearInterval(this.issCheckInterval);
        }
        this.listeners = {};
        this.isInitialized = false;
        devLog('[NASAContent] System destroyed');
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
const nasaContentSystem = new NASAContentSystem();
window.NASAContentSystem = nasaContentSystem;

export default nasaContentSystem;
