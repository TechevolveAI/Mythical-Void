const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');

const source = fs.readFileSync(path.join(__dirname, '../smoke-secondary-journeys.js'), 'utf8');
const ast = parse(source, { sourceType: 'script' });
const pointFn = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'sceneTextScreenPoint');
const pointSource = source.slice(pointFn.start, pointFn.end);
const sceneTextScreenPoint = vm.runInNewContext(`(${pointSource})`);

describe('Forest completion opening clock', () => {
    const fn = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'waitForForestGuardianOpening');
    function fixture(states) {
        let wall = 0;
        let reads = 0;
        const evaluate = jest.fn(async (_session, expression) => {
            if (expression.includes('return {')) return states[Math.min(reads++, states.length - 1)];
        });
        const run = vm.runInNewContext(`(${source.slice(fn.start, fn.end)})`, {
            evaluate, Date: { now: () => wall }, WAIT_STEP_MS: 100,
            delay: async () => { wall += 15000; }, console: { log: jest.fn() }
        });
        return { run, evaluate };
    }
    const waiting = { elapsed: 500, ready: false, dead: false, active: true, attacks: 0, fps: 7 };

    test('slow rendering must still earn a real opening within the simulation budget', async () => {
        const f = fixture([waiting, { ...waiting, elapsed: 4300, ready: true, attacks: 1 }]);
        await expect(f.run({})).resolves.toMatchObject({ ready: true, elapsed: 4300 });
        expect(f.evaluate.mock.calls[0][1]).toContain('addEvent({ delay: 12000 })');
        expect(f.evaluate.mock.calls.at(-1)[1]).toContain('delete scene.completionOpeningProbe');
        expect(f.evaluate.mock.calls.some(([, text]) => /isRecovering\s*=/.test(text))).toBe(false);
    });
    test.each([
        ['no attack', { ...waiting, elapsed: 12000 }],
        ['too late', { ...waiting, elapsed: 12000, ready: true }],
        ['player dead', { ...waiting, dead: true }],
        ['encounter stopped', { ...waiting, active: false }],
        ['clock stalled', waiting]
    ])('fails and cleans up when %s', async (_name, state) => {
        const f = fixture([state]);
        await expect(f.run({})).rejects.toThrow('earned recovery opening unavailable');
        expect(f.evaluate.mock.calls.at(-1)[1]).toContain('completionOpeningProbe?.remove?.()');
    });
});

describe.each(['touchSceneText', 'touchInteractiveSceneText', 'touchDomButton'])('%s native input', name => {
    test.each([390, 1280])('uses the enabled browser input at %ipx', async width => {
        const fn = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
        const touch = jest.fn();
        const tap = jest.fn();
        const context = {
            SMOKE_VIEWPORT_WIDTH: width, touch, tap, sceneTextScreenPoint,
            waitFor: async () => ({ x: 80, y: 100 }),
            evaluate: jest.fn()
        };
        const run = vm.runInNewContext(`(${source.slice(fn.start, fn.end)})`, context);
        await run({}, 'action');
        expect(width <= 600 ? touch : tap).toHaveBeenCalledWith({}, 80, 100);
        expect(width <= 600 ? tap : touch).not.toHaveBeenCalled();
    });
});

