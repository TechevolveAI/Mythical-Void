const fs = require('fs');
const path = require('path');

describe('Homecoming handoff gameplay integration', () => {
    const handoffSource = fs.readFileSync(
        path.join(__dirname, '../systems/HomecomingHandoff.js'),
        'utf8'
    );
    const gameSceneSource = fs.readFileSync(
        path.join(__dirname, '../scenes/GameScene.js'),
        'utf8'
    );
    const boardSource = fs.readFileSync(
        path.join(__dirname, '../ui/ShipEvidenceBoardModal.js'),
        'utf8'
    );
    const gameSource = fs.readFileSync(
        path.join(__dirname, '../game.js'),
        'utf8'
    );

    test('keeps the transfer package derived and non-transmitting', () => {
        expect(handoffSource).toContain(
            "import { buildCampaignLegacyCapsule } from './CampaignLegacy.js';"
        );
        expect(handoffSource).not.toContain("gameState.set(");
        expect(handoffSource).not.toContain('localStorage');
        expect(handoffSource).not.toContain('sessionStorage');
        expect(handoffSource).not.toContain('fetch(');
        expect(handoffSource).toContain(
            "authority: 'unsigned_local'"
        );
        expect(handoffSource).toContain(
            "purpose: 'accidental_corruption_detection'"
        );
        expect(handoffSource).toContain(
            "'server_signature_required_for_cloud_commit'"
        );
    });

    test('checks companion, ecology, equipment, recovery, return, and consent', () => {
        [
            'companion_continuity',
            'living_world_record',
            'earth_equipment',
            'remain_and_defend',
            'protected_return',
            'consent_and_contact'
        ].forEach(requirementId => {
            expect(handoffSource).toContain(
                `id: '${requirementId}'`
            );
        });
        expect(handoffSource).toContain("'DOJO-23-77'");
        expect(handoffSource).toContain(
            "normalized.ship.stealthDescent === 'repaired'"
        );
        expect(handoffSource).toContain(
            'normalized.current.restoredRegions.length ==='
        );
    });

    test('exposes readiness through the existing ship board', () => {
        expect(gameSceneSource).toContain(
            "import { getHomecomingHandoffSnapshot } from '../systems/HomecomingHandoff.js';"
        );
        expect(gameSceneSource).toContain(
            'handoffSnapshotProvider: () => ('
        );
        expect(boardSource).toContain(
            "label: 'LEGACY'"
        );
        expect(boardSource).toContain(
            "title: 'HOMECOMING HANDOFF'"
        );
        expect(boardSource).toContain(
            'Nothing is launched, transmitted, or treated as travel consent.'
        );
        expect(boardSource).toContain(
            "'LOCAL VALIDATION  //  NO TRANSMISSION'"
        );
    });

    test('provides a local read-only responsive preview route', () => {
        expect(gameSource).toContain("'handoff'");
        expect(gameSceneSource).toContain(
            "this.shipEvidencePreview === 'handoff'"
        );
        expect(gameSceneSource).toContain(
            "? 'handoff'"
        );
    });
});
