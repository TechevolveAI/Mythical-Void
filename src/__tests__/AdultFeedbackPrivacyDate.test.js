const isCurrentPrivacyDate = require('../../scripts/company/is-current-privacy-date.cjs');

describe('adult feedback privacy notice date', () => {
    test.each(['2026-09-08', '2026-10-23', '2026-10-24'])('accepts the original or a newer notice: %s', value => {
        expect(isCurrentPrivacyDate(value, '2026-10-24')).toBe(true);
    });
    test.each([undefined, '', 'yesterday', '2026-09-31', '2026-09-07', '2026-10-25'])('rejects a missing, invalid, older or future notice: %s', value => {
        expect(isCurrentPrivacyDate(value, '2026-10-24')).toBe(false);
    });
});
