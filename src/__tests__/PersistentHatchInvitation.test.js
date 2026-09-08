const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function loadShareModule() {
    const source = read('utils/HatchChallengeShare.js')
        .replace('export const HATCH_CHALLENGE_SHARE_DATA', 'const HATCH_CHALLENGE_SHARE_DATA')
        .replace('export async function shareHatchChallenge', 'async function shareHatchChallenge')
        .concat('\nmodule.exports = { HATCH_CHALLENGE_SHARE_DATA, shareHatchChallenge };\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        globalThis: {},
        Object,
        Promise
    };
    vm.runInNewContext(source, sandbox);
    return sandbox.module.exports;
}

describe('persistent Hatch Challenge invitation', () => {
    test('uses one clean public invitation with no player or tracking data', () => {
        const { HATCH_CHALLENGE_SHARE_DATA } = loadShareModule();
        expect(HATCH_CHALLENGE_SHARE_DATA).toEqual({
            title: 'The Mythical Void Hatch Challenge',
            text: 'I just hatched an alien creature. Hatch yours from the same starting point, then compare what the creature engine made.',
            url: 'https://mythicalvoid.com/hatch-challenge/'
        });
        expect(JSON.stringify(HATCH_CHALLENGE_SHARE_DATA)).not.toMatch(
            /[?&](?:utm_|ref|player|creature|save|recipient)=/i
        );
    });

    test('prefers the device share sheet', async () => {
        const { HATCH_CHALLENGE_SHARE_DATA, shareHatchChallenge } = loadShareModule();
        const navigatorValue = {
            share: jest.fn().mockResolvedValue(undefined),
            clipboard: { writeText: jest.fn() }
        };
        await expect(shareHatchChallenge(navigatorValue)).resolves.toBe('shared');
        expect(navigatorValue.share).toHaveBeenCalledWith(HATCH_CHALLENGE_SHARE_DATA);
        expect(navigatorValue.clipboard.writeText).not.toHaveBeenCalled();
    });

    test('copies only the clean challenge address when sharing is unavailable', async () => {
        const { shareHatchChallenge } = loadShareModule();
        const navigatorValue = { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } };
        await expect(shareHatchChallenge(navigatorValue)).resolves.toBe('copied');
        expect(navigatorValue.clipboard.writeText).toHaveBeenCalledWith(
            'https://mythicalvoid.com/hatch-challenge/'
        );
    });

    test('treats a closed share sheet as a cancellation rather than an error', async () => {
        const { shareHatchChallenge } = loadShareModule();
        const error = new Error('closed');
        error.name = 'AbortError';
        await expect(shareHatchChallenge({
            share: jest.fn().mockRejectedValue(error)
        })).resolves.toBe('cancelled');
    });

    test('keeps the invitation visible in the normal game menu and first reveal', () => {
        const menu = read('ui/HamburgerMenu.js');
        const reveal = read('ui/LivingFormHandoff.js');
        expect(menu).toContain("key: 'invite', label: 'Invite someone'");
        expect(menu).toContain('action: () => this.inviteSomeone()');
        expect(menu).toContain('shareHatchChallenge(window.navigator)');
        expect(reveal).toContain('shareHatchChallenge(window.navigator)');
    });

    test('does not read game state, storage, contacts, or creature data', () => {
        const source = read('utils/HatchChallengeShare.js');
        const method = source.match(
            /export async function shareHatchChallenge\([\s\S]*?\n\}/
        )?.[0] || '';
        expect(method).not.toMatch(
            /GameState|localStorage|sessionStorage|contacts|creature\.|save\.|recipient/i
        );
    });
});
