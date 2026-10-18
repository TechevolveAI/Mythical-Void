const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const guard = path.join(__dirname, 'deny-baseline-network.cjs');

async function run() {
    assert(process.argv.length <= 3 && (!process.argv[2] || process.argv[2] === '--worker'), 'NO_EXTRA_ARGUMENTS');
    if (process.argv[2] !== '--worker') {
        // Service credentials and active backend choices are not inherited by tests.
        const result = spawnSync(process.execPath, ['--require', guard, __filename, '--worker'], {
            cwd: root, env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', NODE_ENV: 'test', CI: '1' },
            stdio: 'inherit'
        });
        if (result.error) throw result.error;
        process.exitCode = result.status ?? 1;
        return;
    }
    assert.equal(globalThis[Symbol.for('mythical.privateBaseline.networkDenied')], true);
    await assert.rejects(fetch('https://invalid.example'), /PRIVATE_BASELINE_NETWORK_DENIED/);
    assert.throws(() => require('node:https').get('https://invalid.example'), /PRIVATE_BASELINE_NETWORK_DENIED/);
    assert.throws(() => require('node:net').createConnection({ port: 1 }), /PRIVATE_BASELINE_NETWORK_DENIED/);
    assert.deepEqual(Object.keys(process.env).filter(key => /^(VITE_|SUPABASE|NETLIFY|REPLICATE|GEMINI|FIREBASE|GOOGLE_)/.test(key)), []);
    const { build } = require('esbuild');
    const result = await build({ absWorkingDir: root, entryPoints: ['src/main.js'], bundle: true,
        write: false, metafile: true, packages: 'external', format: 'esm', outdir: 'unused', logLevel: 'silent',
        loader: { '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.webp': 'file', '.svg': 'file', '.woff2': 'file' },
        plugins: [{ name: 'public-css-assets', setup(api) {
            api.onResolve({ filter: /^\// }, args => args.kind === 'url-token' ? { path: args.path, external: true } : undefined);
        } }] });
    const inputs = Object.keys(result.metafile.inputs);
    assert(inputs.includes('src/game.js') && inputs.includes('src/systems/GameState.js'));
    const held = /^src\/(?:__tests__\/|test-support\/|systems\/(?:AdventureGrowthPolicy|ChapterConclusionFlow|GuardianLineage|ForestLineageRenderer)\.js|ui\/ChapterConclusion|dev\/(?:PrivateReview|VisitingFusion|GuardianEggGrantProposal|GameHatchFieldMapping|Prepared(?:EarthDeparture|Ending|Stay)|assets\/endings\/|contracts\/))/;
    assert.deepEqual(inputs.filter(file => held.test(file)), [], 'Held features or test inputs entered the game graph');
    console.log(JSON.stringify({ check: 'isolated-release-baseline', sourceModules: inputs.length,
        networkDenied: true, inheritedServiceCredentials: false, heldFeaturesInGame: 0,
        browserOpened: false, gameStarted: false }));
    const tests = spawnSync(process.execPath, ['--require', guard,
        path.join(root, 'node_modules/jest/bin/jest.js'), '--runInBand', '--silent'], {
        cwd: root, env: process.env, stdio: 'inherit'
    });
    if (tests.error) throw tests.error;
    process.exitCode = tests.status ?? 1;
}

run().catch(error => { console.error(error); process.exitCode = 1; });
