import { beginTrumptopusRun, checkpointTrumptopusRun, checkpointTrumptopusApproach, recordTrumptopusVictory } from './TrumptopusProgress.js';
import { getCampaignFinaleRecovery } from './CampaignJourneyGuide.js';
import { FinaleFilms } from './FinaleFilms.js';
import { TrumptopusResult } from '../ui/TrumptopusResult.js';
const sceneOwners = new WeakMap();

// Narrow final-encounter adapter. Legacy FinalVoidLevel does not instantiate it.
export class TrumptopusCompletion {
    constructor(scene, {
        gameState, films = new FinaleFilms(scene, {encounterId:'trumptopus'}),
        inventoryManager = null, newExpedition = false, withApproach = false, createPanel = options => new TrumptopusResult(options)
    }) {
        this.scene = scene; this.gameState = gameState; this.films = films;
        this.inventoryManager = inventoryManager; this.createPanel = createPanel;
        this.closed = false; this.continued = false; this.panel = null;
        const previous = sceneOwners.get(scene);
        this.events = scene.events;
        this.context = { root: gameState.state, admission: gameState.saveAdmission, key: gameState.saveKey, mode: gameState.storageMode,
            game: window.GameState, cloud: window.CloudSave, user: window.CloudSave?.currentUser?.id,
            identity: gameState.getHatchActiveIdentity?.() };
        this.run = null; this.elapsedMs = 0; this.priorDamage = 0;
        this.onShutdown = () => this.dispose();
        this.onPageHide = () => this.saveProgress();
        sceneOwners.set(scene, this);
        globalThis.addEventListener?.('pagehide',this.onPageHide);
        scene.events.once('shutdown',this.onShutdown);
        scene.events.once('destroy',this.onShutdown);
        previous?.retire();
        if (!this.current()) { this.retire(); return; }
        const started = this.execute(operation => beginTrumptopusRun(gameState, {newExpedition,withApproach,operation}));
        if (!started) return;
        this.elapsedMs = this.run.elapsedMs || 0;
        this.priorDamage = this.run.damageTaken || 0;
        if (!withApproach && this.current()) void films.prepare('victory').catch(() => false);
    }

    runtimeCurrent() { return !this.closed && sceneOwners.get(this.scene) === this && this.scene.events === this.events; }

    current() {
        const s = this.gameState, c = this.context;
        return this.runtimeCurrent() && s.state === c.root && s.saveAdmission === c.admission && s.saveKey === c.key &&
            s.storageMode === c.mode && window.GameState === c.game && window.CloudSave === c.cloud &&
            c.cloud?.currentUser?.id === c.user && s.getHatchActiveIdentity?.() === c.identity;
    }

    beginOperation() {
        if (!this.current()) { this.retire(); return null; }
        try { return this.gameState.createPreparedSaveOperation(() => this.runtimeCurrent()); }
        catch (error) {
            if (error?.code === 'save_context_changed' || !this.current()) { this.retire(); return null; }
            throw error;
        }
    }

    execute(action, operation = this.beginOperation()) {
        if (!operation) return null;
        try {
            if (!operation.isCurrent()) { this.retire(); return null; }
            const result = action(operation);
            if (!this.runtimeCurrent() || result?.validity !== operation || !operation.isCurrent() || !result.run) { this.retire(); return null; }
            const transition = operation.getTransition();
            if (result.changed && !transition) { this.retire(); return null; }
            if (transition) {
                this.context.root = transition.state;
                this.context.admission = transition.admission;
            }
            if (!this.current()) { this.retire(); return null; }
            this.run = result.run;
            if (Object.hasOwn(result, 'persisted')) this.persisted = result.persisted;
            return result;
        } catch (error) {
            if (error?.code === 'save_context_changed' || !operation.isCurrent()) { this.retire(); return null; }
            throw error;
        }
    }

    checkpoint() {
        if (!this.current() || !this.run) { this.retire(); return null; }
        return {schemaVersion:1,encounterId:'trumptopus',phaseIndex:this.run.phaseIndex};
    }

    advance(delta) {
        if (!this.current()) { this.retire(); return; }
        if (this.run?.status === 'fighting' && Number.isFinite(delta) && delta > 0) {
            this.elapsedMs += Math.min(delta,250);
        }
    }

    progress() {
        return {elapsedMs:Math.round(this.elapsedMs),damageTaken:this.priorDamage +
            (this.scene.damageTaken || this.scene.damageEvidence?.length || 0)};
    }

