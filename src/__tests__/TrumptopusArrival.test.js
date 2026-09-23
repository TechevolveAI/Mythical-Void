const fs = require('fs');
const path = require('path');
const {EventEmitter} = require('events');
const source = fs.readFileSync(path.join(__dirname,'../ui/TrumptopusArrival.js'),'utf8')
    .replace(/^import .*;$/gm,'').replace('export class','class');
const Arrival = new Function(`${source}\nreturn TrumptopusArrival;`)();

function setup(state = 'prepared') {
    const listeners = new Set();
    const film = {state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
    const films = {getFilm:jest.fn(()=>film),prepare:jest.fn(()=>Promise.resolve()),watch:jest.fn(()=>true)};
    const scene = {events:new EventEmitter(),clearInput:jest.fn(),setPrototypePaused:jest.fn(),
        hidePlatformerMobileControls:jest.fn(),scene:{pause:jest.fn(),resume:jest.fn()}};
    const next=jest.fn();
    const cue=new Arrival(scene,{films,onContinue:next});
    return {cue,scene,films,film,listeners,next,change:value=>{film.state=value;listeners.forEach(fn=>fn());}};
}

describe('private finale arrival film cue',()=>{
    let proof;
    afterEach(()=>{proof?.cue.close();document.body.replaceChildren();});
    test('prefetches once during approach; absent/unapproved media adds no menu or pause',()=>{
        proof=setup();expect(proof.films.prepare).toHaveBeenCalledWith('arrival');
        proof.films.getFilm.mockReturnValue(null);
        expect(proof.cue.offer()).toBe(false);
        expect(proof.scene.scene.pause).not.toHaveBeenCalled();
        expect(document.querySelector('[role=dialog]')).toBeNull();
        const absent=new Arrival(proof.scene,{films:{getFilm:()=>null,prepare:()=>{throw Error('Must not fetch');}},onContinue:jest.fn()});
        expect(absent.offer()).toBe(false);absent.close();
    });
    test('Watch uses prepared film; Continue enters the fight once with no rewards or generation',()=>{
        proof=setup();const {cue,films,scene,next}=proof;
        expect(cue.offer()).toBe(true);expect(cue.offer()).toBe(true);
        expect(scene.scene.pause).toHaveBeenCalledTimes(1);
        expect(scene.setPrototypePaused).toHaveBeenCalledWith(true);
        expect(scene.hidePlatformerMobileControls).toHaveBeenCalledTimes(1);
        cue.watch.click();expect(cue.root.hidden).toBe(true);
        expect(films.watch).toHaveBeenCalledWith('arrival',expect.any(Object));
        films.watch.mock.calls[0][1].onClose();cue.continue();
        expect(next).toHaveBeenCalledTimes(1);
        expect(films.prepare).toHaveBeenCalledTimes(1);
    });
    test.each(['fetching','failed','disposed'])('film %s never traps the player',state=>{
        proof=setup(state);proof.cue.offer();
        expect(proof.cue.primary.disabled).toBe(false);
        proof.cue.primary.click();expect(proof.next).toHaveBeenCalledTimes(1);
    });
    test('failed preparation has explicit retry and late completion cannot reopen a closed cue',async()=>{
        proof=setup('failed');proof.cue.offer();
        expect(proof.cue.watch.textContent).toBe('Retry film');
        proof.cue.watch.click();expect(proof.films.prepare).toHaveBeenCalledTimes(2);
        proof.change('fetching');expect(proof.cue.watch.disabled).toBe(true);
        proof.change('prepared');expect(proof.cue.watch.disabled).toBe(false);
        proof.scene.events.emit('shutdown');proof.change('failed');await Promise.resolve();
        expect(proof.listeners.size).toBe(0);
        expect(document.querySelector('[role=dialog]')).toBeNull();
        expect(proof.scene.scene.resume).not.toHaveBeenCalled();
        expect(proof.cue.offer()).toBe(false);
    });
    test('scene start failure remains retryable after the film closes',()=>{
        proof=setup();proof.cue.offer();proof.cue.watch.click();proof.next.mockImplementationOnce(()=>{throw Error('Not ready');});
        proof.films.watch.mock.calls[0][1].onClose();
        expect(proof.cue.root.hidden).toBe(false);expect(proof.cue.primary.disabled).toBe(false);
        expect(proof.cue.notice.textContent).toContain('Please try again');
        proof.cue.primary.click();expect(proof.next).toHaveBeenCalledTimes(2);
    });
    test('Tab stays in the cue and Escape skips safely; shutdown ignores late close callbacks',()=>{
        proof=setup();proof.cue.offer();
        proof.cue.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab'}));
        expect(document.activeElement).toBe(proof.cue.watch);
        proof.cue.watch.click();proof.scene.events.emit('destroy');
        proof.films.watch.mock.calls[0][1].onClose();expect(proof.next).not.toHaveBeenCalled();
    });
    test('Escape continues without a second confirmation',()=>{
        proof=setup('fetching');proof.cue.offer();
        proof.cue.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
        expect(proof.next).toHaveBeenCalledTimes(1);
        expect(()=>proof.cue.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab'}))).not.toThrow();
    });
});
