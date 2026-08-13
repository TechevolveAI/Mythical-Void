const fs = require('fs');
const path = require('path');

const levelsDirectory = path.join(__dirname, '../scenes/levels');

function readLevel(fileName) {
    return fs.readFileSync(path.join(levelsDirectory, fileName), 'utf8');
}

function methodSource(source, methodName, nextMethodName) {
    const start = source.indexOf(`    ${methodName}(`);
    const end = source.indexOf(`    ${nextMethodName}(`, start + 1);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

describe('late guardian pacing contracts', () => {
    const titan = readLevel('VoidPeaksLevel.js');
    const phoenix = readLevel('AuroraDepthsLevel.js');

    test('Cosmic Titan warns in the world before damage and then opens recovery', () => {
        const warning = methodSource(
            titan,
            'broadcastTitanWarning',
            'executeTitanAttack'
        );
        const attack = methodSource(
            titan,
            'performTitanAttack',
            'broadcastTitanWarning'
        );

        expect(titan).toContain('const TITAN_ATTACK_WINDUP = 700;');
        expect(warning).toContain(
            'this.createTitanAttackTelegraph(attack, attackTarget)'
        );
        expect(warning).toContain('this.time.delayedCall(TITAN_ATTACK_WINDUP');
        expect(warning.indexOf('createTitanAttackTelegraph')).toBeLessThan(
            warning.indexOf('this.executeTitanAttack(attack, attackTarget)')
        );
        expect(attack).toContain(
            'const attackTarget = { x: this.player.x, y: this.player.y };'
        );
        expect(warning).toContain(
            'this.executeTitanAttack(attack, attackTarget)'
        );
        expect(attack).toContain(
            'TITAN_ATTACK_WINDUP + attackWindow + TITAN_RECOVERY_WINDOW'
        );
        expect(warning).toContain('RECOVERY WINDOW // PRESS THE ATTACK');
    });

    test('Cosmic Titan phase changes cancel pressure and provide a safe reset', () => {
        const phase = methodSource(titan, 'enterTitanPhase', 'damageBoss');
        const defeat = methodSource(titan, 'defeatBoss', 'showBossVictory');
        const shutdown = titan.slice(titan.indexOf('    shutdown() {'));

        expect(phase).toContain('this.titanAttackLocked = true;');
        expect(phase).toContain('this.clearBossEncounterTimers();');
        expect(phase).toContain('this.clearBossEncounterEffects();');
        expect(phase).toContain('PHASE ${nextPhase} // PRESSURE SHIFT - RECOVER');
        expect(phase).toContain(
            'this.time.delayedCall(TITAN_PHASE_RECOVERY'
        );
        expect(phase).toContain('this.titanAttackLocked = false;');
        expect(defeat).toContain('this.clearBossEncounterEffects();');
        expect(shutdown).toContain('this.clearBossEncounterTimers();');
    });

    test('Aurora Phoenix routes every move through one readable windup', () => {
        const execute = methodSource(
            phoenix,
            'executeBossAttack',
            'dispatchBossAttack'
        );
        const dispatch = methodSource(
            phoenix,
            'dispatchBossAttack',
            'showBossAttackInstruction'
        );

        expect(phoenix).toContain('const PHOENIX_ATTACK_WINDUP = 700;');
        expect(execute).toContain(
            'this.createPhoenixAttackTelegraph(attackType, attackTarget)'
        );
        expect(execute).toContain(
            'this.scheduleBossTimer(PHOENIX_ATTACK_WINDUP'
        );
        expect(execute.indexOf('createPhoenixAttackTelegraph')).toBeLessThan(
            execute.indexOf('this.dispatchBossAttack(attackType, attackTarget)')
        );
        expect(execute).toContain('const attackTarget = {');
        expect(execute).toContain('this.tweens.killTweensOf(this.boss);');
        expect(execute).toContain('this.startBossHover();');
        expect(execute).toContain(
            'PHOENIX_ATTACK_WINDUP + attackWindow + PHOENIX_RECOVERY_WINDOW'
        );
        [
            'bossFlameDive',
            'bossShadowFeathers',
            'bossFireTrail',
            'bossRebirthNova',
            'bossShadowClones'
        ].forEach(attackMethod => expect(dispatch).toContain(attackMethod));
    });

    test('Aurora Phoenix phases suspend attacks and restart hover after recovery', () => {
        const phase = methodSource(
            phoenix,
            'beginPhoenixPhase',
            'triggerPhase2'
        );

        expect(phase).toContain('this.boss.isAttacking = true;');
        expect(phase).toContain('this.clearBossEncounterTimers();');
        expect(phase).toContain('this.clearBossEncounterEffects();');
        expect(phase).toContain('this.tweens.killTweensOf(this.boss);');
        expect(phase).toContain(
            'this.time.delayedCall(PHOENIX_PHASE_RECOVERY'
        );
        expect(phase).toContain('this.boss.isAttacking = false;');
        expect(phase).toContain('this.startBossHover();');
        expect(methodSource(phoenix, 'triggerPhase2', 'triggerPhase3'))
            .toContain('this.beginPhoenixPhase(2');
        expect(methodSource(phoenix, 'triggerPhase3', 'onBossDefeated'))
            .toContain('this.beginPhoenixPhase(3');
    });

    test('Phoenix hazards and both encounter exits use owned cleanup', () => {
        const attackSection = phoenix.slice(
            phoenix.indexOf('    bossShadowFeathers('),
            phoenix.indexOf('    handleBossCollision(')
        );
        const defeat = methodSource(
            phoenix,
            'onBossDefeated',
            'showBossVictory'
        );
        const shutdown = phoenix.slice(phoenix.indexOf('    shutdown() {'));

        expect(attackSection).toContain('this.trackBossEffect(');
        expect(attackSection).toContain('this.scheduleBossTimer(');
        expect(attackSection).toContain('this.trackBossTimer(');
        expect(defeat).toContain('this.clearBossEncounterTimers();');
        expect(defeat).toContain('this.clearBossEncounterEffects();');
        expect(shutdown).toContain('this.bossPhaseRecoveryTimer?.remove?.();');
        expect(shutdown).toContain('this.clearBossEncounterEffects();');
    });
});
