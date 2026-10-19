const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { parse } = require('@babel/parser');
const TransformMatrix = require('phaser/src/gameobjects/components/TransformMatrix.js');

function loadModule(filename, exports, injected = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../dev', filename), 'utf8');
    const ast = parse(source, { sourceType: 'module' });
    const body = ast.program.body.filter(node => node.type !== 'ImportDeclaration'
        && !(node.type === 'ExportNamedDeclaration' && !node.declaration)).map(node => {
        const declaration = node.type.startsWith('Export') ? node.declaration : node;
        return source.slice(declaration.start, declaration.end);
    }).join('\n');
    return new Function(...Object.keys(injected), `${body}\nreturn { ${exports} };`)(...Object.values(injected));
}

// Synthetic dimensions exercise transforms and ownership, not visual quality.
function fixture() {
    const objects = [];
    const frames = new Map();
    const specs = {};
    function layer(role, width, height, x = 0, y = 0, origin = [0.5, 0.5], scale = 1) {
        const frame = { name: '__BASE', realWidth: width, realHeight: height,
            cutX: 0, cutY: 0, cutWidth: width, cutHeight: height, source: {}, sourceIndex: 0,
            rotated: false, trimmed: false, u0: 0, v0: 0, u1: 1, v1: 1 };
        frames.set(role, { key: role, firstFrame: '__BASE', frames: { __BASE: frame },
            has(name) { return Object.hasOwn(this.frames, name); } });
        return { key: role, x, y, origin, scale };
    }
    specs.shadow = layer('shadow', 360, 32, 0, 160);
    specs.exhaust = layer('exhaust', 80, 40, -180, 50);
    specs.farGear = layer('farGear', 12, 20, -100, 120, [0.5, 0], 2);
    specs.hull = layer('hull', 400, 200);
    specs.ramp = layer('ramp', 100, 10, -30, 80, [1, 0.5]);
    specs.cabin = layer('cabin', 300, 100);
    specs.hatch = layer('hatch', 120, 90);
    specs.nearGear = layer('nearGear', 12, 30, 100, 100, [0.5, 0], 2);
    const config = {
        layers: specs,
        creature: { ...layer('creature', 40, 40, -180, 160, [0.5, 1]),
            path: [[-180, 160], [-100, 160], [-50, 100], [0, 80]],
            cabinPath: [[0, 80], [0, 75], [-120, 65]] },
        astronaut: { ...layer('astronaut', 24, 56, -230, 160, [0.5, 1]),
            path: [[-230, 160], [-100, 160], [-50, 100], [30, 80]],
            cabinPath: [[30, 80], [20, 75], [-70, 65]] },
        doorway: { x: -60, y: 0, width: 120, height: 90 },
        cabin: { bounds: { x: -180, y: -40, width: 350, height: 160 },
            seats: { creature: { x: -140, y: 20, width: 45, height: 50 },
                astronaut: { x: -90, y: 0, width: 35, height: 70 } } },
        motion: { position: [400, 240], scale: 0.75, shipWidth: 400, shipHeight: 200,
            liftDistance: 240, heading: 1, hatchTravel: [0, -100], rampAngle: -0.6,
            nearGearAngle: -1, farGearAngle: 1, nearSupportLength: 60, farSupportLength: 40 }
    };
    for (const role of ['creature', 'astronaut']) {
        const texture = frames.get(role);
        config[role].source = { type: 'Sprite', active: true, texture, frame: texture.frames.__BASE,
            scaleX: 1, scaleY: 1, flipX: false, flipY: false, originX: 0.5, originY: 1,
            tintTopLeft: 0xffffff, tintTopRight: 0xffffff, tintBottomLeft: 0xffffff,
            tintBottomRight: 0xffffff, tintFill: false, destroy: jest.fn() };
    }
    function node(x, y, key) {
        const object = {
            x, y, key, children: [], scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, visible: true,
            originX: 0.5, originY: 0.5, parentContainer: null, destroyed: false,
            setPosition(x, y) { Object.assign(this, { x, y }); return this; },
            setScale(scaleX, scaleY = scaleX) { Object.assign(this, { scaleX, scaleY }); return this; },
            setOrigin(originX, originY) { Object.assign(this, { originX, originY }); return this; },
            setRotation(rotation) { this.rotation = rotation; return this; },
            setAlpha(alpha) { this.alpha = alpha; return this; },
            setVisible(visible) { this.visible = visible; return this; },
            setFlipX(flipX) { this.flipX = flipX; return this; },
            setFlipY(flipY) { this.flipY = flipY; return this; },
            setTint(...tint) { this.tints = tint; return this; },
            setTintFill(...tint) { this.fillTints = tint; return this; },
            add(child) {
                if (child.parentContainer === this) return this;
                if (child.parentContainer) {
                    const previous = child.parentContainer.children;
                    previous.splice(previous.indexOf(child), 1);
                }
                this.children.push(child); child.parentContainer = this; return this;
            }
        };
        object.destroy = jest.fn(() => {
            if (object.destroyed) return;
            object.destroyed = true;
            for (const child of [...object.children]) child.destroy();
            const parent = object.parentContainer;
            if (parent) parent.children.splice(parent.children.indexOf(object), 1);
            object.parentContainer = null;
        });
        objects.push(object);
        return object;
    }
    const scene = { events: new EventEmitter(), sys: { isPaused: () => false, isSleeping: () => false },
        add: { container: jest.fn((x, y) => node(x, y)), image: jest.fn((x, y, key) => node(x, y, key)) },
        textures: {
            exists: jest.fn(key => frames.has(key)),
            get: jest.fn(key => frames.get(key)),
            // Match Phaser's fallback, so a missing named frame cannot pass by accident.
            getFrame: jest.fn((key, name) => {
                const texture = frames.get(key);
                return texture?.frames[name || texture.firstFrame] || texture?.frames[texture.firstFrame];
            }),
            remove: jest.fn(), destroy: jest.fn()
        }
    };
    return { config, scene, frames, objects, layer };
}

function worldPoint(node, x = 0, y = 0) {
    let result = { x, y };
    for (let current = node; current; current = current.parentContainer) {
        const matrix = new TransformMatrix().applyITRS(current.x, current.y, current.rotation,
            current.scaleX, current.scaleY);
        result = matrix.transformPoint(result.x, result.y);
    }
    return result;
}

module.exports = { fixture, loadModule, worldPoint };
