import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VOID_TEAR_TEXTURE,VOID_TEAR_SOURCE,VOID_TEAR_EDGE,voidTearDimensions,paintVoidTear}
    from '../../src/dev/TrumptopusVoidTearMaterial.js';

test('tear crop excludes the supplied character and texture stays below 256 KiB',()=>{
    const s=VOID_TEAR_SOURCE,t=VOID_TEAR_TEXTURE;
    assert(s.x>=510&&s.x+s.width<=1344&&s.y>=0&&s.y+s.height<=1008);
    assert(t.width*t.height*4<256*1024);
    for(const [x,y] of VOID_TEAR_EDGE)assert(x>=8&&x<t.width-8&&y>=8&&y<t.height-8);
});

test('opening is bounded, closed at zero and does not alter its centre',()=>{
    assert.deepEqual(voidTearDimensions(0),{visible:false,width:0,height:0});
    assert.deepEqual(voidTearDimensions(1),{visible:true,width:164,height:288});
    assert.deepEqual(voidTearDimensions(-1),voidTearDimensions(0));
    assert.deepEqual(voidTearDimensions(2),voidTearDimensions(1));
    for(const invalid of [NaN,Infinity,undefined])assert.throws(()=>voidTearDimensions(invalid));
});

test('material bakes supplied pixels once without a closed stroke or generated frame',()=>{
    const draws=[],strokes=[],ctx={save(){},restore(){},beginPath(){},moveTo(){},quadraticCurveTo(){},
        closePath(){},clip(){},drawImage(...args){draws.push(args);},fillRect(){},fill(){},
        stroke(){strokes.push(true);},createLinearGradient(){return {addColorStop(){}};}};
    const canvas={getContext:()=>ctx},source={id:'supplied-landscape'};
    const evidence=paintVoidTear(canvas,source);
    assert.equal(draws.length,1);assert.equal(draws[0][0],source);assert.deepEqual(strokes,[]);
    assert.equal(evidence.rgbaBytes,192*320*4);assert.equal(evidence.closedOutline,false);
    assert.equal(ctx.shadowBlur,0);
});
