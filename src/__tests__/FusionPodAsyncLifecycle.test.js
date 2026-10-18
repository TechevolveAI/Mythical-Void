const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

function loadScene(window, helper) {
    const source = fs.readFileSync(path.join(__dirname, '../scenes/FusionPodScene.js'), 'utf8');
    const body = parse(source, { sourceType: 'module' }).program.body;
    const executable = body.flatMap(node => {
        if (['ImportDeclaration', 'ExportDefaultDeclaration'].includes(node.type)) return [];
        const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
        return [source.slice(declaration.start, declaration.end)];
    }).join('\n');
    const context = { module: { exports: {} }, window, SceneTransitionHelper: helper,
        console: { log() {}, error() {}, warn() {} }, Date, Math };
    vm.runInNewContext(executable + '\nmodule.exports = FusionPodScene;', context);
    return new context.module.exports();
}

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const clone = value => JSON.parse(JSON.stringify(value));

function fixture({ twins = false } = {}) {
    const parents = [
        { id: 'fictional-parent-a', name: 'Fictional A', genes: { id: 'fictional-genes-a' }, lifecycle: { stage: 'adult' } },
        { id: 'fictional-parent-b', name: 'Fictional B', genes: { id: 'fictional-genes-b' }, lifecycle: { stage: 'adult' } }
    ];
    const request = { operationId: 'fusion_synthetic_original', requestFingerprint: 'synthetic-request' };
    const transaction = { operationId: request.operationId, parentIds: parents.map(parent => parent.id),
        authorityRequest: request, offspringCount: twins ? 2 : 1,
        offspringIds: twins ? ['fictional-child-a', 'fictional-child-b'] : ['fictional-child-a'] };
    const reservation = { operationId: transaction.operationId, reservationMode: 'server_reserved',
        offspringCount: transaction.offspringCount, offspringIds: transaction.offspringIds };
    const execution = { outcome: { operationId: transaction.operationId, isTwinBirth: twins,
        offspring: transaction.offspringIds.map(creatureId => ({ offspringGenes: { id: `genes_${creatureId}` },
            offspringData: { creatureId } })), birthEvents: [] }, receipt: { operationId: transaction.operationId } };
    let currentCampaign = true, staged = null;
    const delayed = [];
    const state = {
        getCreatureCollection: jest.fn(() => parents), getBreedingShrineStatus: () => ({ canBreed: true }),
        createPortableId: () => transaction.operationId,
        beginFusionTransaction: jest.fn(() => ({ success: true, transaction: clone(transaction) })),
        attachFusionAuthorityRequest: jest.fn(() => ({ success: true, transaction: clone(transaction) })),
        attachFusionAuthorityReservation: jest.fn((_id, value) => ({ success: true,
            transaction: { ...clone(transaction), authorityReservation: value } })),
        attachFusionAuthorityExecution: jest.fn((_id, value) => ({ success: true,
            transaction: { ...clone(transaction), authorityReservation: clone(reservation), authorityExecution: value } })),
        stageFusionResult: jest.fn((operationId, hatchData, receipt) => {
            staged = { operationId, hatchData, receipt }; return { success: true };
        }),
        getPendingFusionHatchData: () => staged?.hatchData || null,
        clearInterruptedFusion: jest.fn()
    };
    const window = { Phaser: { Scene: class {} }, GameState: state,
        CloudSave: { captureCampaignGuard: () => () => currentCampaign },
        FusionAuthority: {
            createRequest: () => request, deriveResultSeed: () => 'synthetic-result-seed',
            reserveOperation: jest.fn(async () => clone(reservation)),
            executeReservedOperation: jest.fn(async () => clone(execution)),
            enterDeterministicRandomScope: jest.fn(() => jest.fn())
        },
        BreedingEngine: { resolveCreatureGenes: parent => parent.genes,
            breedCreaturesWithLineage: () => ({ genes: { synthetic: true }, inheritance: {} }) },
        UXEnhancements: { showLoading: jest.fn(), hideLoading: jest.fn() },
        AudioManager: { stopMusic: jest.fn(), playFusionCreateEgg: jest.fn(), playError: jest.fn() }
    };
    const helper = { stopScene: jest.fn(), resumeScene: jest.fn(), pauseActiveScenes: jest.fn() };
    const scene = loadScene(window, helper);
    scene.parent1Data = parents[0]; scene.parent2Data = parents[1];
    scene.fusionOperationId = transaction.operationId;
    scene.fusionTransaction = clone(transaction);
    scene.fusionConsentReceipt = { operationId: transaction.operationId };
    scene.scale = { width: 390, height: 844 };
    scene.scene = { start: jest.fn(), get: () => null, isPaused: () => true };
    scene.time = { delayedCall: jest.fn((delay, callback) => {
        const event = { delay, callback, remove: jest.fn() }; delayed.push(event); return event;
    }), removeAllEvents: jest.fn() };
    scene.tweens = { killAll: jest.fn() };
    scene.setBreedButtonEnabled = jest.fn(); scene.drawBreedButtonBackground = jest.fn();
    scene.updateBreedButton = jest.fn(); scene.showRequirementNotMet = jest.fn(); scene.showBreedingError = jest.fn();
    scene.closeSelectionModal = jest.fn();
    return { scene, state, window, helper, delayed, parents, transaction, reservation, execution,
        replaceCampaign() { currentCampaign = false; }, getStaged: () => staged };
}

