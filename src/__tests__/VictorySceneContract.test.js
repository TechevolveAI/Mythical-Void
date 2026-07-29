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
        expect(victorySceneSource).toContain('NO SIGNAL HAS LEFT');
        expect(victorySceneSource).not.toContain('INITIATING LAUNCH');
        expect(victorySceneSource).not.toContain('JOURNEY TO THE STARS');
        expect(victorySceneSource).not.toContain('showLaunchPhase');
        expect(victorySceneSource).not.toContain('showFlightPhase');
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

    test('persists only supported ending choices', () => {
        expect(victorySceneSource).toContain("['earth', 'void'].includes(choice)");
        expect(victorySceneSource).toContain(
            "set('story.projectBeacon.endingChoice', choice)"
        );
        expect(victorySceneSource).toContain(
            "set('story.projectBeacon.endingChoiceDate', new Date().toISOString())"
        );
        expect(victorySceneSource).toMatch(
            /showEndingConfirmation\(choice\)[\s\S]*if \(this\.recordEndingChoice\(choice\)\)[\s\S]*this\.showEndingEpilogue\(choice\)/
        );
        expect(victorySceneSource).not.toContain('showComingSoonTeaser');
    });

    test('frames the ending as the unresolved Project Beacon responsibility', () => {
        expect(victorySceneSource).toContain('THE BEACON IS YOURS');
        expect(victorySceneSource).toContain(
            'This world trusts you with its location.'
        );
        expect(victorySceneSource).toContain(
            'No signal leaves until you choose.'
        );
        expect(victorySceneSource).toContain(
            'RETURN TO EARTH\\nTransmit Project Beacon'
        );
        expect(victorySceneSource).toContain(
            'PROTECT THIS WORLD\\nSilence the uplink'
        );
    });

    test('delivers three explicit consequences for either player-selected ending', () => {
        expect(victorySceneSource).toContain(
            "title: 'PROJECT BEACON: EARTHBOUND'"
        );
        expect(victorySceneSource).toContain(
            "title: 'PROJECT BEACON: PROTECTED'"
        );
        expect(victorySceneSource).toContain(
            "title: 'THE LONG WAY HOME'"
        );
        expect(victorySceneSource).toContain(
            "title: 'A DIFFERENT BEACON'"
        );
        expect(victorySceneSource).toContain(
            'this world heal while searching for a way to help Earth'
        );
        expect(victorySceneSource).toContain(
            'first alien life to trust a human'
        );
        expect(victorySceneSource).not.toContain(
            'THE STORY CONTINUES'
        );
    });

    test('requires confirmation and exposes a protected New Game+ handoff', () => {
        expect(victorySceneSource).toContain(
            'This becomes the ending of this campaign.'
        );
        expect(victorySceneSource).toContain('GO BACK');
        expect(victorySceneSource).toContain('REPLAY PROJECT BEACON?');
        expect(victorySceneSource).toContain(
            'Your expeditions, ship parts, and ending will reset.'
        );
        expect(victorySceneSource).toContain(
            'Purchased route maps stay open.'
        );
        expect(victorySceneSource).toContain(
            'your bond, achievements, field kit, and katana upgrades will remain.'
        );
        expect(victorySceneSource).toContain('KEEP ENDING');
    });

    test('supports isolated local previews for the choice and both epilogues', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(gameSource).toContain(
            "['choice', 'earth', 'void'].includes(testEnding)"
        );
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

    test('New Game+ replays Project Beacon without erasing durable equipment', () => {
        expect(victorySceneSource).toMatch(
            /startNewGamePlus\(\)[\s\S]*const projectBeacon = state\?\.get\('story\.projectBeacon'\)[\s\S]*firstExpeditionPromptSeen: false,[\s\S]*pendingDebriefs: \[\],[\s\S]*debriefsSeen: \[\],[\s\S]*uplinkRestored: false,[\s\S]*uplinkRestoredAt: null,[\s\S]*endingChoice: null,[\s\S]*endingChoiceDate: null,[\s\S]*endingEpilogueSeen: false,[\s\S]*endingEpilogueCompletedAt: null,[\s\S]*lastRouteUnlocked: null/
        );
        expect(victorySceneSource).toContain('...projectBeacon');
        expect(victorySceneSource).toContain(
            "mapOwnedGateIds.has('stellar_reef')"
        );
        expect(victorySceneSource).not.toContain(
            "set('story.projectBeacon.fieldKit'"
        );
    });
});
