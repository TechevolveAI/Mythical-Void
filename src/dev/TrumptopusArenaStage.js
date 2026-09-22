// Runtime crops of Kevin's supplied landscape. The baked-in character on the
// left is excluded; only the separately rigged boss appears in gameplay.
export default class TrumptopusArenaStage {
    constructor(scene,image,layout) {
        this.scene=scene;this.layout=layout;this.keys=[];this.objects=[];
        const {width,height}=scene.scale;
        const canvas=document.createElement('canvas');canvas.width=834;canvas.height=800;
        canvas.getContext('2d').drawImage(image,510,0,834,800,0,0,834,800);
        const sky=this.texture('sky',canvas);
        const background=scene.add.image(width/2,height/2,sky).setDepth(-10);
        background.setScale(Math.max(width/834,height/800));
        this.objects.push(background,scene.add.rectangle(width/2,height/2,width,height,0x070b14,.35).setDepth(-9));
        const stone=document.createElement('canvas');stone.width=320;stone.height=128;
        stone.getContext('2d').drawImage(image,530,785,650,220,0,0,320,128);
        const material=this.texture('stone',stone);
        this.objects.push(scene.add.tileSprite(width/2,layout.floorY+90,width,180,material).setDepth(689).setTint(0xa5bcc3));
        this.edge=scene.add.graphics().setDepth(691);this.objects.push(this.edge);
        this.drawEdge(0);
        const dais=document.createElement('canvas');dais.width=240;dais.height=170;
        const ctx=dais.getContext('2d');
        ctx.beginPath();ctx.moveTo(12,1);ctx.lineTo(228,1);ctx.lineTo(214,34);ctx.lineTo(169,122);
        ctx.lineTo(127,167);ctx.lineTo(53,127);ctx.lineTo(27,59);ctx.closePath();ctx.clip();
        ctx.drawImage(image,670,748,440,260,0,0,240,170);
        ctx.fillStyle='rgba(18,28,35,.3)';ctx.fillRect(0,0,240,170);
        const daisKey=this.texture('dais',dais);
        this.objects.push(scene.add.image(layout.bossX,layout.bossFloorY,daisKey).setOrigin(.5,0)
            .setDisplaySize(layout.bossHeight*.64,155).setDepth(680));
        this.rim=scene.add.graphics().setDepth(681);this.objects.push(this.rim);
        this.rim.lineStyle(2,0xadc4c2).lineBetween(layout.bossX-layout.bossHeight*.285,layout.bossFloorY,
            layout.bossX+layout.bossHeight*.285,layout.bossFloorY);
    }

    texture(name,canvas) {
        const key=`trumptopus-stage-${name}`;
        this.scene.textures.addCanvas(key,canvas);this.keys.push(key);return key;
    }

    drawEdge(recovery) {
        const {width}=this.scene.scale,{floorY}=this.layout;
        this.edge.clear();
        this.edge.lineStyle(2,0xaaa5b6).lineBetween(0,floorY,width,floorY);
        if(recovery>0){
            this.edge.lineStyle(3,0xc8ebd6).lineBetween(0,floorY,width*recovery,floorY);
            this.edge.lineStyle(1,0xebdcae,.7).lineBetween(0,floorY+5,width*recovery,floorY+5);
        }
    }

    destroy() {
        for(const object of this.objects)object.destroy();
        for(const key of this.keys)this.scene.textures.remove(key);
        this.objects=[];this.keys=[];
    }
}
