const vm = require('node:vm');
const {sceneTextPoint} = require('../lib/trumptopus-campaign-proof.cjs');

function setup() {
    const scene = {input:{_list:[]},scale:{width:390,height:802},children:{list:[]},
        cameras:{main:{scrollX:0,scrollY:0,matrix:{transformPoint:(x,y)=>({x,y})}}}};
    const bounds = {left:100,right:220,top:600,bottom:640,centerX:160,centerY:620};
    const label = {scene,text:'CONTINUE',alpha:1,visible:true,depth:203,scrollFactorX:1,scrollFactorY:1,getBounds:()=>bounds};
    const zone = {input:{enabled:true},alpha:1,visible:true,getBounds:()=>bounds};
    scene.children.list.push(label);
    const window = {game:{scene:{getScenes:()=>[scene]},canvas:{getBoundingClientRect:()=>({left:0,top:42,width:390,height:802})}}};
    const locate = vm.runInNewContext(`(${sceneTextPoint.toString()})`,{window,innerWidth:390,innerHeight:844});
    return {locate,scene,label,zone};
}

test('does not click a new page label until its real hit area is live',()=>{
    const {locate,scene,zone}=setup();
    expect(locate('CONTINUE')).toBeNull();
    scene.input._list.push(zone);
    expect(locate('CONTINUE')).toEqual({x:160,y:662});
});

test('directly interactive labels must also finish input registration',()=>{
    const {locate,scene,label,zone}=setup();
    label.input={enabled:true};scene.input._list.push(zone);
    expect(locate('CONTINUE')).toBeNull();
    scene.input._list.push(label);
    expect(locate('CONTINUE')).not.toBeNull();
});

test('the real repair-board custom pointer regions remain supported',()=>{
    const {locate,scene}=setup();
    scene.shipEvidenceBoardModal={isVisible:true,pointerRegions:[{left:100,right:220,top:600,bottom:640}]};
    expect(locate('CONTINUE')).toEqual({x:160,y:662});
});

test('hidden or disabled controls are not treated as clickable',()=>{
    const {locate,scene,zone}=setup();scene.input._list.push(zone);
    zone.input.enabled=false;expect(locate('CONTINUE')).toBeNull();
    zone.input.enabled=true;zone.visible=false;expect(locate('CONTINUE')).toBeNull();
});
