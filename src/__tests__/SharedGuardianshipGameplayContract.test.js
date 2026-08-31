const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Shared Guardianship gameplay contract', () => {
    const config = JSON.parse(read('config/sharedGuardianship.json'));
    const pod = read('scenes/FusionPodScene.js');
    const sanctuary = read('scenes/GameScene.js');
    const modal = read('ui/SharedGuardianshipModal.js');
    const care = read('ui/SharedCreatureCareModal.js');
    const css = read('styles/main.css');
    const legal = read('site/storefront.js');

    test('keeps story, levels, chat and public discovery outside MVP', () => {
        expect(config).toEqual(expect.objectContaining({
            storyIntegration: false,
            levelIntegration: false,
            chat: false,
            publicDiscovery: false,
            onlinePresence: false,
            freeformPeerText: false
        }));
    });

    test('offers the protected flow through Fusion while preserving legacy Fusion', () => {
        expect(pod).toContain('isSharedGuardianshipAvailable');
        expect(pod).toContain('window.SharedGuardianship?.isEnabled?.()');
        expect(pod).toContain('new SharedGuardianshipModal(this)');
        expect(pod).toContain("sharedGuardianshipAvailable ? 'SHARE' : 'LINK'");
        expect(pod).toContain('this.isSharedFusionAvailable()');
    });

    test('explains one creature, two devices, eligibility and exact consent', () => {
        expect(modal).toContain('One creature. Two Sanctuaries.');
        expect(modal).toContain('I am 16 or older');
        expect(modal).toContain('I understand this creates one shared creature');
        expect(modal).toContain("privacyLink.href = '/privacy/'");
        expect(modal).toContain("termsLink.href = '/terms/'");
        expect(modal).not.toContain('messageInput');
    });

    test('shows one canonical creature in Sanctuary with connection-safe care', () => {
        expect(sanctuary).toContain('initializeSharedGuardianshipHabitat');
        expect(sanctuary).toContain('refreshAll()');
        expect(sanctuary).toContain('SHARED HABITAT // TAP TO CARE');
        expect(sanctuary).toContain('createRandomizedSpaceMythicCreature');
        expect(care).toContain('This is the same creature in both Sanctuaries.');
        expect(care).toContain('Mute optional shared activity notices');
        expect(care).toContain('The other guardian keeps the creature.');
    });

    test('has a bounded mobile layout and durable account recovery surface', () => {
        expect(css).toContain('@media (max-width: 520px)');
        expect(css).toContain('.durable-account-recovery');
        expect(css).toContain('min-height: 44px');
    });

    test('public privacy and terms explain the connected feature plainly', () => {
        expect(legal).toContain('<h2>Shared Guardianship</h2>');
        expect(legal).toContain('requires a verified email account');
        expect(legal).toContain('has no chat, public profile, player search');
        expect(legal).toContain('A guardian may leave');
    });
});
