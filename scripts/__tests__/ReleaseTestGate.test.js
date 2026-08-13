const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');

function read(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function findNumberedDuplicates(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return findNumberedDuplicates(target);
        return / \d+\.(?:[cm]?js)$/.test(entry.name) ? [target] : [];
    });
}

describe('release test gate', () => {
    test('npm test is finite and the manual framework has an explicit command', () => {
        const packageJson = JSON.parse(read('package.json'));

        expect(packageJson.scripts.test).toBe('jest --runInBand');
        expect(packageJson.scripts['test:unit']).toBe('jest --runInBand');
        expect(packageJson.scripts['test:manual']).toBe(
            'node ./scripts/serve-test-framework.js'
        );
    });

    test('does not admit numbered duplicate JavaScript tests', () => {
        expect(findNumberedDuplicates(path.join(rootDir, 'src/__tests__'))).toEqual([]);
    });

    test('keeps interaction and state-contract smoke claims separate', () => {
        const source = read('scripts/smoke-secondary-journeys.js');
        const interactionStart = source.indexOf("if (SMOKE_MODE === 'interaction')");
        const stateStart = source.indexOf("} else if (SMOKE_MODE === 'state-contract')");
        const interactionBranch = source.slice(interactionStart, stateStart);

        expect(interactionStart).toBeGreaterThan(-1);
        expect(stateStart).toBeGreaterThan(interactionStart);
        expect(interactionBranch).toContain('smokePurchasedEgg');
        expect(interactionBranch).toContain('smokeLevel');
        expect(interactionBranch).not.toContain('completeLevelProgression');
        expect(interactionBranch).not.toContain('installShipReconstructionStep');
        expect(source).toContain('does not claim that a player');
        expect(source).toContain('PASS CampaignStateContract');
        expect(source).not.toContain('PASS FullCampaignEnding');
    });

    test('requires touch movement and release assertions in interaction smoke', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain("Emulation.setTouchEmulationEnabled");
        expect(source).toContain('holdTouchDrag');
        expect(source).toContain('short jump tap response');
        expect(source).toContain('await touch(session, jumpControl.x, jumpControl.y);');
        expect(source).toContain('did not move right from touch input');
        expect(source).toContain('did not move left from touch input');
        expect(source).toContain('retained right input after touch release');
        expect(source).toContain('retained left input after touch release');
    });

    test('release smoke runs interaction before the state contract', () => {
        const source = read('scripts/run-browser-smoke.js');
        const villageUi = source.indexOf("SMOKE_MODE: 'village-ui'");
        const interaction = source.indexOf("SMOKE_MODE: 'interaction'");
        const stateContract = source.indexOf("SMOKE_MODE: 'state-contract'");
        const finalPriorityJourney = source.indexOf(
            "SMOKE_MODE: 'final-priority-journey'"
        );
        const saveReloadJourney = source.indexOf(
            "SMOKE_MODE: 'save-reload-journey'"
        );
        const navigationLifecycle = source.indexOf(
            "SMOKE_MODE: 'navigation-lifecycle'"
        );
        const hubForestTransition = source.indexOf(
            "SMOKE_MODE: 'hub-forest-transition'"
        );

        expect(villageUi).toBeGreaterThan(-1);
        expect(interaction).toBeGreaterThan(villageUi);
        expect(stateContract).toBeGreaterThan(interaction);
        expect(finalPriorityJourney).toBeGreaterThan(stateContract);
        expect(saveReloadJourney).toBeGreaterThan(finalPriorityJourney);
        expect(navigationLifecycle).toBeGreaterThan(saveReloadJourney);
        expect(hubForestTransition).toBeGreaterThan(navigationLifecycle);
        expect(source).toContain('for (const smokeCase of interactionCases)');
        expect(source).toContain('SMOKE_CASE: smokeCase');
        expect(source).toContain('failures.push(`interaction:${smokeCase}:');
        expect(source).toContain('failures.push(`village-ui:');
        expect(source).toContain('failures.push(`state-contract:');
        expect(source).toContain('failures.push(`final-priority-journey:');
        expect(source).toContain('failures.push(`save-reload-journey:');
        expect(source).toContain('failures.push(`navigation-lifecycle:');
        expect(source).toContain('failures.push(`hub-forest-transition:');
    });

    test('keeps heavy WebGL scenes foregrounded during touch verification', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain("session.call('Page.bringToFront')");
        expect(source).toContain("session.call('Emulation.setFocusEmulationEnabled'");
        expect(source).toContain("'--disable-background-timer-throttling'");
        expect(source).toContain("'--disable-renderer-backgrounding'");
    });

    test('production portrait smoke proves quota-free identity reuse', () => {
        const source = read('scripts/smoke-living-portrait-production.js');

        expect(source).toContain('reused.identityCacheHit !== true');
        expect(source).toContain('reused.quotaConsumed !== false');
        expect(source).toContain('reused.assetRef !== result.assetRef');
    });

    test('portrait failures release capacity and profiles recover missing hatch results', () => {
        const functionSource = read('netlify/lib/generate-ai-art-core.cjs');
        const profileSource = read('src/scenes/CreatureProfileScene.js');

        expect(functionSource).toContain(
            'counts_toward_daily_limit: false'
        );
        expect(functionSource).toContain(
            'process.env.PORTRAIT_DAILY_IDENTITY_LIMIT'
        );
        expect(profileSource).toContain("source: 'profile_recovery'");
        expect(profileSource).toContain('sprite: this.creatureSprite');
    });
});
