import TrumptopusFinalePreview from './TrumptopusFinalePreview.js';
import TrumptopusCutoutRig from './TrumptopusCutoutRig.js';

// Private artwork adapter. The encounter, controls and reward flow still own
// gameplay; the supplied character consumes their existing committed poses.
export default class TrumptopusArtFinalePreview extends TrumptopusFinalePreview {
    preload() {
        this.load.image('trumptopus-source',new URL('./assets/trumptopus/source-foreground.png',import.meta.url).href);
    }

    create() {
        this.rigFrameCosts=[];
        super.create();
        if(!this.textures.exists('trumptopus-source'))throw new Error('Private Trumptopus source artwork did not load');
        const height=Math.min(330,this.scale.height*0.48,this.levelWidth*0.77);
        this.characterRig=new TrumptopusCutoutRig(this,this.textures.get('trumptopus-source').getSourceImage(),{
            x:this.levelWidth*0.72,floorY:this.floorY,height,prefix:'trumptopus-fight'
        });
        this.characterRig.root.setDepth(800);
        this.arm.setVisible(false);
        this.bodyShadow=this.add.ellipse(this.levelWidth*0.72,this.floorY+2,height*0.36,10,0x020304,0.5).setDepth(690);
        this.events.once('shutdown',()=>{
            this.characterRig?.destroy();this.characterRig=null;
        });
        this.drawExchange();
    }

    drawExchange() {
        super.drawExchange();
        if(!this.characterRig)return;
        const started=performance.now();
        this.characterRig.setAttackPose(this.encounter.snapshot(),this.pose);
        if(this.rigFrameCosts.length<10000)this.rigFrameCosts.push(performance.now()-started);
        this.bodyShadow.setAlpha(this.pose.alpha*0.5);
    }

    getProofState() {
        const costs=[...this.rigFrameCosts].sort((a,b)=>a-b);
        const textures=this.characterRig?[
            this.textures.get('trumptopus-source'),
            ...[...this.characterRig.parts.values()].map(part=>this.textures.get(part.key)),
            this.characterRig.deform,...this.characterRig.flex.values()
        ]:[];
        return {...super.getProofState(),sourceArtRig:this.characterRig?{
            layerCount:this.characterRig.parts.size,attackHands:this.characterRig.attackHands||[],
            source:'supplied-image',rootAlpha:this.characterRig.root.alpha,
            estimatedTextureRgbaBytes:textures.reduce((bytes,texture)=>{const image=texture.getSourceImage();return bytes+image.width*image.height*4;},0),
            renderCostMs:{samples:costs.length,p95:costs[Math.floor(costs.length*.95)]||0,max:costs.at(-1)||0}
        }:null};
    }
}
