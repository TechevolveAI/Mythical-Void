/**
 * Unit tests for HatchCinematics system
 * Validates timeline construction and beat ordering
 */

// Mock Phaser and window objects for testing
const createPhaserStub = () => {
    const mathStub = {
        Between: (min, max) => min,
        FloatBetween: (min, max) => min,
        DegToRad: (deg) => (deg * Math.PI) / 180,
        RadToDeg: (rad) => (rad * 180) / Math.PI,
        Distance: {
            Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
        }
    };

    const colorStub = {
        ValueToColor: (value) => {
            if (typeof value === 'number') {
                return {
                    color: value,
                    r: (value >> 16) & 255,
                    g: (value >> 8) & 255,
                    b: value & 255
                };
            }
            return { color: 0xffffff, r: 255, g: 255, b: 255 };
        },
        GetColor: (r, g, b) => (r << 16) | (g << 8) | b,
        Interpolate: {
            ColorWithColor: () => ({ r: 255, g: 255, b: 255 })
        },
        Lighten: () => ({ r: 255, g: 255, b: 255 })
    };

    return {
        Math: mathStub,
        Display: { Color: colorStub },
        BlendModes: { ADD: 'ADD', MULTIPLY: 'MULTIPLY' },
        Curves: { Path: class {} }
    };
};

global.window = {
    GameState: {
        emit: jest.fn(),
        get: jest.fn().mockReturnValue({ genes: {}, personality: {} })
    },
    Phaser: createPhaserStub()
};

const HatchCinematicsManager = require('../systems/HatchCinematics.js');

