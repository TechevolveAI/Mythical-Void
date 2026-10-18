const { fixture, Panel } = require('./support/residentReleaseFixture.cjs');

describe('rescue-to-rewards handoff stays recoverable', () => {
    const fixtures = [];
    const create = options => { const f = fixture(options); fixtures.push(f); return f; };
    beforeEach(() => { localStorage.clear(); });
    afterEach(() => {
        jest.restoreAllMocks(); fixtures.splice(0).forEach(f => f.close());
        document.body.replaceChildren(); delete window.GameState; delete window.AudioManager;
    });
    test('normal continuation keeps its existing 100ms delay and runs once', () => {
        const f = create(); f.show(); const next = jest.fn();
        f.scene.pendingResidentReleaseContinuation = next;
        f.scene.residentReleaseClose(); f.scene.residentReleaseClose?.();
        f.advance(99); expect(next).not.toHaveBeenCalled();
        f.advance(1); expect(next).toHaveBeenCalledTimes(1);
        expect(f.acknowledge).not.toHaveBeenCalled(); expect(f.scene.returnToHub).not.toHaveBeenCalled();
    });
    test('keeps the current rescue button until the delayed continuation accepts', () => {
        const f = create(); f.show(); const button = f.button();
        const next = jest.fn(); f.scene.pendingResidentReleaseContinuation = next;
        f.scene.residentReleaseClose();
        expect(button.active).toBe(true); f.advance(99); expect(next).not.toHaveBeenCalled();
        f.advance(1); expect(next).toHaveBeenCalledTimes(1); expect(button.active).toBe(false);
    });
    test.each(['throw', 'refuse'])(
        '%s leaves an enabled retry instead of an empty completed level', reason => {
            const f = create(); f.show(); const button = f.button();
            const next = jest.fn().mockImplementationOnce(() => {
                if (reason === 'throw') throw Error('Fictional rewards failure'); return false;
            });
            f.scene.pendingResidentReleaseContinuation = next; f.scene.residentReleaseClose();
            expect(() => f.advance(100)).not.toThrow();
            expect(button.active).toBe(true); expect(button.input.enabled).toBe(true);
            expect(f.scene.residentReleaseOpen).toBe(true);
            expect(f.scene.pendingResidentReleaseContinuation).toBe(next);
            f.scene.residentReleaseClose(); f.advance(100);
            expect(next).toHaveBeenCalledTimes(2); expect(button.active).toBe(false);
        });
    test('a scheduling failure keeps the original action usable', () => {
        const f = create(); f.show(); const button = f.button();
        const next = jest.fn(); f.scene.pendingResidentReleaseContinuation = next;
        jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(() => { throw Error('Fictional timer refusal'); });
        expect(() => f.scene.residentReleaseClose()).not.toThrow();
        expect(button.active).toBe(true); expect(button.input.enabled).toBe(true);
        expect(f.scene.residentReleaseOpen).toBe(true);
    });
    test('optional button audio cannot swallow the handoff', () => {
        const f = create(); f.show();
        window.AudioManager = { playButtonClick: () => { throw Error('Fictional audio failure'); } };
        const next = jest.fn(); f.scene.pendingResidentReleaseContinuation = next;
        expect(() => f.scene.residentReleaseClose()).not.toThrow(); f.advance(100);
        expect(next).toHaveBeenCalledTimes(1);
    });
    test('New Game during the delay retires the previous continuation', () => {
        const f = create(); f.show(); const next = jest.fn();
        f.scene.pendingResidentReleaseContinuation = next; f.scene.residentReleaseClose();
        expect(f.state.startFreshGame()).toBe(true); f.advance(100);
        expect(next).not.toHaveBeenCalled();
    });
    test('a captured old close cannot remove a later rescue', () => {
        const f = create(); f.show(); const old = f.scene.residentReleaseClose; old();
        f.show(); const button = f.button(); old();
        expect(button.active).toBe(true); expect(f.scene.residentReleaseOpen).toBe(true);
    });
    test('a late older tableau cannot replace the new rescue media', async () => {
        let resolve; const response = new Promise(done => { resolve = done; }); let calls = 0;
        const f = create({ media: () => ++calls === 1 ? response : null }); f.show();
        f.scene.residentReleaseClose(); f.show();
        const tableau = { destroy: jest.fn() }; resolve(tableau); await Promise.resolve();
        expect(tableau.destroy).toHaveBeenCalledTimes(1);
        expect(f.scene.residentReleaseTableau).not.toBe(tableau);
    });
    test('an optional synchronous still failure does not remove the continue action', () => {
        const f = create({ media: () => { throw Error('Fictional still failure'); } });
        expect(() => f.show()).not.toThrow(); expect(f.button()?.active).toBe(true);
    });
    test('optional resident texture generation cannot swallow the action', () => {
        const f = create(); f.scene.levelCompletionResult.rescuedResident.genetics = { id: 'fictional-resident-genes' };
        f.scene.graphicsEngine = { createRandomizedSpaceMythicCreature: () => { throw Error('Fictional drawing failure'); } };
        expect(() => f.show()).not.toThrow(); expect(f.button()?.active).toBe(true);
        const next = jest.fn(); f.scene.pendingResidentReleaseContinuation = next;
        f.scene.residentReleaseClose(); f.advance(100); expect(next).toHaveBeenCalledTimes(1);
    });
    test('partial summary mounting is cleaned up and can retry without repeating rewards', () => {
        let first = true;
        class FailingPanel extends Panel {
            show(data) { const result = super.show(data); if (first) { first = false; throw Error('Fictional mount failure'); } return result; }
        }
        const f = create({ PanelType: FailingPanel }); f.show(); const button = f.button();
        f.scene.showRegionalVictorySummary(); f.scene.residentReleaseClose();
        expect(() => f.advance(100)).not.toThrow();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(button.active).toBe(true); expect(button.input.enabled).toBe(true);
        expect(f.acknowledge).not.toHaveBeenCalled();
        f.scene.residentReleaseClose(); f.advance(100);
        expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
        expect(f.acknowledge).not.toHaveBeenCalled(); expect(f.scene.returnToHub).not.toHaveBeenCalled();
    });
    test('keyboard and repeated touches share one request and can retry a refused mount', () => {
        let first = true;
        class RefusingPanel extends Panel {
            show(data) { if (first) { first = false; return false; } return super.show(data); }
        }
        const f = create({ PanelType: RefusingPanel }); f.show(); f.scene.showRegionalVictorySummary();
        const close = f.scene.residentReleaseClose;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
        close(); close(); f.advance(100);
        expect(f.button().text).toBe('TRY AGAIN');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); f.advance(100);
        expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
        expect(f.scene.levelCompletionKeyHandler).toBeNull();
    });
    test('an old scheduled callback cannot consume a later retry request', () => {
        const f = create(); f.show();
        const later = jest.fn(), next = jest.fn().mockReturnValueOnce(false);
        f.scene.pendingResidentReleaseContinuation = next;
        const delayed = jest.spyOn(f.clock, 'delayedCall');
        f.scene.residentReleaseClose(); const old = delayed.mock.calls[0][1]; f.advance(100);
        f.scene.pendingResidentReleaseContinuation = later; f.scene.residentReleaseClose();
        old(); expect(later).not.toHaveBeenCalled();
        f.advance(100); expect(later).toHaveBeenCalledTimes(1); expect(next).toHaveBeenCalledTimes(1);
    });
    test.each(['receipt', 'global-state', 'plugin', 'clock', 'tweens', 'shutdown'])(
        '%s retirement before the delay cannot invoke the old handoff', kind => {
            const f = create(); f.show(); const next = jest.fn();
            f.scene.pendingResidentReleaseContinuation = next; f.scene.residentReleaseClose();
            if (kind === 'receipt') f.scene.levelCompletionResult = {};
            if (kind === 'global-state') window.GameState = {};
            if (kind === 'plugin') f.scene.scene = {};
            if (kind === 'clock') f.scene.time = {};
            if (kind === 'tweens') f.scene.tweens = {};
            if (kind === 'shutdown') f.scene.events.emit('shutdown');
            f.advance(100); expect(next).not.toHaveBeenCalled();
        });
    test('cleanup reentry cannot clear a replacement rescue presentation', () => {
        const f = create(); f.show();
        const oldOwner = f.scene.residentReleasePresentation;
        f.objects[0].once('destroy', () => { f.show(); });
        f.scene.residentReleaseClose();
        expect(f.scene.residentReleasePresentation).not.toBe(oldOwner);
        expect(f.scene.residentReleaseOpen).toBe(true); expect(f.button().active).toBe(true);
    });
    test('a newly shown rescue does not inherit the already-delivered continuation', () => {
        const f = create(); f.show(); let replacement;
        const next = jest.fn(() => { f.show(); replacement = f.scene.residentReleasePresentation; });
        f.scene.pendingResidentReleaseContinuation = next; f.scene.residentReleaseClose(); f.advance(100);
        expect(f.scene.residentReleasePresentation).toBe(replacement); expect(f.scene.residentReleaseOpen).toBe(true);
        expect(f.scene.pendingResidentReleaseContinuation).toBeNull();
        f.scene.residentReleaseClose(); f.advance(100); expect(next).toHaveBeenCalledTimes(1);
    });
    test('optional reveal animation and achievement audio faults leave the action usable', () => {
        const f = create(); f.show(); const button = f.button();
        f.scene.tweens.add.mockImplementation(() => { throw Error('Fictional optional animation fault'); });
        window.AudioManager = { playAchievement: () => { throw Error('Fictional optional sound fault'); } };
        expect(() => f.advance(700)).not.toThrow();
        const next = jest.fn(); f.scene.pendingResidentReleaseContinuation = next;
        f.scene.residentReleaseClose(); f.advance(100);
        expect(next).toHaveBeenCalledTimes(1); expect(button.active).toBe(false);
    });
    test.each([[390, 844], [844, 390], [1280, 720]])(
        'native action handoff at %sx%s uses the actual rewards DOM without acknowledging early', (width, height) => {
            const f = create({ width, height }); f.show(); f.scene.showRegionalVictorySummary();
            f.scene.residentReleaseClose(); f.advance(100);
            expect(document.querySelector('[role="dialog"]')).not.toBeNull();
            expect(f.scene.input.enabled).toBe(false); expect(f.acknowledge).not.toHaveBeenCalled();
            f.scene.regionalVictoryPanel.button.click();
            expect(f.scene.returnToHub).toHaveBeenCalledTimes(1); expect(f.scene.input.enabled).toBe(true);
        });
    test('failed old mounting cannot restore input or clear a newly adopted panel', () => {
        let f, replacement;
        class ReplacingPanel extends Panel {
            show(data) {
                super.show(data);
                f.scene.levelCompletionResult = { levelId: 'crystalCaves' };
                replacement = new Panel({ onContinue: jest.fn() }); f.scene.regionalVictoryPanel = replacement;
                replacement.show(data); f.scene.input.enabled = false;
                throw Error('Fictional retired mount fault');
            }
        }
        f = create({ PanelType: ReplacingPanel }); f.show(); f.scene.showRegionalVictorySummary();
        f.scene.residentReleaseClose(); f.advance(100);
        expect(f.scene.regionalVictoryPanel).toBe(replacement); expect(f.scene.input.enabled).toBe(false);
        expect(replacement.root.isConnected).toBe(true); expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    });
    test('a reset before mounted-summary Continue cannot acknowledge or route the old completion', () => {
        const f = create(); f.show(); f.scene.showRegionalVictorySummary();
        f.scene.residentReleaseClose(); f.advance(100);
        expect(f.state.startFreshGame()).toBe(true); f.scene.regionalVictoryPanel.button.click();
        expect(f.acknowledge).not.toHaveBeenCalled(); expect(f.scene.returnToHub).not.toHaveBeenCalled();
    });
});
