const fs = require('fs');
const path = require('path');

const hubSource = fs.readFileSync(
    path.join(__dirname, '../scenes/HubWorldScene.js'),
    'utf8'
);
const storySource = fs.readFileSync(
    path.join(__dirname, '../systems/ProjectBeaconStory.js'),
    'utf8'
);
const gameSource = fs.readFileSync(
    path.join(__dirname, '../game.js'),
    'utf8'
);

describe('first-expedition handoff contract', () => {
    test('focuses the unlocked forest route without forcing immediate entry', () => {
        expect(hubSource).toContain(
            "gate => gate.id === 'mythical_forest'"
        );
        expect(hubSource).toContain('showFirstExpeditionInvitation()');
        expect(hubSource).toContain('handoff.primaryAction');
        expect(hubSource).toContain('handoff.secondaryAction');
        expect(hubSource).toContain('this.enterGate(forestGate)');
    });

    test('persists dismissal but leaves local preview state untouched', () => {
        expect(hubSource).toContain(
            "'story.projectBeacon.firstExpeditionPromptSeen'"
        );
        expect(hubSource).toMatch(
            /this\.progressionPreview !== 'firstRoute'[\s\S]*window\.GameState/
        );
        expect(hubSource).toMatch(
            /primary\.on\('pointerdown'[\s\S]*progressionPreview === 'firstRoute'/
        );
        expect(gameSource).toContain(
            "['complete', 'firstRoute', 'routeMap', 'checkpoint'].includes(testHub)"
        );
    });

    test('keeps handoff copy in the Project Beacon story layer', () => {
        expect(storySource).toContain(
            'getProjectBeaconFirstExpeditionHandoff'
        );
        expect(hubSource).toContain(
            'getProjectBeaconFirstExpeditionHandoff()'
        );
    });

    test('supports keyboard confirmation and dismissal while the prompt is open', () => {
        expect(hubSource).toMatch(
            /keydown-ENTER[\s\S]*isFirstExpeditionInvitationOpen[\s\S]*enterGate\(forestGate\)/
        );
        expect(hubSource).toMatch(
            /keydown-ESC[\s\S]*isFirstExpeditionInvitationOpen[\s\S]*closeFirstExpeditionInvitation/
        );
    });
});
