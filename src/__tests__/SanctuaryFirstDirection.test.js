const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../scenes/GameScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'GameScene');

function fixture({ forestComplete = false, arrivalSeen = false } = {}) {
    const state = {
        get: key => ({ 'levels.mythicalForest.completed': forestComplete,
            'tutorial.villageHeartArrivalSeen': arrivalSeen })[key],
        recordOpeningMilestone: jest.fn(), save: jest.fn()
    };
    const scene = {
        currentBiome: 'nebula', villageHeartLandmark: { snapshot: { unlock: { unlocked: true } } },
        questTracker: { showStoryMissionBriefing: jest.fn() },
        scheduleVillageArrivalReveal: jest.fn()
    };
    for (const name of ['finishSanctuaryOnboarding', 'shouldPlayVillageArrivalReveal']) {
        const node = declaration.body.body.find(method => method.key?.name === name);
        scene[name] = vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, {
            window: { GameState: state, QuestManager: { getQuestsByType: () => [{ id: 'first', type: 'story' }] } }
        });
    }
    return { scene, state };
}

test('the first handover gives an exploration route without taking control for the Heart', () => {
    const { scene, state } = fixture();
    scene.finishSanctuaryOnboarding({ firstSanctuaryVisit: true });
    expect(scene.scheduleVillageArrivalReveal).not.toHaveBeenCalled();
    const briefing = scene.questTracker.showStoryMissionBriefing.mock.calls[0][0];
    expect(briefing.briefing).toContain('Sanctuary');
    expect(briefing.briefing).toContain('Mythical Forest');
    expect(briefing.guidanceMobile).toContain('tap Explore');
    expect(briefing.guidanceDesktop).toContain('press SPACE');
    expect(state.recordOpeningMilestone).toHaveBeenCalledWith('first_objective_ready');
    expect(state.save).toHaveBeenCalledTimes(1);
});

test('refreshing before the first forest is complete cannot trigger the Heart reveal', () => {
    expect(fixture().scene.shouldPlayVillageArrivalReveal()).toBe(false);
    expect(fixture({ forestComplete: true }).scene.shouldPlayVillageArrivalReveal()).toBe(true);
    expect(fixture({ forestComplete: true, arrivalSeen: true }).scene.shouldPlayVillageArrivalReveal()).toBe(false);
});

test('a departed scene cannot show or save a stale onboarding handover', () => {
    const { scene, state } = fixture();
    scene._isShuttingDown = true;
    scene.finishSanctuaryOnboarding({ firstSanctuaryVisit: true });
    expect(scene.questTracker.showStoryMissionBriefing).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
});
