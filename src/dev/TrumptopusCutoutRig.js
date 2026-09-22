import { CUTOUT_PARTS, CUTOUT_REFERENCE, ARM_CHAINS, partBounds } from './TrumptopusCutoutData.js';

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
export function bakeTrumptopusCutouts(scene, image, prefix) {
    const parts = new Map();
    for (const part of CUTOUT_PARTS) {
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
        parts.set(part.id, { ...part, bounds, key, canvas });
    }
    return parts;
}

// First source-art rig. Kept out of live scene registration and combat collision.
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
        const canvas = document.createElement('canvas');
        canvas.width = this.lower.bounds.width + 100;
        canvas.height = this.lower.bounds.height;
        this.deform = scene.textures.addCanvas(`${prefix}-lower-motion`, canvas);
        const lowerSprite = this.sprites.get('lower-body');
        lowerSprite.setTexture(this.deform.key).setOrigin(
            (640 - this.lower.bounds.x + 50) / canvas.width,
            (1000 - this.lower.bounds.y) / canvas.height);
        const pixels=this.lower.canvas.getContext('2d').getImageData(0,0,this.lower.canvas.width,this.lower.canvas.height).data;
        let lastRow=0;
        for(let i=3;i<pixels.length;i+=4)if(pixels[i]>64)lastRow=Math.floor((i/4)/this.lower.canvas.width);
        lowerSprite.y+=CUTOUT_REFERENCE.floor-(this.lower.bounds.y+lastRow);
        this.forearm=this.parts.get('forearm-left');
        const extension=document.createElement('canvas');
        extension.width=this.forearm.canvas.width;
        extension.height=this.forearm.canvas.height*3;
        this.flex=scene.textures.addCanvas(`${prefix}-forearm-motion`,extension);
        this.sprites.get('forearm-left').setTexture(this.flex.key).setOrigin(
            (this.forearm.pivot[0]-this.forearm.bounds.x)/extension.width,
            (this.forearm.pivot[1]-this.forearm.bounds.y)/extension.height);
        this.setPose('rest', 0);
    }

    setPose(beat, progress = 1) {
        if(this.destroyed)return;
        const {p,load,press,bodyLean,bodyPosition,joints} = solveCutoutPose(beat,progress);
        const body = this.sprites.get('body');
        body.setRotation(bodyLean).setPosition(...bodyPosition);
        this.sprites.get('rear-left').setRotation(-load * 0.055 + press * 0.035);
        this.sprites.get('rear-right').setRotation(load * 0.045 - press * 0.025);
        this.joints = joints;
        for (const {side,shoulder,elbow,wrist,upperAngle,lowerAngle,stretch} of joints) {
            this.sprites.get(`upper-${side}`).setPosition(...shoulder).setRotation(upperAngle);
            this.sprites.get(`forearm-${side}`).setPosition(...elbow).setRotation(lowerAngle).setScale(1);
            this.sprites.get(`hand-${side}`).setPosition(...wrist).setRotation(lowerAngle);
        }
        // Keep the elbow overlap at its original size. Stretch only distal
        // tissue, rather than magnifying a hard source cut across the joint.
        const flex=this.flex.context, forearm=this.forearm.canvas;
        const elbowRow=this.forearm.pivot[1]-this.forearm.bounds.y;
        flex.clearRect(0,0,flex.canvas.width,flex.canvas.height);
        flex.drawImage(forearm,0,0,forearm.width,elbowRow,0,0,forearm.width,elbowRow);
        flex.drawImage(forearm,0,elbowRow,forearm.width,forearm.height-elbowRow,
            0,elbowRow,forearm.width,(forearm.height-elbowRow)*joints[0].stretch);
        this.flex.refresh();
        // Deformation begins at the hip and travels down into the planted base.
        // Both endpoints stay fixed; no whole-character hopping or translation.
        const ctx = this.deform.context;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const source = this.lower.canvas;
        const phase = beat === 'load' ? p * 0.25 : beat === 'reach' ? 0.25 + p * 0.45 : beat === 'contact' ? 0.7 : beat === 'recover' ? 0.7 + p * 0.3 : 0;
        const strength = beat === 'rest' ? 0 : (beat === 'recover' ? 1 - p : 1);
        for (let y = 0; y < source.height; y += 2) {
            const t = y / source.height;
            const wave = Math.exp(-(((t - phase) / 0.22) ** 2)) * Math.sin(Math.PI * t) * 21 * strength;
            ctx.drawImage(source, 0, y, source.width, Math.min(2, source.height - y), 50 + wave, y, source.width, Math.min(2, source.height - y));
        }
        this.deform.refresh();
        this.beat = beat;
        this.progress = progress;
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
            originalPixelsOnly: true, campaignIntegrated: false };
    }

    destroy() {
        if(this.destroyed)return;
        this.destroyed=true;
        this.root.destroy(true);
        for (const part of this.parts.values()) this.scene.textures.remove(part.key);
        this.scene.textures.remove(this.deform.key);
        this.scene.textures.remove(this.flex.key);
    }
}
