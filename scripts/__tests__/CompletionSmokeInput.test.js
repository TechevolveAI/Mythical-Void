const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');

const source = fs.readFileSync(path.join(__dirname, '../smoke-secondary-journeys.js'), 'utf8');
const ast = parse(source, { sourceType: 'script' });

describe.each(['touchSceneText', 'touchInteractiveSceneText', 'touchDomButton'])('%s native input', name => {
    test.each([390, 1280])('uses the enabled browser input at %ipx', async width => {
        const fn = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
        const touch = jest.fn();
        const tap = jest.fn();
        const context = {
            SMOKE_VIEWPORT_WIDTH: width, touch, tap,
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
    const scene = { scale: { width: 1280, height: 720 }, input: { _list: [] } };
    const target = {
        scene, text: 'SKIP', visible: true, alpha: 1, depth: 10,
        input: { enabled: true },
        getBounds: () => ({ centerX: 80, centerY: 100, left: 50, top: 80, right: 110, bottom: 120 })
    };
    scene.children = { list: [target] };
    const browser = { window: { mythicalGame: { scene: { getScenes: () => [scene] } } } };
    const tap = jest.fn();
    const run = vm.runInNewContext(`(${source.slice(fn.start, fn.end)})`, {
        SMOKE_VIEWPORT_WIDTH: 1280, tap, touch: jest.fn(),
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
