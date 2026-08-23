import { getGuardianOutcomeSnapshot } from './GuardianOutcomes.js';

export const GUARDIAN_RESIDENTS_SCHEMA_VERSION = 4;
export const GUARDIAN_SYNERGY_ASSISTS = 3;
export const GUARDIAN_ROUTINE_RECOVERY_MS = 77 * 1000;

export const GUARDIAN_RESIDENT_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'elder_treant',
        levelId: 'mythicalForest',
        name: 'Elder Treant',
        role: 'Rootwarden',
        kind: 'treant',
        artwork: '/game/guardians/elder-treant.webp',
        textureKey: 'guardian-resident-elder-treant',
        color: 0x3F7D44,
        accent: 0xB7E36D,
        routine: 'Tends the Sanctuary roots',
        routineCue: 'CHECKING ROOTS',
        ambientLines: Object.freeze([
            'The youngest roots are holding.',
            'This soil remembers every careful step.',
            'A new branch is testing the light.'
        ]),
        routineCare: Object.freeze({
            action: 'Tend root channel',
            prompt: 'Guide fresh water through the roots below Wanderer-77.',
            worldFeedback: 'Fresh water is reaching the young roots.',
            steps: Object.freeze([
                Object.freeze({
                    action: 'Listen along the root',
                    feedback: 'A faint pulse marks the youngest growth below the hull.'
                }),
                Object.freeze({
                    action: 'Open the water channel',
                    feedback: 'Fresh water follows the root without washing away its soil.'
                }),
                Object.freeze({
                    action: 'Check the new growth',
                    feedback: 'The smallest roots hold steady when the next wind reaches them.'
                })
            ]),
            responses: Object.freeze([
                'The water reached the youngest roots. They will hold the soil through the next wind.',
                'You followed the root instead of forcing it. The channel is open again.'
            ])
        }),
        futureAbility: 'Root Bridge',
        task: Object.freeze({
            id: 'root_listening',
            title: 'Root Listening',
            objective: 'Inspect the Signal Garden roots once after accepting.',
            briefing: 'Help me compare the garden pulse with the roots below the ship.',
            evidenceKey: 'gardenVisits',
            mode: 'delta',
            target: 1,
            completionLine: 'The garden and the deep roots answer together. I can hold a path open for you now.'
        }),
        teamAbility: Object.freeze({
            id: 'root_bridge',
            name: 'Root Bridge',
            summary: 'Adds one guardian rescue charge to each expedition.',
            activationLine: 'My roots will catch one blow that would have broken your path.',
            modifiers: Object.freeze({ guardCharges: 1 })
        }),
        synergy: Object.freeze({
            name: 'Rootbound Trust',
            memory: 'You returned to the roots after the danger passed. That is how I know your care was not only strategy.',
            summary: 'Adds a second guardian rescue charge to each expedition.',
            modifiers: Object.freeze({ guardCharges: 2 })
        }),
        expeditionDebrief: Object.freeze({
            steady: '{companion} kept pace through {expedition}. The roots I sent with you returned carrying a calmer rhythm.',
            intervention: 'My roots caught the path in {expedition}. {companion} trusted the bridge before the ground was certain.'
        }),
        rescueMemory:
            'The pressure in my roots is quiet now. Your companion heard the forest before your instruments did.',
        dialogue: Object.freeze([
            'New roots are testing the soil beneath Wanderer-77. I will warn you before they touch the hull.',
            'Your small companion asks large questions. That is usually how a forest begins.',
            'A rescued place should become shelter for the next life that arrives.'
        ])
    }),
    Object.freeze({
        id: 'crystal_golem',
        levelId: 'crystalCaves',
        name: 'Crystal Guardian',
        role: 'Resonance Keeper',
        kind: 'golem',
        artwork: '/game/guardians/crystal-guardian.webp',
        textureKey: 'guardian-resident-crystal-guardian',
        color: 0x7356C8,
        accent: 0x63E5E8,
        routine: 'Tunes the garden crystals',
        routineCue: 'TUNING CRYSTALS',
        ambientLines: Object.freeze([
            'One quiet frequency holds beneath the noise.',
            'This shard is learning the garden chord.',
            'Pressure changed here, but nothing broke.'
        ]),
        routineCare: Object.freeze({
            action: 'Tune resonance',
            prompt: 'Match the garden shards to the Current without cracking their structure.',
            worldFeedback: 'The garden is holding one clear chord.',
            steps: Object.freeze([
                Object.freeze({
                    action: 'Find the quiet frequency',
                    feedback: 'One low tone remains stable beneath the competing crystal notes.'
                }),
                Object.freeze({
                    action: 'Turn the fractured shard',
                    feedback: 'Its chipped face catches the shared frequency without splitting.'
                }),
                Object.freeze({
                    action: 'Hold for harmonic lock',
                    feedback: 'The garden answers as one chord, with every shard still distinct.'
                })
            ]),
            responses: Object.freeze([
                'The shards are answering one another instead of competing for the signal.',
                'That frequency will protect the new growth without draining it.'
            ])
        }),
        futureAbility: 'Resonance Shield',
        task: Object.freeze({
            id: 'resonance_repair',
            title: 'Resonance Repair',
            objective: 'Protect or redirect one living Current region.',
            briefing: 'Make one repair without taking from the Current. I will tune a shield to that choice.',
            evidenceKey: 'currentCareActions',
            mode: 'delta',
            target: 1,
            completionLine: 'That repair left a clean pattern in the stone. The shield now recognizes you.'
        }),
        teamAbility: Object.freeze({
            id: 'resonance_shield',
            name: 'Resonance Shield',
            summary: 'Adds one maximum health point during expeditions.',
            activationLine: 'The shield will travel with your suit until you return.',
            modifiers: Object.freeze({ maxHealthBonus: 1 })
        }),
        synergy: Object.freeze({
            name: 'Harmonic Covenant',
            memory: 'You learned my frequency well enough to notice when I was tired. Stone rarely receives that kind of attention.',
            summary: 'Adds two maximum health points during expeditions.',
            modifiers: Object.freeze({ maxHealthBonus: 2 })
        }),
        expeditionDebrief: Object.freeze({
            steady: 'The shield returned from {expedition} without fracture. {companion} held one clear frequency beside it.',
            intervention: 'The shield took the pressure in {expedition}. {companion} steadied before the echo had faded.'
        }),
        rescueMemory:
            'The false pulse is gone. I can hear the Crystal Heart without mistaking every footstep for a threat.',
        dialogue: Object.freeze([
            'This shard carries no pain. It may remain near the garden.',
            'Stone remembers pressure. Friendship leaves a different pattern.',
            'When you need a shield, strike the ground once and wait for my answer.'
        ])
    }),
    Object.freeze({
        id: 'nyxvoral',
        levelId: 'cosmicReef',
        name: "Nyx'voral",
        role: 'Passage Guardian',
        kind: 'serpent',
        artwork: '/game/guardians/nyxvoral.webp',
        textureKey: 'guardian-resident-nyxvoral',
        color: 0x2658A8,
        accent: 0x49E6D3,
        routine: 'Maps safe Current passages',
        routineCue: 'MAPPING CURRENT',
        ambientLines: Object.freeze([
            'The smaller crossing is clear.',
            'A safe path must work in both directions.',
            'Three travelers passed without disturbing the Current.'
        ]),
        routineCare: Object.freeze({
            action: 'Mark safe passage',
            prompt: 'Walk the quiet route and mark where smaller lives cross it.',
            worldFeedback: 'The quiet passage is open to every traveler.',
            steps: Object.freeze([
                Object.freeze({
                    action: 'Watch the small crossing',
                    feedback: 'Three tiny lives use a route the instruments nearly ignored.'
                }),
                Object.freeze({
                    action: 'Mark the quiet current',
                    feedback: 'The marker follows the safe flow without claiming the passage.'
                }),
                Object.freeze({
                    action: 'Leave the route open',
                    feedback: 'Travelers can read the path in either direction and pass freely.'
                })
            ]),
            responses: Object.freeze([
                'The passage is marked for travelers, not claimed against them.',
                'You noticed the smaller crossing. The safe route now belongs to everyone who needs it.'
            ])
        }),
        futureAbility: 'Current Passage',
        task: Object.freeze({
            id: 'passage_survey',
            title: 'Passage Survey',
            objective: 'Observe all three Living Signals in the Sanctuary.',
            briefing: 'Learn all three local signals. A safe passage begins by knowing who already uses it.',
            evidenceKey: 'observedSignals',
            mode: 'total',
            target: 3,
            completionLine: 'You can now tell a path from a presence. I will guide your next crossing.'
        }),
        teamAbility: Object.freeze({
            id: 'current_passage',
            name: 'Current Passage',
            summary: 'Increases expedition movement speed by eight percent.',
            activationLine: 'Follow the quiet current. It reaches the same ground with less resistance.',
            modifiers: Object.freeze({ speedMultiplier: 1.08 })
        }),
        synergy: Object.freeze({
            name: 'Shared Passage',
            memory: 'You kept walking the safe route even when no reward waited at its end. I would trust you to mark a path home.',
            summary: 'Increases expedition movement speed by twelve percent.',
            modifiers: Object.freeze({ speedMultiplier: 1.12 })
        }),
        expeditionDebrief: Object.freeze({
            steady: '{companion} followed the quiet route through {expedition} and left it open behind you. That matters.',
            intervention: 'The current shifted in {expedition}, but {companion} read the second passage before it closed.'
        }),
        rescueMemory:
            'You repaired the route instead of claiming it. The reef remembers travelers who leave a passage open.',
        dialogue: Object.freeze([
            'Three currents pass below this ground. Only one wishes to be followed today.',
            'I circle the Sanctuary because a safe route must be checked from both directions.',
            'Call my name near deep water. I can carry more than fear through a current.'
        ])
    }),
    Object.freeze({
        id: 'shadow_phoenix',
        levelId: 'auroraDepths',
        name: 'Aurora Phoenix',
        role: 'Sky Sentinel',
        kind: 'phoenix',
        artwork: '/game/guardians/shadow-phoenix.webp',
        textureKey: 'guardian-resident-shadow-phoenix',
        color: 0xD94B4B,
        accent: 0xF4D35E,
        routine: 'Surveys the Sanctuary sky',
        routineCue: 'WATCHING SKY',
        ambientLines: Object.freeze([
            'Warm current. Stable sky.',
            'The frost line is moving away from the garden.',
            'There is room to rise above the ship.'
        ]),
        routineCare: Object.freeze({
            action: 'Clear thermal intake',
            prompt: 'Remove cold ash from the ship intake while I hold the warm current steady.',
            worldFeedback: 'Warm air is reaching the ship and garden.',
            steps: Object.freeze([
                Object.freeze({
                    action: 'Let the intake cool',
                    feedback: 'The metal settles before your glove reaches the first ash pocket.'
                }),
                Object.freeze({
                    action: 'Brush out the cold ash',
                    feedback: 'Air moves through the cleared vanes without scattering soot.'
                }),
                Object.freeze({
                    action: 'Restore the warm flow',
                    feedback: 'A gentle thermal current reaches both the ship and the garden.'
                })
            ]),
            responses: Object.freeze([
                'The intake can breathe again. I will keep the frost above the new growth.',
                'Clean work. The next warm current will reach both the ship and the garden.'
            ])
        }),
        futureAbility: 'Aurora Lift',
        task: Object.freeze({
            id: 'skywatch_rest',
            title: 'Skywatch Rest',
            objective: 'Complete one full campfire rest after accepting.',
            briefing: 'Rest long enough to hear the air change. I will mark the safest rising current.',
            evidenceKey: 'campfireRests',
            mode: 'delta',
            target: 1,
            completionLine: 'You heard the air before the instruments did. The next updraft will carry you higher.'
        }),
        teamAbility: Object.freeze({
            id: 'aurora_lift',
            name: 'Aurora Lift',
            summary: 'Increases expedition jump height by eight percent.',
            activationLine: 'A warm current will rise beneath your next expedition step.',
            modifiers: Object.freeze({ jumpMultiplier: 1.08 })
        }),
        synergy: Object.freeze({
            name: 'Rising Accord',
            memory: 'You cleared the cold ash three times and never treated my fire as a tool. I will rise when you call.',
            summary: 'Increases expedition jump height by twelve percent.',
            modifiers: Object.freeze({ jumpMultiplier: 1.12 })
        }),
        expeditionDebrief: Object.freeze({
            steady: '{companion} rose with the warm current through {expedition}. Neither of you mistook height for distance from those below.',
            intervention: 'The air failed once in {expedition}. {companion} trusted my lift, and we found the ground together.'
        }),
        rescueMemory:
            'You stayed when the shadow-fire rose. I returned as myself, not as the weapon the Depths demanded.',
        dialogue: Object.freeze([
            'The air above the ship is stable. I left one warm feather beside the damaged intake.',
            'Rebirth is not erasing what happened. It is deciding what the memory becomes.',
            'There are heights your suit cannot reach. Someday, we will reach them together.'
        ])
    }),
    Object.freeze({
        id: 'cosmic_titan',
        levelId: 'voidPeaks',
        name: 'Cosmic Titan',
        role: 'Ridge Keeper',
        kind: 'titan',
        artwork: '/game/guardians/cosmic-titan.webp',
        textureKey: 'guardian-resident-cosmic-titan',
        color: 0x202428,
        accent: 0x8FE3CF,
        routine: 'Reinforces the outer boundary',
        routineCue: 'BRACING BOUNDARY',
        ambientLines: Object.freeze([
            'The boundary holds. The path stays open.',
            'Strength should shelter before it warns.',
            'One loose footing can move an entire wall.'
        ]),
        routineCare: Object.freeze({
            action: 'Brace outer wall',
            prompt: 'Set the loose boundary stones so they shelter the clearing without sealing it shut.',
            worldFeedback: 'The shelter wall is steady and still welcomes travelers.',
            steps: Object.freeze([
                Object.freeze({
                    action: 'Find the loose footing',
                    feedback: 'One buried stone shifts before the visible wall does.'
                }),
                Object.freeze({
                    action: 'Set the shelter stone',
                    feedback: 'Its weight turns the wind while preserving the path beside it.'
                }),
                Object.freeze({
                    action: 'Test the open boundary',
                    feedback: 'The wall holds firm and a traveler can still enter the clearing.'
                })
            ]),
            responses: Object.freeze([
                'The wall will stop the wind and still leave a path for those seeking shelter.',
                'Strong enough to hold. Open enough to welcome. That is a useful boundary.'
            ])
        }),
        futureAbility: 'Titan Stance',
        task: Object.freeze({
            id: 'boundary_drill',
            title: 'Boundary Drill',
            objective: 'Land three hits at the Sanctuary target range.',
            briefing: 'Three deliberate strikes. Strength should arrive where you intended, not merely where you aimed.',
            evidenceKey: 'targetHits',
            mode: 'delta',
            target: 3,
            completionLine: 'Three clean impacts. You kept your balance after each one. That is the stance.'
        }),
        teamAbility: Object.freeze({
            id: 'titan_stance',
            name: 'Titan Stance',
            summary: 'Blocks the first ordinary damage hit in each expedition.',
            activationLine: 'Stand as though the ground has already agreed to hold you.',
            modifiers: Object.freeze({ shieldHits: 1 })
        }),
        synergy: Object.freeze({
            name: 'Standing Together',
            memory: 'You helped strengthen a boundary that still welcomes strangers. Stand beside me; I know what your strength protects.',
            summary: 'Blocks the first two ordinary damage hits in each expedition.',
            modifiers: Object.freeze({ shieldHits: 2 })
        }),
        expeditionDebrief: Object.freeze({
            steady: '{companion} held a deliberate stance through {expedition}. Strength stayed beside the path instead of ruling it.',
            intervention: 'I felt the impact in {expedition}. {companion} stood again before the ridge stopped answering.'
        }),
        rescueMemory:
            'The crushing signal has lifted. Strength can hold a boundary without turning it into a prison.',
        dialogue: Object.freeze([
            'The northern boundary shifted twenty-three handspans. I have steadied it.',
            'Your martial stance is small but structurally sound. The Sensei taught you well.',
            'When the ground refuses you, stand beside me. We will ask it again.'
        ])
    }),
    Object.freeze({
        id: 'void_empress',
        levelId: 'finalVoid',
        name: 'Void Empress',
        role: 'Current Witness',
        kind: 'empress',
        artwork: '/game/guardians/void-empress.webp',
        textureKey: 'guardian-resident-void-empress',
        color: 0x5B3E96,
        accent: 0xF4F4F4,
        routine: 'Listens at the edge of the Current',
        routineCue: 'LISTENING TO CURRENT',
        ambientLines: Object.freeze([
            'Six voices. None erased.',
            'The quietest signal has not finished speaking.',
            'Agreement is not the same as sameness.'
        ]),
        routineCare: Object.freeze({
            action: 'Hold listening watch',
            prompt: 'Stay quiet beside the Current and record every distinct voice before interpreting it.',
            worldFeedback: 'Every recorded voice remains distinct in the chorus.',
            steps: Object.freeze([
                Object.freeze({
                    action: 'Wait for every voice',
                    feedback: 'Six signals emerge when the strongest one is not answered first.'
                }),
                Object.freeze({
                    action: 'Record each separately',
                    feedback: 'No voice is flattened into another while the pattern forms.'
                }),
                Object.freeze({
                    action: 'Interpret after listening',
                    feedback: 'The shared meaning appears without erasing who contributed it.'
                })
            ]),
            responses: Object.freeze([
                'Six voices remained distinct. None needed to disappear for the pattern to hold.',
                'You recorded what was present before deciding what it meant. Keep that discipline.'
            ])
        }),
        futureAbility: 'Living Convergence',
        task: Object.freeze({
            id: 'chorus_council',
            title: 'Chorus Council',
            objective: 'Meet each of the five other restored guardians.',
            briefing: 'Do not ask one voice to speak for this world. Listen to every guardian who returned with you.',
            evidenceKey: 'otherGuardianMeetings',
            mode: 'total',
            target: 5,
            completionLine: 'You listened before asking for agreement. The Current can now answer through all of us.'
        }),
        teamAbility: Object.freeze({
            id: 'living_convergence',
            name: 'Living Convergence',
            summary: 'Adds one maximum crystal-energy charge during expeditions.',
            activationLine: 'Carry our distinct voices together. Convergence is not sameness.',
            modifiers: Object.freeze({ maxEnergyBonus: 1 })
        }),
        synergy: Object.freeze({
            name: 'Sixfold Chorus',
            memory: 'You returned to listen when no decision was required. The Current now recognizes your silence as part of the chorus.',
            summary: 'Adds two maximum crystal-energy charges during expeditions.',
            modifiers: Object.freeze({ maxEnergyBonus: 2 })
        }),
        expeditionDebrief: Object.freeze({
            steady: '{companion} carried six distinct voices through {expedition}. None needed to disappear for the path to hold.',
            intervention: 'The chorus answered in {expedition}. {companion} used its strength without surrendering a single voice.'
        }),
        rescueMemory:
            'You reached the Heart and chose restoration over conquest. I come here as witness, never as ruler.',
        dialogue: Object.freeze([
            'Earth cannot hear the Current yet. Silence is not permission to own it.',
            'Every rescued life and regional Guardian has brought a different truth to this ground.',
            'First contact should begin with two questions: who is here, and what do they need?'
        ])
    })
]);

