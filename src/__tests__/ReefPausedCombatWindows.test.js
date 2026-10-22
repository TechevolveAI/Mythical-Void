const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const { fixture } = require('./support/reefEncounterFixture.cjs');

const source = fs.readFileSync(path.join(__dirname, '../scenes/controllers/PlatformerPauseSession.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.map(node => node.declaration || node)
    .find(node => node.type === 'ClassDeclaration');
const PauseSession = new Function(`return (${source.slice(cls.start, cls.end)});`)();

function encounter() {
    const f = fixture(), { scene } = f;
    const systems = scene.sys, events = scene.events;
    scene.openReefBossRecovery.mockImplementation(Object.getPrototypeOf(scene).openReefBossRecovery.bind(scene));
    scene.showBossAttackInstruction = jest.fn();
    scene.updateBossHealthBar = jest.fn();
    scene.showPlatformerMobileControls = jest.fn();
    scene.physics.resume = () => f.world.resume();
    Object.assign(scene, { bossHealth: 100, bossMaxHealth: 100, bossUsesArtwork: true, bossArtworkPhase: 1 });
    scene.cameras.main.width = 1280; scene.cameras.main.zoom = 1;
    return { ...f,
        pause(delta) {
            const session = PauseSession.open(scene);
            expect(session).not.toBeNull();
            scene.pauseMenuActive = true; f.advance(delta);
            scene.pauseMenuActive = false; session.release();
        },
        close() {
            scene.pauseMenuSession?.retire();
            // Restore only the fixture's native teardown context after assertions.
            scene.sys = systems; scene.events = events;
            f.close();
        }
    };
}

describe('Reef recovery and phase grace retain active play time', () => {
    afterEach(() => jest.restoreAllMocks());

    test('control: the existing850ms opening adds one damage and ends on its original boundary', () => {
        const f = encounter(), { scene } = f;
        try {
            scene.openReefBossRecovery(); f.advance(849);
            expect(scene.damageBoss(2)).toBe(true); expect(scene.bossHealth).toBe(97);
            f.advance(1); scene.damageBoss(2); expect(scene.bossHealth).toBe(95);
        } finally { f.close(); }
    });

    test.each([200, 5000])('a %sms menu cannot spend the exposed-current bonus window', delta => {
        const f = encounter(), { scene } = f;
        try {
            scene.openReefBossRecovery(); f.advance(100); f.pause(delta);
            f.advance(749); scene.damageBoss(2); expect(scene.bossHealth).toBe(97);
            f.advance(1); scene.damageBoss(2); expect(scene.bossHealth).toBe(95);
        } finally { f.close(); }
    });

    test.each([200, 5000])('the existing1200ms phase grace excludes a %sms menu', delta => {
        const f = encounter(), { scene } = f;
        try {
            scene.enterReefBossPhase(2); f.advance(950);
            scene.bossArtworkPhase = 2; scene.bossHealth = 29;
            const phase = jest.spyOn(scene, 'requestReefBossPhase').mockImplementation(() => {});
            f.pause(delta); f.advance(1199); scene.updateBoss(f.clock.now, 0);
            expect(phase).not.toHaveBeenCalled();
            f.advance(1); scene.updateBoss(f.clock.now, 0);
            expect(phase).toHaveBeenCalledTimes(1); expect(phase).toHaveBeenCalledWith(3);
        } finally { f.close(); }
    });

    test('reopening with a shorter duration cannot shorten the retained opening after a menu', () => {
        const f = encounter(), { scene } = f;
        try {
            scene.openReefBossRecovery(850); f.advance(100); f.pause(5000);
            scene.openReefBossRecovery(200); f.advance(749);
            scene.damageBoss(2); expect(scene.bossHealth).toBe(97);
            f.advance(1); scene.damageBoss(2); expect(scene.bossHealth).toBe(95);
        } finally { f.close(); }
    });

    test('a direct hit behind the menu cannot spend boss health', () => {
        const f = encounter(), { scene } = f;
        try {
            scene.openReefBossRecovery(); PauseSession.open(scene); scene.pauseMenuActive = true;
            expect(scene.damageBoss(2)).toBe(false);
            expect(scene.bossHealth).toBe(100);
        } finally { f.close(); }
    });

    test('a retained recovery prevents the next attack even after its old absolute deadline', () => {
        const f = encounter(), { scene } = f;
        try {
            const lunge = jest.spyOn(scene, 'bossVoidLunge').mockImplementation(() => {});
            scene.openReefBossRecovery(850); f.advance(100); f.pause(5000);
            scene.bossAttack('voidLunge'); expect(lunge).not.toHaveBeenCalled();
            f.advance(750); scene.bossAttack('voidLunge'); expect(lunge).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('native remaining time follows a non-default clock rate across repeated menus', () => {
        const f = encounter(), { scene } = f;
        try {
            f.clock.timeScale = 0.5;
            scene.openReefBossRecovery(850); f.advance(200); f.pause(200); f.advance(200); f.pause(5000);
            expect(scene.reefGuardianControl.remaining('recovery')).toBe(650);
            f.advance(1299); scene.damageBoss(2); expect(scene.bossHealth).toBe(97);
            f.advance(1); scene.damageBoss(2); expect(scene.bossHealth).toBe(95);
            expect(f.clock.timeScale).toBe(0.5);
        } finally { f.close(); }
    });

    test.each(['clock', 'world', 'events', 'systems', 'player-body', 'boss-body', 'phase', 'alias', 'encounter'])(
        'an old window cannot transfer its bonus to a replaced %s', replacement => {
            const f = encounter(), { scene } = f;
            try {
                scene.openReefBossRecovery(850); const control = scene.reefGuardianControl;
                if (replacement === 'clock') scene.time = {};
                if (replacement === 'world') scene.physics.world = {};
                if (replacement === 'events') scene.events = new (require('eventemitter3'))();
                if (replacement === 'systems') scene.sys = {};
                if (replacement === 'player-body') scene.player.body = f.actor().body;
                if (replacement === 'boss-body') scene.bossBody.body = f.actor().body;
                if (replacement === 'phase') scene.bossPhase = 2;
                if (replacement === 'alias') scene.bossRecoveryTimer = {};
                if (replacement === 'encounter') scene.guardianEncounter = {};
                expect(control.remaining('recovery')).toBe(0);
            } finally { f.close(); }
        });

    test('a cancelled expiry cannot clear a newer native window or another timer', () => {
        const f = encounter(), { scene } = f;
        try {
            const unrelated = f.clock.delayedCall(10000, () => {});
            scene.openReefBossRecovery(850); const expiry = scene.bossRecoveryTimer.callback;
            scene.openReefBossRecovery(1000); const timer = scene.bossRecoveryTimer;
            expiry();
            expect(scene.bossRecoveryTimer).toBe(timer);
            expect(scene.reefGuardianControl.remaining('recovery')).toBe(1000);
            expect(unrelated.callback).toBeInstanceOf(Function);
        } finally { f.close(); }
    });

    test.each(['instruction', 'floating-text'])('optional %s failure cannot remove the earned bonus', feedback => {
        const f = encounter(), { scene } = f;
        try {
            const fail = () => { throw Error('fictional optional cue failure'); };
            if (feedback === 'instruction') scene.showBossAttackInstruction.mockImplementation(fail);
            else scene.showFloatingText.mockImplementation(fail);
            expect(() => scene.openReefBossRecovery(850)).not.toThrow();
            expect(scene.damageBoss(2)).toBe(true); expect(scene.bossHealth).toBe(97);
        } finally { f.close(); }
    });

    test('required native timer failure remains an error and does not announce an opening', () => {
        const f = encounter(), { scene } = f;
        try {
            jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(() => { throw Error('fictional required timer failure'); });
            expect(() => scene.openReefBossRecovery(850)).toThrow('fictional required timer failure');
            expect(scene.showBossAttackInstruction).not.toHaveBeenCalled();
            expect(scene.reefGuardianControl.remaining('recovery')).toBe(0);
            expect(scene.bossHealth).toBe(100);
        } finally { f.close(); }
    });

    test.each([0, -1, NaN, Infinity])('invalid damage %s never increases or corrupts health', amount => {
        const f = encounter(), { scene } = f;
        try {
            scene.openReefBossRecovery(850);
            expect(scene.damageBoss(amount)).toBe(false); expect(scene.bossHealth).toBe(100);
        } finally { f.close(); }
    });

    test('phase entry retires the previous window and shutdown releases only owned timers', () => {
        const f = encounter(), { scene } = f;
        try {
            const unrelated = f.clock.delayedCall(10000, () => {});
            scene.openReefBossRecovery(850); const control = scene.reefGuardianControl;
            scene.enterReefBossPhase(2);
            expect(control.remaining('recovery')).toBe(0);
            f.advance(950); expect(control.remaining('recovery')).toBe(950);
            expect(control.remaining('phaseGrace')).toBe(1200);
            scene.events.emit('shutdown');
            expect(control.timers.size).toBe(0); expect(scene.bossRecoveryTimer).toBeNull();
            expect(scene.bossPhaseAdvanceTimer).toBeNull();
            expect(unrelated.callback).toBeInstanceOf(Function);
        } finally { f.close(); }
    });
});
