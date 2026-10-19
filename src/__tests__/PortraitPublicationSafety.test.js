const GameStateManager = require('../systems/GameState.js');

describe('verified portrait publication', () => {
    const record = { identityKey: 'synthetic-portrait-owner:baby:unchanged', stage: 'baby',
        status: 'ready', assetRef: 'portrait-job-v1:00000000-0000-4000-8000-000000000077',
        imageUrl: 'https://example.test/synthetic-private-portrait.png', expiresAt: Date.now() + 60000 };
    let state;
    beforeEach(() => {
        localStorage.clear();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        state = new GameStateManager(); window.GameState = state;
        window.CloudSave = { gameState: state, currentUser: { id: 'synthetic-portrait-owner' }, campaignEpoch: 0 };
        state.set('creature.hatched', true);
        state.set('creature.genes', { id: 'synthetic-portrait-owner', species: 'stellarWyrm', rarity: 'common' });
        expect(state.addCreatureToCollection().success).toBe(true);
        expect(state.save()).toBe(true);
    });
    afterEach(() => { state.stopAutoSave(); jest.restoreAllMocks(); localStorage.clear(); delete window.GameState; delete window.CloudSave; });
    const bytes = () => localStorage.getItem(state.saveKey);
    const watch = () => ({ before: JSON.stringify(state.state), durable: bytes(), emit: jest.spyOn(state, 'emit') });
    const unchanged = proof => {
        expect(JSON.stringify(state.state)).toBe(proof.before);
        expect(bytes()).toBe(proof.durable);
        expect(proof.emit).not.toHaveBeenCalledWith('creaturePortraitReady', expect.anything());
        expect(proof.emit).not.toHaveBeenCalledWith('changed:creature.portraits', expect.anything(), expect.anything());
    };

    test('normal publication verifies the reference and roster before announcing ready', () => {
        const story = state.get('story'), original = state.state;
        const order = [];
        state.on('saved', () => { order.push('saved');
            expect(JSON.parse(bytes()).creature.portraits.byStage.baby.assetRef).toBe(record.assetRef); });
        state.on('creaturePortraitReady', value => { order.push('ready');
            expect(value.assetRef).toBe(record.assetRef);
            expect(state.get('creatures.0.portraits.byStage.baby').assetRef).toBe(record.assetRef); });
        expect(state.saveCreaturePortrait(record)).toBe(true);
        expect(order).toEqual(['saved', 'ready']);
        expect(state.getCreaturePortrait().imageUrl).toBe(record.imageUrl);
        expect(bytes()).not.toContain(record.imageUrl);
        expect(state.state).not.toBe(original);
        expect(state.get('story')).toBe(story);
    });

    test('held admission refuses before changing canonical portrait or roster state', () => {
        state.holdSaveAdmission({ code: 'synthetic_portrait_hold' });
        const proof = watch();
        expect(state.saveCreaturePortrait(record)).toBe(false);
        unchanged(proof);
    });

    test('memory-only storage never claims a durable portrait publication', () => {
        state.storageMode = 'memory'; const proof = watch();
        expect(state.saveCreaturePortrait(record)).toBe(false);
        unchanged(proof);
    });

    test('an owned cloud mutation keeps its source snapshot free of optional portrait changes', () => {
        const lease = state.beginCloudWrite('mutation', state.createSaveSnapshot());
        const proof = watch();
        expect(state.saveCreaturePortrait(record)).toBe(false);
        unchanged(proof); expect(state.cloudWriteLease).toBe(lease);
    });

    test.each(['throw', 'ignore'])('a storage %s cannot publish the staged portrait in memory', mode => {
        const proof = watch(), original = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === state.saveKey) {
                if (mode === 'throw') throw Error('synthetic refused storage');
                return;
            }
            return original.call(this, key, value);
        });
        expect(state.saveCreaturePortrait(record)).toBe(false);
        unchanged(proof);
    });

    test('an unavailable recovery copy leaves the original portrait state intact', () => {
        jest.spyOn(state, 'createLocalSaveBackup').mockReturnValue(false);
        const proof = watch();
        expect(state.saveCreaturePortrait(record)).toBe(false);
        unchanged(proof);
    });

    test('record access cannot publish into a re-entrant successor', () => {
        let successor, durable;
        const input = { ...record };
        Object.defineProperty(input, 'stage', { get: () => {
            if (!successor) {
                state.set('creature.genes', { id: 'synthetic-successor-creature', rarity: 'rare' });
                state.save(); successor = JSON.stringify(state.state); durable = bytes();
            }
            return 'baby';
        } });
        const emit = jest.spyOn(state, 'emit');
        expect(state.saveCreaturePortrait(input)).toBe(false);
        expect(JSON.stringify(state.state)).toBe(successor); expect(bytes()).toBe(durable);
        expect(emit).not.toHaveBeenCalledWith('creaturePortraitReady', expect.anything());
    });

    test.each(['progress', 'cloud_owner'])('a recovery-copy callback changing %s retires only the old write', mode => {
        const backup = state.createLocalSaveBackup.bind(state);
        let successor, durable;
        jest.spyOn(state, 'createLocalSaveBackup').mockImplementationOnce((...args) => {
            const made = backup(...args);
            if (mode === 'progress') state.set('creature.experience', 123);
            else window.CloudSave = { ...window.CloudSave, currentUser: { id: 'synthetic-successor-owner' } };
            successor = JSON.stringify(state.state); durable = bytes();
            return made;
        });
        const emit = jest.spyOn(state, 'emit');
        expect(state.saveCreaturePortrait(record)).toBe(false);
        expect(JSON.stringify(state.state)).toBe(successor); expect(bytes()).toBe(durable);
        expect(state.getSaveAdmission().status).toBe('ready');
        expect(emit).not.toHaveBeenCalledWith('creaturePortraitReady', expect.anything());
    });

    test('corrupted read-back protects the save but does not adopt the portrait', () => {
        const proof = watch(), original = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            return original.call(this, key, key === state.saveKey ? 'synthetic corrupt write' : value);
        });
        expect(state.saveCreaturePortrait(record)).toBe(false);
        expect(JSON.stringify(state.state)).toBe(proof.before);
        expect(state.getSaveAdmission().status).toBe('held');
        expect(proof.emit).not.toHaveBeenCalledWith('creaturePortraitReady', expect.anything());
    });

    test.each(['stateChanged', 'saved'])('a %s successor is neither rolled back nor announced as this result', event => {
        let successor, durable;
        state.once(event, () => {
            state.set('creature.genes', { id: 'synthetic-successor-creature', rarity: 'rare' });
            successor = JSON.stringify(state.state); durable = bytes();
        });
        const emit = jest.spyOn(state, 'emit');
        expect(state.saveCreaturePortrait(record)).toBe(false);
        expect(JSON.stringify(state.state)).toBe(successor); expect(bytes()).toBe(durable);
        expect(state.getSaveAdmission().status).toBe('ready');
        expect(emit).not.toHaveBeenCalledWith('creaturePortraitReady', expect.anything());
    });

    test('a ready listener can choose a different creature without an old result claiming ownership', () => {
        state.once('creaturePortraitReady', () => {
            state.set('creature.genes', { id: 'synthetic-successor-creature', rarity: 'rare' });
        });
        expect(state.saveCreaturePortrait(record)).toBe(false);
        expect(state.get('creature.genes.id')).toBe('synthetic-successor-creature');
        expect(state.getSaveAdmission().status).toBe('ready');
    });
});
