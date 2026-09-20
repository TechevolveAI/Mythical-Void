const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { smokePageSnapshot } = require('../lib/smoke-page-readiness.cjs');

function page(overrides = {}) {
    return {
        document: { readyState: 'complete' },
        Phaser: { WEBGL: 2 },
        mythicalGame: {
            scene: {},
            renderer: { type: 2, gl: {
                getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }),
                getParameter: () => 'Mesa test renderer'
            } },
            scale: { width: 390, height: 844 }
        },
        ...overrides
    };
}

test('the departing document cannot pass even if a late boot recreates its game', () => {
    const old = page({ __mythicalSmokeLeavingDocument: true });
    expect(smokePageSnapshot(old)).toBeNull();
    old.mythicalGame = page().mythicalGame;
    expect(smokePageSnapshot(old)).toBeNull();
    expect(smokePageSnapshot(page())).toEqual({ webgl: true, name: 'Mesa test renderer', width: 390, height: 844 });
});

test.each([
    { document: { readyState: 'loading' } },
    { document: { readyState: 'interactive' } },
    { mythicalGame: undefined },
    { mythicalGame: null },
    { mythicalGame: { scene: {} } },
    { mythicalGame: { scene: {}, renderer: {} } }
])('incomplete next-document boot remains pending: %j', overrides => {
    expect(smokePageSnapshot(page(overrides))).toBeNull();
});

test('the exact browser expression has no dependency on Node scope', () => {
    const expression = `(${smokePageSnapshot.toString()})(window)`;
    expect(vm.runInNewContext(expression, { window: page() })).toEqual(smokePageSnapshot(page()));
    expect(vm.runInNewContext(expression, {
        window: page({ __mythicalSmokeLeavingDocument: true })
    })).toBeNull();
});

test('readiness and renderer metadata use one game read, not two browser calls', () => {
    const scope = page();
    const game = scope.mythicalGame;
    let reads = 0;
    Object.defineProperty(scope, 'mythicalGame', { get: () => ++reads === 1 ? game : undefined });
    expect(smokePageSnapshot(scope)).toEqual({ webgl: true, name: 'Mesa test renderer', width: 390, height: 844 });
    expect(reads).toBe(1);
    expect(smokePageSnapshot(scope)).toBeNull();
});

test('Canvas and unavailable renderer names remain visible to the strict native gate', () => {
    const scope = page();
    scope.mythicalGame.renderer = { type: 1 };
    expect(smokePageSnapshot(scope)).toMatchObject({ webgl: false, name: null });
});

test('navigation marks the old page before navigating and retains renderer assertions', () => {
    const source = fs.readFileSync(path.join(__dirname, '../smoke-secondary-journeys.js'), 'utf8');
    const navigate = source.slice(source.indexOf('async function navigate('), source.indexOf('async function waitForScene('));
    expect(navigate.indexOf('window.__mythicalSmokeLeavingDocument = true'))
        .toBeLessThan(navigate.indexOf("session.call('Page.navigate'"));
    expect(navigate).toContain('const renderer = await waitFor(');
    expect(navigate).toContain('smokePageSnapshot.toString()');
    expect(navigate).not.toContain('const renderer = await evaluate(');
    expect(navigate).toContain('timeoutMs: 15000');
    expect(navigate).toContain('!renderer.webgl || !renderer.name || /swiftshader/i.test(renderer.name)');
    expect(navigate).toContain("throw new Error('Native OpenGL smoke did not receive its required WebGL renderer')");
});