export const GUARDIAN_SOCIAL_EXCHANGES = Object.freeze([
    Object.freeze({
        id: 'roots_and_resonance',
        guardianIds: Object.freeze(['elder_treant', 'crystal_golem']),
        cue: 'ROOTS + RESONANCE',
        variants: Object.freeze([
            Object.freeze({
                elder_treant: 'The new roots are turning away from the loudest shard.',
                crystal_golem: 'Not away. They are choosing the quieter frequency. I will protect it.'
            }),
            Object.freeze({
                elder_treant: 'One crystal is warming where no sunlight reaches.',
                crystal_golem: 'A root is carrying the garden pulse to it. Neither system is alone now.'
            }),
            Object.freeze({
                elder_treant: 'The soil held after the last Current shift.',
                crystal_golem: 'Your roots distributed the pressure. My shards recorded how.'
            })
        ])
    }),
    Object.freeze({
        id: 'resonance_and_passage',
        guardianIds: Object.freeze(['crystal_golem', 'nyxvoral']),
        cue: 'RESONANCE + PASSAGE',
        variants: Object.freeze([
            Object.freeze({
                crystal_golem: 'The Current is bending around the fractured shard.',
                nyxvoral: 'Keep the fracture visible. Travelers need honest markers.'
            }),
            Object.freeze({
                crystal_golem: 'I can make the crossing louder.',
                nyxvoral: 'Make it clearer, not louder. The smallest travelers are listening too.'
            }),
            Object.freeze({
                crystal_golem: 'The safe frequency moved three measures east.',
                nyxvoral: 'Then the passage is alive. I will map where it chooses to go.'
            })
        ])
    }),
    Object.freeze({
        id: 'sky_and_boundary',
        guardianIds: Object.freeze(['shadow_phoenix', 'cosmic_titan']),
        cue: 'SKY + BOUNDARY',
        variants: Object.freeze([
            Object.freeze({
                shadow_phoenix: 'The western stones are turning cold air toward the garden.',
                cosmic_titan: 'I will lower them. A strong wall should improve the air behind it.'
            }),
            Object.freeze({
                shadow_phoenix: 'A warm current wants to rise through your northern gap.',
                cosmic_titan: 'The gap stays open. Shelter does not need a sealed roof.'
            }),
            Object.freeze({
                shadow_phoenix: 'Your boundary held when the frost line moved.',
                cosmic_titan: 'Your warning arrived first. Strength is better when it listens.'
            })
        ])
    }),
    Object.freeze({
        id: 'boundary_and_chorus',
        guardianIds: Object.freeze(['cosmic_titan', 'void_empress']),
        cue: 'BOUNDARY + CHORUS',
        variants: Object.freeze([
            Object.freeze({
                cosmic_titan: 'The boundary holds, but one quiet signal waits outside.',
                void_empress: 'Open the listening path. A boundary can ask before it guards.'
            }),
            Object.freeze({
                cosmic_titan: 'Six voices disagree on where the next shelter belongs.',
                void_empress: 'Good. Agreement should follow listening, not replace it.'
            }),
            Object.freeze({
                cosmic_titan: 'I can hold the ridge while the chorus decides.',
                void_empress: 'Then your strength gives every voice enough time to finish.'
            })
        ])
    })
]);

