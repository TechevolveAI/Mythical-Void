const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '../ui/VillageCommandPanel.js');
const source = fs.readFileSync(file, 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
    .replace('export default class VillageCommandPanel', 'class VillageCommandPanel')
    + '\nmodule.exports = VillageCommandPanel;';

describe.each(['contextual', 'guided', 'helpers'])('Village helper selection: %s', mode => {
    let panel, snapshot, onAssign, onTick;
    const picker = () => panel.root.querySelector('.village-creature-select');
    const invite = () => panel.root.querySelector(mode === 'guided'
        ? '.village-guided-assignment button' : '.village-invite-button');
    const choose = value => {
        picker().value = value;
        picker().dispatchEvent(new Event('change', { bubbles: true }));
    };
    const show = () => {
        panel.show({ getSnapshot: () => snapshot, onAssign, onTick,
            ...(mode === 'guided' ? { guided: true } : mode === 'contextual' ? { plotId: 'plot_one' } : {}) });
        if (mode === 'helpers') panel.root.querySelector('[data-view="helpers"]').click();
    };

    beforeEach(() => {
        jest.useFakeTimers();
        const definition = {
            id: 'forager_hut', label: 'Forager Hut', shortLabel: 'Forager',
            production: { resource: 'food', amount: 1 }, cost: {},
            placement: { alreadyBuilt: true, revealed: true, available: false },
            immediateImpact: 'Gathers food.', extensionImpact: 'Supports expeditions.'
        };
        snapshot = {
            definitions: [definition],
            plots: [{ id: 'plot_one', label: 'Clearing', open: false,
                building: { id: 'building_one', definitionId: definition.id } }],
            buildings: [{ id: 'building_one', plotId: 'plot_one', definition,
                definitionId: definition.id, status: 'complete', assignedCreatureId: 'nova' }],
            roster: [{ id: 'nova', name: 'Nova' }, { id: 'lumen', name: 'Lumen' }],
            phase: { complete: false, milestones: [], title: 'Grow', objective: 'Help' },
            resources: {}, capacity: 2, unlock: { unlocked: true },
            onboarding: { firstLoopComplete: true },
            worldState: { nextAction: { type: 'assign', buildingId: 'building_one',
                definitionId: definition.id, plotId: 'plot_one' } }
        };
        const context = { module: { exports: {} }, window, document, console,
            VILLAGE_RESOURCE_DEFINITIONS: [],
            VILLAGE_BUILDING_ARTWORK: { habitat: { url: '/synthetic-building.png' } },
            getVillageResidentProposal: () => null,
            getVillageSupportSummary: () => [],
            shouldPlayCinematicMedia: () => false,
            requestAnimationFrame: callback => window.setTimeout(callback, 0) };
        vm.runInNewContext(source, context, { filename: file });
        panel = new context.module.exports({ input: { enabled: true } });
        onAssign = jest.fn(() => ({ changed: true, reason: 'creature_assigned' }));
        onTick = jest.fn();
        show();
    });
    afterEach(() => {
        panel.destroy();
        document.body.replaceChildren();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('keeps the chosen helper across automatic refresh until Invite', () => {
        choose('lumen');
        jest.advanceTimersByTime(3100);
        expect(picker().value).toBe('lumen');
        expect(onAssign).not.toHaveBeenCalled();
        invite().click();
        expect(onAssign).toHaveBeenCalledWith({ buildingId: 'building_one', creatureId: 'lumen' });
    });

    test('does not replace an open native picker while the settlement keeps ticking', () => {
        const original = picker();
        original.focus();
        jest.advanceTimersByTime(2100);
        expect(onTick).toHaveBeenCalledTimes(2);
        expect(picker()).toBe(original);
        expect(document.activeElement).toBe(original);
        original.blur();
        jest.advanceTimersByTime(1000);
        expect(picker()).not.toBe(original);
    });

    test('a late portrait update waits for the picker to close', () => {
        const original = picker();
        original.focus();
        choose('lumen');
        expect(panel.setCompanionPortrait({ imageUrl: '/synthetic-portrait.png' })).toBe(true);
        expect(picker()).toBe(original);
        original.blur();
        jest.advanceTimersByTime(1100);
        expect(picker()).not.toBe(original);
        expect(picker().value).toBe('lumen');
    });

    test('a removed draft selection asks for another helper, never silently substitutes one', () => {
        choose('lumen');
        snapshot.roster = snapshot.roster.filter(creature => creature.id !== 'lumen');
        jest.advanceTimersByTime(1100);
        expect(picker().value).toBe('');
        expect(picker().selectedOptions[0].textContent).toBe('Choose another helper');
        invite().click();
        expect(onAssign).not.toHaveBeenCalled();
        expect(panel.statusMessage).toBe('That creature record is not available.');
        choose('nova');
        invite().click();
        expect(onAssign).toHaveBeenCalledWith({ buildingId: 'building_one', creatureId: 'nova' });
    });

    test('validates against the latest roster even while redraws are deferred', () => {
        picker().focus();
        choose('lumen');
        snapshot.roster = snapshot.roster.filter(creature => creature.id !== 'lumen');
        jest.advanceTimersByTime(1100);
        expect(picker().value).toBe('lumen');
        invite().click();
        expect(onAssign).not.toHaveBeenCalled();
        expect(picker().value).toBe('');
    });

    test('does not assign to a building that disappeared during selection', () => {
        choose('lumen');
        snapshot.buildings = [];
        invite().click();
        expect(onAssign).not.toHaveBeenCalled();
        expect(panel.statusMessage).toBe('Finish construction before inviting a contribution.');
    });

    test('keeps the choice after a refused assignment but clears it after success', () => {
        choose('lumen');
        onAssign.mockReturnValueOnce({ changed: false, reason: 'unknown_creature' });
        invite().click();
        jest.advanceTimersByTime(1100);
        expect(picker().value).toBe('lumen');
        onAssign.mockImplementationOnce(() => {
            snapshot.buildings[0].assignedCreatureId = 'lumen';
            return { changed: true, reason: 'creature_assigned' };
        });
        invite().click();
        expect(picker().value).toBe('lumen');
        snapshot.buildings[0].assignedCreatureId = 'nova';
        jest.advanceTimersByTime(1000);
        expect(picker().value).toBe('nova');
    });

    test('closing discards unconfirmed choices and stops refreshes', () => {
        choose('lumen');
        panel.destroy();
        jest.advanceTimersByTime(3000);
        expect(onTick).not.toHaveBeenCalled();
        expect(onAssign).not.toHaveBeenCalled();
        show();
        expect(picker().value).toBe('nova');
    });

    if (mode === 'helpers') {
        test('keyboard tabs keep focus and the visible panel aligned after refresh', () => {
            const tab = () => panel.root.querySelector('[role="tab"][aria-selected="true"]');
            tab().focus();
            tab().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            expect(tab().dataset.view).toBe('community');
            expect(document.activeElement).toBe(tab());
            expect(panel.root.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe(tab().id);
            jest.advanceTimersByTime(1100);
            expect(document.activeElement).toBe(tab());
            tab().dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
            expect(tab().textContent).toBe('Build');
            expect(panel.root.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
        });

        test('optional information stays open across background updates and tab changes', () => {
            panel.root.querySelector('[data-view="plan"]').click();
            const details = panel.root.querySelector('.village-extra-details');
            const label = details.querySelector('summary').textContent;
            details.open = true;
            details.dispatchEvent(new Event('toggle'));
            jest.advanceTimersByTime(1100);
            panel.root.querySelector('[data-view="helpers"]').click();
            panel.root.querySelector('[data-view="plan"]').click();
            const restored = [...panel.root.querySelectorAll('details')]
                .find(element => element.querySelector('summary').textContent === label);
            expect(restored.open).toBe(true);
        });

        test('choosing a building does not place it until the clear Build action is used', () => {
            snapshot.definitions[0].placement = { available: true, revealed: true, alreadyBuilt: false,
                missingPrerequisites: [], missingResources: [] };
            snapshot.definitions[0].cost = { wood: 10 };
            snapshot.plots = [{ id: 'plot_one', label: 'Clearing', open: true }];
            snapshot.buildings = [];
            panel.onPlace = jest.fn(() => ({ changed: true, reason: 'building_started' }));
            panel.root.querySelector('[data-view="plan"]').click();
            panel.root.querySelector('.village-building-card').click();
            jest.advanceTimersByTime(1100);
            expect(panel.onPlace).not.toHaveBeenCalled();
            const build = panel.root.querySelector('.village-construct-action');
            expect(build.textContent).toBe('Build Forager hut');
            expect(build.disabled).toBe(false);
            build.click();
            expect(panel.onPlace).toHaveBeenCalledTimes(1);
            expect(panel.onPlace).toHaveBeenCalledWith({ definitionId: 'forager_hut', plotId: 'plot_one' });
        });
    }
});
