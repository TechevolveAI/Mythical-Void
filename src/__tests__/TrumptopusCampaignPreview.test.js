const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../dev/TrumptopusCampaignPreview.js'),'utf8')
    .replace(/^import .*;$/gm,'').replace('export default class','class');

function setup() {
    const calls=[];
    const completion={run:{status:'fighting'},checkpoint:()=>({schemaVersion:1,encounterId:'trumptopus',phaseIndex:1}),
        saveProgress:jest.fn(),observe:jest.fn(),advance:jest.fn(),present:jest.fn()};
    class Super {
        createEncounter(data){return {data,paused:false,disposed:false,state:'combat'};}
        resolveBossHit(){calls.push('hit');return true;}
        update(){calls.push('update');}
        setPrototypePaused(value){this.encounter.paused=value;}
    }
    const Preview=new Function('TrumptopusFinalePreview','TrumptopusCompletion',`${source}\nreturn TrumptopusCampaignPreview;`)(Super,function(){return completion;});
    const scene=new Preview();scene.encounter=scene.createEncounter({});
    return {scene,completion,calls};
}

test('new fight resumes its saved phase and committed wins never restart combat',()=>{
    const {scene,completion}=setup();
    expect(scene.encounter.data).toMatchObject({checkpoint:{phaseIndex:1},completed:false});
    completion.run.status='won';
    expect(scene.createEncounter({}).data.completed).toBe(true);
});

test('real accepted attack persists immediately, without waiting for another frame',()=>{
    const {scene,completion,calls}=setup();
    completion.observe.mockImplementation(()=>calls.push('persist'));
    scene.resolveBossHit(2,{source:'katana'});
    expect(calls).toEqual(['hit','persist']);
});

test('pause records progress and does not count paused frames as active play',()=>{
    const {scene,completion}=setup();
    scene.update(0,16);scene.setPrototypePaused(true);scene.update(16,16);
    expect(completion.advance).toHaveBeenCalledTimes(1);
    expect(completion.saveProgress).toHaveBeenCalledTimes(1);
});

test('result waits for both the end of banishment and grounded recovery',()=>{
    const {scene,completion}=setup();
    scene.encounter.state='banishment';scene.isGrounded=true;scene.update(0,16);
    scene.encounter.state='aftermath';scene.isGrounded=false;scene.update(16,16);
    expect(completion.present).not.toHaveBeenCalled();
    scene.isGrounded=true;scene.update(32,16);
    expect(completion.present).toHaveBeenCalledTimes(1);
    completion.panel={};scene.update(48,16);
    expect(completion.present).toHaveBeenCalledTimes(1);
});
