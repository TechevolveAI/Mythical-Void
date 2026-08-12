const fs = require('fs');
const path = require('path');

describe('Aurora Depths shutdown lifecycle', () => {
    test('leaves Phaser-owned fragment group disposal to the scene lifecycle', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/AuroraDepthsLevel.js'),
            'utf8'
        );
        const shutdown = source.slice(source.indexOf('    shutdown() {'));

        expect(shutdown).toContain('this.auroraFragments = null;');
        expect(shutdown).not.toContain('this.auroraFragments?.clear?.(true, true);');
        expect(shutdown).toContain('super.shutdown();');
    });
});
