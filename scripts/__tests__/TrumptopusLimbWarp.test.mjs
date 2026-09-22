import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUTOUT_PARTS, ARM_CHAINS, partBounds } from '../../src/dev/TrumptopusCutoutData.js';
import { createLimbWarp } from '../../src/dev/TrumptopusLimbWarp.js';

const fixture=side=>{
    const part=CUTOUT_PARTS.find(p=>p.id===`forearm-${side}`);
    return {part:{...part,bounds:partBounds(part)},chain:ARM_CHAINS.find(c=>c.side===side)};
};
test('rest warp reproduces every source vertex, not just the two anchors',()=>{
    for(const side of ['left','right']){
        const {part,chain}=fixture(side);
        const result=createLimbWarp(part,chain,{x:chain.elbow[0],y:chain.elbow[1]},{x:chain.wrist[0],y:chain.wrist[1]});
        for(const strip of result.strips)for(let i=0;i<4;i++){
            assert(Math.abs(strip.source[i].x+part.bounds.x-strip.destination[i].x)<1e-8);
            assert(Math.abs(strip.source[i].y+part.bounds.y-strip.destination[i].y)<1e-8);
        }
    }
});
test('curved extensions keep the elbow and wrist attached at every target',()=>{
    for(const side of ['left','right'])for(const x of [-300,200,800,1600])for(const y of [400,1200,1900]){
        const {part,chain}=fixture(side),start={x:chain.elbow[0],y:chain.elbow[1]},end={x,y};
        const geometry=createLimbWarp(part,chain,start,end,{wave:35,travel:.45,tipScale:2.5});
        assert(Math.hypot(geometry.start.x-start.x,geometry.start.y-start.y)<1e-8);
        assert(Math.hypot(geometry.end.x-end.x,geometry.end.y-end.y)<1e-8);
        assert(geometry.bounds.width>0&&geometry.bounds.height>0);
        for(const strip of geometry.strips)for(const point of strip.destination)assert(Number.isFinite(point.x)&&Number.isFinite(point.y));
    }
});
test('pressure moves through the forearm without moving its attachment points',()=>{
    const {part,chain}=fixture('left'),start={x:240,y:846},end={x:-400,y:1600};
    const early=createLimbWarp(part,chain,start,end,{wave:70,travel:.25});
    const late=createLimbWarp(part,chain,start,end,{wave:70,travel:.75});
    assert.deepEqual(early.start,late.start);assert.deepEqual(early.end,late.end);
    assert.notDeepEqual(early.strips,late.strips);
    assert.deepEqual(early,createLimbWarp(part,chain,start,end,{wave:70,travel:.25}));
});