describe('HatchCinematics System', () => {
    let cinematics;
    let mockScene;

    beforeEach(() => {
        cinematics = new HatchCinematicsManager();
        
        // Mock Phaser scene
        mockScene = {
            time: {
                delayedCall: jest.fn()
            },
            cameras: {
                main: { width: 800, height: 600 }
            },
            add: {
                graphics: jest.fn(() => ({
                    lineStyle: jest.fn(),
                    beginPath: jest.fn(),
                    moveTo: jest.fn(),
                    lineTo: jest.fn(),
                    strokePath: jest.fn(),
                    setAlpha: jest.fn(),
                    fillGradientStyle: jest.fn(),
                    fillCircle: jest.fn(),
                    setPosition: jest.fn(),
                    fillStyle: jest.fn(),
                    fillRect: jest.fn()
                })),
                container: jest.fn(() => ({
                    add: jest.fn(),
                    setAlpha: jest.fn(),
                    setScale: jest.fn()
                })),
                text: jest.fn(() => ({
                    setOrigin: jest.fn()
                }))
            },
            tweens: {
                add: jest.fn()
            },
            children: {
                getByName: jest.fn()
            }
        };
    });

    describe('Configuration', () => {
        test('should initialize with default configuration', () => {
            cinematics.initialize();
            
            expect(cinematics.config).toBeDefined();
            expect(cinematics.config.timings).toBeDefined();
            expect(cinematics.config.effects).toBeDefined();
            expect(cinematics.config.colors).toBeDefined();
            expect(cinematics.config.sfx).toBeDefined();
        });

        test('should accept custom configuration', () => {
            const customConfig = {
                timings: {
                    crack: 1.0,
                    glowPulse: 3.0
                },
                effects: {
                    particleCount: 25
                }
            };
            
            cinematics.initialize(customConfig);
            
            expect(cinematics.config.timings.crack).toBe(1.0);
            expect(cinematics.config.timings.glowPulse).toBe(3.0);
            expect(cinematics.config.effects.particleCount).toBe(25);
        });

        test('should have correct default timing values', () => {
            cinematics.initialize();
            const timings = cinematics.config.timings;
            
            expect(timings.crack).toBe(0.5);
            expect(timings.glowPulse).toBe(2.0);
            expect(timings.particleLeak).toBe(1.0);
            expect(timings.shellPop).toBe(0.2);
            expect(timings.creatureBlink).toBe(0.8);
            expect(timings.traitCards).toBe(1.2);
            expect(timings.nameInput).toBe(0.6);
            expect(timings.firstEmote).toBe(0.4);
        });
    });

    describe('Timeline Construction', () => {
        beforeEach(() => {
            cinematics.initialize();
        });

        test('should create timeline with correct beat sequence', () => {
            cinematics.createTimeline(mockScene, cinematics.config, jest.fn());
            
            // Verify that time.delayedCall was called for each beat
            expect(mockScene.time.delayedCall).toHaveBeenCalledTimes(8);
            
            // Verify beat timing sequence
            const calls = mockScene.time.delayedCall.mock.calls;
            
            // Beat 1: Crack (0.0s)
            expect(calls[0][0]).toBe(0);
            
            // Beat 2: Glow (0.5s)
            expect(calls[1][0]).toBe(500);
            
            // Beat 3: Particles (2.5s)
            expect(calls[2][0]).toBe(2500);
            
            // Beat 4: Pop (3.5s) 
            expect(calls[3][0]).toBe(3500);
            
            // Beat 5: Blink (3.7s)
            expect(calls[4][0]).toBe(3700);
            
            // Beat 6: Cards (4.5s)
            expect(calls[5][0]).toBe(4500);
            
            // Beat 7: Naming (5.7s)
            expect(calls[6][0]).toBe(5700);
            
            // Final: Complete (6.7s)
            expect(calls[7][0]).toBe(6700);
        });

        test('should calculate cumulative timing correctly', () => {
            const config = cinematics.getDefaultConfig();
            const expectedTimings = [
                0.0,     // crack start
                0.5,     // glow start (0.0 + 0.5)
                2.5,     // particles start (0.5 + 2.0)
                3.5,     // pop start (2.5 + 1.0)
                3.7,     // blink start (3.5 + 0.2)
                4.5,     // cards start (3.7 + 0.8)
                5.7,     // naming start (4.5 + 1.2)
                6.7      // complete (5.7 + 0.6 + 0.4)
            ];
            
            cinematics.createTimeline(mockScene, config, jest.fn());
            const calls = mockScene.time.delayedCall.mock.calls;
            
            expectedTimings.forEach((expectedTime, index) => {
                expect(calls[index][0]).toBe(expectedTime * 1000);
            });
        });
    });

    describe('Effect Creation', () => {
        beforeEach(() => {
            cinematics.initialize();
        });

        test('should create crack effect with correct parameters', () => {
            cinematics.createCrack(mockScene, cinematics.config);
            
            expect(mockScene.add.graphics).toHaveBeenCalled();
            
            // Verify crack graphics setup
            const graphicsMock = mockScene.add.graphics();
            expect(graphicsMock.lineStyle).toHaveBeenCalledWith(
                cinematics.config.effects.crackLineWidth,
                cinematics.config.colors.crack,
                0.8
            );
        });

        test('should create glow effect with correct parameters', () => {
            cinematics.createGlowPulse(mockScene, cinematics.config);
            
            expect(mockScene.add.graphics).toHaveBeenCalled();
            expect(mockScene.tweens.add).toHaveBeenCalled();
            
            // Verify glow animation parameters
            const tweenCall = mockScene.tweens.add.mock.calls[0][0];
            expect(tweenCall.duration).toBe(cinematics.config.timings.glowPulse * 500);
            expect(tweenCall.repeat).toBe(1); // 2 total pulses
        });

        test('should create correct number of particles', () => {
            cinematics.createParticles(mockScene, cinematics.config);
            
            // Should create graphics for each particle
            expect(mockScene.add.graphics).toHaveBeenCalledTimes(
                cinematics.config.effects.particleCount
            );
        });

        test('should create trait cards with fan-out positioning', () => {
            cinematics.createTraitCards(mockScene, cinematics.config);
            
            // Should create container for cards
            expect(mockScene.add.container).toHaveBeenCalled();
            
            // Should create graphics for each trait
            expect(mockScene.add.graphics).toHaveBeenCalled();
            expect(mockScene.add.text).toHaveBeenCalled();
        });
    });

    describe('Telemetry Logging', () => {
        beforeEach(() => {
            cinematics.initialize();
            cinematics.startTime = Date.now();
        });

        test('should log telemetry events with correct data', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            cinematics.logTelemetry('test_event', { phase: 'crack', offset: 1.5 });
            
            expect(consoleSpy).toHaveBeenCalled();
            expect(window.GameState.emit).toHaveBeenCalledWith(
                'telemetry/hatch_cinematic',
                expect.objectContaining({
                    event: 'test_event',
                    phase: 'crack',
                    offset: 1.5,
                    timestamp: expect.any(Number)
                })
            );
            
            consoleSpy.mockRestore();
        });

        test('should calculate timing offset correctly', () => {
            const startTime = Date.now();
            cinematics.startTime = startTime;
            
            // Simulate 1 second delay
            jest.spyOn(Date, 'now').mockReturnValue(startTime + 1000);
            
            cinematics.logTelemetry('test_event');
            
            expect(window.GameState.emit).toHaveBeenCalledWith(
                'telemetry/hatch_cinematic',
                expect.objectContaining({
                    offset: 1.0
                })
            );
            
            Date.now.mockRestore();
        });
    });

    describe('Configuration Validation', () => {
        test('should have all required timing properties', () => {
            const config = cinematics.getDefaultConfig();
            const requiredTimings = [
                'crack', 'glowPulse', 'particleLeak', 'shellPop', 
                'creatureBlink', 'traitCards', 'nameInput', 'firstEmote'
            ];
            
            requiredTimings.forEach(timing => {
                expect(config.timings).toHaveProperty(timing);
                expect(typeof config.timings[timing]).toBe('number');
                expect(config.timings[timing]).toBeGreaterThan(0);
            });
        });

        test('should have all required effect properties', () => {
            const config = cinematics.getDefaultConfig();
            const requiredEffects = [
                'crackLineWidth', 'glowRadius', 'particleCount', 
                'shakeAmplitude', 'shakeDuration', 'cardFanAngle', 'cardSpacing'
            ];
            
            requiredEffects.forEach(effect => {
                expect(config.effects).toHaveProperty(effect);
                expect(typeof config.effects[effect]).toBe('number');
                expect(config.effects[effect]).toBeGreaterThan(0);
            });
        });

        test('should have valid sound effect mappings', () => {
            const config = cinematics.getDefaultConfig();
            const requiredSfx = [
                'crack', 'glow', 'pop', 'blink', 'cards', 'whoosh', 'emote'
            ];
            
            requiredSfx.forEach(sfx => {
                expect(config.sfx).toHaveProperty(sfx);
                expect(typeof config.sfx[sfx]).toBe('string');
                expect(config.sfx[sfx].length).toBeGreaterThan(0);
            });
        });
    });

    describe('Total Sequence Duration', () => {
        test('should complete in expected timeframe (8-10 seconds)', () => {
            const config = cinematics.getDefaultConfig();
            const totalDuration = Object.values(config.timings).reduce((sum, duration) => sum + duration, 0);
            
            expect(totalDuration).toBeGreaterThanOrEqual(8.0);
            expect(totalDuration).toBeLessThanOrEqual(10.0);
        });
    });
});
