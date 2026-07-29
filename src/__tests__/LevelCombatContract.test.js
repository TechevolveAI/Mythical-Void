const fs = require('fs');
const path = require('path');

const levelDirectory = path.join(__dirname, '../scenes/levels');

function readLevel(fileName) {
    return fs.readFileSync(path.join(levelDirectory, fileName), 'utf8');
}

describe('playable level combat contracts', () => {
    test.each([
        'AuroraDepthsLevel.js',
        'FinalVoidLevel.js',
        'MythicalForestLevel.js'
    ])('%s delegates custom damage handling to the shared death flow', (fileName) => {
        const source = readLevel(fileName);
        const damageHandler = source.match(
            /handlePlayerDamage\(damage\)\s*\{([\s\S]*?)\n    \}/
        );

        expect(damageHandler).not.toBeNull();
        expect(damageHandler[1]).toContain('this.takeDamage(damage)');
        expect(damageHandler[1]).not.toContain('this.health -=');
    });

    test.each([
        ['CrystalCavesLevel.js', 'crystal_core'],
        ['ReefLevel.js', 'dimensional_drive'],
        ['MythicalForestLevel.js', 'forest_core'],
        ['VoidPeaksLevel.js', 'hull_plating'],
        ['AuroraDepthsLevel.js', 'aurora_reactor'],
        ['FinalVoidLevel.js', 'command_module']
    ])('%s completes through the shared progression contract', (fileName, shipPartId) => {
        const source = readLevel(fileName);

        expect(source).toContain('completeLevelProgression({');
        expect(source).toContain(`shipPartId: '${shipPartId}'`);
    });

    test('awards both authored creature-tech katana upgrades', () => {
        expect(readLevel('CrystalCavesLevel.js')).toContain(
            "katanaUpgradeId: 'crystal_edge'"
        );
        expect(readLevel('AuroraDepthsLevel.js')).toContain(
            "katanaUpgradeId: 'aurora_guard'"
        );
    });
});
