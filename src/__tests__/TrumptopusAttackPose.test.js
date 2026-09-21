const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../systems/TrumptopusAttackPose.js'), 'utf8');
const { getTrumptopusAttackPose: pose, overlapsTrumptopusHazard: overlaps, tentacle: curve } = new Function(`${source.replace(/export /g, '')}\nreturn {getTrumptopusAttackPose, overlapsTrumptopusHazard, tentacle};`)();
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

describe('continuous extending tentacle guide', () => {
    const transitions = [['ready', 'windup'], ['windup', 'strike'], ['strike', 'contact'],
        ['contact', 'exposed'], ['exposed', 'recoil'], ['recoil', 'ready'], ['recoil', 'banishment']];

    test.each(['grasp', 'sweep', 'closing_grasp'])('%s does not teleport between motion states', attack => {
        for (const width of [390, 1280]) {
            for (const [from, to] of transitions) {
                const a = pose({ ...state, attack, state: from, progress: 1 }, { ...viewport, width });
                const b = pose({ ...state, attack, state: to, progress: 0 }, { ...viewport, width });
                for (const property of ['x', 'y', 'width', 'height']) {
                    expect(a.palm[property]).toBeCloseTo(b.palm[property], 8);
                }
                a.limbs.forEach((limb, index) => limb.spine.forEach((point, i) => {
                    expect(point.x).toBeCloseTo(b.limbs[index].spine[i].x, 8);
                    expect(point.y).toBeCloseTo(b.limbs[index].spine[i].y, 8);
                }));
            }
        }
    });

    test.each([390, 1280])('connected guides remain finite and attached in a %ipx arena', width => {
        for (const attack of ['grasp', 'sweep', 'closing_grasp']) {
            for (const name of ['ready', 'windup', 'strike', 'contact', 'exposed', 'recoil']) {
                for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
                    const value = pose({ ...state, attack, state: name, progress }, { ...viewport, width });
                    expect(value.limbs).toHaveLength(attack === 'closing_grasp' ? 2 : 1);
                    for (const limb of value.limbs) {
                        expect(limb.spine).toHaveLength(17);
                        expect(limb.outline).toHaveLength(34);
                        expect(limb.spine[0].x).toBeCloseTo(limb.anchor.x, 8);
                        expect(limb.spine[0].y).toBeCloseTo(limb.anchor.y, 8);
                        expect(limb.spine[16].x).toBeCloseTo(limb.palm.x, 8);
                        expect(limb.spine[16].y).toBeCloseTo(limb.palm.y - 15, 8);
                        for (const point of limb.outline) {
                            expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
                            expect(point.x).toBeGreaterThanOrEqual(0);
                            expect(point.x).toBeLessThanOrEqual(width);
                        }
                    }
                }
            }
        }
    });

    test('strike transmits deformation toward the tip rather than translating a rigid limb', () => {
        const palm = { x: 170, y: 477, width: 70, height: 42 }, anchor = { x: 362, y: 235 };
        const base = curve(palm, anchor, 'ready', 0);
        const dx = base.tip.x - anchor.x, dy = base.tip.y - anchor.y;
        const distance = Math.hypot(dx, dy);
        const peak = progress => {
            const limb = curve(palm, anchor, 'strike', progress);
            const curl = 26 * (1 - progress * progress * (3 - 2 * progress));
            const displacement = limb.spine.map((p, i) =>
                (p.x - base.spine[i].x) * -dy / distance + (p.y - base.spine[i].y) * dx / distance
                - curl * Math.sin(Math.PI * i / 16));
            return displacement.indexOf(Math.max(...displacement));
        };
        expect(peak(0.2)).toBeLessThan(8);
        expect(peak(0.8)).toBeGreaterThan(8);
    });

    test('curved guide does not add invisible whole-limb damage', () => {
        const value = pose(state, viewport);
        const point = value.limbs[0].spine[4];
        expect(value.hazards).toEqual([value.palm]);
        expect(overlaps({ left: point.x - 2, right: point.x + 2, top: point.y - 2, bottom: point.y + 2 }, value.hazards)).toBe(false);
        expect(pose(state, viewport)).toEqual(value);
    });
});
