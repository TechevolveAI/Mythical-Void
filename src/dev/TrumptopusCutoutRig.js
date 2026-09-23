import { CUTOUT_PARTS, CUTOUT_REFERENCE, ARM_CHAINS, partBounds } from './TrumptopusCutoutData.js';
import { createLimbWarp, paintLimbWarp, attackLimbShape } from './TrumptopusLimbWarp.js';

const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
const rotate = ([x,y], angle) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
const add = ([x,y], [a,b]) => [x+a,y+b];
const minus = ([x,y], [a,b]) => [x-a,y-b];

export function solveCutoutPose(beat, progress = 1) {
    if (!['rest','load','reach','contact','recover'].includes(beat) || !Number.isFinite(progress)) {
        throw new Error('Invalid private cutout pose');
    }
    const p = smooth(progress);
    const load = beat === 'load' ? p : beat === 'reach' ? 1 - p : 0;
    const press = beat === 'reach' ? p : beat === 'contact' ? 1 : beat === 'recover' ? 1 - p : 0;
    const bodyLean = load * 0.018 - press * 0.012;
    const bodyPosition = [640, 980 + load * 7 + press * 4];
    const joints = ARM_CHAINS.map(chain => {
        const left = chain.side === 'left';
        const upperAngle = left ? -load * 0.16 : load * 0.07;
        const lowerAngle = left ? load * 0.26 : -load * 0.11;
        const shoulder = add(rotate(minus(chain.shoulder, [640,980]), bodyLean), bodyPosition);
        const elbow = add(shoulder, rotate(minus(chain.elbow, chain.shoulder), upperAngle));
        const offset = minus(chain.wrist, chain.elbow);
        const hand = CUTOUT_PARTS.find(part=>part.id===`hand-${chain.side}`);
        const handBottom = Math.max(...hand.polygon.map(point=>point[1])) - chain.wrist[1];
        const contactStretch = (CUTOUT_REFERENCE.floor - handBottom - elbow[1]) / offset[1];
        const stretch = left ? 1 + press * (contactStretch - 1) : 1;
        const wrist = add(elbow, rotate([offset[0], offset[1] * stretch], lowerAngle));
        return {side:chain.side, shoulder, elbow, wrist, upperAngle, lowerAngle, stretch};
    });
    return { p, load, press, bodyLean, bodyPosition, joints };
}

