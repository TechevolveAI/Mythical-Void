import TrumptopusFinalePreview from './TrumptopusFinalePreview.js';
import TrumptopusCutoutRig from './TrumptopusCutoutRig.js';
import { trumptopusArenaLayout,chooseAllyLanding,anticipatedPlayerBounds,constrainAllyStrike,allySweepLeapDuration,sampleAllyLeap,trumptopusBanishment } from './TrumptopusPresentation.js';
import { getTrumptopusAttackPose } from '../systems/TrumptopusAttackPose.js';
import TrumptopusArenaStage from './TrumptopusArenaStage.js';

// Private artwork adapter. The encounter, controls and reward flow still own
// gameplay; the supplied character consumes their existing committed poses.
export default class TrumptopusArtFinalePreview extends TrumptopusFinalePreview {
    configurePrototypeWorld() {
        super.configurePrototypeWorld();
        this.stageLayout=trumptopusArenaLayout(this.scale.width,this.scale.height);
        this.floorY=this.stageLayout.floorY;this.levelHeight=this.floorY+50;
        this.allyLeap=null;this.sweepLeapDone=false;
    }

    preload() {
        this.load.image('trumptopus-source',new URL('./assets/trumptopus/source-foreground.png',import.meta.url).href);
        this.load.image('trumptopus-landscape-source',new URL('./assets/trumptopus/source-landscape.png',import.meta.url).href);
    }

    createPrototypeTerrain() {
        this.floorPlatform=this.createPlatform(0,this.floorY,this.levelWidth,80,'solid');
        this.floorPlatform.setVisible(false);
    }

    create() {
        this.rigFrameCosts=[];
        super.create();
        if(!this.textures.exists('trumptopus-source'))throw new Error('Private Trumptopus source artwork did not load');
        const {bossX,bossFloorY,bossHeight}=this.stageLayout;
        this.characterRig=new TrumptopusCutoutRig(this,this.textures.get('trumptopus-source').getSourceImage(),{
            x:bossX,floorY:bossFloorY,height:bossHeight,prefix:'trumptopus-fight'
        });
        this.characterRig.root.setDepth(800);
        this.arm.setVisible(false);
        if(!this.textures.exists('trumptopus-landscape-source'))throw new Error('Private Trumptopus landscape did not load');
        this.arenaStage=new TrumptopusArenaStage(this,this.textures.get('trumptopus-landscape-source').getSourceImage(),this.stageLayout);
        this.textures.remove('trumptopus-landscape-source');
        this.bodyShadow=this.add.ellipse(bossX,bossFloorY+2,bossHeight*0.36,10,0x020304,0.5).setDepth(690);
        this.voidTear=this.add.graphics().setDepth(790);
        this.banishmentEvidence=[];
        this.events.once('shutdown',()=>{
            this.characterRig?.destroy();this.characterRig=null;
            this.arenaStage?.destroy();this.arenaStage=null;
        });
        this.drawExchange();
    }

    drawExchange() {
        super.drawExchange();
        if(!this.characterRig)return;
        const started=performance.now();
        this.characterRig.setAttackPose(this.encounter.snapshot(),this.pose);
        this.drawBanishment(this.encounter.snapshot());
        if(this.rigFrameCosts.length<10000)this.rigFrameCosts.push(performance.now()-started);
    }

    update(time,delta) {
        super.update(time,delta);
        // The parent moves the foothold after drawExchange. Follow its actual
        // static body here so art and collision never differ by one game step.
        this.arenaStage?.syncProps();
    }

    playerVisualBounds() {
        const visible=this.playerContactGeometry,player=this.player;
        const left=player.x+(player.flipX?player.width/2-visible.right-1:visible.left-player.width/2)*player.scaleX;
        return {left:left-1,right:left+visible.width*player.scaleX+1};
    }

