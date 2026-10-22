const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

function readSource(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('cinematic media integration', () => {
    test('ships permanent video assets for the key world spaces', () => {
        [
            'public/game/cinematics/fend-crash-site-loop.mp4',
            'public/game/cinematics/village-heart-loop.mp4',
            'public/game/cinematics/mythical-forest-arrival-loop.mp4'
        ].forEach(relativePath => {
            const fullPath = path.join(repoRoot, relativePath);
            expect(fs.existsSync(fullPath)).toBe(true);
            expect(fs.statSync(fullPath).size).toBeGreaterThan(100000);
        });
    });

    test('keeps the opening cinematic while village planning menus remain still', () => {
        const hatchingScene = readSource('src/scenes/HatchingScene.js');
        const villagePanel = readSource('src/ui/VillageCommandPanel.js');

        expect(hatchingScene).toContain('createProjectBeaconMotionBackdrop');
        expect(hatchingScene).toContain('CINEMATIC_MEDIA.projectBeaconHome.url');
        expect(hatchingScene).toContain("video.setMute?.(true)");
        expect(hatchingScene).toContain('shouldPlayCinematicMedia()');
        expect(villagePanel).not.toContain('village-command-vision-video');
        expect(villagePanel).not.toContain('CINEMATIC_MEDIA.villageHeart.url');
    });

    test('plays creature story clips silently and inline on mobile', () => {
        const companionMedia = readSource('src/systems/CompanionMediaService.js');

        expect(companionMedia).toContain("video.setMute?.(true)");
        expect(companionMedia).toContain("video.video?.setAttribute?.('playsinline', '')");
    });
});