test('a new Phaser control must enter the live hit-test list before clicking', async () => {
    const fn = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'touchInteractiveSceneText');
    const scene = {
        scale: { width: 1280, height: 720 }, input: { _list: [] },
        cameras: { main: { scrollX: 5000, scrollY: 500, matrix: { transformPoint: (x, y) => ({ x, y }) } } },
        game: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } }
    };
    const target = {
        scene, text: 'SKIP', visible: true, alpha: 1, depth: 10, scrollFactorX: 0, scrollFactorY: 0,
        input: { enabled: true },
        getBounds: () => ({ centerX: 80, centerY: 100, left: 50, top: 80, right: 110, bottom: 120 })
    };
    scene.children = { list: [target] };
    const browser = { window: { innerWidth: 1280, innerHeight: 720, mythicalGame: { scene: { getScenes: () => [scene] } } } };
    const tap = jest.fn();
    const run = vm.runInNewContext(`(${source.slice(fn.start, fn.end)})`, {
        SMOKE_VIEWPORT_WIDTH: 1280, tap, touch: jest.fn(), sceneTextScreenPoint,
        evaluate: async (_session, expression) => vm.runInNewContext(expression, browser),
        waitFor: async read => {
            expect(await read()).toBeNull();
            expect(tap).not.toHaveBeenCalled();
            scene.input._list.push(target);
            return read();
        }
    });
    await run({}, 'SKIP');
    expect(tap).toHaveBeenCalledWith({}, 80, 100);
});

test('click point follows camera zoom, scroll factor and CSS canvas scaling', () => {
    const project = vm.runInNewContext(`(${pointSource})`, { window: { innerWidth: 1280, innerHeight: 720 } });
    const target = {
        text: 'SKIP', scrollFactorX: 0, scrollFactorY: 0,
        getBounds: () => ({ left: 100, right: 140, top: 100, bottom: 120, centerX: 120, centerY: 110 }),
        scene: {
            scale: { width: 640, height: 360 },
            cameras: { main: { scrollX: 5000, scrollY: 800, matrix: { transformPoint: (x, y) => ({ x: x * 1.05 - 16, y: y * 1.05 - 9 }) } } },
            game: { canvas: { getBoundingClientRect: () => ({ left: 20, top: 10, width: 960, height: 540 }) } }
        }
    };
    expect(project(target)).toMatchObject({ x: 185, y: 170 });
    target.scene.cameras.main.shakeEffect = { isRunning: true };
    expect(project(target)).toBeNull();
    target.scene.cameras.main.shakeEffect.isRunning = false;
    target.scene.tweens = { getTweensOf: () => [{ isPlaying: () => true }] };
    expect(project(target)).toBeNull();
    target.scene.tweens.getTweensOf = () => [];
    expect(project(target)).toMatchObject({ x: 185, y: 170 });
    target.scrollFactorX = 1;
    expect(project(target)).toBeNull();
});

test.each(['clean', 'unresponsive'])('browser cleanup retires a %s browser before the next journey', async state => {
    const fn = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'closeSmokeBrowser');
    const chrome = { exitCode: null, signalCode: null, unref: jest.fn() };
    chrome.kill = jest.fn(signal => { chrome.signalCode = signal; });
    const session = { close: jest.fn(), call: jest.fn(async () => {
        if (state === 'clean') chrome.exitCode = 0;
        else throw new Error('browser unresponsive');
    }) };
    const close = vm.runInNewContext(`(${source.slice(fn.start, fn.end)})`, { delay: async () => {} });
    await close(session, chrome);
    expect(session.call).toHaveBeenCalledWith('Browser.close');
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(chrome.kill).toHaveBeenCalledTimes(state === 'clean' ? 0 : 1);
    expect(chrome.unref).toHaveBeenCalledTimes(1);
});

test('closing CDP rejects pending work and clears its timers', async () => {
    const node = ast.program.body.find(item => item.type === 'ClassDeclaration' && item.id.name === 'CdpSession');
    const socket = { send: jest.fn(), close: jest.fn() };
    const clear = jest.fn();
    const CdpSession = vm.runInNewContext(`(${source.slice(node.start, node.end)})`, {
        WebSocket: function () { return socket; }, CDP_TIMEOUT_MS: 10000,
        setTimeout: () => 23, clearTimeout: clear
    });
    const session = new CdpSession('local');
    const pending = session.call('Browser.close');
    session.close();
    await expect(pending).rejects.toThrow('CDP session closed');
    expect(clear).toHaveBeenCalledWith(23);
    expect(session.pending.size).toBe(0);
    expect(socket.close).toHaveBeenCalledTimes(1);
});
