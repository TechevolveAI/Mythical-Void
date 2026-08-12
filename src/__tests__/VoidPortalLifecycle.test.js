const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('void portal lifecycle', () => {
    test('returning from void restores a safe position with temporary re-entry grace', () => {
        const source = read('scenes/GameScene.js');
        const miniGameSource = read('scenes/VoidMiniGameScene.js');
        const zonesSource = read('systems/world/SanctuaryZones.js');

        expect(source).toContain('this.voidEntryCooldown = false');
        expect(source).toContain('this.spawnPosition = data.returnPosition || this.spawnPosition;');
        expect(source).toContain('this.sanctuaryZones?.getVoidExitPosition?.()');
        expect(source).toContain('cancelVoidPull()');
        expect(source).toContain('enterVoidMiniGame()');
        expect(miniGameSource).toContain('returnPosition: this.returnPosition');
        expect(zonesSource).toContain('getVoidExitPosition(distance = 180)');
    });
});
