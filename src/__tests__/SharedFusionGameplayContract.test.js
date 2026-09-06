const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Shared Fusion gameplay contract', () => {
    const service = read('systems/SharedFusionInvitationService.js');
    const consent = read('systems/FusionConsent.js');
    const gameState = read('systems/GameState.js');
    const pod = read('scenes/FusionPodScene.js');
    const modal = read('ui/SharedFusionModal.js');
    const css = read('styles/main.css');
    const game = read('game.js');

    test('shows one protected link command only to eligible cloud profiles', () => {
        expect(pod).toContain('isSharedFusionAvailable');
        expect(pod).toContain(
            '.getSharedFusionAvailability?.('
        );
        expect(pod).toContain(
            'createSharedFusionButton'
        );
        expect(pod).toContain("'LINK'");
        expect(service).toContain(
            "if (!ageEligible) reason = 'age_restricted'"
        );
        expect(service).toContain(
            "else if (!cloudEnabled) reason = 'cloud_save_required'"
        );
    });

    test('supports a one-companion shared path without weakening local Fusion', () => {
        expect(pod).toContain(
            'sharedFusionAvailable && adultCreatures.length >= 1'
        );
        expect(pod).toContain(
            'window.FusionConsent'
        );
        expect(consent).toContain(
            'getFusionCompanionReadiness'
        );
        expect(pod).toContain(
            'this.createBreedButton(width, height)'
        );
        expect(pod).toContain(
            'this.createSharedFusionButton()'
        );
        expect(pod).toContain('this.isSharedFusionAvailable() ||');
        expect(pod).toContain('this.isSharedGuardianshipAvailable()');
        expect(pod).toContain(') ? 65 : 0');
        expect(pod).toContain(
            'const actionX = this.layout.action.x + sharedLinkLane'
        );
    });

    test('implements private create, join, review, confirmation, naming, and recovery', () => {
        [
            'CREATE PRIVATE CODE',
            'PAIR CREATURES',
            'CONFIRM THIS PAIRING',
            'STABILIZING LINKED SIBLINGS',
            'SECURE NAME',
            'RESTORING PROTECTED LINK',
            'MEET IN SANCTUARY'
        ].forEach(copy => expect(modal).toContain(copy));
        expect(modal).toContain('this.service.create');
        expect(modal).toContain('this.service.join');
        expect(modal).toContain('this.service.confirm');
        expect(modal).toContain('this.service.execute');
        expect(modal).toContain('this.service.submitName');
        expect(modal).toContain('this.startPolling()');
        expect(modal).toContain(
            'breedingShrine.sharedFusion.activeInvitation'
        );
    });

    test('does not create a communication or peer-identity surface', () => {
        expect(modal).toContain(
            'NO CHAT // NO SEARCH // NO CREATURE TRANSFER'
        );
        expect(service).toContain("'public_matchmaking'");
        expect(service).toContain("'player_search'");
        expect(service).toContain("'location_sharing'");
        expect(modal).not.toContain('peer.name');
        expect(modal).not.toContain('keeperName');
        expect(modal).not.toContain('messageInput');
    });

    test('blocks local Fusion while a shared invitation is unresolved', () => {
        expect(gameState).toContain('sharedFusionPending');
        expect(gameState).toContain('!sharedFusionPending');
        expect(gameState).toContain(
            'getPendingSharedFusionReveal'
        );
        expect(gameState).toContain(
            'acknowledgeSharedFusionReveal'
        );
    });

    test('provides accessible responsive DOM controls above the canvas', () => {
        expect(modal).toContain(
            "this.root.setAttribute('role', 'dialog')"
        );
        expect(modal).toContain(
            "this.root.setAttribute('aria-modal', 'true')"
        );
        expect(modal).toContain(
            "code.setAttribute(\n                'aria-label'"
        );
        expect(css).toContain('.shared-fusion-modal');
        expect(css).toContain('container-name: shared-fusion');
        expect(css).toContain(
            '@container shared-fusion (max-width: 520px)'
        );
        expect(css).toContain('min-height: 48px');
        expect(css).toContain('.shared-fusion-name-input');
    });

    test('provides local-only previews for every protected-link state', () => {
        expect(game).toContain("const testSharedFusion = urlParams.get('testSharedFusion')");
        [
            'pod',
            'home',
            'waiting',
            'paired',
            'staged',
            'reveal'
        ].forEach(state => expect(game).toContain(`'${state}'`));
        expect(game).toContain('isLocalPreview &&');
        expect(game).toContain('new SharedFusionModal(scene');
        expect(game).not.toContain('peerKeeperName');
    });
});
