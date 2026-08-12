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
        expect(damageHandler[1]).toMatch(/this\.takeDamage\((damage|incomingDamage)\)/);
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

    test('Forest registers authored enemies with the shared attack group', () => {
        const source = readLevel('MythicalForestLevel.js');

        expect(source).toContain('this.enemies = this.physics.add.group();');
        expect(source.match(/this\.enemies\.add\(sprite\);/g)).toHaveLength(4);
        expect(source).toContain('return this.resolveEnemyContact(this.player, enemy');
    });

    test('Crystal Spider routes all weapon damage through its defeat sequence', () => {
        const source = readLevel('CrystalCavesLevel.js');

        expect(source).toContain(
            'this.crystalSpider.onCombatDamage = amount => this.damageSpider(amount);'
        );
        expect(source).not.toContain(
            'this.physics.add.collider(this.player, this.enemies, this.onEnemyCollision, null, this);'
        );
    });

    test('shared defeat removes separate enemy artwork and special attacks use damage', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );

        expect(source).toContain('enemy.graphics.destroy?.();');
        expect(source).toContain('typeof enemy.onCombatDamage === \'function\'');
        expect(source).toContain('Math.max(6, Number(enemy.health) || 1)');
    });
});
