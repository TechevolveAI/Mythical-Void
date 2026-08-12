const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadConversationVoice() {
    const filePath = path.join(__dirname, '../systems/CreatureConversationVoice.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace('export const CREATURE_CONVERSATION', 'const CREATURE_CONVERSATION')
        .replace('export { PERSONALITY_DIALOGUE };', '')
        .concat('\nmodule.exports = { CREATURE_CONVERSATION, PERSONALITY_DIALOGUE };');
    const sandbox = { module: { exports: {} }, exports: {}, Object };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Creature conversation voice', () => {
    const { CREATURE_CONVERSATION, PERSONALITY_DIALOGUE } = loadConversationVoice();

    test('authors complete, distinct voices for all five personalities', () => {
        expect(Object.keys(PERSONALITY_DIALOGUE)).toHaveLength(5);
        Object.values(PERSONALITY_DIALOGUE).forEach(voice => {
            expect(Object.keys(voice.greetings)).toEqual(['happy', 'neutral', 'sad', 'upset']);
            expect(Object.keys(voice.responses)).toEqual([
                'general',
                'play',
                'feelings',
                'adventure',
                'food',
                'affection',
                'story'
            ]);
        });

        const routeResponses = Object.values(
            CREATURE_CONVERSATION.creatureResponses.adventure
        ).flat();
        expect(new Set(routeResponses).size).toBe(5);
    });

    test('uses grounded player choices without dependency or infantile copy', () => {
        const allCopy = JSON.stringify(CREATURE_CONVERSATION);
        expect(allCopy).toMatch(/Current|Sanctuary|signal|route/i);
        expect(allCopy).not.toMatch(
            /best friend|you are the best|you're the best|giggles|adorable|big eyes|cheering up/i
        );
        expect(CREATURE_CONVERSATION.playerOptions.general).toHaveLength(4);
    });
});
