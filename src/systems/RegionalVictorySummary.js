const REGIONS = Object.freeze({
    mythicalForest: { name: 'Mythical Forest', title: 'The forest can breathe again', part: 'Forest Core', color: '#8fe3cf', icon: 'Sprout' },
    crystalCaves: { name: 'Crystal Caves', title: 'The caves are waking up', part: 'Crystal Core', color: '#91ddf1', icon: 'Gem' },
    cosmicReef: { name: 'Stellar Reef', title: 'The current flows again', part: 'Dimensional Drive', color: '#f0b9dd', icon: 'Orbit' },
    voidPeaks: { name: 'Void Peaks', title: 'The mountain is free', part: 'Hull Plating', color: '#efd28e', icon: 'Shield' },
    auroraDepths: { name: 'Aurora Depths', title: 'The aurora shines again', part: 'Aurora Reactor', color: '#a7e4d0', icon: 'Zap' }
});

// Presentation reads the completion receipt. Opening or closing it never grants rewards.
export function getRegionalVictorySummary(result, debrief = null) {
    const region = REGIONS[result?.levelId];
    if (!region) return null;
    const rewards = [];
    const resident = result.rescuedResident;
    if (resident?.newlyRescued) rewards.push({
        kind: 'resident', label: 'NEW SANCTUARY FRIEND', text: resident.name,
        detail: resident.supportLabel, shortLabel: 'Sanctuary friend'
    });
    const powerup = result.bossPowerupReward;
    if (powerup) rewards.push({
        kind: 'powerup',
        label: powerup.awarded ? (powerup.queued ? 'REWARD INBOX' : 'IN YOUR INVENTORY') : 'POWER-UP NOT PACKED',
        text: powerup.name,
        detail: powerup.awarded
            ? `${(powerup.resultText || powerup.description || 'Ready for your next expedition').replace(/[.!]+$/, '')}. ${powerup.queued ? 'Clear an inventory slot to pack it.' : 'Use from Pause > Power-ups.'}`
            : 'Your other rewards are unaffected.',
        shortLabel: powerup.awarded ? (powerup.queued ? 'In reward inbox' : 'In your bag') : 'Not packed',
        icon: /health/i.test(powerup.name) ? 'Heart' : /shield|guard/i.test(powerup.name) ? 'Shield' : 'Zap'
    });
    if (result.shipPartAwarded) rewards.push({
        kind: 'ship', label: 'FOR YOUR SHIP', text: region.part,
        detail: 'Ready to install at Wanderer-77.', shortLabel: 'Ship part', icon: region.icon
    });
    if (result.katanaUpgradeAwarded && result.katanaUpgrade) rewards.push({
        kind: 'upgrade', label: 'ALREADY INSTALLED', text: result.katanaUpgrade.name,
        detail: result.katanaUpgrade.description || 'Your creature-tech is stronger now.',
        shortLabel: 'Equipped', icon: 'Swords'
    });
    if (result.coinsAwarded > 0) rewards.push({
        kind: 'coins', label: 'FOR THE SHOP', text: `+${result.coinsAwarded} Cosmic Coins`,
        amount: result.coinsAwarded, detail: 'Spend these in the Sanctuary shop.'
    });
    const nextStep = result.levelId === 'auroraDepths'
        ? 'Next: fit the reactor to open the Final Void'
        : result.nextGateUnlocked && debrief?.nextGate?.label
            ? `Next adventure: ${debrief.nextGate.label}`
            : 'Your Sanctuary is waiting';
    return {
        presentation: 'victory',
        eyebrow: region.name,
        title: resident?.newlyRescued ? `${resident.name} is free!` : region.title,
        context: resident?.newlyRescued ? 'A new friend for your Sanctuary' : 'Another adventure, well played.',
        finding: null,
        rewards, nextStep, color: region.color,
        actionLabel: 'Return to Sanctuary',
        detailsLabel: 'The story so far',
        fieldNote: [region.title, resident?.newlyRescued ? resident.supportLabel : null,
            debrief?.finding, debrief?.fieldNote, debrief?.companionMoment,
            result.guardianOutcome?.outcomeLine,
            result.time > 0 ? `Expedition time: ${Math.ceil(result.time / 60000)} min` : null
        ].filter(Boolean).join('\n\n')
    };
}
