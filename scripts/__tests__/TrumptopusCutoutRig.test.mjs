import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUTOUT_PARTS, CUTOUT_REFERENCE, ARM_CHAINS, partBounds } from '../../src/dev/TrumptopusCutoutData.js';
import Rig, { solveCutoutPose } from '../../src/dev/TrumptopusCutoutRig.js';

test('ten source cutouts retain four arms and an unmirrored body/cap', () => {
    assert.equal(CUTOUT_PARTS.length,10);
    assert.equal(new Set(CUTOUT_PARTS.map(p=>p.id)).size,10);
    for(const id of ['body','rear-left','rear-right','upper-left','upper-right','lower-body']) {
        assert(CUTOUT_PARTS.find(p=>p.id===id));
    }
});
test('cutout polygons stay inside the documented source coordinates', () => {
    for(const part of CUTOUT_PARTS){
        assert(part.polygon.length>=3);
        for(const [x,y] of part.polygon){
            assert(Number.isFinite(x)&&Number.isFinite(y));
            assert(x>=0&&x<CUTOUT_REFERENCE.width&&y>=0&&y<CUTOUT_REFERENCE.height);
        }
        const bounds=partBounds(part);
        assert(bounds.width>0&&bounds.height>0);
    }
});
test('rest reproduces the original attachment coordinates and proportions', () => {
    const pose=solveCutoutPose('rest',0);
    for(const [i,chain] of ARM_CHAINS.entries()){
        assert.deepEqual(pose.joints[i].shoulder,chain.shoulder);
        assert.deepEqual(pose.joints[i].elbow,chain.elbow);
        assert.deepEqual(pose.joints[i].wrist,chain.wrist);
        assert.equal(pose.joints[i].stretch,1);
    }
});
test('the claw tip reaches the same floor as the planted body', () => {
    const arm=solveCutoutPose('contact',1).joints[0];
    const hand=CUTOUT_PARTS.find(p=>p.id==='hand-left');
    const tip=Math.max(...hand.polygon.map(p=>p[1]))-hand.pivot[1];
    assert(Math.abs(arm.wrist[1]+tip-CUTOUT_REFERENCE.floor)<1e-8);
});
test('pose boundaries do not jump between load, reach, contact, recover and rest', () => {
    for(const [from,to] of [['rest','load'],['load','reach'],['reach','contact'],['contact','recover'],['recover','rest']]){
        const a=solveCutoutPose(from,1),b=solveCutoutPose(to,0);
        assert.deepEqual(a.joints,b.joints,`${from} -> ${to}`);
        assert.deepEqual(a.bodyPosition,b.bodyPosition);
    }
});
test('motion stays finite, positive-scale and deterministic through the full cycle', () => {
    for(const beat of ['rest','load','reach','contact','recover'])for(let step=0;step<=100;step++){
        const pose=solveCutoutPose(beat,step/100);
        assert.deepEqual(pose,solveCutoutPose(beat,step/100));
        for(const arm of pose.joints){
            assert([...arm.shoulder,...arm.elbow,...arm.wrist,arm.stretch].every(Number.isFinite));
            assert(arm.stretch>=1&&arm.stretch<3);
        }
    }
});
test('invalid pose names or non-finite progress fail explicitly', () => {
    assert.throws(()=>solveCutoutPose('unknown',1));
    assert.throws(()=>solveCutoutPose('rest',NaN));
    assert.throws(()=>solveCutoutPose('rest',Infinity));
});
test('shutdown is idempotent and late pose updates cannot touch destroyed textures', () => {
    const removed=[];
    let destroyed=0;
    const rig=Object.create(Rig.prototype);
    Object.assign(rig,{root:{destroy(){destroyed++;}},scene:{textures:{remove:key=>removed.push(key)}},
        parts:new Map([['body',{key:'body'}]]),deform:{key:'lower-motion'},flex:new Map([
            ['left',{key:'forearm-left-motion'}],['right',{key:'forearm-right-motion'}]])});
    rig.destroy();rig.destroy();rig.setPose('contact',1);rig.setAttackPose({},{});
    assert.equal(destroyed,1);
    assert.deepEqual(removed,['body','lower-motion','forearm-left-motion','forearm-right-motion']);
});
