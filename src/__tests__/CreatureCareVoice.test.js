const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCareVoice() {
    const filePath = path.join(__dirname, '../systems/CreatureCareVoice.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export function /g, 'function ')
        .replace(/export \{[\s\S]*?\};/, '')
        .concat('\nmodule.exports = { CARE_PROFILES, CARE_REACTIONS, CARE_REPETITION_REACTIONS, CARE_RESONANCE_REACTIONS, CARE_STEADY_REACTIONS, getCreatureCareProfile, getCreatureCareReaction };');
    const sandbox = { module: { exports: {} }, exports: {}, Object };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Creature care voice', () => {
    const {
        CARE_PROFILES,
        CARE_REACTIONS,
        getCreatureCareProfile,
        getCreatureCareReaction
    } = loadCareVoice();

    test('gives every genetic personality an observable care rhythm', () => {
        expect(Object.keys(CARE_PROFILES)).toEqual([
            'curious',
            'playful',
            'gentle',
            'wise',
            'energetic'
        ]);

        Object.entries(CARE_PROFILES).forEach(([core, profile]) => {
            expect(['feed', 'play', 'rest', 'pet']).toContain(profile.preferredAction);
            expect(profile.observation.length).toBeGreaterThan(45);
            expect(Object.keys(CARE_REACTIONS[core])).toEqual([
                'feed',
                'play',
                'rest',
                'pet'
            ]);
        });
    });

    test('keeps the same care action meaningfully distinct across personalities', () => {
        const reactions = Object.keys(CARE_PROFILES).map(core => (
            getCreatureCareReaction('play', { personality: { core } })
        ));

        expect(new Set(reactions).size).toBe(5);
        expect(reactions.join(' ')).toMatch(/Current|route|movement|feeling/i);
        expect(reactions.join(' ')).not.toMatch(/giggles|adorable|best friend|loves cuddles/i);
    });

    test('falls back safely for incomplete older genetics', () => {
        expect(getCreatureCareProfile(null).personalityCore).toBe('curious');
        expect(getCreatureCareReaction('unknown', null)).toMatch(/feel/i);
    });

    test('remembers repeated care and asks for a different rhythm', () => {
        const response = getCreatureCareReaction(
            'play',
            { personality: { core: 'playful' } },
            { consecutiveActionCount: 2, actionCount: 2, energy: 80 }
        );

        expect(response).toMatch(/same move twice|changing the rules/i);
        expect(response).not.toMatch(/again!|more attention|bad owner/i);
    });

    test('recognizes a remembered preference without dependency language', () => {
        const responses = Object.keys(CARE_PROFILES).map(core => {
            const profile = CARE_PROFILES[core];
            return getCreatureCareReaction(
                profile.preferredAction,
                { personality: { core } },
                {
                    actionCount: 3,
                    consecutiveActionCount: 1,
                    isPreferred: true,
                    happiness: 80,
                    energy: 80
                }
            );
        });

        expect(new Set(responses).size).toBe(5);
        expect(responses.join(' ')).toMatch(/remembered|recognized|read my mood/i);
        expect(responses.join(' ')).not.toMatch(/need you|never leave|best friend|love me/i);
    });

    test('makes low energy legible before another active care action', () => {
        expect(getCreatureCareReaction(
            'play',
            { personality: { core: 'energetic' } },
            { energy: 23 }
        )).toMatch(/energy is low|recovery cycle/i);
    });
});
