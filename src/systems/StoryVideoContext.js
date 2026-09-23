const regions = Object.freeze({
    elder_treant: ['mythicalForest', 'Mythical Forest'],
    crystal_golem: ['crystalCaves', 'Crystal Caves'],
    nyxvoral: ['cosmicReef', 'Stellar Reef'],
    cosmic_titan: ['voidPeaks', 'Void Peaks'],
    shadow_phoenix: ['auroraDepths', 'Aurora Depths'],
    void_empress: ['finalVoid', 'Final Void']
});

export function storyVideoContext(momentId) {
    if (momentId === 'first_forest_arrival') return { levelId: 'mythicalForest', label: 'Mythical Forest: first steps' };
    if (momentId === 'beacon_reflection') return { levelId: null, label: 'Your journey: looking back' };
    const match = /^guardian_(rescue|trust|debrief)_(.+)$/.exec(momentId || '');
    const region = regions[match?.[2]];
    if (!region) return { levelId: null, label: 'Creature story' };
    return {
        levelId: match[1] === 'rescue' ? region[0] : null,
        label: match[1] === 'rescue' ? `${region[1]}: freedom after the battle`
            : `Sanctuary: ${region[1]} ${match[1] === 'trust' ? 'friendship' : 'memories'}`
    };
}

export function videoNoticeKey(ready) {
    return `${ready.identityKey}:${ready.momentId}:${ready.assetRef}`;
}
