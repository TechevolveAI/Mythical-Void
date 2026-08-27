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

    test('browser smoke only awaits expressions that deliberately return promises', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain("expression.includes('new Promise')");
        expect(source).toContain("expression.includes('(async () =>')");
        expect(source).toContain('awaitPromise: awaitsBrowserPromise');
        expect(source).not.toContain('awaitPromise: true');
    });

    test('browser smoke rejects console errors and failed same-origin requests', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain("await session.call('Network.enable')");
        expect(source).toContain("session.on('Runtime.consoleAPICalled'");
        expect(source).toContain("session.on('Network.responseReceived'");
        expect(source).toContain("session.on('Network.loadingFailed'");
        expect(source).toContain('Browser health gate failed');
        expect(source).toContain('sameOriginHttpFailures: 0');
    });

    test('visual launch stills require the real creature and astronaut in-frame', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain('async function stageVillageVisualParty');
        expect(source).toContain("'visual_launch_party'");
        expect(source).toContain('state.profileId !== expectedProfileId');
        expect(source).toContain('state.overlapArea > 0');
        expect(source).toContain('state.actorGap < (state.viewport.width <= 600 ? 24 : 36)');
        expect(source).toContain('boundsInsideSafeFrame(state.creatureBounds)');
        expect(source).toContain('boundsInsideSafeFrame(state.astronautBounds)');
        expect(source).toContain("stageVillageVisualParty(session, 'Village worker help')");
        expect(source).toContain(
            "stageVillageVisualParty(session, 'Village choice consequence')"
        );
        expect(source).toContain(
            "stageVillageVisualParty(session, 'Village strange discovery')"
        );
        expect(source).toContain(
            'const actorBounds = [state.creatureBounds, state.astronautBounds]'
        );
        expect(source).toContain('const movementSamples = []');
        expect(source).toContain('Visual movement phone sample');
        expect(source).toContain('Visual movement desktop sample');
        expect(source).toContain("'visual_movement_capture'");
        expect(source).toContain('state.actorGap < (isPhone ? 24 : 36)');
        expect(source).toContain('state.health !== state.maxHealth');
        expect(source).toContain("const supportId = 'forest-tree-3-handoff';");
        expect(source).toContain('const x = support.body.left + 300;');
        expect(source).toContain('distance: Math.min(20, scene?.joystickMaxDistance || 20)');
        expect(source).toContain('const followerGap = ${isPhone} ? 126 : 300;');
        expect(source).toContain('const formationX = followerGap;');
        expect(source).toContain('{ x: formationX, y: 2 }');
        expect(source).toContain('scene.player.x + formation.x');
        expect(source).toContain('follower.sprite.displayWidth * 0.92');
        expect(source).toContain('for (let index = 0; index < 9; index++)');
        expect(source).toContain('if (movementPosterCaptured || index !== 8) return;');
        expect(source).toContain('if (index === 4)');
        expect(source).toContain('} else if (index === 8)');
        expect(source).toContain("throw new Error('Visual movement poster was not captured during live input')");
    });

    test('private static preview only ignores its unavailable observability function', () => {
        const smoke = read('scripts/smoke-secondary-journeys.js');
        const capture = read('scripts/company/prepare-visual-launch-candidates.cjs');

        expect(capture).toContain("SMOKE_ALLOW_LOCAL_STATIC_FUNCTION_404: '1'");
        expect(smoke).toContain("process.env.SMOKE_ALLOW_LOCAL_STATIC_FUNCTION_404 === '1'");
        expect(smoke).toContain("['127.0.0.1', 'localhost'].includes");
        expect(smoke).toContain("new URL(url).pathname === '/.netlify/functions/observability-events'");
    });

    test('private movement candidates include complete frame-review sheets', () => {
        const capture = read('scripts/company/prepare-visual-launch-candidates.cjs');
        expect(capture).toContain('function createFrameReviewSheets(videoRecord)');
        expect(capture).toContain('everyFrameIncluded: true');
        expect(capture).toContain('adultApprovalGranted: false');
        expect(capture).toContain("path.join(candidateRoot, 'frame-review')");
        expect(capture).toContain('Math.ceil(\n        videoRecord.frameCount / settings.framesPerSheet');
        expect(capture).toContain('const videoFrameReviewAids = files');
    });

    test('failed visual captures leave a private rejection record', () => {
        const capture = read('scripts/company/prepare-visual-launch-candidates.cjs');
        expect(capture).toContain("captureState: 'failed_before_candidate_preparation_completed'");
        expect(capture).toContain('technicalCaptureChecksPassed: false');
        expect(capture).toContain("automationDecision: 'reject_before_human_review'");
        expect(capture).toContain('partialEvidenceFiles: listRelativeFiles(workingRoot)');
        expect(capture).toContain('kevinReviewRequested: false');
        expect(capture).toContain('publicationAuthorized: false');
    });

    test('visual launch proof waits for observable gameplay consequences', () => {
        const smoke = read('scripts/smoke-secondary-journeys.js');
        const world = read('src/systems/world/WorldBuilder.js');
        const capture = read('scripts/company/prepare-visual-launch-candidates.cjs');

        expect(smoke).toContain('Creature help changes the route in the same shot');
        expect(smoke).toContain("visibleHelpResult.action !== 'CREATURE SENDS LIFE ENERGY'");
        expect(smoke).toContain("visibleHelpResult.problem !== 'BLOCKED FOOD ROUTE'");
        expect(smoke).toContain("visibleHelpResult.result !== 'ROUTE OPEN +5 HAPPINESS'");
        expect(smoke).toContain("captureGameplayStill(session, 'village-heart-choice-mobile.png')");
        expect(smoke).toContain("heartMemory.visibleDiscovery !== 'THE PLANET REMEMBERS YOUR CHOICE'");
        expect(smoke).toContain("heartMemory.phenomenonLanguage !== 'living_current_remembers_choice_v1'");
        expect(smoke).toContain('echoes.every(echo => echo.alpha >= 0.42)');
        expect(world).toContain(".setData('villageHelpProblem', 'blocked_food_route')");
        expect(world).toContain(".setData('villageHelpResult', 'safe_food_route_open')");
        expect(world).toContain(".setData('villageHelpActionOrigin', 'creature_life_energy')");
        expect(world).toContain("'ROUTE OPEN  +5'");
        expect(world).toContain(".setData('villageHelpProblemLabel', true)");
        expect(world).toContain(".setData('villageDecisionRouteOpened', 'living_current')");
        expect(world).toContain(".setData('villageDecisionRegrowth', true)");
        expect(world).toContain(".setData('villagePlanetMemoryPhenomenon', true)");
        expect(world).toContain(".setData('linkedActorCount', linkedActors.length)");
        expect(world).toContain(".setData('villageMemoryEcho', actorIndex === 0 ? 'creature' : 'astronaut')");
        expect(world).toContain('alpha: { from: 0.28, to: echoIndex === 0 ? 0.68 : 0.5 }');
        expect(capture).toContain("'village-heart-choice-mobile.png'");
        expect(capture).toContain('durationSeconds < 6');
        expect(capture).toContain('frameCount < 72');
        expect(capture).not.toContain("'village-heart-choice-recap-mobile.png', `choice-before-");
    });

    test('production-preview journeys explicitly isolate reset cases', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain("new URL(url).searchParams.get('reset') === 'true'");
        expect(source).toContain('window.GameState?.reset?.();');
        expect(source).toContain("localStorage.removeItem('mythical_creature_save');");
    });

    test('Sanctuary reload smoke proves persisted assignments before preview staging', () => {
        const source = read('scripts/smoke-secondary-journeys.js');
        const releaseRunner = read('scripts/run-browser-smoke.js');

        expect(source).toContain('const readVillageReloadState');
        expect(source).toContain('Village reload persistence failed');
        expect(source).toContain("current.scene.restart(previewData)");
        expect(source).toContain("scene?.villageCommandPreview === 'complete'");
        expect(source).toContain('Complete Village preview scene lifecycle');
        expect(releaseRunner).toContain('[release-smoke] Shop Base Builder desktop reload suite');
        expect(releaseRunner).toContain("SMOKE_VIEWPORT_WIDTH: '1440'");
        expect(releaseRunner).toContain("SMOKE_VIEWPORT_HEIGHT: '810'");
    });

    test('npm test is finite and the manual framework has an explicit command', () => {
        const packageJson = JSON.parse(read('package.json'));

        expect(packageJson.scripts.test).toBe('jest --runInBand');
        expect(packageJson.scripts['test:unit']).toBe('jest --runInBand');
        expect(packageJson.scripts['test:deploy']).toBe('jest --runInBand');
        expect(packageJson.scripts['test:manual']).toBe(
            'node ./scripts/serve-test-framework.js'
        );
    });

    test('Netlify refuses to build a release that fails the deploy test gate', () => {
        const netlifyConfig = read('netlify.toml');

        expect(netlifyConfig).toContain(
            'command = "npm run test:deploy && npm run build"'
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

    test('release smoke proves every guardian reaches its real player handoff', () => {
        const source = read('scripts/smoke-secondary-journeys.js');
        const release = read('scripts/run-browser-smoke.js');

        expect(source).toContain("SMOKE_MODE === 'guardian-handoff'");
        expect(source).toContain('real final Super Blast did not restore its guardian');
        expect(source).toContain('rescued resident continuation');
        expect(source).toContain("'.katana-artifact-continue'");
        expect(source).toContain("'katana-upgrades'");
        expect(source).toContain(
            "SMOKE_CASE === 'katana-upgrades' && Boolean(candidate.katanaUpgradeId)"
        );
        expect(source).toContain('visible completion action');
        expect(source).toContain('debrief installation action');
        expect(source).toContain('Wanderer-77 installation action');
        expect(source).toContain("await waitForScene(session, 'VictoryScene'");
        expect(release).toContain('for (const smokeCase of guardianHandoffCases)');
        expect(release).toContain("SMOKE_MODE: 'guardian-handoff'");
        expect(release).toContain('failures.push(`guardian-handoff:${smokeCase}:');
    });

    test('release smoke runs interaction before the state contract', () => {
        const source = read('scripts/run-browser-smoke.js');
        const villageUi = source.indexOf("SMOKE_MODE: 'village-ui'");
        const interaction = source.indexOf("SMOKE_MODE: 'interaction'");
        const firstSanctuary = source.indexOf("SMOKE_MODE: 'first-sanctuary'");
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
        expect(firstSanctuary).toBeGreaterThan(villageUi);
        expect(interaction).toBeGreaterThan(firstSanctuary);
        expect(stateContract).toBeGreaterThan(interaction);
        expect(finalPriorityJourney).toBeGreaterThan(stateContract);
        expect(saveReloadJourney).toBeGreaterThan(finalPriorityJourney);
        expect(navigationLifecycle).toBeGreaterThan(saveReloadJourney);
        expect(hubForestTransition).toBeGreaterThan(navigationLifecycle);
        expect(source).toContain('for (const smokeCase of interactionCases)');
        expect(source).toContain('for (const viewport of homeEntryViewports)');
        expect(source).toContain("smokeCase: 'wide-touch'");
        expect(source).toContain('width: 860, height: 768');
        expect(source).toContain('SMOKE_CASE: smokeCase');
        expect(source).toContain('for (const guardianCase of guardianCases)');
        expect(source).toContain('SMOKE_CASE: guardianCase');
        expect(source).toContain('failures.push(`interaction:${smokeCase}:');
        expect(source).toContain('failures.push(`first-sanctuary:');
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

    test('release smoke proves the living portrait handoff reaches playable Sanctuary', () => {
        const source = read('scripts/smoke-secondary-journeys.js');
        const release = read('scripts/run-browser-smoke.js');

        expect(source).toContain('async function smokeFirstSanctuaryOnboarding');
        expect(source).toContain("SMOKE_MODE === 'first-sanctuary'");
        expect(source).toContain("await waitForScene(session, 'SoulRevealScene', 2500)");
        expect(source).toContain('Production intentionally ignores preview query parameters');
        expect(source).toContain("game.scene.start('SoulRevealScene', {");
        expect(source).toContain('Could not stage production SoulRevealScene');
        expect(source).toContain("'[data-testid=\"living-form-continue\"]'");
        expect(source).toContain('Project Beacon story page ${expectedPage}');
        expect(source).toContain('Story page ${page} response exceeded 1500ms');
        expect(source).toContain("item?.text === 'START FIELDWORK'");
        expect(source).toContain('playable Sanctuary after onboarding');
        expect(source).toContain('first Sanctuary joystick movement');
        expect(source).toContain('first Sanctuary joystick release');
        expect(source).toContain('First Sanctuary controls did not reach live play');
        expect(release).toContain("SMOKE_MODE: 'first-sanctuary'");
        expect(release).toContain("SMOKE_VIEWPORT_WIDTH: '390'");
        expect(release).toContain("SMOKE_VIEWPORT_HEIGHT: '844'");
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

    test('allows each isolated Chrome profile to release WebGL resources', () => {
        const source = read('scripts/run-browser-smoke.js');

        expect(source).toContain('MYTHICAL_VOID_SMOKE_PROCESS_COOLDOWN_MS');
        expect(source).toContain('await delay(processCooldownMs);');
        expect(source).toContain('frame budgets measure the game');
    });

    test('confirms a mobile frame-budget miss without weakening the limit', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain("framePacing.p95FrameMs > 100");
        expect(source).toContain('warmupMs: 400');
        expect(source).toContain('framePacingSamples.push(confirmation)');
        expect(source).toContain(
            'framePacingSamples.every(sample => sample.p95FrameMs > 100)'
        );
        expect(source).toContain('p95FrameSamples: framePacingSamples.map(');
    });

    test('retries isolated interaction profiles without bypassing their gates', () => {
        const source = read('scripts/run-browser-smoke.js');
        const start = source.indexOf("console.log('\\n[release-smoke] Genuine interaction suite')");
        const end = source.indexOf("console.log('\\n[release-smoke] Conservative campaign topology suite')");
        const interactionSuite = source.slice(start, end);

        expect(interactionSuite).toContain('await runNodeScriptWithRetry(');
        expect(interactionSuite).toContain("SMOKE_MODE: 'interaction'");
        expect(source).toContain('async function runNodeScriptWithRetry(');
        expect(source).toContain('throw lastError;');
    });

    test('retries timing-sensitive guardian handoffs without bypassing them', () => {
        const source = read('scripts/run-browser-smoke.js');
        const start = source.indexOf(
            "console.log('\\n[release-smoke] Guardian defeat, debrief, and installation suite')"
        );
        const end = source.indexOf(
            "console.log('\\n[release-smoke] Final priority mobile journey suite')"
        );
        const handoffSuite = source.slice(start, end);

        expect(handoffSuite).toContain('await runNodeScriptWithRetry(');
        expect(handoffSuite).toContain("SMOKE_MODE: 'guardian-handoff'");
        expect(handoffSuite).toContain(
            'failures.push(`guardian-handoff:${smokeCase}: ${error.message}`)'
        );
    });

    test('reports the URL for browser transport failures', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain('const networkRequestUrls = new Map();');
        expect(source).toContain("session.on('Network.requestWillBeSent'");
        expect(source).toContain("session.on('Page.frameRequestedNavigation'");
        expect(source).toContain(
            'url: networkRequestUrls.get(params.requestId) || null'
        );
        expect(source).toContain('recentDocumentNavigations: params.type ===');
    });

    test('ignores only Netlify deploy-preview panel CSP blocks', () => {
        const source = read('scripts/smoke-secondary-journeys.js');

        expect(source).toContain('isExpectedNetlifyPreviewPanelBlock');
        expect(source).toContain("params.errorText === 'net::ERR_BLOCKED_BY_CSP'");
        expect(source).toContain("'https://app.netlify.com/cdp/'");
        expect(source).toContain('if (isExpectedNetlifyPreviewPanelBlock) return;');
        expect(source).toContain(
            '/^deploy-preview-\\d+--[^.]+\\.netlify\\.app$/'
        );
    });

    test('Sanctuary lifecycle smoke uses the production scene transition path', () => {
        const source = read('scripts/smoke-secondary-journeys.js');
        const start = source.indexOf('async function smokeSanctuaryNavigation');
        const end = source.indexOf('async function smokeHubForestTransition');
        const lifecycleSmoke = source.slice(start, end);

        expect(lifecycleSmoke).toContain(
            "const hatchingScene = game.scene.getScene('HatchingScene');"
        );
        expect(lifecycleSmoke).toContain(
            "hatchingScene.scene.start('GameScene', {"
        );
        expect(lifecycleSmoke).not.toContain("game.scene.stop('HatchingScene')");
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
