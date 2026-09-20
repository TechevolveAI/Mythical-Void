const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/VoidPeaksLevel.js'), 'utf8');
const tree = parse(source, { sourceType: 'module' }).program.body;
const declaration = tree.find(node => node.type === 'ClassDeclaration');
const geometry = fs.readFileSync(path.join(__dirname, '../systems/MountainBossAscent.js'), 'utf8');
const { MOUNTAIN_ASCENT, MOUNTAIN_BOSS_NAME } = new Function(
    `${geometry.replace(/^export /gm, '')}; return { MOUNTAIN_ASCENT, MOUNTAIN_BOSS_NAME };`
)();
const arena = tree.find(node => node.type === 'VariableDeclaration' && node.declarations[0].id.name === 'TITAN_ARENA');
const method = declaration.body.body.find(node => node.key?.name === 'createTitanGate');
const createTitanGate = new Function('MOUNTAIN_ASCENT', 'MOUNTAIN_BOSS_NAME', `
    ${source.slice(arena.start, arena.end)}
    return ({ ${source.slice(method.start, method.end)} }).createTitanGate;
`)(MOUNTAIN_ASCENT, MOUNTAIN_BOSS_NAME);

function fixture() {
    const gate = { destroy: jest.fn() };
    const s = {
        player: { x: 4990, y: 350 }, time: { now: 3000 },
        add: { zone: jest.fn((x, y, width, height) => Object.assign(gate, { x, y, width, height })) },
        physics: { add: { existing: jest.fn(), overlap: jest.fn() } },
        createGuardianGateState: jest.fn(),
        createTraversalLandingGuide: jest.fn(),
        shouldAnimatePeakRouteDecorations: () => false,
        isPlayerGroundedOnTraversalSupport: jest.fn(() => true),
        showFloatingText: jest.fn(), bossGateHintUntil: 0,
        creatureNetworkReached: true, bossFightActive: false, bossDefeated: false,
        getTraversalSupportCheckpoint: jest.fn(() => ({ x: 4820, y: 350 }))
    };
    s.startBossFight = jest.fn(() => { s.bossFightActive = true; });
    s.beginGuardianEncounter = jest.fn(({ start }) => { start(); return true; });
    createTitanGate.call(s);
    return { s, gate, overlap: s.physics.add.overlap.mock.calls[0][2] };
}

test('the entire physical summit, including a jump past the old entry strip, starts combat', () => {
    const { s, gate, overlap } = fixture();
    const left = gate.x - gate.width / 2;
    const right = gate.x + gate.width / 2;
    expect(left).toBe(MOUNTAIN_ASCENT.summitX);
    expect(right).toBe(MOUNTAIN_ASCENT.summitX + MOUNTAIN_ASCENT.summitWidth);
    for (const landingX of [4790, 4820, 4900, 4990, 5184]) {
        expect(landingX).toBeGreaterThan(left);
        expect(landingX).toBeLessThan(right);
    }
    overlap();
    expect(s.isPlayerGroundedOnTraversalSupport).toHaveBeenCalledWith('peak-titan-gate');
    expect(s.startBossFight).toHaveBeenCalledTimes(1);
    expect(s.getTraversalSupportCheckpoint).toHaveBeenCalledWith('peak-titan-gate', 4820);
    expect(gate.destroy).toHaveBeenCalledTimes(1);
    expect(s.titanGate).toBeNull();
    overlap();
    expect(s.startBossFight).toHaveBeenCalledTimes(1);
});

test('flying above or walking below the summit does not wake the boss until landing', () => {
    const { s, gate, overlap } = fixture();
    s.isPlayerGroundedOnTraversalSupport.mockReturnValue(false);
    overlap();
    expect(s.startBossFight).not.toHaveBeenCalled();
    expect(gate.destroy).not.toHaveBeenCalled();
    s.isPlayerGroundedOnTraversalSupport.mockReturnValue(true);
    overlap();
    expect(s.startBossFight).toHaveBeenCalledTimes(1);
});

test('summit coverage does not bypass unfinished route checkpoints or revive a defeated boss', () => {
    const { s, gate, overlap } = fixture();
    s.creatureNetworkReached = false;
    overlap();
    expect(s.startBossFight).not.toHaveBeenCalled();
    expect(gate.destroy).not.toHaveBeenCalled();
    s.creatureNetworkReached = true;
    s.bossDefeated = true;
    overlap();
    expect(s.startBossFight).not.toHaveBeenCalled();
});

test('a declined encounter leaves the entry trigger available for a later attempt', () => {
    const { s, gate, overlap } = fixture();
    s.beginGuardianEncounter.mockReturnValue(false);
    overlap();
    expect(gate.destroy).not.toHaveBeenCalled();
    expect(s.titanGate).toBe(gate);
    expect(s.startBossFight).not.toHaveBeenCalled();
});
