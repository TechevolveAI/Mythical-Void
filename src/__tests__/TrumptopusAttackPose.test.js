const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../systems/TrumptopusAttackPose.js'), 'utf8');
const { getTrumptopusAttackPose: pose, overlapsTrumptopusHazard: overlaps } = new Function(`${source.replace(/export /g, '')}\nreturn {getTrumptopusAttackPose, overlapsTrumptopusHazard};`)();
const viewport = { width: 390, floorY: 500 };
const state = { state: 'contact', attack: 'grasp', progress: 0, targetX: 200, dangerous: true };

describe('authored attack and collision geometry share the same contact', () => {
    test('contact hazard is exactly the visible palm, not its tall counterattack target', () => {
        const p = pose(state, viewport);
        expect(p.hazards).toEqual([p.palm]);
        expect(p.palm.y + p.palm.height / 2).toBe(498);
        expect(overlaps({left: 190, right: 210, top: 470, bottom: 500}, p.hazards)).toBe(true);
        expect(overlaps({left: 190, right: 210, top: 380, bottom: 410}, p.hazards)).toBe(false);
    });
    test.each(['ready', 'phase_intro', 'windup', 'exposed', 'recoil', 'banishment', 'aftermath'])('%s is safe when the encounter has disarmed', name => {
        expect(pose({...state, state: name, dangerous: false}, viewport).hazards).toEqual([]);
    });
    test('sweep is a low physical obstacle and passes below a normal jump', () => {
        const p = pose({...state, state: 'strike', attack: 'sweep', progress: 0.5}, viewport);
        expect(p.palm).toEqual({x: 195, y: 485, width: 70, height: 26});
        expect(overlaps({left: 190, right: 210, top: 470, bottom: 500}, p.hazards)).toBe(true);
        expect(overlaps({left: 190, right: 210, top: 300, bottom: 470}, p.hazards)).toBe(false);
    });
    test('closing grasp is visibly and physically wider, but leaves an escape on phone', () => {
        const p = pose({...state, attack: 'closing_grasp'}, viewport);
        expect(p.palm.width).toBe(110);
        expect(overlaps({left: 260, right: 280, top: 450, bottom: 500}, p.hazards)).toBe(false);
    });
    test.each([390, 1280])('all contact endpoints stay in the %ipx arena', width => {
        for (const attack of ['grasp', 'closing_grasp', 'sweep']) {
            for (const targetX of [-999, 9999]) {
                const p = pose({...state, attack, targetX}, {...viewport, width});
                expect(p.palm.x - p.palm.width / 2).toBeGreaterThanOrEqual(0);
                expect(p.palm.x + p.palm.width / 2).toBeLessThanOrEqual(width);
            }
        }
    });
});
