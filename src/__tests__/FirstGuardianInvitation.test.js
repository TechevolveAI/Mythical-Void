const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function loadShareModule() {
    const source = read('utils/GuardianRestorationShare.js')
        .replace(
            'export const GUARDIAN_RESTORATION_SHARE_DATA',
            'const GUARDIAN_RESTORATION_SHARE_DATA'
        )
        .replace(
            'export async function shareGuardianRestoration',
            'async function shareGuardianRestoration'
        )
        .concat(
            '\nmodule.exports = { GUARDIAN_RESTORATION_SHARE_DATA, shareGuardianRestoration };\n'
        );
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

describe('first Guardian invitation', () => {
    test('shares one clean public invitation with no player or tracking data', () => {
        const { GUARDIAN_RESTORATION_SHARE_DATA } = loadShareModule();
        expect(GUARDIAN_RESTORATION_SHARE_DATA).toEqual({
            title: 'Mythical Void — the first Guardian is free',
            text: 'I helped free the first Guardian in Mythical Void. Hatch an alien creature and see how your journey begins.',
            url: 'https://mythicalvoid.com/hatch-challenge/'
        });
        expect(JSON.stringify(GUARDIAN_RESTORATION_SHARE_DATA)).not.toMatch(
            /[?&](?:utm_|ref|player|creature|save|recipient)=/i
        );
    });

    test('prefers the device share sheet', async () => {
        const {
            GUARDIAN_RESTORATION_SHARE_DATA,
            shareGuardianRestoration
        } = loadShareModule();
        const navigatorValue = {
            share: jest.fn().mockResolvedValue(undefined),
            clipboard: { writeText: jest.fn() }
        };

        await expect(shareGuardianRestoration(navigatorValue)).resolves.toBe('shared');
        expect(navigatorValue.share).toHaveBeenCalledWith(
            GUARDIAN_RESTORATION_SHARE_DATA
        );
        expect(navigatorValue.clipboard.writeText).not.toHaveBeenCalled();
    });

    test('copies only the clean Hatch Challenge address when sharing is unavailable', async () => {
        const { shareGuardianRestoration } = loadShareModule();
        const navigatorValue = {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
        };

        await expect(shareGuardianRestoration(navigatorValue)).resolves.toBe('copied');
        expect(navigatorValue.clipboard.writeText).toHaveBeenCalledWith(
            'https://mythicalvoid.com/hatch-challenge/'
        );
    });

    test('offers the invitation once, after the first real Guardian restoration', () => {
        const source = read('scenes/levels/MythicalForestLevel.js');
        const victoryMethod = source.match(
            /showBossVictory\(\)\s*\{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* Override shutdown/
        )?.[1] || '';

        expect(victoryMethod).toContain('completionResult?.firstCompletion === true');
        expect(victoryMethod).toContain("'[ INVITE SOMEONE ]'");
        expect(victoryMethod).toContain('shareGuardianRestoration(window.navigator)');
        expect(victoryMethod).toContain(
            'syncCampaignObjectiveDisplay({ visible: false, force: true })'
        );
        expect(victoryMethod).toContain(
            'combatJuice?.comboDisplay?.setVisible?.(false)'
        );
        expect(victoryMethod.indexOf('completeLevelProgression({')).toBeLessThan(
            victoryMethod.indexOf('shareGuardianRestoration(window.navigator)')
        );
    });

    test('the real Guardian handoff checks both actions are visible and separate', () => {
        const smoke = read('../scripts/smoke-secondary-journeys.js');
        expect(smoke).toContain("item?.text === '[ INVITE SOMEONE ]'");
        expect(smoke).toContain("item?.text === '[ RETURN TO HUB ]'");
        expect(smoke).toContain('actionsOverlap');
        expect(smoke).toContain('actionsInFrame');
        expect(smoke).toContain('first-guardian-invitation-phone.png');
        expect(smoke).toContain('first-guardian-invitation-desktop.png');
        expect(smoke).toMatch(
            /SMOKE_VIEWPORT_WIDTH <= 600 &&\s*completion\.controlsHidden !== true/
        );
    });

    test('does not read game state, storage, contacts, or creature data', () => {
        const source = read('utils/GuardianRestorationShare.js');
        const method = source.match(
            /export async function shareGuardianRestoration\([\s\S]*?\n\}/
        )?.[0] || '';
        expect(method).not.toMatch(
            /GameState|localStorage|sessionStorage|contacts|creature\.|save\.|recipient/i
        );
    });
});
