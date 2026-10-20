const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const Clock = require('phaser/src/time/Clock');
const World = require('phaser/src/physics/arcade/World');
const TweenManager = require('phaser/src/tweens/TweenManager');
const Systems = require('phaser/src/scene/Systems');
const SceneStatus = require('phaser/src/scene/const');
const Pan = require('phaser/src/cameras/2d/effects/Pan');

const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const sessionSource = fs.readFileSync(path.join(__dirname, '../scenes/controllers/PlatformerPauseSession.js'), 'utf8');
const sessionClass = parse(sessionSource, { sourceType: 'module' }).program.body
    .map(node => node.declaration || node).find(node => node.type === 'ClassDeclaration');
const PauseSession = new Function(`return (${sessionSource.slice(sessionClass.start, sessionClass.end)});`)();
const fixtures = [];

function fixture({ nativeTweenTime = false } = {}) {
    const uiWindow = new EventTarget();
    uiWindow.InventoryManager = { getAllItems: () => [] };
    const names = ['showPauseMenu', 'drawPauseMenu', 'hidePauseMenu', 'clearPauseMenuElements', 'returnToPauseMenu',
        'showPowerupMenu', 'getPowerupMenuLayout'];
    const methods = Object.fromEntries(cls.body.body.filter(node => names.includes(node.key?.name)).map(node => [
        node.key.name, new Function('window', 'console', 'PlatformerPauseSession',
            `return ({${source.slice(node.start, node.end)}}).${node.key.name};`)(uiWindow, { log() {} }, PauseSession)
    ]));
    const events = new EventEmitter();
    const scene = { ...methods, events,
        scene: {}, pauseMenuActive: false, pauseMenuElements: [], platformerControlsVisible: true,
        scale: { gameSize: { width: 390, height: 844 } },
        hidePlatformerMobileControls: jest.fn(() => { scene.platformerControlsVisible = false; }),
        showPlatformerMobileControls: jest.fn(() => { scene.platformerControlsVisible = true; }),
        returnToHub: jest.fn() };
    scene.sys = new Systems(scene, { key: 'SyntheticPause' });
    scene.sys.events = events;
    scene.sys.scale = { width: 390, height: 844 };
    Object.assign(scene.sys.settings, { status: SceneStatus.RUNNING, active: true, visible: true });
    const systems = scene.sys;
    const displays = [];
    function display(text = '') {
        const object = new EventEmitter();
        Object.assign(object, { text, active: true });
        for (const name of ['fillStyle', 'fillRect', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
            'setScrollFactor', 'setDepth', 'setOrigin', 'setInteractive', 'setColor', 'setScale']) object[name] = () => object;
        object.destroy = () => { object.active = false; object.removeAllListeners(); };
        displays.push(object);
        return object;
    }
    scene.add = { graphics: () => display(), text: (_x, _y, text) => display(text) };
    const world = new World(scene, { gravity: { y: 500 }, debug: false });
    scene.physics = { world, pause: () => world.pause(), resume: () => world.resume() };
    const clock = scene.time = new Clock(scene);
    const tweens = scene.tweens = new TweenManager(scene);
    const target = { x: 0 };
    tweens.add({ targets: target, x: 100, duration: 1000 });
    const tick = jest.fn();
    const timer = clock.delayedCall(1000, tick);
    const result = { scene, world, clock, tweens, target, timer, tick, uiWindow,
        step(delta) {
            if (!scene.sys.isActive()) return;
            if (nativeTweenTime) jest.advanceTimersByTime(delta);
            clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
            if (!nativeTweenTime) tweens.getDelta = () => delta;
            tweens.update();
            events.emit('postupdate', clock.now, delta);
        },
        press(label) {
            const button = this.button(label);
            if (!button) throw Error('SYNTHETIC_PAUSE_CONTROL_MISSING:' + label);
            button.emit('pointerdown');
        },
        button: label => displays.findLast(item => item.active && item.text.includes(label)),
        close() {
            scene.clearPauseMenuElements(); scene.pauseMenuSession?.retire();
            // Native Clock.destroy reads its original scene's Systems plugin.
            // Restore only the synthetic cleanup context after ownership assertions.
            scene.sys = systems;
            events.emit('shutdown'); tweens.destroy(); clock.destroy(); world.shutdown(); events.removeAllListeners();
        }
    };
    fixtures.push(result);
    return result;
}

