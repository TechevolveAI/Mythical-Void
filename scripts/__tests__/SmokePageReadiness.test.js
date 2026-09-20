const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { smokePageReady } = require('../lib/smoke-page-readiness.cjs');

function page(overrides = {}) {
    return {
        document: { readyState: 'complete' },
        mythicalGame: { scene: {}, renderer: {}, scale: {} },
        ...overrides
    };
}

test('the departing document cannot pass even if a late boot recreates its game', () => {
    const old = page({ __mythicalSmokeLeavingDocument: true });
    expect(smokePageReady(old)).toBe(false);
    old.mythicalGame = { scene: {}, renderer: {}, scale: {} };
    expect(smokePageReady(old)).toBe(false);
    expect(smokePageReady(page())).toBe(true);
});

test.each([
    { document: { readyState: 'loading' } },
    { document: { readyState: 'interactive' } },
    { mythicalGame: undefined },
    { mythicalGame: null },
    { mythicalGame: { scene: {} } },
    { mythicalGame: { scene: {}, renderer: {} } }
])('incomplete next-document boot remains pending: %j', overrides => {
    expect(smokePageReady(page(overrides))).toBe(false);
});

test('the exact browser expression has no dependency on Node scope', () => {
    const expression = `(${smokePageReady.toString()})(window)`;
    expect(vm.runInNewContext(expression, { window: page() })).toBe(true);
    expect(vm.runInNewContext(expression, {
        window: page({ __mythicalSmokeLeavingDocument: true })
    })).toBe(false);
});

test('navigation marks the old page before navigating and retains renderer assertions', () => {
    const source = fs.readFileSync(path.join(__dirname, '../smoke-secondary-journeys.js'), 'utf8');
    const navigate = source.slice(source.indexOf('async function navigate('), source.indexOf('async function waitForScene('));
    expect(navigate.indexOf('window.__mythicalSmokeLeavingDocument = true'))
        .toBeLessThan(navigate.indexOf("session.call('Page.navigate'"));
    expect(navigate).toContain('smokePageReady.toString()');
    expect(navigate).toContain('timeoutMs: 15000');
    expect(navigate).toContain('!renderer.webgl || !renderer.name || /swiftshader/i.test(renderer.name)');
    expect(navigate).toContain("throw new Error('Native OpenGL smoke did not receive its required WebGL renderer')");
});
