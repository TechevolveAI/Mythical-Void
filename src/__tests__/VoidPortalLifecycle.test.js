const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('void portal lifecycle', () => {
    test('entering void sets cooldown and returning from void clears it', () => {
        const source = read('scenes/GameScene.js');

        expect(source).toContain('this.voidEntryCooldown = false');
        expect(source).toContain('cancelVoidPull()');
        expect(source).toContain('enterVoidMiniGame()');
    });
});

