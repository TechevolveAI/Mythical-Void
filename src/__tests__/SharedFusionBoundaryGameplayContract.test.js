const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Shared Fusion boundary gameplay contract', () => {
    const consent = read('systems/FusionConsent.js');
    const authority = read('systems/FusionAuthority.js');
    const gameState = read('systems/GameState.js');
    const cloud = read('systems/CloudSaveManager.js');
    const pod = read('scenes/FusionPodScene.js');
    const modal = read('ui/FusionConsentModal.js');
    const legacy = read('systems/CampaignLegacy.js');
    const css = read('styles/main.css');
    const migration = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/' +
                '20260731000100_add_fusion_contract_v2.sql'
        ),
        'utf8'
    );

    test('requires an explicit local review and seals social discovery', () => {
        expect(pod).toContain('requestFusionConsent');
        expect(pod).toContain('recordLocalFusionConsent');
        expect(modal).toContain('APPROACHES WILLINGLY');
        expect(modal).toContain('LOCAL SANCTUARY ONLY');
        expect(modal).toContain(
            'both keepers, both companions, and a protected server invitation'
        );
        expect(consent).toContain("'public_matchmaking'");
        expect(consent).toContain("'player_search'");
        expect(authority).toContain(
            "request.consent?.mode !== 'same_save_owner'"
        );
    });

    test('lets the authority select count from capacity', () => {
        expect(authority).toContain('selectOffspringCount');
        expect(authority).toContain('candidateOffspringIds');
        expect(authority).toContain('offspringCapacity');
        expect(migration).toContain('v_twin_roll < 0.08');
        expect(migration).toContain(
            "p_request->'candidateOffspringIds'"
        );
        expect(migration).toContain(
            "'offspringCount', v_existing.offspring_count"
        );
        expect(pod).toContain(
            'this.fusionTransaction.offspringCount === 2'
        );
    });

    test('blocks ordinary cloud upload until an offline receipt reconciles', () => {
        expect(gameState).toContain('reconciliationQueue');
        expect(gameState).toContain("reconciliationStatus:");
        expect(cloud).toContain('reconcileFusionReceipts');
        expect(cloud).toContain('pending_fusion_reconciliation');
        expect(cloud).toContain(
            'Fusion receipt must reconcile before cloud upload.'
        );
        expect(authority).toContain('reconcileOfflineReceipt');
        expect(pod).toContain('VERIFY PRIOR LINEAGE');
        expect(legacy).toContain('fusionBoundary:');
        expect(legacy).toContain(
            'export const CAMPAIGN_LEGACY_SCHEMA_VERSION = 16'
        );
    });

    test('provides responsive accessible consent controls and local QA', () => {
        expect(modal).toContain("root.setAttribute('role', 'dialog')");
        expect(modal).toContain("'RECORD CONSENT'");
        expect(css).toContain('.fusion-consent-confirm');
        expect(css).toContain('min-height: 50px');
        expect(css).toContain(
            '@container fusion-consent (max-width: 520px)'
        );
        expect(read('game.js')).toContain(
            "previewConsentOnly: testFusion === 'consent'"
        );
    });
});
