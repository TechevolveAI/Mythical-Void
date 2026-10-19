// This is the existing hatch-screen draft, not an authoritative lineage record.
// Identity, time, naming and transaction ownership remain with the caller.
export function createFusionOffspringDraft({ genes, offspringData, name, textureName, now, twin = null }) {
    return {
        id: offspringData?.creatureId,
        name,
        genes,
        dna: genes,
        personality: null,
        personalityState: null,
        stats: { happiness: 100, energy: 100, health: 100 },
        level: 1,
        experience: 0,
        textureName: textureName || null,
        hatchTime: now,
        lifecycle: {
            birthDate: now,
            stage: 'baby',
            lastStageChange: now,
            evolutionHistory: []
        },
        cosmicAffinity: genes?.cosmicAffinity,
        rarity: offspringData?.rarity || 'common',
        addedAt: now,
        isOffspring: true,
        ...(twin ? {
            isTwin: true,
            twinIndex: twin.index,
            twinSiblingId: twin.siblingId,
            twinSiblingName: twin.siblingName
        } : {}),
        generation: offspringData?.generation || 2,
        parentIds: offspringData?.parentIds || [],
        offspringBonus: offspringData?.offspringBonus || null,
        birthEvents: offspringData?.birthEvents || [],
        secretAbilities: offspringData?.secretAbilities || [],
        // Preserve the current twin field presence, rather than changing saves.
        ...(!twin ? {
            isShiny: offspringData?.isShiny || false,
            hasDualAffinity: offspringData?.hasDualAffinity || false,
            dualAffinity: offspringData?.dualAffinity || null
        } : {})
    };
}
