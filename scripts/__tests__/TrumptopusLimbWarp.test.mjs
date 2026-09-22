import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUTOUT_PARTS, ARM_CHAINS, partBounds } from '../../src/dev/TrumptopusCutoutData.js';
import { createLimbWarp, attackLimbShape } from '../../src/dev/TrumptopusLimbWarp.js';

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

test('attack shape transfers its stored load outwards and returns without a state-boundary pop',()=>{
    for(const span of [310,900,2800,4800]){
        const shape=(state,p,e=1)=>attackLimbShape(state,p,span,e);
        for(const [from,to] of [['windup','strike'],['strike','contact'],['contact','exposed'],['exposed','recoil']]){
            const a=shape(from,1),b=shape(to,0);
            for(const key of Object.keys(a))assert(Math.abs(a[key]-b[key])<1e-10,`${from} -> ${to}: ${key}`);
        }
        assert(shape('recoil',0).wave===0);
        assert(Math.abs(shape('recoil',1,0).wave)<1e-10);
        assert(shape('strike',.2).travel<shape('strike',.8).travel);
        assert(shape('recoil',.2).travel>shape('recoil',.8).travel);
        assert(shape('windup',1).wave>0);
        assert(shape('recoil',.5,.5).wave<0);
    }
});

test('articulated attack preserves joint positions and tangents while tapering the middle',()=>{
    for(const side of ['left','right']){
        const {part,chain}=fixture(side),start={x:chain.elbow[0],y:chain.elbow[1]};
        const end={x:side==='left'?-2800:3400,y:1700};
        const options={tipScale:2.5,startAngle:.12,endAngle:-.08};
        const straight=createLimbWarp(part,chain,start,end,options);
        const bent=createLimbWarp(part,chain,start,end,{...options,articulation:1,wave:120,travel:.4});
        for(const key of ['start','end']){
            assert(Math.abs(straight[key].x-bent[key].x)<1e-8);
            assert(Math.abs(straight[key].y-bent[key].y)<1e-8);
            assert(Math.abs(straight[key].angle-bent[key].angle)<1e-8);
        }
        assert.notDeepEqual(straight.centreline,bent.centreline);
        const sourceY=(chain.elbow[1]+chain.wrist[1])/2-part.bounds.y;
        const nearest=result=>result.strips.flatMap(s=>[{y:s.source[0].y,points:s.destination.slice(0,2)}])
            .sort((a,b)=>Math.abs(a.y-sourceY)-Math.abs(b.y-sourceY))[0];
        const width=row=>Math.hypot(row.points[1].x-row.points[0].x,row.points[1].y-row.points[0].y);
        assert(width(nearest(bent))<width(nearest(straight))*.8);
        assert(bent.strips.length>straight.strips.length);
    }
});

test('long attack curves are bounded, finite and deterministic through loading and recovery',()=>{
    for(const side of ['left','right'])for(const span of [310,900,2800,4800]){
        const {part,chain}=fixture(side),start={x:chain.elbow[0],y:chain.elbow[1]};
        const end={x:start.x+(side==='left'?-span:span),y:1700};
        for(const state of ['windup','strike','contact','exposed','recoil'])for(let i=0;i<=20;i++){
            const p=i/20,e=state==='windup'?p:state==='recoil'?1-p:1;
            const shape=attackLimbShape(state,p,span,e);
            const geometry=createLimbWarp(part,chain,start,end,{...shape,tipScale:2.5});
            assert.deepEqual(shape,attackLimbShape(state,p,span,e));
            assert(Math.abs(shape.wave)<=145);
            for(const point of geometry.strips.flatMap(s=>s.destination)){
                assert(Number.isFinite(point.x)&&Number.isFinite(point.y));
                assert(point.x>=Math.min(start.x,end.x)-500&&point.x<=Math.max(start.x,end.x)+500);
                assert(point.y>=Math.min(start.y,end.y)-500&&point.y<=Math.max(start.y,end.y)+500);
            }
        }
    }
});
