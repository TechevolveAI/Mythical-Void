const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');

function walk(directory, extension) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) return walk(absolute, extension);
        return entry.name.endsWith(extension) ? [absolute] : [];
    });
}

function visibleText(html) {
    return html
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, ' ');
}

function collectStrings(value, output = []) {
    if (typeof value === 'string') output.push(value);
    else if (Array.isArray(value)) value.forEach(item => collectStrings(item, output));
    else if (value && typeof value === 'object') {
        Object.values(value).forEach(item => collectStrings(item, output));
    }
    return output;
}

describe('plain-language public story', () => {
    test('does not show the vague word signal on public pages', () => {
        const offenders = walk(path.join(root, 'public'), '.html')
            .filter(file => /\bsignals?\b/i.test(visibleText(fs.readFileSync(file, 'utf8'))))
            .map(file => path.relative(root, file));

        expect(offenders).toEqual([]);
    });

    test('keeps public news and creature writing free of the vague word', () => {
        const files = [
            'public/updates/releases.json',
            'public/updates/feed.json',
            'src/data/creature-field-guide.json',
            'src/config/creature-responses.json'
        ];
        const offenders = files.flatMap(file => collectStrings(
            JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
        ).filter(value => /\bsignals?\b/i.test(value)).map(value => `${file}: ${value}`));

        expect(offenders).toEqual([]);
    });

    test('keeps changing public-page messages and player-facing game screens clear', () => {
        const files = [
            'public/discovery.js',
            'src/scenes/HatchingScene.js',
            'src/ui/LivingFormHandoff.js',
            'src/systems/CreatureAIController.js'
        ];
        const offenders = files.filter(file => /\bsignals?\b/i.test(
            fs.readFileSync(path.join(root, file), 'utf8')
        ));

        expect(offenders).toEqual([]);
    });

    test('uses clear words for different situations', () => {
        const storefront = fs.readFileSync(path.join(root, 'src/site/storefront.js'), 'utf8');
        const projectBeacon = fs.readFileSync(path.join(root, 'src/config/project-beacon.json'), 'utf8');
        const spacePage = fs.readFileSync(path.join(root, 'public/space-discovery/index.html'), 'utf8');

        expect(storefront).toContain('read the strange message');
        expect(storefront).toContain('Follow the clue');
        expect(projectBeacon).toContain('Look for Signs of Life');
        expect(spacePage).toContain("TODAY'S SPACE DISCOVERY");
    });
});
