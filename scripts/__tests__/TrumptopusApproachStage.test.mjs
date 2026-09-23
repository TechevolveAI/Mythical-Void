import {test} from 'node:test';
import assert from 'node:assert/strict';
import Stage,{approachClawTransform} from '../../src/dev/TrumptopusApproachStage.js';

const part={bounds:{x:60,y:1105},pivot:[128,1134],visible:{left:4,right:158,top:3,bottom:325}};

test('approach claw artwork covers the unchanged contact width and touches its bottom',()=>{
    for(const x of [570,640,710,1750,1890])for(const y of [0,200,403]) {
        const result=approachClawTransform(part,{x,y});
        const left=result.x+(part.bounds.x+part.visible.left-part.pivot[0])*result.scaleX;
        const right=result.x+(part.bounds.x+part.visible.right-part.pivot[0])*result.scaleX;
        const bottom=result.y+(part.bounds.y+part.visible.bottom-part.pivot[1])*result.scaleY;
        assert(Math.abs(left-(x-35))<1e-8);
        assert(Math.abs(right-(x+35))<1e-8);
        assert(Math.abs(bottom-(y+21))<1e-8);
        assert.deepEqual(result,approachClawTransform(part,{x,y}));
    }
});

test('art surface evidence reports actual art/collision agreement, not route constants',()=>{
    const stage=Object.create(Stage.prototype);
    Object.assign(stage,{keys:['a','b'],surfaces:[{platform:{body:{top:100,width:170}},sprite:{y:100,width:170}}]});
    assert.deepEqual(stage.getEvidence().surfaces,[{artTop:100,collisionTop:100,artWidth:170,collisionWidth:170}]);
    stage.surfaces[0].sprite.y=101;
    assert.notEqual(stage.getEvidence().surfaces[0].artTop,stage.getEvidence().surfaces[0].collisionTop);
});

test('approach owns and removes only its textures; shutdown and late updates are safe',()=>{
    const removed=[],stage=Object.create(Stage.prototype);let destroyed=0;
    Object.assign(stage,{keys:['trumptopus-approach-sky','trumptopus-approach-limb-motion'],
        objects:[{destroy:()=>destroyed++}],scene:{textures:{remove:key=>removed.push(key)}}});
    stage.destroy();stage.destroy();stage.update({},{});
    assert.equal(destroyed,1);
    assert.deepEqual(removed,stage.keys);
    assert(!removed.includes('trumptopus-source'));
});
