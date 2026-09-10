const {
    providerSpendApproved
} = require('../smoke-secondary-journeys.js');
const fs = require('fs');
const path = require('path');

describe('secondary journey provider-spend guard', () => {
    test('requires the explicit provider-spend flag', () => {
        expect(providerSpendApproved([])).toBe(false);
        expect(providerSpendApproved(['--allow-provider-spend'])).toBe(true);
    });

    test('keeps synthetic continuity fixtures away from video providers', () => {
        const smoke = fs.readFileSync(
            path.join(__dirname, '../smoke-secondary-journeys.js'),
            'utf8'
        );
        const continuity = smoke.slice(
            smoke.indexOf('async function smokeCreatureContinuity'),
            smoke.indexOf('async function smokeFirstSanctuaryOnboarding')
        );

        expect(continuity).toContain(
            'window.APIConfig.isVideoEnabled = () => false;'
        );
    });
});
