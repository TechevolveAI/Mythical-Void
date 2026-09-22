import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trumptopusArenaLayout,chooseAllyLanding,allySweepLeapDuration,sampleAllyLeap,trumptopusBanishment} from '../../src/dev/TrumptopusPresentation.js';

test('phone and desktop leave the boss grounded above the player lane and below the HUD',()=>{
    for(const [w,h] of [[390,802],[1280,678]]){
        const layout=trumptopusArenaLayout(w,h);
        assert(layout.floorY<h-60);
        assert.equal(layout.floorY-layout.bossFloorY,160);
        assert(layout.bossFloorY-layout.bossHeight>=138);
        assert(layout.bossHeight>=280);
    }
});
test('the sweep resting on the old left formation moves the ally to a clear right slot',()=>{
    const x=chooseAllyLanding({width:390,player:{left:137,right:251},hands:[{left:43,right:113}],currentX:83});
    assert(x-25>=251+24);
    assert(x+25<=382);
});
test('a right-hand player has a separate middle slot rather than forcing the ally offscreen',()=>{
    const x=chooseAllyLanding({width:390,player:{left:239,right:351},hands:[{left:43,right:113}],currentX:180});
    assert(x-25>=113+24);assert(x+25<=239-24);
});
test('a genuinely full lane returns no landing, rather than weakening separation',()=>{
    assert.equal(chooseAllyLanding({width:390,player:{left:10,right:200},hands:[{left:200,right:390}],currentX:83}),null);
});
test('a sweep leap lands after the full claw has passed, on both viewport widths',()=>{
    for(const width of [390,1280]){
        const duration=allySweepLeapDuration({width,landingX:307,progress:.4});
        const remainingWindup=.6*1300;
        const sweepProgress=(duration-remainingWindup)/750;
        const palmX=width-78-(width-156)*Math.min(1,sweepProgress);
        assert(palmX+35<=307-25-24);
        const leap={fromX:83,toX:307,duration,floorY:622};
        assert.deepEqual(sampleAllyLeap({...leap,elapsed:0}),{x:83,footY:622,progress:0,landed:false});
        assert(sampleAllyLeap({...leap,elapsed:duration/2}).footY<622-180);
        assert.deepEqual(sampleAllyLeap({...leap,elapsed:duration}),{x:307,footY:622,progress:1,landed:true});
    }
});
test('banishment carries the intact boss into the tear instead of fading in place',()=>{
    const start=trumptopusBanishment(0),middle=trumptopusBanishment(.5),end=trumptopusBanishment(1);
    assert.equal(start.scale,1);assert(start.y===0);assert(start.visible);
    assert(middle.visible&&middle.scale<.7&&middle.y<-50&&middle.opening>0);
    assert(!end.visible&&end.opening===0&&end.release===1&&end.shadow===0);
    for(let i=0;i<=100;i++)assert.deepEqual(trumptopusBanishment(i/100),trumptopusBanishment(i/100));
});
