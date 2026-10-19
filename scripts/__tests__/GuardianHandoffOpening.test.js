const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../smoke-secondary-journeys.js'), 'utf8');
const start = source.indexOf('function guardianHandoffOpening(');
const end = source.indexOf('async function waitForGuardianOpening(', start);
const opening = new Function(source.slice(start, end) + '; return guardianHandoffOpening;')();

test('Peaks completion proof waits for a naturally earned damage window', () => {
    const scene = { bossCombatReady: true, titanAttacksCompleted: 1, time: { now: 1000 },
        titanRecoveryUntil: 2000, titanRecoveryDamage: 0, titanLastHitAt: 0 };
    expect(opening(scene, 'voidPeaks')).toBe(true);
    for (const closed of [{ bossCombatReady: false }, { titanAttacksCompleted: 0 },
        { titanRecoveryUntil: 0 }, { titanRecoveryUntil: 1100 }, { titanRecoveryDamage: 4 },
        { titanPhaseRecoveryTimer: {} }, { titanLastHitAt: 900 }]) {
        expect(opening({ ...scene, ...closed }, 'voidPeaks')).toBe(false);
    }
});

test('Forest proof still requires entrance, a real attack and recovery without transition', () => {
    const scene = { bossEntranceComplete: true, boss: { isRecovering: true }, bossPhaseAttackCount: 1 };
    expect(opening(scene, 'mythicalForest')).toBe(true);
    expect(opening({ ...scene, bossPhaseAttackCount: 0 }, 'mythicalForest')).toBe(false);
    expect(opening({ ...scene, bossPhaseTransitioning: true }, 'mythicalForest')).toBe(false);
    expect(opening({ ...scene, boss: { isRecovering: false } }, 'mythicalForest')).toBe(false);
});

test('staged final hit does not overwrite combat immunity or its recovery clock', () => {
    const finalHit = source.slice(source.indexOf('    const finalHit = await evaluate(session',
        source.indexOf('async function smokeGuardianHandoff(')), source.indexOf('    const completion = await waitFor(',
        source.indexOf('async function smokeGuardianHandoff(')));
    expect(finalHit).not.toMatch(/scene\.(?:bossRecoveryUntil|titanRecoveryUntil|boss\.isRecovering)\s*=/);
    expect(finalHit).toContain('scene.performSpecialAttack()');
    expect(finalHit).not.toContain('scene.defeatBoss()');
});
