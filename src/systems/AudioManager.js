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

    // ==========================================
    // PROCEDURAL BACKGROUND MUSIC SYSTEM
    // ==========================================

    /**
     * Area music configurations
     * Each area has unique musical character via base frequency, scale, tempo, and layers
     */
    get areaConfigs() {
        return {
            home: {
                baseFreq: 220,      // A3 - warm, comfortable
                scale: 'major',
                tempo: 60,          // BPM - relaxed
                layers: ['pad', 'arpeggio', 'bells'],
                colors: {
                    pad: [1, 1.25, 1.5],      // Major chord intervals
                    arpeggio: [1, 1.125, 1.25, 1.5, 1.25, 1.125], // Major scale pattern
                    bells: [2, 2.5, 3]
                }
            },
            void: {
                baseFreq: 110,      // A2 - deep, mysterious
                scale: 'harmonic_minor',
                tempo: 45,          // Slow, ethereal
                layers: ['drone', 'whispers', 'sparkles'],
                colors: {
                    drone: [1, 1.5],
                    whispers: [3, 3.5, 4],
                    sparkles: [6, 7, 8]
                }
            },
            gathering: {
                baseFreq: 196,      // G3 - welcoming
                scale: 'pentatonic',
                tempo: 75,          // Upbeat, social
                layers: ['strings', 'chimes', 'heartbeat'],
                colors: {
                    strings: [1, 1.25, 1.5],
                    chimes: [2, 2.5, 3],
                    heartbeat: [0.5]
                }
            },
            breeding: {
                baseFreq: 262,      // C4 - magical
                scale: 'minor_pent',
                tempo: 55,          // Mystical, anticipatory
                layers: ['shimmer', 'pulse', 'celestial'],
                colors: {
                    shimmer: [1, 1.2, 1.5],
                    pulse: [0.5, 1],
                    celestial: [2, 2.4, 3]
                }
            },
            meditation: {
                baseFreq: 174.61,   // F3 - calming, grounding frequency
                scale: 'pentatonic',
                tempo: 30,          // Very slow, breathing-paced
                layers: ['singingBowl', 'breathPad', 'windChimes', 'deepDrone'],
                colors: {
                    singingBowl: [1, 1.5, 2],         // Perfect intervals - resonant
                    breathPad: [1, 1.25, 1.5],        // Gentle major chord
                    windChimes: [3, 4, 5, 6],         // High overtones
                    deepDrone: [0.5, 1]               // Sub-bass grounding
                }
            }
        };
    }

    /**
     * Initialize music system state
     */
    initMusicSystem() {
        this.musicNodes = {
            gainNode: null,
            oscillators: [],
            lfoNodes: []
        };
        this.currentArea = null;
        this.musicPlaying = false;
        this.arpeggioInterval = null;
    }

    /**
     * Play procedural background music for a specific area
     * @param {string} area - Area name: 'home', 'void', 'gathering', 'breeding'
     */
    playAreaMusic(area) {
        if (!this.audioContext || this.muted) return;

        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Stop any currently playing music
        if (this.musicPlaying) {
            this.stopMusic(false); // Don't fade for immediate transition
        }

        const config = this.areaConfigs[area];
        if (!config) {
            console.warn(`[AudioManager] Unknown music area: ${area}`);
            return;
        }

        console.log(`[AudioManager] 🎵 Playing ${area} music`);

        // Initialize music nodes
        this.initMusicSystem();
        this.currentArea = area;
        this.musicPlaying = true;

        // Create master gain node for music
        this.musicNodes.gainNode = this.audioContext.createGain();
        this.musicNodes.gainNode.gain.value = 0;
        this.musicNodes.gainNode.connect(this.audioContext.destination);

        // Create layers based on configuration
        config.layers.forEach(layerType => {
            this.createMusicLayer(layerType, config);
        });

        // Fade in
        this.musicNodes.gainNode.gain.linearRampToValueAtTime(
            this.musicVolume * 0.3,
            this.audioContext.currentTime + 1
        );
    }

    /**
     * Create a music layer based on type
     * @param {string} layerType - Layer type: 'pad', 'drone', 'arpeggio', etc.
     * @param {object} config - Area music configuration
     */
    createMusicLayer(layerType, config) {
        const baseFreq = config.baseFreq;
        const intervals = config.colors[layerType] || [1];

        switch (layerType) {
            case 'pad':
            case 'drone':
                this.createPadLayer(baseFreq, intervals, layerType === 'drone');
                break;
            case 'arpeggio':
                this.createArpeggioLayer(baseFreq, intervals, config.tempo);
                break;
            case 'bells':
            case 'chimes':
            case 'sparkles':
                this.createBellsLayer(baseFreq, intervals);
                break;
            case 'strings':
                this.createStringsLayer(baseFreq, intervals);
                break;
            case 'whispers':
                this.createWhispersLayer(baseFreq, intervals);
                break;
            case 'heartbeat':
            case 'pulse':
                this.createPulseLayer(baseFreq, config.tempo);
                break;
            case 'shimmer':
            case 'celestial':
                this.createShimmerLayer(baseFreq, intervals);
                break;
            // Meditation-specific layers
            case 'singingBowl':
                this.createSingingBowlLayer(baseFreq, intervals);
                break;
            case 'breathPad':
                this.createBreathPadLayer(baseFreq, intervals, config.tempo);
                break;
            case 'windChimes':
                this.createWindChimesLayer(baseFreq, intervals);
                break;
            case 'deepDrone':
                this.createDeepDroneLayer(baseFreq, intervals);
                break;
        }
    }

    /**
     * Create pad/drone layer - sustained chord oscillators with LFO
     */
    createPadLayer(baseFreq, intervals, isDrone = false) {
        const now = this.audioContext.currentTime;

        intervals.forEach((interval, i) => {
            const freq = baseFreq * interval;

            // Main oscillator
            const osc = this.audioContext.createOscillator();
            osc.type = isDrone ? 'sawtooth' : 'sine';
            osc.frequency.value = freq;

            // Slight detune for richness
            osc.detune.value = (i - 1) * 5;

            // Individual gain
            const oscGain = this.audioContext.createGain();
            oscGain.gain.value = 0.15;

            // LFO for subtle movement
            const lfo = this.audioContext.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + (i * 0.02); // Slow wobble

            const lfoGain = this.audioContext.createGain();
            lfoGain.gain.value = isDrone ? 0.02 : 0.01;

            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // For drone, add filter sweep
            if (isDrone) {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 400;
                filter.Q.value = 1;

                // Slow filter sweep
                filter.frequency.setValueAtTime(200, now);
                filter.frequency.linearRampToValueAtTime(600, now + 8);
                filter.frequency.linearRampToValueAtTime(200, now + 16);

                osc.connect(filter);
                filter.connect(oscGain);
            } else {
                osc.connect(oscGain);
            }

            oscGain.connect(this.musicNodes.gainNode);

            osc.start(now);
            lfo.start(now);

            this.musicNodes.oscillators.push(osc, lfo);
            this.musicNodes.lfoNodes.push(oscGain);
        });
    }

    /**
     * Create arpeggio layer - scheduled note sequence
     */
    createArpeggioLayer(baseFreq, intervals, tempo) {
        const beatDuration = 60 / tempo; // Seconds per beat
        const noteLength = beatDuration * 0.8;
        let currentNote = 0;

        const playArpeggioNote = () => {
            if (!this.musicPlaying) return;

            const now = this.audioContext.currentTime;
            const interval = intervals[currentNote % intervals.length];
            const freq = baseFreq * interval;

            // Create oscillator for single note
            const osc = this.audioContext.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq * 2; // Octave up

            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + noteLength);

            osc.connect(gain);
            gain.connect(this.musicNodes.gainNode);

            osc.start(now);
            osc.stop(now + noteLength);

            currentNote++;
        };

        // Start arpeggio loop
        this.arpeggioInterval = setInterval(playArpeggioNote, beatDuration * 1000);
    }

    /**
     * Create bells/chimes layer - high sine tones with fast decay
     */
    createBellsLayer(baseFreq, intervals) {
        const now = this.audioContext.currentTime;

        // Random bell strikes every few seconds
        const playBell = () => {
            if (!this.musicPlaying) return;

            const interval = intervals[Math.floor(Math.random() * intervals.length)];
            const freq = baseFreq * interval;

            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 2);

            osc.connect(gain);
            gain.connect(this.musicNodes.gainNode);

            osc.start();
            osc.stop(this.audioContext.currentTime + 2);

            // Schedule next bell at random interval
            if (this.musicPlaying) {
                setTimeout(playBell, 2000 + Math.random() * 4000);
            }
        };

        setTimeout(playBell, 1000);
    }

    /**
     * Create strings layer - sustained harmonics
     */
    createStringsLayer(baseFreq, intervals) {
        intervals.forEach((interval, i) => {
            const freq = baseFreq * interval;

            const osc = this.audioContext.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            // Filter for smoother tone
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;
            filter.Q.value = 0.5;

            const gain = this.audioContext.createGain();
            gain.gain.value = 0.05;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicNodes.gainNode);

            osc.start();
            this.musicNodes.oscillators.push(osc);
        });
    }

    /**
     * Create whispers layer - filtered noise with movement
     */
    createWhispersLayer(baseFreq, intervals) {
        // Create white noise via buffer
        const bufferSize = 2 * this.audioContext.sampleRate;
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        // Band-pass filter for whisper effect
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = baseFreq * 8;
        filter.Q.value = 2;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0.03;

        // Slow LFO on filter frequency
        const lfo = this.audioContext.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05;

        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = baseFreq * 2;

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicNodes.gainNode);

        noise.start();
        lfo.start();

        this.musicNodes.oscillators.push(noise, lfo);
    }

    /**
     * Create pulse/heartbeat layer - rhythmic low tones
     */
    createPulseLayer(baseFreq, tempo) {
        const beatDuration = 60 / tempo;

        const playPulse = () => {
            if (!this.musicPlaying) return;

            const now = this.audioContext.currentTime;

            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = baseFreq * 0.5;

            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

            osc.connect(gain);
            gain.connect(this.musicNodes.gainNode);

            osc.start(now);
            osc.stop(now + 0.5);

            if (this.musicPlaying) {
                setTimeout(playPulse, beatDuration * 2000); // Every 2 beats
            }
        };

        setTimeout(playPulse, 500);
    }

    /**
     * Create shimmer/celestial layer - harmonics with movement
     */
    createShimmerLayer(baseFreq, intervals) {
        const now = this.audioContext.currentTime;

        intervals.forEach((interval, i) => {
            const freq = baseFreq * interval;

            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            // Tremolo LFO
            const lfo = this.audioContext.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 2 + (i * 0.5);

            const lfoGain = this.audioContext.createGain();
            lfoGain.gain.value = 0.03;

            const mainGain = this.audioContext.createGain();
            mainGain.gain.value = 0.04;

            lfo.connect(lfoGain);
            lfoGain.connect(mainGain.gain);

            osc.connect(mainGain);
            mainGain.connect(this.musicNodes.gainNode);

            osc.start();
            lfo.start();

            this.musicNodes.oscillators.push(osc, lfo);
        });
    }

    // ==========================================
    // MEDITATION MUSIC LAYERS
    // ==========================================

    /**
     * Create singing bowl layer - resonant, bell-like tones with long decay
     * Emulates Tibetan singing bowls with rich harmonics
     */
    createSingingBowlLayer(baseFreq, intervals) {
        const now = this.audioContext.currentTime;
        let noteIndex = 0;

        // Play a singing bowl tone every 8 seconds
        const playBowlNote = () => {
            if (!this.musicPlaying) return;

            const currentTime = this.audioContext.currentTime;
            const interval = intervals[noteIndex % intervals.length];
            const freq = baseFreq * interval;

            // Main tone oscillator
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            // Add harmonic overtones (characteristic of singing bowls)
            const osc2 = this.audioContext.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = freq * 2.76; // Characteristic overtone ratio

            const osc3 = this.audioContext.createOscillator();
            osc3.type = 'sine';
            osc3.frequency.value = freq * 5.4; // Higher partial

            // Gain nodes with long decay envelope
            const mainGain = this.audioContext.createGain();
            const harm2Gain = this.audioContext.createGain();
            const harm3Gain = this.audioContext.createGain();

            // Attack and long decay (8 second ring)
            mainGain.gain.setValueAtTime(0, currentTime);
            mainGain.gain.linearRampToValueAtTime(0.15, currentTime + 0.5);
            mainGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 8);

            harm2Gain.gain.setValueAtTime(0, currentTime);
            harm2Gain.gain.linearRampToValueAtTime(0.08, currentTime + 0.3);
            harm2Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 6);

            harm3Gain.gain.setValueAtTime(0, currentTime);
            harm3Gain.gain.linearRampToValueAtTime(0.04, currentTime + 0.2);
            harm3Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 4);

            osc.connect(mainGain);
            osc2.connect(harm2Gain);
            osc3.connect(harm3Gain);

            mainGain.connect(this.musicNodes.gainNode);
            harm2Gain.connect(this.musicNodes.gainNode);
            harm3Gain.connect(this.musicNodes.gainNode);

            osc.start(currentTime);
            osc2.start(currentTime);
            osc3.start(currentTime);

            osc.stop(currentTime + 8.5);
            osc2.stop(currentTime + 6.5);
            osc3.stop(currentTime + 4.5);

            noteIndex++;
        };

        // Play first bowl immediately
        playBowlNote();

        // Schedule subsequent bowl strikes
        this.bowlInterval = setInterval(() => {
            if (this.musicPlaying) {
                playBowlNote();
            } else {
                clearInterval(this.bowlInterval);
            }
        }, 8000);
    }

    /**
     * Create breath pad layer - slowly modulating pad that follows breathing rhythm
     * Rises and falls with a 14-second cycle (matching box breathing)
     */
    createBreathPadLayer(baseFreq, intervals, tempo) {
        const now = this.audioContext.currentTime;
        const breathCycleTime = 14; // 4s inhale + 4s hold + 4s exhale + 2s pause

        intervals.forEach((interval, i) => {
            const freq = baseFreq * interval;

            // Oscillator with gentle waveform
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.detune.value = (i - 1) * 3; // Slight detune for warmth

            // Gain node for breath-synced volume
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.08;

            // LFO for breath-synced pulsing
            const lfo = this.audioContext.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 1 / breathCycleTime; // One cycle per breath

            const lfoGain = this.audioContext.createGain();
            lfoGain.gain.value = 0.04; // Subtle volume modulation

            lfo.connect(lfoGain);
            lfoGain.connect(gainNode.gain);

            osc.connect(gainNode);
            gainNode.connect(this.musicNodes.gainNode);

            osc.start(now);
            lfo.start(now);

            this.musicNodes.oscillators.push(osc, lfo);
        });
    }

    /**
     * Create wind chimes layer - random, delicate high-pitched notes
     * Soft, occasional chime sounds for ambient texture
     */
    createWindChimesLayer(baseFreq, intervals) {
        const playChime = () => {
            if (!this.musicPlaying) return;

            const currentTime = this.audioContext.currentTime;
            const interval = intervals[Math.floor(Math.random() * intervals.length)];
            const freq = baseFreq * interval;

            // High-pitched sine tone
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            // Quick attack, medium decay envelope
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0, currentTime);
            gainNode.gain.linearRampToValueAtTime(0.06, currentTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + 2);

            osc.connect(gainNode);
            gainNode.connect(this.musicNodes.gainNode);

            osc.start(currentTime);
            osc.stop(currentTime + 2.1);
        };

        // Play chimes at random intervals (3-7 seconds)
        const scheduleNextChime = () => {
            if (!this.musicPlaying) return;

            const delay = 3000 + Math.random() * 4000;
            setTimeout(() => {
                if (this.musicPlaying) {
                    playChime();
                    scheduleNextChime();
                }
            }, delay);
        };

        // Start chime sequence
        setTimeout(playChime, 1000);
        scheduleNextChime();
    }

    /**
     * Create deep drone layer - sub-bass grounding tone
     * Very low frequency drone for grounding effect
     */
    createDeepDroneLayer(baseFreq, intervals) {
        const now = this.audioContext.currentTime;

        intervals.forEach((interval, i) => {
            const freq = baseFreq * interval; // Will be around 87Hz and 174Hz

            // Low sine wave
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            // Slow LFO for subtle movement
            const lfo = this.audioContext.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.03; // Very slow wobble

            const lfoGain = this.audioContext.createGain();
            lfoGain.gain.value = 3; // Subtle frequency variation

            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // Low-pass filter to smooth the drone
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 200;
            filter.Q.value = 0.5;

            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.1;

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.musicNodes.gainNode);

            osc.start(now);
            lfo.start(now);

            this.musicNodes.oscillators.push(osc, lfo);
        });
    }

    /**
     * Play meditation music for campfire rest
     */
    playMeditationMusic() {
        this.playAreaMusic('meditation');
    }

    /**
     * Stop meditation music
     */
    stopMeditationMusic() {
        if (this.bowlInterval) {
            clearInterval(this.bowlInterval);
            this.bowlInterval = null;
        }
        this.stopMusic(true);
    }

    /**
     * Stop background music
     * @param {boolean} fade - Whether to fade out (default true)
     */
    stopMusic(fade = true) {
        if (!this.musicPlaying) return;

        console.log('[AudioManager] 🔇 Stopping music');

        // Clear arpeggio interval
        if (this.arpeggioInterval) {
            clearInterval(this.arpeggioInterval);
            this.arpeggioInterval = null;
        }

        this.musicPlaying = false;

        if (this.musicNodes.gainNode) {
            if (fade) {
                // Fade out over 1 second
                this.musicNodes.gainNode.gain.linearRampToValueAtTime(
                    0,
                    this.audioContext.currentTime + 1
                );

                // Stop oscillators after fade
                setTimeout(() => {
                    this.stopMusicOscillators();
                }, 1100);
            } else {
                // Immediate stop
                this.stopMusicOscillators();
            }
        }

        this.currentArea = null;
    }

    /**
     * Stop all music oscillators
     */
    stopMusicOscillators() {
        if (this.musicNodes) {
            this.musicNodes.oscillators.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {
                    // Oscillator already stopped
                }
            });
            this.musicNodes.oscillators = [];

            this.musicNodes.lfoNodes.forEach(node => {
                try {
                    node.disconnect();
                } catch (e) {}
            });
            this.musicNodes.lfoNodes = [];

            if (this.musicNodes.gainNode) {
                this.musicNodes.gainNode.disconnect();
                this.musicNodes.gainNode = null;
            }
        }
    }

    /**
     * Set music volume
     * @param {number} volume - Volume level 0-1
     */
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));

        if (this.musicNodes?.gainNode && this.musicPlaying) {
            this.musicNodes.gainNode.gain.linearRampToValueAtTime(
                this.musicVolume * 0.3,
                this.audioContext.currentTime + 0.1
            );
        }

        console.log(`[AudioManager] Music volume set to ${Math.round(this.musicVolume * 100)}%`);
    }

    /**
     * Get currently playing area music
     * @returns {string|null} Current area or null
     */
    getCurrentMusicArea() {
        return this.currentArea;
    }

    /**
     * Clean up audio resources
     */
    destroy() {
        // Stop any playing music
        if (this.musicPlaying) {
            this.stopMusic(false);
        }

        // Remove mobile audio unlock listeners
        this.removeUnlockListeners();

        // Clear music nodes
        this.musicNodes = null;
        this.currentArea = null;
        this.musicPlaying = false;

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