    performAttack(options) {
        const follower=this.astronautFollower,previous=follower?.strikeTween;
        super.performAttack(options);
        const tween=follower?.strikeTween;
        if(!tween||tween===previous)return;
        const side=follower.sprite.x<this.player.x?'left':'right';
        // Preserve the existing slash, timing and damage. Only the cosmetic
        // lunge stops short when it would cross the creature or screen edge.
        tween.on('update',()=>{
            if(!follower.sprite?.active||!this.player?.active)return;
            const x=constrainAllyStrike(follower.sprite.x,{side,player:this.playerVisualBounds(),width:this.levelWidth});
            if(x!==null)follower.sprite.x=x;
        });
    }

    updatePrototypeFollower(delta) {
        const follower=this.astronautFollower;
        if(!follower?.sprite)return;
        const state=this.encounter.snapshot();
        if(state.attack!=='sweep'||state.state==='ready'||state.mode==='phase_intro')this.sweepLeapDone=false;
        const player=this.player,playerBounds=this.playerVisualBounds();
        const anticipated=anticipatedPlayerBounds(playerBounds,player.body.velocity.x,this.levelWidth);
        const contact=getTrumptopusAttackPose({...state,state:'contact',progress:1},{width:this.levelWidth,floorY:this.floorY});
        const hands=state.mode==='combat'&&state.state!=='ready'
            ? contact.limbs.map(limb=>({left:limb.palm.x-limb.palm.width/2,right:limb.palm.x+limb.palm.width/2})) : [];
        const landing=chooseAllyLanding({width:this.levelWidth,player:anticipated,hands,currentX:follower.sprite.x,
            playerGap:32});
        const playerCentre=(playerBounds.left+playerBounds.right)/2;
        const changesFlank=landing!==null&&((landing-playerCentre)*(follower.sprite.x-playerCentre)<0||
            (landing+49>playerBounds.left&&landing-49<playerBounds.right));
        const sweep=state.attack==='sweep'&&state.state==='windup'&&!this.sweepLeapDone&&
            (state.progress>=.4||(changesFlank&&Math.abs(player.body.velocity.x)>20));
        const changeSide=(state.mode==='phase_intro'||state.attack!=='sweep')&&['ready','windup','phase_intro'].includes(state.state)&&
            changesFlank;
        if(!this.allyLeap&&!follower.isStriking&&landing!==null&&(sweep||changeSide)){
            this.allyLeap={fromX:follower.sprite.x,toX:landing,elapsed:0,
                height:sweep?400:240,
                duration:sweep?allySweepLeapDuration({width:this.levelWidth,landingX:landing,progress:state.progress}):900};
            if(sweep)this.sweepLeapDone=true;
        }
        if(follower.isStriking&&!this.allyLeap)return;
        const footOffset=follower.getContactY()-follower.sprite.y;
        if(this.allyLeap){
            const p=this.allyLeap.elapsed/this.allyLeap.duration,step=Math.min(delta,50)*.6;
            if(landing!==null&&(p<.5||!changesFlank)){
                const difference=landing-this.allyLeap.toX;
                this.allyLeap.toX+=Math.sign(difference)*Math.min(Math.abs(difference),step);
            }
            // Retreat while lifting if the player approaches. Holding a fixed
            // take-off point would let them catch the ally before it rises clear.
            if(p<.2&&Math.sign(player.body.velocity.x)===Math.sign(this.allyLeap.fromX-playerCentre)){
                this.allyLeap.fromX=Math.max(24,Math.min(this.levelWidth-24,
                    this.allyLeap.fromX+Math.sign(player.body.velocity.x)*step));
            }
            this.allyLeap.elapsed+=Math.min(delta,50);
            const sample=sampleAllyLeap({...this.allyLeap,floorY:this.floorY});
            follower.sprite.setPosition(sample.x,sample.footY-footOffset);
            if(sample.landed)this.allyLeap=null;
        }else{
            // Retreat along the same flank immediately; crossing the player
            // requires the separate vault, never a walk through their body.
            const desired=landing!==null&&!changesFlank?landing:follower.sprite.x;
            const step=Math.min(Math.abs(desired-follower.sprite.x),delta*.6);
            follower.sprite.x+=Math.sign(desired-follower.sprite.x)*step;
            follower.sprite.y=this.floorY-footOffset;
        }
        follower.sprite.setFlipX(this.player.x<follower.sprite.x).setRotation(0).setDepth(898);
        follower.shadow.setPosition(follower.sprite.x,this.floorY).setAlpha(this.allyLeap?.18:.38).setDepth(897);
    }

