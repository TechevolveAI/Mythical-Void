import { bakeStoneAtlas } from './TrumptopusStoneMaterial.js';

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
        this.material=bakeStoneAtlas(scene,image,'trumptopus-stage-stone',[{width,height:180}]);
        this.keys.push(this.material.key);
        this.floor=scene.add.image(width/2,layout.floorY,this.material.key,this.material.frames[0].name)
            .setOrigin(.5,0).setDepth(689).setTint(0xa5bcc3);
        this.objects.push(this.floor);
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
        this.props=[{name:'exit-stone',object:scene.gate},{name:'rising-foothold',object:scene.causeway}];
        const props=bakeStoneAtlas(scene,image,'trumptopus-stage-props',this.props.map(({object})=>({
            width:object.body.width,height:object.body.height,relief:true})));
        this.keys.push(props.key);
        for(const [index,prop] of this.props.entries()){
            prop.object.setVisible(false);
            // Foreground floor occludes the buried section. This makes a
            // foothold emerge from solid ground, not float below its surface.
            prop.sprite=scene.add.image(0,0,props.key,props.frames[index].name).setOrigin(0).setDepth(688);
            this.objects.push(prop.sprite);
        }
        this.syncProps();
    }

    texture(name,canvas) {
        const key=`trumptopus-stage-${name}`;
        this.scene.textures.addCanvas(key,canvas);this.keys.push(key);return key;
    }

    drawEdge(recovery) {
        if(this.destroyed)return;
        const {width}=this.scene.scale,{floorY}=this.layout;
        this.edge.clear();
        this.edge.lineStyle(2,0xaaa5b6).lineBetween(0,floorY,width,floorY);
        if(recovery>0){
            this.edge.lineStyle(3,0xc8ebd6).lineBetween(0,floorY,width*recovery,floorY);
            this.edge.lineStyle(1,0xebdcae,.7).lineBetween(0,floorY+5,width*recovery,floorY+5);
        }
    }

    syncProps() {
        if(this.destroyed)return;
        for(const {object,sprite} of this.props){
            const body=object.body;
            if(!body){sprite.setVisible(false);continue;}
            sprite.setPosition(body.left,body.top).setDisplaySize(body.width,body.height)
                .setVisible(body.top<this.layout.floorY).setTint(body.enable?0xc1cad0:0x89949e);
        }
    }

    getPropEvidence() {
        if(this.destroyed)return [];
        return this.props.map(({name,object,sprite})=>({name,sourceHidden:object.visible===false,
            visible:sprite.visible,enabled:object.body.enable,
            art:{left:sprite.x,top:sprite.y,width:sprite.displayWidth,height:sprite.displayHeight},
            collision:{left:object.body.left,top:object.body.top,width:object.body.width,height:object.body.height},
            aboveFloor:Math.max(0,Math.min(object.body.height,this.layout.floorY-object.body.top)),
            floorOccludesBuriedSection:sprite.depth<this.floor.depth}));
    }

    destroy() {
        if(this.destroyed)return;
        this.destroyed=true;
        for(const object of this.objects)object.destroy();
        for(const key of this.keys)this.scene.textures.remove(key);
        this.objects=[];this.keys=[];this.props=[];
    }
}