const GUARDIAN_BY_ID = new Map(
    GUARDIAN_RESIDENT_DEFINITIONS.map(guardian => [guardian.id, guardian])
);
const GUARDIAN_BY_LEVEL = new Map(
    GUARDIAN_RESIDENT_DEFINITIONS.map(guardian => [guardian.levelId, guardian])
);
const MAX_INTERACTIONS = 999;
const MAX_HISTORY = GUARDIAN_RESIDENT_DEFINITIONS.length;
const MAX_ROUTINE_HISTORY = 23;
const MAX_EXPEDITION_HISTORY = 23;
const MAX_ACTIVITY_EVIDENCE = 9999;
const TASK_EVIDENCE_KEYS = new Set([
    'gardenVisits',
    'currentCareActions',
    'observedSignals',
    'campfireRests',
    'targetHits',
    'otherGuardianMeetings'
]);

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().slice(0, 40);
    return normalized || null;
}

function timestampToMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(value instanceof Date ? value.toISOString() : value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function formatGuardianRoutineRecovery(waitMs) {
    const totalSeconds = Math.max(0, Math.ceil((Number(waitMs) || 0) / 1000));
    if (totalSeconds <= 0) return 'READY';
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function orderedKnownIds(value) {
    const requested = new Set(Array.isArray(value) ? value : []);
    return GUARDIAN_RESIDENT_DEFINITIONS
        .map(guardian => guardian.id)
        .filter(id => requested.has(id));
}

function normalizeExpeditionEntry(entry, rescuedSet) {
    const guardianId = GUARDIAN_BY_ID.has(entry?.guardianId)
        ? entry.guardianId
        : null;
    const levelId = typeof entry?.levelId === 'string'
        ? entry.levelId.trim().slice(0, 40)
        : '';
    const completedAt = normalizeTimestamp(entry?.completedAt);
    if (
        !guardianId ||
        !rescuedSet.has(guardianId) ||
        !levelId ||
        !completedAt
    ) {
        return null;
    }
    return {
        guardianId,
        levelId,
        completedAt,
        interventionCount: Math.max(
            0,
            Math.min(
                MAX_INTERACTIONS,
                Math.floor(Number(entry?.interventionCount) || 0)
            )
        ),
        noDamage: entry?.noDamage === true,
        debriefedAt: normalizeTimestamp(entry?.debriefedAt)
    };
}

function formatExpeditionLabel(levelId) {
    return String(levelId || 'the expedition')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase())
        .slice(0, 48) || 'The Expedition';
}

function getLegacyCompletedGuardianIds(gameState) {
    // This compatibility layer powers the Elder Treant's Heart projection.
    // Other completed bosses remain region-bound and never become residents.
    return getGuardianOutcomeSnapshot(gameState).sanctuaryPresences
        .map(outcome => outcome.guardianId);
}

export function normalizeGuardianResidentState(state = {}, {
    completedGuardianIds = [],
    allowedResidentIds = null
} = {}) {
    const allowedResidents = Array.isArray(allowedResidentIds)
        ? new Set(orderedKnownIds(allowedResidentIds))
        : null;
    const rescuedIds = orderedKnownIds([
        ...(Array.isArray(state?.rescuedIds) ? state.rescuedIds : []),
        ...completedGuardianIds
    ]).filter(id => !allowedResidents || allowedResidents.has(id));
    const rescuedSet = new Set(rescuedIds);
    const metIds = orderedKnownIds(state?.metIds)
        .filter(id => rescuedSet.has(id));
    const acceptedTaskIds = orderedKnownIds([
        ...(Array.isArray(state?.acceptedTaskIds) ? state.acceptedTaskIds : []),
        ...(Array.isArray(state?.completedTaskIds) ? state.completedTaskIds : [])
    ]).filter(id => rescuedSet.has(id));
    const acceptedTaskSet = new Set(acceptedTaskIds);
    const completedTaskIds = orderedKnownIds(state?.completedTaskIds)
        .filter(id => acceptedTaskSet.has(id));
    const completedTaskSet = new Set(completedTaskIds);
    const interactions = {};
    rescuedIds.forEach(id => {
        interactions[id] = Math.max(
            0,
            Math.min(
                MAX_INTERACTIONS,
                Math.floor(Number(state?.interactions?.[id]) || 0)
            )
        );
    });
    const rescueHistory = Array.isArray(state?.rescueHistory)
        ? state.rescueHistory
            .map(entry => {
                const id = GUARDIAN_BY_ID.has(entry?.id) ? entry.id : null;
                if (!id || !rescuedSet.has(id)) return null;
                return {
                    id,
                    rescuedAt: normalizeTimestamp(entry?.rescuedAt)
                };
            })
            .filter(Boolean)
            .filter((entry, index, entries) => (
                entries.findIndex(candidate => candidate.id === entry.id) === index
            ))
            .slice(-MAX_HISTORY)
        : [];
    const taskBaselines = {};
    acceptedTaskIds.forEach(id => {
        taskBaselines[id] = Math.max(
            0,
            Math.min(
                MAX_ACTIVITY_EVIDENCE,
                Math.floor(Number(state?.taskBaselines?.[id]) || 0)
            )
        );
    });
    const activityEvidence = {
        gardenVisits: Math.max(
            0,
            Math.min(
                MAX_ACTIVITY_EVIDENCE,
                Math.floor(Number(state?.activityEvidence?.gardenVisits) || 0)
            )
        ),
        campfireRests: Math.max(
            0,
            Math.min(
                MAX_ACTIVITY_EVIDENCE,
                Math.floor(Number(state?.activityEvidence?.campfireRests) || 0)
            )
        ),
        targetHits: Math.max(
            0,
            Math.min(
                MAX_ACTIVITY_EVIDENCE,
                Math.floor(Number(state?.activityEvidence?.targetHits) || 0)
            )
        )
    };
    const activeTeamGuardianId = completedTaskSet.has(state?.activeTeamGuardianId)
        ? state.activeTeamGuardianId
        : null;
    const routineAssists = {};
    rescuedIds.forEach(id => {
        routineAssists[id] = Math.max(
            0,
            Math.min(
                MAX_INTERACTIONS,
                Math.floor(Number(state?.routineAssists?.[id]) || 0)
            )
        );
    });
    const routineHistory = Array.isArray(state?.routineHistory)
        ? state.routineHistory
            .map(entry => {
                const id = GUARDIAN_BY_ID.has(entry?.id) ? entry.id : null;
                if (!id || !rescuedSet.has(id)) return null;
                return {
                    id,
                    assistedAt: normalizeTimestamp(entry?.assistedAt)
                };
            })
            .filter(Boolean)
            .slice(-MAX_ROUTINE_HISTORY)
        : [];
    const expeditionHistory = Array.isArray(state?.expeditionHistory)
        ? state.expeditionHistory
            .map(entry => normalizeExpeditionEntry(entry, rescuedSet))
            .filter(Boolean)
            .slice(-MAX_EXPEDITION_HISTORY)
        : [];
    const pendingExpeditionCandidate = normalizeExpeditionEntry(
        state?.pendingExpeditionDebrief,
        rescuedSet
    );
    const pendingExpeditionDebrief = pendingExpeditionCandidate &&
        !pendingExpeditionCandidate.debriefedAt &&
        expeditionHistory.some(entry => (
            entry.guardianId === pendingExpeditionCandidate.guardianId &&
            entry.completedAt === pendingExpeditionCandidate.completedAt
        ))
        ? pendingExpeditionCandidate
        : null;

    return {
        schemaVersion: GUARDIAN_RESIDENTS_SCHEMA_VERSION,
        rescuedIds,
        metIds,
        interactions,
        rescueHistory,
        acceptedTaskIds,
        completedTaskIds,
        taskBaselines,
        activityEvidence,
        routineAssists,
        routineHistory,
        expeditionHistory,
        pendingExpeditionDebrief,
        activeTeamGuardianId,
        lastInteractionId: rescuedSet.has(state?.lastInteractionId)
            ? state.lastInteractionId
            : null,
        lastInteractionAt: normalizeTimestamp(state?.lastInteractionAt)
    };
}

function countCurrentCareActions(gameState) {
    const regions = gameState?.get?.('world.currentEcology.regions');
    if (!regions || typeof regions !== 'object') return 0;
    return Object.values(regions).reduce((total, region) => (
        total +
        Math.max(0, Number(region?.actionCounts?.protect) || 0) +
        Math.max(0, Number(region?.actionCounts?.redirect) || 0)
    ), 0);
}

function countObservedSignals(gameState) {
    const livingSignals = gameState?.get?.('world.livingSignals.observedIds');
    const ecologySignals = gameState?.get?.('world.currentEcology.observedSignalIds');
    return Math.max(
        Array.isArray(livingSignals) ? new Set(livingSignals).size : 0,
        Array.isArray(ecologySignals) ? new Set(ecologySignals).size : 0
    );
}

export function getGuardianTaskEvidence(gameState, guardianId, state = null) {
    const guardian = GUARDIAN_BY_ID.get(guardianId);
    if (!guardian || !TASK_EVIDENCE_KEYS.has(guardian.task.evidenceKey)) return 0;
    const normalizedState = state || normalizeGuardianResidentState(
        gameState?.get?.('world.guardianResidents') || {},
        {
            completedGuardianIds: getLegacyCompletedGuardianIds(gameState),
            allowedResidentIds: getLegacyCompletedGuardianIds(gameState)
        }
    );
    const values = {
        gardenVisits: normalizedState.activityEvidence.gardenVisits,
        currentCareActions: countCurrentCareActions(gameState),
        observedSignals: countObservedSignals(gameState),
        campfireRests: normalizedState.activityEvidence.campfireRests,
        targetHits: normalizedState.activityEvidence.targetHits,
        otherGuardianMeetings: normalizedState.metIds.filter(id => id !== guardianId).length
    };
    return values[guardian.task.evidenceKey] || 0;
}

function getGuardianTaskProgress(gameState, guardian, state) {
    const current = getGuardianTaskEvidence(gameState, guardian.id, state);
    const baseline = guardian.task.mode === 'delta'
        ? state.taskBaselines[guardian.id] || 0
        : 0;
    const progress = Math.max(0, current - baseline);
    const completed = state.completedTaskIds.includes(guardian.id);
    return {
        current,
        baseline,
        progress: completed
            ? Math.max(guardian.task.target, progress)
            : Math.min(guardian.task.target, progress),
        target: guardian.task.target,
        ready: completed || progress >= guardian.task.target,
        completed
    };
}

export function getGuardianResidentsSnapshot(gameState, {
    now = Date.now()
} = {}) {
    const nowMs = timestampToMs(now) ?? Date.now();
    const outcomeSnapshot = getGuardianOutcomeSnapshot(gameState);
    const completedGuardianIds = (outcomeSnapshot.sanctuaryPresences || [])
        .map(outcome => outcome.guardianId);
    const state = normalizeGuardianResidentState(
        gameState?.get?.('world.guardianResidents') || {},
        {
            completedGuardianIds,
            allowedResidentIds: completedGuardianIds
        }
    );
    const residents = GUARDIAN_RESIDENT_DEFINITIONS.map(guardian => {
        const rescued = state.rescuedIds.includes(guardian.id);
        const interactionCount = state.interactions[guardian.id] || 0;
        const met = state.metIds.includes(guardian.id);
        const taskAccepted = state.acceptedTaskIds.includes(guardian.id);
        const taskProgress = getGuardianTaskProgress(gameState, guardian, state);
        const activeTeam = state.activeTeamGuardianId === guardian.id;
        const routineAssistCount = state.routineAssists[guardian.id] || 0;
        const lastRoutineEntry = [...state.routineHistory]
            .reverse()
            .find(entry => entry.id === guardian.id);
        const guardianExpeditions = state.expeditionHistory.filter(
            entry => entry.guardianId === guardian.id
        );
        const lastExpedition = guardianExpeditions[
            guardianExpeditions.length - 1
        ] || null;
        const lastRoutineAssistMs = timestampToMs(lastRoutineEntry?.assistedAt);
        const routineWaitMs = met && lastRoutineAssistMs !== null
            ? Math.max(
                0,
                GUARDIAN_ROUTINE_RECOVERY_MS - Math.max(0, nowMs - lastRoutineAssistMs)
            )
            : 0;
        const routineReady = met && routineWaitMs === 0;
        const synergyUnlocked = routineAssistCount >= GUARDIAN_SYNERGY_ASSISTS;
        const taskStatus = taskProgress.completed
            ? activeTeam ? 'selected' : 'completed'
            : taskAccepted
                ? taskProgress.ready ? 'ready' : 'active'
                : met ? 'available' : 'locked';
        return {
            ...guardian,
            rescued,
            met,
            interactionCount,
            task: guardian.task,
            taskAccepted,
            taskProgress,
            taskStatus,
            teamAbility: guardian.teamAbility,
            teamAbilityUnlocked: taskProgress.completed,
            activeTeam,
            routineAssistCount,
            routineSupported: routineAssistCount > 0,
            lastRoutineAssistAt: lastRoutineEntry?.assistedAt || null,
            routineReadyAt: lastRoutineAssistMs === null
                ? null
                : new Date(lastRoutineAssistMs + GUARDIAN_ROUTINE_RECOVERY_MS).toISOString(),
            routineReady,
            routineWaitMs,
            routineStatus: !met
                ? 'locked'
                : routineReady
                    ? 'ready'
                    : 'recovering',
            trustProgress: Math.min(GUARDIAN_SYNERGY_ASSISTS, routineAssistCount),
            trustTarget: GUARDIAN_SYNERGY_ASSISTS,
            synergy: guardian.synergy,
            synergyUnlocked,
            expeditionCount: guardianExpeditions.length,
            lastExpedition,
            expeditionDebriefReady:
                state.pendingExpeditionDebrief?.guardianId === guardian.id,
            dialogueLine: interactionCount === 0
                ? guardian.rescueMemory
                : guardian.dialogue[(interactionCount - 1) % guardian.dialogue.length]
        };
    });
    const rescuedResidents = residents.filter(resident => resident.rescued);
    const residentById = new Map(residents.map(resident => [resident.id, resident]));
    const regionalAllies = (outcomeSnapshot.regionalAllies || []).map(outcome => ({
        ...residentById.get(outcome.guardianId),
        allied: true,
        outcome: outcome.outcome,
        standing: outcome.standing,
        sanctuaryPresence: outcome.sanctuaryPresence,
        regionRole: outcome.regionRole,
        outcomeLine: outcome.outcomeLine
    }));
    const taskFocusResident =
        rescuedResidents.find(resident => resident.taskStatus === 'ready') ||
        rescuedResidents.find(resident => resident.taskStatus === 'active') ||
        rescuedResidents.find(resident => resident.taskStatus === 'available') ||
        null;

    return {
        state,
        residents,
        rescuedResidents,
        sanctuaryResidents: rescuedResidents,
        regionalAllies,
        rescuedCount: state.rescuedIds.length,
        regionalAllyCount: regionalAllies.length,
        totalResidents: GUARDIAN_RESIDENT_DEFINITIONS.length,
        completedTaskCount: rescuedResidents.filter(
            resident => resident.teamAbilityUnlocked
        ).length,
        routineAssistCount: rescuedResidents
            .map(resident => resident.routineAssistCount)
            .reduce((total, count) => total + count, 0),
        supportedResidentCount: residents.filter(resident => (
            resident.rescued && resident.routineSupported
        )).length,
        synergyCount: residents.filter(resident => (
            resident.rescued && resident.synergyUnlocked
        )).length,
        activeTeamResident: residents.find(resident => resident.activeTeam) || null,
        careFocusResident: rescuedResidents.find(resident => resident.routineReady) || null,
        taskFocusResident
    };
}

export function getActiveGuardianTeamSupport(gameState) {
    const snapshot = getGuardianResidentsSnapshot(gameState);
    return createGuardianTeamSupport(snapshot.activeTeamResident);
}

export function createGuardianTeamSupport(resident) {
    const modifiers = resident?.teamAbility?.modifiers || {};
    const synergyModifiers = resident?.synergyUnlocked
        ? resident?.synergy?.modifiers || {}
        : {};
    const modifier = (key, fallback) => Math.max(
        fallback,
        Number(modifiers[key]) || fallback,
        Number(synergyModifiers[key]) || fallback
    );
    return {
        guardianId: resident?.id || null,
        guardianName: resident?.name || null,
        kind: resident?.kind || null,
        artwork: resident?.artwork || null,
        textureKey: resident?.textureKey || null,
        color: resident?.color || 0x8FE3CF,
        accent: resident?.accent || 0xF4F4F4,
        abilityId: resident?.teamAbility?.id || null,
        abilityName: resident?.teamAbility?.name || null,
        summary: resident?.teamAbility?.summary || null,
        activationLine: resident?.teamAbility?.activationLine || null,
        synergyName: resident?.synergyUnlocked ? resident.synergy.name : null,
        synergySummary: resident?.synergyUnlocked ? resident.synergy.summary : null,
        synergyUnlocked: Boolean(resident?.synergyUnlocked),
        maxHealthBonus: modifier('maxHealthBonus', 0),
        maxEnergyBonus: modifier('maxEnergyBonus', 0),
        guardCharges: modifier('guardCharges', 0),
        shieldHits: modifier('shieldHits', 0),
        speedMultiplier: modifier('speedMultiplier', 1),
        jumpMultiplier: modifier('jumpMultiplier', 1)
    };
}

export function createGuardianExpeditionDebrief(
    gameState,
    resident,
    expedition
) {
    if (!resident?.expeditionDebrief || !expedition?.levelId) return null;
    const companionName = typeof gameState?.get?.('creature.name') === 'string'
        ? gameState.get('creature.name').trim().slice(0, 24) || 'Your companion'
        : 'Your companion';
    const template = expedition.interventionCount > 0
        ? resident.expeditionDebrief.intervention
        : resident.expeditionDebrief.steady;
    return template
        .replaceAll('{companion}', companionName)
        .replaceAll('{expedition}', formatExpeditionLabel(expedition.levelId));
}

export function recordGuardianExpedition(gameState, {
    levelId,
    noDamage = false,
    interventionCount = 0,
    completedAt = new Date().toISOString(),
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const snapshot = getGuardianResidentsSnapshot(gameState);
    const resident = snapshot.activeTeamResident;
    const normalizedLevelId = typeof levelId === 'string'
        ? levelId.trim().slice(0, 40)
        : '';
    const normalizedCompletedAt = normalizeTimestamp(completedAt);
    if (!resident || !normalizedLevelId || !normalizedCompletedAt) {
        return {
            changed: false,
            reason: resident ? 'invalid_expedition' : 'no_active_guardian',
            resident,
            snapshot
        };
    }
    const entry = {
        guardianId: resident.id,
        levelId: normalizedLevelId,
        completedAt: normalizedCompletedAt,
        interventionCount: Math.max(
            0,
            Math.min(
                MAX_INTERACTIONS,
                Math.floor(Number(interventionCount) || 0)
            )
        ),
        noDamage: noDamage === true,
        debriefedAt: null
    };
    const state = normalizeGuardianResidentState({
        ...snapshot.state,
        expeditionHistory: [...snapshot.state.expeditionHistory, entry],
        pendingExpeditionDebrief: entry
    });
    gameState.set('world.guardianResidents', state);
    if (save) gameState.save?.();
    gameState.emit?.('guardianExpeditionRecorded', entry);
    const nextSnapshot = getGuardianResidentsSnapshot(gameState);
    return {
        changed: true,
        reason: 'guardian_expedition_recorded',
        entry,
        resident: nextSnapshot.activeTeamResident,
        state,
        snapshot: nextSnapshot
    };
}

export function recordGuardianActivity(gameState, activityType, {
    amount = 1,
    occurredAt = new Date().toISOString(),
    save = true
} = {}) {
    const guardianId = {
        gardenVisits: 'elder_treant',
        campfireRests: 'shadow_phoenix',
        targetHits: 'cosmic_titan'
    }[activityType];
    if (!guardianId) return null;
    if (!gameState?.get || !gameState?.set) return null;
    const increment = Math.max(0, Math.min(100, Math.floor(Number(amount) || 0)));
    if (increment === 0) return null;
    const snapshot = getGuardianResidentsSnapshot(gameState);
    if (
        !snapshot.state.acceptedTaskIds.includes(guardianId) ||
        snapshot.state.completedTaskIds.includes(guardianId)
    ) {
        return {
            changed: false,
            reason: 'guardian_task_inactive',
            activityType,
            state: snapshot.state,
            snapshot
        };
    }
    const previous = snapshot.state.activityEvidence[activityType] || 0;
    const next = Math.min(MAX_ACTIVITY_EVIDENCE, previous + increment);
    const state = normalizeGuardianResidentState({
        ...snapshot.state,
        activityEvidence: {
            ...snapshot.state.activityEvidence,
            [activityType]: next
        }
    });
    gameState.set('world.guardianResidents', state);
    if (save) gameState.save?.();
    gameState.emit?.('guardianResidentChanged', {
        type: 'guardian_activity',
        activityType,
        amount: next - previous,
        occurredAt
    });
    return {
        changed: next !== previous,
        activityType,
        previous,
        current: next,
        state,
        snapshot: getGuardianResidentsSnapshot(gameState)
    };
}

export function recordGuardianRescue(gameState, levelId, {
    rescuedAt = new Date().toISOString(),
    save = true
} = {}) {
    const guardian = GUARDIAN_BY_LEVEL.get(levelId);
    if (!guardian || !gameState?.get || !gameState?.set) return null;

    const snapshot = getGuardianResidentsSnapshot(gameState);
    const canonicalPresence = (
        getGuardianOutcomeSnapshot(gameState).sanctuaryPresences || []
    )
        .find(outcome => outcome.guardianId === guardian.id);
    if (!canonicalPresence) {
        return {
            changed: false,
            reason: 'regional_guardian_not_resident',
            guardian,
            state: snapshot.state,
            snapshot
        };
    }
    const alreadyRescued = snapshot.state.rescuedIds.includes(guardian.id);
    const state = normalizeGuardianResidentState({
        ...snapshot.state,
        rescuedIds: [...snapshot.state.rescuedIds, guardian.id],
        rescueHistory: alreadyRescued
            ? snapshot.state.rescueHistory
            : [
                ...snapshot.state.rescueHistory,
                { id: guardian.id, rescuedAt }
            ]
    });
    gameState.set('world.guardianResidents', state);
    if (save) gameState.save?.();
    if (!alreadyRescued) {
        gameState.emit?.('guardianResidentChanged', {
            type: 'guardian_rescued',
            guardianId: guardian.id,
            levelId,
            rescuedAt
        });
    }
    return {
        changed: !alreadyRescued,
        guardian,
        state,
        snapshot: getGuardianResidentsSnapshot(gameState)
    };
}

export function assistGuardianRoutine(gameState, guardianId, {
    occurredAt = new Date().toISOString(),
    save = true
} = {}) {
    if (!GUARDIAN_BY_ID.has(guardianId) || !gameState?.get || !gameState?.set) {
        return null;
    }
    const snapshot = getGuardianResidentsSnapshot(gameState, { now: occurredAt });
    const resident = snapshot.residents.find(entry => entry.id === guardianId);
    if (!resident?.rescued) {
        return { changed: false, reason: 'guardian_not_rescued', resident, snapshot };
    }
    if (!resident.met) {
        return { changed: false, reason: 'guardian_trust_required', resident, snapshot };
    }
    if (!resident.routineReady) {
        return {
            changed: false,
            reason: 'guardian_routine_recovering',
            message: `${resident.routine} // ready in ${formatGuardianRoutineRecovery(resident.routineWaitMs)}.`,
            resident,
            snapshot
        };
    }

    const previous = resident.routineAssistCount || 0;
    const next = Math.min(MAX_INTERACTIONS, previous + 1);
    const synergyUnlocked = (
        previous < GUARDIAN_SYNERGY_ASSISTS &&
        next >= GUARDIAN_SYNERGY_ASSISTS
    );
    const state = normalizeGuardianResidentState({
        ...snapshot.state,
        routineAssists: {
            ...snapshot.state.routineAssists,
            [guardianId]: next
        },
        routineHistory: [
            ...snapshot.state.routineHistory,
            { id: guardianId, assistedAt: occurredAt }
        ]
    });
    gameState.set('world.guardianResidents', state);
    if (save) gameState.save?.();
    gameState.emit?.('guardianResidentChanged', {
        type: synergyUnlocked
            ? 'guardian_synergy_unlocked'
            : 'guardian_routine_assisted',
        guardianId,
        routineAssistCount: next,
        occurredAt
    });
    const nextSnapshot = getGuardianResidentsSnapshot(gameState, { now: occurredAt });
    const responses = resident.routineCare.responses;
    return {
        changed: next !== previous,
        reason: synergyUnlocked
            ? 'guardian_synergy_unlocked'
            : 'guardian_routine_assisted',
        message: synergyUnlocked
            ? resident.synergy.memory
            : responses[previous % responses.length],
        resident: nextSnapshot.residents.find(entry => entry.id === guardianId),
        state,
        snapshot: nextSnapshot
    };
}

export function interactWithGuardianResident(gameState, guardianId, {
    occurredAt = new Date().toISOString(),
    save = true
} = {}) {
    if (!GUARDIAN_BY_ID.has(guardianId) || !gameState?.get || !gameState?.set) {
        return null;
    }
    const snapshot = getGuardianResidentsSnapshot(gameState);
    const resident = snapshot.residents.find(entry => entry.id === guardianId);
    if (!resident?.rescued) {
        return { changed: false, reason: 'guardian_not_rescued', resident, snapshot };
    }
    const interactionCount = Math.min(
        MAX_INTERACTIONS,
        resident.interactionCount + 1
    );
    const firstMeeting = !resident.met;
    const taskAccepted = snapshot.state.acceptedTaskIds.includes(guardianId);
    const taskCompleted = snapshot.state.completedTaskIds.includes(guardianId);
    const taskProgress = resident.taskProgress;
    const pendingExpeditionDebrief =
        snapshot.state.pendingExpeditionDebrief?.guardianId === guardianId
            ? snapshot.state.pendingExpeditionDebrief
            : null;
    let reason = 'guardian_return_visit';
    let message = resident.dialogueLine;
    const stateChanges = {
        ...snapshot.state,
        metIds: [...snapshot.state.metIds, guardianId],
        interactions: {
            ...snapshot.state.interactions,
            [guardianId]: interactionCount
        },
        lastInteractionId: guardianId,
        lastInteractionAt: occurredAt
    };

    if (firstMeeting) {
        reason = 'guardian_first_meeting';
        message = resident.rescueMemory;
    } else if (pendingExpeditionDebrief) {
        reason = 'guardian_expedition_debrief';
        message = createGuardianExpeditionDebrief(
            gameState,
            resident,
            pendingExpeditionDebrief
        );
        stateChanges.expeditionHistory = snapshot.state.expeditionHistory.map(
            entry => (
                entry.guardianId === guardianId &&
                entry.completedAt === pendingExpeditionDebrief.completedAt
                    ? { ...entry, debriefedAt: occurredAt }
                    : entry
            )
        );
        stateChanges.pendingExpeditionDebrief = null;
    } else if (!taskAccepted) {
        reason = 'guardian_task_accepted';
        message = resident.task.briefing;
        stateChanges.acceptedTaskIds = [
            ...snapshot.state.acceptedTaskIds,
            guardianId
        ];
        stateChanges.taskBaselines = {
            ...snapshot.state.taskBaselines,
            [guardianId]: getGuardianTaskEvidence(
                gameState,
                guardianId,
                snapshot.state
            )
        };
    } else if (!taskCompleted && taskProgress.ready) {
        reason = 'guardian_task_completed';
        message = resident.task.completionLine;
        stateChanges.completedTaskIds = [
            ...snapshot.state.completedTaskIds,
            guardianId
        ];
        stateChanges.activeTeamGuardianId =
            snapshot.state.activeTeamGuardianId || guardianId;
    } else if (!taskCompleted) {
        reason = 'guardian_task_progress';
        message = `${resident.task.objective} ${taskProgress.progress}/${taskProgress.target} complete.`;
    } else if (snapshot.state.activeTeamGuardianId !== guardianId) {
        reason = 'guardian_team_selected';
        message = resident.teamAbility.activationLine;
        stateChanges.activeTeamGuardianId = guardianId;
    }

    const state = normalizeGuardianResidentState(stateChanges);
    gameState.set('world.guardianResidents', state);
    if (save) gameState.save?.();
    gameState.emit?.('guardianResidentChanged', {
        type: reason,
        guardianId,
        interactionCount,
        occurredAt
    });
    const nextSnapshot = getGuardianResidentsSnapshot(gameState);
    return {
        changed: true,
        reason,
        message,
        resident: nextSnapshot.residents.find(entry => entry.id === guardianId),
        state,
        snapshot: nextSnapshot
    };
}

if (typeof window !== 'undefined') {
    window.GuardianResidents = {
        GUARDIAN_RESIDENTS_SCHEMA_VERSION,
        GUARDIAN_SYNERGY_ASSISTS,
        GUARDIAN_ROUTINE_RECOVERY_MS,
        GUARDIAN_RESIDENT_DEFINITIONS,
        GUARDIAN_SOCIAL_EXCHANGES,
        formatGuardianRoutineRecovery,
        normalizeGuardianResidentState,
        getGuardianResidentsSnapshot,
        getGuardianTaskEvidence,
        createGuardianTeamSupport,
        getActiveGuardianTeamSupport,
        createGuardianExpeditionDebrief,
        recordGuardianExpedition,
        recordGuardianActivity,
        recordGuardianRescue,
        assistGuardianRoutine,
        interactWithGuardianResident
    };
}
