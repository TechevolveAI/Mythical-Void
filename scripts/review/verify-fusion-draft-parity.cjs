// Compare actual hatch methods without creating a Phaser Game or Scene runtime.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { readPinnedSource } = require('../../src/__tests__/support/pinnedSourceFixture.cjs');

assert.equal(globalThis[Symbol.for('mythical.privateBaseline.networkDenied')], true, 'Preload the offline network guard');
assert.equal(process.argv.length, 2, 'NO_EXTRA_ARGUMENTS');
const root = path.resolve(__dirname, '../..');
const baselineCommit = 'f900a4a110d06705d639e5fd9ce8ece2853ccd9b';
const sceneFile = 'src/scenes/BreedingHatchScene.js';
const builderFile = 'src/systems/FusionOffspringDraft.js';
const git = args => execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, encoding: 'utf8',
    env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } });
const baseline = readPinnedSource(`${baselineCommit}:${sceneFile}`);
const candidate = readFileSync(path.join(root, sceneFile), 'utf8');
const builder = readFileSync(path.join(root, builderFile), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));

function body(source) {
    return parse(source, { sourceType: 'module' }).program.body.filter(node => node.type !== 'ImportDeclaration' &&
        node.type !== 'ExportDefaultDeclaration').map(node => {
        const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
        assert(declaration, 'Unexpected re-export');
        return source.slice(declaration.start, declaration.end);
    }).join('\n');
}

function fixture(source, kind, rarity, mode) {
    let clockCalls = 0;
    class Clock extends Date { static now() { return 1000000 + clockCalls++; } }
    const scope = { window: { Phaser: { Scene: class {} } }, console: { log() {} }, Date: Clock };
    vm.runInNewContext(`${body(builder)}\n${body(source)}\nthis.Scene = BreedingHatchScene;`, scope, { timeout: 1000 });
    const scene = new scope.Scene();
    const genes = index => ({ id: `fictional-genes-${index}`, species: 'stellarWyrm',
        cosmicAffinity: { element: 'moon', strength: 0.6 }, traits: { colour: 0x123456 },
        metadata: { synthetic: true } });
    const offspring = index => mode === 'missing' ? undefined : mode === 'null' ? null : {
        creatureId: `fictional-child-${index}`, rarity,
        ...(mode === 'enriched' ? { generation: 4, parentIds: ['fictional-parent-a', 'fictional-parent-b'],
            offspringBonus: { cosmicPower: 1.2 }, birthEvents: [{ id: 'fictional-event' }],
            secretAbilities: ['fictional-ability'], isShiny: true, hasDualAffinity: true,
            dualAffinity: ['moon', 'sun'] } : {})
    };
    scene.fusionTransaction = { operationId: 'fictional-operation' };
    scene.offspringGenes = mode === 'missing' ? undefined : genes(0);
    scene.offspringData = offspring(0);
    scene.offspringName = mode === 'missing' ? '' : '  Fictional <child>  ';
    scene.offspringTextureName = mode === 'enriched' ? 'fictional-texture' : '';
    scene.twin1 = { offspringGenes: genes(1), offspringData: offspring(1) };
    scene.twin2 = { offspringGenes: genes(2), offspringData: offspring(2) };
    scene.twin1Name = mode === 'missing' ? '' : 'First <fiction>';
    scene.twin2Name = mode === 'missing' ? '' : 'Second <fiction>';
    scene.twin1TextureName = mode === 'enriched' ? 'fictional-texture-1' : null;
    scene.twin2TextureName = mode === 'enriched' ? 'fictional-texture-2' : undefined;
    scene.scale = { width: 390, height: 844 };
    scene.clearNamingControls = () => {};
    let destroyed = 0, captured;
    const status = { setOrigin() { return this; }, setDepth() { return this; }, destroy() { destroyed++; } };
    scene.add = { text: () => status };
    scene.commitFusionCreatures = async creatures => {
        captured = creatures;
        return { success: false, cancelled: true, reason: 'synthetic-stop-after-draft' };
    };
    return { async run() {
        await scene[kind === 'single' ? 'completeBreeding' : 'completeTwinBreeding']();
        assert(captured, 'Hatch method did not reach the existing transaction boundary');
        return copy({ creatures: captured, fields: captured.map(Object.keys),
            aliases: captured.map(creature => creature.genes === creature.dna),
            clockCalls, destroyed, completed: scene.completionSubmitted });
    } };
}

async function run() {
    const cases = [];
    for (const kind of ['single', 'twins']) for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary']) {
        for (const mode of ['defaults', 'enriched', 'missing', 'null']) {
            const expected = await fixture(baseline, kind, rarity, mode).run();
            const actual = await fixture(candidate, kind, rarity, mode).run();
            assert.deepEqual(actual, expected, `${kind}/${rarity}/${mode}`);
            assert.equal(actual.clockCalls, kind === 'single' ? 1 : 2);
            assert.equal(actual.destroyed, 1);
            assert(actual.aliases.every(Boolean));
            cases.push({ kind, rarity, mode, recordCount: actual.creatures.length,
                draftsSha256: hash(JSON.stringify(actual.creatures)), fieldsEqual: true,
                aliasesEqual: true, clockCallsEqual: true });
        }
    }
    assert.equal(hash(readFileSync(path.join(root, sceneFile))), hash(candidate), 'Scene changed during comparison');
    assert.equal(hash(readFileSync(path.join(root, builderFile))), hash(builder), 'Builder changed during comparison');
    const report = { sourceCommit: git(['rev-parse', 'HEAD']).trim(),
        dirtyCheckout: git(['status', '--porcelain']).trim() !== '', baselineCommit,
        baselineSceneSha256: hash(baseline), candidateSceneSha256: hash(candidate), builderSha256: hash(builder),
        casesPassed: cases.length, recordsCompared: cases.reduce((sum, item) => sum + item.recordCount, 0),
        cases, browserOpened: false, gameStarted: false, savesWritten: false,
        limits: 'Draft construction parity only; not durable save, hosted finalization, visual or phone acceptance' };
    const output = mkdtempSync(path.join(os.tmpdir(), 'mythical-fusion-draft-parity-'));
    writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ output, sourceCommit: report.sourceCommit, dirtyCheckout: report.dirtyCheckout,
        casesPassed: cases.length, recordsCompared: report.recordsCompared, fieldsEqual: true, clockCallsEqual: true }));
}

run().catch(error => { console.error(error); process.exitCode = 1; });
