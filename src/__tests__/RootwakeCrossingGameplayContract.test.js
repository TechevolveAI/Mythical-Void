const fs = require('fs');
const path = require('path');

const levelSource = fs.readFileSync(
    path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
    'utf8'
);
const smokeSource = fs.readFileSync(
    path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
    'utf8'
);

describe('Rootwake Crossing gameplay contract', () => {
    test('replaces the unexplained first bridge with a five-step playable route', () => {
        expect(levelSource).toContain('const ROOTWAKE_PLATFORM_CONFIGS');
        for (let index = 1; index <= 5; index += 1) {
            expect(levelSource).toContain(`id: 'rootwake-step-${index}'`);
        }
        expect(levelSource).toContain('this.createRootwakeCrossing();');
        expect(levelSource).not.toContain(
            "{ x1: 450, x2: 1050, y: this.levelHeight - 350, type: 'static' }"
        );
        expect(levelSource).toContain("zone.traversalId = config.id;");
        expect(levelSource).toContain('platform.zone.body.enable = true;');
    });

    test('makes the real creature action cause the visible world change', () => {
        expect(levelSource).toContain("action: 'creature_resonance_slam'");
        expect(levelSource).toContain("worldChange: 'five_layer_crossing_raised'");
        expect(levelSource).toContain("setData('rootwakeCreatureAction', 'resonance_slam')");
        expect(levelSource).toContain('this.player?.setVelocityY?.(-340);');
        expect(levelSource).toContain('this.emitRootwakeGravitySeeds(color);');
        expect(levelSource).toContain('this.drawRootwakeWorldState(true);');
        expect(levelSource).toContain("eventId: 'forest_rootwake_crossing'");
        expect(levelSource).toContain("outcome: 'gravity_path_raised'");
    });

    test('keeps the alien event physical, persistent, and inside Phaser', () => {
        expect(levelSource).toContain(
            "phenomenon: 'gravity_seed_rain_rises'"
        );
        expect(levelSource).toContain(".setData('gravityDirection', 'up')");
        expect(levelSource).toContain('startRootwakeGravityWeather()');
        expect(levelSource).toContain('FOREST_ROOTWAKE_STATE_PATH');
        expect(levelSource).toContain('window.GameState.set(FOREST_ROOTWAKE_STATE_PATH');
        expect(levelSource).toContain('getRootwakeCrossingSnapshot()');
        expect(levelSource).not.toContain('generate-ai-art');
        expect(levelSource).not.toContain('generated interpretation');
    });

    test('private capture proves transformation and continuous traversal', () => {
        expect(smokeSource).toContain('smokeRootwakeSequence');
        expect(smokeSource).toContain("SMOKE_MODE === 'rootwake-sequence'");
        expect(smokeSource).toContain("stateBefore.rootwake?.action !== 'creature_resonance_slam'");
        expect(smokeSource).toContain("stateAfter.rootwake?.phenomenon !== 'gravity_seed_rain_rises'");
        expect(smokeSource).toContain('stateAfter.rootwake?.settledPlatformCount !== 5');
        expect(smokeSource).toContain('traversalEvidence.worldTravel < 420');
        expect(smokeSource).toContain('continuousCreatureSamples.some');
    });
});
