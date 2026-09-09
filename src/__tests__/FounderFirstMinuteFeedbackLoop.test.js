const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const studio = fs.readFileSync(path.join(root, 'public/studio/index.html'), 'utf8');
const feedback = fs.readFileSync(path.join(root, 'public/feedback/index.html'), 'utf8');

describe('founder first-minute feedback loop', () => {
    test('turns the founder story into one clear play-and-return path', () => {
        expect(studio).toContain('id="first-minute"');
        expect(studio).toContain('Try the first minute');
        expect(studio).toContain('Open the game in a new tab');
        expect(studio).toContain('href="/play/" target="_blank" rel="noopener"');
        expect(studio).toContain('data-source-area="studio_first_minute"');
        expect(studio).toContain('href="/feedback/"');
        expect(studio).toContain('Give anonymous adult feedback');
    });

    test('asks for honest learning without manufacturing approval or activity', () => {
        expect(studio).toContain('This is not a request for praise.');
        expect(studio).toMatch(/what made sense and what did not/i);
        expect(studio).not.toMatch(/people (?:are )?playing|players? online|everyone loves|five stars/i);
        expect(studio).not.toMatch(/[?&](?:utm_|fbclid|gclid)/i);
    });

    test('keeps feedback adult-only, fixed-choice and non-identifying', () => {
        expect(studio).toContain('For adults only:');
        expect(studio).toContain('asks for no name or contact details');
        expect(feedback).toContain('I confirm that I am 18 or older.');
        expect(feedback).not.toMatch(/<textarea|type="(?:email|text|file|date)"|contenteditable/i);
    });
});
