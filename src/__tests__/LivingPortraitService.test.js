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
            jobId: '824363b2-d374-4b44-bf7f-1d7a177fa074',
            imageUrl: 'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/portrait',
            provider: 'replicate',
            model: 'openai/gpt-image-2',
            storage: 'supabase-private',
            expiresAt: Date.now() + 60000
        })
    }));
    const auth = {
        getSession: jest.fn(async () => ({
            data: {
                session: { access_token: 'private-session-token' }
            },
            error: null
        })),
        signInAnonymously: jest.fn()
    };
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
            CloudSave: {
                client: { auth }
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
    return { service, fetchMock, gameState, auth };
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
            'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/portrait'
        );
        expect(modalPortrait).toEqual(hatchPortrait);
        const request = fetchMock.mock.calls[0][1];
        expect(request.headers.Authorization).toBe(
            'Bearer private-session-token'
        );
        expect(JSON.parse(request.body).ageGroup).toBe('age_18_plus');
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
