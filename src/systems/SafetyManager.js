/**
 * SafetyManager - Centralizes kid profile + parental control toggles.
 * Aligns with CreatureMemory opt-in to keep privacy controls consistent.
 */

class SafetyManager {
    constructor() {
        this.initialized = false;
        this.gameState = null;
        this.memoryService = null;
        this.maxAuditEntries = 40;
    }

    initialize(gameState = null, memoryService = null) {
        if (this.initialized && gameState === this.gameState) {
            return this;
        }

        const resolvedState = gameState || (typeof window !== 'undefined' ? window.GameState : null);
        const resolvedMemory = memoryService || (typeof window !== 'undefined' ? window.CreatureMemory : null);

        if (!resolvedState || typeof resolvedState.get !== 'function') {
            console.warn('safety:warn [SafetyManager] GameState not ready, deferring initialization');
            return this;
        }

        this.gameState = resolvedState;
        this.memoryService = resolvedMemory || null;
        this.ensureStateShape();

        this.initialized = true;
        console.log('safety:info [SafetyManager] Safety manager initialized', {
            kidProfileEnabled: this.getKidProfile().enabled,
            parentalEnabled: this.getParentalControls().enabled
        });

        return this;
    }

    ensureStateShape() {
        if (!this.gameState.get('safety')) {
            this.gameState.set('safety', {
                kidProfile: {
                    enabled: false,
                    nickname: '',
                    emojiAvatar: '🛸',
                    ageBracket: '7-9',
                    createdAt: null,
                    updatedAt: null
                },
                parentalControls: {
                    enabled: false,
                    requireChatApproval: true,
                    allowMemoryTracking: false,
                    allowExplorationWithoutGuardian: true,
                    screenTimeLimitMinutes: 0,
                    lastUpdated: null
                },
                guardian: {
                    pinHash: null,
                    lastVerified: null
                },
                auditLog: []
            });
        } else {
            // Ensure nested defaults exist
            const kidProfile = this.gameState.get('safety.kidProfile') || {};
            const defaults = {
                enabled: false,
                nickname: '',
                emojiAvatar: '🛸',
                ageBracket: '7-9',
                createdAt: null,
                updatedAt: null
            };
            this.gameState.set('safety.kidProfile', { ...defaults, ...kidProfile });

            const parentalDefaults = {
                enabled: false,
                requireChatApproval: true,
                allowMemoryTracking: false,
                allowExplorationWithoutGuardian: true,
                screenTimeLimitMinutes: 0,
                lastUpdated: null
            };
            this.gameState.set(
                'safety.parentalControls',
                { ...parentalDefaults, ...(this.gameState.get('safety.parentalControls') || {}) }
            );

            const guardianDefaults = {
                pinHash: null,
                lastVerified: null
            };
            this.gameState.set(
                'safety.guardian',
                { ...guardianDefaults, ...(this.gameState.get('safety.guardian') || {}) }
            );
        }
    }

    getKidProfile() {
        if (!this.initialized) this.initialize();
        const profile = this.gameState?.get('safety.kidProfile') || {};
        return { ...profile };
    }

    enableKidProfile(profile = {}) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return null;

        const now = Date.now();
        const current = this.getKidProfile();
        const updatedProfile = {
            ...current,
            ...profile,
            nickname: (profile.nickname ?? current.nickname ?? '').toString().trim().slice(0, 24),
            emojiAvatar: profile.emojiAvatar || current.emojiAvatar || '🛸',
            ageBracket: profile.ageBracket || current.ageBracket || '7-9',
            enabled: true,
            createdAt: current.createdAt || now,
            updatedAt: now
        };

        this.gameState.set('safety.kidProfile', updatedProfile);
        this.recordAudit('kid_profile_enabled', {
            nickname: updatedProfile.nickname,
            ageBracket: updatedProfile.ageBracket
        });
        this.gameState.emit('safety/kid_profile_toggled', { enabled: true, profile: updatedProfile });

        // Ensure kid-friendly UI is active
        if (typeof window !== 'undefined' && window.KidMode && typeof window.KidMode.enableKidMode === 'function') {
            window.KidMode.enableKidMode();
        }

        // Auto-enable parental controls if not already active
        if (!this.getParentalControls().enabled) {
            this.updateParentalControls({ enabled: true }, { source: 'KidProfile' });
        }

