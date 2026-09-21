import { beginTrumptopusRun, checkpointTrumptopusRun, getTrumptopusRun, recordTrumptopusVictory } from './TrumptopusProgress.js';
import { getCampaignFinaleRecovery } from './CampaignJourneyGuide.js';
import { FinaleFilms } from './FinaleFilms.js';
import { TrumptopusResult } from '../ui/TrumptopusResult.js';

// Narrow final-encounter adapter. Legacy FinalVoidLevel does not instantiate it.
export class TrumptopusCompletion {
    constructor(scene, {
        gameState, films = new FinaleFilms(scene, {encounterId:'trumptopus'}),
        inventoryManager = null, newExpedition = false, createPanel = options => new TrumptopusResult(options)
    }) {
        this.scene = scene; this.gameState = gameState; this.films = films;
        this.inventoryManager = inventoryManager; this.createPanel = createPanel;
        this.closed = false; this.continued = false; this.panel = null;
        const started = beginTrumptopusRun(gameState, {newExpedition});
        this.run = started.run; this.persisted = started.persisted;
        this.onShutdown = () => this.dispose();
        scene.events.once('shutdown',this.onShutdown);
        scene.events.once('destroy',this.onShutdown);
        void films.prepare('victory').catch(() => false);
    }

    checkpoint() { return {schemaVersion:1,encounterId:'trumptopus',phaseIndex:this.run.phaseIndex}; }

    observe(encounter) {
        if (this.closed || this.run.status === 'won') return this.result || null;
        const state = encounter.snapshot();
        if (state.phaseIndex > this.run.phaseIndex) {
            checkpointTrumptopusRun(this.gameState,this.run.sequence,state.phaseIndex);
            this.run = getTrumptopusRun(this.gameState);
        }
        if (!state.completionReady) return null;
        // Persist at the winning hit, but let the scene finish its grounded
        // recovery before present() freezes physics for the result screen.
        this.scene.clearInput?.({ preserveFall: true });
        this.result = recordTrumptopusVictory(this.gameState, {
            sequence:this.run.sequence,
            completionMs:Math.max(0,Date.now() - (this.scene.levelStartTime || Date.now())),
            damageTaken:this.scene.damageTaken || this.scene.damageEvidence?.length || 0,
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
        this.closed = true; this.panel?.close(); this.films.dispose();
        this.scene.events.off('shutdown',this.onShutdown);
        this.scene.events.off('destroy',this.onShutdown);
    }
}
