import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {startBanishmentCapture} from '../lib/trumptopus-banishment-proof.cjs';

function fixture() {
    const events=new EventEmitter();
    let state={mode:'combat',progress:0};
    const scene={encounter:{snapshot:()=>state},getProofState:()=>({sourceArtRig:{progress:state.progress}})};
    const game={events,canvas:{width:390,height:802,toDataURL:()=>`data:image/png;base64,frame-${state.progress}`}};
    const capture=startBanishmentCapture({game,getScene:()=>scene});
    return {capture,events,render:(mode,progress)=>{state={mode,progress};events.emit('postrender');}};
}

test('all four rendered states remain available to a late consumer after aftermath',()=>{
    const {capture,events,render}=fixture();
    render('combat',.95);
    assert.equal(capture.frames.length,0);
    for(const p of [.255,.56,.825,.945])render('banishment',p);
    render('aftermath',0);
    assert.equal(capture.error,null);
    assert.deepEqual(capture.frames.map(f=>f.target),[.25,.55,.82,.94]);
    for(const frame of capture.frames){
        assert.equal(frame.progress,frame.rig.progress);
        assert.equal(frame.png,`frame-${frame.progress}`);
        assert.equal(frame.width,390);assert.equal(frame.height,802);
    }
    assert.equal(events.listenerCount('postrender'),0);
    capture.dispose();assert.equal(events.listenerCount('postrender'),0);
});

test('a skipped phase is rejected instead of relabelling a later frame',()=>{
    const {capture,events,render}=fixture();
    render('banishment',.56);
    assert.match(capture.error,/Missed banishment frame at 0.25/);
    assert.equal(capture.frames.length,0);
    assert.equal(events.listenerCount('postrender'),0);
});

test('early completion and manual cleanup cannot silently pass or retain a listener',()=>{
    const {capture,events,render}=fixture();
    render('banishment',.26);render('aftermath',0);
    assert.match(capture.error,/before all required frames/);
    assert.equal(events.listenerCount('postrender'),0);
    const interrupted=fixture();interrupted.capture.dispose();
    interrupted.render('banishment',.26);
    assert.equal(interrupted.capture.frames.length,0);
    assert.equal(interrupted.events.listenerCount('postrender'),0);
});
