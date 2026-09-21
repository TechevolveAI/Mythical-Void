const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../dev/TrumptopusApproachPreview.js'),'utf8')
    .replace(/^import .*;$/gm,'').replace('export default class','class');
const read=name=>fs.readFileSync(path.join(__dirname,'../systems',name),'utf8')
    .replace(/^import .*;$/gm,'').replace(/export /g,'');
const Encounter=new Function(`${read('TrumptopusEncounter.js')}\nreturn TrumptopusEncounter;`)();
const {FinalVoidApproach,FINAL_VOID_APPROACH}=new Function('TrumptopusEncounter',`${read('FinalVoidApproach.js')}\nreturn {FinalVoidApproach,FINAL_VOID_APPROACH};`)(Encounter);

function setup(width=390,height=802) {
    class Base {
        update() {}
        setPrototypePaused(value){this.encounter.setPaused(value);}
        updatePrototypeFollower(){this.combatFormation=true;}
    }
    const Preview=new Function('TrumptopusPrototypeLevel','FinalVoidApproach','FINAL_VOID_APPROACH',
        `${source}\nreturn TrumptopusApproachPreview;`)(Base,FinalVoidApproach,FINAL_VOID_APPROACH);
    const scene=new Preview();scene.scale={width,height};scene.configurePrototypeWorld();
    scene.encounter=new FinalVoidApproach({schemaVersion:1,clearedGrips:2,arrived:false});
    scene.lastSavedGrip=2;
    scene.completion={advance:jest.fn(),saveProgress:jest.fn(),saveApproach:jest.fn()};
    scene.player={x:2790,body:{bottom:scene.floorY}};scene.isGrounded=true;
    scene.clearInput=jest.fn();scene.scene={start:jest.fn()};
    return scene;
}

test.each([[390,802],[1280,678]])('same route geometry and solid recovery floor at %sx%s', (width,height)=>{
    const scene=setup(width,height);
    scene.createPlatform=jest.fn(()=>({}));scene.createPrototypeTerrain();
    expect(scene.levelWidth).toBe(2940);
    expect(scene.createPlatform.mock.calls[0]).toEqual([0,scene.floorY+140,2940,60,'solid']);
    expect(scene.createPlatform.mock.calls.every(call=>call[4]==='solid')).toBe(true);
    expect(scene.bridges).toHaveLength(2);
    expect(scene.floorY+200).toBeLessThan(height-90);
});

test('catch-floor or airborne arrival never skips the climb back to the road',()=>{
    const scene=setup();scene.player.body.bottom=scene.floorY+140;scene.update(0,16);
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene.player.body.bottom=scene.floorY;scene.isGrounded=false;scene.update(16,16);
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene.isGrounded=true;scene.update(32,16);scene.update(48,16);
    expect(scene.completion.saveApproach).toHaveBeenCalledTimes(1);
    expect(scene.completion.saveApproach).toHaveBeenCalledWith({schemaVersion:1,clearedGrips:2,arrived:true});
    expect(scene.scene.start).toHaveBeenCalledTimes(1);
    expect(scene.scene.start).toHaveBeenCalledWith('TrumptopusPrototype');
    expect(scene.clearInput).toHaveBeenCalledTimes(1);
});

test('paused approach neither adds active time nor enters the arena',()=>{
    const scene=setup();scene.setPrototypePaused(true);scene.update(0,16);
    expect(scene.completion.saveProgress).toHaveBeenCalledTimes(1);
    expect(scene.completion.advance).not.toHaveBeenCalled();
    expect(scene.scene.start).not.toHaveBeenCalled();
});

test('traversal uses the existing world trail; only a grip uses fixed combat formation',()=>{
    const scene=setup();
    scene.astronautFollower={setContextualFormation:jest.fn(),update:jest.fn()};
    scene.updatePrototypeFollower(16);
    expect(scene.astronautFollower.setContextualFormation).toHaveBeenCalledWith(null);
    expect(scene.astronautFollower.update).toHaveBeenCalledWith(16);
    expect(scene.astronautFollower.followDistance).toBe(170);
    scene.encounter.mode='grip';scene.updatePrototypeFollower(16);
    expect(scene.combatFormation).toBe(true);
    expect(scene.astronautFollower.update).toHaveBeenCalledTimes(1);
});
