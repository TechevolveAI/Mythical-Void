const fs = require('fs');
const path = require('path');

const levelFiles = [
    'CrystalCavesLevel.js',
    'ReefLevel.js',
    'MythicalForestLevel.js',
    'VoidPeaksLevel.js',
    'AuroraDepthsLevel.js',
    'FinalVoidLevel.js'
];

const levelSources = levelFiles.map(fileName => ({
    fileName,
    source: fs.readFileSync(
        path.join(__dirname, '../scenes/levels', fileName),
        'utf8'
    )
}));

const achievementSource = fs.readFileSync(
    path.join(__dirname, '../systems/AchievementSystem.js'),
    'utf8'
);
const gameSource = fs.readFileSync(
    path.join(__dirname, '../game.js'),
    'utf8'
);

const bossConfig = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../config/bosses.json'),
    'utf8'
));

describe('guardian restoration campaign contract', () => {
    test.each(levelSources)(
        '$fileName records a guardian restoration',
        ({ source }) => {
            expect(source).toContain("recordEvent('guardian_restored'");
            expect(source).not.toContain("recordEvent('boss_defeated'");
        }
    );

    test('keeps legacy achievement compatibility behind the new event', () => {
        expect(achievementSource).toMatch(
            /case 'guardian_restored':\s*case 'boss_defeated':/
        );
        expect(achievementSource).toContain("name: 'Guardian Restorer'");
        expect(achievementSource).toContain("name: 'Crystal Keeper'");
    });

    test('all configured guardian result messages describe restoration', () => {
        const resultMessages = Object.values(bossConfig)
            .filter(config => config && typeof config === 'object')
            .map(config => config.messages?.defeat)
            .filter(Boolean);

        expect(resultMessages).toHaveLength(6);
        resultMessages.forEach(message => {
            expect(message).toContain('RESTORED');
        });
    });

    test('campaign result screens avoid conquest and destruction language', () => {
        const campaignSource = levelSources
            .map(({ source }) => source)
            .join('\n');

        [
            'Boss Reward',
            'VOID EMPRESS BANISHED',
            'VOID EMPRESS DEFEATED',
            'MINIBOSS DEFEATED'
        ].forEach(forbiddenText => {
            expect(campaignSource).not.toContain(forbiddenText);
        });

        expect(campaignSource).toContain('Guardian Reward');
        expect(campaignSource).toContain('VOID EMPRESS RESTORED');
        expect(campaignSource).toContain('CRYSTAL SPIDER CALMED');
    });

    test('provides a local non-mutating final restoration preview', () => {
        const finalVoidSource = levelSources.find(
            ({ fileName }) => fileName === 'FinalVoidLevel.js'
        ).source;

        expect(gameSource).toContain(
            "urlParams.get('testGuardianResult') === 'finalVoid'"
        );
        expect(gameSource).toContain(
            "game.scene.start('FinalVoidLevel', {"
        );
        expect(gameSource).toContain('resultPreview: true');
        expect(finalVoidSource).toContain(
            "previewParams.get('testGuardianResult') === 'finalVoid'"
        );
        expect(finalVoidSource).toContain(
            'this.testMode = data?.testMode || this.resultPreview'
        );
        expect(finalVoidSource).toMatch(
            /if \(this\.resultPreview\) \{[\s\S]*?this\.levelCompletionResult = \{\s*coinsAwarded: 900,\s*guardianResident: \{/
        );
        expect(finalVoidSource).toContain(
            "window.RescuedResidents\n                ?.getRescuedResidentByLevel?.('finalVoid')"
        );
        expect(finalVoidSource).toContain('rescuedResident: resident');
        expect(finalVoidSource).toContain("id: 'void_empress'");
        expect(finalVoidSource).toContain("role: 'Current Witness'");
        expect(finalVoidSource).toContain(
            'if (!this.resultPreview && window.AchievementSystem?.recordEvent)'
        );
        expect(finalVoidSource).toMatch(
            /!this\.entryPreview &&\s*!this\.resultPreview &&\s*window\.AchievementSystem\?\.recordEvent/
        );
    });
});
