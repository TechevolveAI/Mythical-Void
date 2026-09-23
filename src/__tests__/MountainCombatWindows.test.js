const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/VoidPeaksLevel.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.find(n => n.type === 'ClassDeclaration');
const node = cls.body.body.find(n => n.key?.name === 'damageBoss');
const damage = new Function(`return ({${source.slice(node.start, node.end)}}).damageBoss`)();
const fixture = () => ({ boss: { active: true, setTint: jest.fn() }, bossCombatReady: true,
    titanAttacksCompleted: 1, titanRecoveryDamage: 0, titanLastHitAt: -Infinity,
    bossHealth: 24, bossMaxHealth: 24, bossPhase: 1, titanRecoveryUntil: 4000,
    time: { now: 2000, delayedCall: jest.fn() }, updateBossHealthBar: jest.fn(),
    showFloatingText: jest.fn(), enterTitanPhase: jest.fn(), defeatBoss: jest.fn() });

test.each(['entrance', 'before-first-attack', 'attacking', 'transition', 'exhausted', 'cooldown'])('cannot skip combat during %s', state => {
    const s = fixture();
    if (state === 'entrance') s.bossCombatReady = false;
    if (state === 'before-first-attack') s.titanAttacksCompleted = 0;
    if (state === 'attacking') s.titanRecoveryUntil = 0;
    if (state === 'transition') s.titanPhaseRecoveryTimer = {};
    if (state === 'exhausted') s.titanRecoveryDamage = 4;
    if (state === 'cooldown') s.titanLastHitAt = 1900;
    expect(damage.call(s, 100)).toBe(false);
    expect(s.bossHealth).toBe(24);
});

test('six real recovery openings are required even with an overpowered weapon', () => {
    const s = fixture();
    for (let i = 0; i < 6; i++) {
        s.titanRecoveryDamage = 0; s.time.now += 5000; s.titanRecoveryUntil = s.time.now + 1800;
        expect(damage.call(s, 100)).toBe(true);
        s.time.now += 500;
        expect(damage.call(s, 100)).toBe(false);
    }
    expect(s.bossHealth).toBe(0);
    expect(s.defeatBoss).toHaveBeenCalledTimes(1);
});
