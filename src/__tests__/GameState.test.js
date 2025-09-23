const GameStateManager = require('../systems/GameState.js');

describe('GameStateManager', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        manager = new GameStateManager();
    });

    afterEach(() => {
        manager.stopAutoSave();
    });

    test('reset restores default creature state and clears persistence', () => {
        manager.set('creature.hatched', true);
        manager.set('creature.name', 'Testy');
        manager.set('player.name', 'Player1');
        localStorage.setItem(manager.saveKey, JSON.stringify({ creature: { hatched: true } }));

        manager.reset();

        expect(manager.get('creature.hatched')).toBe(false);
        expect(manager.get('creature.name')).toBe('Your Creature');
        expect(manager.get('player.name')).toBe('');
        expect(localStorage.getItem(manager.saveKey)).toBeNull();
        expect(manager.initialized).toBe(false);
    });

    test('reset after init returns session to defaults', () => {
        manager.init();
        manager.set('session.gameStarted', true);
        manager.set('session.currentScene', 'GameScene');

        manager.reset();

        expect(manager.get('session.gameStarted')).toBe(false);
        expect(manager.get('session.currentScene')).toBe('HatchingScene');
        expect(manager.initialized).toBe(false);
    });

    test('listener cleanup via disposer and off()', () => {
        const spy = jest.fn();
        const disposer = manager.on('event/sample', spy);

        manager.emit('event/sample', { foo: 'bar' });
        expect(spy).toHaveBeenCalledTimes(1);

        disposer();
        manager.emit('event/sample', { foo: 'baz' });
        expect(spy).toHaveBeenCalledTimes(1);

        const anotherSpy = jest.fn();
        manager.on('event/sample', anotherSpy);
        manager.off('event/sample', anotherSpy);
        manager.emit('event/sample');
        expect(anotherSpy).not.toHaveBeenCalled();
    });

    test('once() listeners are invoked a single time', () => {
        const spy = jest.fn();
        manager.once('levelUp', spy);

        manager.emit('levelUp', { level: 2 });
        manager.emit('levelUp', { level: 3 });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith({ level: 2 });
    });

    test('performCareAction applies override happiness bonus', () => {
        manager.set('creature.hatched', true);
        manager.set('creature.stats.happiness', 40);

        const eventSpy = jest.fn();
        manager.once('careActionPerformed', eventSpy);

        const success = manager.performCareAction('feed', 25);

        expect(success).toBe(true);
        expect(manager.get('creature.stats.happiness')).toBe(65);
        expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
            action: 'feed',
            happinessBonus: 25,
            happinessOverride: true
        }));
    });
});
