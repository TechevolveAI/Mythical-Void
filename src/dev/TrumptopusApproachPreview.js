import TrumptopusPrototypeLevel from './TrumptopusPrototypeLevel.js';
import { FinalVoidApproach, FINAL_VOID_APPROACH } from '../systems/FinalVoidApproach.js';
import { TrumptopusCompletion } from '../systems/TrumptopusCompletion.js';

// Private greybox route. Final art/films and production registration stay gated.
export default class TrumptopusApproachPreview extends TrumptopusPrototypeLevel {
    constructor() { super('TrumptopusApproach'); }

    configurePrototypeWorld() {
        this.levelWidth = FINAL_VOID_APPROACH.width;
        this.floorY = Math.round(this.scale.height * 0.53);
        this.levelHeight = this.floorY + 50;
        this.spawnX = 220;
        this.bridges = [];
        this.transitioning = false;
        this.cameraLockedForGrip = false;
    }

    createEncounter(data) {
        this.completion = new TrumptopusCompletion(this,{gameState:window.GameState,
            inventoryManager:window.InventoryManager,withApproach:true,newExpedition:data.newExpedition === true});
        this.encounter = new FinalVoidApproach(this.completion.run.approach || {schemaVersion:1,clearedGrips:2,arrived:true});
        this.spawnX = this.encounter.spawnX;
        this.lastSavedGrip = this.encounter.clearedGrips;
        return this.encounter;
    }

    createPrototypeTerrain() {
        this.createPlatform(0,this.floorY + FINAL_VOID_APPROACH.catchDepth,this.levelWidth,60,'solid');
        for (const surface of [...FINAL_VOID_APPROACH.surfaces,...FINAL_VOID_APPROACH.recoverySteps]) {
            this.createPlatform(surface.x,this.floorY + surface.dy,surface.width,32,'solid');
        }
        this.bridges = FINAL_VOID_APPROACH.grips.map(section=>this.createPlatform(
            section.gateX,this.floorY + FINAL_VOID_APPROACH.catchDepth,section.bridgeWidth,32,'solid'));
    }

    create() {
        super.create();
        this.bossName.setText('THE FINAL VOID'); this.bossBar.setVisible(false);
        this.cameras.main.setBounds(0,0,this.levelWidth,this.scale.height);
        this.cameras.main.startFollow(this.player,true,0.12,0.12, -35, 0);
        this.cameras.main.setDeadzone(24,this.scale.height);
        // Catch ledges remain in view beneath the main road, not a lethal void.
        this.drawExchange();
        if (this.completion.run.status === 'won' || this.completion.run.phaseIndex > 0 || this.encounter.arrived) {
            this.time.delayedCall(0,()=>this.enterArena());
        }
    }

    setPrototypePaused(paused) {
        if (paused) this.completion.saveProgress();
        super.setPrototypePaused(paused);
    }

    updatePrototypeFollower(delta) {
        if (this.encounter.mode === 'grip') return super.updatePrototypeFollower(delta);
        this.astronautFollower.setContextualFormation(null);
        this.astronautFollower.followDistance = 170;
        this.astronautFollower.update(delta);
    }

    update(time,delta) {
        if (!this.encounter.paused && !this.encounter.disposed) this.completion.advance(delta);
        super.update(time,delta);
        if (this.encounter.paused || this.encounter.disposed || this.transitioning) return;
        const frame = this.encounter.snapshot();
        const committed = frame.mode === 'settling' || (frame.mode === 'grip' && frame.state !== 'ready');
        if (committed) {
            this.cameras.main.stopFollow(); this.cameraLockedForGrip = true;
            const target = Math.max(0,Math.min(this.levelWidth-this.scale.width,frame.targetX-this.scale.width*0.46));
            this.cameras.main.scrollX += (target-this.cameras.main.scrollX)*0.12;
        } else if (this.cameraLockedForGrip) {
            this.cameraLockedForGrip = false;
            this.cameras.main.startFollow(this.player,true,0.12,0.12,-35,0);
        }
        if (this.encounter.clearedGrips !== this.lastSavedGrip) {
            this.completion.saveApproach(this.encounter.checkpoint());
            this.lastSavedGrip = this.encounter.clearedGrips;
        }
        if (this.encounter.arrive(this.player.x,this.isGrounded && this.player.body.bottom <= this.floorY + 2)) {
            this.completion.saveApproach(this.encounter.checkpoint());
            this.enterArena();
        }
    }

    enterArena() {
        if (this.transitioning) return;
        this.transitioning = true; this.clearInput();
        this.scene.start('TrumptopusPrototype');
    }

    drawExchange() {
        if (!this.arm) return;
        const state = this.encounter.snapshot();
        const section = state.section;
        this.arm.clear(); this.bossBar.clear();
        this.bossBody.body.enable = state.mode === 'grip';
        this.contactShadow.setVisible(state.mode === 'grip');
        if (section) {
            this.gate.setPosition(section.gateX - 16,this.floorY - 10).setSize(32,300);
            this.gate.body.updateFromGameObject(); this.gate.body.enable = true; this.gate.setVisible(true);
            const progress = state.progress;
            const x = state.mode === 'grip' ? state.targetX : section.minX + 110;
            let y = this.floorY - 190;
            if (state.state === 'windup') y -= Math.sin(progress * Math.PI / 2) * 42;
            if (state.state === 'strike') y = this.floorY - 232 + 209 * progress * progress;
            if (['contact','exposed'].includes(state.state)) y = this.floorY - 23;
            if (state.state === 'recoil') y = this.floorY - 23 - 209 * Math.sin(progress * Math.PI / 2);
            this.handPose = {x,y};
            this.bossBody.setPosition(x,y-31); this.bossBody.body.updateFromGameObject();
            this.contactShadow.setPosition(x,this.floorY+2);
            this.arm.lineStyle(26,0x697876,1);
            this.arm.beginPath(); this.arm.moveTo(section.gateX,this.floorY-258);
            this.arm.lineTo(x+65,y-80); this.arm.lineTo(x,y-20); this.arm.strokePath();
            this.arm.fillStyle(state.vulnerable ? 0xeecb79 : 0x94a5a0);
            this.arm.fillRoundedRect(x-28,y-84,56,85,10);
            this.arm.fillRoundedRect(x-35,y-21,70,42,5);
        } else {
            this.gate.body.enable = false; this.gate.setVisible(false);
            this.handPose = {x:this.levelWidth,y:0};
        }
        for (const [index,bridge] of this.bridges.entries()) {
            const lift = index < state.checkpoint.clearedGrips ? 1 :
                index === state.checkpoint.clearedGrips && state.mode === 'settling' ? state.progress : 0;
            bridge.y = this.floorY + FINAL_VOID_APPROACH.catchDepth * (1-lift) + 16;
            bridge.body.updateFromGameObject();
        }
    }

    getProofState() {
        return {...super.getProofState(),sceneKey:this.sys.settings.key,cameraX:this.cameras.main.scrollX,
            width:this.levelWidth,exitX:FINAL_VOID_APPROACH.exitX,catchY:this.floorY + FINAL_VOID_APPROACH.catchDepth,
            bridges:this.bridges.map(bridge=>({top:bridge.body.top,artTop:bridge.y-16,width:bridge.body.width})),
            savedRun:this.completion.run};
    }
}
