const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const p=clamp(value,0,1);return p*p*(3-2*p);};

export function trumptopusArenaLayout(width,height) {
    const floorY=Math.round(height-(width<600?180:72));
    const bossFloorY=floorY-160;
    return {floorY,bossFloorY,bossX:width*.72,
        bossHeight:Math.min(330,bossFloorY-138,width*.77)};
}

// Reserve the full rendered player and claw, not just their smaller physics
// bodies. A free interval is a place the astronaut can actually stand.
export function chooseAllyLanding({width,player,hands,currentX,halfWidth=25,gap=24}) {
    let intervals=[[halfWidth+8,width-halfWidth-8]];
    for(const object of [player,...hands]){
        const min=object.left-gap-halfWidth,max=object.right+gap+halfWidth;
        intervals=intervals.flatMap(([left,right])=>max<=left||min>=right?[[left,right]]:
            [[left,Math.min(right,min)],[Math.max(left,max),right]].filter(([a,b])=>b>=a));
    }
    if(!intervals.length)return null;
    const candidates=intervals.map(([left,right])=>clamp(currentX,left,right));
    return candidates.sort((a,b)=>Math.abs(a-currentX)-Math.abs(b-currentX))[0];
}

export function allySweepLeapDuration({width,landingX,progress,halfWidth=25}) {
    const start=width-78,distance=width-156;
    // Land after the trailing edge has passed the whole astronaut plus 24px.
    const safePalmX=landingX-halfWidth-24-35;
    const crossed=clamp((start-safePalmX)/distance,0,1);
    return (1-clamp(progress,0,1))*1300+crossed*750+100;
}

export function sampleAllyLeap({fromX,toX,elapsed,duration,height=205,floorY}) {
    const p=clamp(elapsed/duration,0,1);
    return {x:fromX+(toX-fromX)*smooth(p),footY:floorY-4*height*p*(1-p),progress:p,landed:p===1};
}

export function trumptopusBanishment(progress) {
    const p=clamp(progress,0,1),pull=smooth((p-.18)/.66);
    const opening=smooth(p/.2)*(1-smooth((p-.84)/.16));
    return {opening,pull,scale:1-pull*.94,rotation:-pull*.23,
        x:pull*24,y:-pull*130,visible:p<.88,shadow:1-smooth(p/.32),
        release:smooth((p-.65)/.35)};
}
