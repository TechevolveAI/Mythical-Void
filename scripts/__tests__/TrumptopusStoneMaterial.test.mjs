import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packStoneSurfaces,stoneCrop,STONE_SOURCE} from '../../src/dev/TrumptopusStoneMaterial.js';
import {FINAL_VOID_APPROACH} from '../../src/systems/FinalVoidApproach.js';

const surfaces=[{width:FINAL_VOID_APPROACH.width,height:60},
    ...[...FINAL_VOID_APPROACH.surfaces,...FINAL_VOID_APPROACH.recoverySteps].map(s=>({width:s.width,height:32})),
    ...FINAL_VOID_APPROACH.grips.map(s=>({width:s.bridgeWidth,height:32}))];

test('all real approach surfaces fit an atlas below 2 MiB without rescaling or overlap',()=>{
    const atlas=packStoneSurfaces(surfaces);
    assert.equal(atlas.frames.length,15);assert(atlas.rgbaBytes<2*1024*1024);
    for(const [index,frame] of atlas.frames.entries()) {
        assert.equal(frame.width,surfaces[index].width);assert.equal(frame.height,surfaces[index].height);
        assert(frame.x>=2&&frame.y>=2&&frame.x+frame.width+2<=atlas.width&&frame.y+frame.height+2<=atlas.height);
        for(const other of atlas.frames.slice(index+1)) {
            const separate=frame.x+frame.width+4<=other.x||other.x+other.width+4<=frame.x||
                frame.y+frame.height+4<=other.y||other.y+other.height+4<=frame.y;
            assert(separate,'Surface gutters overlap');
        }
    }
    assert.deepEqual(atlas,packStoneSurfaces(surfaces));
});

test('phone and desktop arena floor textures stay under 1 MiB',()=>{
    for(const width of [390,1280]){
        const atlas=packStoneSurfaces([{width,height:180}]);
        assert(atlas.rgbaBytes<1024*1024);assert.equal(atlas.frames[0].width,width);
        assert.equal(atlas.frames[0].height,180);
    }
});

test('every material sample stays inside character-free foreground, not the sky or gold pool',()=>{
    for(let i=0;i<40;i++)for(const width of [32,100,170,390,850,1280,2940]) {
        const crop=stoneCrop(width,i);
        assert(crop.x>=STONE_SOURCE.x&&crop.x+crop.width<=STONE_SOURCE.x+STONE_SOURCE.width);
        assert.equal(crop.y,936);assert.equal(crop.y+crop.height,1008);
        assert.deepEqual(crop,stoneCrop(width,i));
    }
});

test('invalid or unbounded atlases fail explicitly',()=>{
    for(const surfaces of [[],[{width:NaN,height:32}],[{width:0,height:32}],[{width:20.5,height:32}],
        [{width:4096,height:32}],[{width:20,height:2048}],Array.from({length:3},()=>({width:100,height:2040}))])
        assert.throws(()=>packStoneSurfaces(surfaces));
});
