const fs = require('fs');
const path = require('path');

const victorySceneSource = fs.readFileSync(
    path.join(__dirname, '../scenes/VictoryScene.js'),
    'utf8'
);
const hatchingSceneSource = fs.readFileSync(
    path.join(__dirname, '../scenes/HatchingScene.js'),
    'utf8'
);
const achievementSource = fs.readFileSync(
    path.join(__dirname, '../systems/AchievementSystem.js'),
    'utf8'
);

describe('VictoryScene campaign contract', () => {
    test('clears onboarding and gameplay scenes before the finale', () => {
        [
            'HatchingScene',
            'PersonalityScene',
            'NamingScene',
            'SoulRevealScene',
            'FinalVoidLevel',
            'HubWorldScene',
            'GameScene'
        ].forEach(sceneName => {
            expect(victorySceneSource).toContain(`'${sceneName}'`);
        });
        expect(victorySceneSource).toContain(
            'SceneTransitionHelper.stopActiveScenes(this, scenesToStop)'
        );
    });

    test('keeps the default hatching scene dormant on direct preview routes', () => {
        expect(hatchingSceneSource).toMatch(
            /create\(\)\s*\{\s*\/\/ Boss\/ending preview routes[\s\S]*has\('testBoss'\)[\s\S]*return;/
        );
    });

    test('assembles every campaign ship part', () => {
        [
            'Crystal Core',
            'Dimensional Drive',
            'Forest Core',
            'Hull Plating',
            'Aurora Reactor',
            'Command Module'
        ].forEach(partName => {
            expect(victorySceneSource).toContain(`name: '${partName}'`);
        });
    });

    test('does not declare either planet saved before the final choice', () => {
        expect(victorySceneSource).not.toContain('saved the cosmos');
        expect(victorySceneSource).toContain('Together, you survived the Void.');
    });

    test('holds the repaired ship and beacon until the player chooses', () => {
        expect(victorySceneSource).toContain('PROJECT BEACON RESTORED');
        expect(victorySceneSource).toContain(
            'UPLINK READY  //  TRANSMISSION HELD'
        );
        expect(victorySceneSource).toContain('NO MESSAGE HAS LEFT');
        expect(victorySceneSource).not.toContain('INITIATING LAUNCH');
        expect(victorySceneSource).not.toContain('JOURNEY TO THE STARS');
        expect(victorySceneSource).not.toContain('showLaunchPhase');
        expect(victorySceneSource).not.toContain('showFlightPhase');
    });

    test('carries the witnessed creature power into the finale responsibility', () => {
        expect(victorySceneSource).toContain(
            "'story.projectBeacon.highPowerReveals'"
        );
        expect(victorySceneSource).toContain(
            'held five living systems together.'
        );
        expect(victorySceneSource).toContain(
            'On Earth, that power would be detectable across a city.'
        );
        expect(victorySceneSource).toContain(
            'Project Beacon can reach Earth. No message has left.'
        );
    });

    test('uses restoration language and a real achievement event', () => {
        expect(victorySceneSource).toContain('Realms Restored');
        expect(victorySceneSource).toContain('Guardians Restored');
        expect(victorySceneSource).not.toContain('Realms Conquered');
        expect(victorySceneSource).not.toContain('Guardians Defeated');
        expect(victorySceneSource).not.toContain(
            "AchievementSystem.unlock?.('VOID_CONQUEROR')"
        );
        expect(victorySceneSource).toContain(
            "AchievementSystem?.recordEvent?.('campaign_completed'"
        );
        expect(achievementSource).toContain("id: 'beacon_restorer'");
        expect(achievementSource).toContain(
            "case 'campaign_completed':"
        );
    });

    test('persists only supported campaign priorities', () => {
        expect(victorySceneSource).toContain(
            'CAMPAIGN_INTENTS.includes(choice)'
        );
        expect(victorySceneSource).toContain(
            'recordCampaignPriority(state, choice'
        );
        expect(victorySceneSource).toContain(
            "'story.projectBeacon.finale.priority'"
        );
        expect(victorySceneSource).toMatch(
            /showEndingConfirmation\(choice\)[\s\S]*if \(this\.recordEndingChoice\(choice\)\)[\s\S]*this\.showEndingEpilogue\(choice\)/
        );
        expect(victorySceneSource).not.toContain('showComingSoonTeaser');
    });

    test('frames the finale as a protected shared outcome and priority', () => {
        expect(victorySceneSource).toContain('WHAT COMES FIRST?');
        expect(victorySceneSource).toContain(
            'const compactChoiceHeight = Math.max(50, Math.min(56, height * 0.105));'
        );
        expect(victorySceneSource).toContain(
            'The coordinates are protected. Departure is deferred.'
        );
        expect(victorySceneSource).toContain(
            'Choose what Wanderer-77 prepares first.'
        );
        expect(victorySceneSource).toContain(
            'DEFEND FIRST\\nRestore communities'
        );
        expect(victorySceneSource).toContain(
            'PREPARE HOMECOMING\\nPreserve a secret route'
        );
        expect(victorySceneSource).toContain(
            'PREPARE HONEST CONTACT\\nBuild consent and proof'
        );
        expect(victorySceneSource).toContain(
            'isCompact ? height * 0.74 : btnY'
        );
        expect(victorySceneSource).toContain(
            'isCompact ? 0.875 : 0.84'
        );
        expect(victorySceneSource).toContain(
            'PREPARATION ONLY // NO TRANSMISSION\\nNO DEPARTURE'
        );
        expect(victorySceneSource).toContain(
            'height * (isCompact ? 0.315 : 0.35)'
        );
        expect(victorySceneSource).toContain(
            'isCompact ? 0.72 : 1'
        );
        expect(victorySceneSource).toContain("color: '#D7CDF6'");
        expect(victorySceneSource).not.toContain(
            'targets: hint,\n            alpha: { from: 1, to: 0.5 }'
        );
    });

    test('delivers three explicit consequences for every priority', () => {
        expect(victorySceneSource).toContain(
            "title: 'PRIORITY: REMAIN AND DEFEND'"
        );
        expect(victorySceneSource).toContain(
            "title: 'PRIORITY: PREPARE HOMECOMING'"
        );
        expect(victorySceneSource).toContain(
            "title: 'PRIORITY: PREPARE FIRST CONTACT'"
        );
        expect(victorySceneSource).toContain(
            "title: 'DOJO-23-77'"
        );
        expect(victorySceneSource).toContain(
            'That is not consent.'
        );
        expect(victorySceneSource).toContain(
            'Nothing is broadcast now.'
        );
        expect(victorySceneSource).not.toContain('TRANSMISSION // SENT');
        expect(victorySceneSource).not.toContain('COURSE // EARTH');
    });

    test('requires confirmation and exposes a protected New Game+ handoff', () => {
        expect(victorySceneSource).toContain(
            'This decides what you prepare first. No message is sent.'
        );
        expect(victorySceneSource).toContain('GO BACK');
        expect(victorySceneSource).toContain('REPLAY PROJECT BEACON?');
        expect(victorySceneSource).toContain(
            'Your expeditions, ship parts, and active priority will reset.'
        );
        expect(victorySceneSource).toContain(
            'Purchased route maps stay open.'
        );
        expect(victorySceneSource).toContain(
            'your bond, achievements, field kit, katana upgrades, and prior legacy record will remain.'
        );
        expect(victorySceneSource).toContain('KEEP PRIORITY');
    });

    test('offers a privacy-safe share action only after the final epilogue', () => {
        expect(victorySceneSource).toMatch(
            /if \(isLastPage\) \{[\s\S]*'SHARE THE GAME'[\s\S]*shareCompletedAdventure\(label\)/
        );
        expect(victorySceneSource).toContain(
            "url: 'https://mythicalvoid.com/playable-now/#find-your-way/story'"
        );
        expect(victorySceneSource).toContain('window.navigator?.share');
        expect(victorySceneSource).toContain(
            'window.navigator?.clipboard?.writeText'
        );
        expect(victorySceneSource).not.toMatch(
            /async shareCompletedAdventure\(label\) \{[\s\S]*?GameState[\s\S]*?Return to hub/
        );
    });

    test('keeps the child co-creator credit without publishing identity details', () => {
        expect(victorySceneSource).toContain("'Kevin’s son'");
        expect(victorySceneSource).toContain("'Co-Creator & Game Designer'");
        expect(victorySceneSource.match(/Murphy/g)).toHaveLength(2);
        expect(victorySceneSource).not.toMatch(/\(Age \d+\)/);
    });

    test('supports isolated local previews for the choice and all priorities', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        [
            "'choice'",
            "'remain_and_defend'",
            "'prepare_homecoming'",
            "'prepare_first_contact'"
        ].forEach(route => expect(gameSource).toContain(route));
        expect(gameSource).toContain('endingPreview: testEnding');
        expect(gameSource).toContain(
            "endingPreviewPage: urlParams.get('endingPage')"
        );
        expect(gameSource).toContain(
            "endingPreviewView: urlParams.get('endingView')"
        );
        expect(victorySceneSource).toContain(
            "this.isPreview = data?.testMode === true || this.endingPreview !== null"
        );
        expect(victorySceneSource).toContain(
            'this.endingPreviewPage = Math.max('
        );
        expect(victorySceneSource).toContain(
            "this.endingPreviewView === 'newGamePlus'"
        );
    });

    test('lets players skip the timed finale without leaving phase timers active', () => {
        expect(victorySceneSource).toContain(
            "this.skipControl.on('pointerdown', () => this.skipVictorySequence())"
        );
        expect(victorySceneSource).toMatch(
            /skipVictorySequence\(\)\s*\{[\s\S]*this\.time\.removeAllEvents\(\);[\s\S]*this\.phase = 'complete';[\s\S]*this\.showCompletePhase\(width, height\);/
        );
        expect(victorySceneSource).toMatch(
            /showCompletePhase\(width, height\)\s*\{\s*this\.removeSkipControl\(\);/
        );
    });

    test('reuses the protected companion portrait as a moving finale tableau', () => {
        expect(victorySceneSource).toContain(
            'mediaService?.createStoryMoment || mediaService?.createCinematicStill'
        );
        expect(victorySceneSource).toContain('Promise.resolve((');
        expect(victorySceneSource).toContain('?.call(mediaService, this, {');
        expect(victorySceneSource).toContain(
            "momentId: 'beacon_reflection'"
        );
        expect(victorySceneSource).toContain(
            "this.phase === 'reflection'"
        );
        expect(victorySceneSource).toContain(
            'this.companionMediaRequest += 1;'
        );
    });

    test('New Game+ replays Project Beacon without erasing durable equipment', () => {
        expect(victorySceneSource).toMatch(
            /startNewGamePlus\(\)[\s\S]*const projectBeacon = state\?\.get\('story\.projectBeacon'\)[\s\S]*firstExpeditionPromptSeen: false,[\s\S]*pendingDebriefs: \[\],[\s\S]*debriefsSeen: \[\],[\s\S]*highPowerReveals: \[\],[\s\S]*uplinkRestored: false,[\s\S]*uplinkRestoredAt: null,[\s\S]*finale: \{[\s\S]*priority: null,[\s\S]*epilogueSeen: false,[\s\S]*companionConsent: \{[\s\S]*schemaVersion: 2,[\s\S]*records: \[\][\s\S]*lastRouteUnlocked: null/
        );
        expect(victorySceneSource).toContain('...projectBeacon');
        expect(victorySceneSource).toContain(
            'protectedReturnProtocol: {'
        );
        expect(victorySceneSource).toContain(
            "transmissionStatus: 'not_sent'"
        );
        expect(victorySceneSource).toContain(
            "state?.set('world.currentVeilMission'"
        );
        expect(victorySceneSource).toContain(
            "mapOwnedGateIds.has('stellar_reef')"
        );
        expect(victorySceneSource).not.toContain(
            "set('story.projectBeacon.fieldKit'"
        );
    });
});
