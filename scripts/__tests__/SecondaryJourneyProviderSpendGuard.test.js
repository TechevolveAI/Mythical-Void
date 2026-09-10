const {
    providerSpendApproved
} = require('../smoke-secondary-journeys.js');

describe('secondary journey provider-spend guard', () => {
    test('requires the explicit provider-spend flag', () => {
        expect(providerSpendApproved([])).toBe(false);
        expect(providerSpendApproved(['--allow-provider-spend'])).toBe(true);
    });
});
