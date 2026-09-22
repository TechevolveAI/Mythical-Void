const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const p=clamp(value,0,1);return p*p*(3-2*p);};

export function trumptopusArenaLayout(width,height) {
    const floorY=Math.round(height-(width<600?180:72));
    // Private wide-screen comparison: a central, lower rear ledge shortens
    // the reach without moving the player's floor or committed attack palms.
    const wide=width>=900,bossFloorY=floorY-(wide?96:160);
    return {floorY,bossFloorY,bossX:width*(wide?.5:.72),
        bossHeight:Math.min(wide?410:330,bossFloorY-138,width*.77)};
}

// Reserve the full rendered player and claw, not just their smaller physics
// bodies. A free interval is a place the astronaut can actually stand.
export function chooseAllyLanding({width,player,hands,currentX,halfWidth=25,gap=24,playerGap=gap}) {
    let intervals=[[halfWidth+8,width-halfWidth-8]];
    for(const [index,object] of [player,...hands].entries()){
        const clearance=index===0?playerGap:gap;
        const min=object.left-clearance-halfWidth,max=object.right+clearance+halfWidth;
        intervals=intervals.flatMap(([left,right])=>max<=left||min>=right?[[left,right]]:
            [[left,Math.min(right,min)],[Math.max(left,max),right]].filter(([a,b])=>b>=a));
    }
    if(!intervals.length)return null;
    const candidates=intervals.map(([left,right])=>clamp(currentX,left,right));
    return candidates.sort((a,b)=>Math.abs(a-currentX)-Math.abs(b-currentX))[0];
}

export function anticipatedPlayerBounds(player,velocityX,width,leadMs=350) {
    const offset=clamp(velocityX*leadMs/1000,8-player.left,width-8-player.right);
    return {left:player.left+offset,right:player.right+offset};
}

export function constrainAllyStrike(x,{side,player,width,padding=30,gap=24}) {
    const min=side==='left'?padding:player.right+gap+padding;
    const max=side==='left'?player.left-gap-padding:width-padding;
    return min<=max?clamp(x,min,max):null;
}

export function allySweepLeapDuration({width,landingX,progress,halfWidth=25}) {
    const start=width-78,distance=width-156;
    // Land after the trailing edge has passed the whole astronaut plus 24px.
    const safePalmX=landingX-halfWidth-24-35;
    const crossed=clamp((start-safePalmX)/distance,0,1);
    return (1-clamp(progress,0,1))*1300+crossed*750+100;
}

export function sampleAllyLeap({fromX,toX,elapsed,duration,height=240,floorY}) {
    const p=clamp(elapsed/duration,0,1);
    // Rise clear before crossing the creature, then finish the lateral move
    // before descending. The ground endpoints remain exact.
    return {x:fromX+(toX-fromX)*smooth((p-.2)/.5),footY:floorY-4*height*p*(1-p),progress:p,landed:p===1};
}

export function trumptopusBanishment(progress) {
    const p=clamp(progress,0,1),pull=smooth((p-.18)/.66);
    const opening=smooth(p/.2)*(1-smooth((p-.84)/.16));
    return {opening,pull,scale:1-pull*.94,rotation:-pull*.23,
        x:pull*24,y:-pull*130,visible:p<.88,shadow:1-smooth(p/.32),
        release:smooth((p-.65)/.35)};
}
