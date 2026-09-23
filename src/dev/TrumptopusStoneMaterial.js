// Character-free foreground from Kevin's unchanged 1344 x 1008 landscape.
// No skyline, distant gold pool, or generated replacement texture in the floor.
export const STONE_SOURCE=Object.freeze({x:510,y:936,width:820,height:72});

export function packStoneSurfaces(surfaces) {
    if(!surfaces.length)throw new Error('Stone atlas needs at least one surface');
    for(const {width,height} of surfaces)if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4092||height>2044)
        throw new Error('Invalid private stone surface size');
    const width=Math.max(...surfaces.map(surface=>surface.width))+4;
    let x=2,y=2,rowHeight=0;
    const frames=surfaces.map((surface,index)=>{
        if(x+surface.width+2>width){x=2;y+=rowHeight+4;rowHeight=0;}
        const frame={name:`surface-${index}`,x,y,width:surface.width,height:surface.height};
        x+=surface.width+4;rowHeight=Math.max(rowHeight,surface.height);return frame;
    });
    const height=y+rowHeight+2;
    if(height>4096)throw new Error('Private stone atlas exceeds its texture bound');
    return {width,height,frames,rgbaBytes:width*height*4};
}

export function stoneCrop(width,index) {
    const span=Math.min(STONE_SOURCE.width,Math.max(128,Math.ceil(width*.9)));
    const offset=(index*97)%(STONE_SOURCE.width-span+1);
    return {...STONE_SOURCE,x:STONE_SOURCE.x+offset,width:span};
}

function paintSurface(canvas,image,index,relief=false) {
    const ctx=canvas.getContext('2d'),{width,height}=canvas;
    const crop=stoneCrop(width,index),lip=Math.min(8,Math.ceil(height*.2));
    ctx.drawImage(image,crop.x,crop.y,crop.width,18,0,0,width,lip);
    ctx.drawImage(image,crop.x,crop.y+18,crop.width,crop.height-18,0,lip,width,height-lip);
    // Native Canvas shading survives both Phaser renderers. The walkable top
    // stays opaque and straight; no decorative cut-away contradicts physics.
    const depth=ctx.createLinearGradient(0,lip,0,height);
    depth.addColorStop(0,'rgba(4,10,16,0.12)');depth.addColorStop(1,'rgba(4,10,16,0.70)');
    ctx.fillStyle=depth;ctx.fillRect(0,lip,width,height-lip);
    ctx.fillStyle='rgba(158,194,201,0.22)';ctx.fillRect(0,0,width,lip);
    if(relief){
        // Small foreground obstacles need a readable side plane, not only a
        // thin top line against the similarly dark painted background.
        const face=ctx.createLinearGradient(0,0,width,height);
        face.addColorStop(0,'rgba(105,132,159,0.78)');
        face.addColorStop(0.55,'rgba(71,94,119,0.64)');
        face.addColorStop(1,'rgba(29,44,64,0.40)');
        ctx.globalCompositeOperation='screen';ctx.fillStyle=face;ctx.fillRect(0,lip,width,height-lip);
        ctx.globalCompositeOperation='source-over';
        ctx.fillStyle='rgba(184,207,222,0.82)';ctx.fillRect(0,0,width,2);
        ctx.fillStyle='rgba(138,161,184,0.38)';ctx.fillRect(0,lip,2,height-lip);
    }
}

export function bakeStoneAtlas(scene,image,key,surfaces) {
    const layout=packStoneSurfaces(surfaces);
    const atlas=document.createElement('canvas');atlas.width=layout.width;atlas.height=layout.height;
    const ctx=atlas.getContext('2d');
    for(const [index,frame] of layout.frames.entries()) {
        const tile=document.createElement('canvas');tile.width=frame.width;tile.height=frame.height;
        paintSurface(tile,image,index,surfaces[index].relief===true);
        ctx.drawImage(tile,frame.x,frame.y);
        // Extrude edge pixels into the gutter so filtering cannot sample an
        // adjacent platform or transparent atlas padding.
        ctx.drawImage(tile,0,0,tile.width,1,frame.x,frame.y-2,tile.width,2);
        ctx.drawImage(tile,0,tile.height-1,tile.width,1,frame.x,frame.y+tile.height,tile.width,2);
        ctx.drawImage(tile,0,0,1,tile.height,frame.x-2,frame.y,2,tile.height);
        ctx.drawImage(tile,tile.width-1,0,1,tile.height,frame.x+tile.width,frame.y,2,tile.height);
    }
    const texture=scene.textures.addCanvas(key,atlas);
    for(const frame of layout.frames)texture.add(frame.name,0,frame.x,frame.y,frame.width,frame.height);
    return {key,...layout,source:STONE_SOURCE,tiled:false};
}
