const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { parse } = require('@babel/parser');
const root = path.resolve(__dirname, '../..');

function compile(production) {
    const result = spawnSync(process.execPath, ['--require', path.join(root, 'scripts/review/deny-baseline-network.cjs'), '-e', `
        const fs = require('node:fs'), { buildSync } = require('esbuild');
        const production = JSON.parse(fs.readFileSync(0, 'utf8'));
        const file = 'src/systems/InventoryManager.js';
        process.stdout.write(buildSync({ stdin: { contents: fs.readFileSync(file, 'utf8') + '\\nexport { InventoryManager };',
            sourcefile: file, resolveDir: require('node:path').resolve('src/systems') },
            bundle: true, write: false, platform: 'node', format: 'cjs', minify: production,
            pure: production ? ['console.log', 'console.info', 'console.debug'] : [], logLevel: 'silent'
        }).outputFiles[0].text);
    `], { cwd: root, env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', NODE_ENV: 'test', CI: '1' },
        input: JSON.stringify(production), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw result.error || Error(result.stderr);
    return result.stdout;
}

function callNames(code) {
    const names = [];
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
            node.callee.object.name === 'console') names.push(node.callee.property.name);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    }
    visit(parse(code, { sourceType: 'script' })); return names;
}

function exercise(code) {
    const clone = value => JSON.parse(JSON.stringify(value));
    const logs = [], warnings = [], effects = [], saved = { 'hubWorld.shipParts.collected': [] };
    const scope = { module: { exports: {} }, exports: {},
        Phaser: { Events: { EventEmitter } },
        Date: class extends Date { static now() { return 1700000000777; } },
        console: { log: (...args) => { logs.push(args); return 'not-a-domain-result'; },
            warn: (...args) => warnings.push(args), error: (...args) => effects.push(['error', args]) },
        window: { GameState: { get: key => saved[key],
            set: (key, value) => { saved[key] = value; effects.push(['write', key, clone(value)]); },
            save: () => effects.push(['save']) },
            AudioManager: { playAchievement: () => effects.push(['notification']) } }
    };
    vm.runInNewContext(code, scope, { timeout: 1000 });
    const manager = new scope.module.exports.InventoryManager();
    for (const event of ['itemAdded', 'inventoryFull', 'shipPartCollected']) manager.events.on(event,
        data => effects.push(['event', event, data === undefined ? null : clone(data)]));
    const item = { id: 'synthetic-cell', name: 'Fictional cell', type: 'food' };
    const accepted = [manager.addItem(item), manager.addItem(item), manager.addShipPart('crystal_core'),
        manager.addShipPart('crystal_core'), manager.addItem(null), manager.addShipPart('synthetic-unknown')];
    manager.maxSlots = 0;
    accepted.push(manager.addItem({ ...item, id: 'synthetic-other' }));
    return { accepted, inventory: clone(manager.inventory), saved: clone(saved), effects, logs, warnings };
}

describe('actual inventory callbacks satisfy the unchanged production logging policy', () => {
    const development = compile(false), production = compile(true);

    test('production compilation removes debug calls hidden inside callback values', () => {
        expect(callNames(production).filter(name => ['log', 'info', 'debug'].includes(name))).toEqual([]);
        expect(callNames(production)).toContain('warn');
    });

    test('development keeps diagnostics while production keeps warnings without debug output', () => {
        const before = exercise(development), after = exercise(production);
        expect(before.logs).toHaveLength(4);
        expect(after.logs).toEqual([]);
        expect(after.warnings).toEqual(before.warnings);
        expect(after.warnings).toHaveLength(3);
    });

    test('minification preserves item stacking, ship parts, refusal, notifications, writes and events', () => {
        const before = exercise(development), after = exercise(production);
        const { logs: beforeLogs, ...expected } = before, { logs: afterLogs, ...actual } = after;
        expect(actual).toEqual(expected);
        expect(actual.accepted).toEqual([true, true, true, false, false, false, false]);
        expect(actual.inventory).toHaveLength(1);
        expect(actual.inventory[0]).toMatchObject({ id: 'synthetic-cell', quantity: 2, slot: 0, addedAt: 1700000000777 });
        expect(actual.saved['hubWorld.shipParts.collected']).toEqual(['crystal_core']);
        expect(actual.effects.filter(entry => entry[0] === 'save')).toHaveLength(3);
        expect(actual.effects.filter(entry => entry[0] === 'notification')).toHaveLength(1);
    });
});
