export const VOID_TEAR_TEXTURE=Object.freeze({width:192,height:320});
export const VOID_TEAR_SOURCE=Object.freeze({x:914,y:166,width:286,height:650});

// A split follows a few unequal faults rather than a repeated radial outline.
// Coordinates stay inside transparent padding for both renderer filters.
export const VOID_TEAR_EDGE=Object.freeze([
    [91,10],[115,42],[143,55],[147,104],[171,135],[153,181],
    [165,217],[129,249],[113,298],[88,310],[67,274],[40,259],
    [38,214],[18,185],[32,139],[24,103],[53,77],[61,37]
].map(point=>Object.freeze(point)));

function trace(ctx,points) {
    const last=points.at(-1),first=points[0];
    ctx.beginPath();ctx.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
    for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];
        ctx.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);
    }
    ctx.closePath();
}

export function voidTearDimensions(opening) {
    if(!Number.isFinite(opening))throw new Error('Invalid private Void opening');
    const p=Math.max(0,Math.min(1,opening));
    return {visible:p>0,width:164*p,height:288*p};
}

export function paintVoidTear(canvas,image) {
    canvas.width=VOID_TEAR_TEXTURE.width;canvas.height=VOID_TEAR_TEXTURE.height;
    const ctx=canvas.getContext('2d'),crop=VOID_TEAR_SOURCE;
    ctx.save();trace(ctx,VOID_TEAR_EDGE);ctx.clip();
    ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
    const depth=ctx.createLinearGradient(0,0,192,320);
    depth.addColorStop(0,'rgba(172,180,205,.34)');
    depth.addColorStop(.35,'rgba(5,7,16,.35)');
    depth.addColorStop(1,'rgba(1,3,10,.8)');
    ctx.fillStyle=depth;ctx.fillRect(0,0,192,320);

    // The unlit interior sits behind the textured lip. Baked shadow softens
    // the transition without a screen-space glow or a closed luminous stroke.
    const interior=VOID_TEAR_EDGE.map(([x,y],i)=>[
        96+(x-96)*(i<9?.74:.83),160+(y-160)*.9
    ]);
    ctx.shadowColor='rgba(0,0,0,.95)';ctx.shadowBlur=9;
    trace(ctx,interior);ctx.fillStyle='#03040a';ctx.fill();
    ctx.shadowBlur=0;
    const recess=ctx.createLinearGradient(44,140,143,187);
    recess.addColorStop(0,'#03040a');recess.addColorStop(.5,'#090d19');recess.addColorStop(1,'#010205');
    ctx.fillStyle=recess;ctx.fill();
    ctx.restore();
    return {source:VOID_TEAR_SOURCE,rgbaBytes:canvas.width*canvas.height*4,closedOutline:false};
}
