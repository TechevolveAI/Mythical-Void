const { fixture } = require('./support/mountainEncounterFixture.cjs');
const fixtures = [];
function combat() {
    const f = fixture(), s = f.scene;
    Object.assign(s, { titanAttacksCompleted: 1, titanRecoveryDamage: 0, titanLastHitAt: -Infinity,
        bossHealth: 24, bossMaxHealth: 24, bossPhase: 1, titanRecoveryUntil: 4000,
        updateBossHealthBar: jest.fn(), enterTitanPhase: jest.fn(), defeatBoss: jest.fn() });
    s.boss.setTint = jest.fn(); s.boss.clearTint = jest.fn();
    s.scheduleTitanControlTimer('titanCounterWindowTimer', 1800, () => {}, { encounterTimer: true });
    fixtures.push(f);
    return f;
}
afterEach(() => fixtures.splice(0).forEach(f => f.close()));

test.each(['entrance', 'before-first-attack', 'attacking', 'transition', 'exhausted', 'cooldown'])('cannot skip combat during %s', state => {
    const { scene: s } = combat();
    if (state === 'entrance') s.bossCombatReady = false;
    if (state === 'before-first-attack') s.titanAttacksCompleted = 0;
    if (state === 'attacking') s.cancelTitanControlTimer('titanCounterWindowTimer');
    if (state === 'transition') s.titanPhaseRecoveryTimer = {};
    if (state === 'exhausted') s.titanRecoveryDamage = 4;
    if (state === 'cooldown') s.scheduleTitanControlTimer('titanHitCooldownTimer', 350, () => {}, { encounterTimer: true });
    expect(s.damageBoss(100)).toBe(false);
    expect(s.bossHealth).toBe(24);
});

test('six real recovery openings are required even with an overpowered weapon', () => {
    const f = combat(), s = f.scene;
    for (let i = 0; i < 6; i++) {
        f.advance(5000); s.titanRecoveryDamage = 0;
        s.scheduleTitanControlTimer('titanCounterWindowTimer', 1800, () => {}, { encounterTimer: true });
        expect(s.damageBoss(100)).toBe(true);
        f.advance(500);
        expect(s.damageBoss(100)).toBe(false);
    }
    expect(s.bossHealth).toBe(0);
    expect(s.defeatBoss).toHaveBeenCalledTimes(1);
});
