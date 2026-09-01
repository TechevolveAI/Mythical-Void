const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('expedition diagnostics gameplay contract', () => {
    const diagnostics = read('systems/ExpeditionDiagnostics.js');
    const hub = read('scenes/HubWorldScene.js');
    const game = read('game.js');

    test('uses installed systems as progressive diagnostic gates', () => {
        expect(diagnostics).toContain(
            "completed.has('propulsion_control')"
        );
        expect(diagnostics).toContain(
            "completed.has('resonance_hull')"
        );
        expect(diagnostics).toContain(
            "completed.has('uplink_hold')"
        );
        expect(diagnostics).toContain(
            "completed.has('black_box_recovery')"
        );
    });

    test('keeps route choice local and explicitly non-transmitting', () => {
        expect(diagnostics).toContain(
            'WANDERER-77 LOCAL SCAN // NOTHING SENT TO EARTH'
        );
        expect(hub).toContain('getGateDiagnostics(gateId)');
        expect(hub).toContain('diagnostics.lines.forEach');
        expect(hub).toContain(
            "diagnostics.statusLabel.replace('WANDERER-77', 'W77')"
        );
        expect(hub).not.toContain('transmitExpeditionDiagnostics');
        expect(diagnostics).not.toContain('.set(');
        expect(diagnostics).not.toContain('.save(');
    });

    test('provides a local non-mutating responsive preview', () => {
        expect(game).toContain("'diagnostics'");
        expect(hub).toContain(
            "this.progressionPreview === 'diagnostics'"
        );
        expect(hub).toContain('reconstructionSnapshot: {');
        expect(hub).toContain('regionSnapshot: {');
        expect(hub).toContain("solarActivity: 'active'");
    });
});
