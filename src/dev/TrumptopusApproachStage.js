import { bakeTrumptopusCutouts } from './TrumptopusCutoutRig.js';
import { CUTOUT_PARTS, ARM_CHAINS } from './TrumptopusCutoutData.js';
import { createLimbWarp, paintLimbWarp } from './TrumptopusLimbWarp.js';
import { bakeStoneAtlas } from './TrumptopusStoneMaterial.js';

// Match the existing 70 x 42 contact box with the bottom of the visible claw.
// The longer fingers above it stay presentation-only, as in the arena rig.
export function approachClawTransform(part, palm, scale = 0.32) {
    const {visible,bounds,pivot}=part;
    const sx=70/(visible.right-visible.left),sy=104/(visible.bottom-visible.top);
    const x=palm.x-(bounds.x+(visible.left+visible.right)/2-pivot[0])*sx;
    const y=palm.y+21-(bounds.y+visible.bottom-pivot[1])*sy;
    return {x,y,scaleX:sx,scaleY:sy,tipScale:sx/scale,
        visibleLeft:palm.x-35,visibleRight:palm.x+35,visibleBottom:palm.y+21};
}

// Private presentation over the unchanged route/colliders. Nothing here owns
// damage, bridge progress, checkpoints, controls, or production registration.
export default class TrumptopusApproachStage {
    constructor(scene,landscape,foreground) {
        this.scene=scene;this.keys=[];this.objects=[];this.surfaces=[];
        const {width,height}=scene.scale;
        const sky=document.createElement('canvas');sky.width=834;sky.height=800;
        sky.getContext('2d').drawImage(landscape,510,0,834,800,0,0,834,800);
        const background=scene.add.image(width/2,height/2,this.texture('sky',sky))
            .setScrollFactor(0).setDepth(-10);
        background.setScale(Math.max(width/834,height/800));
        this.objects.push(background,scene.add.rectangle(width/2,height/2,width,height,0x070b14,.35)
            .setScrollFactor(0).setDepth(-9));
        const platforms=scene.platforms.getChildren();
        this.material=bakeStoneAtlas(scene,landscape,'trumptopus-approach-stone',platforms.map(({body})=>({
            width:body.width,height:body.height})));
        this.keys.push(this.material.key);
        for(const [index,platform] of platforms.entries()) {
            platform.setVisible(false);
            const {body}=platform;
            const sprite=scene.add.image(body.center.x,body.top,this.material.key,this.material.frames[index].name)
                .setOrigin(.5,0).setDepth(689);
            // Recovered crossings brighten only when their actual collider rises.
            const recovery=body.top>scene.floorY;
            sprite.setTint(recovery?0x738b90:0xb4c8cb);
            this.surfaces.push({platform,sprite,recovery});this.objects.push(sprite);
        }
        this.edges=scene.add.graphics().setDepth(691);this.objects.push(this.edges);
        const pillar=bakeStoneAtlas(scene,landscape,'trumptopus-approach-pillar',[{width:32,height:300}]);
        this.keys.push(pillar.key);
        this.pillar=scene.add.image(0,0,pillar.key,pillar.frames[0].name).setDepth(810).setTint(0x777b86);
        this.objects.push(this.pillar);
        this.parts=bakeTrumptopusCutouts(scene,foreground,'trumptopus-approach',
            CUTOUT_PARTS.filter(part=>['forearm-left','hand-left'].includes(part.id)));
        this.keys.push(...[...this.parts.values()].map(part=>part.key));
        this.handPart=this.parts.get('hand-left');
        const {bounds,pivot,key}=this.handPart;
        this.hand=scene.add.image(0,0,key).setOrigin((pivot[0]-bounds.x)/bounds.width,
            (pivot[1]-bounds.y)/bounds.height).setDepth(801);
        const motion=document.createElement('canvas');motion.width=2;motion.height=2;
        this.motion=scene.textures.get(this.texture('limb-motion',motion));
        this.limb=scene.add.image(0,0,this.motion.key).setOrigin(0).setDepth(800);
        this.objects.push(this.hand,this.limb);
        scene.prototypeUnderfloor.setVisible(false);scene.arm.setVisible(false);scene.gate.setAlpha(0);
    }

    texture(name,canvas) {
        const key=`trumptopus-approach-${name}`;
        this.scene.textures.addCanvas(key,canvas);this.keys.push(key);return key;
    }

    update(state,palm) {
        if(this.destroyed)return;
        const scene=this.scene;
        this.edges.clear();
        for(const {platform,sprite,recovery} of this.surfaces) {
            const {body}=platform;
            sprite.setPosition(body.center.x,body.top);
            const settled=body.top<=scene.floorY;
            sprite.setTint(recovery&&!settled?0x738b90:0xb4c8cb);
            this.edges.lineStyle(2,settled?0xc7dad7:0x8aadb1,.9)
                .lineBetween(body.left,body.top,body.right,body.top);
        }
        const visible=Boolean(state.section);
        this.pillar.setVisible(visible);this.hand.setVisible(visible);this.limb.setVisible(visible);
        if(!visible){this.clawEvidence=null;return;}
        const clearing=state.mode==='settling'?state.progress:0;
        this.pillar.setPosition(scene.gate.x,scene.gate.y).setAlpha(1-clearing);
        const transform=approachClawTransform(this.handPart,palm);
        this.hand.setPosition(transform.x,transform.y).setScale(transform.scaleX,transform.scaleY)
            .setAlpha(1-clearing).clearTint();
        if(state.vulnerable)this.hand.setTint(0xffdca7);
        const scale=.32,part=this.parts.get('forearm-left');
        const anchor={x:scene.gate.body.center.x,y:scene.gate.body.top+24};
        const start={x:anchor.x/scale,y:anchor.y/scale};
        const end={x:transform.x/scale,y:transform.y/scale};
        const options={tipScale:transform.tipScale,
            wave:state.state==='strike'?35*Math.sin(Math.PI*state.progress):0,
            travel:state.state==='strike'?state.progress:.5};
        const signature=JSON.stringify([start,end,options]);
        if(signature!==this.signature) {
            this.geometry=createLimbWarp(part,ARM_CHAINS[0],start,end,options);
            paintLimbWarp(this.motion,part.canvas,this.geometry,.5);
            this.limb.setTexture(this.motion.key).setPosition(this.geometry.bounds.left*scale,
                this.geometry.bounds.top*scale).setScale(scale/.5);
            this.signature=signature;
        }
        this.limb.setAlpha(1-clearing);
        this.clawEvidence={...transform,anchor,pillar:{left:scene.gate.body.left,right:scene.gate.body.right,
            top:scene.gate.body.top,bottom:scene.gate.body.bottom},
            elbowGap:Math.hypot(this.geometry.start.x-start.x,this.geometry.start.y-start.y)*scale,
            wristGap:Math.hypot(this.geometry.end.x-end.x,this.geometry.end.y-end.y)*scale};
    }

    getEvidence() {
        return {sourcePixelsOnly:true,textureCount:this.keys.length,claw:this.clawEvidence,
            material:this.material,
            surfaces:this.surfaces.map(({platform,sprite})=>({artTop:sprite.y,collisionTop:platform.body.top,
                artWidth:sprite.width,collisionWidth:platform.body.width})),
            sourceCharacterExcluded:true,productionIntegrated:false};
    }

    destroy() {
        if(this.destroyed)return;
        this.destroyed=true;
        for(const object of this.objects)object.destroy();
        for(const key of this.keys)this.scene.textures.remove(key);
    }
}
