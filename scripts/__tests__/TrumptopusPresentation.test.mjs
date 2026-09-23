import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trumptopusArenaLayout,chooseAllyLanding,anticipatedPlayerBounds,constrainAllyStrike,allySweepLeapDuration,sampleAllyLeap,trumptopusBanishment} from '../../src/dev/TrumptopusPresentation.js';
import {ARM_CHAINS,CUTOUT_REFERENCE} from '../../src/dev/TrumptopusCutoutData.js';

test('phone and desktop leave the boss grounded above the player lane and below the HUD',()=>{
    for(const [w,h] of [[390,802],[1280,678]]){
        const layout=trumptopusArenaLayout(w,h);
        assert(layout.floorY<h-60);
        assert.equal(layout.floorY-layout.bossFloorY,w>=900?96:160);
        assert(layout.bossFloorY-layout.bossHeight>=138);
        assert(layout.bossHeight>=280);
    }
});
test('closer staging leaves the existing phone layout and playable desktop floor unchanged',()=>{
    assert.deepEqual(trumptopusArenaLayout(390,802),{floorY:622,bossFloorY:462,bossX:280.8,bossHeight:300.3});
    const wide=trumptopusArenaLayout(1280,678);
    assert.equal(wide.floorY,606);assert.equal(wide.bossX,640);
    assert.equal(wide.bossHeight,372);assert.equal(wide.bossFloorY-wide.bossHeight,138);
});
test('landscape phones keep a readable boss and ground above the touch dock',()=>{
    for(const [width,height] of [[844,390],[800,360],[932,430]]) {
        const dockTop=height-148;
        const layout=trumptopusArenaLayout(width,height,{dockTop});
        assert(layout.floorY<=dockTop-8);
        assert(layout.bossHeight>=160);
        assert(layout.bossFloorY-layout.bossHeight>=32);
        assert.equal(layout.floorY-layout.bossFloorY,8);
    }
});
test('wide-screen staging reduces the worst possible rear-elbow to contact span, not the attack reach',()=>{
    const width=1280,current=trumptopusArenaLayout(width,678);
    const old={floorY:606,bossFloorY:446,bossX:921.6,bossHeight:308};
    const maximumSpan=layout=>{
        const scale=layout.bossHeight/(CUTOUT_REFERENCE.floor-51);
        return Math.max(...ARM_CHAINS.flatMap(chain=>[78,width-78].map(x=>{
            const elbowX=layout.bossX+(chain.elbow[0]-640)*scale;
            const elbowY=layout.bossFloorY+(chain.elbow[1]-CUTOUT_REFERENCE.floor)*scale;
            return Math.hypot(x-elbowX,layout.floorY-104-elbowY);
        })));
    };
    assert(maximumSpan(current)<maximumSpan(old)*.8);
    assert.equal(current.floorY,old.floorY);
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
test('a vault aims beyond the current position without predicting outside the canvas',()=>{
    const player={left:140,right:250};
    assert.deepEqual(anticipatedPlayerBounds(player,300,390),{left:245,right:355});
    assert.deepEqual(anticipatedPlayerBounds(player,-300,390),{left:35,right:145});
    assert.deepEqual(anticipatedPlayerBounds(player,900,390),{left:272,right:382});
    assert.deepEqual(anticipatedPlayerBounds(player,0,390),player);
});
test('the katana lunge reserve does not reduce the required 24px player gap',()=>{
    const player={left:137,right:251};
    const x=chooseAllyLanding({width:390,player,hands:[{left:43,right:113}],currentX:83,playerGap:54});
    assert(x-25-30>=player.right+24);
    assert(x+25<=382);
});
test('cosmetic lunges stop at the screen edge without changing attack timing or damage',()=>{
    assert.equal(constrainAllyStrike(398,{side:'right',player:{left:110,right:220},width:390}),360);
    assert.equal(constrainAllyStrike(-5,{side:'left',player:{left:110,right:220},width:390}),30);
});
test('a lunge cannot consume the 24px gap, and cannot jump to the opposite flank',()=>{
    const player={left:110,right:220};
    assert.equal(constrainAllyStrike(90,{side:'left',player,width:390}),56);
    assert.equal(constrainAllyStrike(250,{side:'right',player,width:390}),274);
    assert.equal(constrainAllyStrike(40,{side:'left',player:{left:45,right:300},width:390}),null);
});
test('a flank vault rises before crossing and finishes sideways movement before landing',()=>{
    const leap={fromX:50,toX:330,duration:900,floorY:622};
    const rising=sampleAllyLeap({...leap,elapsed:180});
    assert.equal(rising.x,50);assert(rising.footY<622-150);
    const descending=sampleAllyLeap({...leap,elapsed:630});
    assert.equal(descending.x,330);assert(descending.footY<622-150);
});
test('the sweep vault clears the observed simultaneous jump and stays below the HUD',()=>{
    const sample=sampleAllyLeap({fromX:33.01,toX:315.43,elapsed:1200,duration:1721.97,height:400,floorY:606});
    assert(sample.footY<=309.66-24);
    const descending=sampleAllyLeap({fromX:35.69,toX:315.29,elapsed:1266.61,duration:1738.71,height:400,floorY:606});
    assert(descending.x-22>=258.3+24);
    for(const floorY of [606,622]){
        const peak=sampleAllyLeap({fromX:33,toX:315,elapsed:500,duration:1000,height:400,floorY});
        assert(peak.footY-68>=138);
    }
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
