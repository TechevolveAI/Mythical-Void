const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');

const folder = path.join(__dirname, 'fixtures/pinned-source');
const reader = () => require('./support/pinnedSourceFixture.cjs').readPinnedSource;
const manifest = () => JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));

function visit(node, callback) {
    if (!node || typeof node !== 'object') return;
    callback(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(item => visit(item, callback));
        else if (value && typeof value === 'object') visit(value, callback);
    }
}

describe('historical regression controls survive a checkout without private Git history', () => {
    afterEach(() => jest.restoreAllMocks());

    test('every declared baseline has its exact bytes and full source provenance', () => {
        const data = manifest();
        expect(data.schemaVersion).toBe(1);
        expect(data.entries.length).toBeGreaterThan(0);
        expect(new Set(data.entries.map(entry => entry.reference)).size).toBe(data.entries.length);
        for (const entry of data.entries) {
            expect(entry.commit).toMatch(/^[a-f0-9]{40}$/);
            expect(entry.commit.startsWith(entry.reference.split(':')[0])).toBe(true);
            expect(entry.path).toBe(entry.reference.split(':')[1]);
            expect(reader()(entry.reference)).toBe(fs.readFileSync(path.join(folder, entry.fixture), 'utf8'));
        }
        expect(fs.readdirSync(folder).filter(file => file.endsWith('.source')).sort()).toEqual(
            [...new Set(data.entries.map(entry => entry.fixture))].sort());
    });

    test.each(['unknown:src/systems/GameState.js', '00000000:src/systems/GameState.js',
        '5adcb023:../../private', '../manifest.json', null])('unknown reference %p fails closed', reference => {
        expect(() => reader()(reference)).toThrow(/PINNED_SOURCE_/);
    });

    test('a missing baseline cannot fall back to local history or the current implementation', () => {
        const entry = manifest().entries[0], original = fs.readFileSync;
        jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
            if (file === path.join(folder, entry.fixture)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
            return original(file, ...args);
        });
        expect(() => reader()(entry.reference)).toThrow(/PINNED_SOURCE_MISSING/);
    });

    test('a same-length byte change fails its checksum rather than changing the control', () => {
        const entry = manifest().entries[0], original = fs.readFileSync;
        jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
            const value = original(file, ...args);
            if (file !== path.join(folder, entry.fixture)) return value;
            const changed = Buffer.from(value); changed[0] ^= 1; return changed;
        });
        expect(() => reader()(entry.reference)).toThrow(/PINNED_SOURCE_CHANGED/);
    });

    test('regression tests and their adapters do not read source using git show', () => {
        const files = [];
        const collect = directory => {
            for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
                const file = path.join(directory, item.name);
                if (item.isDirectory() && item.name !== 'fixtures') collect(file);
                else if (item.isFile() && /\.(js|cjs)$/.test(item.name)) files.push(file);
            }
        };
        collect(__dirname);
        const lookups = [];
        for (const file of files) {
            const tree = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'unambiguous' });
            visit(tree, node => {
                if (node.type !== 'CallExpression' || node.callee.name !== 'execFileSync') return;
                const [command, args] = node.arguments;
                if (!['git', '/usr/bin/git'].includes(command?.value) || args?.type !== 'ArrayExpression') return;
                if (args.elements.some(item => item?.value === 'show')) lookups.push(path.relative(__dirname, file));
            });
        }
        expect(lookups).toEqual([]);
    });
});
