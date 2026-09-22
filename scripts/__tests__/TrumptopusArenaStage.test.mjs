import {test} from 'node:test';
import assert from 'node:assert/strict';
import Stage from '../../src/dev/TrumptopusArenaStage.js';
import {packStoneSurfaces} from '../../src/dev/TrumptopusStoneMaterial.js';

function fixture() {
    const stage=Object.create(Stage.prototype);
    const sprite={depth:688,setPosition(x,y){this.x=x;this.y=y;return this;},
        setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
        setVisible(v){this.visible=v;return this;},setTint(t){this.tint=t;return this;}};
    const object={visible:false,body:{left:4,top:630,width:56,height:20,enable:false}};
    Object.assign(stage,{layout:{floorY:600},floor:{depth:689},props:[{name:'rising-foothold',object,sprite}]});
    return {stage,object,sprite};
}

test('source-stone prop atlas adds less than 32 KiB of RGBA for the actual bodies',()=>{
    const atlas=packStoneSurfaces([{width:36,height:84},{width:56,height:20}]);
    assert(atlas.rgbaBytes<32*1024);
    assert.deepEqual(atlas.frames.map(({width,height})=>({width,height})),[{width:36,height:84},{width:56,height:20}]);
});

test('foothold art follows the actual body through burial, lift and settlement',()=>{
    const {stage,object,sprite}=fixture();
    for(const [top,enabled,visibleHeight] of [[630,false,0],[600,false,0],[590,false,10],[524,true,20]]){
        Object.assign(object.body,{top,enable:enabled});stage.syncProps();
        const evidence=stage.getPropEvidence()[0];
        assert.deepEqual(evidence.art,evidence.collision);
        assert.equal(evidence.aboveFloor,visibleHeight);
        assert.equal(evidence.visible,visibleHeight>0);
        assert(evidence.sourceHidden&&evidence.floorOccludesBuriedSection);
        assert.equal(object.body.enable,enabled,'Presentation changed the collision policy');
        assert.equal(sprite.tint,enabled?0xc1cad0:0x89949e);
    }
});

test('exit stone disappears below the real floor and evidence detects an art offset',()=>{
    const {stage,object,sprite}=fixture();object.body.height=84;
    for(const top of [516,560,599,600,640]){
        object.body.top=top;stage.syncProps();
        assert.equal(sprite.visible,top<600);
        assert.equal(stage.getPropEvidence()[0].aboveFloor,Math.max(0,Math.min(84,600-top)));
    }
    sprite.y+=1;
    assert.notEqual(stage.getPropEvidence()[0].art.top,stage.getPropEvidence()[0].collision.top);
});

test('shutdown removes only owned stage textures once and late draws are harmless',()=>{
    const {stage}=fixture(),removed=[];let destroyed=0;
    Object.assign(stage,{objects:[{destroy:()=>destroyed++}],keys:['trumptopus-stage-props'],
        scene:{textures:{remove:key=>removed.push(key)}}});
    stage.destroy();stage.destroy();stage.syncProps();stage.drawEdge(1);stage.drawTear(1);
    assert.equal(destroyed,1);assert.deepEqual(removed,['trumptopus-stage-props']);
    assert.deepEqual(stage.getPropEvidence(),[]);
});

test('tear is hidden outside banishment and uses the bounded authored opening',()=>{
    const {stage}=fixture(),tear={setVisible(v){this.visible=v;return this;},
        setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;}};
    stage.tear=tear;stage.drawTear(1);
    assert.deepEqual([tear.visible,tear.displayWidth,tear.displayHeight],[true,164,288]);
    stage.drawTear(.5);assert.equal(tear.displayWidth,82);assert.equal(tear.displayHeight,144);
    stage.drawTear(0);assert.equal(tear.visible,false);
});
