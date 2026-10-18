const { fixture } = require('./support/hatchingStartFixture.cjs');

describe('Start protects an unchanged reader after observing different supported primary bytes', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear();
        f = fixture({ admissionGate: true });
    });
    afterEach(() => {
        jest.restoreAllMocks(); f.close(); document.body.replaceChildren(); jest.useRealTimers();
        delete window.GameState; delete window.CloudSave; delete window.UXEnhancements;
    });

    test.each(['saveBackupCreated', 'stateChanged', 'openingJourneyAdvanced', 'saved',
        'showLoading', 'hideLoading'])('%s raw-only replacement blocks a later ordinary save', boundary => {
        let changedRaw, memory, lease, intercepted = false;
        const replaceRawOnly = () => {
            if (intercepted) return;
            intercepted = true;
            const supported = f.state.createSaveSnapshot(); supported.player.cosmicCoins = 77;
            changedRaw = JSON.stringify(supported); localStorage.setItem(f.state.saveKey, changedRaw);
            memory = JSON.stringify(f.state.state); lease = f.state.cloudWriteLease;
        };
        if (boundary.endsWith('Loading')) {
            const original = window.UXEnhancements[boundary].getMockImplementation();
            window.UXEnhancements[boundary].mockImplementation(() => { original(); replaceRawOnly(); });
        } else {
            const off = f.state.on(boundary, () => { off(); replaceRawOnly(); });
        }
        f.release();
        expect(intercepted).toBe(true);
        expect(f.scene.scene.restart).not.toHaveBeenCalled(); expect(f.scene.scene.start).not.toHaveBeenCalled();
        expect(localStorage.getItem(f.state.saveKey)).toBe(changedRaw);
        expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.state.cloudWriteLease).toBe(lease);
        const admission = f.state.getSaveAdmission();
        const saved = f.state.save();
        expect({ status: admission.status, laterSaveAccepted: saved,
            primaryPreserved: localStorage.getItem(f.state.saveKey) === changedRaw,
            retainedCoins: JSON.parse(localStorage.getItem(f.state.saveKey)).player.cosmicCoins })
            .toEqual({ status: 'held', laterSaveAccepted: false, primaryPreserved: true, retainedCoins: 77 });
        expect(document.querySelector('.save-recovery-gate button')?.textContent).toBe('Try saved game again');
    });

    test('adopted saved progress is not held as an old reader mismatch', () => {
        let successor;
        const off = f.state.on('saveBackupCreated', () => {
            off(); f.replace('saved-progress'); successor = f.snapshot();
        });
        f.release(); expect(successor).toBeDefined();
        expect(f.snapshot()).toEqual(successor); expect(f.state.getSaveAdmission().status).toBe('ready');
        expect(f.state.save()).toBe(true); expect(f.state.get('player.cosmicCoins')).toBe(77);
        expect(f.scene.scene.restart).not.toHaveBeenCalled(); expect(f.scene.scene.start).not.toHaveBeenCalled();
    });
});