        return updatedProfile;
    }

    disableKidProfile(metadata = {}) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return null;

        const now = Date.now();
        const current = this.getKidProfile();
        const updatedProfile = {
            ...current,
            enabled: false,
            updatedAt: now
        };

        this.gameState.set('safety.kidProfile', updatedProfile);
        this.recordAudit('kid_profile_disabled', metadata);
        this.gameState.emit('safety/kid_profile_toggled', { enabled: false, profile: updatedProfile });

        if (typeof window !== 'undefined' && window.KidMode && typeof window.KidMode.disableKidMode === 'function') {
            window.KidMode.disableKidMode();
        }

        return updatedProfile;
    }

    getParentalControls() {
        if (!this.initialized) this.initialize();
        const controls = this.gameState?.get('safety.parentalControls') || {};
        return { ...controls };
    }

    updateParentalControls(patch = {}, metadata = {}) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return null;

        const current = this.getParentalControls();
        const updated = {
            ...current,
            ...patch,
            lastUpdated: Date.now()
        };

        this.gameState.set('safety.parentalControls', updated);
        this.recordAudit('parental_controls_updated', { patch, metadata });
        this.gameState.emit('safety/parental_controls_updated', { controls: updated, metadata });

        if (Object.prototype.hasOwnProperty.call(patch, 'allowMemoryTracking') && this.memoryService) {
            this.memoryService.setOptIn(!!patch.allowMemoryTracking, {
                source: 'SafetyManager',
                reason: patch.allowMemoryTracking ? 'parental_opt_in' : 'parental_opt_out'
            });
        }

        return updated;
    }

    toggleParentalControl(key, value, metadata = {}) {
        if (!key) return this.getParentalControls();
        return this.updateParentalControls({ [key]: value }, metadata);
    }

    setGuardianPin(pin) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return false;

        if (!pin || pin.length < 4) {
            console.warn('safety:warn [SafetyManager] PIN must be at least 4 digits');
            return false;
        }

        const hash = this.hashPin(pin);
        this.gameState.set('safety.guardian.pinHash', hash);
        this.gameState.set('safety.guardian.lastVerified', Date.now());

        this.recordAudit('guardian_pin_set', { length: pin.length });
        this.gameState.emit('safety/guardian_pin_updated', { isSet: true });

        return true;
    }

    verifyGuardianPin(pin) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return false;

        const storedHash = this.gameState.get('safety.guardian.pinHash');
        if (!storedHash) return false;

        const matches = storedHash === this.hashPin(pin);
        if (matches) {
            const now = Date.now();
            this.gameState.set('safety.guardian.lastVerified', now);
            this.recordAudit('guardian_pin_verified', { timestamp: now });
        }

        return matches;
    }

    getGuardianStatus() {
        if (!this.initialized) this.initialize();
        const guardian = this.gameState?.get('safety.guardian') || {};
        return { ...guardian };
    }

    getSafetySummary() {
        if (!this.initialized) this.initialize();

        return {
            kidProfile: this.getKidProfile(),
            parentalControls: this.getParentalControls(),
            guardian: this.getGuardianStatus(),
            auditLog: [...(this.gameState?.get('safety.auditLog') || [])]
        };
    }

    recordAudit(action, details = {}) {
        if (!this.gameState) return;

        const logPath = 'safety.auditLog';
        const log = [...(this.gameState.get(logPath) || [])];
        log.push({
            action,
            details,
            timestamp: Date.now()
        });

        if (log.length > this.maxAuditEntries) {
            log.splice(0, log.length - this.maxAuditEntries);
        }

        this.gameState.set(logPath, log);
    }

    hashPin(pin) {
        try {
            // Simple reversible obfuscation (placeholder until stronger hashing is wired)
            const reversed = pin.toString().split('').reverse().join('');
            return typeof btoa === 'function' ? btoa(reversed) : reversed;
        } catch (error) {
            console.warn('safety:warn [SafetyManager] Failed to hash PIN, storing obfuscated fallback');
            return pin.toString().split('').reverse().join('');
        }
    }
}

// Singleton wiring
window.SafetyManager = window.SafetyManager || new SafetyManager();
window.SafetyManager.initialize();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SafetyManager;
}
