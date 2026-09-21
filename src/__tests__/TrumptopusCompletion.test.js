const fs = require('fs');
const path = require('path');
const {parse} = require('@babel/parser');
const {EventEmitter} = require('events');

function load(file, name, deps = {}) {
    const source = fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    const body = parse(source,{sourceType:'module'}).program.body.map(node => {
        if (node.type === 'ImportDeclaration') return '';
        if (node.type === 'ExportNamedDeclaration') return source.slice(node.declaration.start,node.declaration.end);
        return source.slice(node.start,node.end);
    }).join('\n');
    return new Function(...Object.keys(deps),`${body}\nreturn ${name};`)(...Object.values(deps));
}
const Result = load('ui/TrumptopusResult.js','TrumptopusResult');
const receipt = {partAwarded:true,coinsAwarded:2500,powerup:{name:'Super Blast',resultText:'Blast all nearby enemies',queued:false}};
function filmsFixture(initial = 'prepared') {
    const listeners = new Set();
    const film = {state:initial,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
    const change = state => {film.state=state;listeners.forEach(fn=>fn());};
    return {film,change,listeners,getFilm:jest.fn(()=>film),
        prepare:jest.fn(()=>{change('fetching');return Promise.resolve(true).then(()=>change('prepared'));}),
        watch:jest.fn(()=>true),dispose:jest.fn()};
}

describe('private finale compact result',()=>{
    let panel;
    afterEach(()=>{panel?.close();document.body.replaceChildren();});
    test('one visible next step; no Watch when there is no approved film',()=>{
        const next=jest.fn();
        panel=new Result({receipt,primaryLabel:'Repair the ship',onContinue:next});
        expect(panel.watch.hidden).toBe(true);
        expect(document.body.textContent).toContain('Recovered for the ship');
        expect(document.body.textContent).toContain('+2,500');
        expect(document.activeElement).toBe(panel.primary);
        panel.primary.click(); panel.primary.click();
        expect(next).toHaveBeenCalledTimes(1);
    });
    test('only a prepared film offers Watch; failure has explicit retry, never automatic generation',async()=>{
        const films=filmsFixture('failed');
        panel=new Result({receipt,primaryLabel:'Repair the ship',onContinue:jest.fn(),films});
        expect(films.prepare).not.toHaveBeenCalled();
        expect(panel.watch.textContent).toBe('Retry film');
        expect(panel.primary.disabled).toBe(false);
        panel.watch.click();
        expect(panel.watch.disabled).toBe(true);
        await Promise.resolve();
        expect(panel.watch.textContent).toBe('Watch');
        panel.watch.click();
        expect(films.watch).toHaveBeenCalledTimes(1);
        expect(panel.root.hidden).toBe(true);
        films.watch.mock.calls[0][1].onClose();
        expect(panel.root.hidden).toBe(false);
        expect(document.activeElement).toBe(panel.primary);
    });
    test('preparation does not block repair and closed panels ignore late film callbacks',async()=>{
        const films=filmsFixture('absent');
        panel=new Result({receipt,primaryLabel:'Repair the ship',onContinue:jest.fn(),films});
        expect(films.prepare).toHaveBeenCalledTimes(1);
        expect(panel.primary.disabled).toBe(false);
        panel.close(); await Promise.resolve();
        expect(films.listeners.size).toBe(0);
        expect(document.querySelector('[role=dialog]')).toBeNull();
    });
    test('denied storage and queued rewards are explained without hiding the exit',()=>{
        panel=new Result({receipt:{...receipt,powerup:{...receipt.powerup,queued:true}},persisted:false,
            primaryLabel:'Repair the ship',onContinue:()=>{throw Error('Scene is not available');}});
        expect(panel.notice.textContent).toContain('Keep this tab open');
        expect(panel.root.textContent).toContain('until your inventory has room');
        panel.primary.click();
        expect(panel.primary.disabled).toBe(false);
        expect(panel.notice.textContent).toContain('Please try again');
    });
    test('keyboard focus stays in visible controls',()=>{
        panel=new Result({receipt,primaryLabel:'Repair the ship',onContinue:jest.fn(),films:filmsFixture()});
        panel.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));
        expect(document.activeElement).toBe(panel.watch);
        panel.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,shiftKey:true}));
        expect(document.activeElement).toBe(panel.primary);
    });
});

