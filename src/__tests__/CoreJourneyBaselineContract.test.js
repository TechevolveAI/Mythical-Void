const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const baselinePath = path.join(
    rootDir,
    'docs/product/core-journey-baseline-2026-09-09.json'
);

function read(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('core journey baseline contract', () => {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

    test('protects the six journeys that can block the opening expedition', () => {
        expect(baseline.protectedJourneys.map(journey => journey.id)).toEqual([
            'hatch_name_rarity',
            'portrait_to_sanctuary',
            'sanctuary_entry_and_resume',
            'forest_three_lights_guardian',
            'forest_rescue_return',
            'mobile_core_controls'
        ]);
        expect(baseline.changeBoundaries).toEqual(expect.objectContaining({
            preserveSaveCompatibility: true,
            generatedMediaMayBlockPlay: false,
            oneFeaturePerRelease: true,
            unrelatedLevelsRemainUntouched: true,
            wholesaleRewriteAuthorized: false
        }));
    });

    test('keeps every declared owner and focused test source-controlled', () => {
        baseline.protectedJourneys.forEach(journey => {
            [...journey.ownerFiles, ...journey.focusedTests].forEach(file => {
                expect(fs.existsSync(path.join(rootDir, file))).toBe(true);
            });
        });
    });

    test('keeps the third Forest light wired directly to Guardian awakening', () => {
        const forest = read('src/scenes/levels/MythicalForestLevel.js');

        expect(forest).toContain(
            'this.beginAutomaticGuardianAwakening(checkpoint);'
        );
        expect(forest).toMatch(
            /this\.beaconAnchorsActivated === this\.checkpointAnchors\.length[\s\S]*this\.forestRouteAligned = true;[\s\S]*this\.beginAutomaticGuardianAwakening\(checkpoint\);/
        );
        expect(forest).toMatch(
            /restoreExpeditionRouteState\(resume\)[\s\S]*this\.forestRouteAligned && !this\.bossDefeated[\s\S]*this\.beginAutomaticGuardianAwakening\(/
        );
        expect(forest).toContain(
            'ALL 3 ROOT BEACONS FOUND\\nTHE GUARDIAN IS WAKING'
        );
    });

    test('records an exact, reversible live baseline', () => {
        expect(baseline.production.playUrl).toBe(
            'https://mythicalvoid.com/play/'
        );
        expect(baseline.production.netlifyDeployId).toMatch(/^[a-f0-9]{24}$/);
        expect(baseline.production.publishedSourceCommit).toMatch(/^[a-f0-9]{40}$/);
        expect(baseline.production.protectedMainAtFreeze).toMatch(/^[a-f0-9]{40}$/);
        expect(baseline.production.rollbackTarget).toBe(
            baseline.production.netlifyDeployId
        );
    });
});
