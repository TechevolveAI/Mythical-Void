const fs = require('fs');
const path = require('path');

const levelDirectory = path.join(__dirname, '../scenes/levels');
const forestSource = fs.readFileSync(
    path.join(levelDirectory, 'MythicalForestLevel.js'),
    'utf8'
);
const crystalSource = fs.readFileSync(
    path.join(levelDirectory, 'CrystalCavesLevel.js'),
    'utf8'
);

function readFrozenObject(source, name) {
    const match = source.match(
        new RegExp(`const ${name} = Object\\.freeze\\((\\{[\\s\\S]*?\\})\\);`)
    );

    expect(match).not.toBeNull();
    return Function(`"use strict"; return (${match[1]});`)();
}

describe('early guardian and miniboss pacing contracts', () => {
    test('Forest guardian attacks provide substantial windups and recovery openings', () => {
        const pacing = readFrozenObject(
            forestSource,
            'FOREST_GUARDIAN_ATTACK_PACING'
        );

        expect(Object.keys(pacing)).toEqual([
            'root_slam',
            'vine_whip',
            'spore_cloud',
            'nature_fury'
        ]);
        Object.values(pacing).forEach(({ windup, recovery, color }) => {
            expect(windup).toBeGreaterThanOrEqual(500);
            expect(recovery).toBeGreaterThanOrEqual(800);
            expect(Number.isInteger(color)).toBe(true);
        });
        expect(forestSource).toContain('this.createForestBossTelegraph(attackType, pacing);');
        expect(forestSource).toContain('this.showForestBossRecovery(pacing.recovery);');
        expect(forestSource).toContain(
            'pacing.windup + attackWindow + pacing.recovery'
        );
    });

    test('Crystal guardian attacks provide substantial windups and recovery openings', () => {
        const pacing = readFrozenObject(
            crystalSource,
            'CRYSTAL_GUARDIAN_ATTACK_PACING'
        );

        expect(Object.keys(pacing)).toEqual([
            'ground_slam',
            'crystal_barrage',
            'charge'
        ]);
        Object.values(pacing).forEach(({ windup, recovery, color }) => {
            expect(windup).toBeGreaterThanOrEqual(650);
            expect(recovery).toBeGreaterThanOrEqual(850);
            expect(Number.isInteger(color)).toBe(true);
        });
        expect(crystalSource).toContain('this.createCrystalBossTelegraph(attackType, pacing);');
        expect(crystalSource).toContain('this.showCrystalBossRecovery(pacing.recovery);');
        expect(crystalSource).toContain(
            'pacing.windup + attackWindow + pacing.recovery'
        );
    });

    test('Crystal Spider routes every offensive pattern through shared readable pacing', () => {
        const pacing = readFrozenObject(
            crystalSource,
            'CRYSTAL_SPIDER_ATTACK_PACING'
        );

        expect(Object.keys(pacing)).toEqual([
            'drop',
            'pounce',
            'web_shot',
            'web_drop'
        ]);
        Object.values(pacing).forEach(({ windup, recovery, cue }) => {
            expect(windup).toBeGreaterThanOrEqual(400);
            expect(recovery).toBeGreaterThanOrEqual(600);
            expect(cue).toMatch(/\/\//);
        });
        ['drop', 'pounce', 'web_shot', 'web_drop'].forEach(attackType => {
            expect(crystalSource).toContain(`this.beginSpiderAttack('${attackType}'`);
        });
        expect(crystalSource).toContain('this.createSpiderAttackTelegraph(attackType, pacing);');
        expect(crystalSource).toContain('this.showSpiderRecovery(pacing.recovery);');
        expect(crystalSource).toContain("this.spiderNameText?.setText('OPENING // STRIKE NOW');");
    });

    test.each([
        ['Forest', forestSource, 'clearForestBossPacing'],
        ['Crystal', crystalSource, 'clearCrystalBossPacing']
    ])('%s phase change pauses the encounter and resumes through a recovery beat', (
        _name,
        source,
        cleanupMethod
    ) => {
        expect(source).toContain('this.bossPhaseTransitioning = true;');
        expect(source).toContain('this.bossAITimer.paused = true;');
        expect(source).toContain('this.bossPhaseTransitionTimer = this.time.delayedCall(1650');
        expect(source).toContain('this.bossPhaseTransitioning = false;');
        expect(source).toContain(`${cleanupMethod}({ includePhase: true });`);
    });

    test.each([
        [
            'Forest',
            forestSource,
            'requestForestBossPhase2',
            'showForestBossRecovery'
        ],
        [
            'Crystal',
            crystalSource,
            'requestCrystalBossPhase2',
            'showCrystalBossRecovery'
        ]
    ])('%s defers a phase shift until the active hazard resolves', (
        _name,
        source,
        requestMethod,
        recoveryMethod
    ) => {
        expect(source).toContain(`${requestMethod}() {`);
        expect(source).toContain('this.bossPhasePending = true;');
        const recoveryStart = source.indexOf(`    ${recoveryMethod}(`);
        const recoveryEnd = source.indexOf('\n    }', recoveryStart);
        const recoverySource = source.slice(recoveryStart, recoveryEnd);
        expect(recoverySource).toContain('if (this.bossPhasePending)');
        expect(recoverySource).toContain('this.triggerPhase2();');
    });

    test('authored pacing effects use Phaser graphics/tweens and are explicitly cleaned up', () => {
        expect(forestSource).toMatch(
            /createForestBossTelegraph[\s\S]*?this\.add\.graphics\(\)[\s\S]*?this\.tweens\.add/
        );
        expect(crystalSource).toMatch(
            /createSpiderAttackTelegraph[\s\S]*?this\.add\.graphics\(\)[\s\S]*?this\.tweens\.add/
        );
        expect(crystalSource).toMatch(
            /createCrystalBossTelegraph[\s\S]*?this\.add\.graphics\(\)[\s\S]*?this\.tweens\.add/
        );
        expect(forestSource.match(/this\.clearForestBossPacing\(\{ includePhase: true \}\);/g))
            .toHaveLength(2);
        expect(crystalSource.match(/this\.clearCrystalBossPacing\(\{ includePhase: true \}\);/g))
            .toHaveLength(2);
        expect(crystalSource.match(/this\.clearSpiderBossPacing\(\);/g))
            .toHaveLength(3);
    });

    test('Crystal Spider rewards cannot overwrite a later guardian checkpoint', () => {
        const defeatStart = crystalSource.indexOf('    onSpiderDefeated() {');
        const defeatEnd = crystalSource.indexOf(
            '\n    /**\n     * Create a Shadow Bat enemy',
            defeatStart
        );
        const defeatSource = crystalSource.slice(defeatStart, defeatEnd);
        const rewardDelay = defeatSource.indexOf('this.time.delayedCall(500');
        const checkpoint = defeatSource.indexOf('this.setCheckpoint(spider.x, spider.y);');

        expect(checkpoint).toBeGreaterThan(-1);
        expect(checkpoint).toBeLessThan(rewardDelay);
        expect(defeatSource.slice(rewardDelay)).not.toContain(
            'this.setCheckpoint(spider.x, spider.y);'
        );
    });
});
