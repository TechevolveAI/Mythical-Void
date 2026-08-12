const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Fend culture gameplay contract', () => {
    const scene = read('scenes/GameScene.js');
    const world = read('systems/world/WorldBuilder.js');
    const story = read('systems/ProjectBeaconStory.js');
    const logModal = read('ui/ProjectBeaconLogModal.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');
    const globalInit = read('global-init.js');

    test('places the First Listening after community construction and resident trust', () => {
        expect(scene).toMatch(
            /const cultureBefore = getFendCultureSnapshot[\s\S]*if \(cultureBefore\.ready\)[\s\S]*showFendCommonsListening/
        );
        expect(story).toContain('FEND COMMONS // FIRST LISTENING');
        expect(globalInit).toContain("import './systems/FendCulture.js';");
    });

    test('uses a responsive full-width decision band with three legitimate priorities', () => {
        expect(scene).toContain('FEND COMMONS // THE FIRST LISTENING');
        expect(scene).toContain(
            'NO ONE SPEAKS TWICE UNTIL EVERY VOICE HAS BEEN HEARD'
        );
        expect(scene).toContain('overlay.fillRect(0, top, width, bandHeight)');
        expect(scene).toContain('CHOOSE WHAT BEGINS FIRST');
    });

    test('leaves a world marker and carries the decision into Project Beacon', () => {
        expect(world).toContain('refreshFendCulture(garden, snapshot = null)');
        expect(world).toContain('snapshot.selectedPriority.shortLabel');
        expect(logModal).toContain(
            'FIRST LISTENING  •  ${log.fendCulture.selectedPriority.shortLabel}'
        );
        expect(scene).toContain('getFendCultureResidentResponse');
    });

    test('provides local non-saving previews for choice and confirmed states', () => {
        expect(game).toContain(
            "['ready', 'refuge', 'restoration', 'warning'].includes"
        );
        expect(game).toContain('fendCulturePreview: testFendCulture');
        expect(hatching).toContain("previewParams.has('testFendCulture')");
    });
});
