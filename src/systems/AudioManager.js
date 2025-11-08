/**
 * AudioManager - Manages game audio and sound effects
 * Supports both file-based audio and procedurally generated sounds using Web Audio API
 */

class AudioManager {
    constructor() {
        this.initialized = false;
        this.audioContext = null;
        this.masterVolume = 0.7;
        this.sfxVolume = 0.8;
        this.musicVolume = 0.5;
        this.muted = false;
        this.sounds = new Map();

        // Cache for procedurally generated audio buffers
        this.generatedSounds = new Map();
    }

    /**
     * Initialize the audio system
     */
    initialize() {
        if (this.initialized) {
            console.warn('[AudioManager] Already initialized');
            return;
        }

        try {
            // Create Web Audio API context for procedural sounds
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioContext = new AudioContext();
                console.log('[AudioManager] Web Audio API context created');
            } else {
                console.warn('[AudioManager] Web Audio API not supported');
            }

            // Load mute setting from GameState or localStorage
            if (typeof window !== 'undefined' && window.GameState) {
                this.muted = window.GameState.get('settings.audioMuted') || false;
            } else if (typeof localStorage !== 'undefined') {
                this.muted = localStorage.getItem('audioMuted') === 'true';
            }

            // Generate common sound effects
            this.generateCommonSounds();

            this.initialized = true;
            console.log('✅ AudioManager initialized');
        } catch (error) {
            console.error('[AudioManager] Initialization failed:', error);
        }
    }

    /**
     * Generate common procedural sound effects
     */
    generateCommonSounds() {
        // Coin collect sound - bright, satisfying chime
        this.createToneSequence('coin_collect', [
            { frequency: 523.25, duration: 0.1, volume: 0.3 },  // C5
            { frequency: 659.25, duration: 0.1, volume: 0.25 }, // E5
            { frequency: 783.99, duration: 0.15, volume: 0.2 }  // G5
        ]);

        // Error/insufficient coins - descending tone
        this.createToneSequence('error', [
            { frequency: 400, duration: 0.1, volume: 0.2 },
            { frequency: 300, duration: 0.15, volume: 0.15 }
        ]);

        // Button click - short blip
        this.createToneSequence('button_click', [
            { frequency: 800, duration: 0.05, volume: 0.15 }
        ]);

        // Purchase success - triumphant chime
        this.createToneSequence('purchase', [
            { frequency: 523.25, duration: 0.08, volume: 0.25 }, // C5
            { frequency: 659.25, duration: 0.08, volume: 0.25 }, // E5
            { frequency: 783.99, duration: 0.08, volume: 0.25 }, // G5
            { frequency: 1046.50, duration: 0.2, volume: 0.2 }   // C6
        ]);

        // Attack/combat sound - sharp tone
        this.createToneSequence('attack', [
            { frequency: 200, duration: 0.05, volume: 0.3 },
            { frequency: 150, duration: 0.1, volume: 0.2 }
        ]);

        // Enemy hit - lower impact sound
        this.createToneSequence('enemy_hit', [
            { frequency: 100, duration: 0.1, volume: 0.3 },
            { frequency: 80, duration: 0.1, volume: 0.2 }
        ]);

        console.log('[AudioManager] Generated', this.generatedSounds.size, 'procedural sounds');
    }

    /**
     * Create a sequence of tones
     * @param {string} name - Sound effect name
     * @param {Array} tones - Array of {frequency, duration, volume} objects
     */
    createToneSequence(name, tones) {
        if (!this.audioContext) return;

        this.generatedSounds.set(name, tones);
    }

    /**
     * Play a procedurally generated tone sequence
     * @param {string} name - Sound effect name
     * @param {number} volumeMultiplier - Optional volume multiplier
     */
    playSound(name, volumeMultiplier = 1.0) {
        if (!this.initialized || this.muted || !this.audioContext) return;

        const tones = this.generatedSounds.get(name);
        if (!tones) {
            console.warn(`[AudioManager] Sound "${name}" not found`);
            return;
        }

        try {
            let currentTime = this.audioContext.currentTime;

            tones.forEach((tone) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.value = tone.frequency;
                oscillator.type = 'sine'; // Smooth sine wave

                // Calculate final volume
                const finalVolume = tone.volume * this.sfxVolume * this.masterVolume * volumeMultiplier;

                // Envelope for smooth attack/release
                gainNode.gain.setValueAtTime(0, currentTime);
                gainNode.gain.linearRampToValueAtTime(finalVolume, currentTime + 0.01); // Quick attack
                gainNode.gain.linearRampToValueAtTime(0, currentTime + tone.duration); // Decay to silence

                oscillator.start(currentTime);
                oscillator.stop(currentTime + tone.duration);

                currentTime += tone.duration;
            });
        } catch (error) {
            console.warn('[AudioManager] Failed to play sound:', error);
        }
    }

    /**
     * Play coin collection sound
     */
    playCoinCollect() {
        this.playSound('coin_collect');
    }

    /**
     * Play error sound (insufficient coins, invalid action, etc.)
     */
    playError() {
        this.playSound('error');
    }

    /**
     * Play button click sound
     */
    playButtonClick() {
        this.playSound('button_click');
    }

    /**
     * Play purchase success sound
     */
    playPurchase() {
        this.playSound('purchase');
    }

    /**
     * Play attack sound
     */
    playAttack() {
        this.playSound('attack');
    }

    /**
     * Play enemy hit sound
     */
    playEnemyHit() {
        this.playSound('enemy_hit');
    }

    /**
     * Toggle mute on/off
     */
    toggleMute() {
        this.muted = !this.muted;

        // Save to GameState if available
        if (typeof window !== 'undefined' && window.GameState) {
            window.GameState.set('settings.audioMuted', this.muted);
        }

        // Also save to localStorage as backup
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('audioMuted', this.muted.toString());
        }

        console.log(`[AudioManager] Audio ${this.muted ? 'muted' : 'unmuted'}`);
        return this.muted;
    }

    /**
     * Set master volume
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        console.log(`[AudioManager] Master volume set to ${this.masterVolume}`);
    }

    /**
     * Set SFX volume
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        console.log(`[AudioManager] SFX volume set to ${this.sfxVolume}`);
    }

    /**
     * Set music volume
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        console.log(`[AudioManager] Music volume set to ${this.musicVolume}`);
    }

    /**
     * Check if audio is muted
     * @returns {boolean}
     */
    isMuted() {
        return this.muted;
    }

    /**
     * Get current volumes
     * @returns {object} Volume settings
     */
    getVolumes() {
        return {
            master: this.masterVolume,
            sfx: this.sfxVolume,
            music: this.musicVolume
        };
    }

    /**
     * Resume audio context (needed for user interaction requirement)
     */
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('[AudioManager] Audio context resumed');
            });
        }
    }

    /**
     * Clean up audio resources
     */
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.generatedSounds.clear();
        this.sounds.clear();
        console.log('[AudioManager] Destroyed');
    }
}

// Export as singleton
const audioManager = new AudioManager();

if (typeof window !== 'undefined') {
    window.AudioManager = audioManager;
}

export default audioManager;
