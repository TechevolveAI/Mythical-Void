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

        // Mobile audio unlock state
        this.audioUnlocked = false;
        this.unlockHandler = null;
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

            // Set up mobile audio unlock (auto-resume on first user interaction)
            this.setupMobileAudioUnlock();

            this.initialized = true;
            console.log('✅ AudioManager initialized');
        } catch (error) {
            console.error('[AudioManager] Initialization failed:', error);
        }
    }

    /**
     * Set up automatic audio unlock for mobile browsers
     * Mobile browsers require user interaction before audio can play
     */
    setupMobileAudioUnlock() {
        if (!this.audioContext) return;

        // Create unlock handler that resumes audio context on first interaction
        this.unlockHandler = () => {
            if (this.audioUnlocked) return;

            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('[AudioManager] 🔊 Audio unlocked on mobile');
                    this.audioUnlocked = true;
                    this.removeUnlockListeners();
                });
            } else {
                this.audioUnlocked = true;
                this.removeUnlockListeners();
            }
        };

        // Listen for first user interaction (touch or click)
        const events = ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, this.unlockHandler, { once: true, passive: true });
        });

        console.log('[AudioManager] Mobile audio unlock listeners added');
    }

    /**
     * Remove audio unlock event listeners
     */
    removeUnlockListeners() {
        if (!this.unlockHandler) return;

        const events = ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
        events.forEach(event => {
            document.removeEventListener(event, this.unlockHandler);
        });

        this.unlockHandler = null;
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

        // Level up - triumphant fanfare
        this.createToneSequence('level_up', [
            { frequency: 523.25, duration: 0.12, volume: 0.3 },  // C5
            { frequency: 659.25, duration: 0.12, volume: 0.3 },  // E5
            { frequency: 783.99, duration: 0.12, volume: 0.3 },  // G5
            { frequency: 1046.50, duration: 0.15, volume: 0.35 }, // C6
            { frequency: 1318.51, duration: 0.2, volume: 0.3 }   // E6
        ]);

        // Achievement unlock - magical chime sequence
        this.createToneSequence('achievement', [
            { frequency: 659.25, duration: 0.1, volume: 0.25 },  // E5
            { frequency: 783.99, duration: 0.1, volume: 0.25 },  // G5
            { frequency: 987.77, duration: 0.1, volume: 0.25 },  // B5
            { frequency: 1318.51, duration: 0.15, volume: 0.3 }, // E6
            { frequency: 1567.98, duration: 0.2, volume: 0.25 }  // G6
        ]);

        // Pet/interact - warm, gentle tone
        this.createToneSequence('pet', [
            { frequency: 523.25, duration: 0.15, volume: 0.2 },  // C5
            { frequency: 659.25, duration: 0.15, volume: 0.2 }   // E5
        ]);

        // Feed - satisfying munch sound
        this.createToneSequence('feed', [
            { frequency: 400, duration: 0.08, volume: 0.25 },
            { frequency: 350, duration: 0.08, volume: 0.2 },
            { frequency: 400, duration: 0.08, volume: 0.25 }
        ]);

        // Play - playful bounce
        this.createToneSequence('play', [
            { frequency: 523.25, duration: 0.1, volume: 0.2 },   // C5
            { frequency: 659.25, duration: 0.1, volume: 0.2 },   // E5
            { frequency: 523.25, duration: 0.1, volume: 0.2 },   // C5
            { frequency: 783.99, duration: 0.15, volume: 0.25 }  // G5
        ]);

        // Egg crack sound - sharp crack with descending rumble
        this.createToneSequence('egg_crack', [
            { frequency: 800, duration: 0.05, volume: 0.3 },   // Sharp crack
            { frequency: 600, duration: 0.08, volume: 0.25 },  // Echo
            { frequency: 400, duration: 0.1, volume: 0.2 },    // Rumble
            { frequency: 200, duration: 0.12, volume: 0.15 }   // Deep rumble
        ]);

        // Hatch celebration - triumphant fanfare with sparkle
        this.createToneSequence('hatch_celebration', [
            { frequency: 523.25, duration: 0.15, volume: 0.35 },  // C5
            { frequency: 659.25, duration: 0.15, volume: 0.35 },  // E5
            { frequency: 783.99, duration: 0.15, volume: 0.35 },  // G5
            { frequency: 1046.50, duration: 0.2, volume: 0.4 },   // C6
            { frequency: 1318.51, duration: 0.25, volume: 0.35 }, // E6
            { frequency: 1567.98, duration: 0.3, volume: 0.3 }    // G6
        ]);

        // Ambient suspense loop - low mysterious tones
        this.createToneSequence('suspense_ambient', [
            { frequency: 220, duration: 0.4, volume: 0.12 },    // A3 - low drone
            { frequency: 246.94, duration: 0.4, volume: 0.12 }, // B3
            { frequency: 261.63, duration: 0.4, volume: 0.12 }, // C4
            { frequency: 293.66, duration: 0.4, volume: 0.12 }  // D4
        ]);

        // ==========================================
        // EVOLUTION SOUNDS
        // ==========================================

        // Baby to Juvenile evolution - gentle growth fanfare
        this.createToneSequence('evolution_small', [
            { frequency: 523.25, duration: 0.2, volume: 0.25 },  // C5
            { frequency: 587.33, duration: 0.2, volume: 0.25 },  // D5
            { frequency: 659.25, duration: 0.2, volume: 0.3 },   // E5
            { frequency: 783.99, duration: 0.3, volume: 0.35 }   // G5
        ]);

        // Juvenile to Adult evolution - major triumphant fanfare
        this.createToneSequence('evolution_major', [
            { frequency: 523.25, duration: 0.15, volume: 0.3 },   // C5
            { frequency: 659.25, duration: 0.15, volume: 0.3 },   // E5
            { frequency: 783.99, duration: 0.15, volume: 0.35 },  // G5
            { frequency: 1046.50, duration: 0.2, volume: 0.4 },   // C6
            { frequency: 1318.51, duration: 0.3, volume: 0.35 }   // E6
        ]);

        // Adult to Elder evolution - ethereal ascending sequence
        this.createToneSequence('evolution_elder', [
            { frequency: 392.00, duration: 0.3, volume: 0.25 },   // G4
            { frequency: 493.88, duration: 0.3, volume: 0.25 },   // B4
            { frequency: 587.33, duration: 0.3, volume: 0.3 },    // D5
            { frequency: 698.46, duration: 0.3, volume: 0.3 },    // F5
            { frequency: 783.99, duration: 0.35, volume: 0.35 },  // G5
            { frequency: 987.77, duration: 0.4, volume: 0.3 }     // B5
        ]);

        // Departure ceremony - ethereal ascending to fade
        this.createToneSequence('departure', [
            { frequency: 392.00, duration: 0.4, volume: 0.25 },   // G4
            { frequency: 440.00, duration: 0.4, volume: 0.25 },   // A4
            { frequency: 493.88, duration: 0.4, volume: 0.25 },   // B4
            { frequency: 523.25, duration: 0.5, volume: 0.3 },    // C5
            { frequency: 587.33, duration: 0.5, volume: 0.25 },   // D5
            { frequency: 659.25, duration: 0.6, volume: 0.2 },    // E5
            { frequency: 783.99, duration: 0.8, volume: 0.15 }    // G5 fade
        ]);

        // Sad/abandoned creature sound
        this.createToneSequence('sad', [
            { frequency: 392.00, duration: 0.3, volume: 0.2 },    // G4
            { frequency: 349.23, duration: 0.3, volume: 0.18 },   // F4
            { frequency: 329.63, duration: 0.4, volume: 0.15 }    // E4
        ]);

        // Return from abandonment - hopeful but subdued
        this.createToneSequence('return_welcome', [
            { frequency: 329.63, duration: 0.2, volume: 0.2 },    // E4
            { frequency: 392.00, duration: 0.2, volume: 0.22 },   // G4
            { frequency: 440.00, duration: 0.25, volume: 0.25 }   // A4
        ]);

        // Vision reveal sound - mystical shimmer for adult vision during hatching
        this.createToneSequence('vision_reveal', [
            { frequency: 523.25, duration: 0.15, volume: 0.2 },   // C5
            { frequency: 783.99, duration: 0.15, volume: 0.22 },  // G5
            { frequency: 987.77, duration: 0.2, volume: 0.25 },   // B5
            { frequency: 1046.50, duration: 0.25, volume: 0.25 }, // C6
            { frequency: 1318.51, duration: 0.3, volume: 0.22 },  // E6
            { frequency: 1567.98, duration: 0.4, volume: 0.18 }   // G6 - sparkle fade
        ]);

        // Baby creature sounds - cute and high-pitched
        this.createToneSequence('baby_coo', [
            { frequency: 600, duration: 0.15, volume: 0.18, waveform: 'sine' },
            { frequency: 650, duration: 0.2, volume: 0.2, waveform: 'sine' },
            { frequency: 580, duration: 0.25, volume: 0.15, waveform: 'sine' }
        ]);

        this.createToneSequence('baby_chirp', [
            { frequency: 800, duration: 0.08, volume: 0.15, waveform: 'sine' },
            { frequency: 900, duration: 0.1, volume: 0.18, waveform: 'sine' },
            { frequency: 850, duration: 0.08, volume: 0.12, waveform: 'sine' }
        ]);

        this.createToneSequence('baby_giggle', [
            { frequency: 700, duration: 0.06, volume: 0.15, waveform: 'sine' },
            { frequency: 750, duration: 0.06, volume: 0.18, waveform: 'sine' },
            { frequency: 800, duration: 0.06, volume: 0.2, waveform: 'sine' },
            { frequency: 750, duration: 0.06, volume: 0.15, waveform: 'sine' },
            { frequency: 800, duration: 0.08, volume: 0.18, waveform: 'sine' }
        ]);

        this.createToneSequence('baby_yawn', [
            { frequency: 500, duration: 0.2, volume: 0.12, waveform: 'sine' },
            { frequency: 450, duration: 0.3, volume: 0.1, waveform: 'sine' },
            { frequency: 400, duration: 0.35, volume: 0.08, waveform: 'sine' }
        ]);

        this.createToneSequence('baby_happy', [
            { frequency: 650, duration: 0.1, volume: 0.18, waveform: 'sine' },
            { frequency: 750, duration: 0.12, volume: 0.2, waveform: 'sine' },
            { frequency: 850, duration: 0.15, volume: 0.22, waveform: 'sine' },
            { frequency: 900, duration: 0.1, volume: 0.18, waveform: 'sine' }
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

        // Auto-resume audio context if suspended (mobile safety check)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.audioUnlocked = true;
                this.playSound(name, volumeMultiplier); // Retry after resume
            });
            return;
        }

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
     * Play level up sound effect
     */
    playLevelUp() {
        this.playSound('level_up');
    }

    /**
     * Play achievement unlock sound effect
     */
    playAchievement() {
        this.playSound('achievement');
    }

    /**
     * Play pet/interact sound
     */
    playPet() {
        this.playSound('pet');
    }

    /**
     * Play feed sound
     */
    playFeed() {
        this.playSound('feed');
    }

    /**
     * Play play/interact sound
     */
    playPlay() {
        this.playSound('play');
    }

    // ==========================================
    // BABY CREATURE SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play baby coo sound - soft, warm, content
     */
    playBabyCoo() {
        this.playSound('baby_coo');
    }

    /**
     * Play baby chirp sound - short, happy
     */
    playBabyChirp() {
        this.playSound('baby_chirp');
    }

    /**
     * Play baby giggle sound - quick, playful
     */
    playBabyGiggle() {
        this.playSound('baby_giggle');
    }

    /**
     * Play baby yawn sound - sleepy, cute
     */
    playBabyYawn() {
        this.playSound('baby_yawn');
    }

    /**
     * Play baby happy sound - excited, joyful
     */
    playBabyHappy() {
        this.playSound('baby_happy');
    }

    /**
     * Play egg crack sound effect
     */
    playEggCrack() {
        this.playSound('egg_crack');
    }

    /**
     * Play hatch celebration sound effect
     */
    playHatchCelebration() {
        this.playSound('hatch_celebration');
    }

    /**
     * Play suspense ambient sound
     */
    playSuspenseAmbient() {
        this.playSound('suspense_ambient');
    }

    // ==========================================
    // EVOLUTION SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play baby to juvenile evolution sound - gentle growth fanfare
     */
    playEvolutionSmall() {
        this.playSound('evolution_small');
    }

    /**
     * Play juvenile to adult evolution sound - major triumphant fanfare
     */
    playEvolutionMajor() {
        this.playSound('evolution_major');
    }

    /**
     * Play adult to elder evolution sound - ethereal ascending sequence
     */
    playEvolutionElder() {
        this.playSound('evolution_elder');
    }

    /**
     * Play departure ceremony sound - ethereal ascending to fade
     */
    playDeparture() {
        this.playSound('departure');
    }

    /**
     * Play vision reveal sound - mystical shimmer for adult vision during hatching
     */
    playVisionReveal() {
        this.playSound('vision_reveal');
    }

    /**
     * Play sad/abandoned creature sound
     */
    playSad() {
        this.playSound('sad');
    }

    /**
     * Play return welcome sound - hopeful sound when returning from abandonment
     */
    playReturnWelcome() {
        this.playSound('return_welcome');
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
        // Remove mobile audio unlock listeners
        this.removeUnlockListeners();

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
