const ORIGINAL_KEY = 'mythical-creature-save';
const ACTIVE_KEY = 'mythical-void-active-adventure';
const PREFIX = 'mythical-creature-adventure-';
const isAdventureKey = key => key === ORIGINAL_KEY ||
    /^mythical-creature-adventure-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(key);

/** A new adventure has its own save, recovery journal and optional cloud identity. */
export default class LocalAdventureStore {
    constructor(options = {}) {
        try { this.storage = options.storage === undefined ? window.localStorage : options.storage; }
        catch { this.storage = null; }
        this.newId = options.newId || (() => crypto.randomUUID());
    }

    activeKey() {
        if (!this.storage) throw Error('Adventure storage is unavailable.');
        const key = this.storage.getItem(ACTIVE_KEY);
        if (key === null) return ORIGINAL_KEY;
        if (!isAdventureKey(key)) throw Error('The last adventure could not be found.');
        return key;
    }

    list() {
        if (!this.storage) return [];
        let active;
        try { active = this.activeKey(); } catch { /* Still offer the surviving adventures. */ }
        const keys = new Set([ORIGINAL_KEY]);
        for (let i = 0; i < this.storage.length; i++) {
            const key = this.storage.key(i);
            if (isAdventureKey(key)) keys.add(key);
        }
        const adventures = [];
        for (const key of keys) {
            const raw = this.storage.getItem(key);
            if (raw === null) continue;
            let state;
            try { state = JSON.parse(raw); } catch { /* The recovery screen owns validation. */ }
            const name = typeof state?.creature?.name === 'string' ? state.creature.name.trim() : '';
            adventures.push({
                key, name: name && name !== 'Your Creature' ? name.slice(0, 60) : 'Your adventure',
                started: !state || Boolean(state.session?.gameStarted || state.creature?.hatched),
                savedAt: Number.isFinite(state?.savedAt) ? state.savedAt : null,
                current: key === active
            });
        }
        return adventures.sort((a, b) => Number(b.current) - Number(a.current) || (b.savedAt || 0) - (a.savedAt || 0));
    }

    writeVerified(key, value) {
        if (!this.storage) throw Error('Adventure storage is unavailable.');
        try { this.storage.setItem(key, value); }
        catch (error) {
            // A write can land before the storage API throws. Only matching bytes acknowledge it.
            if (this.storage.getItem(key) !== value) throw error;
        }
        if (this.storage.getItem(key) !== value) throw Error('Adventure could not be saved.');
    }

    create(gameState) {
        const key = PREFIX + this.newId();
        if (!isAdventureKey(key) || !this.storage || this.storage.getItem(key) !== null) {
            throw Error('A separate adventure could not be created.');
        }
        const fresh = gameState.createInitialState();
        // A fresh story should not reset sound, accessibility or existing safety preferences.
        let preferences = gameState.state;
        if (!gameState.initialized) {
            try {
                const raw = this.storage.getItem(this.activeKey());
                if (raw) preferences = gameState.prepareSaveCandidate(raw).state;
            } catch { /* An unreadable adventure stays untouched; use the current defaults. */ }
        }
        fresh.settings = JSON.parse(JSON.stringify(preferences.settings || fresh.settings));
        fresh.safety = JSON.parse(JSON.stringify(preferences.safety || fresh.safety));
        fresh.creatureSkills = { skillLevels: {}, skillXP: {} };
        fresh.game = { cloudSavePausedForNewGame: true };
        const snapshot = gameState.createSaveSnapshot({ state: fresh });
        gameState.validateSaveDataStructure(snapshot, { requireCoreState: true });
        this.writeVerified(key, JSON.stringify(snapshot));
        // Never move the current selection until the new save has been read back.
        // A failed selection leaves an intact, discoverable adventure, not a deleted game.
        this.writeVerified(ACTIVE_KEY, key);
        return key;
    }

    select(key) {
        if (!isAdventureKey(key) || !this.storage || this.storage.getItem(key) === null) {
            throw Error('That adventure is no longer available in this browser.');
        }
        this.writeVerified(ACTIVE_KEY, key);
    }

    cloudOptions(key) {
        if (key === ORIGINAL_KEY) return {};
        if (!isAdventureKey(key)) throw Error('Unknown adventure.');
        const id = key.slice(PREFIX.length);
        return {
            authStorageKey: `mythical-adventure-auth-${id}`,
            enabledKey: `mythical-adventure-backup-${id}`,
            consentKey: `mythical-adventure-consent-${id}`
        };
    }
}
