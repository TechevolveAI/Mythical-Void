const fs=require('fs');
const path=require('path');
const read=name=>fs.readFileSync(path.join(__dirname,'../systems',name),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const Encounter=new Function(`${read('TrumptopusEncounter.js')}\nreturn TrumptopusEncounter;`)();
const {FinalVoidApproach:Approach,FINAL_VOID_APPROACH:route}=new Function('TrumptopusEncounter',`${read('FinalVoidApproach.js')}\nreturn {FinalVoidApproach,FINAL_VOID_APPROACH};`)(Encounter);
const until=(model,predicate,x=640)=>{for(let i=0;i<2000&&!predicate(model);i++)model.update(20,x);expect(predicate(model)).toBe(true);};

test('safe arrival does not start attacks before the first grip is approached',()=>{
    const model=new Approach();for(let i=0;i<500;i++)model.update(50,220);
    expect(model.state).toBe('travel');expect(model.consumeContact(true)).toBe(false);
    expect(model.hit(100)).toBe(false);expect(model.clearedGrips).toBe(0);
});

test('an exposed physical counter and a settled road are both required before crossing is saved',()=>{
    const model=new Approach();until(model,m=>m.snapshot().vulnerable);
    expect(model.targetX).toBe(640);expect(model.hit(2)).toBe(true);
    until(model,m=>m.mode==='settling');expect(model.clearedGrips).toBe(0);
    for(let i=0;i<10;i++)model.update(50,640);
    expect(model.snapshot().progress).toBeGreaterThan(0);expect(model.clearedGrips).toBe(0);
    until(model,m=>m.clearedGrips===1);expect(model.state).toBe('travel');
    expect(new Approach(model.checkpoint()).spawnX).toBe(1090);
});

test('pause and disposal stop contact, road motion and progression',()=>{
    const model=new Approach();until(model,m=>m.snapshot().vulnerable);model.hit(2);until(model,m=>m.mode==='settling');
    model.setPaused(true);const before=model.snapshot();model.update(9000,1800);
    expect(model.snapshot()).toEqual(before);expect(model.consumeContact(true)).toBe(false);
    model.setPaused(false);model.dispose();model.update(9000,1800);
    expect(model.clearedGrips).toBe(0);expect(model.hit(2)).toBe(false);
});

test('the second lesson stays local and arrival requires the safe grounded threshold',()=>{
    const model=new Approach({schemaVersion:1,clearedGrips:1,arrived:false});
    model.update(20,1400);expect(model.state).toBe('travel');
    until(model,m=>m.snapshot().vulnerable,1810);expect(model.targetX).toBe(1810);
    model.hit(2);until(model,m=>m.clearedGrips===2,1810);
    expect(model.arrive(route.exitX,false)).toBe(false);expect(model.arrive(2300,true)).toBe(false);
    expect(model.arrive(NaN,true)).toBe(false);expect(model.arrive(Infinity,true)).toBe(false);
    expect(model.arrive(route.exitX,true)).toBe(true);expect(model.checkpoint().arrived).toBe(true);
});

test('the first recovery ledge leaves a clear rising column before the upper platform',()=>{
    const recovery=route.recoverySteps[0], upper=route.surfaces[2], previous=route.surfaces[1];
    const launchX=1260,bodyHalfWidth=16;
    expect(launchX-bodyHalfWidth).toBeGreaterThan(previous.x+previous.width);
    expect(upper.x-(launchX+bodyHalfWidth)).toBeGreaterThanOrEqual(90);
    expect(recovery.dy-upper.dy).toBeLessThanOrEqual(120);
    expect(recovery.x).toBeLessThan(launchX-bodyHalfWidth);
    expect(recovery.x+recovery.width).toBeGreaterThan(launchX+bodyHalfWidth);
});

test('invalid saved route versions fail without guessing a new identity or position',()=>{
    for(const value of [{schemaVersion:9,clearedGrips:1,arrived:false},{schemaVersion:1,clearedGrips:0,arrived:true},{schemaVersion:1,clearedGrips:3,arrived:false}]) {
        expect(()=>new Approach(value)).toThrow('checkpoint');
    }
});
