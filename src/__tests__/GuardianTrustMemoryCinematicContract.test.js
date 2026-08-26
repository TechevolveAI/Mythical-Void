const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Guardian trust-memory cinematic contract', () => {
    const gameScene = read('scenes/GameScene.js');
    const mediaService = read('systems/CompanionMediaService.js');

    test('reuses the exact persisted companion portrait at the synergy milestone', () => {
        expect(gameScene).toContain(
            "const trustMemory = result.reason === 'guardian_synergy_unlocked';"
        );
        expect(gameScene).toContain(
            'window.CompanionMediaService || companionMediaService'
        );
        expect(gameScene).toContain(
            ': `guardian_trust_${result.resident.id}`'
        );
        expect(gameScene).toContain(
            "stage: window.GameState?.get?.('creature.lifecycle.stage') || 'baby'"
        );
        expect(gameScene).toContain('FIRST ALLIANCE // TRUST MEMORY UNLOCKED');
        expect(gameScene).toContain('veilAlpha: expeditionDebrief ? 0.14 : 0.3');
        expect(gameScene).toContain('? expeditionDebrief ? 0.56 : 0.64');
        expect(mediaService).toContain('const portraitRecord = record || prepared?.record ||');
        expect(mediaService).toContain('await this.resolvePortrait(stage)');
        expect(mediaService).toContain('Number(veilAlpha) || 0');
        expect(mediaService).not.toContain('generatePortrait(');
    });

    test('replays the exact portrait as a non-generative expedition memory', () => {
        expect(gameScene).toContain(
            'const companionFieldMemory = trustMemory || expeditionDebrief;'
        );
        expect(gameScene).toContain(
            '? `guardian_debrief_${result.resident.id}`'
        );
        expect(gameScene).toContain(
            'ALLIANCE DEBRIEF // SHARED EXPEDITION MEMORY'
        );
        expect(gameScene).toContain(
            'alpha: expeditionDebrief ? 0.9 : 0.82'
        );
        expect(gameScene).toContain(
            'veilAlpha: expeditionDebrief ? 0.14 : 0.3'
        );
        expect(mediaService).toContain(
            'const portraitRecord = record || prepared?.record ||'
        );
        expect(mediaService).not.toContain('generatePortrait(');
    });

    test('keeps portrait loading non-blocking and destroys stale motion stills', () => {
        expect(gameScene).toContain(
            'mediaService?.createStoryMoment || mediaService?.createCinematicStill'
        );
        expect(gameScene).toContain('Promise.resolve((');
        expect(gameScene).toContain('?.call(mediaService, this, {');
        expect(gameScene).toContain('this.guardianTrustCinematicRequest === cinematicRequest');
        expect(gameScene).toContain('this.guardianTrustCinematic?.destroy?.();');
        expect(gameScene).toContain('Stored portrait continuity is an enhancement, never a blocker.');
        expect(gameScene).toContain("imageUrl: '/marketing/nova.webp'");
        expect(gameScene).toContain("storage: 'preview'");
    });
});
