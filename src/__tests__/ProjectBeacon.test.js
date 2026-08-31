const fs = require('fs');
const path = require('path');
const vm = require('vm');
const projectBeacon = require('../config/project-beacon.json');

function loadQuestManager(sceneWindow) {
    const filePath = path.join(__dirname, '../systems/QuestManager.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import projectBeacon from '../config/project-beacon.json';",
            'const projectBeacon = PROJECT_BEACON;'
        )
        .replace(
            'export default questManager;',
            'module.exports = { QuestManager, questManager };'
        );

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        PROJECT_BEACON: projectBeacon,
        Date,
        Math,
        Set,
        Map,
        Object,
        Array
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports.QuestManager;
}

function createGameState() {
    const state = {
        creature: { hatched: true },
        story: {
            projectBeacon: {
                currentMission: null,
                fieldKit: { recovered: false }
            }
        },
        quests: { active: [], completed: [], lastDailyReset: new Date().toDateString() }
    };

    return {
        state,
        get: jest.fn((propertyPath) => (
            propertyPath.split('.').reduce((value, key) => value?.[key], state)
        )),
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        on: jest.fn(),
        updateCreature: jest.fn(),
        save: jest.fn()
    };
}

describe('Project Beacon opening', () => {
    test('establishes approved canon without revealing the final choice', () => {
        const opening = projectBeacon.openingPages
            .map(page => `${page.title} ${page.subtitle} ${page.content}`)
            .join(' ');

        expect(projectBeacon.year).toBe(2026);
        expect(projectBeacon.title).toBe('Project Beacon');
        expect(opening).toMatch(/Earth/i);
        expect(opening).toMatch(/energy, mineral, and biological samples/i);
        expect(opening).toMatch(/katana/i);
        expect(opening).toMatch(/trust/i);
        expect(opening).toMatch(/Sensei/i);
        expect(opening).not.toMatch(/choose Earth|save Earth or|stay in the Void|this is home/i);
    });

    test('defines a short, actionable first-contact mission sequence', () => {
        expect(projectBeacon.fieldMissions).toHaveLength(4);
        expect(projectBeacon.fieldMissions.map(mission => mission.objective.type)).toEqual([
            'care_action',
            'story_interaction',
            'observe_living_signal',
            'landmark_visit'
        ]);
        expect(projectBeacon.fieldMissions.every(mission => mission.oneTime)).toBe(true);
    });

    test('builds the middle-game revelation gradually without deciding the ending', () => {
        expect(projectBeacon.campaignDebriefs).toHaveLength(5);
        expect(projectBeacon.campaignDebriefs.map(debrief => debrief.completionNumber)).toEqual([
            1, 2, 3, 4, 5
        ]);

        const campaignText = projectBeacon.campaignDebriefs
            .map(debrief => `${debrief.finding} ${debrief.companionMoment} ${debrief.fieldNote}`)
            .join(' ');

        expect(campaignText).toMatch(/protecting home/i);
        expect(campaignText).toMatch(/conversation no human has heard/i);
        expect(campaignText).toMatch(/message could also reveal this world/i);
        expect(campaignText).toMatch(/not ready to name the choice/i);
        expect(campaignText).not.toMatch(/return to Earth|stay in the Void|choose Earth|choose the Void/i);
    });

    test('records the first recovery as a guardian gift rather than extraction', () => {
        const firstDebrief = projectBeacon.campaignDebriefs[0];
        const firstReport = [
            firstDebrief.title,
            firstDebrief.finding,
            firstDebrief.companionMoment,
            firstDebrief.fieldNote
        ].join(' ');

        expect(firstReport).toMatch(/gift, not a sample/i);
        expect(firstReport).toMatch(/Elder guardian/i);
        expect(firstReport).toMatch(/offered after the rescue/i);
        expect(firstReport).toMatch(/It was not taken/i);
        expect(firstReport).toMatch(/knowing when to stop/i);
    });

    test('authors the first-expedition handoff as an invitation, not a plot choice', () => {
        const handoff = projectBeacon.firstExpeditionHandoff;
        const handoffText = Object.values(handoff).join(' ');

        expect(handoff.route).toMatch(/ROOTLIGHT ROUTE.*MYTHICAL FOREST/i);
        expect(handoff.finding).toMatch(/companion/i);
        expect(handoff.finding).toMatch(/living Current/i);
        expect(handoff.companionMoment).toMatch(/calling for help/i);
        expect(handoff.fieldNote).toMatch(/Sensei/i);
        expect(handoff.primaryAction).toBe('BEGIN EXPEDITION');
        expect(handoff.secondaryAction).toBe('LOOK AROUND');
        expect(handoffText).not.toMatch(
            /choose Earth|save Earth or|stay in the Void|abandon Earth/i
        );
    });

    test('pins the quest tracker to the camera viewport', () => {
        const trackerSource = fs.readFileSync(
            path.join(__dirname, '../systems/ui/QuestTracker.js'),
            'utf8'
        );

        expect(trackerSource).toContain('this.container.setScrollFactor(0)');
    });

    test('provides a local recovery preview without invoking save recovery', () => {
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const sceneSource = fs.readFileSync(path.join(__dirname, '../scenes/GameScene.js'), 'utf8');

        expect(gameSource).toContain(
            "['1', 'mobile', 'earth', 'crystal', 'aurora'].includes(testFieldKit)"
        );
        expect(gameSource).toContain('fieldKitPreview: true');
        expect(gameSource).toContain("fieldKitPreviewSize: testFieldKit === 'mobile' ? 'mobile' : null");
        expect(gameSource).toContain('fieldKitPreviewStage:');
        expect(sceneSource).toContain('if (this.fieldKitPreview)');
        expect(sceneSource).toContain('this.showFieldKitRecoveryModal(');
    });

    test('activates one story mission at a time and advances after claiming', () => {
        const gameState = createGameState();
        const sceneWindow = {
            GameState: gameState,
            EconomyManager: { addCoins: jest.fn() }
        };
        const QuestManager = loadQuestManager(sceneWindow);
        const manager = new QuestManager();

        const firstMission = manager.ensureProjectBeaconQuest();
        manager.trackProgress('care_action', { action: 'feed' });
        manager.claimReward(firstMission.questId);

        const storyQuests = manager.getQuestsByType('story');
        expect(firstMission.completed).toBe(true);
        expect(manager.completedQuests).toContain('beacon_first_contact');
        expect(storyQuests).toHaveLength(1);
        expect(storyQuests[0].id).toBe('beacon_field_kit');
        expect(gameState.set).toHaveBeenCalledWith(
            'story.projectBeacon.currentMission',
            'beacon_field_kit'
        );

        manager.trackProgress('story_interaction', { event: 'field_kit_recovered' });
        manager.claimReward('beacon_field_kit');

        expect(manager.getQuestsByType('story')[0].id).toBe('beacon_living_signals');
        expect(gameState.set).toHaveBeenCalledWith(
            'story.projectBeacon.currentMission',
            'beacon_living_signals'
        );
        expect(gameState.save).toHaveBeenCalled();
    });

    test('persists story progress and reward advancement immediately', () => {
        const gameState = createGameState();
        const sceneWindow = {
            GameState: gameState,
            EconomyManager: { addCoins: jest.fn() }
        };
        const QuestManager = loadQuestManager(sceneWindow);
        const manager = new QuestManager();
        const mission = manager.ensureProjectBeaconQuest({ persist: false });

        manager.trackProgress('care_action', { action: 'play' });
        const savesAfterProgress = gameState.save.mock.calls.length;
        manager.claimReward(mission.questId);

        expect(savesAfterProgress).toBeGreaterThan(0);
        expect(gameState.save.mock.calls.length).toBeGreaterThan(savesAfterProgress);
        expect(gameState.state.quests.completed).toContain('beacon_first_contact');
        expect(gameState.state.story.projectBeacon.currentMission).toBe(
            'beacon_field_kit'
        );
    });

    test('reconciles a recovered field kit when its mission becomes active later', () => {
        const gameState = createGameState();
        gameState.state.story.projectBeacon.fieldKit.recovered = true;
        gameState.state.quests.completed = ['beacon_first_contact'];
        const sceneWindow = {
            GameState: gameState,
            EconomyManager: { addCoins: jest.fn() }
        };
        const QuestManager = loadQuestManager(sceneWindow);
        const manager = new QuestManager();
        manager.loadQuestState();

        const fieldKitMission = manager.ensureProjectBeaconQuest();

        expect(fieldKitMission.id).toBe('beacon_field_kit');
        expect(fieldKitMission.progress).toBe(fieldKitMission.objective.target);
        expect(fieldKitMission.completed).toBe(true);
    });

    test('migrates partial legacy signal-survey progress without resetting it', () => {
        const gameState = createGameState();
        gameState.state.world = {
            livingSignals: {
                observedIds: ['echo_bloom']
            }
        };
        gameState.state.quests.active = [{
            id: 'beacon_living_signals',
            questId: 'beacon_living_signals',
            name: 'Survey Living Signals',
            type: 'story',
            objective: { type: 'collect_items', target: 3 },
            progress: 2,
            completed: false,
            claimed: false
        }];
        const sceneWindow = {
            GameState: gameState,
            EconomyManager: { addCoins: jest.fn() }
        };
        const QuestManager = loadQuestManager(sceneWindow);
        const manager = new QuestManager();
        manager.loadQuestState();

        const migrated = manager.ensureProjectBeaconQuest();

        expect(migrated.objective).toEqual(expect.objectContaining({
            type: 'observe_living_signal',
            target: 3
        }));
        expect(migrated.progress).toBe(2);
        expect(migrated.completed).toBe(false);
        expect(gameState.state.world.livingSignals.observedIds).toEqual([
            'echo_bloom',
            'memory_stone'
        ]);
    });
});
