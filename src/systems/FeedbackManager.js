/**
 * FeedbackManager - Handles haptic feedback and screen shake effects
 * Provides tactile and visual feedback for key gameplay moments
 */

class FeedbackManager {
    constructor() {
        this.hapticEnabled = true;
        this.screenShakeEnabled = true;
        this.initialized = false;
    }

    /**
     * Initialize the feedback manager
     */
    init() {
        if (this.initialized) return;

        // Check for haptic support
        this.hapticSupported = 'vibrate' in navigator;

        // Load user preferences
        this.loadPreferences();

        this.initialized = true;
        console.log('[FeedbackManager] Initialized - Haptics:', this.hapticSupported ? 'supported' : 'not supported');
    }

    /**
     * Load user preferences from GameState
     */
    loadPreferences() {
        if (window.GameState) {
            this.hapticEnabled = window.GameState.get('settings.hapticEnabled') !== false;
            this.screenShakeEnabled = window.GameState.get('settings.screenShakeEnabled') !== false;
        }
    }

    /**
     * Save user preferences to GameState
     */
    savePreferences() {
        if (window.GameState) {
            window.GameState.set('settings.hapticEnabled', this.hapticEnabled);
            window.GameState.set('settings.screenShakeEnabled', this.screenShakeEnabled);
            window.GameState.save?.();
        }
    }

    // ==========================================
    // Haptic Patterns
    // ==========================================

    /**
     * Predefined haptic patterns for different events
     * Arrays represent vibration duration in ms, with pauses between
     */
    hapticPatterns = {
        tap: [10],                          // Quick tap feedback
        success: [20, 50, 20],              // Achievement/reward
        warning: [50, 30, 50],              // Alert/caution
        levelUp: [30, 50, 30, 50, 100],     // Level up celebration
        hatch: [100, 50, 100, 50, 200],     // Major hatching event
        coin: [15],                         // Coin collection
        error: [100],                       // Error feedback
        pet: [15, 30, 15],                  // Petting creature
        feed: [20, 20, 20],                 // Feeding creature
        play: [25, 25, 25, 25],             // Playing with creature
        milestone: [50, 50, 50, 50, 150],   // Streak milestone
        legendary: [100, 100, 100, 100, 300] // Legendary event
    };