    saveProgress(phaseIndex = this.run?.phaseIndex) {
        if (!this.current()) { this.retire(); return false; }
        if (this.run?.status === 'won') return false;
        return this.execute(operation => checkpointTrumptopusRun(this.gameState,this.run.sequence,phaseIndex,this.progress(),operation))?.changed === true;
    }

    saveApproach(checkpoint) {
        if (!this.current()) { this.retire(); return false; }
        if (this.run?.status === 'won') return false;
        return this.execute(operation => checkpointTrumptopusApproach(this.gameState,this.run.sequence,checkpoint,this.progress(),operation))?.changed === true;
    }

    observe(encounter) {
        const operation = this.beginOperation();
        if (!operation) return null;
        if (this.run?.status === 'won') return this.result || null;
        const state = encounter.snapshot();
        if (!operation.isCurrent()) { this.retire(); return null; }
        if (state.phaseIndex > this.run.phaseIndex) {
            this.saveProgress(state.phaseIndex);
            if (!this.current()) return null;
            return this.observe(encounter);
        }
        if (!state.completionReady) return null;
        // Persist at the winning hit, but let the scene finish its grounded
        // recovery before present() freezes physics for the result screen.
        this.scene.clearInput?.({ preserveFall: true });
        const result = this.execute(current => recordTrumptopusVictory(this.gameState, {
            sequence:this.run.sequence,
            completionMs:this.progress().elapsedMs,
            damageTaken:this.progress().damageTaken,
            bonusCoins:(this.scene.rescuedResidentSupport?.victoryCoinBonus || 0) + (this.scene.villageSupport?.victoryCoinBonus || 0),
            inventorySlots:this.inventoryManager?.maxSlots ?? 30, operation: current
        }), operation);
        if (!result || !this.current()) return null;
        this.result = result;
        if (this.inventoryManager) {
            const items = this.gameState.get('inventory.items');
            if (!operation.isCurrent()) { this.retire(); return null; }
            this.inventoryManager.inventory = items;
            if (!operation.isCurrent()) { this.retire(); return null; }
        }
        return result;
    }

    present() {
        const operation = this.beginOperation();
        if (!operation || this.panel || this.run?.status !== 'won') return false;
        this.scene.clearInput?.();
        if (!operation.isCurrent()) { this.retire(); return false; }
        this.scene.enterLevelCompletionState?.();
        if (!operation.isCurrent()) { this.retire(); return false; }
        const recovery = getCampaignFinaleRecovery(this.gameState);
        if (!operation.isCurrent()) { this.retire(); return false; }
        const primaryLabel = recovery?.status === 'repair' ? 'Repair the ship'
            : recovery?.status === 'ending' ? 'Finish the story' : 'Return to Sanctuary';
        const panel = this.createPanel({
            receipt:this.run.receipt, persisted:this.persisted,
            primaryLabel, films:this.films, onContinue:() => this.continue()
        });
        if (!operation.isCurrent()) { panel?.close(); this.retire(); return false; }
        this.panel = panel;
        return true;
    }

    continue() {
        const operation = this.beginOperation();
        if (!operation || this.continued || this.run?.status !== 'won') return false;
        this.continued = true;
        try {
            const recovery = getCampaignFinaleRecovery(this.gameState);
            if (!operation.isCurrent()) { this.retire(); return false; }
            // Existing GameScene owns installation and the durable VictoryScene handoff.
            this.scene.scene.start('GameScene', {biome:'nebula',continueFinaleAfterRepair:Boolean(recovery)});
            if (!operation.isCurrent()) { this.retire(); return false; }
            return true;
        } catch (error) {
            if (!operation.isCurrent()) { this.retire(); return false; }
            this.continued = false; throw error;
        }
    }

    dispose() {
        if (this.closed) return;
        try { if (this.current()) this.saveProgress(); } finally { this.retire(); }
    }

    retire() {
        if (this.closed) return;
        this.closed = true;
        for (const action of [() => this.panel?.close(), () => this.films.dispose()]) {
            try { action(); } catch { /* Retiring one owned view cannot prevent the remaining cleanup. */ }
        }
        globalThis.removeEventListener?.('pagehide',this.onPageHide);
        this.scene.events.off('shutdown',this.onShutdown);
        this.scene.events.off('destroy',this.onShutdown);
    }
}
