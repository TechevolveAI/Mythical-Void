import { getGuardianOutcomeSnapshot } from './GuardianOutcomes.js';
import { getRescuedResidentSnapshot } from './RescuedResidents.js';

export const SANCTUARY_COMMUNITY_SCHEMA_VERSION = 1;

function getCompanionRoster(gameState) {
    const active = gameState?.getActiveCreature?.() || (
        gameState?.get?.('creature.hatched') === true
            ? gameState.get('creature')
            : null
    );
    const collection = Array.isArray(gameState?.get?.('creatures'))
        ? gameState.get('creatures')
        : [];
    const seen = new Set();
    return [active, ...collection].flatMap((creature, index) => {
        if (!creature) return [];
        const id = creature.id || creature.genes?.id || creature.dna?.id ||
            (index === 0 ? 'active_companion' : null);
        if (!id || seen.has(id)) return [];
        seen.add(id);
        return [{
            ...creature,
            id,
            name: creature.name || 'Unnamed companion',
            communityType: index === 0 ? 'player_companion' : 'companion',
            isPlayerCompanion: index === 0
        }];
    });
}

export function getSanctuaryCommunitySnapshot(gameState) {
    const companions = getCompanionRoster(gameState);
    const rescued = getRescuedResidentSnapshot(gameState);
    const guardians = getGuardianOutcomeSnapshot(gameState);
    const residents = rescued.rescued.map(resident => ({
        ...resident,
        communityType: 'rescued_resident',
        isPlayerCompanion: false,
        residencyStatus: resident.residencyStatus || 'resident'
    }));
    return {
        schemaVersion: SANCTUARY_COMMUNITY_SCHEMA_VERSION,
        playerCompanion: companions.find(entry => entry.isPlayerCompanion) || null,
        companions,
        residents,
        residentCount: residents.length,
        guardianAllies: guardians.regionalAllies,
        guardianPresences: guardians.sanctuaryPresences,
        guardianOutcomes: guardians.outcomes,
        counts: {
            companions: companions.length,
            residents: residents.length,
            regionalAllies: guardians.regionalAllies.length,
            guardianPresences: guardians.sanctuaryPresences.length
        },
        totals: {
            residents: rescued.totalResidents,
            guardians: guardians.totalGuardians
        }
    };
}

if (typeof window !== 'undefined') {
    window.SanctuaryCommunity = {
        SANCTUARY_COMMUNITY_SCHEMA_VERSION,
        getSanctuaryCommunitySnapshot
    };
}

export default {
    SANCTUARY_COMMUNITY_SCHEMA_VERSION,
    getSanctuaryCommunitySnapshot
};
