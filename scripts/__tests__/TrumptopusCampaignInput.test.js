const vm = require('node:vm');
const {assertCampaignRewardsUnchanged}=require('../lib/trumptopus-campaign-proof.cjs');
const {sceneTextPoint,createCampaignProofHtml,completeCampaignEnding,ENDING_CHOICES,inspectEndingLayout,seedPriorCampaignRoutes} = require('../lib/trumptopus-campaign-proof.cjs');

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

test('ending recovery allows recorded achievement coins, never duplicate finale rewards',()=>{
    const before={coins:2503,achievementCoins:0,items:[{id:'super_blast',quantity:1}],run:{status:'won',receipt:'one'}};
    const after={...before,coins:2653,achievementCoins:150};
    expect(()=>assertCampaignRewardsUnchanged(before,after)).not.toThrow();
    expect(()=>assertCampaignRewardsUnchanged(before,{...after,coins:5153})).toThrow();
    expect(()=>assertCampaignRewardsUnchanged(before,{...after,run:{status:'won',receipt:'two'}})).toThrow();
    expect(()=>assertCampaignRewardsUnchanged(before,{...after,items:[{id:'super_blast',quantity:2}]})).toThrow();
});

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

test('all three real priorities are covered, and an invalid choice fails before browser actions',async()=>{
    expect(Object.keys(ENDING_CHOICES)).toEqual(['remain_and_defend','prepare_homecoming','prepare_first_contact']);
    await expect(completeCampaignEnding({},'','',{priority:'invalid'})).rejects.toThrow('Unknown ending priority');
});

test('seeded victory is opt-in, labelled, and cannot claim approach gameplay',()=>{
    const ordinary=createCampaignProofHtml();
    expect(ordinary).not.toContain('recordTrumptopusVictory(state');
    const ending=createCampaignProofHtml({seededVictory:true});
    expect(ending).toContain('PRIVATE / ENDING FIXTURE');
    expect(ending).toContain('checkpointTrumptopusRun(state,run.sequence,1');
    expect(ending).toContain('checkpointTrumptopusRun(state,run.sequence,2');
    expect(ending).toContain('if(!saved)');
    expect(()=>createCampaignProofHtml({approach:true,seededVictory:true})).toThrow('must not imply approach');
});

test('ending layout check detects real clipping and text overlap, ignoring hidden text',()=>{
    const text=(value,left,top,right,bottom,visible=true)=>({type:'Text',text:value,active:true,visible,alpha:1,
        getBounds:()=>({left,right,top,bottom})});
    const scene={scale:{width:390,height:802},elements:[text('title',30,30,300,60),text('body',30,100,300,200)]};
    const inspect=vm.runInNewContext(`(${inspectEndingLayout.toString()})`,{window:{game:{scene:{getScene:()=>scene}}}});
    expect(inspect().clipped).toEqual([]);expect(inspect().overlaps).toEqual([]);
    scene.elements.push(text('offscreen',350,220,410,240),text('overlap',60,40,200,80),text('hidden',0,0,900,900,false));
    expect(inspect().clipped.map(t=>t.text)).toEqual(['offscreen']);
    expect(inspect().overlaps).toEqual([['title','overlap']]);
});

test('earlier-level fixture uses real save IDs, including cosmicReef, rather than presentation aliases',()=>{
    const fs=require('node:fs'),path=require('node:path'),{parse}=require('@babel/parser');
    const source=fs.readFileSync(path.join(__dirname,'../../src/systems/CampaignJourneyGuide.js'),'utf8');
    const declaration=parse(source,{sourceType:'module'}).program.body.find(node=>node.type==='VariableDeclaration'&&
        node.declarations.some(item=>item.id.name==='CAMPAIGN_ROUTE'));
    const routes=vm.runInNewContext(`${source.slice(declaration.start,declaration.end)};CAMPAIGN_ROUTE;`);
    const state={set:jest.fn()};seedPriorCampaignRoutes(state,routes);
    expect(state.set.mock.calls).toEqual([
        ['levels.mythicalForest.completed',true],['levels.crystalCaves.completed',true],
        ['levels.cosmicReef.completed',true],['levels.voidPeaks.completed',true],
        ['levels.auroraDepths.completed',true],['stats.levelsCompleted',5]
    ]);
    expect(()=>seedPriorCampaignRoutes(state,routes.slice(0,-1))).toThrow('canonical final route');
});
