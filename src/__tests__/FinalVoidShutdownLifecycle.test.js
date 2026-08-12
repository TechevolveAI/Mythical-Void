const fs = require('fs');
const path = require('path');

describe('Final Void shutdown lifecycle', () => {
    test('does not mutate a camera already disposed by Phaser', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/FinalVoidLevel.js'),
            'utf8'
        );
        const shutdown = source.slice(source.indexOf('    shutdown() {'));

        expect(shutdown).not.toContain('this.cameras.main.x = 0;');
        expect(shutdown).not.toContain('this.cameras.main.y = 0;');
        expect(shutdown).toContain('super.shutdown();');
    });
});