    drawBanishment(state) {
        const rig=this.characterRig,root=rig.root;
        const {bossX,bossFloorY,bossHeight}=this.stageLayout;
        this.voidTear.clear();
        root.setPosition(rig.origin.x,rig.origin.y).setScale(rig.scale).setRotation(0);
        if(state.mode!=='banishment'){
            root.setAlpha(state.mode==='aftermath'?0:1);
            this.bodyShadow.setAlpha(state.mode==='aftermath'?0:.5);
            this.arenaStage.drawEdge(state.mode==='aftermath'?1:0);
            return;
        }
        const pose=trumptopusBanishment(state.progress),cx=bossX+24,cy=bossFloorY-130;
        const points=Array.from({length:20},(_,i)=>{
            const angle=i/20*Math.PI*2,radius=i%2?1:.85;
            return {x:cx+Math.cos(angle)*74*pose.opening*radius,y:cy+Math.sin(angle)*130*pose.opening*radius};
        });
        this.voidTear.fillStyle(0x07020e).fillPoints(points,true);
        this.voidTear.lineStyle(3,0xb399e1,pose.opening).strokePoints(points,true);
        const scale=rig.scale*pose.scale,c=Math.cos(pose.rotation),s=Math.sin(pose.rotation);
        root.setScale(scale).setRotation(pose.rotation).setAlpha(pose.visible?1:0);
        root.setPosition(bossX+pose.x-(640*c-1908*s)*scale,
            bossFloorY+pose.y-(640*s+1908*c)*scale);
        this.bodyShadow.setAlpha(pose.shadow*.5);
        this.arenaStage.drawEdge(pose.release);
        const bucket=Math.floor(state.progress*8);
        if(!this.banishmentEvidence.some(frame=>frame.bucket===bucket))this.banishmentEvidence.push({bucket,...pose});
    }

    getProofState() {
        const costs=[...this.rigFrameCosts].sort((a,b)=>a-b);
        const textures=this.characterRig?[
            this.textures.get('trumptopus-source'),
            ...[...this.characterRig.parts.values()].map(part=>this.textures.get(part.key)),
            this.characterRig.deform,...this.characterRig.flex.values()
        ]:[];
        return {...super.getProofState(),banishment:this.banishmentEvidence,allyLeaping:Boolean(this.allyLeap),
            allyContactY:this.astronautFollower?.getContactY(),stageLayout:this.stageLayout,
            floorContact:{artTop:this.arenaStage?.floor.y,bodyTop:this.floorPlatform.body.top},
            stageMaterial:this.arenaStage?.material,
            arenaProps:this.arenaStage?.getPropEvidence(),
            stageTextureRgbaBytes:(this.arenaStage?.keys||[]).reduce((bytes,key)=>{
                const image=this.textures.get(key).getSourceImage();return bytes+image.width*image.height*4;
            },0),sourceArtRig:this.characterRig?{
            layerCount:this.characterRig.parts.size,attackHands:this.characterRig.attackHands||[],
            source:'supplied-image',rootAlpha:this.characterRig.root.alpha,
            rootScale:this.characterRig.root.scaleX,restScale:this.characterRig.scale,rootRotation:this.characterRig.root.rotation,
            estimatedTextureRgbaBytes:textures.reduce((bytes,texture)=>{const image=texture.getSourceImage();return bytes+image.width*image.height*4;},0),
            renderCostMs:{samples:costs.length,p95:costs[Math.floor(costs.length*.95)]||0,max:costs.at(-1)||0}
        }:null};
    }
}
