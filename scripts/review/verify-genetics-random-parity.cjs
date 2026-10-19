// Offline comparison only. This VM fixture is not a game or backend execution path.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');
const vm = require('node:vm');
const { readPinnedSource } = require('../../src/__tests__/support/pinnedSourceFixture.cjs');

assert.equal(globalThis[Symbol.for('mythical.privateBaseline.networkDenied')], true,
    'Preload scripts/review/deny-baseline-network.cjs');
const { values } = parseArgs({ options: { output: { type: 'string' } }, allowPositionals: false });
const root = path.resolve(__dirname, '../..');
const baselineCommit = 'c92119e2e0a68f230cdeee26dfd487bfbded86d7';
const moduleFile = 'src/systems/CreatureGenetics.js';
const breedingModuleFile = 'src/systems/BreedingEngine.js';
const git = args => execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, encoding: 'utf8',
    env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } });
const baselineSource = readPinnedSource(`${baselineCommit}:${moduleFile}`);
const candidateSource = readFileSync(path.join(root, moduleFile), 'utf8');
const baselineBreedingSource = readPinnedSource(`${baselineCommit}:${breedingModuleFile}`);
const candidateBreedingSource = readFileSync(path.join(root, breedingModuleFile), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const previous = globalThis.FusionAuthority;
const { FusionAuthority } = require('../../src/systems/FusionAuthority.js');
if (previous === undefined) delete globalThis.FusionAuthority;
else globalThis.FusionAuthority = previous;
const authority = new FusionAuthority();

function fixture(source, seed, uuidSupport, explicit = false, breedingSource = candidateBreedingSource) {
    const random = authority.createSeededRandom(seed);
    let draws = 0, clock = 1000000, ids = 0;
    const sample = () => { draws++; return random(); };
    const math = Object.create(Math);
    math.random = explicit ? () => { throw Error('AMBIENT_RANDOM_FORBIDDEN'); } : sample;
    class Clock extends Date { static now() { return clock++; } }
    const events = [];
    const scope = { module: { exports: {} }, Math: math, Date: Clock,
        window: { GameState: { emit: (...args) => events.push(copy(args)) } },
        console: { log() {}, warn() {} },
        crypto: uuidSupport ? { randomUUID: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}` } : {} };
    vm.runInNewContext(source, scope, { timeout: 1000 });
    const generator = new scope.module.exports(explicit ? { random: sample } : undefined);
    scope.window.CreatureGenetics = generator;
    scope.module = { exports: {} };
    vm.runInNewContext(breedingSource, scope, { timeout: 1000 });
    return { generator, engine: new scope.module.exports.BreedingEngine(), events, draws: () => draws };
}

const species = Object.keys(fixture(baselineSource, 'synthetic-catalogue', true).generator.speciesTemplates);
assert.deepEqual(Object.keys(fixture(candidateSource, 'synthetic-catalogue', true).generator.speciesTemplates), species);
const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const cases = [];
for (const uuidSupport of [true, false]) for (const kind of [...species, null]) {
    for (const rarity of rarities) for (let sampleIndex = 0; sampleIndex < 3; sampleIndex++) {
        const seed = `synthetic-parity:${kind || 'weighted-selection'}:${rarity}:${sampleIndex}`;
        const baseline = fixture(baselineSource, seed, uuidSupport, false, baselineBreedingSource);
        const candidate = fixture(candidateSource, seed, uuidSupport);
        const isolated = fixture(candidateSource, seed, uuidSupport, true);
        if (kind) for (const item of [baseline, candidate, isolated]) item.generator.selectSpecies = () => kind;
        const expected = copy(baseline.generator.generateCreatureGenetics(rarity));
        assert.deepEqual(copy(candidate.generator.generateCreatureGenetics(rarity)), expected, `${seed}: default profile`);
        assert.deepEqual(copy(isolated.generator.generateCreatureGenetics(rarity)), expected, `${seed}: isolated profile`);
        const parents = [
            [{ type: 'crystal_growth', variant: 'small', dominance: 0.8, intensity: 0.6 }],
            [{ type: 'extra_eyes', variant: 'paired', dominance: 0.7, intensity: 0.5 }]
        ];
        const before = copy(parents);
        const inherited = copy(baseline.generator.inheritWackyMutations(...parents, rarity));
        assert.deepEqual(copy(candidate.generator.inheritWackyMutations(...parents, rarity)), inherited, `${seed}: default mutations`);
        assert.deepEqual(copy(isolated.generator.inheritWackyMutations(...parents, rarity)), inherited, `${seed}: isolated mutations`);
        assert.deepEqual(parents, before, `${seed}: changed parent mutations`);
        const genome = Object.fromEntries(Object.entries(baseline.engine.traitDefinitions).map(([key, trait]) => {
            const alleles = Object.keys(trait.variations);
            return [key, [alleles[0], alleles.at(-1)]];
        }));
        const phenotype = baseline.engine.getPhenotype(genome);
        const visualParents = { parent1: { traits: { features: { wackyMutations: parents[0] } } },
            parent2: { traits: { features: { wackyMutations: parents[1] } } } };
        const expectedVisuals = copy(baseline.engine.getVisualConfigFromPhenotype(phenotype, visualParents, rarity));
        assert.deepEqual(copy(candidate.engine.getVisualConfigFromPhenotype(phenotype, visualParents, rarity)),
            expectedVisuals, `${seed}: default breeding visuals`);
        assert.deepEqual(copy(isolated.engine.getVisualConfigFromPhenotype(phenotype, visualParents, rarity, {
            inheritMutations: (data, tier) => isolated.generator.inheritWackyMutations(
                data.parent1.traits.features.wackyMutations, data.parent2.traits.features.wackyMutations, tier)
        })), expectedVisuals, `${seed}: explicit breeding visuals`);
        for (const actual of [candidate, isolated]) {
            assert.deepEqual(actual.events, baseline.events, `${seed}: generation events`);
            assert.equal(actual.draws(), baseline.draws(), `${seed}: random draw order`);
        }
        cases.push({ uuidSupport, forcedSpecies: kind, rarity, sampleIndex,
            profileSha256: hash(JSON.stringify(expected)), randomDraws: baseline.draws(),
            fullProfileEqual: true, mutationsEqual: true, eventsEqual: true, breedingVisualsEqual: true });
    }
}
assert.equal(hash(readFileSync(path.join(root, moduleFile))), hash(candidateSource), 'Source changed during comparison');
assert.equal(hash(readFileSync(path.join(root, breedingModuleFile))), hash(candidateBreedingSource), 'Breeding source changed during comparison');
const report = { sourceCommit: git(['rev-parse', 'HEAD']).trim(), dirtyCheckout: git(['status', '--porcelain']).trim() !== '',
    baselineCommit, moduleFile, baselineSourceSha256: hash(baselineSource), candidateSourceSha256: hash(candidateSource),
    breedingModuleFile, baselineBreedingSourceSha256: hash(baselineBreedingSource), candidateBreedingSourceSha256: hash(candidateBreedingSource),
    species, rarities, casesPassed: cases.length, defaultPathEqual: true, explicitSourceEqual: true,
    breedingVisualsEqual: true, clockAndUuid: 'Synthetic VM fixtures only; no production identity or time change',
    limits: 'Not rendered appearance, device acceptance, durable Fusion or migration qualification',
    browserOpened: false, serverStarted: false, providerRequests: 0, playerRecordsUsed: false, cases };
const output = values.output ? path.resolve(values.output) : mkdtempSync(path.join(os.tmpdir(), 'mythical-genetics-random-parity-'));
if (values.output) mkdirSync(output, { recursive: false });
writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, sourceCommit: report.sourceCommit, dirtyCheckout: report.dirtyCheckout,
    casesPassed: cases.length, defaultPathEqual: true, explicitSourceEqual: true, browserOpened: false }));
