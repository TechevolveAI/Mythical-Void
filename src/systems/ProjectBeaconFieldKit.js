export const PROJECT_BEACON_FIELD_KIT = Object.freeze({
    id: 'wanderer_7_field_kit',
    name: 'Wanderer-7 Field Kit',
    katana: Object.freeze({
        id: 'earth_field_katana',
        name: 'Earth-forged Field Katana',
        material: 'Titanium-ceramic laminate',
        configuration: 'earth_forged',
        upgradeSlots: 2
    })
});

export const PROJECT_BEACON_KATANA_UPGRADES = Object.freeze({
    crystal_edge: Object.freeze({
        id: 'crystal_edge',
        name: 'Resonant Edge',
        sourceLevelId: 'crystalCaves',
        source: 'Crystal Guardian',
        description: 'Creature-grown crystal aligns with the Earth-forged blade.',
        effects: Object.freeze({
            meleeDamageBonus: 1,
            meleeRangeBonus: 15
        })
    }),
    aurora_guard: Object.freeze({
        id: 'aurora_guard',
        name: 'Aurora Guard',
        sourceLevelId: 'auroraDepths',
        source: 'Aurora Phoenix',
        description: 'Living aurora light forms a protective circuit around the hilt.',
        effects: Object.freeze({
            guardCharges: 1
        })
    })
});

function getUpgradeId(upgrade) {
    if (typeof upgrade === 'string') {
        return upgrade;
    }
    return typeof upgrade?.id === 'string' ? upgrade.id : null;
}

export function getProjectBeaconKatanaUpgradeIds(gameState, {
    upgradeIds = null
} = {}) {
    const installed = Array.isArray(upgradeIds)
        ? upgradeIds
        : gameState?.get?.(
            'story.projectBeacon.fieldKit.katana.installedUpgrades'
        );

    if (!Array.isArray(installed)) {
        return [];
    }

    return Array.from(new Set(
        installed
            .map(getUpgradeId)
            .filter(id => PROJECT_BEACON_KATANA_UPGRADES[id])
    ));
}

export function getProjectBeaconKatanaCombatProfile(gameState, options = {}) {
    const upgradeIds = getProjectBeaconKatanaUpgradeIds(gameState, options);
    const hasCrystalEdge = upgradeIds.includes('crystal_edge');
    const hasAuroraGuard = upgradeIds.includes('aurora_guard');

    return {
        upgradeIds,
        meleeDamage: 2 + (hasCrystalEdge ? 1 : 0),
        enemyMeleeRange: 70 + (hasCrystalEdge ? 15 : 0),
        bossMeleeRange: 80 + (hasCrystalEdge ? 15 : 0),
        slashColor: hasCrystalEdge ? 0x8FE3CF : 0xE040FB,
        slashGlowColor: hasCrystalEdge ? 0x66C7D4 : 0x7B68EE,
        guardCharges: hasAuroraGuard ? 1 : 0
    };
}

export function installProjectBeaconKatanaUpgrade(gameState, upgradeId, {
    installedAt = new Date().toISOString(),
    save = true
} = {}) {
    const upgrade = PROJECT_BEACON_KATANA_UPGRADES[upgradeId];
    if (!upgrade || !gameState?.get || !gameState?.set) {
        return { changed: false, upgrade: null, reason: 'invalid_upgrade' };
    }

    const fieldKit = gameState.get('story.projectBeacon.fieldKit') || {};
    if (!fieldKit.recovered) {
        return { changed: false, upgrade, reason: 'field_kit_missing' };
    }

    const katana = fieldKit.katana || {};
    const installedUpgrades = Array.isArray(katana.installedUpgrades)
        ? katana.installedUpgrades
        : [];
    const installedIds = installedUpgrades.map(getUpgradeId).filter(Boolean);

    if (installedIds.includes(upgradeId)) {
        return { changed: false, upgrade, reason: 'already_installed' };
    }

    const upgradeSlots = Math.max(
        0,
        Number(katana.upgradeSlots)
            || PROJECT_BEACON_FIELD_KIT.katana.upgradeSlots
    );
    if (installedIds.length >= upgradeSlots) {
        return { changed: false, upgrade, reason: 'no_open_slot' };
    }

    const installedUpgrade = {
        id: upgrade.id,
        name: upgrade.name,
        source: upgrade.source,
        sourceLevelId: upgrade.sourceLevelId,
        installedAt
    };
    const nextFieldKit = {
        ...fieldKit,
        katana: {
            ...PROJECT_BEACON_FIELD_KIT.katana,
            ...katana,
            configuration: 'creature_tech_adapted',
            installedUpgrades: [...installedUpgrades, installedUpgrade]
        }
    };

    gameState.set('story.projectBeacon.fieldKit', nextFieldKit);
    gameState.emit?.('projectBeaconKatanaUpgradeInstalled', {
        upgrade: installedUpgrade,
        installedCount: nextFieldKit.katana.installedUpgrades.length,
        upgradeSlots
    });
    if (save) {
        gameState.save?.();
    }

    return {
        changed: true,
        upgrade,
        installedUpgrade,
        fieldKit: nextFieldKit
    };
}

export function recoverProjectBeaconFieldKit(gameState, {
    recoveredAt = new Date().toISOString()
} = {}) {
    if (!gameState?.get || !gameState?.set) {
        return { changed: false, fieldKit: null };
    }

    const current = gameState.get('story.projectBeacon.fieldKit') || {};
    if (current.recovered) {
        return { changed: false, fieldKit: current };
    }

    const fieldKit = {
        ...current,
        id: PROJECT_BEACON_FIELD_KIT.id,
        name: PROJECT_BEACON_FIELD_KIT.name,
        recovered: true,
        recoveredAt,
        katana: {
            ...PROJECT_BEACON_FIELD_KIT.katana,
            ...(current.katana || {}),
            configuration: 'earth_forged',
            installedUpgrades: Array.isArray(current.katana?.installedUpgrades)
                ? current.katana.installedUpgrades
                : []
        }
    };

    gameState.set('story.projectBeacon.fieldKit', fieldKit);
    gameState.emit?.('projectBeaconFieldKitRecovered', { fieldKit });
    gameState.save?.();

    return { changed: true, fieldKit };
}

if (typeof window !== 'undefined') {
    window.ProjectBeaconFieldKit = Object.freeze({
        PROJECT_BEACON_FIELD_KIT,
        PROJECT_BEACON_KATANA_UPGRADES,
        recoverProjectBeaconFieldKit,
        installProjectBeaconKatanaUpgrade,
        getProjectBeaconKatanaUpgradeIds,
        getProjectBeaconKatanaCombatProfile
    });
}