// Bake only existing pixels into small transparent textures. Polygons describe
// anatomy, not arbitrary presentation masks; the original is never overwritten.
export function bakeTrumptopusCutouts(scene, image, prefix, selectedParts = CUTOUT_PARTS) {
    const parts = new Map();
    for (const part of selectedParts) {
        const bounds = partBounds(part);
        const canvas = document.createElement('canvas');
        canvas.width = bounds.width; canvas.height = bounds.height;
        const ctx = canvas.getContext('2d');
        ctx.translate(-bounds.x, -bounds.y);
        ctx.beginPath();
        for (const polygon of [part.polygon]) {
            polygon.forEach(([x,y], index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
            ctx.closePath();
        }
        ctx.clip('evenodd');
        ctx.drawImage(image, 0, 0, CUTOUT_REFERENCE.width, CUTOUT_REFERENCE.height);
        const key = `${prefix}-${part.id}`;
        scene.textures.addCanvas(key, canvas);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const visible={left:canvas.width,top:canvas.height,right:0,bottom:0};
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>64){
            visible.left=Math.min(visible.left,x);visible.right=Math.max(visible.right,x);
            visible.top=Math.min(visible.top,y);visible.bottom=Math.max(visible.bottom,y);
        }
        parts.set(part.id, { ...part, bounds, visible, key, canvas });
    }
    return parts;
}

// Source-art rig. The private adapter supplies combat poses; this class neither
// registers a live scene nor changes the encounter's collision or timing.
export default class TrumptopusCutoutRig {
    constructor(scene, image, { x, floorY, height, prefix = 'trumptopus-cutout' }) {
        this.scene = scene;
        this.prefix = prefix;
        this.parts = bakeTrumptopusCutouts(scene, image, prefix);
        this.scale = height / (CUTOUT_REFERENCE.floor - 51);
        this.origin = { x: x - 640 * this.scale, y: floorY - CUTOUT_REFERENCE.floor * this.scale };
        this.root = scene.add.container(this.origin.x, this.origin.y).setScale(this.scale);
        this.sprites = new Map();
        for (const [id, part] of this.parts) {
            const sprite = scene.add.image(...part.pivot, part.key).setOrigin(
                (part.pivot[0] - part.bounds.x) / part.bounds.width,
                (part.pivot[1] - part.bounds.y) / part.bounds.height);
            this.root.add(sprite);
            this.sprites.set(id, sprite);
        }
        for (const id of ['rear-left','rear-right','lower-body','hand-left','hand-right',
            'forearm-left','forearm-right','upper-left','upper-right','body']) this.root.bringToTop(this.sprites.get(id));
        this.lower = this.parts.get('lower-body');
        this.lowerResolution=Math.max(0.2,this.scale*1.5);
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil((this.lower.bounds.width + 100)*this.lowerResolution);
        canvas.height = Math.ceil(this.lower.bounds.height*this.lowerResolution);
        this.deform = scene.textures.addCanvas(`${prefix}-lower-motion`, canvas);
        const lowerSprite = this.sprites.get('lower-body');
        lowerSprite.setTexture(this.deform.key).setOrigin(
            (640 - this.lower.bounds.x + 50)*this.lowerResolution / canvas.width,
            (1000 - this.lower.bounds.y)*this.lowerResolution / canvas.height).setScale(1/this.lowerResolution);
        const pixels=this.lower.canvas.getContext('2d').getImageData(0,0,this.lower.canvas.width,this.lower.canvas.height).data;
        let lastRow=0;
        for(let i=3;i<pixels.length;i+=4)if(pixels[i]>64)lastRow=Math.floor((i/4)/this.lower.canvas.width);
        lowerSprite.y+=CUTOUT_REFERENCE.floor-(this.lower.bounds.y+lastRow);
        this.flex=new Map();
        this.warpCache=new Map();
        for(const side of ['left','right']){
            const extension=document.createElement('canvas');
            extension.width=2;extension.height=2;
            const texture=scene.textures.addCanvas(`${prefix}-forearm-${side}-motion`,extension);
            this.flex.set(side,texture);
            this.sprites.get(`forearm-${side}`).setTexture(texture.key).setOrigin(0);
        }
        this.setPose('rest', 0);
    }

    setPose(beat, progress = 1, { deferForearms = false } = {}) {
        if(this.destroyed)return;
        const {p,load,press,bodyLean,bodyPosition,joints} = solveCutoutPose(beat,progress);
        const body = this.sprites.get('body');
        body.setRotation(bodyLean).setPosition(...bodyPosition);
        this.sprites.get('rear-left').setRotation(-load * 0.055 + press * 0.035);
        this.sprites.get('rear-right').setRotation(load * 0.045 - press * 0.025);
        this.joints = joints;
        for (const {side,shoulder,elbow,wrist,upperAngle,lowerAngle} of joints) {
            this.sprites.get(`upper-${side}`).setPosition(...shoulder).setRotation(upperAngle);
            this.sprites.get(`hand-${side}`).setPosition(...wrist).setRotation(lowerAngle).setScale(1).clearTint();
            if(!deferForearms)this.paintForearm(side,elbow,wrist,{startAngle:upperAngle,endAngle:lowerAngle,
                wave:press*Math.sin(Math.PI*p)*24,travel:p});
        }
        // Deformation begins at the hip and travels down into the planted base.
        // Both endpoints stay fixed; no whole-character hopping or translation.
        const phase = beat === 'load' ? p * 0.25 : beat === 'reach' ? 0.25 + p * 0.45 : beat === 'contact' ? 0.7 : beat === 'recover' ? 0.7 + p * 0.3 : 0;
        const strength = beat === 'rest' ? 0 : (beat === 'recover' ? 1 - p : 1);
        const signature=`${phase}:${strength}`;
        if(this.lowerSignature!==signature){
            const ctx = this.deform.context,source = this.lower.canvas;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.save();ctx.scale(this.lowerResolution,this.lowerResolution);
            const step=Math.max(2,Math.floor(2/this.lowerResolution));
            for (let y = 0; y < source.height; y += step) {
                const t = y / source.height;
                const wave = Math.exp(-(((t - phase) / 0.22) ** 2)) * Math.sin(Math.PI * t) * 21 * strength;
                ctx.drawImage(source, 0, y, source.width, Math.min(step, source.height - y), 50 + wave, y, source.width, Math.min(step, source.height - y));
            }
            ctx.restore();
            this.deform.refresh();this.lowerSignature=signature;
        }
        this.beat = beat;
        this.progress = progress;
    }

    paintForearm(side,elbow,wrist,options={}) {
        const signature=JSON.stringify([elbow,wrist,options]);
        if(this.warpCache.get(side)?.signature===signature)return this.warpCache.get(side).geometry;
        const part=this.parts.get(`forearm-${side}`),chain=ARM_CHAINS.find(arm=>arm.side===side);
        const geometry=createLimbWarp(part,chain,{x:elbow[0],y:elbow[1]},{x:wrist[0],y:wrist[1]},options);
        const resolution=Math.max(0.2,this.scale*1.5);
        const texture=this.flex.get(side);
        paintLimbWarp(texture,part.canvas,geometry,resolution);
        this.sprites.get(`forearm-${side}`).setTexture(texture.key).setOrigin(0)
            .setPosition(geometry.bounds.left,geometry.bounds.top).setRotation(0).setScale(1/resolution);
        this.warpCache.set(side,{signature,geometry});
        return geometry;
    }

    // Consume the same committed palms used by the encounter. Only the front
    // arms attack; the rear pair and planted base retain the character's stance.
    setAttackPose(snapshot,pose) {
        if(this.destroyed)return;
        const {state,progress}=snapshot;
        const beat=state==='windup'?'load':state==='strike'?'reach':
            ['contact','exposed'].includes(state)?'contact':state==='recoil'?'recover':'rest';
        this.setPose(beat,progress,{deferForearms:true});
        this.root.setAlpha(pose.alpha);
        const engagement=state==='windup'?smooth(progress):state==='recoil'?1-smooth(progress):
            ['strike','contact','exposed'].includes(state)?1:0;
        this.attackHands=[];
        const activeSides=engagement===0?[]:pose.limbs.map((_,index)=>index===0?'left':'right');
        for(const joint of this.joints)if(!activeSides.includes(joint.side))this.paintForearm(joint.side,joint.elbow,joint.wrist);
        if(engagement===0)return;
        for(const [index,limb] of pose.limbs.entries()){
            const side=index===0?'left':'right';
            const joint=this.joints.find(arm=>arm.side===side);
            const part=this.parts.get(`hand-${side}`),visible=part.visible;
            const palm=limb.palm;
            const width=visible.right-visible.left,height=visible.bottom-visible.top;
            const scaleX=1+engagement*(palm.width/(width*this.scale)-1);
            const scaleY=1+engagement*(104/(height*this.scale)-1);
            const centreX=part.bounds.x+(visible.left+visible.right)/2-part.pivot[0];
            const bottom=part.bounds.y+visible.bottom-part.pivot[1];
            const target=[(palm.x-this.origin.x)/this.scale-centreX*scaleX,
                (palm.y+palm.height/2-this.origin.y)/this.scale-bottom*scaleY];
            const wrist=joint.wrist.map((value,i)=>value+(target[i]-value)*engagement);
            const hand=this.sprites.get(`hand-${side}`);
            hand.setPosition(...wrist).setScale(scaleX,scaleY).setRotation(0);
            if(snapshot.vulnerable)hand.setTint(0xffdca7);
            const span=Math.hypot(wrist[0]-joint.elbow[0],wrist[1]-joint.elbow[1]);
            const tissue=attackLimbShape(state,progress,span,engagement);
            const geometry=this.paintForearm(side,joint.elbow,wrist,{tipScale:scaleX,startAngle:joint.upperAngle,...tissue});
            joint.wrist=wrist;
            this.attackHands.push({side,palm:{...palm},wrist,visibleBottom:this.origin.y+(wrist[1]+bottom*scaleY)*this.scale,
                visibleLeft:this.origin.x+(wrist[0]+(part.bounds.x+visible.left-part.pivot[0])*scaleX)*this.scale,
                visibleRight:this.origin.x+(wrist[0]+(part.bounds.x+visible.right-part.pivot[0])*scaleX)*this.scale,
                elbowGap:Math.hypot(geometry.start.x-joint.elbow[0],geometry.start.y-joint.elbow[1]),
                wristGap:Math.hypot(geometry.end.x-wrist[0],geometry.end.y-wrist[1]),tissue,
                centreline:geometry.centreline.map(p=>({x:this.origin.x+p.x*this.scale,y:this.origin.y+p.y*this.scale}))});
        }
    }

    getEvidence() {
        let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
        for(const sprite of this.sprites.values()){
            const canvas=sprite.texture.getSourceImage();
            const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            const matrix=sprite.getWorldTransformMatrix();
            for(let y=0;y<canvas.height;y+=2){
                let a=-1,b=-1;
                for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>64){if(a<0)a=x;b=x;}
                if(a<0)continue;
                for(const x of [a,b]){
                    const point=matrix.transformPoint(x-sprite.displayOriginX,y-sprite.displayOriginY);
                    left=Math.min(left,point.x);right=Math.max(right,point.x);
                    top=Math.min(top,point.y);bottom=Math.max(bottom,point.y);
                }
            }
        }
        return { beat: this.beat, progress: this.progress, layerCount: this.parts.size,
            scale: this.scale, joints: this.joints, bounds: this.root.getBounds(),
            visibleBounds:{left,top,right,bottom},
            attackHands:this.attackHands||[],originalPixelsOnly: true, productionIntegrated: false };
    }

    destroy() {
        if(this.destroyed)return;
        this.destroyed=true;
        this.root.destroy(true);
        for (const part of this.parts.values()) this.scene.textures.remove(part.key);
        this.scene.textures.remove(this.deform.key);
        for(const texture of this.flex.values())this.scene.textures.remove(texture.key);
    }
}
