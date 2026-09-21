const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

async function playApproach(page,context,output,name,{framing=false,onArrival=null}={}) {
    const cdp=name==='phone' ? await context.newCDPSession(page) : null;
    let held=null;
    const jumpEvidence=[];
    const framingEvidence=[];
    const state=()=>page.evaluate(()=>window.prototypeScene.getProofState());
    const wait=predicate=>page.waitForFunction(predicate,null,{timeout:16000});
    async function startFramingSample() {
        if(!framing)return;
        await page.evaluate(()=>{
            const scene=window.prototypeScene;
            const result={frames:0,minLeft:Infinity,minRight:Infinity,minTop:Infinity,minBottom:Infinity,
                postCounterFrames:0,minPostCounterGap:Infinity,violations:[]};
            const sample=()=>{
                if(scene.encounter.disposed||window.prototypeScene!==scene)return;
                const {creature,astronaut}=scene.getApproachActorBounds(),camera=scene.cameras.main;
                const boxes=[creature,astronaut];
                const left=Math.min(...boxes.map(b=>b.left-camera.scrollX));
                const right=Math.min(...boxes.map(b=>scene.scale.width-b.right+camera.scrollX));
                const top=Math.min(...boxes.map(b=>b.top-camera.scrollY));
                const bottom=Math.min(...boxes.map(b=>scene.scale.height-b.bottom+camera.scrollY));
                result.frames++;result.minLeft=Math.min(result.minLeft,left);result.minRight=Math.min(result.minRight,right);
                result.minTop=Math.min(result.minTop,top);result.minBottom=Math.min(result.minBottom,bottom);
                const postCounter=scene.encounter.mode==='settling';
                const gap=creature.left-astronaut.right;
                if(postCounter){result.postCounterFrames++;result.minPostCounterGap=Math.min(result.minPostCounterGap,gap);}
                if((Math.min(left,right,bottom)<0||top<100||(postCounter&&gap<24))&&result.violations.length<20) {
                    result.violations.push({mode:scene.encounter.mode,state:scene.encounter.state,left,right,top,bottom,gap,
                        playerX:scene.player.x,cameraX:camera.scrollX,cameraY:camera.scrollY});
                }
            };
            window.game.events.on('postrender',sample);
            window.stopFramingSample=()=>{
                window.game.events.off('postrender',sample);
                window.completedFramingSample=result;
                return result;
            };
        });
    }
    async function finishFramingSample() {
        if(!framing)return;
        const sample=await page.evaluate(()=>window.stopFramingSample());
        framingEvidence.push(sample);
        assert(sample.frames>100);assert(sample.postCounterFrames>10);
        assert.deepEqual(sample.violations,[],'Approach actor framing failed');
    }
    async function release() {
        const wasHeld=Boolean(held);
        held=null;
        if(cdp) {if(wasHeld)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
        else {await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowRight');}
    }
    async function direction(sign) {
        await release();
        if(cdp) {
            const s=await state(),x=s.joystick.x,y=s.joystick.y+42;
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});
            held={id:1,x:x+42*sign,y};
            await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[held]});
        } else await page.keyboard.down(sign>0?'ArrowRight':'ArrowLeft');
    }
    async function moveTo(x) {
        const s=await state(),sign=Math.sign(x-s.player.x);
        if(Math.abs(x-s.player.x)<8)return;
        await direction(sign);
        await page.waitForFunction(({x,sign})=>sign*(window.prototypeScene.player.x-x)>=0,{x,sign},{timeout:16000});
        await release();
    }
    async function jumpTo(x) {
        await wait(()=>window.prototypeScene.isGrounded);
        await page.evaluate(()=>{
            const scene=window.prototypeScene;window.approachJumpTrace=[];
            const sample=()=>{
                const b=scene.player.body;
                window.approachJumpTrace.push({x:scene.player.x,bottom:b.bottom,top:b.top,vx:b.velocity.x,vy:b.velocity.y,
                    joystick:scene.virtualJoystickX,touch:scene.joystickTouchIdentifier,pointer:scene.joystickPointerId,blocked:{...b.blocked}});
                if(window.approachJumpTrace.length>=180)scene.events.off('postupdate',sample);
            };
            scene.events.on('postupdate',sample);
            window.stopApproachTrace=()=>scene.events.off('postupdate',sample);
        });
        const s=await state(),sign=Math.sign(x-s.player.x)||1;
        await direction(sign);
        if(cdp) {
            const jump=s.controls.jump;
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[held,{id:2,x:jump.x,y:jump.y+42}]});
        } else await page.keyboard.down('Space');
        await wait(()=>window.prototypeScene.player.body.velocity.y < -50);
        // Keep both fingers down through the rise, then release only jump.
        await wait(()=>window.prototypeScene.player.body.velocity.y >= -40);
        if(framing)await page.screenshot({path:path.join(output,`${name}-approach-jump-${jumpEvidence.length+1}-apex.png`)});
        // CDP takes the remaining active contacts; touchEnd ends the whole gesture.
        if(cdp) {
            await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[held]});
            assert(await page.evaluate(sign=>window.prototypeScene.virtualJoystickX*sign>0.5,sign),
                'Lifting the jump finger released the movement finger');
        }
        else await page.keyboard.up('Space');
        await page.waitForFunction(({x,sign})=>sign*(window.prototypeScene.player.x-x)>=0,{x,sign},{timeout:10000});
        await release();await wait(()=>window.prototypeScene.isGrounded);
        jumpEvidence.push(await page.evaluate(()=>{
            window.stopApproachTrace();
            const trace=window.approachJumpTrace;
            return {frames:trace.length,minBottom:Math.min(...trace.map(frame=>frame.bottom)),
                hitCeiling:trace.some(frame=>frame.blocked.up),start:trace[0],end:trace.at(-1)};
        }));
    }
    async function clearGrip(x,index) {
        await moveTo(x);
        await wait(()=>window.prototypeScene.encounter.state==='windup');
        const warning=await state();
        await page.screenshot({path:path.join(output,`${name}-approach-${index}-warning.png`)});
        await moveTo(warning.targetX+100);
        await direction(-1);await page.waitForTimeout(65);await release();
        await wait(()=>window.prototypeScene.encounter.state==='exposed');
        const before=await state();
        assert.equal(before.damage.length,warning.damage.length,'Approach grab was not dodged');
        for(let press=0;press<3&&(await state()).state==='exposed';press++) {
            if(cdp) {const {melee}=(await state()).controls;await page.touchscreen.tap(melee.x,melee.y+42);}
            else await page.keyboard.press('m');
            await page.waitForTimeout(380);
        }
        await wait(()=>window.prototypeScene.encounter.mode==='settling');
        const lifting=await state();
        assert(lifting.bridges[index-1].top>lifting.floorY,'Crossing teleported straight to its finished position');
        await page.screenshot({path:path.join(output,`${name}-approach-${index}-settling.png`)});
        await page.waitForFunction(index=>window.prototypeScene.encounter.clearedGrips===index,index);
        const done=await state();
        assert.equal(done.bridges[index-1].top,done.floorY);
        assert.equal(done.bridges[index-1].top,done.bridges[index-1].artTop);
        assert.equal(done.savedRun.approach.clearedGrips,index);
        assert(done.hits.some(hit=>hit.applied));
        return {warning,done};
    }
    await wait(()=>window.prototypeScene.isGrounded);
    await startFramingSample();
    const arrival=await state();
    assert.equal(arrival.sceneKey,'TrumptopusApproach');assert.equal(arrival.state,'travel');
    await page.screenshot({path:path.join(output,`${name}-approach-arrival.png`)});
    const first=await clearGrip(640,1);
    await finishFramingSample();
    await page.click('#pause');const paused=await state();await page.waitForTimeout(200);
    assert.equal((await state()).elapsed,paused.elapsed);await page.click('#pause');
    await page.reload();await wait(()=>window.prototypeScene?.encounter?.clearedGrips===1);
    const resumed=await state();
    assert(resumed.savedRun.elapsedMs>=paused.savedRun.elapsedMs,'Reload rewound active route time');
    assert.equal(resumed.savedRun.damageTaken,paused.savedRun.damageTaken);
    assert.equal(resumed.bridges[0].top,resumed.floorY);
    await startFramingSample();
    await page.evaluate(()=>{
        const chunks=[],stream=window.game.canvas.captureStream(24);
        const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1500000});
        recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
        window.stopApproachRecording=()=>new Promise(resolve=>{
            recorder.onstop=async()=>{
                const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());
                stream.getTracks().forEach(track=>track.stop());
                let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
                resolve(btoa(binary));
            };recorder.stop();
        });recorder.start(200);
    });
    await moveTo(1245);await wait(()=>window.prototypeScene.isGrounded);
    const caught=await state();
    assert(caught.player.bottom>caught.floorY+30,'Missed jump did not reach a recovery ledge');
    assert(caught.player.bottom<=caught.catchY+2);assert.equal(caught.playerHealth,4);
    await page.screenshot({path:path.join(output,`${name}-approach-recovery-ledge.png`)});
    await jumpTo(1415);
    assert.equal(jumpEvidence[0].hitCeiling,false,'Recovery jumped into the underside of the road');
    const rejoined=await state();assert(rejoined.player.bottom<=rejoined.floorY+2,'Recovery failed to return to the main road');
    await moveTo(1435);await jumpTo(1610);await moveTo(1810);
    await page.screenshot({path:path.join(output,`${name}-approach-crossing.png`)});
    const second=await clearGrip(1810,2);
    await moveTo(2370);await jumpTo(2570);
    await direction(1);
    if(onArrival) {
        await wait(()=>window.prototypeScene?.arrivalCue?.root);
        await release();
        await onArrival();
    }
    await wait(()=>window.prototypeScene?.sys.settings.key==='TrumptopusPrototype');
    await release();
    await finishFramingSample();
    const motion=await page.evaluate(()=>window.stopApproachRecording());
    fs.writeFileSync(path.join(output,`${name}-approach-resumed-silent.webm`),Buffer.from(motion,'base64'));
    const arena=await state();
    const progress=await page.evaluate(()=>GameState.get('story.projectBeacon.trumptopus'));
    assert.equal(progress.approach.arrived,true);assert.equal(progress.approach.clearedGrips,2);
    assert(progress.elapsedMs>second.done.savedRun.elapsedMs);assert.equal(arena.phaseIndex,0);
    return {arrival,first,resumed,caught,rejoined,second,arenaEntry:progress,jumpEvidence,framingEvidence,realInput:true,debugTeleport:false};
}

module.exports={playApproach};
