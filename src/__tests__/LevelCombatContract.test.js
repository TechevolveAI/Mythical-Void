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

    test('all player attacks resolve guardian hits through one readable contract', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );

        expect(source).toContain('resolveBossHit(amount, { source = \'attack\' } = {})');
        expect(source).toContain("this.resolveBossHit(meleeDamage, { source: 'katana' })");
        expect(source).toContain("this.resolveBossHit(rangedDamage, { source: 'ranged' })");
        expect(source).toContain("this.resolveBossHit(3, { source: 'super_blast' })");
        expect(source).toContain('const specialAttackRadius = 300;');
        expect(source).toContain("'GUARDIAN HIT BLOCKED'");
        expect(source).toContain("recordEvent?.('guardian_hit'");
    });

    test.each([
        'MythicalForestLevel.js',
        'CrystalCavesLevel.js',
        'ReefLevel.js',
        'VoidPeaksLevel.js',
        'AuroraDepthsLevel.js',
        'FinalVoidLevel.js'
    ])('%s returns an explicit guardian hit result', (fileName) => {
        const source = readLevel(fileName);
        const start = source.indexOf('    damageBoss(');
        const end = source.indexOf('\n    }', start);
        const method = source.slice(start, end);

        expect(method).toContain('return false;');
        expect(method).toContain('return true;');
    });

    test('the final guardian confirms both ordinary and recovery-window damage', () => {
        const source = readLevel('FinalVoidLevel.js');

        expect(source).toContain('return false;');
        expect(source).toContain('`VOID LINE -${finalAmount}`');
        expect(source).toContain('`BEACON OPENING -${finalAmount}`');
        expect(source).toContain('return true;');
    });

    test('shared enemy combat communicates stomp, armor, immunity, and attack intent', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );

        expect(source).toContain('configureEnemyCombat(enemy, {');
        expect(source).toContain('getEnemyStompProfile(enemy');
        expect(source).toContain('stompProfile.totalStomps >= 1');
        expect(source).toContain('instructionText = null');
        expect(source).toContain('enemy?.stompable !== false');
        expect(source).toContain('if (enemy.combatImmune)');
        expect(source).toContain('telegraphEnemyAttack(enemy, {');
        expect(source).toContain('enemy.combatCue?.destroy?.();');
        expect(source).toContain('enemy.instructionLabel?.destroy?.();');
        expect(source).toContain("text: 'STOMP CLEAR'");
        expect(source).toContain("text: 'STOMP BLOCKED'");
        expect(source).toContain('HIT${hitsRemaining === 1 ? \'\' : \'S\'} LEFT');
    });

    test('the first Forest enemy teaches the shared combat marker in plain language', () => {
        const source = readLevel('MythicalForestLevel.js');

        expect(source).toContain('if (index === 0) {');
        expect(source).toContain("'GOLD = JUMP ON TOP\\nPIPS = JUMPS LEFT'");
        expect(source).toContain('sprite.instructionLabelFollowEnemy = true;');
    });

    test('Crystal Spider returns damage status to shared stomp feedback', () => {
        const source = readLevel('CrystalCavesLevel.js');

        expect(source).toContain('onStomp: () => this.damageSpider(1) !== false');
        expect(source).toContain('return false;');
        expect(source).toContain('return true;');
    });

    test.each([
        ['MythicalForestLevel.js', "role: 'armored'"],
        ['CrystalCavesLevel.js', "role: 'armored'"],
        ['ReefLevel.js', "role: 'charger'"],
        ['VoidPeaksLevel.js', "role: 'armored'"]
    ])('%s configures readable enemy combat roles', (fileName, roleContract) => {
        const source = readLevel(fileName);

        expect(source).toContain('this.configureEnemyCombat(');
        expect(source).toContain(roleContract);
    });

    test('Reef warns before lunges and makes phased immunity physical', () => {
        const source = readLevel('ReefLevel.js');
        const platformerSource = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );

        expect(source.match(/this\.telegraphEnemyAttack\(/g)).toHaveLength(2);
        expect(source).toContain('drifter.combatImmune = drifter.isPhased;');
        expect(source).toContain(
            'drifter.body.checkCollision.none = drifter.isPhased;'
        );
        expect(source).toContain('super.update(time, delta);');
        expect(platformerSource).toContain('this.updateEnemyCombatReadability();');
    });
});
