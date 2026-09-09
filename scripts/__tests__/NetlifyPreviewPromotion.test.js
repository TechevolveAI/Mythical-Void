const {
    MAX_PUBLICATIONS_PER_24_HOURS,
    SITE_ID,
    evaluatePromotion,
    isPlayerFacingPath,
    parseArguments,
    recentPublications
} = require('../company/netlify-preview-promotion.cjs');
const fs = require('node:fs');
const path = require('node:path');

const sourceCommit = 'a'.repeat(40);
const mergeCommit = 'b'.repeat(40);
const previewDeployId = 'c'.repeat(24);
const mainDeployId = 'd'.repeat(24);

function validEvidence() {
    return {
        sourceCommit,
        mergeCommit,
        previewDeployId,
        mainDeployId,
        sourceTree: 'tree-1',
        mergeTree: 'tree-1',
        sourceIsAncestor: true,
        changedFiles: ['src/main.js', 'index.html'],
        previewDeploy: {
            id: previewDeployId,
            site_id: SITE_ID,
            state: 'ready',
            context: 'deploy-preview',
            commit_ref: sourceCommit,
            review_id: 238,
            published_at: null,
            created_at: '2026-09-09T00:45:27.719Z',
            deploy_validations_report: {
                secret_scan_result: {
                    secretsScanMatches: [],
                    enhancedSecretsScanMatches: []
                }
            }
        },
        mainDeploy: {
            id: mainDeployId,
            site_id: SITE_ID,
            state: 'error',
            context: 'production',
            branch: 'main',
            commit_ref: mergeCommit,
            skipped: true,
            error_message: 'Skipped due to account credit usage exceeded',
            created_at: '2026-09-09T00:47:38.198Z'
        },
        site: {
            id: SITE_ID,
            disabled: false
        },
        siteDeploys: [],
        now: new Date('2026-09-09T01:00:00.000Z')
    };
}

describe('guarded Netlify preview promotion', () => {
    test('accepts only a source-identical, reviewed, clean preview after a credit-only main skip', () => {
        expect(evaluatePromotion(validEvidence())).toMatchObject({ ready: true, externalActionTaken: false });
    });

    test.each([
        ['different merge tree', input => { input.mergeTree = 'tree-2'; }, 'exact reviewed source tree'],
        ['unrelated source', input => { input.sourceIsAncestor = false; }, 'not an ancestor'],
        ['no player-facing change', input => { input.changedFiles = ['docs/company/operations/current-state.json']; }, 'no player-facing'],
        ['failed preview', input => { input.previewDeploy.state = 'error'; }, 'not ready'],
        ['wrong preview commit', input => { input.previewDeploy.commit_ref = 'e'.repeat(40); }, 'reviewed source commit'],
        ['unreviewed preview', input => { input.previewDeploy.review_id = null; }, 'not tied to a pull request'],
        ['already published preview', input => { input.previewDeploy.published_at = '2026-09-09T00:48:24.738Z'; }, 'already been published'],
        ['secret match', input => { input.previewDeploy.deploy_validations_report.secret_scan_result.secretsScanMatches = [{}]; }, 'secret scan'],
        ['wrong main commit', input => { input.mainDeploy.commit_ref = 'f'.repeat(40); }, 'protected-main merge'],
        ['ordinary failed build', input => { input.mainDeploy.skipped = false; }, 'not explicitly skipped'],
        ['different skip reason', input => { input.mainDeploy.error_message = 'Build command failed'; }, 'not skipped solely'],
        ['stale main attempt', input => { input.mainDeploy.created_at = '2026-09-08T23:00:00.000Z'; }, 'predates'],
        ['disabled site', input => { input.site.disabled = true; }, 'site is disabled'],
        ['exhausted release budget', input => {
            input.siteDeploys = Array.from({ length: MAX_PUBLICATIONS_PER_24_HOURS }, (_, index) => ({
                published_at: `2026-09-09T00:0${index}:00.000Z`
            }));
        }, 'release budget is exhausted']
    ])('refuses %s', (_label, mutate, expected) => {
        const evidence = validEvidence();
        mutate(evidence);
        const result = evaluatePromotion(evidence);
        expect(result.ready).toBe(false);
        expect(result.failures.join(' ')).toContain(expected);
    });

    test('requires exact commit and deploy IDs', () => {
        expect(() => parseArguments(['--source-commit', 'main'])).toThrow('40-character');
        expect(() => parseArguments([
            '--source-commit', sourceCommit,
            '--merge-commit', mergeCommit,
            '--preview-deploy', 'short',
            '--main-deploy', mainDeployId
        ])).toThrow('24-character');
    });

    test('recognises player-facing paths conservatively', () => {
        expect(isPlayerFacingPath('src/main.js')).toBe(true);
        expect(isPlayerFacingPath('public/updates/index.html')).toBe(true);
        expect(isPlayerFacingPath('docs/company/operations/current-state.json')).toBe(false);
        expect(isPlayerFacingPath('scripts/company/private-check.cjs')).toBe(false);
    });

    test('counts only completed publications inside the previous 24 hours', () => {
        const result = recentPublications([
            { published_at: '2026-09-09T00:30:00.000Z' },
            { published_at: '2026-09-08T00:59:59.000Z' },
            { published_at: null },
            { published_at: '2026-09-09T01:01:00.000Z' }
        ], new Date('2026-09-09T01:00:00.000Z'));
        expect(result).toHaveLength(1);
    });

    test('keeps the operator command dry-run first and documents the live check', () => {
        const root = path.resolve(__dirname, '..', '..');
        const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        const runbook = fs.readFileSync(path.join(root, 'docs/company/operations/NETLIFY_PREVIEW_PROMOTION_RUNBOOK.md'), 'utf8');
        const source = fs.readFileSync(path.join(root, 'scripts/company/netlify-preview-promotion.cjs'), 'utf8');
        expect(packageJson.scripts['plan:netlify-promotion']).toBe('node scripts/company/netlify-preview-promotion.cjs');
        expect(runbook).toContain('This command is a dry run. It does not publish anything.');
        expect(runbook).toContain('independently open the live page on phone and desktop');
        expect(runbook).toContain('Never schedule `--promote`');
        expect(source).toContain('if (!options.promote)');
    });
});
