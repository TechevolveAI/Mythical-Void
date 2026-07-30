const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadService({
    featureEnabled = true,
    ageEligible = true,
    existingPortrait = null,
    fetchImpl = null
} = {}) {
    const filePath = path.join(
        __dirname,
        '../systems/LivingPortraitService.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            'export { LivingPortraitService };',
            'module.exports = { LivingPortraitService, livingPortraitService };'
        )
        .replace('export default livingPortraitService;', '');
    let portrait = existingPortrait;
    const gameState = {
        getCreaturePortrait: jest.fn(() => portrait),
        saveCreaturePortrait: jest.fn(record => {
            portrait = { ...record, status: 'ready', aiGenerated: true };
            return true;
        }),
        emit: jest.fn()
    };
    const fetchMock = fetchImpl || jest.fn(async () => ({
        ok: true,
        json: async () => ({
            success: true,
            status: 'succeeded',
            imageUrl: 'https://replicate.delivery/portrait.webp',
            provider: 'replicate',
            model: 'openai/gpt-image-2',
            storage: 'provider-temporary'
        })
    }));
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        fetch: fetchMock,
        setTimeout,
        clearTimeout,
        Date,
        Promise,
        Map,
        window: {
            APIConfig: {
                isEnabled: jest.fn(() => featureEnabled)
            },
            CloudSaveManager: {
                isAgeGroupEligible: jest.fn(() => ageEligible)
            },
            localStorage: {
                getItem: jest.fn(() => 'age_18_plus')
            },
            CreaturePortraitSpec: {
                create: jest.fn(() => ({
                    schemaVersion: 1,
                    promptVersion: 'living-portrait-v1',
                    identityKey: 'creature-1:baby:abc123',
                    creatureId: 'creature-1',
                    stage: 'baby',
                    rarity: 'rare',
                    species: 'stellarWyrm',
                    palette: { body: '#112233' }
                })),
                isValid: jest.fn(() => true)
            },
            GameState: gameState
        }
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    const service = new sandbox.module.exports.LivingPortraitService();
    return { service, fetchMock, gameState };
}

describe('background living portrait generation', () => {
    const creatureData = {
        name: 'Nova',
        stage: 'baby',
        genes: { id: 'creature-1' }
    };

    test('does not start automatic generation when the feature is disabled', () => {
        const { service, fetchMock } = loadService({ featureEnabled: false });

        expect(service.prewarm({ creatureData })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('does not start automatic generation for an under-16 profile', () => {
        const { service, fetchMock } = loadService({ ageEligible: false });

        expect(service.prewarm({ creatureData })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('deduplicates hatch and modal requests for the same creature stage', async () => {
        const { service, fetchMock, gameState } = loadService();

        const hatchJob = service.prewarm({ creatureData, source: 'post_hatch' });
        const modalJob = service.generate({ creatureData, source: 'portrait_modal' });
        const [hatchPortrait, modalPortrait] = await Promise.all([
            hatchJob,
            modalJob
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(gameState.saveCreaturePortrait).toHaveBeenCalledTimes(1);
        expect(hatchPortrait.imageUrl).toBe(
            'https://replicate.delivery/portrait.webp'
        );
        expect(modalPortrait).toEqual(hatchPortrait);
    });

    test('the naming flow prewarms before submission and reveals without blocking play', () => {
        const soulSource = fs.readFileSync(
            path.join(__dirname, '../scenes/SoulRevealScene.js'),
            'utf8'
        );

        expect(soulSource.indexOf('this.beginLivingPortraitPrewarm();')).toBeLessThan(
            soulSource.indexOf('    finalizeName() {')
        );
        expect(soulSource).toContain('LIVING FORM // RESOLVING');
        expect(soulSource).toContain('this.showLivingPortraitHandoff(finalName)');
        expect(soulSource).toContain('ENTER SANCTUARY');
        expect(soulSource).toContain(
            'The portrait is still forming. Continue now'
        );
    });
});
