/** @jest-environment node */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { validateFinalVoidFilms } = require('../validate-final-void-films.cjs');

describe('Final Void film publication gate', () => {
    let root;
    let manifest;
    let manifestPath;
    const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-film-gate-'));
        fs.mkdirSync(path.join(root, 'src/config'), { recursive: true });
        fs.mkdirSync(path.join(root, 'public/game/cinematics'), { recursive: true });
        const bytes = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112]);
        fs.writeFileSync(path.join(root, 'public/game/cinematics/test.mp4'), bytes);
        fs.writeFileSync(path.join(root, 'provenance.md'), 'Private test fixture, not approved artwork.');
        const film = {
            approved: true,
            asset: { url: '/game/cinematics/test.mp4', bytes: bytes.length, durationSeconds: 8, sha256: crypto.createHash('sha256').update(bytes).digest('hex') },
            review: { reviewer: 'Test reviewer', provenancePath: 'provenance.md' }
        };
        manifest = { schemaVersion: 1, encounterId: 'trumptopus', enabled: true, films: { arrival: structuredClone(film), victory: structuredClone(film) } };
        manifestPath = path.join(root, 'src/config/final-void-films.json');
        save();
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    test('requires both approved media files and their exact digests', () => {
        expect(validateFinalVoidFilms(root, { requireReady: true }).ready).toBe(true);
        manifest.films.arrival.asset.sha256 = 'f'.repeat(64);
        save();
        expect(validateFinalVoidFilms(root).problems).toContain('arrival: incorrect digest');
    });

    test('normal builds tolerate a disabled future feature but never an enabled placeholder', () => {
        manifest.enabled = false;
        manifest.films.arrival = { approved: false, asset: null };
        save();
        expect(validateFinalVoidFilms(root).problems).toEqual([]);
        expect(validateFinalVoidFilms(root, { requireReady: true }).problems).toContain('arrival: reviewed film missing');
        manifest.enabled = true;
        save();
        expect(validateFinalVoidFilms(root).problems).toContain('arrival: reviewed film missing');
    });

    test('rejects outside and traversal paths', () => {
        for (const url of ['https://elsewhere.test/movie.mp4', '/game/cinematics/../movie.mp4']) {
            manifest.films.arrival.asset.url = url;
            save();
            expect(validateFinalVoidFilms(root).problems).toContain('arrival: invalid asset path');
        }
    });

    test('does not treat successful generation as human review', () => {
        delete manifest.films.victory.review;
        save();
        expect(validateFinalVoidFilms(root).problems).toContain('victory: review/provenance missing');
    });

    test('checks actual file existence and size', () => {
        manifest.films.arrival.asset.bytes = 99;
        manifest.films.victory.asset.url = '/game/cinematics/missing.mp4';
        save();
        expect(validateFinalVoidFilms(root).problems).toEqual(['arrival: incorrect size/budget', 'victory: file missing']);
    });
});

describe('studio-only Trumptopus generation definitions', () => {
    const plan = require('../cinematics/final-void-shots.json');

    test('keeps approved character direction separate from player-creature media', () => {
        expect(plan.providerScope).toBe('studio-authored-boss-films-not-player-media');
        expect(Object.keys(plan.definitions)).toEqual(['finalVoidArrival', 'finalVoidBanishment', 'finalVoidRecovery']);
        for (const definition of Object.values(plan.definitions)) {
            expect(definition.approvalRequired).toBe(true);
            expect(definition.approved).toBe(false);
            expect(definition.referenceImage).toBe(null);
        }
        expect(plan.definitions.finalVoidBanishment.prompt).toContain('disappears completely into the Void');
        expect(plan.definitions.finalVoidBanishment.prompt).toContain('Show defeat, not healing');
    });

    test('generation is blocked before credential lookup/provider work until the reference is approved', () => {
        const result = spawnSync(process.execPath, [path.resolve(__dirname, '../generate-cinematic-assets.mjs'), '--asset=finalVoidArrival'], {
            cwd: path.resolve(__dirname, '../..'), encoding: 'utf8',
            env: { ...process.env, GEMINI_API_KEY: '' }, timeout: 10000
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('approved source reference is required');
        expect(result.stderr).not.toContain('GEMINI_API_KEY is required');
        expect(result.stdout).not.toContain('starting Veo');
    });
});
