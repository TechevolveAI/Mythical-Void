const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');

const menuSource = fs.readFileSync(path.join(__dirname, '../ui/TrumptopusSessionMenu.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export class', 'class');
const Menu = new Function(`${menuSource}\nreturn TrumptopusSessionMenu;`)();
const shellSource = fs.readFileSync(path.join(__dirname, '../scenes/levels/TrumptopusLevel.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/export default /g, '').replace(/export /g, '');
const runtime = new Function('Approach', 'Campaign', 'TrumptopusSessionMenu',
    `${shellSource}\nreturn withCampaignRuntime;`)(class {}, class {}, Menu);

function method(file, name) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const node = parse(source, { sourceType: 'module' }).program.body
        .find(node => ['ClassDeclaration', 'ExportDefaultDeclaration'].includes(node.type));
    const declaration = node.declaration || node;
    const entry = declaration.body.body.find(node => node.key.name === name);
    return new Function(`return ({${source.slice(entry.start, entry.end)}}).${name};`)();
}

// Actual production shell/menu, installed World/Clock/TweenManager, and actual
// pause/partial-panel cleanup methods. Encounter, routes, checkpoints and drawing are fake.
// No game, renderer, audio, real save or provider is started.
function fixture() {
    class Base {
        showPowerupMenu() {
            const item = { depth: 5000, setDepth: jest.fn(), destroy: jest.fn(), removeAllListeners: jest.fn() };
            this.pauseMenuElements.push(item); this.createdItems.push(item);
            if (this.failPowerups) throw Error('SYNTHETIC_POWERUP_SETUP_FAILURE');
        }
    }
    Base.prototype.setPrototypePaused = method('dev/TrumptopusPrototypeLevel.js', 'setPrototypePaused');
    const scene = new (runtime(Base))('SyntheticFinale');
    const events = new EventEmitter();
    Object.assign(scene, { events, sys: { events, scale: { width: 390, height: 844 } },
        encounter: { paused: false, setPaused(value) { this.paused = value; } },
        completion: { saveProgress: jest.fn(() => true) },
        scene: { restart: jest.fn(), start: jest.fn() }, clearInput: jest.fn(),
        hidePlatformerMobileControls: jest.fn(), showPlatformerMobileControls: jest.fn(),
        pauseMenuElements: [], createdItems: [], sessionMenu: null });
    const world = new World(scene, { gravity: { y: 0 } }); scene.physics = { world };
    const clock = scene.time = new Clock(scene), tweens = scene.tweens = new TweenManager(scene);
    scene.clearPauseMenuElements = method('scenes/PlatformerLevelScene.js', 'clearPauseMenuElements');
    scene.openSessionMenu(false);
    const menu = scene.sessionMenu;
    return { scene, menu, world, clock, tweens,
        button(label) { return menu.buttons.find(button => button.textContent === label); },
        close() { scene.sessionMenu?.close(); menu.close(); scene.clearPauseMenuElements();
            tweens.destroy(); clock.destroy(); world.shutdown(); document.body.replaceChildren(); } };
}

describe('final boss pause and retry actions retain a usable recovery path', () => {
    test.each(['Retry checkpoint', 'Return to the gates', 'Power-ups'])(
        'a failed %s keeps the original menu focused and paused', label => {
            const f = fixture();
            try {
                if (label === 'Retry checkpoint') f.scene.scene.restart.mockImplementationOnce(() => { throw Error('SYNTHETIC_ROUTE_FAILURE'); });
                if (label === 'Return to the gates') f.scene.scene.start.mockImplementationOnce(() => { throw Error('SYNTHETIC_ROUTE_FAILURE'); });
                if (label === 'Power-ups') f.scene.failPowerups = true;
                const button = f.button(label);
                expect(() => button.onclick()).not.toThrow();
                expect(f.scene.sessionMenu).toBe(f.menu);
                expect(f.menu.root?.isConnected).toBe(true);
                expect(f.menu.root.querySelector('[role=status]')?.textContent).toContain('Try again');
                expect(button.disabled).toBe(false); expect(document.activeElement).toBe(button);
                expect(f.world.isPaused).toBe(true); expect(f.clock.paused).toBe(true);
                expect(f.scene.encounter.paused).toBe(true);
                expect(f.scene.pauseMenuElements).toEqual([]);
                f.scene.createdItems.forEach(item => expect(item.destroy).toHaveBeenCalledTimes(1));
                f.scene.failPowerups = false;
                expect(() => button.onclick()).not.toThrow();
                expect(f.menu.root).toBeNull();
                if (label === 'Retry checkpoint') expect(f.scene.scene.restart).toHaveBeenCalledTimes(2);
                if (label === 'Return to the gates') expect(f.scene.scene.start).toHaveBeenCalledTimes(2);
                if (label === 'Power-ups') expect(f.scene.pauseMenuElements).toHaveLength(1);
            } finally { f.close(); }
        }
    );

    test.each(['Retry checkpoint', 'Return to the gates'])(
        'a refused checkpoint save before %s stays retryable without replacing it', label => {
            const f = fixture();
            try {
                f.scene.completion.saveProgress.mockImplementationOnce(() => { throw Error('SYNTHETIC_CHECKPOINT_FAILURE'); });
                const button = f.button(label);
                expect(() => button.onclick()).not.toThrow();
                expect(f.menu.root?.isConnected).toBe(true); expect(f.scene.sessionMenu).toBe(f.menu);
                expect(f.scene.scene.restart).not.toHaveBeenCalled(); expect(f.scene.scene.start).not.toHaveBeenCalled();
                expect(f.menu.root.textContent).toContain('Try again'); expect(button.disabled).toBe(false);
                button.onclick(); expect(f.menu.root).toBeNull();
            } finally { f.close(); }
        }
    );

    test.each(['Retry checkpoint', 'Return to the gates', 'Power-ups'])(
        'accepted %s closes the source menu, and captured old actions are inert', label => {
            const f = fixture();
            try {
                const button = f.button(label), callback = button.onclick;
                callback(); expect(f.menu.root).toBeNull();
                const saves = f.scene.completion.saveProgress.mock.calls.length;
                const restarts = f.scene.scene.restart.mock.calls.length, starts = f.scene.scene.start.mock.calls.length;
                const items = f.scene.createdItems.length;
                callback(); button.click();
                expect(f.scene.completion.saveProgress).toHaveBeenCalledTimes(saves);
                expect(f.scene.scene.restart).toHaveBeenCalledTimes(restarts);
                expect(f.scene.scene.start).toHaveBeenCalledTimes(starts);
                expect(f.scene.createdItems).toHaveLength(items);
            } finally { f.close(); }
        }
    );

    test.each(['Retry checkpoint', 'Return to the gates'])(
        '%s cannot close a successor menu created inside the accepted route request', label => {
            const f = fixture();
            try {
                const request = label === 'Retry checkpoint' ? f.scene.scene.restart : f.scene.scene.start;
                let successor;
                request.mockImplementationOnce(() => {
                    f.menu.close(); f.scene.openSessionMenu(false); successor = f.scene.sessionMenu;
                });
                f.button(label).onclick();
                expect(f.scene.sessionMenu).toBe(successor); expect(successor.root?.isConnected).toBe(true);
                expect(successor).not.toBe(f.menu);
            } finally { f.close(); }
        }
    );

    test.each(['Retry checkpoint', 'Return to the gates'])(
        'an explicitly refused %s request retains its retry control', label => {
            const f = fixture();
            try {
                const request = label === 'Retry checkpoint' ? f.scene.scene.restart : f.scene.scene.start;
                request.mockReturnValueOnce(false);
                f.button(label).onclick();
                expect(f.scene.sessionMenu).toBe(f.menu); expect(f.menu.root?.isConnected).toBe(true);
                expect(f.menu.root.textContent).toContain('Try again');
                expect(f.button(label).disabled).toBe(false);
                f.button(label).onclick(); expect(f.menu.root).toBeNull();
            } finally { f.close(); }
        }
    );

    test.each([
        ['Retry checkpoint', 1], ['Return to the gates', 1], ['Return to the gates', 2]
    ])('retirement during checkpoint call %s/%s cannot dispatch the old route', (label, call) => {
        const f = fixture();
        try {
            let count = 0, successor;
            f.scene.completion.saveProgress.mockImplementation(() => {
                if (++count === call) {
                    f.scene.openSessionMenu(false); successor = f.scene.sessionMenu;
                }
                return true;
            });
            f.button(label).onclick();
            expect(f.scene.sessionMenu).toBe(successor); expect(successor.root?.isConnected).toBe(true);
            expect(f.scene.scene.restart).not.toHaveBeenCalled(); expect(f.scene.scene.start).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['Retry checkpoint', 'Return to the gates'])(
        'a %s request replacing the menu and then throwing does not remove its successor', label => {
            const f = fixture();
            try {
                const request = label === 'Retry checkpoint' ? f.scene.scene.restart : f.scene.scene.start;
                let successor;
                request.mockImplementationOnce(() => {
                    f.scene.openSessionMenu(false); successor = f.scene.sessionMenu;
                    throw Error('SYNTHETIC_RETIRED_ROUTE_FAILURE');
                });
                expect(() => f.button(label).onclick()).not.toThrow();
                expect(f.scene.sessionMenu).toBe(successor); expect(successor.root?.isConnected).toBe(true);
                expect(successor.root.querySelector('[role=status]').textContent).toBe('');
                expect(successor.buttons.every(button => !button.disabled)).toBe(true);
            } finally { f.close(); }
        }
    );

    test('a failed death-menu retry retains Retry and Exit, never Resume', () => {
        const f = fixture();
        try {
            f.scene.isPlayerDead = true; f.scene.openSessionMenu(true);
            const menu = f.scene.sessionMenu;
            f.scene.scene.restart.mockImplementationOnce(() => { throw Error('SYNTHETIC_RETRY_FAILURE'); });
            expect(() => menu.buttons[0].onclick()).not.toThrow();
            expect(menu.root?.isConnected).toBe(true);
            expect(menu.buttons.map(button => button.textContent)).toEqual(['Try again', 'Return to the gates']);
            expect(f.world.isPaused).toBe(true); expect(menu.buttons[0].disabled).toBe(false);
            menu.buttons[0].onclick(); expect(menu.root).toBeNull();
        } finally { f.close(); }
    });

    test('a closed menu ignores captured Escape and direct button handlers', () => {
        const onResume = jest.fn(), onRetry = jest.fn();
        const menu = new Menu({ onResume, onRetry });
        const key = menu.onKey, retry = menu.buttons.find(button => button.textContent === 'Retry checkpoint').onclick;
        menu.close();
        key(new KeyboardEvent('keydown', { key: 'Escape' })); retry();
        expect(onResume).not.toHaveBeenCalled(); expect(onRetry).not.toHaveBeenCalled();
    });

    test('one synchronous action cannot re-enter another menu command', () => {
        const onExit = jest.fn();
        let menu;
        const onRetry = jest.fn(() => menu.buttons.at(-1).onclick());
        menu = new Menu({ onRetry, onExit });
        try {
            menu.buttons.find(button => button.textContent === 'Retry checkpoint').onclick();
            expect(onRetry).toHaveBeenCalledTimes(1); expect(onExit).not.toHaveBeenCalled();
            expect(menu.buttons.every(button => !button.disabled)).toBe(true);
        } finally { menu.close(); }
    });

    test('normal Resume still clears pause and restores controls', () => {
        const f = fixture();
        try {
            f.button('Resume').onclick();
            expect(f.scene.pauseMenuActive).toBe(false); expect(f.world.isPaused).toBe(false);
            expect(f.clock.paused).toBe(false); expect(f.scene.encounter.paused).toBe(false);
            expect(f.scene.showPlatformerMobileControls).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });
});
