const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const { fixture } = require('./support/mountainEncounterFixture.cjs');

const pauseSource = fs.readFileSync(path.join(__dirname, '../scenes/controllers/PlatformerPauseSession.js'), 'utf8');
const pauseClass = parse(pauseSource, { sourceType: 'module' }).program.body
    .map(node => node.declaration || node).find(node => node.type === 'ClassDeclaration');
const PauseSession = new Function(`return (${pauseSource.slice(pauseClass.start, pauseClass.end)});`)();

function encounter() {
    const f = fixture(), { scene } = f;
    const drawing = () => {
        const value = f.object(0, 0);
        for (const name of ['lineStyle', 'fillStyle', 'strokeCircle', 'fillRect', 'fillTriangle', 'lineBetween', 'setText']) {
            value[name] = jest.fn(() => value);
        }
        return value;
    };
    scene.add.graphics = drawing;
    Object.assign(scene, { titanAttackIndex: 0, titanAttackLocked: false, titanRecoveryUntil: 0,
        titanAttacksCompleted: 0, titanRecoveryDamage: 0, titanLastHitAt: -Infinity,
        bossHealth: 24, bossMaxHealth: 24, bossSubtitle: drawing() });
    scene.updateBossHealthBar = jest.fn();
    scene.boss.setTint = jest.fn(() => scene.boss);
    scene.boss.clearTint = jest.fn(() => scene.boss);
    jest.spyOn(scene, 'executeTitanAttack').mockImplementation(() => {});
    return { ...f,
        openCounter() {
            scene.performTitanAttack('gravityCrush'); f.advance(700); f.advance(1800);
            expect(scene.titanAttacksCompleted).toBe(1);
        },
        pause(delta) {
            const session = PauseSession.open(scene);
            expect(session).not.toBeNull();
            scene.pauseMenuActive = true; f.advance(delta);
            scene.pauseMenuActive = false; session.release();
        },
        close() { scene.pauseMenuSession?.retire(); f.close(); }
    };
}

describe('mountain counter and hit cooldown use active encounter time', () => {
    afterEach(() => jest.restoreAllMocks());

    test('control: the existing counter closes after exactly1800ms of native clock progress', () => {
        const f = encounter(), { scene } = f;
        try {
            f.openCounter(); f.advance(1799);
            expect(scene.damageBoss(1)).toBe(true);
            f.advance(1);
            expect(scene.damageBoss(1)).toBe(false);
        } finally { f.close(); }
    });

    test.each([200, 5000])('a %sms menu pause cannot spend the remaining counter opportunity', delta => {
        const f = encounter(), { scene } = f;
        try {
            f.openCounter(); f.advance(300); f.pause(delta);
            expect(scene.damageBoss(1)).toBe(true);
            f.advance(1499);
            expect(scene.damageBoss(1)).toBe(true);
            f.advance(1);
            expect(scene.damageBoss(1)).toBe(false);
        } finally { f.close(); }
    });

    test.each([200, 5000])('the existing350ms hit cooldown also excludes a %sms pause', delta => {
        const f = encounter(), { scene } = f;
        try {
            f.openCounter(); expect(scene.damageBoss(1)).toBe(true);
            f.pause(delta); expect(scene.damageBoss(1)).toBe(false);
            f.advance(349); expect(scene.damageBoss(1)).toBe(false);
            f.advance(1); expect(scene.damageBoss(1)).toBe(true);
            expect(scene.bossHealth).toBe(20);
        } finally { f.close(); }
    });

    test('opening a menu never permits a direct counter hit behind it', () => {
        const f = encounter(), { scene } = f;
        try {
            f.openCounter(); PauseSession.open(scene); scene.pauseMenuActive = true;
            expect(scene.damageBoss(1)).toBe(false);
            expect(scene.bossHealth).toBe(24);
        } finally { f.close(); }
    });

    test('an expired absolute diagnostic deadline cannot release a new attack during the retained counter', () => {
        const f = encounter(), { scene } = f;
        try {
            f.openCounter(); f.pause(5000);
            scene.titanAttackLocked = false;
            const windup = jest.spyOn(scene, 'startTitanWindup');
            scene.performTitanAttack('starRain');
            expect(windup).not.toHaveBeenCalled();
            expect(scene.titanWarningTimer).toBeNull();
            expect(scene.damageBoss(1)).toBe(true);
        } finally { f.close(); }
    });

    test('repeated menus preserve the sum of active counter time, not wall time', () => {
        const f = encounter(), { scene } = f;
        try {
            f.openCounter(); f.advance(250); f.pause(200); f.advance(250); f.pause(5000);
            expect(scene.titanCounterWindowTimer.getRemaining()).toBe(1300);
            expect(scene.damageBoss(1)).toBe(true);
            f.advance(1300); expect(scene.damageBoss(1)).toBe(false);
        } finally { f.close(); }
    });

    test.each(['boss-body', 'player-body', 'encounter', 'phase', 'clock', 'world', 'events', 'completion', 'defeat'])(
        'a retained counter cannot damage a %s successor', reason => {
            const f = encounter(), { scene } = f;
            try {
                f.openCounter();
                if (reason === 'boss-body') scene.boss.body = f.actor().body;
                if (reason === 'player-body') scene.player.body = f.actor().body;
                if (reason === 'encounter') scene.guardianEncounter = { active: true };
                if (reason === 'phase') scene.bossPhase = 3;
                if (reason === 'clock') scene.time = {};
                if (reason === 'world') scene.physics.world = {};
                if (reason === 'events') scene.events = new (require('eventemitter3'))();
                if (reason === 'completion') scene.levelCompletionActive = true;
                if (reason === 'defeat') scene.bossDefeated = true;
                expect(scene.damageBoss(1)).toBe(false);
                expect(scene.bossHealth).toBe(24);
            } finally { f.close(); }
        });

    test('death cancels the old counter and cooldown without reviving it after checkpoint retry', () => {
        const f = encounter(), { scene } = f;
        try {
            f.openCounter(); scene.damageBoss(1);
            const counter = scene.titanCounterWindowTimer, cooldown = scene.titanHitCooldownTimer;
            scene.onPlayerDeath(); scene.retryFromCheckpoint();
            expect(scene.titanCounterWindowTimer).toBeNull();
            expect(scene.titanHitCooldownTimer).toBeNull();
            counter.callback(); cooldown.callback();
            expect(scene.damageBoss(1)).toBe(false);
            expect(scene.bossHealth).toBe(22);
        } finally { f.close(); }
    });

    test('required cooldown setup failure cannot spend boss health or the current damage allowance', () => {
        const f = encounter(), { scene } = f;
        try {
            f.openCounter();
            jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(() => { throw Error('fictional cooldown setup failure'); });
            expect(() => scene.damageBoss(1)).toThrow('fictional cooldown setup failure');
            expect(scene.bossHealth).toBe(24);
            expect(scene.titanRecoveryDamage).toBe(0);
            expect(scene.titanHitCooldownTimer).toBeNull();
        } finally { f.close(); }
    });
});
