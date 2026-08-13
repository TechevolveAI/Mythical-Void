const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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
    test.each([
        'scripts/run-browser-smoke.js',
        'scripts/smoke-secondary-journeys.js'
    ])('%s parses before browser execution', relativePath => {
        expect(() => execFileSync(
            process.execPath,
            ['--check', path.join(rootDir, relativePath)],
            { stdio: 'pipe' }
        )).not.toThrow();
    });

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

    test('every campaign interaction smoke requires live route guidance', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        [
            'mythicalForest',
            'crystalCaves',
            'reef',
            'voidPeaks',
            'auroraDepths',
            'finalVoid'
        ].forEach(route => expect(source).toContain(`'${route}'`));
        expect(source).toContain("/^SIGNAL (RIGHT|LEFT|CLOSE)/");
        expect(source).toContain('nextSignalEmphasized');
        expect(source).toContain('has no readable opening route guidance');
        expect(source).toContain('route signal handoff');
        expect(source).toContain('did not hand route guidance to signal 2');
        expect(source).toContain('route signal ${signalIndex + 1} completion');
        expect(source).toContain('did not complete its ordered route');
        expect(source).toContain('routeCompletion.completedCount !== 3');
        expect(source).toContain('routeCompletion.routeReady !== true');
        expect(source).toContain('routeCompletion.remainingZones !== 0');
        expect(source).toContain('routeCompletion.checkpointIndex !== 2');
        expect(source).toContain('accepted an out-of-order route signal');
        expect(source).toContain('outOfOrderGuard?.activatedCount !== 0');
        expect(source).toContain('persistedCheckpoint?.id !== routeCompletion.checkpointId');
    });

    test('every campaign interaction smoke proves atomic guardian recovery', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain('guardian entry handoff');
        expect(source).toContain('guardian handoff was not atomic');
        expect(source).toContain('duplicateAccepted !== false');
        expect(source).toContain('RETURN TO GUARDIAN STANCE');
        expect(source).toContain('guardian recovery did not freeze safely');
        expect(source).toContain('timerFired !== false');
        expect(source).toContain('guardian stance did not recover cleanly');
        expect(source).toContain('guardian stance was not stable after recovery');
        expect(source).toContain('settledRecovery.playerDead !== false');
        expect(source).toContain('recovered.persistedId !== guardianEntrySetup.persistedId');
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
        expect(source).toContain('for (const viewport of homeEntryViewports)');
        expect(source).toContain("smokeCase: 'wide-touch'");
        expect(source).toContain('width: 860, height: 720');
        expect(source).toContain('SMOKE_CASE: smokeCase');
        expect(source).toContain('for (const guardianCase of guardianCases)');
        expect(source).toContain('SMOKE_CASE: guardianCase');
        expect(source).toContain('failures.push(`interaction:${smokeCase}:');
        expect(source).toContain('failures.push(`guardian-pacing:${guardianCase}:');
        expect(source).toContain('failures.push(`village-ui:');
        expect(source).toContain('failures.push(`state-contract:');
        expect(source).toContain('failures.push(`final-priority-journey:');
        expect(source).toContain('failures.push(`save-reload-journey:');
        expect(source).toContain('failures.push(`navigation-lifecycle:');
        expect(source).toContain('failures.push(`hub-forest-transition:');
        expect(source).toContain('exited before completion marker');
        expect(source).toContain('stdout.includes(expectedMarker)');
        expect(source).toContain('Release smoke does not own');
        expect(source).toContain('[release-smoke-result] pass');
    });

    test('secondary journeys emit a success sentinel only after result output', () => {
        const source = read('scripts/smoke-secondary-journeys.js');
        const result = source.lastIndexOf('success: true');
        const marker = source.lastIndexOf('[smoke-result]');

        expect(result).toBeGreaterThan(-1);
        expect(marker).toBeGreaterThan(result);
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
