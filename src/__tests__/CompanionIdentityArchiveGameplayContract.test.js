const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Companion identity archive gameplay contract', () => {
    const system = read('systems/CompanionIdentityArchive.js');
    const modal = read('ui/CompanionIdentityArchiveModal.js');
    const profile = read('scenes/CreatureProfileScene.js');
    const gameState = read('systems/GameState.js');
    const fieldKit = read('systems/ProjectBeaconFieldKit.js');
    const legacy = read('systems/CampaignLegacy.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');
    const css = read('styles/main.css');

    test('joins the canonical identity sources without media URL transfer', () => {
        expect(system).toContain('buildCreaturePowerProfile(gameState)');
        expect(system).toContain('creature.portraits');
        expect(system).toContain('creature.lineage');
        expect(system).toContain('creature.powerHistory');
        expect(system).toContain('sensei.memoryLedger.history');
        expect(system).toContain('fieldKit.katana');
        expect(system).toContain('getCompanionFieldMemories');
        expect(system).toContain("label: 'FIELD MEMORIES'");
        expect(system).toContain('MAX_FIELD_MEMORIES');
        expect(system).toContain("'temporary_image_url'");
        expect(system).not.toMatch(
            /visualIdentity:\s*\{[\s\S]{0,120}imageUrl/
        );
    });

    test('makes the archive part of the Creature Profile workflow', () => {
        expect(profile).toContain('SHARED COMPANION RECORD');
        expect(profile).toContain('openIdentityArchive');
        expect(profile).toContain(
            'getCompanionIdentityArchiveSnapshot'
        );
        expect(profile).toContain(
            'recordCompanionIdentityChapter'
        );
        expect(profile).toContain(
            'this.identityArchiveModal?.destroy?.()'
        );
        expect(profile).toContain('showCompanionFieldMemoryReplay');
        expect(profile).toContain(
            'PRIVATE FIELD MEMORY // EXACT COMPANION ART'
        );
        expect(profile).toContain('createCinematicStill?.(this, {');
        expect(profile).toContain("imageUrl: '/marketing/nova.webp'");
    });

    test('uses accessible responsive controls and the requested livery', () => {
        expect(modal).toContain(
            'FEND CURRENT ARCHIVE // COMPANION RECORD'
        );
        expect(modal).toContain('PRIVATE // NO ACCOUNT IDENTITY');
        expect(modal).toContain(
            'NAME IS THE ONLY PLAYER-AUTHORED FIELD'
        );
        expect(modal).toContain('REPLAY LATEST //');
        expect(modal).toContain('this.onReplay?.(latestMemory)');
        expect(modal).toContain("close.setAttribute('aria-label'");
        expect(css).toContain('.companion-archive-action');
        expect(css).toContain('.companion-archive-memory-action');
        expect(css).toContain('min-height: 50px');
        expect(css).toContain(
            '@container companion-archive (max-width: 640px)'
        );
        expect(css).toContain('#d72638 0 25%');
        expect(css).toContain('#138a36 75% 100%');
        expect(modal.indexOf('this.root.style.width')).toBeLessThan(
            modal.indexOf('this.scene.add.dom')
        );
    });

    test('preserves archive state across switching and attributes katana witnesses', () => {
        expect(gameState).toContain("'identityArchive'");
        expect(gameState).toContain(
            'identityArchive: normalizeIdentityArchive'
        );
        expect(fieldKit).toContain('witnessCompanionId:');
        expect(legacy).toContain(
            'buildPortableCompanionRecord(gameState)'
        );
        expect(legacy).toContain(
            'export const CAMPAIGN_LEGACY_SCHEMA_VERSION = 16'
        );
    });

    test('records shared lineage without exposing the peer identity', () => {
        expect(system).toContain(
            "lineage?.origin === 'shared_fusion'"
        );
        expect(system).toContain("'LINKED SIBLING'");
        expect(system).toContain("'bounded_signal_only'");
        expect(system).toContain("'remote_sibling_id'");
        expect(system).toContain(
            'The sibling and keeper remain private.'
        );
    });

    test('provides local non-saving previews for every archive chapter', () => {
        expect(game).toContain(
            "'testIdentityArchive'"
        );
        expect(game).toContain(
            'identityArchivePreview: testIdentityArchive'
        );
        expect(game).toContain("'shared_inheritance'");
        expect(profile).toContain(
            "this.identityArchivePreviewSize === 'mobile'"
        );
        expect(profile).toContain(
            "momentId: 'first_living_form'"
        );
        expect(profile).toContain(
            "'guardian_debrief_elder_treant'"
        );
        expect(hatching).toContain(
            "previewParams.has('testIdentityArchive')"
        );
    });
});
