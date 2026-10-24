const { dateInDublin } = require('./validate-sitemap-freshness.cjs');

module.exports = function isCurrentPrivacyDate(value, today = dateInDublin()) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return false;
    // The feedback notice was introduced on this date. Later notices remain valid.
    return value >= '2026-09-08' && value <= today;
};