describe('shared expedition pause owns only its native simulation state', () => {
    afterEach(() => { fixtures.splice(0).forEach(value => value.close()); jest.useRealTimers(); });

    test('control: ordinary clock and tween work advances without a menu', () => {
        const f = fixture();
        f.step(1); f.step(999);
        expect(f.tick).toHaveBeenCalledTimes(1);
        expect(f.target.x).toBeGreaterThan(0);
    });

    test('opening the real menu freezes native timers and automatic tween updates, then Resume continues once', () => {
        const f = fixture();
        f.step(1); f.step(200);
        const position = f.target.x, remaining = f.timer.getRemaining();
        f.scene.showPauseMenu();
        expect(f.world.isPaused).toBe(true);
        f.step(5000);
        expect(f.tick).not.toHaveBeenCalled();
        expect(f.timer.getRemaining()).toBe(remaining);
        expect(f.target.x).toBe(position);
        f.press('RESUME');
        expect(f.scene.pauseMenuActive).toBe(false);
        expect(f.world.isPaused).toBe(false);
        expect(f.clock.paused).toBe(false);
        expect(f.tweens.paused).toBe(false);
        f.step(remaining - 1);
        expect(f.tick).not.toHaveBeenCalled();
        f.step(1);
        expect(f.tick).toHaveBeenCalledTimes(1);
        expect(f.target.x).toBeGreaterThan(position);
    });

    test('closing the menu cannot steal a pre-existing physics pause', () => {
        const f = fixture();
        f.world.pause();
        f.scene.platformerControlsVisible = false;
        f.scene.showPauseMenu();
        f.press('RESUME');
        expect(f.world.isPaused).toBe(true);
        expect(f.scene.showPlatformerMobileControls).not.toHaveBeenCalled();
        expect(f.scene.platformerControlsVisible).toBe(false);
    });

    test('Power-ups and Back retain the same pause, and Resume restores the original running state', () => {
        const f = fixture();
        f.scene.showPauseMenu();
        const session = f.scene.pauseMenuSession;
        f.press('POWER-UPS');
        expect(f.scene.pauseMenuView).toBe('powerups');
        f.press('BACK');
        expect(f.scene.pauseMenuView).toBe('pause');
        expect(f.scene.pauseMenuSession).toBe(session);
        f.step(5000);
        expect(f.tick).not.toHaveBeenCalled();
        f.press('RESUME');
        expect(f.world.isPaused).toBe(false);
        expect(f.clock.paused).toBe(false);
        expect(f.tweens.paused).toBe(false);
        f.step(1000);
        expect(f.tick).toHaveBeenCalledTimes(1);
    });

    test.each(Array.from({ length: 8 }, (_, mask) => mask))('restores each originally paused combination %s', mask => {
        const f = fixture();
        const before = { world: Boolean(mask & 1), clock: Boolean(mask & 2), tweens: Boolean(mask & 4) };
        if (before.world) f.world.pause();
        f.clock.paused = before.clock; f.tweens.paused = before.tweens;
        f.scene.showPauseMenu();
        expect(f.world.isPaused && f.clock.paused && f.tweens.timeScale === 0).toBe(true);
        f.press('RESUME');
        expect(f.world.isPaused).toBe(before.world);
        expect(f.clock.paused).toBe(before.clock);
        expect(f.tweens.paused).toBe(before.tweens);
        expect(f.scene.pauseMenuSession).toBeNull();
    });

    test.each(['pause', 'sleep'])('closing behind native scene %s defers restoration until resume/wake', state => {
        const f = fixture();
        f.scene.showPauseMenu();
        const session = f.scene.pauseMenuSession;
        f.scene.sys[state]();
        f.scene.hidePauseMenu();
        expect(session.closed).toBe(false);
        expect(f.world.isPaused && f.clock.paused && f.tweens.timeScale === 0).toBe(true);
        expect(f.scene.showPlatformerMobileControls).not.toHaveBeenCalled();
        f.scene.sys[state === 'pause' ? 'resume' : 'wake']();
        expect(session.closed).toBe(true);
        expect(f.world.isPaused || f.clock.paused || f.tweens.paused).toBe(false);
        expect(f.scene.showPlatformerMobileControls).toHaveBeenCalledTimes(1);
        expect(f.scene.events.listenerCount('resume') + f.scene.events.listenerCount('wake')).toBe(0);
    });

    test.each(['isPlayerDead', 'levelCompletionActive', '_returningToHub'])('%s cannot be resumed by an old menu close', flag => {
        const f = fixture();
        f.scene.showPauseMenu();
        f.scene[flag] = true;
        f.scene.hidePauseMenu();
        expect(f.world.isPaused && f.clock.paused && f.tweens.timeScale === 0).toBe(true);
        expect(f.scene.showPlatformerMobileControls).not.toHaveBeenCalled();
        expect(f.scene.pauseMenuSession).toBeNull();
    });

    test.each(['clock', 'world', 'tweens', 'events', 'systems', 'plugin', 'player', 'player body'])(
        'a replaced %s cannot be resumed by the old session', kind => {
            const f = fixture();
            if (kind === 'player body') f.scene.player = { body: {} };
            f.scene.showPauseMenu();
            const session = f.scene.pauseMenuSession;
            const replacement = { paused: true, isPaused: true, resume: jest.fn(), resumeAll: jest.fn() };
            if (kind === 'clock') f.scene.time = replacement;
            if (kind === 'world') f.scene.physics.world = replacement;
            if (kind === 'tweens') f.scene.tweens = replacement;
            if (kind === 'events') f.scene.events = new EventEmitter();
            if (kind === 'systems') f.scene.sys = replacement;
            if (kind === 'plugin') f.scene.scene = replacement;
            if (kind === 'player') f.scene.player = replacement;
            if (kind === 'player body') f.scene.player.body = replacement;
            f.scene.pauseMenuActive = false;
            session.release();
            expect(session.closed).toBe(true);
            expect(replacement.resume).not.toHaveBeenCalled();
            expect(replacement.resumeAll).not.toHaveBeenCalled();
            expect(f.world.isPaused && f.clock.paused && f.tweens.timeScale === 0).toBe(true);
            expect(f.scene.showPlatformerMobileControls).not.toHaveBeenCalled();
        }
    );

    test.each(['shutdown', 'destroy'])('%s releases owned listeners without resuming a retired simulation', event => {
        const f = fixture();
        f.scene.showPauseMenu();
        const session = f.scene.pauseMenuSession;
        f.scene.sys.pause(); f.scene.hidePauseMenu();
        f.scene.events.emit(event);
        expect(session.closed).toBe(true);
        for (const name of ['resume', 'wake', 'shutdown', 'destroy']) expect(f.scene.events.listenerCount(name)).toBe(0);
        expect(f.world.isPaused && f.clock.paused && f.tweens.timeScale === 0).toBe(true);
        f.scene.sys.resume();
        expect(f.world.isPaused && f.clock.paused && f.tweens.timeScale === 0).toBe(true);
        expect(f.scene.showPlatformerMobileControls).not.toHaveBeenCalled();
    });

    test('a drawing failure restores owned simulation and preserves the required error', () => {
        const f = fixture(), failure = Error('SYNTHETIC_MENU_DRAW_FAILURE');
        f.scene.add.graphics = () => { throw failure; };
        expect(() => f.scene.showPauseMenu()).toThrow(failure);
        expect(f.scene.pauseMenuActive).toBe(false);
        expect(f.scene.pauseMenuSession).toBeNull();
        expect(f.world.isPaused || f.clock.paused || f.tweens.paused).toBe(false);
        expect(f.scene.platformerControlsVisible).toBe(true);
        expect(f.scene.pauseMenuElements).toHaveLength(0);
    });

    test('retained buttons from an earlier pause view cannot close or reroute its replacement', () => {
        const f = fixture();
        f.scene.showPauseMenu();
        const resume = f.button('RESUME').listeners('pointerdown')[0];
        const exit = f.button('EXIT').listeners('pointerdown')[0];
        const powerups = f.button('POWER-UPS').listeners('pointerdown')[0];
        f.press('POWER-UPS'); f.press('BACK');
        resume(); exit(); powerups();
        expect(f.scene.pauseMenuActive).toBe(true);
        expect(f.scene.pauseMenuView).toBe('pause');
        expect(f.scene.returnToHub).not.toHaveBeenCalled();
        expect(f.world.isPaused && f.clock.paused && f.tweens.timeScale === 0).toBe(true);
        f.press('RESUME');
        expect(f.world.isPaused).toBe(false);
    });

    test('an old power-up Use or Back callback cannot spend an item or replace the new view', () => {
        const f = fixture();
        const manager = f.uiWindow.InventoryManager;
        manager.getAllItems = () => [{ name: 'Synthetic item', type: 'powerup', usableInLevel: true }];
        manager.useItem = jest.fn();
        f.scene.showPauseMenu(); f.press('POWER-UPS');
        const use = f.button('USE').listeners('pointerdown')[0];
        const back = f.button('BACK').listeners('pointerdown')[0];
        f.press('BACK');
        const elements = f.scene.pauseMenuElements;
        use(); back();
        expect(manager.useItem).not.toHaveBeenCalled();
        expect(f.scene.pauseMenuElements).toBe(elements);
        expect(f.scene.pauseMenuView).toBe('pause');
    });

    test.each([200, 5000])('native tween time does not spend an unrendered %sms menu pause', pauseMs => {
        jest.useFakeTimers({ now: 1000 });
        const f = fixture({ nativeTweenTime: true });
        f.step(50); f.step(100);
        const tween = f.tweens.getTweensOf(f.target)[0];
        const elapsed = tween.elapsed, position = f.target.x;
        f.scene.showPauseMenu();
        // No frame calls during this interval: exercise the installed getDelta.
        jest.advanceTimersByTime(pauseMs);
        f.press('RESUME');
        expect(tween.elapsed).toBe(elapsed);
        expect(f.target.x).toBe(position);
        f.step(16);
        expect(tween.elapsed).toBe(elapsed + 16);
    });

    test('a pre-existing manager pause and non-default rate are preserved independently', () => {
        const f = fixture();
        f.tweens.timeScale = 0.5;
        f.tweens.pauseAll();
        f.scene.showPauseMenu(); f.press('RESUME');
        expect(f.tweens.paused).toBe(true);
        expect(f.tweens.timeScale).toBe(0.5);
    });

    test('an explicit replacement tween rate is not overwritten by old menu cleanup', () => {
        const f = fixture();
        f.scene.showPauseMenu();
        f.tweens.timeScale = 0.25;
        f.press('RESUME');
        expect(f.tweens.timeScale).toBe(0.25);
    });

    test.each(['RESUME', 'EXIT'])('a successor opened during native world resume cannot be dismissed by old %s', label => {
        const f = fixture();
        f.scene.showPauseMenu();
        const previous = f.scene.pauseMenuSession;
        f.world.once('resume', () => f.scene.showPauseMenu());
        f.press(label);
        expect(f.scene.pauseMenuSession).not.toBe(previous);
        expect(f.scene.pauseMenuSession.isCurrent()).toBe(true);
        expect(f.scene.pauseMenuActive).toBe(true);
        expect(f.scene.returnToHub).not.toHaveBeenCalled();
        expect(f.scene.showPlatformerMobileControls).not.toHaveBeenCalled();
        expect(f.world.isPaused && f.clock.paused && f.tweens.timeScale === 0).toBe(true);
        f.press('RESUME');
        expect(f.world.isPaused).toBe(false);
    });

    test('a native tween bookkeeping error still restores owned rate, clock, world and controls', () => {
        const f = fixture(), failure = Error('SYNTHETIC_TWEEN_RESUME_FAILURE');
        f.scene.showPauseMenu();
        f.tweens.update = () => { throw failure; };
        expect(() => f.press('RESUME')).toThrow(failure);
        expect(f.scene.pauseMenuSession).toBeNull();
        expect(f.world.isPaused || f.clock.paused).toBe(false);
        expect(f.tweens.timeScale).toBe(1);
        expect(f.scene.platformerControlsVisible).toBe(true);
    });

    test('a partial native physics-pause failure rolls back its own changes', () => {
        const f = fixture(), failure = Error('SYNTHETIC_PAUSE_FAILURE');
        f.scene.physics.pause = () => { f.world.pause(); throw failure; };
        expect(() => f.scene.showPauseMenu()).toThrow(failure);
        expect(f.scene.pauseMenuSession).toBeNull();
        expect(f.scene.pauseMenuActive).toBe(false);
        expect(f.world.isPaused || f.clock.paused).toBe(false);
        expect(f.tweens.timeScale).toBe(1);
    });

    const updateNode = cls.body.body.find(node => node.key?.name === 'update');
    const updateBase = new Function(`return ({${source.slice(updateNode.start, updateNode.end)}}).update;`)();
    class UpdateBase { update(time, delta) { return updateBase.call(this, time, delta); } }
    test.each(['MythicalForestLevel', 'CrystalCavesLevel', 'ReefLevel', 'VoidPeaksLevel', 'AuroraDepthsLevel', 'FinalVoidLevel'])(
        '%s skips gameplay updates behind pause but still dismisses stale film notices', name => {
            const level = fs.readFileSync(path.join(__dirname, '../scenes/levels', name + '.js'), 'utf8');
            const declaration = parse(level, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
            const update = declaration.body.body.find(node => node.key?.name === 'update');
            const Level = new Function('Base', `return class extends Base {${level.slice(update.start, update.end)}};`)(UpdateBase);
            const scene = new Level();
            Object.assign(scene, { pauseMenuActive: true, player: {}, updateGeneratedVideoDelivery: jest.fn() });
            expect(() => scene.update(1000, 16)).not.toThrow();
            expect(scene.updateGeneratedVideoDelivery).toHaveBeenCalledWith(1000);
        }
    );

    test('the normal unpaused shared update still enters its gameplay path', () => {
        const scene = new UpdateBase(), entered = Error('SYNTHETIC_ACTIVE_UPDATE');
        Object.assign(scene, { player: {}, updateGeneratedVideoDelivery: jest.fn(),
            checkAndFixStuckPlayer: jest.fn(() => { throw entered; }) });
        expect(() => scene.update(1000, 16)).toThrow(entered);
        expect(scene.checkAndFixStuckPlayer).toHaveBeenCalledTimes(1);
    });

    test('a native camera completion cannot resume physics behind the menu or leave it stuck afterwards', () => {
        const f = fixture();
        f.world.pause();
        const camera = Object.assign(new EventEmitter(), { scene: f.scene, scrollX: 0, scrollY: 0,
            getScroll: (x, y, out) => out.set(x, y), setScroll() {}, centerOn() {} });
        const pan = new Pan(camera);
        camera.once('camerapancomplete', () => f.scene.physics.resume());
        try {
            pan.start(100, 0, 100, 'Linear', true);
            f.scene.showPauseMenu();
            pan.update(100, 100);
            expect(pan.isRunning).toBe(false);
            expect(f.world.isPaused).toBe(true);
            f.press('RESUME');
            expect(f.world.isPaused).toBe(false);
        } finally { pan.destroy(); camera.removeAllListeners(); }
    });

    test('a new external physics pause takes precedence over the menu original running state', () => {
        const f = fixture();
        f.scene.showPauseMenu();
        f.scene.physics.pause();
        f.press('RESUME');
        expect(f.world.isPaused).toBe(true);
        expect(f.clock.paused).toBe(false);
        expect(f.tweens.timeScale).toBe(1);
    });

    test.each(['RESUME', 'EXIT', 'POWER-UPS'])('failed optional button audio cannot block %s', label => {
        const f = fixture();
        f.uiWindow.AudioManager = { playButtonClick() { throw Error('SYNTHETIC_OPTIONAL_AUDIO'); } };
        f.scene.showPauseMenu();
        expect(() => f.press(label)).not.toThrow();
        if (label === 'POWER-UPS') expect(f.scene.pauseMenuView).toBe('powerups');
        else expect(f.scene.pauseMenuActive).toBe(false);
        if (label === 'EXIT') expect(f.scene.returnToHub).toHaveBeenCalledTimes(1);
    });

    test('failed optional item audio still displays the item result and leaves Back usable', () => {
        const f = fixture();
        f.uiWindow.InventoryManager.getAllItems = () => [{ name: 'Synthetic item', type: 'powerup', usableInLevel: true }];
        f.uiWindow.InventoryManager.useItem = jest.fn(() => true);
        f.uiWindow.AudioManager = { playLevelUp() { throw Error('SYNTHETIC_OPTIONAL_ITEM_AUDIO'); } };
        f.scene.showPauseMenu(); f.press('POWER-UPS');
        expect(() => f.press('USE')).not.toThrow();
        expect(f.scene.powerupStatusMessage).toBe('Synthetic item activated');
        f.press('BACK');
        expect(f.scene.pauseMenuView).toBe('pause');
    });
});