describe('private finale outcome to existing ending adapter',()=>{
    let scene, films, run, deps, Completion, createPanel, gameState;
    beforeEach(()=>{
        run={schemaVersion:1,sequence:1,phaseIndex:0,status:'fighting',receipt:null};
        scene={events:new EventEmitter(),clearInput:jest.fn(),enterLevelCompletionState:jest.fn(),scene:{start:jest.fn()},levelStartTime:Date.now()-5000};
        films=filmsFixture();
        createPanel=jest.fn(()=>({close:jest.fn()}));
        gameState={storageMode:'local',get:jest.fn(()=>[])};
        deps={
            beginTrumptopusRun:jest.fn(()=>({run:{...run},persisted:false})),
            checkpointTrumptopusRun:jest.fn((_,sequence,phaseIndex)=>{run={...run,phaseIndex};}),
            getTrumptopusRun:()=>({...run}),
            recordTrumptopusVictory:jest.fn(()=>{run={...run,status:'won',receipt};return {changed:true,persisted:false,receipt};}),
            getCampaignFinaleRecovery:jest.fn(()=>({status:'repair'}))
        };
        Completion=load('systems/TrumptopusCompletion.js','TrumptopusCompletion',deps);
    });
    const encounter=state=>({snapshot:()=>state});
    function win(controller) {
        controller.observe(encounter({phaseIndex:1}));
        controller.observe(encounter({phaseIndex:2,completionReady:true}));
    }
    test('records at the final strike once, presents after recovery, continues once',()=>{
        const controller=new Completion(scene,{gameState,films,createPanel});
        expect(controller.checkpoint().phaseIndex).toBe(0);
        win(controller); controller.observe(encounter({phaseIndex:2,completionReady:true}));
        expect(deps.recordTrumptopusVictory).toHaveBeenCalledTimes(1);
        expect(scene.enterLevelCompletionState).not.toHaveBeenCalled();
        expect(controller.present()).toBe(true); expect(controller.present()).toBe(false);
        expect(createPanel.mock.calls[0][0]).toMatchObject({receipt,persisted:false,primaryLabel:'Repair the ship'});
        createPanel.mock.calls[0][0].onContinue(); controller.continue();
        expect(scene.scene.start).toHaveBeenCalledTimes(1);
        expect(scene.scene.start).toHaveBeenCalledWith('GameScene',{biome:'nebula',continueFinaleAfterRepair:true});
        scene.events.emit('shutdown'); scene.events.emit('destroy');
        expect(films.dispose).toHaveBeenCalledTimes(1);
        expect(controller.present()).toBe(false);
    });
    test.each([['ending','Finish the story',true],[null,'Return to Sanctuary',false]])('resume won result with %s state without re-awarding', (status,label,continuation)=>{
        run={...run,phaseIndex:2,status:'won',receipt};
        deps.getCampaignFinaleRecovery.mockReturnValue(status?{status}:null);
        const controller=new Completion(scene,{gameState,films,createPanel});
        controller.observe(encounter({phaseIndex:2,completionReady:true})); controller.present();
        expect(deps.recordTrumptopusVictory).not.toHaveBeenCalled();
        expect(createPanel.mock.calls[0][0]).toMatchObject({primaryLabel:label,persisted:false});
        controller.continue();
        expect(scene.scene.start).toHaveBeenCalledWith('GameScene',{biome:'nebula',continueFinaleAfterRepair:continuation});
        controller.dispose();
    });
    test('a failed next-scene handoff is retryable',()=>{
        const controller=new Completion(scene,{gameState,films,createPanel}); win(controller);
        scene.scene.start.mockImplementationOnce(()=>{throw Error('Unavailable');});
        expect(()=>controller.continue()).toThrow('Unavailable');
        expect(controller.continue()).toBe(true);
        controller.dispose();
    });
});
