const mix = (a, b, t) => a + (b - a) * t;
const rotate = (x, y, angle) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) });
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };

// Shape only: committed palms and combat timing remain owned by the encounter.
// A stored bend loads near the elbow, travels outwards, then returns on recoil.
export function attackLimbShape(state, progress, span, engagement) {
    const p = Math.max(0, Math.min(1, progress));
    const strength = Math.max(0, Math.min(1, engagement));
    const reach = Math.max(0, Math.min(1, (span - 300) / 600));
    const amplitude = Math.min(145, Math.max(0, span) * 0.12) * reach;
    const travel = state === 'windup' ? 0.18 : state === 'strike' ? mix(0.18, 0.82, smooth(p)) :
        state === 'recoil' ? mix(0.82, 0.18, smooth(p)) : 0.82;
    const load = state === 'windup' ? strength : state === 'strike' ? 1 - smooth(p) :
        state === 'recoil' ? -Math.sin(Math.PI * p) * 0.5 : 0;
    return { articulation: strength * reach, wave: amplitude * load, travel };
}

// The source forearm is a strip of existing pixels. Its centreline bends while
// the elbow and wrist stay attached; the cap and body are never warped.
export function createLimbWarp(part, chain, start, end, { startAngle = 0, endAngle = 0, wave = 0, travel = 0.5, tipScale = 1, articulation = 0 } = {}) {
    const sourceStart = { x: chain.elbow[0], y: chain.elbow[1] };
    const sourceEnd = { x: chain.wrist[0], y: chain.wrist[1] };
    const dx = sourceEnd.x - sourceStart.x, dy = sourceEnd.y - sourceStart.y;
    const originalLength = Math.hypot(dx, dy);
    const sourceAngle = Math.atan2(dy, dx);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const first = rotate(dx / originalLength, dy / originalLength, startAngle);
    const last = rotate(dx / originalLength, dy / originalLength, endAngle);
    const flex = Math.max(0, Math.min(1, articulation));
    const tangent = Math.min(length * (1 / 3 + flex * 0.16), 360 + flex * 620);
    const c1 = { x: start.x + first.x * tangent, y: start.y + first.y * tangent };
    const c2 = { x: end.x - last.x * tangent, y: end.y - last.y * tangent };
    const curve = t => {
        if (t < 0) return { x: start.x + first.x * originalLength * t, y: start.y + first.y * originalLength * t, angle: sourceAngle + startAngle };
        if (t > 1) return { x: end.x + last.x * originalLength * (t - 1), y: end.y + last.y * originalLength * (t - 1), angle: sourceAngle + endAngle };
        const u = 1 - t;
        const vx = 3 * u * u * (c1.x - start.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (end.x - c2.x);
        const vy = 3 * u * u * (c1.y - start.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (end.y - c2.y);
        const sine = Math.sin(Math.PI * t), gaussian = Math.exp(-(((t - travel) / 0.22) ** 2));
        const pressure = wave * sine ** 2 * gaussian;
        const pressureDerivative = wave * gaussian * (2 * Math.PI * sine * Math.cos(Math.PI * t) -
            2 * (t - travel) / 0.22 ** 2 * sine ** 2);
        const nx = length ? -(end.y - start.y) / length : 0;
        const ny = length ? (end.x - start.x) / length : 0;
        // Orient each strip along the deformed curve, not the undeformed
        // centreline; otherwise a strong travelling bend pinches the texture.
        const angle = Math.atan2(vy + ny * pressureDerivative, vx + nx * pressureDerivative);
        return {
            x: u ** 3 * start.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * end.x + nx * pressure,
            y: u ** 3 * start.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * end.y + ny * pressure,
            angle
        };
    };
    const map = (x, y) => {
        const t = (y + part.bounds.y - sourceStart.y) / dy;
        const centre = curve(t);
        const amount=Math.max(0,Math.min(1,t));
        const widthScale=mix(1,tipScale,smooth(amount)) * (1 - flex * 0.28 * Math.sin(Math.PI * amount) ** 2);
        const offset = (x + part.bounds.x - mix(sourceStart.x, sourceEnd.x, t))*widthScale;
        const normal = rotate(offset, 0, centre.angle - sourceAngle);
        return { x: centre.x + normal.x, y: centre.y + normal.y };
    };
    const strips = [];
    // Include the two attachment rows exactly instead of interpolating across
    // the change between the preserved joint overlap and the stretched tissue.
    const rows = new Set([0, part.bounds.height, sourceStart.y - part.bounds.y, sourceEnd.y - part.bounds.y]);
    const step = flex > 0 ? 8 : 16;
    for (let y = step; y < part.bounds.height; y += step) rows.add(y);
    const ordered = [...rows].filter(y => y >= 0 && y <= part.bounds.height).sort((a, b) => a - b);
    for (let i = 1; i < ordered.length; i++) {
        const y = ordered[i - 1], bottom = ordered[i], width = part.bounds.width;
        strips.push({ source: [{x:0,y}, {x:width,y}, {x:width,y:bottom}, {x:0,y:bottom}],
            destination: [map(0,y), map(width,y), map(width,bottom), map(0,bottom)] });
    }
    const vertices = strips.flatMap(strip => strip.destination);
    const left = Math.floor(Math.min(...vertices.map(p => p.x))) - 2;
    const top = Math.floor(Math.min(...vertices.map(p => p.y))) - 2;
    const right = Math.ceil(Math.max(...vertices.map(p => p.x))) + 2;
    const bottom = Math.ceil(Math.max(...vertices.map(p => p.y))) + 2;
    return { strips, start: curve(0), end: curve(1),
        centreline: Array.from({length:17}, (_, i) => curve(i / 16)),
        bounds: { left, top, width: right - left, height: bottom - top } };
}

function drawTriangle(ctx, image, source, destination, padding) {
    const [a,b,c] = source, [p,q,r] = destination;
    const dx1=b.x-a.x, dy1=b.y-a.y, dx2=c.x-a.x, dy2=c.y-a.y;
    const determinant=dx1*dy2-dx2*dy1;
    const m11=((q.x-p.x)*dy2-(r.x-p.x)*dy1)/determinant;
    const m12=((q.y-p.y)*dy2-(r.y-p.y)*dy1)/determinant;
    const m21=(dx1*(r.x-p.x)-dx2*(q.x-p.x))/determinant;
    const m22=(dx1*(r.y-p.y)-dx2*(q.y-p.y))/determinant;
    ctx.save();
    ctx.beginPath();
    // Offset each edge, not just each vertex towards the triangle centre. Thin
    // texture triangles otherwise retain horizontal antialiasing cracks.
    const orientation=Math.sign((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));
    for (const [i,v] of destination.entries()) {
        const previous=destination[(i+2)%3],next=destination[(i+1)%3];
        const a=Math.hypot(v.x-previous.x,v.y-previous.y),b=Math.hypot(next.x-v.x,next.y-v.y);
        const n1={x:(v.y-previous.y)/a*orientation,y:-(v.x-previous.x)/a*orientation};
        const n2={x:(next.y-v.y)/b*orientation,y:-(next.x-v.x)/b*orientation};
        const weight=padding/Math.max(0.0001,1+n1.x*n2.x+n1.y*n2.y);
        const x=v.x+(n1.x+n2.x)*weight,y=v.y+(n1.y+n2.y)*weight;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.clip();
    ctx.transform(m11,m12,m21,m22,p.x-m11*a.x-m21*a.y,p.y-m12*a.x-m22*a.y);
    const sx=Math.max(0,Math.min(...source.map(v=>v.x))-2),sy=Math.max(0,Math.min(...source.map(v=>v.y))-2);
    const sw=Math.min(image.width,Math.max(...source.map(v=>v.x))+2)-sx;
    const sh=Math.min(image.height,Math.max(...source.map(v=>v.y))+2)-sy;
    ctx.drawImage(image,sx,sy,sw,sh,sx,sy,sw,sh);ctx.restore();
}

export function paintLimbWarp(texture, image, geometry, resolution = 1) {
    const {left,top,width,height}=geometry.bounds;
    const w=Math.ceil(width*resolution),h=Math.ceil(height*resolution);
    if(texture.width!==w||texture.height!==h)texture.setSize(w,h);
    const ctx=texture.context;
    ctx.clearRect(0,0,w,h);
    ctx.save();ctx.scale(resolution,resolution);ctx.translate(-left,-top);
    for(const strip of geometry.strips)for(const indices of [[0,1,2],[0,2,3]]) {
        drawTriangle(ctx,image,indices.map(i=>strip.source[i]),indices.map(i=>strip.destination[i]),0.5/resolution);
    }
    ctx.restore();texture.refresh();
}
