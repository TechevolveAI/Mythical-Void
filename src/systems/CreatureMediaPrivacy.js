const CREATURE_MEDIA_AGE_GROUPS = Object.freeze([
    'age_under_13',
    'age_13_15',
    'age_16_17',
    'age_18_plus'
]);

function isCreatureMediaAgeGroup(ageGroup) {
    return CREATURE_MEDIA_AGE_GROUPS.includes(String(ageGroup || ''));
}

function getCreatureMediaEligibility() {
    if (!window.APIConfig?.isEnabled?.()) {
        return { eligible: false, reason: 'feature_disabled' };
    }
    let ageGroup = null;
    try {
        ageGroup = window.localStorage?.getItem?.('mythical_void_age_group');
    } catch (error) {
        return { eligible: false, reason: 'storage_unavailable' };
    }
    return isCreatureMediaAgeGroup(ageGroup)
        ? { eligible: true, reason: null }
        : { eligible: false, reason: 'age_selection_required' };
}

export {
    CREATURE_MEDIA_AGE_GROUPS,
    getCreatureMediaEligibility,
    isCreatureMediaAgeGroup
};
