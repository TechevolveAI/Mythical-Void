import bossConfigs from '../config/bosses.json';
import {
    getProjectBeaconKatanaCombatProfile,
    PROJECT_BEACON_KATANA_UPGRADES
} from './ProjectBeaconFieldKit.js';

export const REPAIRER_PORTRAIT = '/game/residents/repairer-portrait.webp';

const UPGRADE_COPY = Object.freeze({
    crystal_edge: {
        source: 'Crystal Caves',
        effect: 'Stronger strikes. Longer reach.',
        line: 'That crystal gives your blade more reach. Give it a try!'
    },
    aurora_guard: {
        source: 'Aurora Depths',
        effect: 'Blocks one hit each expedition.',
        line: 'A little protection around the hilt. It will catch a hit for you.'
    }
});

function quantity(items, id) {
    return (Array.isArray(items) ? items : []).reduce((total, item) => {
        if (item?.id !== id) return total;
        const count = Number(item.quantity ?? 1);
        return total + (Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0);
    }, 0);
}

// A read-only view over the existing rewards. Opening the bench never installs,
// spends, claims pending items, or repairs a save behind the player's back.
export function getRepairerWorkshopSnapshot(gameState) {
    const fieldKit = gameState?.get?.('story.projectBeacon.fieldKit') || {};
    const recovered = fieldKit.recovered === true;
    const combat = getProjectBeaconKatanaCombatProfile(gameState);
    const upgrades = Object.values(PROJECT_BEACON_KATANA_UPGRADES).map(upgrade => ({
        id: upgrade.id,
        name: upgrade.name,
        installed: recovered && combat.upgradeIds.includes(upgrade.id),
        ...UPGRADE_COPY[upgrade.id]
    }));
    const items = gameState?.get?.('inventory.items');
    const pending = gameState?.get?.('inventory.pendingBossRewards');
    const supplies = Object.values(bossConfigs)
        .map(boss => boss?.rewards?.powerup)
        .filter(item => item?.usableInLevel)
        .map(item => ({
            id: item.id,
            name: item.name,
            effect: item.resultText,
            quantity: quantity(items, item.id),
            pending: quantity(pending, item.id)
        }));
    const fitted = upgrades.filter(upgrade => upgrade.installed);
    return {
        recovered,
        combat,
        upgrades,
        supplies,
        greeting: !recovered
            ? 'Find your field kit at the crash site. Then bring that blade over.'
            : fitted.length
                ? fitted[fitted.length - 1].line
                : 'A good blade. Bring back something unusual and we will see what it can do.',
        summary: !recovered ? 'Field kit not recovered'
            : fitted.length ? `${fitted.length} permanent ${fitted.length === 1 ? 'upgrade' : 'upgrades'} fitted`
                : 'Your original katana'
    };
}

export function getRepairerPracticeStrike(combat, distance, health) {
    const hit = Number.isFinite(distance) && distance >= 0 && distance <= combat.enemyMeleeRange;
    const damage = hit ? combat.meleeDamage : 0;
    return { hit, damage, health: Math.max(0, health - damage) };
}
