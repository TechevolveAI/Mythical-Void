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

        // Lazy sound registry - definitions stored here, generated on first play
        this.soundRegistry = new Map();
        this.soundsGenerated = 0;

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

            // Load audio preferences from GameState or localStorage.
            if (typeof window !== 'undefined' && window.GameState) {
                this.muted = window.GameState.get('settings.audioMuted') || false;
                this.masterVolume = this.readVolumePreference(
                    window.GameState.get('settings.volume.master'),
                    'audioMasterVolume',
                    this.masterVolume
                );
                this.musicVolume = this.readVolumePreference(
                    window.GameState.get('settings.volume.music'),
                    'audioMusicVolume',
                    this.musicVolume
                );
                this.sfxVolume = this.readVolumePreference(
                    window.GameState.get('settings.volume.sfx'),
                    'audioSFXVolume',
                    this.sfxVolume
                );
            } else if (typeof localStorage !== 'undefined') {
                this.muted = localStorage.getItem('audioMuted') === 'true';
                this.masterVolume = this.readVolumePreference(
                    undefined,
                    'audioMasterVolume',
                    this.masterVolume
                );
                this.musicVolume = this.readVolumePreference(
                    undefined,
                    'audioMusicVolume',
                    this.musicVolume
                );
                this.sfxVolume = this.readVolumePreference(
                    undefined,
                    'audioSFXVolume',
                    this.sfxVolume
                );
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

    readVolumePreference(stateValue, storageKey, fallback) {
        let value = stateValue === null || stateValue === undefined || stateValue === ''
            ? Number.NaN
            : Number(stateValue);
        if (!Number.isFinite(value) && typeof localStorage !== 'undefined') {
            const storedValue = localStorage.getItem(storageKey);
            value = storedValue === null || storedValue === ''
                ? Number.NaN
                : Number(storedValue);
        }
        return Number.isFinite(value)
            ? Math.max(0, Math.min(1, value))
            : fallback;
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

        // ==========================================
        // BOSS FIGHT SOUNDS
        // ==========================================

        // Boss roar - deep, menacing rumble with power buildup
        this.createToneSequence('boss_roar', [
            { frequency: 80, duration: 0.15, volume: 0.35 },
            { frequency: 60, duration: 0.2, volume: 0.4 },
            { frequency: 100, duration: 0.25, volume: 0.35 },
            { frequency: 70, duration: 0.3, volume: 0.3 },
            { frequency: 50, duration: 0.4, volume: 0.25 }
        ]);

        // Boss warning - ominous alert before attack
        this.createToneSequence('boss_warning', [
            { frequency: 200, duration: 0.15, volume: 0.25 },
            { frequency: 180, duration: 0.15, volume: 0.3 },
            { frequency: 200, duration: 0.15, volume: 0.25 }
        ]);

        // Boss ground slam - heavy impact with rumble
        this.createToneSequence('boss_slam', [
            { frequency: 120, duration: 0.08, volume: 0.4 },
            { frequency: 80, duration: 0.15, volume: 0.35 },
            { frequency: 50, duration: 0.2, volume: 0.3 },
            { frequency: 40, duration: 0.25, volume: 0.2 }
        ]);

        // Boss projectile fire - sharp crystal sound
        this.createToneSequence('boss_projectile', [
            { frequency: 600, duration: 0.05, volume: 0.25 },
            { frequency: 800, duration: 0.08, volume: 0.2 },
            { frequency: 500, duration: 0.1, volume: 0.15 }
        ]);

        // Boss charge attack - whoosh with power
        this.createToneSequence('boss_charge', [
            { frequency: 150, duration: 0.1, volume: 0.25 },
            { frequency: 200, duration: 0.15, volume: 0.3 },
            { frequency: 250, duration: 0.2, volume: 0.35 },
            { frequency: 300, duration: 0.15, volume: 0.25 }
        ]);

        // Boss phase transition - dramatic power surge
        this.createToneSequence('boss_phase', [
            { frequency: 100, duration: 0.2, volume: 0.3 },
            { frequency: 150, duration: 0.2, volume: 0.35 },
            { frequency: 200, duration: 0.25, volume: 0.4 },
            { frequency: 300, duration: 0.3, volume: 0.35 },
            { frequency: 400, duration: 0.4, volume: 0.3 }
        ]);

        // Boss hit - solid impact when boss takes damage
        this.createToneSequence('boss_hit', [
            { frequency: 150, duration: 0.08, volume: 0.35 },
            { frequency: 100, duration: 0.1, volume: 0.3 },
            { frequency: 80, duration: 0.08, volume: 0.2 }
        ]);

        // Boss defeated - triumphant explosion
        this.createToneSequence('boss_defeated', [
            { frequency: 200, duration: 0.15, volume: 0.3 },
            { frequency: 300, duration: 0.15, volume: 0.35 },
            { frequency: 400, duration: 0.2, volume: 0.4 },
            { frequency: 523.25, duration: 0.2, volume: 0.4 },  // C5
            { frequency: 659.25, duration: 0.2, volume: 0.35 }, // E5
            { frequency: 783.99, duration: 0.25, volume: 0.35 }, // G5
            { frequency: 1046.50, duration: 0.3, volume: 0.3 }   // C6
        ]);

        // Boss intro - dramatic awakening
        this.createToneSequence('boss_intro', [
            { frequency: 80, duration: 0.3, volume: 0.2 },
            { frequency: 100, duration: 0.3, volume: 0.25 },
            { frequency: 120, duration: 0.3, volume: 0.3 },
            { frequency: 150, duration: 0.4, volume: 0.35 }
        ]);

        // ==========================================
        // COMBAT JUICE SOUNDS - Exciting hit feedback
        // ==========================================

        // Combo hit - satisfying ascending tone for building combos
        this.createToneSequence('combo_hit', [
            { frequency: 600, duration: 0.05, volume: 0.2 },
            { frequency: 700, duration: 0.05, volume: 0.25 },
            { frequency: 800, duration: 0.08, volume: 0.2 }
        ]);

        // Combo milestone - reward for hitting 5x, 10x, etc
        this.createToneSequence('combo_milestone', [
            { frequency: 523.25, duration: 0.08, volume: 0.25 },  // C5
            { frequency: 659.25, duration: 0.08, volume: 0.3 },   // E5
            { frequency: 783.99, duration: 0.1, volume: 0.35 },   // G5
            { frequency: 1046.50, duration: 0.15, volume: 0.3 }   // C6
        ]);

        // Combo break - descending tone when combo ends
        this.createToneSequence('combo_break', [
            { frequency: 400, duration: 0.08, volume: 0.2 },
            { frequency: 350, duration: 0.1, volume: 0.15 },
            { frequency: 300, duration: 0.12, volume: 0.1 }
        ]);

        // Critical hit - powerful impact with punch
        this.createToneSequence('critical_hit', [
            { frequency: 150, duration: 0.06, volume: 0.35 },
            { frequency: 200, duration: 0.08, volume: 0.4 },
            { frequency: 800, duration: 0.1, volume: 0.3 },
            { frequency: 600, duration: 0.15, volume: 0.2 }
        ]);

        // Victory fanfare - epic boss defeat celebration
        this.createToneSequence('victory_fanfare', [
            { frequency: 392.00, duration: 0.15, volume: 0.3 },   // G4
            { frequency: 493.88, duration: 0.15, volume: 0.35 },  // B4
            { frequency: 587.33, duration: 0.15, volume: 0.35 },  // D5
            { frequency: 783.99, duration: 0.2, volume: 0.4 },    // G5
            { frequency: 987.77, duration: 0.2, volume: 0.4 },    // B5
            { frequency: 1174.66, duration: 0.25, volume: 0.35 }, // D6
            { frequency: 1567.98, duration: 0.3, volume: 0.35 },  // G6
            { frequency: 1975.53, duration: 0.4, volume: 0.3 }    // B6
        ]);

        // Slow-mo whoosh - time slowing down effect
        this.createToneSequence('slowmo_enter', [
            { frequency: 400, duration: 0.2, volume: 0.15 },
            { frequency: 300, duration: 0.3, volume: 0.12 },
            { frequency: 200, duration: 0.4, volume: 0.08 }
        ]);

        // Slow-mo exit - time resuming effect
        this.createToneSequence('slowmo_exit', [
            { frequency: 200, duration: 0.15, volume: 0.1 },
            { frequency: 300, duration: 0.12, volume: 0.15 },
            { frequency: 400, duration: 0.1, volume: 0.2 },
            { frequency: 500, duration: 0.08, volume: 0.15 }
        ]);

        // ==========================================
        // COSMIC CRYSTAL CAVE AMBIENT SOUNDS
        // ==========================================
        // High-frequency mystical chimes, resonant gongs, ethereal atmosphere

        // Crystal chime - ENHANCED cosmic sparkle (very high frequency)
        this.createToneSequence('crystal_chime', [
            { frequency: 2093.00, duration: 0.08, volume: 0.1 },   // C7 - bright attack
            { frequency: 2637.02, duration: 0.1, volume: 0.12 },   // E7 - sparkle
            { frequency: 3135.96, duration: 0.15, volume: 0.1 },   // G7 - ethereal
            { frequency: 4186.01, duration: 0.25, volume: 0.06 },  // C8 - cosmic shimmer
            { frequency: 3135.96, duration: 0.4, volume: 0.04 }    // G7 - decay
        ]);

        // Crystal chime variant 2 - cosmic cascade (descending sparkles)
        this.createToneSequence('crystal_chime_2', [
            { frequency: 3951.07, duration: 0.06, volume: 0.08 },  // B7 - high start
            { frequency: 3135.96, duration: 0.1, volume: 0.1 },    // G7
            { frequency: 2637.02, duration: 0.12, volume: 0.09 },  // E7
            { frequency: 2093.00, duration: 0.2, volume: 0.07 },   // C7
            { frequency: 1567.98, duration: 0.35, volume: 0.05 }   // G6 - fade into void
        ]);

        // Crystal chime variant 3 - celestial bells (ultra high)
        this.createToneSequence('crystal_chime_3', [
            { frequency: 4186.01, duration: 0.05, volume: 0.06 },  // C8 - angelic
            { frequency: 4698.63, duration: 0.08, volume: 0.08 },  // D8
            { frequency: 5274.04, duration: 0.1, volume: 0.06 },   // E8 - celestial peak
            { frequency: 4186.01, duration: 0.15, volume: 0.05 },  // C8
            { frequency: 3135.96, duration: 0.3, volume: 0.03 }    // G7 - ethereal trail
        ]);

        // Cosmic gong - deep resonant with mystical overtones
        this.createToneSequence('cave_gong', [
            { frequency: 55.00, duration: 0.15, volume: 0.15 },    // A1 - primordial impact
            { frequency: 110.00, duration: 0.3, volume: 0.18 },    // A2 - resonance builds
            { frequency: 220.00, duration: 0.4, volume: 0.15 },    // A3 - overtone
            { frequency: 440.00, duration: 0.5, volume: 0.1 },     // A4 - harmonic bloom
            { frequency: 880.00, duration: 0.6, volume: 0.06 },    // A5 - mystical shimmer
            { frequency: 110.00, duration: 1.2, volume: 0.08 }     // A2 - long resonant decay
        ]);

        // Singing bowl gong - meditative cosmic tone
        this.createToneSequence('cave_gong_medium', [
            { frequency: 174.61, duration: 0.1, volume: 0.14 },    // F3 - bowl strike
            { frequency: 349.23, duration: 0.25, volume: 0.16 },   // F4 - primary tone
            { frequency: 698.46, duration: 0.4, volume: 0.12 },    // F5 - overtone
            { frequency: 1396.91, duration: 0.5, volume: 0.08 },   // F6 - high shimmer
            { frequency: 349.23, duration: 0.9, volume: 0.06 }     // F4 - singing sustain
        ]);

        // Cosmic whistle - ethereal void wind
        this.createToneSequence('cave_whistle', [
            { frequency: 1760.00, duration: 0.2, volume: 0.04 },   // A6 - high entry
            { frequency: 1864.66, duration: 0.3, volume: 0.06 },   // Bb6 - otherworldly
            { frequency: 1975.53, duration: 0.35, volume: 0.05 },  // B6 - cosmic drift
            { frequency: 1760.00, duration: 0.4, volume: 0.04 },   // A6 - return
            { frequency: 1567.98, duration: 0.5, volume: 0.03 }    // G6 - fade to void
        ]);

        // Crystal resonance - ascending cosmic shimmer
        this.createToneSequence('crystal_resonance', [
            { frequency: 783.99, duration: 0.15, volume: 0.07 },   // G5 - base
            { frequency: 987.77, duration: 0.15, volume: 0.09 },   // B5
            { frequency: 1174.66, duration: 0.2, volume: 0.1 },    // D6
            { frequency: 1567.98, duration: 0.25, volume: 0.1 },   // G6
            { frequency: 1975.53, duration: 0.3, volume: 0.08 },   // B6 - peak shimmer
            { frequency: 2349.32, duration: 0.4, volume: 0.05 }    // D7 - cosmic trail
        ]);

        // Cave drip - crystalline water drop (higher, more magical)
        this.createToneSequence('cave_drip', [
            { frequency: 3500, duration: 0.015, volume: 0.12 },    // Bright impact
            { frequency: 2500, duration: 0.025, volume: 0.08 },    // Resonance
            { frequency: 1800, duration: 0.04, volume: 0.05 }      // Fade
        ]);

        // Cosmic drone - deep space atmosphere with harmonic layers
        this.createToneSequence('cave_drone', [
            { frequency: 36.71, duration: 0.4, volume: 0.06 },     // D1 - subterranean rumble
            { frequency: 55.00, duration: 0.5, volume: 0.08 },     // A1 - void bass
            { frequency: 73.42, duration: 0.5, volume: 0.07 },     // D2 - cosmic hum
            { frequency: 110.00, duration: 0.6, volume: 0.06 },    // A2 - resonance
            { frequency: 146.83, duration: 0.5, volume: 0.05 },    // D3 - harmonic float
            { frequency: 55.00, duration: 1.0, volume: 0.04 }      // A1 - return to void
        ]);

        // ==========================================
        // CREATURE IDLE SOUNDS (Stage & Personality)
        // ==========================================

        // Adult creature sounds - varied based on personality
        this.createToneSequence('creature_hum', [
            { frequency: 220, duration: 0.3, volume: 0.12 },
            { frequency: 246.94, duration: 0.35, volume: 0.14 },
            { frequency: 220, duration: 0.4, volume: 0.1 }
        ]);

        this.createToneSequence('creature_purr', [
            { frequency: 180, duration: 0.15, volume: 0.1 },
            { frequency: 190, duration: 0.15, volume: 0.12 },
            { frequency: 175, duration: 0.15, volume: 0.1 },
            { frequency: 185, duration: 0.15, volume: 0.12 },
            { frequency: 180, duration: 0.2, volume: 0.08 }
        ]);

        this.createToneSequence('creature_trill', [
            { frequency: 500, duration: 0.08, volume: 0.15 },
            { frequency: 600, duration: 0.08, volume: 0.18 },
            { frequency: 550, duration: 0.08, volume: 0.16 },
            { frequency: 650, duration: 0.1, volume: 0.14 }
        ]);

        this.createToneSequence('creature_curious', [
            { frequency: 400, duration: 0.1, volume: 0.12 },
            { frequency: 500, duration: 0.15, volume: 0.15 },
            { frequency: 550, duration: 0.12, volume: 0.12 }
        ]);

        // Juvenile sounds - playful, energetic
        this.createToneSequence('juvenile_squeak', [
            { frequency: 700, duration: 0.06, volume: 0.15 },
            { frequency: 800, duration: 0.08, volume: 0.18 },
            { frequency: 750, duration: 0.06, volume: 0.12 }
        ]);

        this.createToneSequence('juvenile_bounce', [
            { frequency: 550, duration: 0.08, volume: 0.14 },
            { frequency: 650, duration: 0.08, volume: 0.16 },
            { frequency: 600, duration: 0.1, volume: 0.12 }
        ]);

        // Elder sounds - wise, resonant
        this.createToneSequence('elder_sigh', [
            { frequency: 150, duration: 0.4, volume: 0.12 },
            { frequency: 130, duration: 0.5, volume: 0.1 },
            { frequency: 120, duration: 0.6, volume: 0.08 }
        ]);

        this.createToneSequence('elder_wisdom', [
            { frequency: 200, duration: 0.3, volume: 0.12 },
            { frequency: 250, duration: 0.35, volume: 0.14 },
            { frequency: 300, duration: 0.4, volume: 0.12 },
            { frequency: 250, duration: 0.5, volume: 0.08 }
        ]);

        // ==========================================
        // MOOD-BASED SOUNDS
        // ==========================================

        // Happy mood - bright, uplifting
        this.createToneSequence('mood_happy', [
            { frequency: 523.25, duration: 0.1, volume: 0.08 },
            { frequency: 659.25, duration: 0.1, volume: 0.1 },
            { frequency: 783.99, duration: 0.15, volume: 0.08 }
        ]);

        // Content mood - gentle, warm
        this.createToneSequence('mood_content', [
            { frequency: 392, duration: 0.2, volume: 0.08 },
            { frequency: 440, duration: 0.25, volume: 0.08 }
        ]);

        // Sad mood - minor key, descending
        this.createToneSequence('mood_sad', [
            { frequency: 392, duration: 0.25, volume: 0.08 },
            { frequency: 349.23, duration: 0.25, volume: 0.07 },
            { frequency: 329.63, duration: 0.3, volume: 0.06 }
        ]);

        // Critical mood - urgent, concerned
        this.createToneSequence('mood_critical', [
            { frequency: 300, duration: 0.1, volume: 0.12 },
            { frequency: 280, duration: 0.1, volume: 0.1 },
            { frequency: 300, duration: 0.15, volume: 0.12 }
        ]);

        // ==========================================
        // BREEDING SHRINE SOUNDS
        // ==========================================

        // Mystical ambient drone for shrine
        this.createToneSequence('shrine_ambient', [
            { frequency: 174.61, duration: 0.5, volume: 0.06 },
            { frequency: 220, duration: 0.5, volume: 0.08 },
            { frequency: 261.63, duration: 0.6, volume: 0.06 }
        ]);

        // Parent selection confirmation
        this.createToneSequence('shrine_select', [
            { frequency: 523.25, duration: 0.1, volume: 0.15 },
            { frequency: 659.25, duration: 0.12, volume: 0.18 },
            { frequency: 783.99, duration: 0.15, volume: 0.15 }
        ]);

        // Compatibility check - harmonious (compatible)
        this.createToneSequence('shrine_compatible', [
            { frequency: 261.63, duration: 0.15, volume: 0.15 },
            { frequency: 329.63, duration: 0.15, volume: 0.18 },
            { frequency: 392, duration: 0.15, volume: 0.2 },
            { frequency: 523.25, duration: 0.2, volume: 0.18 }
        ]);

        // Compatibility check - dissonant (incompatible)
        this.createToneSequence('shrine_incompatible', [
            { frequency: 261.63, duration: 0.15, volume: 0.12 },
            { frequency: 277.18, duration: 0.15, volume: 0.1 },
            { frequency: 246.94, duration: 0.2, volume: 0.08 }
        ]);

        // Egg creation - magical building sequence
        this.createToneSequence('shrine_create_egg', [
            { frequency: 261.63, duration: 0.15, volume: 0.15 },
            { frequency: 329.63, duration: 0.15, volume: 0.18 },
            { frequency: 392, duration: 0.15, volume: 0.2 },
            { frequency: 523.25, duration: 0.15, volume: 0.22 },
            { frequency: 659.25, duration: 0.15, volume: 0.25 },
            { frequency: 783.99, duration: 0.2, volume: 0.28 },
            { frequency: 1046.50, duration: 0.3, volume: 0.25 }
        ]);

        // Offspring reveal - triumphant with rarity scaling
        this.createToneSequence('shrine_reveal_common', [
            { frequency: 392, duration: 0.15, volume: 0.2 },
            { frequency: 523.25, duration: 0.2, volume: 0.22 }
        ]);

        this.createToneSequence('shrine_reveal_rare', [
            { frequency: 392, duration: 0.12, volume: 0.22 },
            { frequency: 523.25, duration: 0.12, volume: 0.25 },
            { frequency: 659.25, duration: 0.15, volume: 0.28 },
            { frequency: 783.99, duration: 0.2, volume: 0.25 }
        ]);

        this.createToneSequence('shrine_reveal_epic', [
            { frequency: 392, duration: 0.1, volume: 0.25 },
            { frequency: 523.25, duration: 0.1, volume: 0.28 },
            { frequency: 659.25, duration: 0.1, volume: 0.3 },
            { frequency: 783.99, duration: 0.12, volume: 0.32 },
            { frequency: 1046.50, duration: 0.15, volume: 0.35 },
            { frequency: 1318.51, duration: 0.2, volume: 0.3 }
        ]);

        this.createToneSequence('shrine_reveal_legendary', [
            { frequency: 392, duration: 0.08, volume: 0.28 },
            { frequency: 523.25, duration: 0.08, volume: 0.3 },
            { frequency: 659.25, duration: 0.08, volume: 0.32 },
            { frequency: 783.99, duration: 0.1, volume: 0.35 },
            { frequency: 1046.50, duration: 0.1, volume: 0.38 },
            { frequency: 1318.51, duration: 0.12, volume: 0.4 },
            { frequency: 1567.98, duration: 0.15, volume: 0.38 },
            { frequency: 2093, duration: 0.25, volume: 0.35 }
        ]);

        // ==========================================
        // PORTAL / TELEPORTATION SOUNDS
        // ==========================================

        // Portal approach - growing otherworldly hum
        this.createToneSequence('portal_approach', [
            { frequency: 150, duration: 0.15, volume: 0.1 },
            { frequency: 200, duration: 0.15, volume: 0.12 },
            { frequency: 250, duration: 0.15, volume: 0.15 },
            { frequency: 300, duration: 0.2, volume: 0.18 }
        ]);

        // Portal entry - whooshing dimensional shift
        this.createToneSequence('portal_enter', [
            { frequency: 100, duration: 0.1, volume: 0.2 },
            { frequency: 200, duration: 0.1, volume: 0.25 },
            { frequency: 400, duration: 0.1, volume: 0.3 },
            { frequency: 800, duration: 0.15, volume: 0.25 },
            { frequency: 1200, duration: 0.2, volume: 0.15 }
        ]);

        // Portal travel - ethereal passage
        this.createToneSequence('portal_travel', [
            { frequency: 300, duration: 0.2, volume: 0.15 },
            { frequency: 350, duration: 0.2, volume: 0.18 },
            { frequency: 400, duration: 0.2, volume: 0.15 },
            { frequency: 350, duration: 0.2, volume: 0.12 }
        ]);

        // Portal arrival - materialization shimmer
        this.createToneSequence('portal_arrive', [
            { frequency: 1200, duration: 0.1, volume: 0.15 },
            { frequency: 800, duration: 0.1, volume: 0.2 },
            { frequency: 500, duration: 0.12, volume: 0.22 },
            { frequency: 300, duration: 0.15, volume: 0.18 },
            { frequency: 200, duration: 0.2, volume: 0.12 }
        ]);

        // ==========================================
        // SHOP & ECONOMY SOUNDS
        // ==========================================

        // Item hover - soft tone shift
        this.createToneSequence('shop_hover', [
            { frequency: 600, duration: 0.05, volume: 0.08 }
        ]);

        // Insufficient funds - gentle denial
        this.createToneSequence('shop_insufficient', [
            { frequency: 350, duration: 0.1, volume: 0.15 },
            { frequency: 300, duration: 0.15, volume: 0.12 }
        ]);

        // Purchase tier: cheap (<50 coins)
        this.createToneSequence('shop_purchase_small', [
            { frequency: 523.25, duration: 0.1, volume: 0.2 },
            { frequency: 659.25, duration: 0.12, volume: 0.22 }
        ]);

        // Purchase tier: medium (50-200 coins)
        this.createToneSequence('shop_purchase_medium', [
            { frequency: 523.25, duration: 0.08, volume: 0.22 },
            { frequency: 659.25, duration: 0.08, volume: 0.25 },
            { frequency: 783.99, duration: 0.1, volume: 0.28 },
            { frequency: 1046.50, duration: 0.15, volume: 0.25 }
        ]);

        // Purchase tier: expensive (>200 coins)
        this.createToneSequence('shop_purchase_large', [
            { frequency: 523.25, duration: 0.08, volume: 0.25 },
            { frequency: 659.25, duration: 0.08, volume: 0.28 },
            { frequency: 783.99, duration: 0.08, volume: 0.3 },
            { frequency: 1046.50, duration: 0.1, volume: 0.32 },
            { frequency: 1318.51, duration: 0.15, volume: 0.3 }
        ]);

        // Rare item reveal
        this.createToneSequence('shop_rare_reveal', [
            { frequency: 783.99, duration: 0.1, volume: 0.2 },
            { frequency: 987.77, duration: 0.1, volume: 0.25 },
            { frequency: 1174.66, duration: 0.1, volume: 0.28 },
            { frequency: 1318.51, duration: 0.15, volume: 0.3 },
            { frequency: 1567.98, duration: 0.2, volume: 0.25 }
        ]);

        // ==========================================
        // ENHANCED CARE ACTION SOUNDS
        // ==========================================

        // Feed with creature response
        this.createToneSequence('feed_response', [
            { frequency: 500, duration: 0.1, volume: 0.15 },
            { frequency: 550, duration: 0.12, volume: 0.18 },
            { frequency: 600, duration: 0.15, volume: 0.15 }
        ]);

        // Pet with creature purr
        this.createToneSequence('pet_response', [
            { frequency: 250, duration: 0.2, volume: 0.12 },
            { frequency: 260, duration: 0.2, volume: 0.14 },
            { frequency: 250, duration: 0.25, volume: 0.1 }
        ]);

        // Play with excited sound
        this.createToneSequence('play_response', [
            { frequency: 600, duration: 0.08, volume: 0.15 },
            { frequency: 700, duration: 0.08, volume: 0.18 },
            { frequency: 800, duration: 0.1, volume: 0.15 }
        ]);

        // Rest with peaceful sound
        this.createToneSequence('rest_start', [
            { frequency: 392, duration: 0.3, volume: 0.12 },
            { frequency: 349.23, duration: 0.35, volume: 0.1 },
            { frequency: 329.63, duration: 0.4, volume: 0.08 }
        ]);

        this.createToneSequence('rest_breathing', [
            { frequency: 200, duration: 0.5, volume: 0.06 },
            { frequency: 180, duration: 0.6, volume: 0.05 }
        ]);

        // ==========================================
        // TIERED ACHIEVEMENT FANFARES
        // ==========================================

        // Minor achievement - quick satisfying chime
        this.createToneSequence('achievement_minor', [
            { frequency: 523.25, duration: 0.1, volume: 0.2 },
            { frequency: 659.25, duration: 0.12, volume: 0.22 },
            { frequency: 783.99, duration: 0.15, volume: 0.2 }
        ]);

        // Major achievement - full musical phrase
        this.createToneSequence('achievement_major', [
            { frequency: 392, duration: 0.12, volume: 0.22 },
            { frequency: 523.25, duration: 0.12, volume: 0.25 },
            { frequency: 659.25, duration: 0.12, volume: 0.28 },
            { frequency: 783.99, duration: 0.15, volume: 0.3 },
            { frequency: 1046.50, duration: 0.2, volume: 0.28 }
        ]);

        // Epic achievement - triumphant orchestral hit
        this.createToneSequence('achievement_epic', [
            { frequency: 261.63, duration: 0.1, volume: 0.25 },
            { frequency: 392, duration: 0.1, volume: 0.28 },
            { frequency: 523.25, duration: 0.1, volume: 0.3 },
            { frequency: 659.25, duration: 0.12, volume: 0.32 },
            { frequency: 783.99, duration: 0.12, volume: 0.35 },
            { frequency: 1046.50, duration: 0.15, volume: 0.38 },
            { frequency: 1318.51, duration: 0.2, volume: 0.35 },
            { frequency: 1567.98, duration: 0.3, volume: 0.3 }
        ]);

        // Secret discovery - mysterious wonder-filled reveal
        this.createToneSequence('achievement_secret', [
            { frequency: 440, duration: 0.15, volume: 0.18 },
            { frequency: 554.37, duration: 0.15, volume: 0.2 },
            { frequency: 659.25, duration: 0.15, volume: 0.22 },
            { frequency: 880, duration: 0.2, volume: 0.25 },
            { frequency: 1108.73, duration: 0.25, volume: 0.22 },
            { frequency: 1318.51, duration: 0.3, volume: 0.18 }
        ]);

        // ==========================================
        // CAMPFIRE / REST AREA SOUNDS
        // ==========================================

        // Fire crackle - random pops
        this.createToneSequence('fire_crackle_1', [
            { frequency: 100, duration: 0.02, volume: 0.15 },
            { frequency: 150, duration: 0.03, volume: 0.12 }
        ]);

        this.createToneSequence('fire_crackle_2', [
            { frequency: 120, duration: 0.03, volume: 0.12 },
            { frequency: 80, duration: 0.02, volume: 0.1 }
        ]);

        this.createToneSequence('fire_crackle_3', [
            { frequency: 90, duration: 0.02, volume: 0.1 },
            { frequency: 130, duration: 0.03, volume: 0.14 },
            { frequency: 100, duration: 0.02, volume: 0.08 }
        ]);

        // Creature settling - content sounds at campfire
        this.createToneSequence('creature_settle', [
            { frequency: 300, duration: 0.2, volume: 0.1 },
            { frequency: 280, duration: 0.25, volume: 0.08 },
            { frequency: 260, duration: 0.3, volume: 0.06 }
        ]);

        // Nature ambient - distant sounds
        this.createToneSequence('nature_wind', [
            { frequency: 150, duration: 0.4, volume: 0.04 },
            { frequency: 180, duration: 0.5, volume: 0.05 },
            { frequency: 160, duration: 0.6, volume: 0.04 }
        ]);

        this.createToneSequence('nature_cricket', [
            { frequency: 4000, duration: 0.02, volume: 0.03 },
            { frequency: 4200, duration: 0.02, volume: 0.04 },
            { frequency: 4000, duration: 0.02, volume: 0.03 }
        ]);

        // ==========================================
        // UI MICROINTERACTION SOUNDS
        // ==========================================

        // Hover - very soft tone shift
        this.createToneSequence('ui_hover', [
            { frequency: 800, duration: 0.03, volume: 0.06 }
        ]);

        // Tab switch - soft whoosh
        this.createToneSequence('ui_tab', [
            { frequency: 500, duration: 0.04, volume: 0.1 },
            { frequency: 600, duration: 0.05, volume: 0.08 }
        ]);

        // Sort/filter - quick organizational
        this.createToneSequence('ui_sort', [
            { frequency: 700, duration: 0.03, volume: 0.1 },
            { frequency: 800, duration: 0.04, volume: 0.08 }
        ]);

        // Tooltip appear - gentle pop
        this.createToneSequence('ui_tooltip', [
            { frequency: 900, duration: 0.04, volume: 0.08 }
        ]);

        // Modal open - smooth transition
        this.createToneSequence('ui_modal_open', [
            { frequency: 400, duration: 0.06, volume: 0.12 },
            { frequency: 500, duration: 0.08, volume: 0.15 },
            { frequency: 600, duration: 0.1, volume: 0.12 }
        ]);

        // Modal close - reverse smooth transition
        this.createToneSequence('ui_modal_close', [
            { frequency: 600, duration: 0.06, volume: 0.12 },
            { frequency: 500, duration: 0.08, volume: 0.1 },
            { frequency: 400, duration: 0.1, volume: 0.08 }
        ]);

        // Success state - bright confirmation
        this.createToneSequence('ui_success', [
            { frequency: 523.25, duration: 0.08, volume: 0.15 },
            { frequency: 659.25, duration: 0.1, volume: 0.18 },
            { frequency: 783.99, duration: 0.12, volume: 0.15 }
        ]);

        // Denial state - gentle (not harsh)
        this.createToneSequence('ui_deny', [
            { frequency: 400, duration: 0.08, volume: 0.12 },
            { frequency: 350, duration: 0.1, volume: 0.1 }
        ]);

        // Notification - attention-getting but not jarring
        this.createToneSequence('ui_notification', [
            { frequency: 659.25, duration: 0.08, volume: 0.15 },
            { frequency: 783.99, duration: 0.1, volume: 0.18 },
            { frequency: 659.25, duration: 0.08, volume: 0.12 }
        ]);

        // ==========================================
        // CRYSTAL CAVES SOUNDS
        // ==========================================

        // Shield activate - magical protection rising
        this.createToneSequence('shield_activate', [
            { frequency: 523.25, duration: 0.1, volume: 0.25 },   // C5
            { frequency: 783.99, duration: 0.1, volume: 0.28 },   // G5
            { frequency: 1046.50, duration: 0.12, volume: 0.3 },  // C6
            { frequency: 1567.98, duration: 0.15, volume: 0.28 }, // G6
            { frequency: 2093.00, duration: 0.2, volume: 0.22 }   // C7 - sparkle
        ]);

        // Shield expire - fading away
        this.createToneSequence('shield_expire', [
            { frequency: 1046.50, duration: 0.15, volume: 0.15 },
            { frequency: 783.99, duration: 0.15, volume: 0.12 },
            { frequency: 523.25, duration: 0.2, volume: 0.08 }
        ]);

        // Crystal slide - smooth crystalline glide
        this.createToneSequence('crystal_slide', [
            { frequency: 800, duration: 0.1, volume: 0.12 },
            { frequency: 1000, duration: 0.1, volume: 0.15 },
            { frequency: 1200, duration: 0.1, volume: 0.12 },
            { frequency: 1000, duration: 0.15, volume: 0.1 }
        ]);

        // Spider hiss - warning sound
        this.createToneSequence('spider_hiss', [
            { frequency: 2000, duration: 0.1, volume: 0.2 },
            { frequency: 2500, duration: 0.12, volume: 0.18 },
            { frequency: 1800, duration: 0.15, volume: 0.15 },
            { frequency: 2200, duration: 0.1, volume: 0.12 }
        ]);

        // Spider pounce - aggressive attack leap
        this.createToneSequence('spider_pounce', [
            { frequency: 200, duration: 0.05, volume: 0.25 },
            { frequency: 300, duration: 0.05, volume: 0.3 },
            { frequency: 400, duration: 0.08, volume: 0.28 },
            { frequency: 600, duration: 0.1, volume: 0.2 }
        ]);

        // Web shoot - sticky projectile
        this.createToneSequence('web_shoot', [
            { frequency: 400, duration: 0.04, volume: 0.15 },
            { frequency: 500, duration: 0.06, volume: 0.18 },
            { frequency: 300, duration: 0.08, volume: 0.12 }
        ]);

        // Stalactite fall - crashing from ceiling
        this.createToneSequence('stalactite_fall', [
            { frequency: 150, duration: 0.08, volume: 0.3 },
            { frequency: 100, duration: 0.1, volume: 0.35 },
            { frequency: 60, duration: 0.15, volume: 0.4 },
            { frequency: 40, duration: 0.2, volume: 0.25 }
        ]);

        // Crystal pillar break - shattering crystal
        this.createToneSequence('pillar_break', [
            { frequency: 800, duration: 0.05, volume: 0.25 },
            { frequency: 600, duration: 0.05, volume: 0.28 },
            { frequency: 400, duration: 0.08, volume: 0.3 },
            { frequency: 200, duration: 0.12, volume: 0.22 }
        ]);

        // Power well active - energy gathering
        this.createToneSequence('power_well', [
            { frequency: 300, duration: 0.15, volume: 0.1 },
            { frequency: 400, duration: 0.15, volume: 0.12 },
            { frequency: 500, duration: 0.2, volume: 0.1 }
        ]);

        // Ship part acquired - triumphant discovery
        this.createToneSequence('ship_part', [
            { frequency: 392.00, duration: 0.12, volume: 0.25 },   // G4
            { frequency: 523.25, duration: 0.12, volume: 0.28 },   // C5
            { frequency: 659.25, duration: 0.12, volume: 0.3 },    // E5
            { frequency: 783.99, duration: 0.15, volume: 0.32 },   // G5
            { frequency: 1046.50, duration: 0.15, volume: 0.35 },  // C6
            { frequency: 1318.51, duration: 0.2, volume: 0.32 },   // E6
            { frequency: 1567.98, duration: 0.25, volume: 0.28 }   // G6
        ]);

        console.log('[AudioManager] Registered', this.generatedSounds.size, 'sound definitions');
    }

    /**
     * Create a sequence of tones (immediate generation - backward compatible)
     * @param {string} name - Sound effect name
     * @param {Array} tones - Array of {frequency, duration, volume} objects
     */
    createToneSequence(name, tones) {
        if (!this.audioContext) return;

        this.generatedSounds.set(name, tones);
    }

    /**
     * Register a sound for lazy generation (generated on first play)
     * @param {string} name - Sound effect name
     * @param {Array} tones - Array of {frequency, duration, volume} objects
     */
    registerSound(name, tones) {
        this.soundRegistry.set(name, tones);
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

        // Lazy generation: if sound not in cache, check registry and generate
        let tones = this.generatedSounds.get(name);
        if (!tones) {
            const definition = this.soundRegistry.get(name);
            if (definition) {
                // Generate on first use
                this.generatedSounds.set(name, definition);
                tones = definition;
                this.soundsGenerated++;
            } else {
                console.warn(`[AudioManager] Sound "${name}" not found`);
                return;
            }
        }

        try {
            let currentTime = this.audioContext.currentTime;

            tones.forEach((tone) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                // Use safe connect to prevent errors
                if (!this.safeConnect(oscillator, gainNode) ||
                    !this.safeConnect(gainNode, this.audioContext?.destination)) {
                    return; // Skip this tone if connection failed
                }

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
    // BOSS FIGHT SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play boss roar - deep, menacing sound for boss spawn
     */
    playBossRoar() {
        this.playSound('boss_roar');
    }

    /**
     * Play boss warning - ominous alert before attack
     */
    playBossWarning() {
        this.playSound('boss_warning');
    }

    /**
     * Play boss ground slam - heavy impact with rumble
     */
    playBossSlam() {
        this.playSound('boss_slam');
    }

    /**
     * Play boss projectile fire - sharp crystal sound
     */
    playBossProjectile() {
        this.playSound('boss_projectile');
    }

    /**
     * Play boss charge attack - whoosh with power
     */
    playBossCharge() {
        this.playSound('boss_charge');
    }

    /**
     * Play boss phase transition - dramatic power surge
     */
    playBossPhase() {
        this.playSound('boss_phase');
    }

    /**
     * Play boss hit - solid impact when boss takes damage
     */
    playBossHit() {
        this.playSound('boss_hit');
    }

    /**
     * Play boss defeated - triumphant explosion
     */
    playBossDefeated() {
        this.playSound('boss_defeated');
    }

    /**
     * Play boss intro - dramatic awakening
     */
    playBossIntro() {
        this.playSound('boss_intro');
    }

    // ==========================================
    // COMBAT JUICE SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play combo hit - satisfying feedback for building combos
     */
    playComboHit() {
        this.playSound('combo_hit');
    }

    /**
     * Play combo milestone - reward for hitting 5x, 10x, etc
     */
    playComboMilestone() {
        this.playSound('combo_milestone');
    }

    /**
     * Play combo break - when combo ends
     */
    playComboBreak() {
        this.playSound('combo_break');
    }

    /**
     * Play critical hit - powerful impact for big damage
     */
    playCriticalHit() {
        this.playSound('critical_hit');
    }

    /**
     * Play victory fanfare - epic boss defeat celebration
     */
    playVictoryFanfare() {
        this.playSound('victory_fanfare');
    }

    /**
     * Play slow-mo enter - time slowing down effect
     */
    playSlowmoEnter() {
        this.playSound('slowmo_enter');
    }

    /**
     * Play slow-mo exit - time resuming effect
     */
    playSlowmoExit() {
        this.playSound('slowmo_exit');
    }

    // ==========================================
    // CRYSTAL CAVES SOUNDS
    // ==========================================

    /**
     * Play shield activation sound
     */
    playShieldActivate() {
        this.playSound('shield_activate');
    }

    /**
     * Play shield expire sound
     */
    playShieldExpire() {
        this.playSound('shield_expire');
    }

    /**
     * Play crystal slide sound
     */
    playCrystalSlide() {
        this.playSound('crystal_slide');
    }

    /**
     * Play spider hiss sound
     */
    playSpiderHiss() {
        this.playSound('spider_hiss');
    }

    /**
     * Play spider pounce sound
     */
    playSpiderPounce() {
        this.playSound('spider_pounce');
    }

    /**
     * Play web shoot sound
     */
    playWebShoot() {
        this.playSound('web_shoot');
    }

    /**
     * Play stalactite fall sound
     */
    playStalactiteFall() {
        this.playSound('stalactite_fall');
    }

    /**
     * Play pillar break sound
     */
    playPillarBreak() {
        this.playSound('pillar_break');
    }

    /**
     * Play power well sound
     */
    playPowerWell() {
        this.playSound('power_well');
    }

    /**
     * Play ship part acquired sound
     */
    playShipPart() {
        this.playSound('ship_part');
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

    // ==========================================
    // CREATURE IDLE SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play creature idle sound based on stage and personality
     * @param {string} stage - 'baby', 'juvenile', 'adult', 'elder'
     * @param {string} personality - 'curious', 'playful', 'gentle', 'wise', 'energetic'
     */
    playCreatureIdleSound(stage = 'adult', personality = 'playful') {
        const sounds = this.getIdleSoundsForStage(stage, personality);
        if (sounds.length > 0) {
            const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
            this.playSound(randomSound);
        }
    }

    /**
     * Get appropriate idle sounds for creature stage and personality
     */
    getIdleSoundsForStage(stage, personality) {
        switch (stage) {
            case 'baby':
                return ['baby_coo', 'baby_chirp', 'baby_giggle', 'baby_happy'];
            case 'juvenile':
                return ['juvenile_squeak', 'juvenile_bounce', 'baby_chirp'];
            case 'elder':
                return ['elder_sigh', 'elder_wisdom', 'creature_hum'];
            case 'adult':
            default:
                // Vary by personality
                switch (personality) {
                    case 'curious':
                        return ['creature_curious', 'creature_trill'];
                    case 'playful':
                        return ['creature_trill', 'juvenile_bounce'];
                    case 'gentle':
                        return ['creature_purr', 'creature_hum'];
                    case 'wise':
                        return ['creature_hum', 'elder_wisdom'];
                    case 'energetic':
                        return ['creature_trill', 'juvenile_squeak'];
                    default:
                        return ['creature_hum', 'creature_purr', 'creature_trill'];
                }
        }
    }

    /**
     * Play creature hum
     */
    playCreatureHum() {
        this.playSound('creature_hum');
    }

    /**
     * Play creature purr
     */
    playCreaturePurr() {
        this.playSound('creature_purr');
    }

    /**
     * Play creature trill
     */
    playCreatureTrill() {
        this.playSound('creature_trill');
    }

    /**
     * Play curious creature sound
     */
    playCreatureCurious() {
        this.playSound('creature_curious');
    }

    /**
     * Play juvenile squeak
     */
    playJuvenileSqueak() {
        this.playSound('juvenile_squeak');
    }

    /**
     * Play juvenile bounce sound
     */
    playJuvenileBounce() {
        this.playSound('juvenile_bounce');
    }

    /**
     * Play elder sigh
     */
    playElderSigh() {
        this.playSound('elder_sigh');
    }

    /**
     * Play elder wisdom sound
     */
    playElderWisdom() {
        this.playSound('elder_wisdom');
    }

    // ==========================================
    // MOOD-BASED SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play mood sound based on happiness percentage
     * @param {number} happinessPercent - 0-100
     */
    playMoodSound(happinessPercent) {
        if (happinessPercent >= 80) {
            this.playSound('mood_happy');
        } else if (happinessPercent >= 50) {
            this.playSound('mood_content');
        } else if (happinessPercent >= 20) {
            this.playSound('mood_sad');
        } else {
            this.playSound('mood_critical');
        }
    }

    /**
     * Play happy mood sound
     */
    playMoodHappy() {
        this.playSound('mood_happy');
    }

    /**
     * Play content mood sound
     */
    playMoodContent() {
        this.playSound('mood_content');
    }

    /**
     * Play sad mood sound
     */
    playMoodSad() {
        this.playSound('mood_sad');
    }

    /**
     * Play critical mood sound
     */
    playMoodCritical() {
        this.playSound('mood_critical');
    }

    // ==========================================
    // BREEDING SHRINE SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play shrine ambient sound
     */
    playShrineAmbient() {
        this.playSound('shrine_ambient');
    }

    /**
     * Play parent selection sound
     */
    playShrineSelect() {
        this.playSound('shrine_select');
    }

    /**
     * Play compatibility check result
     * @param {boolean} compatible - Whether parents are compatible
     */
    playShrineCompatibility(compatible) {
        if (compatible) {
            this.playSound('shrine_compatible');
        } else {
            this.playSound('shrine_incompatible');
        }
    }

    /**
     * Play egg creation sound
     */
    playShrineCreateEgg() {
        this.playSound('shrine_create_egg');
    }

    /**
     * Play offspring reveal sound based on rarity
     * @param {string} rarity - 'common', 'uncommon', 'rare', 'epic', 'legendary'
     */
    playShrineReveal(rarity = 'common') {
        switch (rarity) {
            case 'legendary':
                this.playSound('shrine_reveal_legendary');
                break;
            case 'epic':
                this.playSound('shrine_reveal_epic');
                break;
            case 'rare':
            case 'uncommon':
                this.playSound('shrine_reveal_rare');
                break;
            default:
                this.playSound('shrine_reveal_common');
        }
    }

    // ==========================================
    // PORTAL SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play portal approach sound
     */
    playPortalApproach() {
        this.playSound('portal_approach');
    }

    /**
     * Play portal enter sound
     */
    playPortalEnter() {
        this.playSound('portal_enter');
    }

    /**
     * Play portal travel sound
     */
    playPortalTravel() {
        this.playSound('portal_travel');
    }

    /**
     * Play portal arrive sound
     */
    playPortalArrive() {
        this.playSound('portal_arrive');
    }

    // ==========================================
    // SHOP SOUND PLAYBACK METHODS
    // ==========================================

    /**
     * Play shop item hover sound
     */
    playShopHover() {
        this.playSound('shop_hover');
    }

    /**
     * Play insufficient funds sound
     */
    playShopInsufficient() {
        this.playSound('shop_insufficient');
    }

    /**
     * Play purchase sound based on price tier
     * @param {number} price - Item price in coins
     */
    playShopPurchase(price = 0) {
        if (price > 200) {
            this.playSound('shop_purchase_large');
        } else if (price > 50) {
            this.playSound('shop_purchase_medium');
        } else {
            this.playSound('shop_purchase_small');
        }
    }

    /**
     * Play rare item reveal sound
     */
    playShopRareReveal() {
        this.playSound('shop_rare_reveal');
    }

    // ==========================================
    // ENHANCED CARE ACTION PLAYBACK METHODS
    // ==========================================

    /**
     * Play feed action with creature response
     */
    playFeedWithResponse() {
        this.playSound('feed');
        // Play creature response after brief delay
        setTimeout(() => this.playSound('feed_response'), 300);
    }

    /**
     * Play pet action with creature purr response
     */
    playPetWithResponse() {
        this.playSound('pet');
        setTimeout(() => this.playSound('pet_response'), 250);
    }

    /**
     * Play play action with excited response
     */
    playPlayWithResponse() {
        this.playSound('play');
        setTimeout(() => this.playSound('play_response'), 350);
    }

    /**
     * Play rest start sound
     */
    playRestStart() {
        this.playSound('rest_start');
    }

    /**
     * Play rest breathing sound
     */
    playRestBreathing() {
        this.playSound('rest_breathing');
    }

    // ==========================================
    // TIERED ACHIEVEMENT PLAYBACK METHODS
    // ==========================================

    /**
     * Play achievement sound based on tier
     * @param {string} tier - 'minor', 'major', 'epic', 'secret'
     */
    playAchievementTiered(tier = 'minor') {
        switch (tier) {
            case 'epic':
                this.playSound('achievement_epic');
                break;
            case 'secret':
                this.playSound('achievement_secret');
                break;
            case 'major':
                this.playSound('achievement_major');
                break;
            case 'minor':
            default:
                this.playSound('achievement_minor');
        }
    }

    /**
     * Play minor achievement sound
     */
    playAchievementMinor() {
        this.playSound('achievement_minor');
    }

    /**
     * Play major achievement sound
     */
    playAchievementMajor() {
        this.playSound('achievement_major');
    }

    /**
     * Play epic achievement sound
     */
    playAchievementEpic() {
        this.playSound('achievement_epic');
    }

    /**
     * Play secret discovery sound
     */
    playAchievementSecret() {
        this.playSound('achievement_secret');
    }

    // ==========================================
    // CAMPFIRE / REST AREA PLAYBACK METHODS
    // ==========================================

    /**
     * Play random fire crackle sound
     */
    playFireCrackle() {
        const variants = ['fire_crackle_1', 'fire_crackle_2', 'fire_crackle_3'];
        const variant = variants[Math.floor(Math.random() * variants.length)];
        this.playSound(variant);
    }

    /**
     * Play creature settling sound
     */
    playCreatureSettle() {
        this.playSound('creature_settle');
    }

    /**
     * Play nature wind sound
     */
    playNatureWind() {
        this.playSound('nature_wind');
    }

    /**
     * Play cricket sound
     */
    playNatureCricket() {
        this.playSound('nature_cricket');
    }

    /**
     * Start campfire ambient atmosphere
     * @param {Phaser.Scene} scene - The scene to bind timers to
     * @returns {object} Controller with stop() method
     */
    startCampfireAmbient(scene) {
        if (!this.audioContext || this.muted) return { stop: () => {} };

        console.log('[AudioManager] 🔥 Starting campfire ambient');

        const ambientState = {
            active: true,
            timers: []
        };

        // Start meditation music
        this.playMeditationMusic();

        // Fire crackles - every 0.5-2 seconds
        const scheduleCrackle = () => {
            if (!ambientState.active) return;
            const delay = 500 + Math.random() * 1500;
            const timer = scene.time.delayedCall(delay, () => {
                if (ambientState.active) {
                    this.playFireCrackle();
                    scheduleCrackle();
                }
            });
            ambientState.timers.push(timer);
        };

        // Nature sounds - every 8-15 seconds
        const scheduleNature = () => {
            if (!ambientState.active) return;
            const delay = 8000 + Math.random() * 7000;
            const timer = scene.time.delayedCall(delay, () => {
                if (ambientState.active) {
                    if (Math.random() > 0.5) {
                        this.playNatureWind();
                    } else {
                        this.playNatureCricket();
                    }
                    scheduleNature();
                }
            });
            ambientState.timers.push(timer);
        };

        // Start schedulers
        scene.time.delayedCall(500, scheduleCrackle);
        scene.time.delayedCall(2000, scheduleNature);

        // Initial creature settle sound
        scene.time.delayedCall(1000, () => {
            if (ambientState.active) {
                this.playCreatureSettle();
            }
        });

        return {
            stop: () => {
                console.log('[AudioManager] 🔇 Stopping campfire ambient');
                ambientState.active = false;
                ambientState.timers.forEach(timer => {
                    if (timer && timer.remove) {
                        timer.remove();
                    }
                });
                ambientState.timers = [];
                this.stopMeditationMusic();
            }
        };
    }

    // ==========================================
    // UI MICROINTERACTION PLAYBACK METHODS
    // ==========================================

    /**
     * Play UI hover sound
     */
    playUIHover() {
        this.playSound('ui_hover');
    }

    /**
     * Play tab switch sound
     */
    playUITab() {
        this.playSound('ui_tab');
    }

    /**
     * Play sort/filter sound
     */
    playUISort() {
        this.playSound('ui_sort');
    }

    /**
     * Play tooltip appear sound
     */
    playUITooltip() {
        this.playSound('ui_tooltip');
    }

    /**
     * Play modal open sound
     */
    playUIModalOpen() {
        this.playSound('ui_modal_open');
    }

    /**
     * Play modal close sound
     */
    playUIModalClose() {
        this.playSound('ui_modal_close');
    }

    /**
     * Play UI success sound
     */
    playUISuccess() {
        this.playSound('ui_success');
    }

    /**
     * Play UI denial sound
     */
    playUIDeny() {
        this.playSound('ui_deny');
    }

    /**
     * Play notification sound
     */
    playUINotification() {
        this.playSound('ui_notification');
    }

    // ==========================================
    // CREATURE IDLE SOUND SYSTEM
    // ==========================================

    /**
     * Start periodic creature idle sounds
     * @param {Phaser.Scene} scene - The scene to bind timers to
     * @param {string} stage - Creature stage
     * @param {string} personality - Creature personality
     * @returns {object} Controller with stop() method
     */
    startCreatureIdleSounds(scene, stage = 'adult', personality = 'playful') {
        if (!this.audioContext || this.muted) return { stop: () => {} };

        console.log(`[AudioManager] 🐾 Starting idle sounds for ${stage} ${personality} creature`);

        const idleState = {
            active: true,
            timer: null
        };

        const scheduleNextSound = () => {
            if (!idleState.active) return;

            // Random interval between 8-20 seconds
            const delay = 8000 + Math.random() * 12000;

            idleState.timer = scene.time.delayedCall(delay, () => {
                if (idleState.active) {
                    this.playCreatureIdleSound(stage, personality);
                    scheduleNextSound();
                }
            });
        };

        // Start after initial delay
        scene.time.delayedCall(5000, scheduleNextSound);

        return {
            stop: () => {
                console.log('[AudioManager] 🔇 Stopping creature idle sounds');
                idleState.active = false;
                if (idleState.timer && idleState.timer.remove) {
                    idleState.timer.remove();
                }
            },
            updateStage: (newStage) => {
                stage = newStage;
            },
            updatePersonality: (newPersonality) => {
                personality = newPersonality;
            }
        };
    }

    /**
     * Toggle mute on/off
     */
    toggleMute() {
        this.muted = !this.muted;

        // Save to GameState if available
        if (typeof window !== 'undefined' && window.GameState) {
            window.GameState.set('settings.audioMuted', this.muted);
            window.GameState.save?.();
        }

        // Also save to localStorage as backup
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('audioMuted', this.muted.toString());
            } catch (error) {
                console.warn('[AudioManager] Could not persist mute preference:', error);
            }
        }

        this.applyMusicGain();
        console.log(`[AudioManager] Audio ${this.muted ? 'muted' : 'unmuted'}`);
        return this.muted;
    }

    persistVolumePreference(path, storageKey, value) {
        if (typeof window !== 'undefined' && window.GameState) {
            window.GameState.set(path, value);
            window.GameState.save?.();
        }
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(storageKey, value.toString());
            } catch (error) {
                console.warn(`[AudioManager] Could not persist ${storageKey}:`, error);
            }
        }
    }

    applyMusicGain(duration = 0.1) {
        if (!this.musicNodes?.gainNode || !this.audioContext) return;

        const target = this.muted
            ? 0
            : this.musicVolume * this.masterVolume * 0.3;
        this.musicNodes.gainNode.gain.linearRampToValueAtTime(
            target,
            this.audioContext.currentTime + duration
        );
    }

    /**
     * Set master volume
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.persistVolumePreference(
            'settings.volume.master',
            'audioMasterVolume',
            this.masterVolume
        );
        this.applyMusicGain();
        console.log(`[AudioManager] Master volume set to ${this.masterVolume}`);
    }

    /**
     * Set SFX volume
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        this.persistVolumePreference(
            'settings.volume.sfx',
            'audioSFXVolume',
            this.sfxVolume
        );
        console.log(`[AudioManager] SFX volume set to ${this.sfxVolume}`);
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
            // Sanctuary - tranquil, meditative space for creature care
            sanctuary: {
                baseFreq: 196,      // G3 - warm, peaceful, not too low
                scale: 'pentatonic',
                tempo: 40,          // Very slow, peaceful breathing pace
                layers: ['breathPad', 'windChimes', 'gentleBells'],
                colors: {
                    breathPad: [1, 1.25, 1.5],        // Soft major chord
                    windChimes: [3, 4, 5],            // High, delicate overtones
                    gentleBells: [2, 2.5]             // Occasional soft bells
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

        // Safe connect to destination
        if (!this.safeConnect(this.musicNodes.gainNode, this.audioContext?.destination)) {
            console.warn('[AudioManager] Failed to connect music gain node');
            return;
        }

        // Create layers based on configuration
        config.layers.forEach(layerType => {
            this.createMusicLayer(layerType, config);
        });

        // Fade in
        this.musicNodes.gainNode.gain.linearRampToValueAtTime(
            this.muted ? 0 : this.musicVolume * this.masterVolume * 0.3,
            this.audioContext.currentTime + 1
        );
    }

    /**
     * Safely connect an audio node to a destination
     * Prevents errors when destination is null or invalid
     * @param {AudioNode} source - Source audio node
     * @param {AudioNode|AudioParam} destination - Destination node or param
     * @returns {boolean} True if connection successful
     */
    safeConnect(source, destination) {
        try {
            if (!source || !destination) {
                return false;
            }
            source.connect(destination);
            return true;
        } catch (error) {
            console.warn('[AudioManager] Safe connect failed:', error.message);
            return false;
        }
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
            case 'gentleBells':
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

            this.safeConnect(lfo, lfoGain);
            this.safeConnect(lfoGain, osc.frequency);

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

                this.safeConnect(osc, filter);
                this.safeConnect(filter, oscGain);
            } else {
                this.safeConnect(osc, oscGain);
            }

            this.safeConnect(oscGain, this.musicNodes?.gainNode);

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

            this.safeConnect(osc, gain);
            this.safeConnect(gain, this.musicNodes?.gainNode);

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

            this.safeConnect(osc, gain);
            this.safeConnect(gain, this.musicNodes?.gainNode);

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

            this.safeConnect(osc, filter);
            this.safeConnect(filter, gain);
            this.safeConnect(gain, this.musicNodes?.gainNode);

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

        this.safeConnect(lfo, lfoGain);
        this.safeConnect(lfoGain, filter.frequency);

        this.safeConnect(noise, filter);
        this.safeConnect(filter, gain);
        this.safeConnect(gain, this.musicNodes?.gainNode);

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

            this.safeConnect(osc, gain);
            this.safeConnect(gain, this.musicNodes?.gainNode);

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

            this.safeConnect(lfo, lfoGain);
            this.safeConnect(lfoGain, mainGain.gain);

            this.safeConnect(osc, mainGain);
            this.safeConnect(mainGain, this.musicNodes?.gainNode);

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

            this.safeConnect(osc, mainGain);
            this.safeConnect(osc2, harm2Gain);
            this.safeConnect(osc3, harm3Gain);

            this.safeConnect(mainGain, this.musicNodes?.gainNode);
            this.safeConnect(harm2Gain, this.musicNodes?.gainNode);
            this.safeConnect(harm3Gain, this.musicNodes?.gainNode);

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

            this.safeConnect(lfo, lfoGain);
            this.safeConnect(lfoGain, gainNode.gain);

            this.safeConnect(osc, gainNode);
            this.safeConnect(gainNode, this.musicNodes?.gainNode);

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

            this.safeConnect(osc, gainNode);
            this.safeConnect(gainNode, this.musicNodes?.gainNode);

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

            this.safeConnect(lfo, lfoGain);
            this.safeConnect(lfoGain, osc.frequency);

            // Low-pass filter to smooth the drone
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 200;
            filter.Q.value = 0.5;

            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.1;

            this.safeConnect(osc, filter);
            this.safeConnect(filter, gainNode);
            this.safeConnect(gainNode, this.musicNodes?.gainNode);

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

    // ==========================================
    // CRYSTAL CAVE AMBIENT SYSTEM
    // ==========================================

    /**
     * Play crystal chime sound - random variant
     */
    playCrystalChime() {
        const variants = ['crystal_chime', 'crystal_chime_2', 'crystal_chime_3'];
        const variant = variants[Math.floor(Math.random() * variants.length)];
        this.playSound(variant);
    }

    /**
     * Play cave gong sound - random depth
     */
    playCaveGong() {
        const variants = ['cave_gong', 'cave_gong_medium'];
        const variant = variants[Math.floor(Math.random() * variants.length)];
        this.playSound(variant);
    }

    /**
     * Play cave whistle - eerie high tone
     */
    playCaveWhistle() {
        this.playSound('cave_whistle');
    }

    /**
     * Play crystal resonance - shimmer effect
     */
    playCrystalResonance() {
        this.playSound('crystal_resonance');
    }

    /**
     * Play cave drip - water drop
     */
    playCaveDrip() {
        this.playSound('cave_drip');
    }

    /**
     * Play cave drone - eerie atmospheric
     */
    playCaveDrone() {
        this.playSound('cave_drone');
    }

    /**
     * Start crystal cave ambient atmosphere
     * Plays random ambient sounds at intervals for eerie atmosphere
     * @param {Phaser.Scene} scene - The scene to bind timers to
     * @returns {object} Controller with stop() method
     */
    startCrystalCaveAmbient(scene) {
        if (!this.audioContext || this.muted) return { stop: () => {} };

        console.log('[AudioManager] 🔮 Starting crystal cave ambient');

        const ambientState = {
            active: true,
            timers: []
        };

        // Play initial drone for atmosphere
        this.playCaveDrone();

        // Crystal chimes - every 4-8 seconds
        const scheduleChime = () => {
            if (!ambientState.active) return;
            const delay = 4000 + Math.random() * 4000;
            const timer = scene.time.delayedCall(delay, () => {
                if (ambientState.active) {
                    this.playCrystalChime();
                    scheduleChime();
                }
            });
            ambientState.timers.push(timer);
        };

        // Gongs - every 15-25 seconds
        const scheduleGong = () => {
            if (!ambientState.active) return;
            const delay = 15000 + Math.random() * 10000;
            const timer = scene.time.delayedCall(delay, () => {
                if (ambientState.active) {
                    this.playCaveGong();
                    scheduleGong();
                }
            });
            ambientState.timers.push(timer);
        };

        // Eerie whistle - every 20-40 seconds
        const scheduleWhistle = () => {
            if (!ambientState.active) return;
            const delay = 20000 + Math.random() * 20000;
            const timer = scene.time.delayedCall(delay, () => {
                if (ambientState.active) {
                    this.playCaveWhistle();
                    scheduleWhistle();
                }
            });
            ambientState.timers.push(timer);
        };

        // Cave drips - every 3-7 seconds
        const scheduleDrip = () => {
            if (!ambientState.active) return;
            const delay = 3000 + Math.random() * 4000;
            const timer = scene.time.delayedCall(delay, () => {
                if (ambientState.active) {
                    this.playCaveDrip();
                    scheduleDrip();
                }
            });
            ambientState.timers.push(timer);
        };

        // Crystal resonance - every 12-20 seconds
        const scheduleResonance = () => {
            if (!ambientState.active) return;
            const delay = 12000 + Math.random() * 8000;
            const timer = scene.time.delayedCall(delay, () => {
                if (ambientState.active) {
                    this.playCrystalResonance();
                    scheduleResonance();
                }
            });
            ambientState.timers.push(timer);
        };

        // Drone loop - every 8-12 seconds
        const scheduleDrone = () => {
            if (!ambientState.active) return;
            const delay = 8000 + Math.random() * 4000;
            const timer = scene.time.delayedCall(delay, () => {
                if (ambientState.active) {
                    this.playCaveDrone();
                    scheduleDrone();
                }
            });
            ambientState.timers.push(timer);
        };

        // Start all schedulers with slight offsets
        scene.time.delayedCall(500, scheduleChime);
        scene.time.delayedCall(1000, scheduleDrip);
        scene.time.delayedCall(2000, scheduleGong);
        scene.time.delayedCall(3000, scheduleWhistle);
        scene.time.delayedCall(4000, scheduleResonance);
        scene.time.delayedCall(5000, scheduleDrone);

        // Return controller
        return {
            stop: () => {
                console.log('[AudioManager] 🔇 Stopping crystal cave ambient');
                ambientState.active = false;
                ambientState.timers.forEach(timer => {
                    if (timer && timer.remove) {
                        timer.remove();
                    }
                });
                ambientState.timers = [];
            }
        };
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
                } catch (e) {
                    // Node already disconnected - safe to ignore during cleanup
                }
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
        this.persistVolumePreference(
            'settings.volume.music',
            'audioMusicVolume',
            this.musicVolume
        );
        this.applyMusicGain();

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
