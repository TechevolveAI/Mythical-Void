import { beginTrumptopusRun, checkpointTrumptopusRun, checkpointTrumptopusApproach, getTrumptopusRun, recordTrumptopusVictory } from './TrumptopusProgress.js';
import { getCampaignFinaleRecovery } from './CampaignJourneyGuide.js';
import { FinaleFilms } from './FinaleFilms.js';
import { TrumptopusResult } from '../ui/TrumptopusResult.js';

// Narrow final-encounter adapter. Legacy FinalVoidLevel does not instantiate it.
export class TrumptopusCompletion {
    constructor(scene, {
        gameState, films = new FinaleFilms(scene, {encounterId:'trumptopus'}),
        inventoryManager = null, newExpedition = false, withApproach = false, createPanel = options => new TrumptopusResult(options)
    }) {
        this.scene = scene; this.gameState = gameState; this.films = films;
        this.inventoryManager = inventoryManager; this.createPanel = createPanel;
        this.closed = false; this.continued = false; this.panel = null;
        const started = beginTrumptopusRun(gameState, {newExpedition,withApproach});
        this.run = started.run; this.persisted = started.persisted;
        this.elapsedMs = this.run.elapsedMs || 0;
        this.priorDamage = this.run.damageTaken || 0;
        this.onShutdown = () => this.dispose();
        this.onPageHide = () => this.saveProgress();
        globalThis.addEventListener?.('pagehide',this.onPageHide);
        scene.events.once('shutdown',this.onShutdown);
        scene.events.once('destroy',this.onShutdown);
        void films.prepare('victory').catch(() => false);
    }

    checkpoint() { return {schemaVersion:1,encounterId:'trumptopus',phaseIndex:this.run.phaseIndex}; }

    advance(delta) {
        if (!this.closed && this.run.status === 'fighting' && Number.isFinite(delta) && delta > 0) {
            this.elapsedMs += Math.min(delta,250);
        }
    }

    progress() {
        return {elapsedMs:Math.round(this.elapsedMs),damageTaken:this.priorDamage +
            (this.scene.damageTaken || this.scene.damageEvidence?.length || 0)};
    }

    saveProgress(phaseIndex = this.run.phaseIndex) {
        if (this.closed || this.run.status === 'won') return false;
        const changed = checkpointTrumptopusRun(this.gameState,this.run.sequence,phaseIndex,this.progress());
        this.run = getTrumptopusRun(this.gameState);
        return changed;
    }

    saveApproach(checkpoint) {
        if (this.closed || this.run.status === 'won') return false;
        const changed = checkpointTrumptopusApproach(this.gameState,this.run.sequence,checkpoint,this.progress());
        this.run = getTrumptopusRun(this.gameState);
        return changed;
    }

    observe(encounter) {
        if (this.closed || this.run.status === 'won') return this.result || null;
        const state = encounter.snapshot();
        if (state.phaseIndex > this.run.phaseIndex) {
            this.saveProgress(state.phaseIndex);
        }
        if (!state.completionReady) return null;
        // Persist at the winning hit, but let the scene finish its grounded
        // recovery before present() freezes physics for the result screen.
        this.scene.clearInput?.({ preserveFall: true });
        this.result = recordTrumptopusVictory(this.gameState, {
            sequence:this.run.sequence,
            completionMs:this.progress().elapsedMs,
            damageTaken:this.progress().damageTaken,
            bonusCoins:(this.scene.rescuedResidentSupport?.victoryCoinBonus || 0) + (this.scene.villageSupport?.victoryCoinBonus || 0),
            inventorySlots:this.inventoryManager?.maxSlots ?? 30
        });
        this.run = getTrumptopusRun(this.gameState);
        this.persisted = this.result.persisted;
        if (this.inventoryManager) this.inventoryManager.inventory = this.gameState.get('inventory.items');
        return this.result;
    }

    present() {
        if (this.closed || this.panel || this.run.status !== 'won') return false;
        this.scene.clearInput?.(); this.scene.enterLevelCompletionState?.();
        const recovery = getCampaignFinaleRecovery(this.gameState);
        const primaryLabel = recovery?.status === 'repair' ? 'Repair the ship'
            : recovery?.status === 'ending' ? 'Finish the story' : 'Return to Sanctuary';
        this.panel = this.createPanel({
            receipt:this.run.receipt, persisted:this.persisted,
            primaryLabel, films:this.films, onContinue:() => this.continue()
        });
        return true;
    }

    continue() {
        if (this.closed || this.continued || this.run.status !== 'won') return false;
        this.continued = true;
        try {
            const recovery = getCampaignFinaleRecovery(this.gameState);
            // Existing GameScene owns installation and the durable VictoryScene handoff.
            this.scene.scene.start('GameScene', {biome:'nebula',continueFinaleAfterRepair:Boolean(recovery)});
            return true;
        } catch (error) { this.continued = false; throw error; }
    }

    dispose() {
        if (this.closed) return;
        this.saveProgress();
        this.closed = true; this.panel?.close(); this.films.dispose();
        globalThis.removeEventListener?.('pagehide',this.onPageHide);
        this.scene.events.off('shutdown',this.onShutdown);
        this.scene.events.off('destroy',this.onShutdown);
    }
}
