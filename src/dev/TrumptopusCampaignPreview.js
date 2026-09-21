import TrumptopusFinalePreview from './TrumptopusFinalePreview.js';
import { TrumptopusCompletion } from '../systems/TrumptopusCompletion.js';

// Private campaign integration: real fight/reward/ending, temporary limb art.
// Registered only by the local harness, never the production SceneLoader.
export default class TrumptopusCampaignPreview extends TrumptopusFinalePreview {
    createEncounter(data) {
        this.completion = new TrumptopusCompletion(this, {
            gameState:window.GameState, inventoryManager:window.InventoryManager,
            newExpedition:data.newExpedition === true, ...(data.films ? {films:data.films} : {})
        });
        return super.createEncounter({...data,checkpoint:this.completion.checkpoint(),completed:this.completion.run.status === 'won'});
    }

    setPrototypePaused(paused) {
        if (paused) this.completion.saveProgress();
        super.setPrototypePaused(paused);
    }

    resolveBossHit(amount, options) {
        const applied = super.resolveBossHit(amount,options);
        // The real collision/input callback owns the durable winning hit.
        // A refresh before the next rendered frame must not replay victory.
        if (applied) this.completion.observe(this.encounter);
        return applied;
    }

    update(time, delta) {
        if (!this.encounter.paused && !this.encounter.disposed) this.completion.advance(delta);
        super.update(time,delta);
        if (this.encounter.paused || this.encounter.disposed) return;
        this.completion.observe(this.encounter);
        if (this.encounter.state === 'aftermath' && this.isGrounded && !this.completion.panel) {
            this.completion.present();
        }
    }
}
