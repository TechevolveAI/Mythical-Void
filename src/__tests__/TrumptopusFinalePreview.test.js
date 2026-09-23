const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../dev/TrumptopusFinalePreview.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export default class', 'class');
const Preview = new Function('TrumptopusPrototypeLevel', `${source}\nreturn TrumptopusFinalePreview;`)(class {update() {}});

test('the private road lift never enables through a player or vanishes under a rider', () => {
    const scene = new Preview();
    scene.floorY = 500;
    scene.levelWidth = 390;
    scene.lastPreviewPhase = 1;
    scene.causewaySettled = false;
    scene.encounter = {snapshot: () => ({phaseIndex:1,mode:'combat',progress:0}),drainEvents:()=>[]};
    scene.player = {body:{left:24,right:100}};
    scene.causeway = {y:540,body:{enable:false,updateFromGameObject:jest.fn()}};
    scene.response = {clear:jest.fn()};
    scene.update(0, 16);
    expect(scene.causeway.y).toBe(540);
    expect(scene.causeway.body.enable).toBe(false);
    scene.player.body = {left:150,right:250};
    scene.update(16,16);
    expect(scene.causeway.y).toBe(434);
    expect(scene.causeway.body.enable).toBe(true);
    expect(scene.causeway.body.updateFromGameObject).toHaveBeenCalledTimes(1);
    scene.player.body = {left:24,right:100};
    scene.update(32,16);
    expect(scene.causeway.body.enable).toBe(true);
    expect(scene.causeway.y).toBe(434);
    expect(scene.causeway.body.updateFromGameObject).toHaveBeenCalledTimes(1);
});

test('winning releases held input without repeatedly cancelling the landing fall', () => {
    const scene = new Preview();
    scene.lastPreviewPhase = 2;
    scene.encounter = {snapshot: () => ({phaseIndex:2,mode:'banishment',completionReady:true}),drainEvents:()=>[]};
    scene.response = {clear:jest.fn()};
    scene.clearInput = jest.fn();
    scene.hidePlatformerMobileControls = jest.fn();
    scene.update(0,16);
    scene.update(16,16);
    expect(scene.clearInput.mock.calls).toEqual([[{preserveFall:true}],[{preserveFall:true}]]);
    expect(scene.hidePlatformerMobileControls).toHaveBeenCalledTimes(2);
});