describe('Fusion Pod asynchronous scene lifetime', () => {
    test.each(['reservation', 'execution'])('%s reply after closing cannot attach to a cleared scene', async kind => {
        const f = fixture(), reply = deferred();
        if (kind === 'execution') f.scene.fusionTransaction.authorityReservation = clone(f.reservation);
        const authorityMethod = kind === 'reservation' ? 'reserveOperation' : 'executeReservedOperation';
        f.window.FusionAuthority[authorityMethod].mockReturnValue(reply.promise);
        const pending = kind === 'reservation' ? f.scene.reserveFusionAuthority() : f.scene.executeServerFusionOutcome();
        f.scene.closeScene();
        reply.resolve(kind === 'reservation' ? f.reservation : f.execution);
        await expect(pending).resolves.toMatchObject({ success: false, cancelled: true });
        expect(f.state.attachFusionAuthorityReservation).not.toHaveBeenCalled();
        expect(f.state.attachFusionAuthorityExecution).not.toHaveBeenCalled();
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.scene.scene.start).not.toHaveBeenCalled();
    });

    test.each(['reservation', 'execution'])('%s reply cannot attach to a replacement operation', async kind => {
        const f = fixture(), reply = deferred();
        if (kind === 'execution') f.scene.fusionTransaction.authorityReservation = clone(f.reservation);
        f.window.FusionAuthority[kind === 'reservation' ? 'reserveOperation' : 'executeReservedOperation'].mockReturnValue(reply.promise);
        const pending = kind === 'reservation' ? f.scene.reserveFusionAuthority() : f.scene.executeServerFusionOutcome();
        f.scene.fusionTransaction = { operationId: 'fusion_synthetic_replacement' };
        f.scene.fusionOperationId = 'fusion_synthetic_replacement';
        reply.resolve(kind === 'reservation' ? f.reservation : f.execution);
        await expect(pending).resolves.toMatchObject({ success: false, cancelled: true });
        expect(f.state.attachFusionAuthorityReservation).not.toHaveBeenCalled();
        expect(f.state.attachFusionAuthorityExecution).not.toHaveBeenCalled();
        expect(f.scene.fusionOperationId).toBe('fusion_synthetic_replacement');
    });

    test('reserved-result recovery cannot reopen a hatch scene after the Pod closes', async () => {
        const f = fixture(), reply = deferred();
        f.scene.executeServerFusionOutcome = jest.fn(() => reply.promise);
        const pending = f.scene.resumeReservedFusion(f.transaction, 390, 844);
        f.scene.closeScene();
        reply.resolve({ success: true, execution: f.execution, transaction: f.transaction });
        await pending;
        expect(f.scene.scene.start).not.toHaveBeenCalled();
        expect(f.state.stageFusionResult).not.toHaveBeenCalled();
        expect(f.scene.showRequirementNotMet).not.toHaveBeenCalled();
    });

    test('a New Game guard prevents an old execution from attaching even if the view still exists', async () => {
        const f = fixture(), reply = deferred();
        f.scene.fusionTransaction.authorityReservation = clone(f.reservation);
        f.window.FusionAuthority.executeReservedOperation.mockReturnValue(reply.promise);
        const pending = f.scene.executeServerFusionOutcome();
        f.replaceCampaign(); reply.resolve(f.execution);
        await expect(pending).resolves.toMatchObject({ success: false, cancelled: true });
        expect(f.state.attachFusionAuthorityExecution).not.toHaveBeenCalled();
    });

    test.each(['reservation', 'execution'])('%s rejection after closing is a harmless cancellation', async kind => {
        const f = fixture(), reply = deferred();
        if (kind === 'execution') f.scene.fusionTransaction.authorityReservation = clone(f.reservation);
        f.window.FusionAuthority[kind === 'reservation' ? 'reserveOperation' : 'executeReservedOperation'].mockReturnValue(reply.promise);
        const pending = kind === 'reservation' ? f.scene.reserveFusionAuthority() : f.scene.executeServerFusionOutcome();
        f.scene.closeScene(); reply.reject(Error('synthetic late connection failure'));
        await expect(pending).resolves.toMatchObject({ success: false, cancelled: true });
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.scene.showBreedingError).not.toHaveBeenCalled();
    });

    test.each(['reservation', 'execution'])('%s cannot act after re-init even when the operation ID is reused', async kind => {
        const f = fixture(), reply = deferred();
        if (kind === 'execution') f.scene.fusionTransaction.authorityReservation = clone(f.reservation);
        f.window.FusionAuthority[kind === 'reservation' ? 'reserveOperation' : 'executeReservedOperation'].mockReturnValue(reply.promise);
        const pending = kind === 'reservation' ? f.scene.reserveFusionAuthority() : f.scene.executeServerFusionOutcome();
        f.scene.init();
        f.scene.parent1Data = f.parents[0]; f.scene.parent2Data = f.parents[1];
        f.scene.fusionTransaction = clone(f.transaction); f.scene.fusionOperationId = f.transaction.operationId;
        reply.resolve(kind === 'reservation' ? f.reservation : f.execution);
        await expect(pending).resolves.toMatchObject({ success: false, cancelled: true });
        expect(f.state.attachFusionAuthorityReservation).not.toHaveBeenCalled();
        expect(f.state.attachFusionAuthorityExecution).not.toHaveBeenCalled();
        expect(f.scene.fusionTransaction).toEqual(f.transaction);
    });

    test.each(['reservation', 'execution'])('%s still attaches its valid reply to the original operation', async kind => {
        const f = fixture();
        if (kind === 'execution') f.scene.fusionTransaction.authorityReservation = clone(f.reservation);
        const result = kind === 'reservation' ? await f.scene.reserveFusionAuthority() : await f.scene.executeServerFusionOutcome();
        expect(result.success).toBe(true);
        expect(f.state[kind === 'reservation' ? 'attachFusionAuthorityReservation' : 'attachFusionAuthorityExecution'])
            .toHaveBeenCalledWith(f.transaction.operationId, kind === 'reservation' ? f.reservation : f.execution);
        expect(f.scene.parent1Data).toBe(f.parents[0]); expect(f.scene.parent2Data).toBe(f.parents[1]);
    });

    test.each([false, true])('the live server-result path stages and queues exactly one hatch (twins: %s)', async twins => {
        const f = fixture({ twins }), parentsBefore = clone(f.parents);
        f.scene.fusionTransaction = null;
        f.scene.attemptBreeding();
        await f.delayed[0].callback();
        expect(f.state.stageFusionResult).toHaveBeenCalledTimes(1);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        const data = f.scene.scene.start.mock.calls[0][1];
        expect(f.scene.scene.start.mock.calls[0][0]).toBe('BreedingHatchScene');
        expect(data.serverGenerated).toBe(true);
        expect(twins ? [data.twin1.offspringData.creatureId, data.twin2.offspringData.creatureId]
            : [data.offspringData.creatureId]).toEqual(f.transaction.offspringIds);
        expect(f.scene.cleanupComplete).toBe(false);
        expect(f.scene.breedingInProgress).toBe(true);
        expect(f.window.AudioManager.stopMusic).not.toHaveBeenCalled();
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.parents).toEqual(parentsBefore);
    });

    test.each([false, true])('the existing local-result path keeps its reserved IDs and lineage (twins: %s)', async twins => {
        const f = fixture({ twins });
        f.window.FusionAuthority.reserveOperation.mockResolvedValue({ ...f.reservation, reservationMode: 'local_only' });
        let counter = 0;
        f.scene.createOffspringData = jest.fn(() => ({ offspringGenes: { id: `fictional-new-genes-${++counter}` },
            offspringData: { parentIds: f.parents.map(parent => parent.id) } }));
        f.scene.fusionTransaction = null;
        f.scene.attemptBreeding(); await f.delayed[0].callback();
        expect(f.window.FusionAuthority.executeReservedOperation).not.toHaveBeenCalled();
        expect(f.scene.createOffspringData).toHaveBeenCalledTimes(twins ? 2 : 1);
        expect(f.state.stageFusionResult).toHaveBeenCalledTimes(1);
        const data = f.scene.scene.start.mock.calls[0][1];
        const children = twins ? [data.twin1, data.twin2] : [{ offspringData: data.offspringData }];
        expect(children.map(child => child.offspringData.creatureId)).toEqual(f.transaction.offspringIds);
        children.forEach(child => expect(child.offspringData.parentIds).toEqual(f.parents.map(parent => parent.id)));
        expect(f.scene.cleanupComplete).toBe(false);
    });

    test('closing before the dramatic delay cancels work and ignores a dispatched timer', async () => {
        const f = fixture();
        f.scene.fusionTransaction = null;
        f.scene.attemptBreeding();
        const timer = f.delayed[0], owner = f.window.UXEnhancements.showLoading.mock.calls[0][1];
        f.scene.closeScene(); await timer.callback();
        expect(timer.remove).toHaveBeenCalledWith(false);
        expect(f.window.UXEnhancements.hideLoading).toHaveBeenCalledWith(owner);
        expect(f.state.beginFusionTransaction).not.toHaveBeenCalled();
        expect(f.window.FusionAuthority.reserveOperation).not.toHaveBeenCalled();
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.scene.showBreedingError).not.toHaveBeenCalled();
        expect(f.scene.scene.start).not.toHaveBeenCalled();
    });

    test.each(['reservation', 'execution'])('closing while awaiting %s cannot revive or clear a result', async boundary => {
        const f = fixture(), reply = deferred(), started = deferred();
        const method = boundary === 'reservation' ? 'reserveOperation' : 'executeReservedOperation';
        f.window.FusionAuthority[method].mockImplementation(() => { started.resolve(); return reply.promise; });
        f.scene.fusionTransaction = null;
        f.scene.attemptBreeding(); const pending = f.delayed[0].callback();
        await started.promise;
        f.scene.closeScene();
        reply.resolve(boundary === 'reservation' ? f.reservation : f.execution);
        await pending;
        expect(f.state.stageFusionResult).not.toHaveBeenCalled();
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.scene.showBreedingError).not.toHaveBeenCalled();
        expect(f.scene.updateBreedButton).not.toHaveBeenCalled();
        expect(f.scene.scene.start).not.toHaveBeenCalled();
    });

    test('a failed scene start preserves a staged local result and allows reopening the exact child', async () => {
        const f = fixture();
        f.window.FusionAuthority.reserveOperation.mockResolvedValue({ ...f.reservation, reservationMode: 'local_only' });
        f.scene.createOffspringData = () => ({ offspringGenes: { id: 'fictional-reserved-genes' }, offspringData: {} });
        f.scene.scene.start.mockImplementationOnce(() => { throw Error('synthetic scene start failure'); });
        f.scene.fusionTransaction = null;
        f.scene.attemptBreeding(); await f.delayed[0].callback();
        const retained = f.getStaged().hatchData;
        expect(retained.offspringData.creatureId).toBe(f.transaction.offspringIds[0]);
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.scene.cleanupComplete).toBe(false);
        expect(f.scene.breedingInProgress).toBe(false);
        expect(f.scene.showBreedingError).toHaveBeenCalledWith('The hatch could not open. Return to the Pod to retry.');
        f.scene.closeScene(); f.scene.init();
        f.scene.create();
        expect(f.scene.scene.start).toHaveBeenLastCalledWith('BreedingHatchScene', retained);
        expect(f.state.stageFusionResult).toHaveBeenCalledTimes(1);
    });

    test('reserved recovery starts once, retains both parents and uses Phaser-owned shutdown', async () => {
        const f = fixture();
        f.scene.fusionTransaction.authorityReservation = clone(f.reservation);
        await f.scene.resumeReservedFusion(f.scene.fusionTransaction, 390, 844);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        expect(f.state.stageFusionResult).toHaveBeenCalledTimes(1);
        expect(f.scene.parent1Data).toBe(f.parents[0]); expect(f.scene.parent2Data).toBe(f.parents[1]);
        expect(f.scene.cleanupComplete).toBe(false);
    });

    test('duplicate recovery requests cannot launch two hatch scenes', async () => {
        const f = fixture(), reply = deferred();
        f.scene.executeServerFusionOutcome = jest.fn(() => reply.promise);
        const first = f.scene.resumeReservedFusion(f.transaction, 390, 844);
        const second = f.scene.resumeReservedFusion(f.transaction, 390, 844);
        reply.resolve({ success: true, execution: f.execution, transaction: f.transaction });
        await Promise.all([first, second]);
        expect(f.scene.executeServerFusionOutcome).toHaveBeenCalledTimes(1);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('a duplicated timer callback cannot repeat a Fusion or dismiss its current loading display', async () => {
        const f = fixture(), reply = deferred(), started = deferred();
        f.window.FusionAuthority.reserveOperation.mockImplementation(() => { started.resolve(); return reply.promise; });
        f.scene.fusionTransaction = null; f.scene.attemptBreeding();
        const pending = f.delayed[0].callback(); await started.promise;
        await f.delayed[0].callback();
        expect(f.window.UXEnhancements.hideLoading).not.toHaveBeenCalled();
        expect(f.state.beginFusionTransaction).toHaveBeenCalledTimes(1);
        reply.resolve(f.reservation); await pending;
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('a second close cannot resume or stop a replacement scene', () => {
        const f = fixture();
        f.scene.closeScene(); f.scene.closeScene();
        expect(f.helper.resumeScene).toHaveBeenCalledTimes(1);
        expect(f.helper.stopScene).toHaveBeenCalledTimes(1);
        expect(f.window.AudioManager.stopMusic).toHaveBeenCalledTimes(1);
    });

    test.each(['reservation', 'execution'])('late %s failure cannot show an error or clear a replacement game', async boundary => {
        const f = fixture(), reply = deferred(), started = deferred();
        f.window.FusionAuthority[boundary === 'reservation' ? 'reserveOperation' : 'executeReservedOperation']
            .mockImplementation(() => { started.resolve(); return reply.promise; });
        f.scene.fusionTransaction = null; f.scene.attemptBreeding();
        const pending = f.delayed[0].callback(); await started.promise;
        f.scene.closeScene(); reply.reject(Error('synthetic late failure'));
        await pending;
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.scene.showBreedingError).not.toHaveBeenCalled();
        expect(f.scene.updateBreedButton).not.toHaveBeenCalled();
        expect(f.scene.scene.start).not.toHaveBeenCalled();
    });

    test('an old top-level attempt cannot reset a reopened Pod even with identical operation and parents', async () => {
        const f = fixture(), reply = deferred(), started = deferred();
        f.window.FusionAuthority.executeReservedOperation.mockImplementation(() => { started.resolve(); return reply.promise; });
        f.scene.fusionTransaction = null; f.scene.attemptBreeding();
        const pending = f.delayed[0].callback(); await started.promise;
        f.scene.init();
        f.scene.parent1Data = f.parents[0]; f.scene.parent2Data = f.parents[1];
        f.scene.fusionOperationId = f.transaction.operationId;
        f.scene.fusionTransaction = { ...clone(f.transaction), replacementMarker: true };
        f.scene.breedingInProgress = true;
        reply.resolve(f.execution); await pending;
        expect(f.scene.fusionTransaction.replacementMarker).toBe(true);
        expect(f.scene.breedingInProgress).toBe(true);
        expect(f.state.attachFusionAuthorityExecution).not.toHaveBeenCalled();
        expect(f.state.stageFusionResult).not.toHaveBeenCalled();
        expect(f.scene.updateBreedButton).not.toHaveBeenCalled();
    });

    test('a changed campaign stops the whole attempt before staging or presentation', async () => {
        const f = fixture(), reply = deferred(), started = deferred();
        f.window.FusionAuthority.executeReservedOperation.mockImplementation(() => { started.resolve(); return reply.promise; });
        f.scene.fusionTransaction = null; f.scene.attemptBreeding();
        const pending = f.delayed[0].callback(); await started.promise;
        f.replaceCampaign(); reply.resolve(f.execution); await pending;
        expect(f.state.attachFusionAuthorityExecution).not.toHaveBeenCalled();
        expect(f.state.stageFusionResult).not.toHaveBeenCalled();
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.scene.scene.start).not.toHaveBeenCalled();
        expect(f.scene.showBreedingError).not.toHaveBeenCalled();
    });

    test.each(['GameState', 'CloudSave'])('replacing %s rejects a reply from the earlier save owner', async owner => {
        const f = fixture(), reply = deferred();
        f.scene.fusionTransaction.authorityReservation = clone(f.reservation);
        f.window.FusionAuthority.executeReservedOperation.mockReturnValue(reply.promise);
        const pending = f.scene.executeServerFusionOutcome();
        f.window[owner] = { ...f.window[owner] };
        reply.resolve(f.execution);
        await expect(pending).resolves.toMatchObject({ success: false, cancelled: true });
        expect(f.state.attachFusionAuthorityExecution).not.toHaveBeenCalled();
        expect(f.state.stageFusionResult).not.toHaveBeenCalled();
    });

    test('old operation cleanup cannot hide a newer scene\'s actual DOM loading display', async () => {
        document.body.innerHTML = '';
        const f = fixture(), reply = deferred(), started = deferred();
        const uxSource = fs.readFileSync(path.join(__dirname, '../systems/UXEnhancements.js'), 'utf8');
        const ux = new Function('window', `${uxSource}\nreturn window.UXEnhancements;`)(f.window);
        f.window.FusionAuthority.executeReservedOperation.mockImplementation(() => { started.resolve(); return reply.promise; });
        try {
            f.scene.fusionTransaction = null; f.scene.attemptBreeding();
            const pending = f.delayed[0].callback(); await started.promise;
            f.scene.closeScene();
            ux.showLoading('Another fictional scene...', {});
            reply.resolve(f.execution); await pending;
            const overlay = document.getElementById('loading-overlay');
            expect(overlay.classList.contains('hidden')).toBe(false);
            expect(overlay.querySelector('.loading-text').textContent).toBe('Another fictional scene...');
        } finally { ux.destroy(); }
    });

    test('a failed recovery reply is shown only while its own Pod remains open', async () => {
        const f = fixture();
        f.scene.executeServerFusionOutcome = async () => { throw Error('synthetic recovery failure'); };
        await expect(f.scene.resumeReservedFusion(f.transaction, 390, 844)).resolves.toBeUndefined();
        expect(f.scene.showRequirementNotMet).toHaveBeenCalledWith(390, 844, 'reserved_recovery',
            'The reserved lineage could not open. Return to the Pod to retry.');
        expect(f.state.clearInterruptedFusion).not.toHaveBeenCalled();
        expect(f.scene.breedingInProgress).toBe(false);
    });

    test('the installed Phaser queues old-scene stop before starting the hatch', () => {
        const source = fs.readFileSync(require.resolve('phaser/src/scene/ScenePlugin.js'), 'utf8');
        const tree = parse(source, { sourceType: 'script' });
        let start;
        const walk = node => {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'ObjectProperty' && node.key?.name === 'start' && node.value?.type === 'FunctionExpression') start = node.value;
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(walk);
                else if (value && typeof value === 'object') walk(value);
            }
        };
        walk(tree);
        const actualStart = vm.runInNewContext(`(${source.slice(start.start, start.end)})`);
        const plugin = { key: 'FusionPodScene', manager: { queueOp: jest.fn() } };
        const data = { fictionalChild: true };
        actualStart.call(plugin, 'BreedingHatchScene', data);
        expect(plugin.manager.queueOp.mock.calls).toEqual([
            ['stop', 'FusionPodScene'], ['start', 'BreedingHatchScene', data]
        ]);
    });
});
