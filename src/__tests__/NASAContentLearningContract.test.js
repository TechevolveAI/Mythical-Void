const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadNASAContentSystem(fetchMock = jest.fn()) {
    const filePath = path.join(__dirname, '../systems/NASAContentSystem.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { devLog, devWarn } from '../utils/devLogger.js';",
            'const devLog = () => {}; const devWarn = () => {};'
        )
        .replace(
            'export default nasaContentSystem;',
            'module.exports = { NASAContentSystem, nasaContentSystem };'
        );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: {},
        localStorage: {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        },
        fetch: fetchMock,
        Date,
        Math,
        Promise,
        setInterval,
        clearInterval,
        setTimeout
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports.NASAContentSystem;
}

describe('NASA discovery learning contract', () => {
    test('does not call the archived Mars Rover Photos endpoint', async () => {
        const fetchMock = jest.fn();
        const NASAContentSystem = loadNASAContentSystem(fetchMock);
        const system = new NASAContentSystem();

        await expect(system.fetchMarsPhoto()).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('keeps an APOD observation, exact source and fictional reaction separate', () => {
        const NASAContentSystem = loadNASAContentSystem();
        const system = new NASAContentSystem();
        system.getCreatureAPODComment = jest.fn(() => 'What might live beyond that horizon?');

        const discovery = system.createAPODDiscovery({
            title: 'Apollo 11 Landing Panorama',
            date: '2024-07-20',
            url: 'https://apod.nasa.gov/apod/image/2407/a11pan1040226lftsm.jpg',
            hdurl: 'https://apod.nasa.gov/apod/image/2407/a11pan1040226lft.jpg',
            explanation: 'Neil Armstrong photographed the landing site from the lunar module. The panorama records another world.',
            copyright: 'NASA / Apollo 11 / Neil Armstrong'
        });

        expect(discovery.realDataLabel).toBe('REAL NASA IMAGE');
        expect(discovery.sourceUrl).toBe('https://apod.nasa.gov/apod/ap240720.html');
        expect(discovery.sourceCredit).toContain('NASA / Apollo 11 / Neil Armstrong');
        expect(discovery.storyBoundaryLabel).toBe('MYTHICAL VOID IMAGINES');
        expect(discovery.learningPrompt).toMatch(/What details/i);
        expect(discovery.scienceSteps).toHaveLength(3);
    });

    test('explains a sol and credits Mars rover imagery', () => {
        const NASAContentSystem = loadNASAContentSystem();
        const system = new NASAContentSystem();
        system.getCreatureMarsComment = jest.fn(() => 'The shadows look like paths.');

        const discovery = system.createMarsDiscovery({
            img_src: 'http://mars.nasa.gov/example.jpg',
            sol: 4200,
            earth_date: '2024-06-28',
            rover: { name: 'Curiosity' },
            camera: { full_name: 'Navigation Camera' }
        });

        expect(discovery.imageUrl).toBe('https://mars.nasa.gov/example.jpg');
        expect(discovery.description).toContain('A sol is one Martian day.');
        expect(discovery.sourceCredit).toContain('NASA/JPL-Caltech');
        expect(discovery.realDataLabel).toBe('REAL NASA MARS IMAGE');
    });

    test('the visible modal labels the learning and story boundaries', () => {
        const modalSource = fs.readFileSync(
            path.join(__dirname, '../ui/NASAContentModal.js'),
            'utf8'
        );

        expect(modalSource).toContain("content.realDataLabel || 'REAL NASA DATA'");
        expect(modalSource).toContain("content.sourceLabel || 'NASA public data'");
        expect(modalSource).toContain('LOOK CLOSER');
        expect(modalSource).toContain('SPACE SCIENTIST’S LOG');
        expect(modalSource).toContain("content.storyBoundaryLabel || 'MYTHICAL VOID IMAGINES'");
        expect(modalSource).toContain('Back to the adventure');
    });
});
