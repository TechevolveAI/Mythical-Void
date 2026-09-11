const fs = require('fs');
const path = require('path');

describe('generated creature video delivery', () => {
    const platformer = fs.readFileSync(
        path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
        'utf8'
    );
    const mediaService = fs.readFileSync(
        path.join(__dirname, '../systems/CompanionMediaService.js'),
        'utf8'
    );

    test('surfaces clips that finish after an expedition has already started', () => {
        expect(platformer).toContain("'companionVideoStatus'");
        expect(platformer).toContain('getUnviewedGeneratedVideos');
        expect(platformer).toContain("YOUR CREATURE\\'S SCENE IS READY");
        expect(platformer).toContain('showGeneratedVideoPlayback(ready)');
    });

    test('keeps delivery non-blocking and cleans listeners on scene shutdown', () => {
        expect(platformer).toContain('setupGeneratedVideoDelivery();');
        expect(platformer).toContain('this.updateGeneratedVideoDelivery(time);');
        expect(platformer).toContain('this.generatedVideoStatusUnsubscribe?.();');
        expect(platformer).toContain('this.clearGeneratedVideoPlayback({ resume: false });');
    });

    test('allows enough time for a private mobile clip to begin buffering', () => {
        expect(mediaService).toContain('videoStartupMs: 6000');
        expect(mediaService).toContain('this.timeouts.videoStartupMs');
        expect(mediaService).not.toContain('delayedCall?.(1800');
    });
});
