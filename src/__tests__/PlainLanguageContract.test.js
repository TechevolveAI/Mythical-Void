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

function oneLineQuotedStrings(source) {
    return source.match(/(['"`])(?:\\.|(?!\1).)*\1/g) || [];
}

const PLAYER_COPY_SYSTEM_FILES = [
    'src/systems/CampaignLegacy.js',
    'src/systems/CollectibleManager.js',
    'src/systems/CompanionConsent.js',
    'src/systems/CompanionIdentityArchive.js',
    'src/systems/CreatureAI.js',
    'src/systems/CurrentEcology.js',
    'src/systems/CurrentVeilMission.js',
    'src/systems/FendCulture.js',
    'src/systems/FendResidents.js',
    'src/systems/FusionConsent.js',
    'src/systems/FusionPodLandmark.js',
    'src/systems/GameState.js',
    'src/systems/GuardianCompanionRecognition.js',
    'src/systems/GuardianResidents.js',
    'src/systems/HatchCinematics.js',
    'src/systems/HomecomingHandoff.js',
    'src/systems/KidMode.js',
    'src/systems/LivingPortraitService.js',
    'src/systems/ProtectedReturnProtocol.js',
    'src/systems/QuestManager.js',
    'src/systems/RemainAndDefendCampaign.js',
    'src/systems/SanctuaryCheckIn.js',
    'src/systems/SanctuaryCommunity.js',
    'src/systems/SenseiMemory.js',
    'src/systems/SharedFusionInvitationService.js',
    'src/systems/ShipEvidence.js',
    'src/systems/ShipReconstruction.js',
    'src/systems/SignalGarden.js',
    'src/systems/VillageSettlement.js',
    'src/systems/ui/CarePanelManager.js',
    'src/systems/world/WorldBuilder.js'
];

function unwrapQuotedString(value) {
    return value.slice(1, -1);
}

function visibleTemplateText(value) {
    return value.replace(/\$\{[^}]+\}/g, '');
}

function isCompatibilityString(value) {
    const normalized = value.trim();
    if (['companion', 'signal', 'signals'].includes(normalized)) return true;
    if (normalized.startsWith('[') || normalized.includes('{companion}')) return true;
    if (/^(?:https?:|\/|\.|#)/i.test(normalized)) return true;
    return normalized === normalized.toLowerCase() &&
        /^[a-z0-9_$./:?=&{}-]+$/.test(normalized) &&
        /[._:/?=&{}-]/.test(normalized);
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

    test('uses creature language throughout the opening journey', () => {
        const projectBeacon = collectStrings(JSON.parse(fs.readFileSync(
            path.join(root, 'src/config/project-beacon.json'),
            'utf8'
        )));
        const openingSources = [
            'src/systems/TutorialSystem.js',
            'src/systems/CareSystem.js',
            'src/systems/FirstExpeditionDrill.js',
            'src/systems/LivingSignalSurvey.js',
            'src/systems/ProjectBeaconStory.js'
        ];
        const openingCopy = openingSources.flatMap(file => oneLineQuotedStrings(
            fs.readFileSync(path.join(root, file), 'utf8')
        ));
        const offenders = [...projectBeacon, ...openingCopy]
            .filter(value => /\bcompanions?\b/i.test(value));

        expect(offenders).toEqual([]);

        const gameScene = fs.readFileSync(
            path.join(root, 'src/scenes/GameScene.js'),
            'utf8'
        );
        for (const clearPhrase of [
            'PROJECT BEACON // CREATURE CARE',
            'HATCH A CREATURE',
            'CREATURE // ${result.signal.companionLine}',
            'NEXT // Follow your creature toward the World Gate.',
            'TAP TO VIEW CREATURE PROFILE'
        ]) expect(gameScene).toContain(clearPhrase);
        for (const retiredPhrase of [
            'PROJECT BEACON // COMPANION CARE',
            'HATCH A COMPANION',
            'COMPANION // ${result.signal.companionLine}',
            'NEXT // Follow your companion toward the World Gate.',
            'TAP TO VIEW COMPANION PROFILE'
        ]) expect(gameScene).not.toContain(retiredPhrase);
    });

    test('keeps player copy clear while preserving compatibility identifiers', () => {
        const sourceFiles = [
            ...walk(path.join(root, 'src/scenes'), '.js'),
            ...walk(path.join(root, 'src/ui'), '.js'),
            ...PLAYER_COPY_SYSTEM_FILES.map(file => path.join(root, file))
        ];
        const offenders = sourceFiles.flatMap(file => oneLineQuotedStrings(
            fs.readFileSync(file, 'utf8')
        ).map(unwrapQuotedString)
            .map(visibleTemplateText)
            .filter(value => !isCompatibilityString(value))
            .filter(value => /\b(?:companions?|signals?)\b/i.test(value))
            .map(value => `${path.relative(root, file)}: ${value}`));

        const kidModeCopy = collectStrings(JSON.parse(fs.readFileSync(
            path.join(root, 'src/config/kid-mode.json'),
            'utf8'
        ))).filter(value => /\b(?:companions?|signals?)\b/i.test(value));

        expect([...offenders, ...kidModeCopy]).toEqual([]);

        const compatibilitySources = [
            fs.readFileSync(path.join(root, 'src/systems/CompanionMediaService.js'), 'utf8'),
            fs.readFileSync(path.join(root, 'src/systems/VillageSettlement.js'), 'utf8'),
            fs.readFileSync(path.join(root, 'src/systems/GuardianResidents.js'), 'utf8')
        ].join('\n');
        expect(compatibilitySources).toContain('generate-companion-video');
        expect(compatibilitySources).toContain('player_companion');
        expect(compatibilitySources).toContain("replaceAll('{companion}'");
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