    /**
     * Trigger haptic vibration with a named pattern
     * @param {string} patternName - Name of the pattern to use
     */
    vibrate(patternName) {
        if (!this.hapticEnabled || !this.hapticSupported) return;

        const pattern = this.hapticPatterns[patternName] || this.hapticPatterns.tap;

        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // Vibration may fail on some devices, fail silently
        }
    }

    /**
     * Trigger custom vibration pattern
     * @param {number[]} pattern - Array of vibration durations
     */
    vibrateCustom(pattern) {
        if (!this.hapticEnabled || !this.hapticSupported) return;

        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // Fail silently
        }
    }

    /**
     * Stop any ongoing vibration
     */
    stopVibration() {
        if (this.hapticSupported) {
            try {
                navigator.vibrate(0);
            } catch (e) {
                // Fail silently
            }
        }
    }

    // ==========================================
    // Screen Shake Effects
    // ==========================================

    /**
     * Screen shake intensity presets
     */
    shakeIntensities = {
        light: { intensity: 0.002, duration: 200 },
        medium: { intensity: 0.005, duration: 300 },
        heavy: { intensity: 0.010, duration: 500 },
        epic: { intensity: 0.015, duration: 500 }
    };

    /**
     * Apply screen shake effect to a scene's camera
     * @param {Phaser.Scene} scene - The scene to shake
     * @param {string} intensity - Intensity preset name
     * @param {number} duration - Optional custom duration in ms
     */
    screenShake(scene, intensity = 'medium', duration = null) {
        if (!this.screenShakeEnabled) return;
        if (!scene || !scene.cameras || !scene.cameras.main) return;

        const preset = this.shakeIntensities[intensity] || this.shakeIntensities.medium;
        const shakeDuration = duration || preset.duration;

        try {
            scene.cameras.main.shake(shakeDuration, preset.intensity);
        } catch (e) {
            // Camera may not support shake, fail silently
        }
    }

    /**
     * Custom screen shake with specific parameters
     * @param {Phaser.Scene} scene - The scene to shake
     * @param {number} duration - Duration in ms
     * @param {number} intensityX - Horizontal shake intensity
     * @param {number} intensityY - Vertical shake intensity
     */
    screenShakeCustom(scene, duration, intensityX, intensityY) {
        if (!this.screenShakeEnabled) return;
        if (!scene || !scene.cameras || !scene.cameras.main) return;

        try {
            scene.cameras.main.shake(duration, intensityX, intensityY);
        } catch (e) {
            // Fail silently
        }
    }

    // ==========================================
    // Combined Feedback Events
    // ==========================================

    /**
     * Feedback for coin collection
     * @param {Phaser.Scene} scene - The current scene
     */
    onCoinCollect(scene) {
        this.vibrate('coin');
        // No screen shake for coins - too frequent
    }

    /**
     * Feedback for level up event
     * @param {Phaser.Scene} scene - The current scene
     */
    onLevelUp(scene) {
        this.vibrate('levelUp');
        this.screenShake(scene, 'medium', 300);
    }

    /**
     * Feedback for creature hatching
     * @param {Phaser.Scene} scene - The current scene
     */
    onHatch(scene) {
        this.vibrate('hatch');
        this.screenShake(scene, 'heavy', 500);
    }

    /**
     * Feedback for achievement unlock
     * @param {Phaser.Scene} scene - The current scene
     */
    onAchievement(scene) {
        this.vibrate('success');
        this.screenShake(scene, 'light', 200);
    }

    /**
     * Feedback for taking damage
     * @param {Phaser.Scene} scene - The current scene
     */
    onDamage(scene) {
        this.vibrate('warning');
        this.screenShake(scene, 'light', 150);
    }

    /**
     * Feedback for critical hit
     * @param {Phaser.Scene} scene - The current scene
     */
    onCriticalHit(scene) {
        this.vibrate('success');
        this.screenShake(scene, 'medium', 200);
    }

    /**
     * Feedback for error events
     * @param {Phaser.Scene} scene - The current scene
     */
    onError(scene) {
        this.vibrate('error');
        this.screenShake(scene, 'light', 100);
    }

    /**
     * Feedback for petting creature
     * @param {Phaser.Scene} scene - The current scene
     */
    onPet(scene) {
        this.vibrate('pet');
        // No screen shake for gentle interactions
    }

    /**
     * Feedback for feeding creature
     * @param {Phaser.Scene} scene - The current scene
     */
    onFeed(scene) {
        this.vibrate('feed');
        // No screen shake for gentle interactions
    }

    /**
     * Feedback for playing with creature
     * @param {Phaser.Scene} scene - The current scene
     */
    onPlay(scene) {
        this.vibrate('play');
        this.screenShake(scene, 'light', 100);
    }

    /**
     * Feedback for streak milestone
     * @param {Phaser.Scene} scene - The current scene
     */
    onStreakMilestone(scene) {
        this.vibrate('milestone');
        this.screenShake(scene, 'medium', 400);
    }

    /**
     * Feedback for legendary event (rare creature, special unlock)
     * @param {Phaser.Scene} scene - The current scene
     */
    onLegendaryEvent(scene) {
        this.vibrate('legendary');
        this.screenShake(scene, 'epic', 600);
    }

    /**
     * Feedback for UI button tap
     * @param {Phaser.Scene} scene - The current scene (optional)
     */
    onButtonTap(scene = null) {
        this.vibrate('tap');
        // No screen shake for UI interactions
    }

    /**
     * Feedback for successful purchase
     * @param {Phaser.Scene} scene - The current scene
     */
    onPurchase(scene) {
        this.vibrate('success');
        this.screenShake(scene, 'light', 150);
    }

    /**
     * Feedback for shiny creature discovery
     * @param {Phaser.Scene} scene - The current scene
     */
    onShinyDiscovery(scene) {
        this.vibrate('milestone');
        this.screenShake(scene, 'medium', 350);
    }

    // ==========================================
    // Settings Controls
    // ==========================================

    /**
     * Toggle haptic feedback on/off
     * @returns {boolean} New haptic state
     */
    toggleHaptic() {
        this.hapticEnabled = !this.hapticEnabled;
        this.savePreferences();
        return this.hapticEnabled;
    }

    /**
     * Toggle screen shake on/off
     * @returns {boolean} New screen shake state
     */
    toggleScreenShake() {
        this.screenShakeEnabled = !this.screenShakeEnabled;
        this.savePreferences();
        return this.screenShakeEnabled;
    }

    /**
     * Set haptic enabled state
     * @param {boolean} enabled - Whether haptics should be enabled
     */
    setHapticEnabled(enabled) {
        this.hapticEnabled = !!enabled;
        this.savePreferences();
    }

    /**
     * Set screen shake enabled state
     * @param {boolean} enabled - Whether screen shake should be enabled
     */
    setScreenShakeEnabled(enabled) {
        this.screenShakeEnabled = !!enabled;
        this.savePreferences();
    }

    /**
     * Get current settings state
     * @returns {Object} Current feedback settings
     */
    getSettings() {
        return {
            hapticEnabled: this.hapticEnabled,
            hapticSupported: this.hapticSupported,
            screenShakeEnabled: this.screenShakeEnabled
        };
    }
}

// Create singleton instance
const feedbackManager = new FeedbackManager();

// Initialize on load
feedbackManager.init();

// Export to window for global access
window.FeedbackManager = feedbackManager;

export default feedbackManager;
