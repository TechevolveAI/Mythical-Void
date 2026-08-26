const fs = require('fs');
const {
    paths,
    readJson,
    validate
} = require('../../scripts/company/validate-authentic-gameplay-social-kit.cjs');

describe('authentic gameplay social kit contract', () => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const values = {
        manifest: readJson(paths.manifest),
        captions: readJson(paths.captions),
        release: readJson(paths.release),
        sourceManifest: readJson(paths.sourceManifest),
        pressAssets: readJson(paths.pressAssets),
        signal: readJson(paths.signal),
        pressSource: fs.readFileSync(paths.pressSource, 'utf8'),
        llms: fs.readFileSync(paths.llms, 'utf8')
    };

    test('ships three source-bound formats without opening external publication', () => {
        const result = validate(clone(values));
        expect(result).toEqual(expect.objectContaining({
            valid: true,
            assetCount: 3,
            captionCount: 3,
            cleanDestination: 'https://mythicalvoid.com/playable-now/',
            externalPublicationAuthorized: false,
            failures: []
        }));
    });

    test('rejects tracked links and external posting authority', () => {
        const changed = clone(values);
        changed.captions.drafts[0].caption += '?utm_source=unknown';
        changed.manifest.authority.externalSocialPublicationAuthorized = true;
        const result = validate(changed);
        expect(result.valid).toBe(false);
        expect(result.failures.length).toBeGreaterThanOrEqual(2);
    });
});
