const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
let compiled;

// Run the real compiler in Node's native realm, not jsdom's Uint8Array realm.
// Compilation is guarded and does not execute the game or generated module.
function compile(input) {
    const result = spawnSync(process.execPath, ['--require', path.join(root, 'scripts/review/deny-baseline-network.cjs'), '-e', `
        const fs = require('node:fs'), path = require('node:path'), { buildSync } = require('esbuild');
        const input = JSON.parse(fs.readFileSync(0, 'utf8'));
        process.stdout.write(buildSync({ stdin: { contents: input.source ?? fs.readFileSync(input.file, 'utf8') + input.append,
            resolveDir: input.file ? path.dirname(input.file) : input.resolveDir, sourcefile: input.file || 'synthetic-fixture.js' },
            define: { 'import.meta.env.DEV': 'false', 'import.meta.env.MODE': '"production"' },
            bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' }).outputFiles[0].text);
    `], { cwd: root, env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', NODE_ENV: 'test', CI: '1' },
        input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw result.error || Error(result.stderr || 'INVENTORY_TEST_COMPILATION_FAILED');
    return result.stdout;
}

function compiledModuleSource(relative, append = '') {
    return compile({ file: path.join(root, 'src', relative), append });
}

function compiledTestEntrySource(source) { return compile({ source, resolveDir: root }); }

function compiledInventorySource(mode = 'singleton') {
    if (!compiled) compiled = compiledModuleSource('systems/InventoryManager.js', '\nexport { InventoryManager };');
    if (mode === 'both') return compiled;
    if (mode === 'singleton') return compiled + '\nmodule.exports = module.exports.default;';
    throw Error('UNKNOWN_INVENTORY_TEST_EXPORT');
}

module.exports = { compiledInventorySource, compiledModuleSource, compiledTestEntrySource };
