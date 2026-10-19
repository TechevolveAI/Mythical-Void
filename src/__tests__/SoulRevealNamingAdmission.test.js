const { fixture } = require('./support/soulNamingFixture.cjs');

describe('naming preflight does not consume protected progress or its native action', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        localStorage.clear(); document.body.replaceChildren();
        for (const key of ['CloudSave', 'AchievementSystem', 'AudioManager', 'BirthEventSystem']) delete window[key];
        f = fixture();
    });
    afterEach(() => {
        f.close(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'CloudSave', 'AchievementSystem', 'AudioManager', 'BirthEventSystem']) delete window[key];
        document.body.replaceChildren();
    });

    const memory = () => JSON.stringify(f.state.state);
    const untouchedControls = () => {
        expect(f.scene.canProceed).toBe(true);
        expect(f.scene.inputActive).toBe(true);
        expect(f.input.isConnected).toBe(true);
        expect(f.button.isConnected).toBe(true);
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    };

    test('normal native submit still stores the name and selected roster record before handoff', () => {
        f.scene.showLivingPortraitHandoff.mockImplementation(name => {
            const durable = JSON.parse(f.raw());
            expect(name).toBe('Fictional Glow');
            expect(durable.creature.name).toBe(name);
            expect(durable.creature.named).toBe(true);
            expect(durable.creatures).toHaveLength(1);
            expect(durable.creature.id).toBe(durable.creatures[0].id);
            expect(durable.creature.genes.id).toBe('fictional-hatched-genes');
        });
        f.button.click();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
    });

    test.each(['held', 'memory-only', 'unknown-cloud'])('%s admission cannot mutate naming or collection fields', condition => {
        if (condition === 'held') f.state.holdSaveAdmission({ code: 'fictional_hold' }, 'fictional');
        if (condition === 'memory-only') f.state.storageMode = 'memory';
        if (condition === 'unknown-cloud') f.state.cloudRecoveryRequired = true;
        const before = memory(), raw = f.raw();
        f.scene.finalizeName();
        expect(memory()).toBe(before);
        expect(f.raw()).toBe(raw);
        untouchedControls();
    });

    test('the same native button can submit once after the original hold is explicitly released', () => {
        f.state.holdSaveAdmission({ code: 'fictional_hold' }, 'fictional');
        const before = memory(), raw = f.raw();
        f.button.click();
        expect(memory()).toBe(before); expect(f.raw()).toBe(raw); untouchedControls();
        f.state.releaseSaveAdmission();
        f.button.click(); f.button.click();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(f.state.get('creatures')).toHaveLength(1);
    });

    test.each(['manager', 'memory', 'epoch', 'cloud'])('a %s replacement during admission cannot continue naming', change => {
        jest.spyOn(f.state, 'canCommitHatchSave').mockImplementation(() => {
            if (change === 'manager') f.replaceManager();
            if (change === 'memory') f.state.set('player.cosmicCoins', 77);
            if (change === 'epoch') f.state.releaseSaveAdmission();
            if (change === 'cloud') window.CloudSave = { campaignEpoch: 1 };
            return true;
        });
        f.scene.finalizeName();
        expect(f.state.get('creature.named')).toBe(false);
        expect(f.state.get('creatures')).toHaveLength(0);
        untouchedControls();
    });

    test('a throwing admission check leaves the original input and submit available', () => {
        jest.spyOn(f.state, 'canCommitHatchSave').mockImplementation(() => { throw Error('fictional admission fault'); });
        const before = memory(), raw = f.raw();
        expect(() => f.scene.finalizeName()).not.toThrow();
        expect(memory()).toBe(before); expect(f.raw()).toBe(raw); untouchedControls();
    });

    test.each(['throw', 'memory', 'raw-only'])('an observed primary read with %s cannot publish a name', change => {
        const read = Storage.prototype.getItem, canCommit = f.state.canCommitHatchSave.bind(f.state);
        const initial = f.raw();
        let armed = false, replacement;
        jest.spyOn(f.state, 'canCommitHatchSave').mockImplementation(() => {
            const allowed = canCommit(); armed = true; return allowed;
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            const value = read.call(this, key);
            if (armed && key === f.state.saveKey) {
                armed = false;
                if (change === 'throw') throw Error('fictional unreadable primary');
                if (change === 'memory') f.state.set('player.cosmicCoins', 77);
                if (change === 'raw-only') {
                    const next = JSON.parse(initial); next.player.cosmicCoins = 77;
                    replacement = JSON.stringify(next); localStorage.setItem(key, replacement);
                }
            }
            return value;
        });
        f.scene.finalizeName();
        expect(f.state.get('creature.named')).toBe(false);
        expect(f.state.get('creatures')).toHaveLength(0);
        expect(f.raw()).toBe(replacement || initial);
        untouchedControls();
    });

    test('native touch and pointer submissions re-arm after admission refusal without duplicate naming', () => {
        f.state.holdSaveAdmission({ code: 'fictional_hold' }, 'fictional');
        f.button.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
        f.button.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        untouchedControls();
        f.state.releaseSaveAdmission();
        f.button.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        f.button.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(f.state.get('creatures')).toHaveLength(1);
    });
});
